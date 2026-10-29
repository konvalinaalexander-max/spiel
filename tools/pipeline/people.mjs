// Figuren-Überarbeitung: Microsoft-Rocketbox-Figuren (MIT) und ihre Motion-Capture-Animationen → Spielformat.
//   node tools/pipeline/people.mjs [--profile desktop|mobile] [--only prof,neighbor] [--no-clips] [--png]
// Eingabe: tools/pipeline/people.json, Quellen in assets/src/rocketbox (tools/pipeline/people-fetch.sh)
// Ausgabe: assets/build/<profil>/people/
//   <id>.hpk            Figur im HPK-Format (wie humans-pack.mjs) mit Ruhepose des Skeletts (Knochen mit Eigendrehung,
//                       damit die Rocketbox-Animationen unverändert passen), optional Gesichtsformen (Viseme, Blinzeln)
//   crowd_f_c.ktx2 …    gemeinsame Farbatlanten der Studierenden (je Geschlecht), Hauptfiguren mit eigenem Farb-/Normalenatlas
//   clips_m.bin.gz …    Animationen je Satz: 20 Bilder/s, Drehungen als Int16-Quaternionen, konstante Spuren weggelassen
//   index.json
//
// Ruhepose: Die Vertices werden auf der CPU in die Ruhepose der Knochen gerechnet (statt der Bindepose der FBX-Datei);
// das Spiel bindet das Skelett in dieser Pose. Einheiten: Meter, y oben, Figur schaut nach +z.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';
import { combHairNormals, bleedRGBA } from './hair.mjs';

globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }), createElement: () => ({ style: {}, getContext() { return null; } }) };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = k => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : null);
const profile = opt('profile') || 'desktop';
const only = opt('only') ? opt('only').split(',') : null;
const M = profile === 'mobile' ? 0.5 : 1;
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'tools/pipeline/people.json'), 'utf8'));
const SRC = path.join(root, 'assets/src/rocketbox');
const OUT = path.join(root, 'assets/build', profile, 'people'); fs.mkdirSync(OUT, { recursive: true });
const FPS = 20, MAXLEN = { loop: 24 };

const loadFBX = f => { const b = fs.readFileSync(f); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const FACE = /Eye|Jaw|Lip|Mouth|Cheek|brow|Brow|Nose|Masseter|Caninus|Tongue|Blink/;
// Namen des Spiels → Rocketbox-Knochen (Figurensteuerung, Blick, IK)
const ALIAS = { root: 'Bip01', hips: 'Bip01_Pelvis', spine: 'Bip01_Spine1', chest: 'Bip01_Spine2', neck: 'Bip01_Neck', head: 'Bip01_Head', jaw: 'Bip01_MJaw',
  eyeL: 'Bip01_LEye', eyeR: 'Bip01_REye', lidL: 'Bip01_LEyeBlinkTop', lidR: 'Bip01_REyeBlinkTop', browL: 'Bip01_LInnerEyebrow', browR: 'Bip01_RInnerEyebrow' };
for (const [s, S] of [['L', 'L'], ['R', 'R']]) Object.assign(ALIAS, { ['clav' + s]: `Bip01_${S}_Clavicle`, ['upperArm' + s]: `Bip01_${S}_UpperArm`, ['foreArm' + s]: `Bip01_${S}_Forearm`,
  ['hand' + s]: `Bip01_${S}_Hand`, ['thigh' + s]: `Bip01_${S}_Thigh`, ['shin' + s]: `Bip01_${S}_Calf`, ['foot' + s]: `Bip01_${S}_Foot`, ['toe' + s]: `Bip01_${S}_Toe0` });

// ---------------------------------------------------------------------------------------------- Atlas (Regalpacker)
function shelfPack(tiles, W) {
  const out = []; let x = 0, y = 0, rowH = 0;
  for (const t of [...tiles].sort((a, b) => b.s - a.s)) {
    if (x + t.s > W) { x = 0; y += rowH; rowH = 0; }
    out.push({ ...t, x, y }); x += t.s; rowH = Math.max(rowH, t.s);
  }
  return { tiles: out, h: Math.ceil((y + rowH) / 4) * 4 };
}
const PAD = 3;
const quiet = async fn => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
const enc = (png, o) => quiet(() => encodeToKTX2(new Uint8Array(png), { generateMipmap: true, qualityLevel: 200, compressionLevel: 2, needSupercompression: true, isKTX2File: true,
  imageDecoder: async b => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; }, ...o }));
