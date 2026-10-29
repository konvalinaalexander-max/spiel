# Menschen-Pipeline (Auftrag V3, Phase 4): MPFB 2 (MakeHuman, CC0-Assets) → spielfertiges GLB mit dem Skelett des Spiels.
#
#   blender --background --python tools/pipeline/blender/human.py -- <spec.json> <out.glb> [<out.json>]
#
# Ablauf
#   1. Figur aus Phänotyp, Haut, Augen, Brauen, Wimpern, Haar und Kleidung (MakeHuman-Assetpakete, alle CC0) erzeugen,
#      mit dem MakeHuman-Standardskelett ("default", 163 Knochen) und dessen Gewichten.
#   2. Ruhepose an das Spiel anpassen: Arme senkrecht hängend (Handflächen zum Körper, Daumen nach vorn), Beine senkrecht.
#      Die Verformung übernimmt das MakeHuman-Skelett selbst; danach werden Pose, Formschlüssel und Masken fest angewendet.
#   3. Spielskelett (Namen wie src/chars/rig.js) an die Gelenkpositionen setzen und die 163 Gewichtsgruppen auf dessen
#      Knochen zusammenfassen (je Vertex höchstens vier Einflüsse). Für Nahfiguren ("fingers": "full") bekommt jeder Finger
#      drei Glieder, für die Menge reicht ein gemeinsamer Fingerknochen.
#   4. Materialien vereinfachen (Principled BSDF mit Farb- und Normalentextur; Haar/Brauen/Wimpern mit Alphakanal),
#      optional Polygone reduzieren, als GLB exportieren. Gelenke und Kennzahlen zusätzlich als JSON.
import bpy, sys, os, json, math, re
import addon_utils
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
spec = json.load(open(argv[0], encoding='utf-8'))
out_glb = os.path.abspath(argv[1])
out_json = os.path.abspath(argv[2]) if len(argv) > 2 else out_glb[:-4] + '.meta.json'

addon_utils.enable('bl_ext.user_default.mpfb', default_set=True)
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402
from bl_ext.user_default.mpfb.services.assetservice import AssetService  # noqa: E402

LOG = []
def log(*a):
    s = ' '.join(str(x) for x in a); LOG.append(s); print('[human]', s, flush=True)

def read_mhmat(path):
    """MakeHuman-Materialdatei lesen: Texturen (absolute Pfade), Farbe, Transparenz."""
    r = {'dir': os.path.dirname(path)}
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.strip().split(None, 1)
        if len(p) < 2 or p[0].startswith('#') or p[0].startswith('//'): continue
        k, v = p[0], p[1].strip()
        if k.endswith('Texture'):
            f = os.path.join(r['dir'], os.path.basename(v))
            if os.path.isfile(f): r[k] = f
        elif k == 'diffuseColor': r[k] = [float(x) for x in v.split()[:3]]
        elif k in ('transparent', 'alphaToCoverage', 'backfaceCull'): r[k] = v.lower() == 'true'
    return r

# --------------------------------------------------------------------------------------------- 1. Figur erzeugen
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
AssetService.update_all_asset_lists()

info = HumanService._create_default_human_info_dict()
ph = info['phenotype']
for k, v in spec.get('phenotype', {}).items():
    if k == 'race': ph['race'].update(v)
    else: ph[k] = v
info['name'] = spec['id']
info['rig'] = 'default'
for part in ('eyes', 'eyebrows', 'eyelashes', 'hair', 'teeth', 'tongue'):
    info[part] = spec.get(part, '') or ''
info['clothes'] = list(spec.get('clothes', [])) + list(spec.get('accessories', []))
info['proxy'] = spec.get('proxy', '') or ''
info['skin_mhmat'] = spec.get('skin', '')
info['skin_material_type'] = 'MAKESKIN'
info['eyes_material_type'] = 'MAKESKIN'
info['clothes_material_type'] = 'MAKESKIN'
settings = HumanService.get_default_deserialization_settings()
settings.update({'subdiv_levels': 0, 'material_instances': 'NEVER', 'override_skin_model': 'PRESET', 'override_rig': 'PRESET'})
body = HumanService.deserialize_from_dict(info, settings)
rig = body.parent
assert rig and rig.type == 'ARMATURE', 'kein Skelett'
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
log('Objekte:', ', '.join(f'{o.name}({len(o.data.vertices)})' for o in meshes))

