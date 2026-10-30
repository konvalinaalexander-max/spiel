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

// Modell laden, aufräumen, auf das Dreiecksbudget vereinfachen
async function loadModel(m, io) {
  const meta = JSON.parse(fs.readFileSync(path.join(SRC, m.id, 'meta.json'), 'utf8'));
  const doc = await io.read(path.join(SRC, m.id, meta.gltf));
  // Glas mit echter Transmission zwingt three.js zu einem zweiten Durchgang über alle undurchsichtigen Objekte (≈ 80 Draw Calls
  // mehr je Bild) – stattdessen halbtransparentes Glas
  for (const mat of doc.getRoot().listMaterials()) {
    const tr = mat.getExtension('KHR_materials_transmission'); if (!tr) continue;
    const f = mat.getBaseColorFactor(), k = tr.getTransmissionFactor();
    mat.setExtension('KHR_materials_transmission', null).setExtension('KHR_materials_volume', null);
    mat.setAlphaMode('BLEND').setBaseColorFactor([f[0], f[1], f[2], Math.max(0.12, 1 - k * 0.85)]).setRoughnessFactor(Math.min(mat.getRoughnessFactor(), 0.15));
  }
  const tris = () => doc.getRoot().listMeshes().reduce((a, me) => a + me.listPrimitives().reduce((b, p) => b + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  await doc.transform(dedup(), prune(), weld());
  const t0 = tris();
  // Mobil: 40 % des Dreiecksbudgets (Budget Handy ≤ 400 k Dreiecke je Bild; Requisiten stehen vielfach auf den Pulten)
  const budget = profile === 'mobile' ? Math.round(m.tris * 0.4) : m.tris;
  if (t0 > budget) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: budget / t0, error: (m.error ?? 0.01) * (profile === 'mobile' ? 6 : 1), lockBorder: false }));
  return { m, meta, doc, t0, t1: tris() };
}

