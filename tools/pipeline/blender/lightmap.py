# Licht backen, Schritt 2 (Auftrag V3, Phase 3): indirektes Licht und Umgebungsverdeckung des Hörsaals mit Cycles.
#
#   blender --background --python tools/pipeline/blender/lightmap.py -- <scene.json> <out-dir> [--size 2048] [--atlases 4]
#                                                                       [--samples 48] [--ao-samples 64] [--threads 2]
#
# Eingabe: tools/lightmap-export.mjs (Empfänger = gebatchte Saal-Meshes, Verdecker = Requisiten/Einbauten, Lichtquellen).
# Ablauf
#   1. Empfänger und Verdecker als Meshes anlegen (Vertexreihenfolge wie im Spiel), Grundfarbe je Material.
#   2. Verdeckte Flächen finden (Strahl entlang der Normalen trifft nach < 5 mm etwas, oder Fläche liegt in/hinter einer Wand)
#      und deren UV-Inseln auf fast null schrumpfen – sie kosten sonst ein Drittel der Atlasfläche.
#   3. Lightmap-UVs: Smart-UV-Projektion je Objekt, Inseln nach 3D-Fläche skaliert, Objekte gleichmäßig auf die Atlanten
#      verteilt und je Atlas gemeinsam gepackt.
#   4. Backen (nur indirektes Licht, ohne Materialfarbe = Bestrahlungsstärke/π) für drei Quellen getrennt: Deckenleuchten
#      (dieselben Rechtecke wie die Echtzeit-Flächenlichter), Himmel (Weltfarbe 1) und Sonne (Stärke 1); dazu
#      Umgebungsverdeckung (0,8 m). Jedes Bild wird mit dem Denoiser des Compositors (OpenImageDenoise) entrauscht.
#   5. Ausgabe: je Atlas und Quelle ein EXR (linear) sowie je Empfänger die neue Vertexzuordnung (Vertex → Original-Vertex),
#      Lightmap-UVs und Indexliste (Vertices an UV-Nähten werden verdoppelt).
import bpy, bmesh, sys, os, json, math, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:]
scene_json = os.path.abspath(argv[0]); out_dir = os.path.abspath(argv[1])
def opt(name, default):
    return type(default)(argv[argv.index('--' + name) + 1]) if '--' + name in argv else default
SIZE = opt('size', 2048); ATLASES = opt('atlases', 4); SAMPLES = opt('samples', 48); AO_SAMPLES = opt('ao-samples', 64); THREADS = opt('threads', 2)
ONLY = opt('only', '')  # z. B. "ao" zum Testen
os.makedirs(out_dir, exist_ok=True)
T0 = time.time()
def log(*a): print('[lightmap %5.0fs]' % (time.time() - T0), *a, flush=True)

S = json.load(open(scene_json))
blob = open(scene_json[:-5] + '.bin', 'rb').read()
def arr(r, key, dtype): o, n = r[key]; return np.frombuffer(blob, dtype=dtype, count=n // np.dtype(dtype).itemsize, offset=o)

# ------------------------------------------------------------------------------------------------ Szene leeren, Cycles
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.render.threads_mode = 'FIXED'; sc.render.threads = THREADS
sc.cycles.max_bounces = 4; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 0; sc.cycles.transmission_bounces = 0
sc.cycles.use_denoising = False
world = bpy.data.worlds.new('Welt'); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']

def srgb_to_lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]

def make_mesh(name, r):
    pos = arr(r, 'pos', np.float32).reshape(-1, 3); idx = arr(r, 'idx', np.uint32).reshape(-1, 3); nor = arr(r, 'nor', np.float32).reshape(-1, 3)
    me = bpy.data.meshes.new(name)
    # three.js (y oben) → Blender (z oben): (x, y, z) → (x, −z, y)
    v = np.empty_like(pos); v[:, 0] = pos[:, 0]; v[:, 1] = -pos[:, 2]; v[:, 2] = pos[:, 1]
    me.vertices.add(len(v)); me.vertices.foreach_set('co', v.ravel())
    me.loops.add(idx.size); me.loops.foreach_set('vertex_index', idx.astype(np.int32).ravel())
    me.polygons.add(len(idx)); me.polygons.foreach_set('loop_start', np.arange(0, idx.size, 3, dtype=np.int32)); me.polygons.foreach_set('loop_total', np.full(len(idx), 3, dtype=np.int32))
    me.update(calc_edges=True); me.validate(clean_customdata=False)
    n = np.empty_like(nor); n[:, 0] = nor[:, 0]; n[:, 1] = -nor[:, 2]; n[:, 2] = nor[:, 1]
    ln = np.linalg.norm(n, axis=1, keepdims=True); ln[ln == 0] = 1; n /= ln
    try:
        if not os.environ.get('NOCN'): me.normals_split_custom_set_from_vertices([tuple(x) for x in n])
    except Exception as e: log('Normalen', name, e)
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    return ob