# Formschlüssel (Körpermaße) und Masken (Hilfsgeometrie, verdeckte Körperteile) fest anwenden – noch in der A-Pose
import bmesh
def apply_masks(o):
    """MASK-Modifier exakt nachbilden (Gruppe, Umkehrung, Schwelle) und die ausgeblendeten Vertices löschen."""
    masks = [m for m in o.modifiers if m.type == 'MASK' and m.vertex_group]
    pn0 = os.path.basename(spec.get('proxy') or '').replace('.proxy', '').replace('.mhclo', '')
    is_skin = (o == body and not pn0) or (pn0 and o != body and pn0 in o.name)
    if is_skin:
        # Kleidungsmasken von MPFB löschen oft mehr als verdeckt ist (Lücke am Kragen) → verdeckte Haut entfernt später der Strahltest
        for m in masks: o.modifiers.remove(m)
        masks = []
    helpers = [g.index for g in o.vertex_groups if g.name.startswith(('helper-', 'joint-')) or g.name in ('HelperGeometry', 'JointCubes')] if o == body else []
    if not masks and not helpers: return
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    dl = bm.verts.layers.deform.active
    kill = set()
    # Hilfsgeometrie des Grundnetzes (Augenkugeln, Zähne, Strumpfhose, Gelenkwürfel) immer entfernen
    if helpers and dl is not None:
        for v in bm.verts:
            if any(v[dl].get(gi, 0.0) > 0.0 for gi in helpers): kill.add(v)
    for m in masks:
        g = o.vertex_groups.get(m.vertex_group)
        gi = g.index if g else -1
        for v in bm.verts:
            w = v[dl].get(gi, 0.0) if dl is not None else 0.0
            inside = w > m.threshold
            if inside == m.invert_vertex_group: kill.add(v)
    bmesh.ops.delete(bm, geom=list(kill), context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    for m in masks: o.modifiers.remove(m)
    log('Maske', o.name, '-', len(kill), 'Vertices')

def apply_mods(types):
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        for x in bpy.context.selected_objects: x.select_set(False)
        o.select_set(True)
        if o.data.shape_keys:
            bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
        if 'MASK' in types: apply_masks(o)
        for m in list(o.modifiers):
            if m.type == 'SUBSURF': o.modifiers.remove(m); continue
            if m.type in types and m.type != 'MASK':
                try: bpy.ops.object.modifier_apply(modifier=m.name)
                except Exception as e: log('Modifier nicht anwendbar', o.name, m.name, e)
apply_mods(('MASK',))

# Mit Körper-Proxy (leichte Figuren für die Menge) ist das Grundnetz jetzt leer → der Proxy übernimmt die Rolle „Haut“
skin_obj = body
pname = os.path.basename(spec.get('proxy') or '').replace('.proxy', '').replace('.mhclo', '')
if pname:
    skin_obj = next((o for o in meshes if o != body and pname in o.name), body)
for o in list(meshes):
    if len(o.data.vertices) == 0:
        meshes.remove(o)
        if o == skin_obj: skin_obj = None
        bpy.data.objects.remove(o, do_unlink=True)
assert skin_obj is not None, 'kein Hautobjekt'

def pre_kind(o):
    if o == skin_obj: return 'body'
    for part, kind in (('eyes', 'eyes'), ('eyebrows', 'eyebrow'), ('eyelashes', 'eyelash'), ('hair', 'hair'), ('teeth', 'teeth'), ('tongue', 'tongue')):
        if spec.get(part) and o.name.endswith('.' + os.path.basename(spec[part]).replace('.mhclo', '').replace('.proxy', '').replace(' ', '_')): return kind
    for f in spec.get('accessories', []):
        if o.name.endswith('.' + os.path.basename(f).replace('.mhclo', '').replace(' ', '_')): return 'glasses'
    return 'clothes'

# Polygonbudget je Teilart (Menge: wenige tausend Vertices je Kleidungsstück; Hauptfiguren großzügig)
budget = spec.get('maxVerts') or {}
for o in meshes:
    kind = pre_kind(o)
    lim = budget.get(kind)
    if not lim or len(o.data.vertices) <= lim: continue
    ratio = max(0.08, lim / len(o.data.vertices))
    d = o.modifiers.new('Reduzieren', 'DECIMATE'); d.ratio = ratio; d.use_collapse_triangulate = True
    # Reduktion vor dem Skelett-Modifier anwenden
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects: s.select_set(False)
    o.select_set(True)
    bpy.ops.object.modifier_move_to_index(modifier='Reduzieren', index=0)
    bpy.ops.object.modifier_apply(modifier='Reduzieren')
    log('reduziert', o.name, kind, f'{ratio:.2f}', len(o.data.vertices))


# Kleidungsschichten: innere Schicht (Haut, Hose unter Pullover …) knapp unter die äußere drücken, damit nichts durchstößt.
# Nur Vertices, die wirklich „unter“ einer Fläche der äußeren Schicht liegen (nicht hinter einem Saum).
from mathutils.bvhtree import BVHTree
def zdepth(o):
    """Schichtreihenfolge: Haut 0, Kleidung in der Reihenfolge der Spezifikation (innen → außen).
    (Die z_depth-Werte der Pakete sind fast überall 50 und taugen dafür nicht.)"""
    if o == skin_obj: return 0
    if any(k in o.name.lower() for k in ('shoe', 'boot', 'sneaker')): return 0.5  # Schuhe unter dem Hosensaum
    for i, f in enumerate(spec.get('clothes', [])):
        if o.name.endswith('.' + os.path.basename(f).replace('.mhclo', '').replace(' ', '_')): return i + 1
    return None
layers = [(zdepth(o), o) for o in meshes]
layers = sorted([(z, o) for z, o in layers if z is not None], key=lambda t: t[0])
pushed = {}
BONES = set(b.name for b in rig.data.bones)
def bones_of(o):
    """Knochen, die mindestens 1,5 % der Vertices eines Kleidungsstücks dominieren."""
    gname = {g.index: g.name for g in o.vertex_groups}; cnt = {}
    for v in o.data.vertices:
        dom = max(((gname.get(g.group), g.weight) for g in v.groups if gname.get(g.group) in BONES), key=lambda t: t[1], default=(None, 0))[0]
        if dom: cnt[dom] = cnt.get(dom, 0) + 1
    n = max(1, len(o.data.vertices))
    return {b for b, c in cnt.items() if c / n >= 0.015}
# von außen nach innen: die äußerste Schicht schiebt alles darunter zurecht, dann die nächste usw.
for i in reversed(range(len(layers))):
    zo, outer = layers[i]
    if outer == skin_obj: continue
    mw = outer.matrix_world
    bvh = BVHTree.FromPolygons([mw @ v.co for v in outer.data.vertices], [list(p.vertices) for p in outer.data.polygons])
    cover = bones_of(outer)
    for zi, inner in layers[:i]:
        if zi >= zo: continue
        iw = inner.matrix_world; inv = iw.inverted(); margin = (0.006 if spec.get('proxy') else 0.003) if inner == skin_obj else (0.006 if spec.get('proxy') else 0.004); n = 0
        gname = {g.index: g.name for g in inner.vertex_groups}
        for v in inner.data.vertices:
            # nur Vertices, deren Hauptknochen auch die äußere Schicht bewegt (Hand neben der Hose bleibt unberührt)
            # (Knochenfilter nur nötig, wenn Hände an der Hose liegen – in der A-Pose nicht der Fall; ausgeschaltet)
            pw = iw @ v.co
            loc, nrm, _, dist = bvh.find_nearest(pw, 0.03)
            if loc is None: continue
            vn = (iw.to_3x3() @ v.normal).normalized()
            if nrm.dot(vn) < 0: nrm = -nrm  # Flächen mit nach innen zeigender Normale
            off = pw - loc; d = off.dot(nrm)
            if d > -margin and (off - nrm * d).length < 0.008:
                v.co = inv @ (pw - nrm * (d + margin)); n += 1
        # zweiter Durchgang über die Flächenmitten: große Dreiecke (Körper-Proxy) können trotz verschobener Ecken durchstechen
        for it in range(4):
            moved = 0
            for poly in inner.data.polygons:
                cw = iw @ poly.center
                loc, nrm, _, dist = bvh.find_nearest(cw, 0.03)
                if loc is None: continue
                pn = (iw.to_3x3() @ poly.normal).normalized()
                if nrm.dot(pn) < 0: nrm = -nrm
                off = cw - loc; d = off.dot(nrm)
                if d > -margin and (off - nrm * d).length < 0.012:
                    for vi in poly.vertices:
                        vv = inner.data.vertices[vi]; vv.co = inv @ ((iw @ vv.co) - nrm * (d + margin))
                    moved += 1
            inner.data.update(); n += moved
            if not moved: break
        if n: pushed[f'{inner.name}<{outer.name}'] = n
log('Schichten korrigiert:', pushed)

# Verdeckte Flächen entfernen: Haut bzw. innere Kleidung, die ganz unter einer äußeren Schicht liegt, sieht man nie – sie kann
# aber in Bewegung durchstechen. Eine Fläche gilt als verdeckt, wenn von ihrer Mitte und allen Ecken aus entlang der Normalen
# eine äußere Schicht „von innen“ getroffen wird (≤ 10 cm) oder die Stelle knapp (≤ 2 cm) außerhalb einer äußeren Schicht liegt.
# Die Prüfung der Trefferrichtung (Normale der Kleidung zeigt in Strahlrichtung) schützt Kinn, Hände und Säume.
outer_bvh = []
for z, o in layers:
    if o == skin_obj: continue
    mw = o.matrix_world
    outer_bvh.append((z, BVHTree.FromPolygons([mw @ v.co for v in o.data.vertices], [list(p.vertices) for p in o.data.polygons])))
def covered(p, n, z):
    for zo, bvh in outer_bvh:
        if zo <= z: continue
        h = bvh.ray_cast(p + n * 0.0005, n, 0.10)
        if h[0] is not None and h[1].dot(n) > 0.15: return True
        h = bvh.ray_cast(p + n * 0.0005, -n, 0.02)
        if h[0] is not None and h[1].dot(n) > 0.15: return True
    return False
culled = {}
for z, inner in layers:
    if not any(zo > z for zo, _ in outer_bvh): continue
    iw = inner.matrix_world; nm = iw.to_3x3()
    bm = bmesh.new(); bm.from_mesh(inner.data); bm.normal_update(); bm.verts.ensure_lookup_table()
    cv = {}
    def vcov(v):
        r = cv.get(v.index)
        if r is None: r = cv[v.index] = covered(iw @ v.co, (nm @ v.normal).normalized(), z)
        return r
    kill = [f for f in bm.faces if all(vcov(v) for v in f.verts) and covered(iw @ f.calc_center_median(), (nm @ f.normal).normalized(), z)]
    if kill:
        bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
        loose = [v for v in bm.verts if not v.link_faces]
        if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
        bm.to_mesh(inner.data); inner.data.update()
        culled[inner.name] = len(kill)
    bm.free()
log('verdeckte Flächen entfernt:', culled)

# --------------------------------------------------------------------------------------------- 2. Ruhepose anpassen
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE')
P = rig.pose.bones
for pb in P: pb.rotation_mode = 'QUATERNION'
def upd(): bpy.context.view_layer.update()
def head(n): return P[n].head.copy()  # Armaturraum (= Welt, Armatur liegt im Ursprung ohne Drehung)

def rotate_about(pb, pivot, q):
    """Pose-Knochen samt Kindern um einen Punkt (Armaturraum) drehen."""
    m = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot)
    pb.matrix = m @ pb.matrix
    upd()

