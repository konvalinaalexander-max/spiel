// Echte Requisiten (Auftrag V3, Phase 5): Poly-Haven-Modelle (CC0) laden und für das Spiel aufbereiten.
//   node tools/pipeline/props.mjs [--fetch] [--profile desktop|mobile] [--only wall_clock,lemon]
// --fetch: glTF (1k) + Texturen nach assets/src/polyhaven/<id>/ laden (Cache, SHA-256, Urheber:innen aus der API)
// danach je Profil: Duplikate/Unbenutztes entfernen, verschweißen, auf das Dreiecksbudget vereinfachen (meshoptimizer),
// Texturen verkleinern und als KTX2 kodieren (Farbe/ARM ETC1S, Normalen ab 512 px UASTC), Geometrie quantisieren und mit
// EXT_meshopt_compression packen → assets/build/<profil>/props/<id>.glb + index.json (Maße, Dreiecke, Bytes, Urheber:innen).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, reorder, quantize, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = k => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : null);
const profile = opt('profile') || 'desktop';
const only = opt('only') ? opt('only').split(',') : null;
const list = JSON.parse(fs.readFileSync(path.join(root, 'tools/pipeline/props.json'), 'utf8')).models.filter(m => !only || only.includes(m.id));
const SRC = path.join(root, 'assets/src/polyhaven');
const UA = { 'User-Agent': 'Mozilla/5.0 (tic-tac-tierernaehrung asset pipeline)' };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const safeRel = p => { const n = path.posix.normalize(p); if (n.startsWith('..') || path.posix.isAbsolute(n) || n.includes('\0')) throw new Error('unsicherer Pfad ' + p); return n; };

async function fetchModel(id) {
  const dir = path.join(SRC, id); fs.mkdirSync(dir, { recursive: true });
  const info = await (await fetch(`https://api.polyhaven.com/info/${id}`, { headers: UA })).json();
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: UA })).json();
  const g = files.gltf['1k'].gltf;
  const all = [[path.posix.basename(g.url), g.url, g.md5], ...Object.entries(g.include || {}).map(([k, v]) => [safeRel(k), v.url, v.md5])];
  const got = [];
  for (const [rel, url, md5] of all) {
    const f = path.join(dir, rel);
    if (fs.existsSync(f) && (!md5 || crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex') === md5)) { got.push({ rel, sha256: sha(fs.readFileSync(f)) }); continue; }
    const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    const b = Buffer.from(await r.arrayBuffer()); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b); got.push({ rel, sha256: sha(b) });
  }
  const meta = { id, name: info.name, authors: Object.keys(info.authors || {}), license: 'CC0-1.0', source: `https://polyhaven.com/a/${id}`, polycount: info.polycount, dimensions: info.dimensions, gltf: path.posix.basename(g.url), files: got };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  return meta;
}

const quiet = async fn => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
const enc = (png, o) => quiet(() => encodeToKTX2(new Uint8Array(png), {
  generateMipmap: true, qualityLevel: 160, compressionLevel: 2, needSupercompression: true, isKTX2File: true,
  imageDecoder: async b => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; }, ...o }));

async function processModel(m, io) {
  const meta = JSON.parse(fs.readFileSync(path.join(SRC, m.id, 'meta.json'), 'utf8'));
  const doc = await io.read(path.join(SRC, m.id, meta.gltf));
  const tris = () => doc.getRoot().listMeshes().reduce((a, me) => a + me.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  await doc.transform(dedup(), prune(), weld());
  const t0 = tris();
  if (t0 > m.tris) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: m.tris / t0, error: m.error ?? 0.01, lockBorder: false }));
  const t1 = tris();
  // Texturen: Rolle aus den Materialien ableiten (Normalen / Farbe / linear)
  const role = new Map();
  for (const mat of doc.getRoot().listMaterials()) {
    if (mat.getBaseColorTexture()) role.set(mat.getBaseColorTexture(), 'color');
    if (mat.getEmissiveTexture()) role.set(mat.getEmissiveTexture(), 'color');
    if (mat.getNormalTexture()) role.set(mat.getNormalTexture(), 'normal');
    for (const t of [mat.getMetallicRoughnessTexture(), mat.getOcclusionTexture()]) if (t && !role.has(t)) role.set(t, 'linear');
  }
  const size = profile === 'mobile' ? Math.max(128, m.tex / 2) : m.tex;
  for (const tex of doc.getRoot().listTextures()) {
    const r = role.get(tex) || 'color', img = tex.getImage(); if (!img) continue;
    const meta2 = await sharp(Buffer.from(img)).metadata();
    const s = Math.min(size, meta2.width || size), hasAlpha = r === 'color' && meta2.hasAlpha;
    const png = await sharp(Buffer.from(img)).resize(s, Math.round(s * (meta2.height || s) / (meta2.width || s)), { kernel: 'lanczos3' }).png().toBuffer();
    const k = await enc(png, r === 'normal' ? { isUASTC: s >= 512, isNormalMap: true, isSetKTX2SRGBTransferFunc: false } : { isUASTC: false, isSetKTX2SRGBTransferFunc: r === 'color' });
    tex.setImage(new Uint8Array(k)).setMimeType('image/ktx2').setURI(tex.getURI().replace(/\.(jpe?g|png)$/i, '.ktx2'));
    void hasAlpha;
  }
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bin = await io.writeBinary(doc);
  const out = path.join(root, 'assets/build', profile, 'props'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, m.id + '.glb'), bin);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  return { id: m.id, name: meta.name, authors: meta.authors, license: meta.license, source: meta.source, use: m.use, tris: Math.round(t1), trisSrc: Math.round(t0), kb: Math.round(bin.length / 1024),
    size: b.max.map((v, i) => +(v - b.min[i]).toFixed(3)), min: b.min.map(v => +v.toFixed(3)) };
}

if (args.includes('--fetch')) {
  for (const m of list) { try { const meta = await fetchModel(m.id); console.log(`↓ ${m.id.padEnd(26)} ${meta.files.length} Dateien, ${meta.authors.join(', ')}`); } catch (e) { console.log(`✗ ${m.id}: ${e.message}`); } }
}
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const idxFile = path.join(root, 'assets/build', profile, 'props', 'index.json');
const index = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
for (const m of list) {
  if (!fs.existsSync(path.join(SRC, m.id, 'meta.json'))) { console.log(`✗ ${m.id}: nicht geladen (--fetch)`); continue; }
  try { const r = await processModel(m, io); index[m.id] = r; console.log(`✓ ${m.id.padEnd(26)} ${r.trisSrc} → ${r.tris} Dreiecke, ${r.kb} KB, ${r.size.join(' × ')} m`); }
  catch (e) { console.log(`✗ ${m.id}: ${e.message}`); }
  fs.mkdirSync(path.dirname(idxFile), { recursive: true }); fs.writeFileSync(idxFile, JSON.stringify(index, null, 1));
}