def principled(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    return m

# ------------------------------------------------------------------------------------------------ 1. Geometrie
receivers = []
for k, r in enumerate(S['receivers']):
    ob = make_mesh('R%03d' % k, r); ob['index'] = r['index']; ob['verts'] = r['verts']
    ob.data.materials.append(principled('M%03d' % k, srgb_to_lin(r['albedo'])))
    receivers.append(ob)
occ_mat = principled('Verdecker', [0.18, 0.18, 0.18])
occluders = []
for k, r in enumerate(S['occluders']):
    ob = make_mesh('O%03d' % k, r); ob.data.materials.append(principled('MO%03d' % k, srgb_to_lin(r['albedo']) if r['albedo'] != '#8c8c8c' else [0.18] * 3)); occluders.append(ob)
log('Empfänger', len(receivers), 'Verdecker', len(occluders))

# ------------------------------------------------------------------------------------------------ 2. verdeckte Flächen
dg = bpy.context.evaluated_depsgraph_get()
allv, allf = [], []
for ob in receivers + occluders:
    me = ob.data; base = len(allv)
    allv += [ob.matrix_world @ v.co for v in me.vertices]
    allf += [tuple(base + i for i in p.vertices) for p in me.polygons]
bvh = BVHTree.FromPolygons(allv, allf, epsilon=0.0)
hidden = {}
for ob in receivers:
    me = ob.data; h = np.zeros(len(me.polygons), dtype=bool)
    for p in me.polygons:
        c = p.center; n = p.normal
        if n.length < 0.5: continue
        hit = bvh.ray_cast(c + n * 0.0015, n, 0.005)
        if hit[0] is not None: h[p.index] = True; continue
        # nach unten zeigende Böden-Unterseiten und Flächen außerhalb des Raums (Wandrückseiten, Deckenoberseite)
        x, y, z = c.x, -c.y, c.z   # zurück in Spielkoordinaten (x, y=oben, z)
        if n.z < -0.9 and z < 0.01: h[p.index] = True
        elif z > 4.02 or x < -5.05 or x > 4.65 or y < -6.05 or y > 6.05: h[p.index] = True
    hidden[ob.name] = h
log('verdeckte Flächen', sum(int(h.sum()) for h in hidden.values()), 'von', sum(len(o.data.polygons) for o in receivers))

# ------------------------------------------------------------------------------------------------ 3. Lightmap-UVs
# Abgewickelt werden Arbeitskopien ohne verdeckte Flächen (jede verdeckte Fläche wäre sonst eine eigene Insel mit Rand –
# bei Tausenden Inseln frisst der Rand den Atlas). Danach werden die UVs flächenweise ins Original zurückkopiert.
def area(ob):
    return sum(p.area for p, hh in zip(ob.data.polygons, hidden[ob.name]) if not hh)
work = {}
for ob in receivers:
    me2 = ob.data.copy(); bm = bmesh.new(); bm.from_mesh(me2); bm.faces.ensure_lookup_table()
    h = hidden[ob.name]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if h[f.index]], context='FACES_ONLY')
    bm.to_mesh(me2); bm.free()
    for l in list(me2.uv_layers): me2.uv_layers.remove(l)
    me2.uv_layers.new(name='LM')
    w = bpy.data.objects.new(ob.name + '_w', me2); sc.collection.objects.link(w); work[ob.name] = w
# gleichmäßig auf die Atlanten verteilen (größte zuerst in den leersten Atlas)
groups = [[] for _ in range(ATLASES)]; load = [0.0] * ATLASES
for ob in sorted(receivers, key=area, reverse=True):
    k = load.index(min(load)); groups[k].append(ob); load[k] += area(ob); ob['atlas'] = k
log('Atlasflächen (m²)', [round(a, 1) for a in load])
for k, grp in enumerate(groups): log('Atlas', k, [(o.name, S['receivers'][int(o.name[1:])]['material'], len(o.data.polygons) - int(hidden[o.name].sum()), round(area(o), 1)) for o in grp])
def edit(objs, fn):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.select_all(action='SELECT')
    fn()
    bpy.ops.object.mode_set(mode='OBJECT')