def aim(bone, a, b, want):
    """Segment a→b (Köpfe zweier Knochen) in Richtung want drehen, Drehpunkt = Kopf von bone."""
    d = (head(b) - head(a)).normalized()
    q = d.rotation_difference(want.normalized())
    rotate_about(P[bone], head(bone), q)

DOWN = Vector((0, 0, -1)); FWD = Vector((0, -1, 0))
for s, sx in (('L', 1), ('R', -1)):
    # Oberarm, Unterarm, Hand senkrecht nach unten
    aim(f'upperarm01.{s}', f'upperarm01.{s}', f'lowerarm01.{s}', DOWN)
    aim(f'lowerarm01.{s}', f'lowerarm01.{s}', f'wrist.{s}', DOWN)
    aim(f'wrist.{s}', f'wrist.{s}', f'finger3-1.{s}', DOWN)
    # Drall der Hand: Daumenansatz nach vorn (leicht zur Körpermitte) → Handfläche zeigt zum Oberschenkel
    ax = (head(f'finger3-1.{s}') - head(f'wrist.{s}')).normalized()
    t = head(f'finger1-1.{s}') - head(f'wrist.{s}'); t = (t - ax * t.dot(ax)).normalized()
    want = Vector((-0.25 * sx, -1, 0)); want = (want - ax * want.dot(ax)).normalized()
    ang = t.angle(want); sgn = 1 if t.cross(want).dot(ax) > 0 else -1
    rotate_about(P[f'wrist.{s}'], head(f'wrist.{s}'), Quaternion(ax, sgn * ang))
    # Beine senkrecht, Fuß behält seine Weltausrichtung (Sohle flach)
    foot_before = P[f'foot.{s}'].matrix.to_quaternion()
    aim(f'upperleg01.{s}', f'upperleg01.{s}', f'lowerleg01.{s}', DOWN)
    aim(f'lowerleg01.{s}', f'lowerleg01.{s}', f'foot.{s}', DOWN)
    q = foot_before @ P[f'foot.{s}'].matrix.to_quaternion().inverted()
    rotate_about(P[f'foot.{s}'], head(f'foot.{s}'), q)

