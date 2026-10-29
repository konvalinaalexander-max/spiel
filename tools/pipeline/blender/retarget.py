# Animationen übertragen (Auftrag V3, Figuren-Überarbeitung): Bewegungsdaten (BVH/FBX/GLB, z. B. Motion Capture) auf das
# Skelett einer Figur übertragen und als glTF-Animationen exportieren.
#
#   blender --background --python tools/pipeline/blender/retarget.py -- <job.json>
#
# job.json: { "target": "figur.glb|fbx", "out": "out.glb", "map": { "<Zielknochen>": "<Quellknochen>", … },
#             "root": "<Zielknochen Hüfte>", "sourceRoot": "<Quellknochen Hüfte>", "fps": 30, "onlyAnimations": false,
#             "clips": [ { "name": "Sit_Idle", "file": "x.bvh", "start": 0, "end": 120, "scale": 0.056, "loop": true,
#                          "inPlace": true, "rotate": [0, 0, 0] } ] }
#
# Verfahren (Weltraum-Übertragung mit Referenzpose): Für jeden zugeordneten Knochen ist
#   Δ(t) = Q_quelle,welt(t) · Q_quelle,ruhe⁻¹    (Drehung gegenüber der Ruhepose der Quelle)
#   Q_ziel,welt(t) = Δ(t) · Q_ziel,ref          (Q_ziel,ref = Zielruhe, deren Knochenrichtung auf die Quellruhe geschwenkt ist)
# Damit dürfen sich die Ruheposen unterscheiden (z. B. T-Pose der Aufnahme, hängende Arme der Figur): der Schwenk gleicht die
# Richtung aus, Δ überträgt Bewegung und Verdrehung. Lokal = Elternteil,welt(t)⁻¹ · Q_ziel,welt(t). Hüftposition: Verschiebung
# gegenüber der Ruhe, skaliert mit dem Verhältnis der Beinlängen. Nicht zugeordnete Knochen bleiben in Ruhe.
import bpy, sys, os, json, math
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0], encoding='utf-8'))
base = os.path.dirname(os.path.abspath(argv[0]))
P = lambda f: f if os.path.isabs(f) else os.path.join(base, f)
def log(*a): print('[retarget]', *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
FPS = job.get('fps', 30); sc.render.fps = FPS

def import_any(path):
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext == '.bvh': bpy.ops.import_anim.bvh(filepath=path, global_scale=1.0, frame_start=1, use_fps_scale=True, update_scene_fps=False, update_scene_duration=False, rotate_mode='NATIVE', axis_forward='-Z', axis_up='Y')
    elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    elif ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=path)
    else: raise ValueError('Format ' + ext)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    return arm, new

tgt, tgt_objs = import_any(P(job['target']))
log('Ziel', tgt.name, len(tgt.data.bones), 'Knochen')
MAP = job['map']; ROOT = job['root']; SROOT = job.get('sourceRoot')
# Zielruhe in Weltkoordinaten
def world_rest(arm, name):
    b = arm.data.bones[name]; return arm.matrix_world @ b.matrix_local
def bone_dir(m):  # Knochenrichtung (lokale y-Achse) in Welt
    return (m.to_3x3() @ Vector((0, 1, 0))).normalized()

# Hierarchie-Reihenfolge der Zielknochen (Eltern zuerst)
order = []
def walk(b):
    order.append(b.name)
    for c in b.children: walk(c)
for b in tgt.data.bones:
    if b.parent is None: walk(b)