margin = 2.5 / SIZE
for k, grp in enumerate(groups):
    if not grp: continue
    ws = [work[ob.name] for ob in grp]
    if os.environ.get('LMPACK', 'lightmap') == 'lightmap':
        # Lightmap-Pack: jede Fläche (Dreieckspaare als Quads) eigene Insel, Größe nach Fläche, alle Objekte in einem Atlas
        edit(ws, lambda: bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False, PREF_BOX_DIV=int(os.environ.get('BOXDIV', 48)), PREF_MARGIN_DIV=float(os.environ.get('MDIV', 0.1))))
    else:
        edit(ws, lambda: bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False))
        edit(ws, lambda: bpy.ops.uv.average_islands_scale())
        edit(ws, lambda: bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, scale=True, margin_method='FRACTION', margin=margin, shape_method='CONCAVE'))
    # zurückkopieren: sichtbare Flächen in Originalreihenfolge ↔ Flächen der Arbeitskopie; verdeckte auf einen Punkt
    for ob in grp:
        me = ob.data; L = me.uv_layers.new(name='LM').data; W = work[ob.name].data; WL = W.uv_layers['LM'].data
        vis = [p for p in me.polygons if not hidden[ob.name][p.index]]
        assert len(vis) == len(W.polygons), (ob.name, len(vis), len(W.polygons))
        for p, q in zip(vis, W.polygons):
            for li, lj in zip(p.loop_indices, q.loop_indices): L[li].uv = WL[lj].uv
        for p in me.polygons:
            if hidden[ob.name][p.index]:
                for i in p.loop_indices: L[i].uv = (0.0005, 0.0005)
    eff = sum(abs((W[l[1]].uv - W[l[0]].uv).cross(W[l[2]].uv - W[l[0]].uv)) / 2 for w in ws for W in [w.data.uv_layers['LM'].data] for p in w.data.polygons for l in [list(p.loop_indices)])
    log('Atlas', k, 'UV-Ausnutzung %.0f %%' % (eff * 100))
for w in work.values(): bpy.data.objects.remove(w, do_unlink=True)
log('UVs gepackt')

# ------------------------------------------------------------------------------------------------ 4. Lichtquellen
H = 4.0
def emitter(name, cx, cz, w, d, y, strength):
    """einseitige Leuchtfläche (nach unten), Spielkoordinaten"""
    me = bpy.data.meshes.new(name)
    xs, zs = (cx - w / 2, cx + w / 2), (cz - d / 2, cz + d / 2)
    vs = [(xs[0], -zs[0], y), (xs[1], -zs[0], y), (xs[1], -zs[1], y), (xs[0], -zs[1], y)]
    me.from_pydata(vs, [], [(0, 1, 2, 3)])  # Normale nach unten (−z in Blender)
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mix = nt.nodes.new('ShaderNodeMixShader'); geo = nt.nodes.new('ShaderNodeNewGeometry')
    nt.links.new(geo.outputs['Backfacing'], mix.inputs['Fac']); nt.links.new(em.outputs[0], mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs['Surface'])
    ob.data.materials.append(m); ob.visible_camera = False
    return ob
art = []
rows = sorted(set(p[1] for p in S['light']['ledPanels']))
for z in rows: art.append(emitter('LED_%.1f' % z, 0, z, 6.6, 0.6, H - 0.035, 5.5))   # wie RectAreaLight(5.5, 6.6 × 0.6)
def spot(name, pos, target, intensity_cd, angle):
    L = bpy.data.lights.new(name, 'SPOT'); L.energy = 4 * math.pi * intensity_cd; L.spot_size = 2 * angle; L.spot_blend = 0.6; L.shadow_soft_size = 0.1
    ob = bpy.data.objects.new(name, L); sc.collection.objects.link(ob)
    p = Vector((pos[0], -pos[2], pos[1])); t = Vector((target[0], -target[2], target[1]))
    ob.location = p; ob.rotation_euler = (t - p).to_track_quat('-Z', 'Y').to_euler()
    return ob