# Gelenkpositionen nach der Pose (Armaturraum, Blender: z oben, vorn = -y)
J = {pb.name: pb.head.copy() for pb in P}
bpy.ops.object.mode_set(mode='OBJECT')

# Pose fest anwenden (Skelett-Modifier), danach lose Vertices entfernen
apply_mods(('ARMATURE',))
for o in meshes:
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.delete_loose(); bpy.ops.object.mode_set(mode='OBJECT')

# --------------------------------------------------------------------------------------------- 3. Spielskelett + Gewichte
full = spec.get('fingers', 'merged') == 'full'
# Spielknochen: Name → (Eltern, Gelenk aus MakeHuman-Knochenkopf)
G = [
    ('root', None, None), ('hips', 'root', 'spine05'), ('spine', 'hips', 'spine04'), ('chest', 'spine', 'spine02'),
    ('neck', 'chest', 'neck01'), ('head', 'neck', 'head'), ('jaw', 'head', 'jaw'),
]
for s in 'LR':
    G += [(f'eye{s}', 'head', f'eye.{s}'), (f'lid{s}', 'head', f'orbicularis03.{s}'), (f'brow{s}', 'head', f'oculi01.{s}'),
          (f'clav{s}', 'chest', f'clavicle.{s}'), (f'upperArm{s}', f'clav{s}', f'upperarm01.{s}'),
          (f'foreArm{s}', f'upperArm{s}', f'lowerarm01.{s}'), (f'hand{s}', f'foreArm{s}', f'wrist.{s}'),
          (f'fingers{s}', f'hand{s}', f'finger3-1.{s}'), (f'thumb{s}', f'hand{s}', f'finger1-1.{s}'),
          (f'thigh{s}', 'hips', f'upperleg01.{s}'), (f'shin{s}', f'thigh{s}', f'lowerleg01.{s}'), (f'foot{s}', f'shin{s}', f'foot.{s}')]
    if full:
        G += [(f'thumbB{s}', f'thumb{s}', f'finger1-2.{s}'), (f'thumbC{s}', f'thumbB{s}', f'finger1-3.{s}')]
        for n in (2, 3, 4, 5):
            G += [(f'f{n}a{s}', f'hand{s}', f'finger{n}-1.{s}'), (f'f{n}b{s}', f'f{n}a{s}', f'finger{n}-2.{s}'), (f'f{n}c{s}', f'f{n}b{s}', f'finger{n}-3.{s}')]

