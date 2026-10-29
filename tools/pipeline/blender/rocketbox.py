# Rocketbox-Figur (Microsoft Rocketbox, MIT) + Rocketbox-Animationen → GLB (Prototyp der Figuren-Überarbeitung).
#
#   blender --background --python tools/pipeline/blender/rocketbox.py -- <job.json>
#
# job.json: { "avatar": "avatars/Male_Adult_03/Export/Male_Adult_03.fbx", "textures": "avatars/Male_Adult_03/Textures",
#             "clips": { "sit_idle": "anims/m_sit_table_idle_neutral_01.fbx", … }, "out": "out.glb", "texSize": 1024 }
# Figur und Animationen nutzen dasselbe 3ds-Max-Biped-Skelett („Bip01 …“): Die Aktionen werden über die Knochennamen direkt
# übernommen (kein Retargeting). Materialien: Principled BSDF mit Farb- und Normalentextur, Rauheit aus der Glanzkarte
# (1 − Glanz), Haar/Wimpern mit Alphakanal (Clip/Hashed). Texturen werden auf texSize verkleinert.
import bpy, sys, os, json
argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0], encoding='utf-8'))
base = os.path.dirname(os.path.abspath(argv[0]))
P = lambda f: f if os.path.isabs(f) else os.path.join(base, f)
def log(*a): print('[rocketbox]', *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.fps = 30

def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=False, use_anim=True)
    return [o for o in bpy.data.objects if o not in before]

objs = import_fbx(P(job['avatar']))
arm = next(o for o in objs if o.type == 'ARMATURE')
meshes = [o for o in objs if o.type == 'MESH']
log('Figur', arm.name, len(arm.data.bones), 'Knochen,', len(meshes), 'Meshes', [m.name for m in meshes])
for m in meshes: log('  Mesh', m.name, len(m.data.polygons), 'Flächen, Formschlüssel', len(m.data.shape_keys.key_blocks) if m.data.shape_keys else 0)

# ---------------------------------------------------------------------------------------- Materialien
tex_dir = P(job['textures']); size = job.get('texSize', 1024)
def load(name):
    p = os.path.join(tex_dir, name)
    if not os.path.exists(p): return None
    im = bpy.data.images.load(p);
    if size and im.size[0] > size: im.scale(size, size)
    return im
for m in meshes:
    for slot in m.material_slots:
        mat = slot.material
        if not mat: continue
        # Texturnamen aus den vorhandenen Bildknoten (FBX-Pfad) oder aus dem Materialnamen ableiten
        imgs = [n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image] if mat.use_nodes else []
        stem = None
        for im in imgs:
            b = os.path.basename(im.filepath).lower()
            for part in ('_body_', '_head_', '_opacity_'):
                if part in b: stem = b.split(part)[0] + part; break
            if stem: break
        log('  Material', mat.name, 'Bilder', [os.path.basename(i.filepath) for i in imgs], '→', stem)
        if not stem: continue
        mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
        nt.links.new(bsdf.outputs[0], out.inputs['Surface'])
        col = load(stem + 'color.tga'); nor = load(stem + 'normal.tga'); spec = load(stem + 'specular.tga')
        if col:
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = col; nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
            if '_opacity_' in stem:
                nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha']); mat.blend_method = 'HASHED' if hasattr(mat, 'blend_method') else None
                mat.surface_render_method = 'DITHERED' if hasattr(mat, 'surface_render_method') else None
        if nor:
            nor.colorspace_settings.name = 'Non-Color'
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = nor; nm = nt.nodes.new('ShaderNodeNormalMap')
            nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
        if spec:
            spec.colorspace_settings.name = 'Non-Color'
            t = nt.nodes.new('ShaderNodeTexImage'); t.image = spec; inv = nt.nodes.new('ShaderNodeInvert'); mr = nt.nodes.new('ShaderNodeMapRange')
            mr.inputs['To Min'].default_value = 0.35; mr.inputs['To Max'].default_value = 0.95
            sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(t.outputs['Color'], sep.inputs['Color'])
            nt.links.new(sep.outputs[0], inv.inputs['Color']); nt.links.new(inv.outputs['Color'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], bsdf.inputs['Roughness'])
        else: bsdf.inputs['Roughness'].default_value = 0.6
        bsdf.inputs['Metallic'].default_value = 0.0
        try: bsdf.inputs['Specular IOR Level'].default_value = 0.4
        except Exception: pass

# ---------------------------------------------------------------------------------------- Animationen
if not arm.animation_data: arm.animation_data_create()
arm.animation_data.action = None
for name, f in job.get('clips', {}).items():
    o2 = import_fbx(P(f))
    a2 = next((o for o in o2 if o.type == 'ARMATURE'), None)
    act = a2.animation_data.action if a2 and a2.animation_data else None
    if not act: log('keine Aktion in', f); [bpy.data.objects.remove(o, do_unlink=True) for o in o2]; continue
    act.name = name; act.use_fake_user = True
    # Spuren auf Knochen, die die Figur nicht hat (z. B. MotionExtractionHelper), entfernen
    names = set(b.name for b in arm.data.bones)
    fcs = act.fcurves if hasattr(act, 'fcurves') else []
    for fc in list(fcs):
        if fc.data_path.startswith('pose.bones["'):
            bn = fc.data_path.split('"')[1]
            if bn not in names: fcs.remove(fc)
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, int(act.frame_range[0]), act); st.name = name
    log('Clip', name, act.frame_range[:], len(fcs), 'Kurven')
    for o in o2: bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=P(job['out']), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_force_sampling=True, export_image_format='JPEG' if job.get('jpeg') else 'AUTO', export_morph=True, export_skins=True,
                          export_optimize_animation_size=True)
log('fertig →', job['out'])