BOARD_X, Z0 = -2.2, -6.0
for dx in (-1.1, 1.1): art.append(spot('Tafel%+.1f' % dx, (BOARD_X + dx, H - 0.1, Z0 + 1.8), (BOARD_X + dx * 0.6, 2.0, Z0), 7, 0.6))
art.append(spot('Pult', (3.65 - 0.3, H - 0.1, -4.55 + 0.6), (3.65, 1, -4.55), 4, 0.6))
sd = S['light']['sunDir']  # Richtung des Sonnenlichts (Spiel)
sunL = bpy.data.lights.new('Sonne', 'SUN'); sunL.energy = 1.0; sunL.angle = math.radians(0.6)
sun = bpy.data.objects.new('Sonne', sunL); sc.collection.objects.link(sun)
dvec = Vector((sd[0], -sd[2], sd[1])).normalized(); sun.rotation_euler = dvec.to_track_quat('-Z', 'Y').to_euler()

def setup(component):
    for ob in art: ob.hide_render = component != 'art'
    sun.hide_render = component != 'sun'
    bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 1.0 if component == 'sky' else 0.0

# ------------------------------------------------------------------------------------------------ 5. Backen + Entrauschen
def bake_image(k, name):
    img = bpy.data.images.new('A%d_%s' % (k, name), SIZE, SIZE, alpha=False, float_buffer=True)
    for ob in groups[k]:
        m = ob.data.materials[0]; nt = m.node_tree
        node = nt.nodes.get('LM') or nt.nodes.new('ShaderNodeTexImage'); node.name = 'LM'; node.image = img
        uvn = nt.nodes.get('LMUV') or nt.nodes.new('ShaderNodeUVMap'); uvn.name = 'LMUV'; uvn.uv_map = 'LM'
        if not node.inputs['Vector'].links: nt.links.new(uvn.outputs['UV'], node.inputs['Vector'])
        nt.nodes.active = node
        ob.data.uv_layers.active = ob.data.uv_layers['LM']
    return img

den_sc = bpy.data.scenes.new('Entrauschen')
den_sc.render.engine = 'CYCLES'; den_sc.cycles.samples = 1; den_sc.render.resolution_x = SIZE; den_sc.render.resolution_y = SIZE; den_sc.render.resolution_percentage = 100
den_sc.use_nodes = True; den_sc.view_settings.view_transform = 'Standard'; den_sc.render.image_settings.file_format = 'OPEN_EXR'; den_sc.render.image_settings.color_depth = '16'
def denoise(img, path):
    nt = den_sc.node_tree; nt.nodes.clear()
    i = nt.nodes.new('CompositorNodeImage'); i.image = img
    d = nt.nodes.new('CompositorNodeDenoise'); d.use_hdr = True; d.prefilter = 'ACCURATE'
    o = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(i.outputs['Image'], d.inputs['Image']); nt.links.new(d.outputs['Image'], o.inputs['Image'])
    den_sc.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=den_sc.name)