# Lippen (nur Hauptfiguren mit "face": "full"): Ober-/Unterlippe und Mundwinkel für Mundformen beim Sprechen
face_full = spec.get('face') == 'full'
if face_full:
    G += [('lipLow', 'jaw', 'oris02'), ('lipUp', 'head', 'oris06'), ('lipCL', 'head', 'levator05.L'), ('lipCR', 'head', 'levator05.R')]

# MakeHuman-Knochen → Spielknochen (Rest über die Vorfahren)
EXPL = {'root': 'hips', 'pelvis.L': 'hips', 'pelvis.R': 'hips', 'spine05': 'hips', 'spine04': 'spine', 'spine03': 'spine',
        'spine02': 'chest', 'spine01': 'chest', 'neck01': 'neck', 'neck02': 'neck', 'neck03': 'neck', 'head': 'head', 'jaw': 'jaw'}
for s in 'LR':
    EXPL.update({f'eye.{s}': f'eye{s}', f'orbicularis03.{s}': f'lid{s}', f'orbicularis04.{s}': 'head', f'special05.{s}': 'head',
                 f'oculi01.{s}': f'brow{s}', f'oculi02.{s}': f'brow{s}', f'temporalis01.{s}': 'head', f'temporalis02.{s}': 'head',
                 f'clavicle.{s}': f'clav{s}', f'shoulder01.{s}': [(f'clav{s}', 0.45), (f'upperArm{s}', 0.55)],
                 f'upperarm01.{s}': f'upperArm{s}', f'upperarm02.{s}': f'upperArm{s}', f'lowerarm01.{s}': f'foreArm{s}',
                 f'lowerarm02.{s}': f'foreArm{s}', f'wrist.{s}': f'hand{s}',
                 f'upperleg01.{s}': f'thigh{s}', f'upperleg02.{s}': f'thigh{s}', f'lowerleg01.{s}': f'shin{s}',
                 f'lowerleg02.{s}': f'shin{s}', f'foot.{s}': f'foot{s}'})
    for k in (1, 2, 3, 4): EXPL[f'metacarpal{k}.{s}'] = f'hand{s}'
    for j, seg in ((1, ''), (2, 'B'), (3, 'C')):
        EXPL[f'finger1-{j}.{s}'] = f'thumb{seg}{s}' if full else f'thumb{s}'
    for n in (2, 3, 4, 5):
        for j, seg in ((1, 'a'), (2, 'b'), (3, 'c')):
            EXPL[f'finger{n}-{j}.{s}'] = f'f{n}{seg}{s}' if full else f'fingers{s}'