async function writeAtlas(file, w, h, composites, normal) {
  const png = await sharp({ create: { width: w, height: h, channels: 4, background: normal ? { r: 128, g: 128, b: 255, alpha: 1 } : { r: 120, g: 105, b: 95, alpha: 0 } } }).composite(composites).png().toBuffer();
  if (args.includes('--png')) fs.writeFileSync(file.replace('.ktx2', '.png'), png);
  const k = await enc(png, normal ? { isUASTC: false, isNormalMap: true, isSetKTX2SRGBTransferFunc: false } : { isUASTC: false, isSetKTX2SRGBTransferFunc: true });
  fs.writeFileSync(file, k); return Math.round(k.length / 1024);
}
// Kachel aus einer Textur: verkleinert, mit Randverlängerung (Rand = Nachbarpixel, damit Mipmaps nicht ausbluten)
async function tile(file, s, keepAlpha) {
  const inner = s - 2 * PAD;
  let img;
  if (keepAlpha) {
    // Haar: (1) Strähnenfarbe in voller Auflösung in alle nicht deckenden Pixel ausbluten – der Untergrund der Rocketbox-Haar-
    // texturen ist hautfarben/rötlich und würde sonst beim Verkleinern in die Strähnen gemischt; (2) verkleinern; (3) Alpha so
    // skalieren, dass der Anteil über der Alphatest-Schwelle (0,5) gleich bleibt (Deckung erhalten, feine Strähnen verschwinden
    // sonst); (4) durchsichtige Bereiche noch einmal ausbluten (saubere Mipmaps).
    const { data: full, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let cov0 = 0; for (let i = 3; i < full.length; i += 4) if (full[i] >= 128) cov0++; cov0 /= full.length / 4;
    bleedRGBA(full, info.width, info.height, 128, Math.ceil(Math.max(info.width, info.height) / inner) * 3);
    const small = await sharp(full, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(inner, inner, { kernel: 'lanczos3' }).raw().toBuffer();
    const cover = k => { let n = 0; for (let i = 3; i < small.length; i += 4) if (small[i] * k >= 128) n++; return n / (small.length / 4); };
    let lo = 1, hi = 4; for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; if (cover(m) < cov0) lo = m; else hi = m; }
    for (let i = 3; i < small.length; i += 4) small[i] = Math.min(255, Math.round(small[i] * hi));
    img = sharp(bleedRGBA(small, inner, inner, 16), { raw: { width: inner, height: inner, channels: 4 } });
  } else img = sharp(file).resize(inner, inner, { kernel: 'lanczos3' }).removeAlpha().ensureAlpha();
  const buf = await img.extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).raw().toBuffer();
  return { input: buf, raw: { width: s, height: s, channels: 4 } };
}