if os.environ.get('SAVEBLEND'): bpy.ops.wm.save_as_mainfile(filepath=os.environ['SAVEBLEND'])
for k in range(ATLASES):
    if not groups[k]: continue
    comps = ['ao', 'art', 'sky', 'sun'] if not ONLY else ONLY.split(',')
    for comp in comps:
        img = bake_image(k, comp)
        bpy.ops.object.select_all(action='DESELECT')
        for ob in groups[k]: ob.select_set(True)
        bpy.context.view_layer.objects.active = groups[k][0]
        t = time.time()
        if comp == 'ao':
            sc.cycles.samples = AO_SAMPLES; world.light_settings.distance = 0.8
            bpy.ops.object.bake(type='AO', margin=8, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
        else:
            setup(comp); sc.cycles.samples = SAMPLES
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'}, margin=8, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
        if os.environ.get('LMDEBUG'):
            px = np.empty(SIZE * SIZE * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
            uvs = np.array([d.uv[:] for d in groups[k][0].data.uv_layers['LM'].data])
            for im2 in bpy.data.images:
                if im2.size[0] == 0: continue
                q = np.empty(im2.size[0] * im2.size[1] * 4, np.float32); im2.pixels.foreach_get(q); log('IMG', im2.name, im2.size[:], float(q.reshape(-1, 4)[:, :3].mean()))
            m0 = groups[k][0].data.materials[0]; log('MAT', m0.name, [(n.name, n.type, getattr(n, 'image', None) and n.image.name) for n in m0.node_tree.nodes], 'active', m0.node_tree.nodes.active.name if m0.node_tree.nodes.active else None)
            log('DEBUG', comp, 'mean', px[:, :3].mean(0).round(4), 'nonzero', (px[:, :3].sum(1) > 0).mean().round(3), 'uv min', uvs.min(0).round(3), 'max', uvs.max(0).round(3), 'uv layers', [u.name for u in groups[k][0].data.uv_layers], 'sel', len(bpy.context.selected_objects))
        raw = os.path.join(out_dir, 'a%d_%s_raw.exr' % (k, comp))
        img.filepath_raw = raw; img.file_format = 'OPEN_EXR'; img.save()
        denoise(img, os.path.join(out_dir, 'a%d_%s.exr' % (k, comp)))
        log('Atlas', k, comp, 'gebacken in %.0f s' % (time.time() - t))

# ------------------------------------------------------------------------------------------------ 6. UV-Zuordnung je Empfänger
meta = {'size': SIZE, 'atlases': ATLASES, 'samples': SAMPLES, 'aoSamples': AO_SAMPLES, 'receivers': []}
bins = bytearray()
for ob in receivers:
    me = ob.data; uv = me.uv_layers['LM'].data
    key2new, remap, uvs, index = {}, [], [], []
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index; u, v = uv[li].uv
            key = (vi, round(u * SIZE * 4), round(v * SIZE * 4))
            n = key2new.get(key)
            if n is None: n = len(remap); key2new[key] = n; remap.append(vi); uvs += [u, 1.0 - v]
            index.append(n)
    rec = {'index': ob['index'], 'verts': ob['verts'], 'atlas': ob['atlas'], 'newVerts': len(remap), 'tris': len(index) // 3}
    for name, a in (('map', np.array(remap, np.uint32)), ('uv', np.array(uvs, np.float32)), ('idx', np.array(index, np.uint32))):
        rec[name] = [len(bins), a.nbytes]; bins += a.tobytes()
    meta['receivers'].append(rec)
open(os.path.join(out_dir, 'uv.bin'), 'wb').write(bins)

# ------------------------------------------------------------------------------------------------ 7. Wettervarianten (PNG)
# Bestrahlungsstärke E = π · (Decke + Himmel · Fensterleuchtdichte · Himmelsfarbe + Sonne · Stärke · Sonnenfarbe), Werte wie
# WEATHER in src/scene/lighting.js. RGB = sRGB(E / SCALE), Alpha = Umgebungsverdeckung. Laufzeit: lightMapIntensity = SCALE.
WEATHER = {'sunny': (3.2, '#d6e6f5', 2.7, '#fff0d6'), 'cloudy': (2.2, '#c9d2da', 0.55, '#e8eef5')}
def load_px(path):
    im = bpy.data.images.load(path); a = np.empty(SIZE * SIZE * 4, np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    return a.reshape(SIZE, SIZE, 4)
def srgb_enc(x):
    x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)
meta['weather'] = {}
if not ONLY:
    comps = {k: {c: load_px(os.path.join(out_dir, 'a%d_%s.exr' % (k, c))) for c in ('art', 'sky', 'sun', 'ao')} for k in range(ATLASES) if groups[k]}
    for wname, (skyL, skyC, sunE, sunC) in WEATHER.items():
        sc_, sun_ = np.array(srgb_to_lin(skyC)) * skyL, np.array(srgb_to_lin(sunC)) * sunE
        Es = {k: math.pi * (c['art'][..., :3] + c['sky'][..., :3] * sc_ + c['sun'][..., :3] * sun_) for k, c in comps.items()}
        allE = np.concatenate([e.reshape(-1, 3) for e in Es.values()])
        scale = float(max(0.5, np.percentile(allE.max(axis=1), 99.7)))
        meta['weather'][wname] = {'scale': round(scale, 4)}
        for k, E in Es.items():
            rgba = np.empty((SIZE, SIZE, 4), np.float32)
            rgba[..., :3] = srgb_enc(E / scale); rgba[..., 3] = np.clip(comps[k]['ao'][..., 0], 0, 1)
            im = bpy.data.images.new('out', SIZE, SIZE, alpha=True); im.colorspace_settings.name = 'Non-Color'
            im.pixels.foreach_set(rgba.ravel()); im.filepath_raw = os.path.join(out_dir, 'lm_%s_%d.png' % (wname, k)); im.file_format = 'PNG'; im.save(); bpy.data.images.remove(im)
        log('Wetter', wname, 'Skala', round(scale, 3))
json.dump(meta, open(os.path.join(out_dir, 'uv.json'), 'w'), indent=1)
log('fertig')
