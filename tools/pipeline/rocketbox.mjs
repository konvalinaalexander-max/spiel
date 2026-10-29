// Rocketbox-Figuren (Microsoft Rocketbox, MIT) mit Rocketbox-Animationen → GLB.
//   node tools/pipeline/rocketbox.mjs <job.json>
// job.json: { "avatar": "…/Export/Male_Adult_03.fbx", "textures": "…/Textures", "out": "x.glb", "texSize": 1024,
//             "clips": { "sit_idle": "…/m_sit_table_idle_neutral_01.fbx", … }, "morphs": "AA_VI_|AK_09_|AK_10_" }
// Warum three.js statt Blender: Die Animationsdateien enthalten keine Bindepose; Blender rechnet Bewegungen relativ zur
// Ruhepose und verfälscht sie. three.js liest die Spuren als absolute lokale Drehungen – sie passen ohne Umrechnung auf
// jede Rocketbox-Figur (gleiches 3ds-Max-Biped-Skelett).
// Texturen: TGA → PNG (Python/PIL, verkleinert), Rauheit = 1 − Glanzkarte (im G-Kanal einer ORM-Textur).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }), createElement: () => ({ style: {}, getContext() { return null; } }) };
globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend && this.onloadend(); }); } readAsDataURL(b) { b.arrayBuffer().then(r => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend && this.onloadend(); }); } };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
const { NodeIO } = await import('@gltf-transform/core');
const { combHairNormals } = await import('./hair.mjs');
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const jobPath = path.resolve(process.argv[2]); const base = path.dirname(jobPath);
const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const P = f => (path.isAbsolute(f) ? f : path.join(base, f));
const load = f => { const b = fs.readFileSync(P(f)); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };

const avatar = load(job.avatar);
avatar.traverse(o => { if (o.isLight || o.isCamera) o.removeFromParent(); });
avatar.scale.setScalar(0.01);   // Zentimeter → Meter
const keep = job.morphs ? new RegExp(job.morphs) : null;
const matNames = new Set();
avatar.traverse(o => {
  if (!o.isMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  o.material = mats.map(m => { matNames.add(m.name); return new THREE.MeshStandardMaterial({ name: m.name }); });
  if (o.material.length === 1) o.material = o.material[0];
  if (o.morphTargetDictionary) {
    const g = o.geometry, names = Object.keys(o.morphTargetDictionary);
    const idx = keep ? names.map(n => [n, o.morphTargetDictionary[n]]).filter(([n]) => keep.test(n)) : [];
    for (const k in g.morphAttributes) g.morphAttributes[k] = idx.map(([, i]) => g.morphAttributes[k][i]);
    if (!idx.length) { g.morphAttributes = {}; delete o.morphTargetDictionary; delete o.morphTargetInfluences; }
    else { o.morphTargetDictionary = {}; idx.forEach(([n], j) => (o.morphTargetDictionary[n.replace(/^.*\./, '')] = j)); o.morphTargetInfluences = new Array(idx.length).fill(0); }
  }
  o.geometry = mergeVertices(o.geometry, 1e-4);
  // Haarkarten: Normalen nach außen kämmen (hair.mjs). Kopf/Hals in Netz-Koordinaten (Bindepose)
  if (o.isSkinnedMesh) {
    const hm = o.material.length ? o.material.findIndex(m => /opacity/.test(m.name)) : -1, sk = o.skeleton;
    const hi = sk.bones.findIndex(b => b.name === 'Bip01_Head'), ni = sk.bones.findIndex(b => b.name === 'Bip01_Neck');
    if (hm >= 0 && hi >= 0 && ni >= 0) {
      const at = i => new THREE.Vector3().applyMatrix4(sk.boneInverses[i].clone().invert()).applyMatrix4(o.bindMatrixInverse);
      const h = at(hi), up = h.clone().sub(at(ni)).normalize();
      avatar.updateMatrixWorld(true); const unit = 1 / o.matrixWorld.getMaxScaleOnAxis();
      const g = o.geometry, ids = new Set();
      for (const gr of g.groups) if (gr.materialIndex === hm) for (let k = gr.start; k < gr.start + gr.count; k++) ids.add(g.index.getX(k));
      const f = combHairNormals(g.attributes.position.array, g.attributes.normal.array, h.toArray(), up.toArray(), unit, [...ids]);
      g.attributes.normal.needsUpdate = true; console.log(`Haarnormalen gekämmt: ${ids.size} Vertices, ${f} umgedreht, Einheit ${unit.toFixed(1)}`);
    }
  }
});
const clips = Object.entries(job.clips || {}).map(([name, f]) => {
  const c = load(f).animations[0]; c.name = name;
  c.tracks = c.tracks.filter(t => !t.name.startsWith('MotionExtractionHelper') && !t.name.endsWith('.scale'));
  return c;
});
const glb = Buffer.from(await new GLTFExporter().parseAsync(avatar, { binary: true, animations: clips, onlyVisible: false }));

// ---------------------------------------------------------------- Texturen anhängen
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.readBinary(new Uint8Array(glb));
const tmp = path.join(path.dirname(P(job.out)), path.basename(P(job.out), '.glb') + '_tex'); fs.mkdirSync(tmp, { recursive: true });
const size = job.texSize || 1024, texDir = P(job.textures);
const conv = (src, dst, mode) => execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
src, dst, mode, size = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(src)
if mode == 'rgba':
    im = im.convert('RGBA')
    import numpy as np   # Haarfarbe in durchsichtige Bereiche ausbluten (keine dunklen Säume)
    a = np.array(im).astype(np.float32); ok = a[..., 3] >= 16
    for _ in range(24):
        acc = np.zeros(a.shape[:2] + (3,), np.float32); cnt = np.zeros(a.shape[:2], np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                sh = np.roll(np.roll(ok, dy, 0), dx, 1); acc += np.roll(np.roll(a[..., :3], dy, 0), dx, 1) * sh[..., None]; cnt += sh
        new = (~ok) & (cnt > 0); a[new, :3] = acc[new] / cnt[new, None]; ok = ok | new
    a[~ok, :3] = a[a[..., 3] >= 16, :3].mean(0)
    im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
elif mode == 'rough':
    g = im.convert('L').point(lambda v: int(255 - (v / 255) * 0.6 * 255))   # glänzend → glatt (0,4), matt → rau (1,0)
    im = Image.merge('RGB', (Image.new('L', im.size, 255), g, Image.new('L', im.size, 0)))
else: im = im.convert('RGB')
if im.size[0] > size: im = im.resize((size, size), Image.LANCZOS)
im = im.transpose(Image.FLIP_TOP_BOTTOM)   # FBX-UVs (Ursprung unten) → glTF (Ursprung oben)
im.save(dst, optimize=True)
`, src, dst, mode, String(size)]);
for (const mat of doc.getRoot().listMaterials()) {
  const stem = mat.getName().replace(/(_body|_head|_opacity).*$/, '$1');   // z. B. m004_body
  const f = n => { const p = path.join(texDir, n); return fs.existsSync(p) ? p : p.replace(/\.tga$/, '.png'); };   // TGA oder (people-fetch) PNG
  const opacity = /_opacity$/.test(stem);
  const col = f(stem + '_color.tga'), nor = f(stem + '_normal.tga'), spec = f(stem + '_specular.tga');
  const tex = (file, mode) => { const out = path.join(tmp, path.basename(file).replace(/\.(tga|png)$/, '') + (mode === 'rough' ? '_orm' : '') + '.png'); conv(file, out, mode); return doc.createTexture(path.basename(out)).setImage(fs.readFileSync(out)).setMimeType('image/png').setURI(path.basename(out)); };
  if (fs.existsSync(col)) mat.setBaseColorTexture(tex(col, opacity ? 'rgba' : 'rgb'));
  if (fs.existsSync(nor) && !opacity) mat.setNormalTexture(tex(nor, 'rgb'));
  if (fs.existsSync(spec) && !opacity) { mat.setMetallicRoughnessTexture(tex(spec, 'rough')); mat.setRoughnessFactor(1).setMetallicFactor(0); }
  else mat.setRoughnessFactor(0.6).setMetallicFactor(0);
  if (opacity) mat.setAlphaMode('MASK').setAlphaCutoff(0.35).setDoubleSided(true).setRoughnessFactor(0.72);
}
await io.write(P(job.out), doc);
console.log(`✓ ${job.out}: ${clips.length} Clips, Materialien ${[...matNames].join(', ')}, ${(fs.statSync(P(job.out)).size / 1e6).toFixed(1)} MB`);