// ---------------------------------------------------------------------------------------------- Figur
const V3 = () => new THREE.Vector3(), M4 = () => new THREE.Matrix4();
async function convertFigure(id, avatar, opts) {
  const dir = path.join(SRC, 'avatars', avatar);
  const fbx = path.join(dir, 'Export', avatar + (opts.facial ? '_facial' : '') + '.fbx');
  const obj = loadFBX(fbx);
  obj.scale.setScalar(0.01); obj.updateMatrixWorld(true);
  let mesh = null; obj.traverse(o => { if (o.isSkinnedMesh && (!mesh || o.geometry.attributes.position.count > mesh.geometry.attributes.position.count)) mesh = o; });
  const skel = mesh.skeleton; skel.update();
  // Knochenreihenfolge: Eltern vor Kindern
  const order = []; const seen = new Set();
  const visit = b => { if (seen.has(b)) return; if (b.parent && b.parent.isBone) visit(b.parent); seen.add(b); order.push(b); };
  skel.bones.forEach(visit);
  const newIndex = new Map(order.map((b, i) => [b, i]));
  const remap = skel.bones.map(b => newIndex.get(b));
  // Ruhepose (Welt, Meter) und lokale Ruhetransformation je Knochen
  const wp = new Map(), wq = new Map();
  for (const b of order) { const p = V3(), q = new THREE.Quaternion(), s = V3(); b.matrixWorld.decompose(p, q, s); wp.set(b, p); wq.set(b, q); }
  const joints = {}, parents = {}, rest = {};
  for (const b of order) {
    const p = wp.get(b), q = wq.get(b), pb = b.parent && b.parent.isBone ? b.parent : null;
    joints[b.name] = p.toArray().map(v => +v.toFixed(5));
    parents[b.name] = pb ? pb.name : null;
    const lp = pb ? p.clone().sub(wp.get(pb)).applyQuaternion(wq.get(pb).clone().invert()) : p.clone();
    const lq = pb ? wq.get(pb).clone().invert().multiply(q) : q.clone();
    rest[b.name] = [...lp.toArray(), ...lq.toArray()].map(v => +v.toFixed(6));
  }
  // Geometrie in Ruhepose (Welt) – CPU-Skinning
  const g0 = mesh.geometry;
  const nv0 = g0.attributes.position.count;
  const P = g0.attributes.position, N = g0.attributes.normal, U = g0.attributes.uv, SI = g0.attributes.skinIndex, SW = g0.attributes.skinWeight;
  const boneM = skel.bones.map((b, i) => M4().multiplyMatrices(b.matrixWorld, skel.boneInverses[i]));
  const bind = mesh.bindMatrix, bindInv = mesh.bindMatrixInverse, world = mesh.matrixWorld;
  const vm = (i) => { const m = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (!w) continue; const e = boneM[SI.getComponent(i, k)].elements; for (let j = 0; j < 16; j++) m.elements[j] += e[j] * w; } return new THREE.Matrix4().multiplyMatrices(world, new THREE.Matrix4().multiplyMatrices(bindInv, m).multiply(bind)); };
  const pos = new Float32Array(nv0 * 3), nor = new Float32Array(nv0 * 3), mats = new Array(nv0);
  const morphNames = [], morphD = [];
  const keepMorph = opts.facial ? (g0.morphAttributes.position || []).map((a, i) => i).filter(i => /AA_VI_|AK_0[3-5]_|AK_09_|AK_10_|AK_25_|AK_4[4-5]_/.test(Object.keys(mesh.morphTargetDictionary).find(k => mesh.morphTargetDictionary[k] === i) || '')) : [];
  for (const i of keepMorph) { morphNames.push(Object.keys(mesh.morphTargetDictionary).find(k => mesh.morphTargetDictionary[k] === i).replace(/^.*\./, '')); morphD.push(new Float32Array(nv0 * 3)); }
  const relative = !!g0.morphTargetsRelative;
  for (let i = 0; i < nv0; i++) {
    const m = vm(i), m3 = new THREE.Matrix3().setFromMatrix4(m);
    const v = V3().fromBufferAttribute(P, i).applyMatrix4(m); pos.set([v.x, v.y, v.z], i * 3);
    const n = V3().fromBufferAttribute(N, i).applyMatrix3(m3).normalize(); nor.set([n.x, n.y, n.z], i * 3);
    keepMorph.forEach((mi, k) => { const a = g0.morphAttributes.position[mi]; const d = V3().fromBufferAttribute(a, i); if (!relative) d.sub(V3().fromBufferAttribute(P, i)); d.applyMatrix3(m3); morphD[k].set([d.x, d.y, d.z], i * 3); });
  }
  for (const gr of g0.groups) for (let i = gr.start; i < gr.start + gr.count; i++) mats[g0.index ? g0.index.getX(i) : i] = gr.materialIndex;
  const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  // Materialart: body / head / opacity (Haar, Wimpern)
  const kindOf = mi => { const n = (matList[mi] || matList[0]).name.toLowerCase(); return n.includes('opacity') ? 'opacity' : n.includes('head') ? 'head' : 'body'; };
  const stem = (matList.find(m => /_body/i.test(m.name)) || matList[0]).name.replace(/_body.*$/i, '');
  // Indexliste je Gruppe (deckend / Alpha), Vertices nicht über Gruppen hinweg teilen
  const groupsOut = [], idxOut = [];
  const tris = []; // [a,b,c,kind]
  const idx = g0.index ? g0.index.array : null;
  for (const gr of g0.groups.length ? g0.groups : [{ start: 0, count: (idx ? idx.length : nv0), materialIndex: 0 }]) {
    const kind = kindOf(gr.materialIndex);
    for (let t = gr.start; t < gr.start + gr.count; t += 3) tris.push([idx ? idx[t] : t, idx ? idx[t + 1] : t + 1, idx ? idx[t + 2] : t + 2, kind]);
  }
  // Vertices je Art kopieren und verschweißen (FBX liefert je Ecke eigene Vertices)
  const parts = {};
  for (const kind of ['body', 'head', 'opacity']) {
    const sel = tris.filter(t => t[3] === kind); if (!sel.length) continue;
    const n = sel.length * 3, g = new THREE.BufferGeometry();
    const A = (src, size) => { const a = new Float32Array(n * size); sel.forEach((t, j) => { for (let k = 0; k < 3; k++) for (let c = 0; c < size; c++) a[(j * 3 + k) * size + c] = src[t[k] * size + c]; }); return a; };
    g.setAttribute('position', new THREE.BufferAttribute(A(pos, 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(A(nor, 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(A(U.array, 2), 2));
    const si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
    sel.forEach((t, j) => { for (let k = 0; k < 3; k++) for (let c = 0; c < 4; c++) { si[(j * 3 + k) * 4 + c] = remap[SI.getComponent(t[k], c)]; sw[(j * 3 + k) * 4 + c] = SW.getComponent(t[k], c); } });
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    if (morphD.length) { g.morphAttributes.position = morphD.map(d => new THREE.BufferAttribute(A(d, 3), 3)); g.morphTargetsRelative = true; }
    parts[kind] = mergeVertices(g, 1e-5);
  }
  // Haarkarten: Normalen nach außen kämmen (siehe hair.mjs)
  if (parts.opacity && joints.Bip01_Head) {
    const na = parts.opacity.attributes.normal;
    const flipped = combHairNormals(parts.opacity.attributes.position.array, na.array, joints.Bip01_Head, [0, 1, 0], 1);
    na.needsUpdate = true; console.log(`  ${id}: Haarnormalen gekämmt (${flipped} umgedreht)`);
  }
  return { id, avatar, dir, stem, parts, joints, parents, rest, morphNames, height: Math.max(...Object.values(joints).map(j => j[1])) + 0.12 };
}

// HPK schreiben (Format wie tools/pipeline/humans-pack.mjs, plus rest/alias/morphs)
function quantWeights(wt) {
  const out = new Uint8Array(wt.length);
  for (let v = 0; v < wt.length; v += 4) {
    const s = wt[v] + wt[v + 1] + wt[v + 2] + wt[v + 3] || 1;
    const raw = [0, 1, 2, 3].map(k => wt[v + k] / s * 255), fl = raw.map(Math.floor);
    let rest = 255 - fl.reduce((a, b) => a + b, 0);
    const order = [0, 1, 2, 3].sort((a, b) => (raw[b] - fl[b]) - (raw[a] - fl[a]) || raw[b] - raw[a]);
    for (const k of order) { if (rest <= 0) break; fl[k]++; rest--; }
    for (let k = 0; k < 4; k++) out[v + k] = fl[k];
  }
  return out;
}
const ROUGH_FROM_SPEC = v => 1 - (v / 255) * 0.62;   // Glanzkarte → Rauheit (0,38 … 1)
const PARTID = { head: 0, body: 1, opacity: 3 };
async function writeHPK(fig, cls, atlasKey, place, AW, AH, normalMap, opts) {
  const pos = [], nor = [], uv = [], jn = [], wt = [], surf = [], idx = [], groups = [], morph = fig.morphNames.map(() => []);
  let base = 0;
  for (const kind of ['body', 'head', 'opacity']) {
    const g = fig.parts[kind]; if (!g) continue;
    const t = place[kind];
    // Rauheit je Vertex aus der Glanzkarte (Haut glänzt, Stoff nicht)
    let spec = null, sw = 0;
    const specFile = path.join(fig.dir, 'Textures', `${fig.stem}_${kind === 'opacity' ? 'head' : kind}_specular.png`);
    if (kind !== 'opacity' && fs.existsSync(specFile)) { const r = await sharp(specFile).resize(256, 256).greyscale().raw().toBuffer({ resolveWithObject: true }); spec = r.data; sw = r.info.width; }
    const n = g.attributes.position.count, s = t.s - 2 * PAD;
    for (let i = 0; i < n; i++) {
      pos.push(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i));
      nor.push(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i));
      const u = Math.min(1, Math.max(0, g.attributes.uv.getX(i))), v = 1 - Math.min(1, Math.max(0, g.attributes.uv.getY(i)));
      uv.push((t.x + PAD + u * s) / AW, (t.y + PAD + v * s) / AH);
      for (let c = 0; c < 4; c++) { jn.push(g.attributes.skinIndex.getComponent(i, c)); wt.push(g.attributes.skinWeight.getComponent(i, c)); }
      const r = spec ? ROUGH_FROM_SPEC(spec[Math.min(sw - 1, Math.floor(v * sw)) * sw + Math.min(sw - 1, Math.floor(u * sw))]) : 0.72;   // Haar: matt-seidig
      surf.push(Math.round(r * 255), normalMap && kind !== 'opacity' ? 255 : 0, PARTID[kind], 0);
      fig.morphNames.forEach((_, k) => { const a = g.morphAttributes.position[k]; const dx = a.getX(i), dy = a.getY(i), dz = a.getZ(i); if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 2e-5) morph[k].push(base + i, dx, dy, dz); });
    }
    const start = idx.length; const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(ia[i] + base);
    const alpha = kind === 'opacity'; const last = groups[groups.length - 1];
    if (last && last.alpha === alpha) last.count += ia.length; else groups.push({ start, count: ia.length, alpha });
    base += n;
  }
  // Detailstufe 1 für die Menge
  let idx1 = null, groups1 = null;
  if (cls === 'crowd') {
    await MeshoptSimplifier.ready; const P32 = new Float32Array(pos); idx1 = []; groups1 = [];
    for (const gr of groups) {
      const sub = Uint32Array.from(idx.slice(gr.start, gr.start + gr.count));
      const target = Math.floor(gr.count * (gr.alpha ? 0.5 : 0.35) / 3) * 3;
      const [r] = MeshoptSimplifier.simplify(sub, P32, 3, target, gr.alpha ? 0.03 : 0.02, []);
      groups1.push({ start: idx1.length, count: r.length, alpha: gr.alpha }); for (const i of r) idx1.push(i);
    }
  }
  const nv = pos.length / 3, big = nv > 65535;
  const bufs = [
    ['position', new Float32Array(pos)],
    ['normal', Int8Array.from(Array.from({ length: nv * 4 }, (_, i) => (i % 4 === 3 ? 0 : Math.round(Math.max(-1, Math.min(1, nor[(i >> 2) * 3 + (i % 4)])) * 127))))],
    ['uv', Uint16Array.from(uv.map(x => Math.round(Math.max(0, Math.min(1, x)) * 65535)))],
    ['joints', Uint8Array.from(jn)], ['weights', quantWeights(wt)],
    ['surf', Uint8Array.from(surf)],
    ['index', big ? Uint32Array.from(idx) : Uint16Array.from(idx)]
  ];
  if (idx1) bufs.push(['index1', big ? Uint32Array.from(idx1) : Uint16Array.from(idx1)]);
  const morphs = [];
  fig.morphNames.forEach((name, k) => {
    const m = morph[k]; if (!m.length) return; const cnt = m.length / 4;
    const vi = new Uint32Array(cnt), d = new Int16Array(cnt * 3);
    for (let j = 0; j < cnt; j++) { vi[j] = m[j * 4]; for (let c = 0; c < 3; c++) d[j * 3 + c] = Math.max(-32767, Math.min(32767, Math.round(m[j * 4 + 1 + c] * 1e4))); }  // 0,1 mm
    bufs.push(['m' + k + 'i', vi], ['m' + k + 'd', d]); morphs.push({ name, i: 'm' + k + 'i', d: 'm' + k + 'd', scale: 1e-4 });
  });
  const head = { id: fig.id, role: opts.role || 'student', class: cls, female: !!opts.female, height: +fig.height.toFixed(3), rocketbox: true, avatar: fig.avatar,
    joints: fig.joints, parents: fig.parents, rest: fig.rest, alias: ALIAS, fingers: 'full', vertices: nv, groups, groups1, atlas: atlasKey, normalMap: !!normalMap, morphs, buffers: [] };
  let off = 0; for (const [name, a] of bufs) { head.buffers.push({ name, type: a.constructor.name, offset: off, length: a.length }); off += Math.ceil(a.byteLength / 4) * 4; }
  const json = Buffer.from(JSON.stringify(head)); const jl = Math.ceil(json.length / 4) * 4;
  const file = Buffer.alloc(8 + jl + off); file.write('HPK1', 0); file.writeUInt32LE(jl, 4); json.copy(file, 8); file.fill(32, 8 + json.length, 8 + jl);
  for (const [i, [, a]] of bufs.entries()) Buffer.from(a.buffer, a.byteOffset, a.byteLength).copy(file, 8 + jl + head.buffers[i].offset);
  const gz = zlib.gzipSync(file, { level: 9 });
  fs.writeFileSync(path.join(OUT, fig.id + '.hpk'), gz);
  return { verts: nv, tris: idx.length / 3, tris1: idx1 ? idx1.length / 3 : undefined, kb: Math.round(gz.length / 1024), morphs: morphs.length };
}