if face_full:
    for n in ('oris01', 'oris02', 'oris06.L', 'oris07.L', 'oris06.R', 'oris07.R'): EXPL[n] = 'lipLow'
    for n in ('oris03.L', 'oris04.L', 'oris03.R', 'oris04.R', 'oris05', 'oris06'): EXPL[n] = 'lipUp'
    EXPL['levator05.L'] = 'lipCL'; EXPL['levator05.R'] = 'lipCR'
MAP = {}
for b in rig.data.bones:
    x = b
    while x is not None and x.name not in EXPL: x = x.parent
    t = EXPL[x.name] if x is not None else 'hips'
    MAP[b.name] = t if isinstance(t, list) else [(t, 1.0)]

# Spielskelett als Blender-Armatur (Knochen zeigen nach oben; die Ausrichtung setzt das Spiel beim Laden auf Identität)
arm = bpy.data.armatures.new(spec['id'] + '_skel'); ao = bpy.data.objects.new(spec['id'] + '_skel', arm)
bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao
for s in bpy.context.selected_objects: s.select_set(False)
ao.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
joints = {}
for name, parent, src in G:
    p = Vector((0, 0, 0)) if src is None else J[src]
    if name == 'hips': p = Vector((0, J['spine05'].y, J['spine05'].z))
    joints[name] = p
    eb = arm.edit_bones.new(name); eb.head = p; eb.tail = p + Vector((0, 0, 0.04)); eb.roll = 0
    if parent: eb.parent = arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

PARENT = {name: parent for name, parent, _ in G}
stats = {}
for o in meshes:
    groups = {g.index: g.name for g in o.vertex_groups}
    neww = []
    lost = 0
    for v in o.data.vertices:
        acc = {}
        for g in v.groups:
            nm = groups.get(g.group)
            if nm not in MAP or g.weight <= 0: continue
            for t, f in MAP[nm]: acc[t] = acc.get(t, 0) + g.weight * f
        # höchstens vier Einflüsse: kleinste Gewichte nicht verwerfen, sondern dem nächsten vorhandenen Elternknochen geben
        # (mit Lippenknochen haben Mundvertices oft mehr als vier Einflüsse; so bleibt die Bewegung der des Elternknochens gleich)
        while len(acc) > 4:
            t_min = min(acc, key=acc.get); w_min = acc.pop(t_min)
            p_ = PARENT.get(t_min)
            while p_ is not None and p_ not in acc: p_ = PARENT.get(p_)
            if p_ is None: p_ = max(acc, key=acc.get)
            acc[p_] += w_min
        top = sorted(acc.items(), key=lambda kv: -kv[1])
        tot = sum(w for _, w in top)
        if tot <= 1e-6: lost += 1; top = [('head' if v.co.z > joints['neck'].z else 'hips', 1.0)]; tot = 1.0
        neww.append([(t, w / tot) for t, w in top])
    for g in list(o.vertex_groups): o.vertex_groups.remove(g)
    vg = {name: o.vertex_groups.new(name=name) for name, _, _ in G}
    for i, ws in enumerate(neww):
        for t, w in ws: vg[t].add([i], w, 'REPLACE')
    for m in list(o.modifiers):
        if m.type == 'ARMATURE': o.modifiers.remove(m)
    mod = o.modifiers.new('Skelett', 'ARMATURE'); mod.object = ao
    mw = o.matrix_world.copy(); o.parent = ao; o.matrix_world = mw
    stats[o.name] = {'verts': len(o.data.vertices), 'unweighted': lost}
    if lost: log('ohne Gewicht:', o.name, lost)