actions = []
for clip in job['clips']:
    src, src_objs = import_any(P(clip['file']))
    sact = src.animation_data.action if src.animation_data else None
    if not sact: log('keine Animation in', clip['file']); continue
    f0, f1 = int(sact.frame_range[0]), int(sact.frame_range[1])
    a0 = clip.get('start', f0); a1 = min(clip.get('end', f1), f1)
    # Quelle: Maßstab und Ausrichtung (z. B. Zentimeter → Meter, Blickrichtung)
    s = clip.get('scale', 1.0); rot = clip.get('rotate', [0, 0, 0])
    src.matrix_world = Matrix.Rotation(math.radians(rot[2]), 4, 'Z') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') @ Matrix.Rotation(math.radians(rot[0]), 4, 'X') @ Matrix.Scale(s, 4) @ src.matrix_world
    bpy.context.view_layer.update()
    # Referenzpose der Ziels: Ruhe, Knochenrichtung auf die Ruhe der Quelle geschwenkt
    ref = {}
    for tb, sb in MAP.items():
        if tb not in tgt.data.bones or sb not in src.data.bones: continue
        Tr = world_rest(tgt, tb); Sr = world_rest(src, sb)
        swing = bone_dir(Tr).rotation_difference(bone_dir(Sr))
        ref[tb] = (swing @ Tr.to_quaternion(), Sr.to_quaternion())
    # Beinlängen für die Hüftverschiebung
    def leg(arm, hip, names):
        pts = [arm.matrix_world @ arm.data.bones[n].head_local for n in names if n in arm.data.bones]
        return sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1)) if len(pts) > 1 else 1.0
    lt = leg(tgt, ROOT, job.get('legTarget', [])) if job.get('legTarget') else 1.0
    ls = leg(src, SROOT, job.get('legSource', [])) if job.get('legSource') else 1.0
    k = lt / ls if ls > 1e-6 else 1.0
    root_rest_t = (tgt.matrix_world @ tgt.data.bones[ROOT].head_local).copy()
    root_rest_s = (src.matrix_world @ src.data.bones[SROOT].head_local).copy() if SROOT else None
    # neue Aktion am Ziel
    act = bpy.data.actions.new(clip['name']); act.use_fake_user = True
    if not tgt.animation_data: tgt.animation_data_create()
    tgt.animation_data.action = act
    for pb in tgt.pose.bones: pb.rotation_mode = 'QUATERNION'
    first_root = None
    for fi, f in enumerate(range(a0, a1 + 1)):
        sc.frame_set(f); bpy.context.view_layer.update()
        world = {}
        for name in order:
            pb = tgt.pose.bones[name]; bone = pb.bone
            parent_w = world.get(bone.parent.name) if bone.parent else tgt.matrix_world.to_quaternion()
            rest_local = (bone.parent.matrix_local.inverted() @ bone.matrix_local).to_quaternion() if bone.parent else (tgt.matrix_world.to_quaternion() @ bone.matrix_local.to_quaternion())
            if name in ref:
                q_ref, q_srest = ref[name]
                sw = (src.matrix_world @ src.pose.bones[MAP[name]].matrix).to_quaternion()
                q_w = (sw @ q_srest.inverted()) @ q_ref
                world[name] = q_w
                # lokal relativ zur Ruhe: pose_local = rest_local⁻¹ · parent_w⁻¹ · q_w
                pl = rest_local.inverted() @ (parent_w.inverted() @ q_w) if bone.parent else (tgt.matrix_world.to_quaternion() @ bone.matrix_local.to_quaternion()).inverted() @ q_w
                pb.rotation_quaternion = pl
            else:
                pb.rotation_quaternion = Quaternion()
                world[name] = (parent_w @ rest_local) if bone.parent else (tgt.matrix_world.to_quaternion() @ bone.matrix_local.to_quaternion())
            pb.keyframe_insert('rotation_quaternion', frame=fi + 1)
        # Hüfte verschieben
        if SROOT:
            sp = src.matrix_world @ src.pose.bones[SROOT].head
            d = (sp - root_rest_s) * k
            if clip.get('inPlace'):
                if first_root is None: first_root = d.copy()
                d.x -= first_root.x; d.y -= first_root.y
            pb = tgt.pose.bones[ROOT]
            # Weltverschiebung in den Knochenraum (Ruhe) des Hüftknochens
            m = (tgt.matrix_world @ pb.bone.matrix_local).to_3x3().inverted()
            pb.location = m @ d
            pb.keyframe_insert('location', frame=fi + 1)
    act['loop'] = bool(clip.get('loop'))
    actions.append(act)
    log('Clip', clip['name'], a1 - a0 + 1, 'Bilder')
    for o in src_objs: bpy.data.objects.remove(o, do_unlink=True)

# Export: alle Aktionen als glTF-Animationen (NLA-Spuren)
tgt.animation_data.action = None
for act in actions:
    tr = tgt.animation_data.nla_tracks.new(); tr.name = act.name; st = tr.strips.new(act.name, 1, act); st.name = act.name
bpy.ops.object.select_all(action='DESELECT')
for o in tgt_objs: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=P(job['out']), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True)
log('fertig', len(actions), 'Animationen →', job['out'])