// ---------------------------------------------------------------------------------------------- Animationen
// Spuren der Knochen sind lokal (wie im Skelett der Figur). Wurzel „Bip01“: in der FBX-Datei hängt sie unter dem Szenenknoten
// (Maßstab 0,01, ggf. Achsendrehung) → hier in den Raum des Spiels (Eltern = Container ohne Drehung) umgerechnet.
function encodeClips(set, list, rootFix, restOf) {
  // CLP2: Spuren als Int16 (Drehung ×32767, Position ×10⁴ m), je Komponente als Differenz zum Vorbild (gzip packt das deutlich besser)
  const delta16 = (a, n) => { const d = new Int16Array(a.length); for (let i = 0; i < a.length; i++) d[i] = i < n ? a[i] : a[i] - a[i - n]; return d; };
  const header = { fps: FPS, clips: [] }; const chunks = []; let off = 0;
  const push = arr => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const o = off; chunks.push(b); off += Math.ceil(b.length / 4) * 4; if (b.length % 4) chunks.push(Buffer.alloc(4 - (b.length % 4))); return [o, arr.length]; };
  for (const [name, file, loop] of list) {
    if (!fs.existsSync(file)) { console.log(`  ✗ ${set}/${name}: ${path.basename(file)} fehlt`); continue; }
    const clip = loadFBX(file).animations[0]; if (!clip) continue;
    const dur = Math.min(clip.duration, loop ? MAXLEN.loop : 1e9), frames = Math.max(2, Math.round(dur * FPS) + 1);
    const tracks = [];
    for (const tr of clip.tracks) {
      const [bone, prop] = tr.name.split('.');
      if (bone === 'MotionExtractionHelper' || bone === 'Bip01_Footsteps' || prop === 'scale' || FACE.test(bone)) continue;
      if (prop === 'position' && bone !== 'Bip01' && bone !== 'Bip01_Pelvis') continue;
      const ip = tr.createInterpolant(); const vals = [];
      for (let f = 0; f < frames; f++) vals.push(Array.from(ip.evaluate(Math.min(f / FPS, clip.duration))));
      if (prop === 'quaternion') {
        let qs = vals.map(v => new THREE.Quaternion(...v));
        if (bone === 'Bip01') qs = qs.map(q => rootFix.q.clone().multiply(q));
        // konstant gegenüber der Ruhepose? (max. 0,15°) → weglassen
        const r = restOf(bone);
        if (r && qs.every(q => q.angleTo(r) < 0.0026)) continue;
        for (let f = 1; f < qs.length; f++) if (qs[f].dot(qs[f - 1]) < 0) qs[f].set(-qs[f].x, -qs[f].y, -qs[f].z, -qs[f].w);
        const a = new Int16Array(frames * 4); qs.forEach((q, f) => { a[f * 4] = Math.round(q.x * 32767); a[f * 4 + 1] = Math.round(q.y * 32767); a[f * 4 + 2] = Math.round(q.z * 32767); a[f * 4 + 3] = Math.round(q.w * 32767); });
        tracks.push({ b: bone, q: push(delta16(a, 4)) });
      } else {
        let ps = vals.map(v => new THREE.Vector3(...v));
        if (bone === 'Bip01') ps = ps.map(p => p.multiplyScalar(rootFix.s).applyQuaternion(rootFix.q).add(rootFix.p));
        else ps = ps.map(p => p.multiplyScalar(0.01));
        if (/walk/.test(name) && bone === 'Bip01') { const p0 = ps[0].clone(); ps = ps.map(p => new THREE.Vector3(p0.x, p.y, p0.z)); } // auf der Stelle
        const r = restOf(bone, true);
        if (r && ps.every(p => p.distanceTo(r) < 0.0005)) continue;
        tracks.push({ b: bone, p: push(delta16(Int16Array.from(ps.flatMap(p => p.toArray()), v => Math.round(v * 1e4)), 3)) });   // 0,1 mm
      }
    }
    header.clips.push({ name, dur: +((frames - 1) / FPS).toFixed(3), frames, loop: !!loop, tracks });
  }
  const json = Buffer.from(JSON.stringify(header)); const jl = Math.ceil(json.length / 4) * 4;
  const file = Buffer.concat([Buffer.from('CLP2'), (() => { const b = Buffer.alloc(4); b.writeUInt32LE(jl); return b; })(), json, Buffer.alloc(jl - json.length, 32), ...chunks]);
  const gz = zlib.gzipSync(file, { level: 9 });
  fs.writeFileSync(path.join(OUT, `clips_${set}.bin.gz`), gz);
  return { clips: header.clips.length, kb: Math.round(gz.length / 1024) };
}