bpy.data.objects.remove(rig, do_unlink=True)

# --------------------------------------------------------------------------------------------- 4. Materialien vereinfachen
def suffix(frag): return '.' + os.path.basename(frag).replace('.mhclo', '').replace('.proxy', '').replace(' ', '_')
def classify(o):
    if o == skin_obj: return 'body'
    for part, kind in (('eyes', 'eyes'), ('eyebrows', 'eyebrow'), ('eyelashes', 'eyelash'), ('hair', 'hair'), ('teeth', 'teeth'), ('tongue', 'tongue')):
        if spec.get(part) and o.name.endswith(suffix(spec[part])): return kind
    for f in spec.get('accessories', []):
        if o.name.endswith(suffix(f)): return 'glasses'
    return 'clothes'

def mhmat_for(o):
    """Materialdatei zum Objekt: Haut aus spec.skin, sonst die 'material'-Zeile der .mhclo-Datei."""
    if o == skin_obj:
        f = AssetService.find_asset_absolute_path(spec['skin'], 'skins') if spec.get('skin') else None
        return read_mhmat(f) if f else {}
    for part, sub in (('eyes', 'eyes'), ('eyebrows', 'eyebrows'), ('eyelashes', 'eyelashes'), ('hair', 'hair'), ('teeth', 'teeth'), ('tongue', 'tongue')):
        frag = spec.get(part)
        if frag and o.name.endswith('.' + os.path.basename(frag).replace('.mhclo', '').replace(' ', '_')):
            # Varianten: Augenfarbe (eyes/materials/<farbe>.mhmat), Haarfarbe (Unterordner mit eigener .mhmat)
            alt = spec.get('eyeColor') and part == 'eyes' and AssetService.find_asset_absolute_path(spec['eyeColor'] + '.mhmat', 'eyes')
            alt = alt or (spec.get('hairMaterial') and part == 'hair' and AssetService.find_asset_absolute_path(spec['hairMaterial'], 'hair'))
            if alt: return read_mhmat(alt)
            return mhclo_mat(AssetService.find_asset_absolute_path(frag, sub))
    for frag in list(spec.get('clothes', [])) + list(spec.get('accessories', [])):
        if o.name.endswith('.' + os.path.basename(frag).replace('.mhclo', '').replace(' ', '_')):
            var = (spec.get('clothesMaterial') or {}).get(os.path.basename(frag).replace('.mhclo', ''))
            vf = var and AssetService.find_asset_absolute_path(var + '.mhmat', 'clothes')
            if vf: return read_mhmat(vf)
            return mhclo_mat(AssetService.find_asset_absolute_path(frag, 'clothes'))
    return {}

def mhclo_mat(clo):
    if not clo: return {}
    for line in open(clo, encoding='utf-8', errors='replace'):
        p = line.strip().split(None, 1)
        if len(p) == 2 and p[0] == 'material':
            f = os.path.join(os.path.dirname(clo), os.path.basename(p[1].strip()))
            if os.path.isfile(f): return read_mhmat(f)
    return {}

def tex_nodes(o):
    mm = mhmat_for(o); found = {}
    if mm.get('diffuseTexture'): found['diffuse'] = bpy.data.images.load(mm['diffuseTexture'], check_existing=True)
    nf = mm.get('normalmapTexture') or (mm.get('bumpTexture') if 'norm' in os.path.basename(mm.get('bumpTexture', '')).lower() else None)
    if nf: found['normal'] = bpy.data.images.load(nf, check_existing=True)
    found['color'] = mm.get('diffuseColor')
    found['file'] = {k: os.path.relpath(v, os.path.dirname(os.path.dirname(mm['dir']))) for k, v in mm.items() if k.endswith('Texture')} if mm else {}
    return found