// ---------------------------------------------------------------------------------------------- Atlas
// Alle undurchsichtigen, einseitigen Materialien ohne Leuchten, deren UVs im Bereich 0…1 liegen, kommen in gemeinsame Atlanten
// (Farbe mit eingerechnetem Farbfaktor, Normalen, ORM = Verdeckung/Rauheit/Metall). Zur Laufzeit teilen sich dann alle diese
// Requisiten ein Material je Atlasseite → der Batcher verschmilzt sie zu wenigen Draw Calls (vorher ~100 Materialien).
const primsOf = (doc, mat) => doc.getRoot().listMeshes().flatMap(me => me.listPrimitives()).filter(p => p.getMaterial() === mat);
function atlasEligible(doc, mat) {
  if (mat.getAlphaMode() !== 'OPAQUE') return false;
  if (mat.getEmissiveTexture() || mat.getEmissiveFactor().some(v => v > 0.01)) return false;
  // Glas (Transmission), Klarlack usw. bleiben eigene Materialien; Glanz-/Brechzahl-Angaben sind für den Atlas unerheblich
  if (mat.listExtensions().some(e => !['KHR_materials_ior', 'KHR_materials_specular'].includes(e.extensionName))) return false;
  for (const ti of [mat.getBaseColorTextureInfo(), mat.getNormalTextureInfo(), mat.getMetallicRoughnessTextureInfo(), mat.getOcclusionTextureInfo()])
    if (ti && (ti.getTexCoord() !== 0 || ti.listExtensions().length)) return false;
  const prims = primsOf(doc, mat); if (!prims.length) return false;
  const e = [0, 0];
  for (const p of prims) {
    const uv = p.getAttribute('TEXCOORD_0'); if (!uv) return false;
    for (let i = 0; i < uv.getCount(); i++) { uv.getElement(i, e); if (e[0] < -0.02 || e[0] > 1.02 || e[1] < -0.02 || e[1] > 1.02) return false; }
  }
  return true;
}
const srgb = v => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2));
async function rawTile(img, s, fill) {
  if (!img) { const b = Buffer.alloc(s * s * 4); for (let i = 0; i < s * s; i++) b.set(fill, i * 4); return b; }
  return sharp(Buffer.from(img)).resize(s, s, { kernel: 'lanczos3', fit: 'fill' }).ensureAlpha().raw().toBuffer();
}
async function tilesFor(mat, s) {
  const f = mat.getBaseColorFactor(), fc = [srgb(f[0]) / 255, srgb(f[1]) / 255, srgb(f[2]) / 255];
  const col = await rawTile(mat.getBaseColorTexture()?.getImage(), s, [255, 255, 255, 255]);
  for (let i = 0; i < s * s; i++) { for (let c = 0; c < 3; c++) col[i * 4 + c] = Math.round(col[i * 4 + c] * fc[c]); col[i * 4 + 3] = 255; }
  const nor = await rawTile(mat.getNormalTexture()?.getImage(), s, [128, 128, 255, 255]);
  const mr = mat.getMetallicRoughnessTexture(), occ = mat.getOcclusionTexture();
  const mrb = await rawTile(mr?.getImage(), s, [255, 255, 255, 255]), ob = occ ? await rawTile(occ.getImage(), s, [255, 255, 255, 255]) : null;
  const orm = Buffer.alloc(s * s * 4), rf = mat.getRoughnessFactor(), mf = mat.getMetallicFactor();
  for (let i = 0; i < s * s; i++) { orm[i * 4] = ob ? ob[i * 4] : 255; orm[i * 4 + 1] = Math.round(mrb[i * 4 + 1] * rf); orm[i * 4 + 2] = Math.round(mrb[i * 4 + 2] * mf); orm[i * 4 + 3] = 255; }
  return { col, nor, orm };
}
function packPages(tiles, W) {
  const pages = []; let page = 0, x = 0, y = 0, rowH = 0;
  for (const t of [...tiles].sort((a, b) => b.s - a.s)) {
    if (x + t.s > W) { x = 0; y += rowH; rowH = 0; }
    if (y + t.s > W) { page++; x = 0; y = 0; rowH = 0; }
    Object.assign(t, { page, x, y }); x += t.s; rowH = Math.max(rowH, t.s);
    pages[page] = Math.max(pages[page] || 0, y + rowH);
  }
  return pages.map(h => Math.ceil(h / 4) * 4);
}
async function buildAtlas(models, out) {
  const W = profile === 'mobile' ? 2048 : 4096, PAD = profile === 'mobile' ? 2 : 4;
  const tiles = [];
  for (const md of models) for (const mat of md.doc.getRoot().listMaterials()) {
    if (!atlasEligible(md.doc, mat)) continue;
    const s = profile === 'mobile' ? Math.max(64, md.m.tex / 2) : md.m.tex;
    tiles.push({ md, mat, s });
  }
  const heights = packPages(tiles, W);
  const comp = heights.map(() => ({ col: [], nor: [], orm: [] }));
  for (const t of tiles) {
    const inner = t.s - 2 * PAD, im = await tilesFor(t.mat, inner);
    for (const k of ['col', 'nor', 'orm']) {
      const buf = await sharp(im[k], { raw: { width: inner, height: inner, channels: 4 } }).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).raw().toBuffer();
      comp[t.page][k].push({ input: buf, raw: { width: t.s, height: t.s, channels: 4 }, left: t.x, top: t.y });
    }
    // UVs auf die Kachel abbilden (Zugriffsobjekt je Primitive kopieren – es kann mit anderen Materialien geteilt sein)
    const H = heights[t.page], e = [0, 0];
    for (const p of primsOf(t.md.doc, t.mat)) {
      const uv = p.getAttribute('TEXCOORD_0'), n = uv.getCount(), a = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { uv.getElement(i, e); a[i * 2] = (t.x + PAD + Math.max(0, Math.min(1, e[0])) * inner) / W; a[i * 2 + 1] = (t.y + PAD + Math.max(0, Math.min(1, e[1])) * inner) / H; }
      p.setAttribute('TEXCOORD_0', t.md.doc.createAccessor().setType('VEC2').setArray(a).setBuffer(uv.getBuffer()));
    }
    // Platzhalter je Seite und Seitigkeit: „atlas:0“ einseitig, „atlas:0d“ beidseitig (Poly Haven markiert fast alles beidseitig)
    const key = t.page + (t.mat.getDoubleSided() ? 'd' : '');
    let am = t.md.atlasMats?.[key];
    if (!am) { t.md.atlasMats = t.md.atlasMats || {}; am = t.md.atlasMats[key] = t.md.doc.createMaterial('atlas:' + key).setRoughnessFactor(1).setMetallicFactor(1).setDoubleSided(t.mat.getDoubleSided()); }
    for (const p of primsOf(t.md.doc, t.mat)) p.setMaterial(am);
  }
  const files = [];
  for (let pg = 0; pg < heights.length; pg++) {
    const page = {};
    for (const [k, bg, o] of [['col', { r: 128, g: 128, b: 128, alpha: 1 }, { isUASTC: false, isSetKTX2SRGBTransferFunc: true }], ['nor', { r: 128, g: 128, b: 255, alpha: 1 }, { isUASTC: false, isNormalMap: true, isSetKTX2SRGBTransferFunc: false }], ['orm', { r: 255, g: 255, b: 0, alpha: 1 }, { isUASTC: false, isSetKTX2SRGBTransferFunc: false }]]) {
      const png = await sharp({ create: { width: W, height: heights[pg], channels: 4, background: bg } }).composite(comp[pg][k]).png().toBuffer();
      const name = `atlas_${pg}_${k}.ktx2`; fs.writeFileSync(path.join(out, name), await enc(png, o)); page[k] = name;
      if (args.includes('--png')) fs.writeFileSync(path.join(out, name.replace('.ktx2', '.png')), png);
    }
    files.push(page);
  }
  const info = { pages: files, size: heights.map(h => [W, h]), tiles: tiles.length, pad: PAD };
  fs.writeFileSync(path.join(out, 'atlas.json'), JSON.stringify(info));
  console.log(`✓ Atlas: ${tiles.length} Materialien auf ${files.length} Seite(n) ${W}×${heights.join('/')}`);
  return info;
}