// ---------------------------------------------------------------------------------------------- Ablauf
const index = fs.existsSync(path.join(OUT, 'index.json')) && only ? JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')) : { people: {}, atlases: {}, clips: {} };
const want = id => !only || only.includes(id);
// Hauptfiguren: eigener Atlas (Spielfigur mit großer Körperkachel für die Hände)
for (const [id, h] of Object.entries(cfg.heroes)) {
  if (!want(id)) continue;
  const fig = await convertFigure(id, h.avatar, { facial: h.facial });
  const female = h.avatar.startsWith('Female');
  const player = h.role === 'player';
  const sz = player ? { body: 2048, head: 512, opacity: 512 } : { body: 1024, head: 1024, opacity: 512 };
  const tiles = Object.keys(fig.parts).map(k => ({ k, s: sz[k] * M }));
  const W = (player ? 4096 : 2048) * M, pk = shelfPack(tiles, W), place = Object.fromEntries(pk.tiles.map(t => [t.k, t]));
  const comp = [], compN = [];
  for (const t of pk.tiles) {
    const tex = k => path.join(fig.dir, 'Textures', `${fig.stem}_${k}.png`);
    comp.push({ ...(await tile(tex(t.k === 'opacity' ? 'opacity_color' : t.k + '_color'), t.s, t.k === 'opacity')), left: t.x, top: t.y });
    if (t.k !== 'opacity' && fs.existsSync(tex(t.k + '_normal'))) compN.push({ ...(await tile(tex(t.k + '_normal'), t.s, false)), left: t.x, top: t.y });
  }
  const r = await writeHPK(fig, 'hero', id, place, W, pk.h, compN.length > 0, { role: h.role, female });
  const kc = await writeAtlas(path.join(OUT, id + '_c.ktx2'), W, pk.h, comp, false);
  const kn = compN.length ? await writeAtlas(path.join(OUT, id + '_n.ktx2'), W, pk.h, compN, true) : 0;
  index.people[id] = { ...r, role: h.role, female, atlas: id, avatar: h.avatar, atlasKB: kc, normalKB: kn };
  index.atlases[id] = { w: W, h: pk.h, normal: kn > 0 };
  console.log(`✓ ${id.padEnd(9)} ${h.avatar.padEnd(16)} ${r.verts} Vertices, ${r.tris} Dreiecke, ${r.morphs} Gesichtsformen, ${r.kb} KB, Atlas ${kc} KB, Normalen ${kn} KB`);
}
// Menge: je Geschlecht ein Atlas (Körper 512, Kopf 512, Haar 256 px)
for (const [g, list] of Object.entries(cfg.crowd)) {
  const key = 'crowd_' + g; if (!want(key)) continue;
  const figs = [];
  for (const av of list) { if (!fs.existsSync(path.join(SRC, 'avatars', av, '.textures_done'))) { console.log('  ✗ fehlt', av); continue; } figs.push(await convertFigure(av.toLowerCase(), av, {})); }
  const tiles = figs.flatMap(f => Object.keys(f.parts).map(k => ({ f: f.id, k, s: (k === 'opacity' ? 256 : 512) * M })));
  const W = 4096 * M, pk = shelfPack(tiles, W);
  const comp = [];
  for (const t of pk.tiles) { const f = figs.find(x => x.id === t.f); comp.push({ ...(await tile(path.join(f.dir, 'Textures', `${f.stem}_${t.k === 'opacity' ? 'opacity' : t.k}_color.png`), t.s, t.k === 'opacity')), left: t.x, top: t.y }); }
  for (const f of figs) {
    const place = Object.fromEntries(pk.tiles.filter(t => t.f === f.id).map(t => [t.k, t]));
    const r = await writeHPK(f, 'crowd', key, place, W, pk.h, false, { role: 'student', female: g === 'f' });
    index.people[f.id] = { ...r, role: 'student', female: g === 'f', atlas: key, avatar: f.avatar };
    console.log(`✓ ${f.id.padEnd(16)} ${r.verts} Vertices, ${r.tris} Dreiecke (LOD1 ${r.tris1}), ${r.kb} KB`);
  }
  const kc = await writeAtlas(path.join(OUT, key + '_c.ktx2'), W, pk.h, comp, false);
  index.atlases[key] = { w: W, h: pk.h, normal: false, kb: kc };
  console.log(`✓ Atlas ${key} ${W}×${pk.h}: ${kc} KB`);
}
// Animationen: gemeinsamer Satz je Geschlecht + Zusatzsatz des Profs
if (!args.includes('--no-clips') && want('clips')) {
  // Wurzel-Umrechnung und Ruhepose aus einer Referenzfigur je Geschlecht
  for (const g of ['m', 'f']) {
    const ref = g === 'm' ? cfg.heroes.prof.avatar : cfg.heroes.neighbor.avatar;
    const obj = loadFBX(path.join(SRC, 'avatars', ref, 'Export', ref + '.fbx')); obj.scale.setScalar(0.01); obj.updateMatrixWorld(true);
    let bip = null; obj.traverse(o => { if (o.isBone && o.name === 'Bip01') bip = o; });
    const pp = V3(), pq = new THREE.Quaternion(), ps = V3(); bip.parent.matrixWorld.decompose(pp, pq, ps);
    const rootFix = { q: pq, s: ps.x, p: pp };
    const rest = new Map(); obj.traverse(o => { if (o.isBone) rest.set(o.name, { q: o.quaternion.clone(), p: o.position.clone().multiplyScalar(0.01) }); });
    const restOf = (b, pos) => { const r = rest.get(b); if (!r) return null; if (b === 'Bip01') return null; return pos ? r.p : r.q; };
    const sets = { [g]: cfg.clips.common, ...(g === 'm' ? { prof: cfg.clips.prof } : {}) };
    for (const [set, clips] of Object.entries(sets)) {
      const list = Object.entries(clips).map(([name, n]) => { const [, file] = n.includes(':') ? n.split(':') : [null, n]; return [name, path.join(SRC, 'anims', `${g}_${file}.fbx`), /idle|breathe|relaxed|waiting|walk|talk|listen|moderate/.test(name) && !/^(sit_down|stand_up)/.test(name)]; });
      const r = encodeClips(set, list, rootFix, restOf);
      index.clips[set] = { file: `clips_${set}.bin.gz`, ...r };
      console.log(`✓ Animationen ${set}: ${r.clips} Clips, ${r.kb} KB`);
    }
  }
}
index.profile = profile; index.license = 'Microsoft Rocketbox Avatar Library, MIT License';
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