ROUGH = {'glasses': 0.25, 'body': 0.52, 'clothes': 0.82, 'hair': 0.42, 'eyebrow': 0.6, 'eyelash': 0.6, 'eyes': 0.08, 'teeth': 0.3, 'tongue': 0.4}
mats = {}
for o in meshes:
    kind = classify(o)
    for slot in o.material_slots:
        old = slot.material
        t = tex_nodes(o)
        m = bpy.data.materials.new(f'{spec["id"]}_{kind}_{len(mats)}')
        m.use_nodes = True
        nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
        bsdf.inputs['Roughness'].default_value = ROUGH.get(kind, 0.7)
        bsdf.inputs['Metallic'].default_value = 0.0
        alpha = kind in ('hair', 'eyebrow', 'eyelash', 'eyes', 'glasses')
        if 'diffuse' in t:
            im = nt.nodes.new('ShaderNodeTexImage'); im.image = t['diffuse']
            nt.links.new(im.outputs['Color'], bsdf.inputs['Base Color'])
            if alpha:
                nt.links.new(im.outputs['Alpha'], bsdf.inputs['Alpha'])
        else:
            # nur Farbe (z. B. Brauen/Wimpern als Geometrie): Haarfarbe aus der Spezifikation, sonst Materialfarbe
            c = spec.get('hairColor') if kind in ('eyebrow', 'eyelash', 'hair') and spec.get('hairColor') else (t.get('color') or [0.5, 0.5, 0.5])
            bsdf.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1)
        if 'normal' in t:
            im = nt.nodes.new('ShaderNodeTexImage'); im.image = t['normal']; im.image.colorspace_settings.name = 'Non-Color'
            nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(im.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        if alpha:
            try: m.blend_method = 'CLIP'
            except Exception: pass
        m['game_kind'] = kind
        slot.material = m
        mats[m.name] = {'kind': kind, 'diffuse': bool(t.get('diffuse')), 'normal': bool(t.get('normal')), 'object': o.name, 'files': t.get('file', {}),
                        'tint': (spec.get('tint') or {}).get(o.name.split('.', 1)[-1])}

# Hornhaut: durchsichtige Schale über dem Augapfel (Alpha 0 in der Augentextur) entfernen → Augen ohne Alphatest
import numpy as np
for o in meshes:
    if classify(o) != 'eyes': continue
    t = tex_nodes(o).get('diffuse')
    if t is None or t.channels < 4: continue
    w, h = t.size; px = np.empty(w * h * 4, dtype=np.float32); t.pixels.foreach_get(px); alpha = px[3::4].reshape(h, w)
    bm = bmesh.new(); bm.from_mesh(o.data); uv = bm.loops.layers.uv.active
    kill = [f for f in bm.faces if alpha[min(h - 1, int((sum(l[uv].uv.y for l in f.loops) / len(f.loops) % 1) * h)), min(w - 1, int((sum(l[uv].uv.x for l in f.loops) / len(f.loops) % 1) * w))] < 0.5]
    bmesh.ops.delete(bm, geom=kill, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data); bm.free(); o.data.update()
    log('Hornhaut entfernt:', len(kill), 'Flächen')
    for slot in o.material_slots:
        nt = slot.material.node_tree; b = nt.nodes['Principled BSDF']
        for l in list(b.inputs['Alpha'].links): nt.links.remove(l)

# --------------------------------------------------------------------------------------------- 5. optional reduzieren, exportieren
for s in bpy.context.selected_objects: s.select_set(False)
ao.select_set(True)
for o in meshes: o.select_set(True)
os.makedirs(os.path.dirname(out_glb), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
                          export_morph=False, export_apply=False, export_yup=True, export_image_format='AUTO',
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_all_influences=False)

# Gelenke im Spielkoordinatensystem (y oben, vorn = +z): (x, z, -y)
gj = {k: [round(v.x, 5), round(v.z, 5), round(-v.y, 5)] for k, v in joints.items()}
tris = sum(len(o.data.polygons) for o in meshes)
json.dump({'id': spec['id'], 'joints': gj, 'parents': {n: p for n, p, _ in G}, 'fingers': 'full' if full else 'merged',
           'height': round(max(v.co.z for o in meshes for v in o.data.vertices), 4), 'objects': stats, 'materials': mats,
           'polys': tris, 'spec': spec, 'log': LOG}, open(out_json, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
log('fertig:', out_glb, os.path.getsize(out_glb) // 1024, 'KB')