// restliche Einzeltexturen kodieren, Geometrie packen, schreiben
async function finishModel({ m, meta, doc, t0, t1 }, io, out) {
  await doc.transform(prune());
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
    const s = Math.min(size, meta2.width || size);
    const png = await sharp(Buffer.from(img)).resize(s, Math.round(s * (meta2.height || s) / (meta2.width || s)), { kernel: 'lanczos3' }).png().toBuffer();
    const k = await enc(png, r === 'normal' ? { isUASTC: s >= 512, isNormalMap: true, isSetKTX2SRGBTransferFunc: false } : { isUASTC: false, isSetKTX2SRGBTransferFunc: r === 'color' });
    tex.setImage(new Uint8Array(k)).setMimeType('image/ktx2').setURI(tex.getURI().replace(/\.(jpe?g|png)$/i, '.ktx2'));
  }
  if (doc.getRoot().listTextures().length) doc.createExtension(KHRTextureBasisu).setRequired(true);
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize());
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bin = await io.writeBinary(doc);
  fs.writeFileSync(path.join(out, m.id + '.glb'), bin);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const b = getBounds(scene);
  const own = doc.getRoot().listMaterials().filter(x => !x.getName().startsWith('atlas:')).length;
  return { id: m.id, name: meta.name, authors: meta.authors, license: meta.license, source: meta.source, use: m.use, tris: Math.round(t1), trisSrc: Math.round(t0), kb: Math.round(bin.length / 1024),
    size: b.max.map((v, i) => +(v - b.min[i]).toFixed(3)), min: b.min.map(v => +v.toFixed(3)), ownMaterials: own };
}

if (args.includes('--fetch')) {
  for (const m of list) { try { const meta = await fetchModel(m.id); console.log(`↓ ${m.id.padEnd(26)} ${meta.files.length} Dateien, ${meta.authors.join(', ')}`); } catch (e) { console.log(`✗ ${m.id}: ${e.message}`); } }
}
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const out = path.join(root, 'assets/build', profile, 'props'); fs.mkdirSync(out, { recursive: true });
const idxFile = path.join(out, 'index.json');
// Atlas braucht alle Modelle gleichzeitig: --only nur mit --no-atlas sinnvoll
const index = fs.existsSync(idxFile) && only ? JSON.parse(fs.readFileSync(idxFile, 'utf8')) : {};
const loaded = [];
for (const m of list) {
  if (!fs.existsSync(path.join(SRC, m.id, 'meta.json'))) { console.log(`✗ ${m.id}: nicht geladen (--fetch)`); continue; }
  try { loaded.push(await loadModel(m, io)); } catch (e) { console.log(`✗ ${m.id}: ${e.message}`); }
}
if (!args.includes('--no-atlas')) await buildAtlas(loaded, out);
else if (fs.existsSync(path.join(out, 'atlas.json')) && !only) fs.rmSync(path.join(out, 'atlas.json'));
for (const md of loaded) {
  try { const r = await finishModel(md, io, out); index[md.m.id] = r; console.log(`✓ ${md.m.id.padEnd(26)} ${r.trisSrc} → ${r.tris} Dreiecke, ${r.kb} KB, eigene Materialien ${r.ownMaterials}`); }
  catch (e) { console.log(`✗ ${md.m.id}: ${e.message}`); }
}
fs.writeFileSync(idxFile, JSON.stringify(index, null, 1));
