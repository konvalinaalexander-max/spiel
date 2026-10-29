// Figuren für das Spiel verpacken (Auftrag V3, Phase 4): assets/build/humans/<id>.glb (Blender/MPFB) →
//   assets/build/<profil>/humans/<id>.hpk      Geometrie + Skelett (gzip, kompaktes Binärformat, siehe unten)
//   assets/build/<profil>/humans/<id>_c.ktx2   Farbatlas je Hauptfigur (Basis Universal ETC1S, mit Alpha)
//   assets/build/<profil>/humans/<id>_n.ktx2   Normalenatlas je Hauptfigur (UASTC)
//   assets/build/<profil>/humans/crowd_f_c.ktx2, crowd_m_c.ktx2  gemeinsame Farbatlanten der Studierenden-Typen (wenige Draw Calls)
//   assets/build/<profil>/humans/index.json    Liste, Rollen, Merkmale für die Zuordnung
//   node tools/pipeline/humans-pack.mjs [--profile desktop|mobile] [--only prof]
//
// Pro Figur werden alle Materialien (Haut, Kleidung, Haar, Augen, Brauen, Wimpern, Zähne) in Kacheln eines Atlas gelegt und die
// UVs umgerechnet; Haar/Brauen/Wimpern bilden eine zweite Gruppe (Alphatest), alles andere ist deckend. Rauheit und Teilart
// stehen je Vertex im Attribut „surf“; das Oberteil mit tintTop wird entsättigt und im Spiel je Person eingefärbt.
//
// HPK-Format: "HPK1" · u32 Länge JSON · JSON · Auffüllung auf 4 Byte · Binärdaten (Reihenfolge und Typen im JSON). Ganze Datei gzip.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { encodeToKTX2 } from 'ktx2-encoder';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = k => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : null);
const profile = opt('profile') || 'desktop';
const only = opt('only') ? opt('only').split(',') : null;
const src = path.join(root, 'assets/build/humans');
const out = path.join(root, 'assets/build', profile, 'humans'); fs.mkdirSync(out, { recursive: true });
const roster = JSON.parse(fs.readFileSync(path.join(root, 'tools/pipeline/humans.json'), 'utf8'));
const M = profile === 'mobile' ? 0.5 : 1; // Atlasgröße
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Teilarten: 0 Haut, 1 Kleidung, 2 einfärbbares Oberteil, 3 Haar/Brauen/Wimpern, 4 Augen, 5 Zähne
const PART = { body: 0, clothes: 1, top: 2, hair: 3, eyebrow: 3, eyelash: 3, eyes: 4, teeth: 5, tongue: 5 };
const ALPHA = new Set(['hair', 'eyebrow', 'eyelash']);
const ROUGH = { body: 0.58, clothes: 0.86, top: 0.86, hair: 0.5, eyebrow: 0.7, eyelash: 0.7, eyes: 0.12, teeth: 0.35, tongue: 0.45 };
// Kachelgrößen (Pixel) je Teilart; Spielfigur braucht die Hände scharf aus nächster Nähe
// (Der Basis-Kodierer verarbeitet höchstens ~12 Mpx je Bild → Spielfigur 4096×2048, Menge in zwei Atlanten zu 4096×2048.)
const TILES = {
  player: { w: 4096, h: 2048, body: 2048, clothes: 1024, hair: 512, eyes: 128, eyebrow: 128, eyelash: 128, teeth: 128 },
  hero: { w: 2048, h: 2048, body: 1024, clothes: 1024, hair: 512, eyes: 128, eyebrow: 128, eyelash: 128, teeth: 128 },
  crowd: { w: 1024, h: 1024, body: 512, clothes: 256, hair: 256, eyes: 64, eyebrow: 64, eyelash: 64, teeth: 64 }
};
const PAD = 4;

class QuadAlloc { // Quadtree für Quadrate mit Zweierpotenz-Kantenlänge (Rechteck = mehrere Wurzelquadrate nebeneinander)
  constructor(w, h = w) { const s = Math.min(w, h); this.free = []; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) this.free.push({ x, y, s }); }
  alloc(s) {
    this.free.sort((a, b) => a.s - b.s || a.y - b.y || a.x - b.x);
    const i = this.free.findIndex(f => f.s >= s); if (i < 0) return null;
    let f = this.free.splice(i, 1)[0];
    while (f.s > s) { const h = f.s / 2; this.free.push({ x: f.x + h, y: f.y, s: h }, { x: f.x, y: f.y + h, s: h }, { x: f.x + h, y: f.y + h, s: h }); f = { x: f.x, y: f.y, s: h }; }
    return f;
  }
}

/** Bild → RGBA-Rohdaten in Kachelgröße (mit Rand), optional umgefärbt. */
async function tileImage(bytes, size, { recolor, mean = 0.72, solid } = {}) {
  const inner = size - 2 * PAD;
  let img = solid ? sharp({ create: { width: inner, height: inner, channels: 4, background: { r: solid[0] * 255, g: solid[1] * 255, b: solid[2] * 255, alpha: 1 } } })
    : sharp(Buffer.from(bytes)).ensureAlpha().resize(inner, inner, { kernel: 'lanczos3', fit: 'fill' });
  let { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  if (recolor) {
    // Entsättigen, auf Mittelwert normieren, dann mit Zielfarbe multiplizieren (Strickmuster/Falten bleiben erhalten)
    let sum = 0, n = 0; const L = new Float32Array(info.width * info.height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) { L[j] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255; if (data[i + 3] > 128) { sum += L[j]; n++; } }
    const avg = Math.max(0.05, sum / Math.max(1, n));
    const c = recolor === 'gray' ? [mean, mean, mean] : recolor;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) { const k = L[j] / avg; data[i] = Math.min(255, c[0] * k * 255); data[i + 1] = Math.min(255, c[1] * k * 255); data[i + 2] = Math.min(255, c[2] * k * 255); }
  }
  // Rand: Kantenpixel nach außen fortsetzen (verhindert Farbsäume durch Filterung/Mipmaps)
  return sharp(data, { raw: { width: inner, height: inner, channels: 4 } }).extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith: 'copy' }).raw().toBuffer();
}

async function packFigure(h, region, atlasC, atlasN, atlasKey) {
  const doc = await io.read(path.join(src, h.id + '.glb'));
  const meta = JSON.parse(fs.readFileSync(path.join(src, h.id + '.meta.json'), 'utf8'));
  const names = Object.keys(meta.parents), jIndex = Object.fromEntries(names.map((n, i) => [n, i]));
  const cls = h.class === 'crowd' ? 'crowd' : h.role === 'player' ? 'player' : 'hero';
  const T = TILES[cls];
  // Teile sammeln
  const parts = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const joints = node.getSkin() ? node.getSkin().listJoints().map(j => jIndex[j.getName()] ?? 0) : null;
    const obj = node.getName().split('.').pop();
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial(); const kindRaw = (mat.getName().match(/_(body|clothes|hair|eyebrow|eyelash|eyes|teeth|tongue)_/) || [, 'clothes'])[1];
      const top = h.tintTop && obj.endsWith(h.tintTop);
      const kind = top ? 'top' : kindRaw;
      parts.push({ prim, joints, obj, kind, mat, color: mat.getBaseColorTexture()?.getImage(), normal: mat.getNormalTexture()?.getImage(), factor: mat.getBaseColorFactor() });
    }
  }
  // Kacheln zuteilen: Wunschgrößen, bei Platzmangel zuerst die größte Nicht-Haut-Kachel halbieren, zuletzt die Haut
  const want = p => (p.color ? (T[p.kind === 'top' ? 'clothes' : p.kind] || 64) * M : 16);
  for (const p of parts) p.size = Math.max(16, want(p));
  for (let guard = 0; guard < 64; guard++) {
    const alloc = new QuadAlloc(T.w * M, T.h * M); let ok = true;
    for (const p of [...parts].sort((a, b) => b.size - a.size)) { p.tile = alloc.alloc(p.size); if (!p.tile) { ok = false; break; } }
    if (ok) break;
    const cand = parts.filter(p => p.kind !== 'body' && p.size > 16 * M).sort((a, b) => b.size - a.size)[0] || parts.filter(p => p.size > 16).sort((a, b) => b.size - a.size)[0];
    cand.size /= 2;
  }
  // Atlas befüllen
  for (const p of parts) {
    const t = p.tile; const recolorFrom = (h.recolor || {})[p.obj];
    const opts = p.kind === 'top' ? { recolor: 'gray' } : recolorFrom ? { recolor: recolorFrom } : (ALPHA.has(p.kind) && p.kind === 'hair' && h.hairColor && !h.hairMaterial) ? { recolor: h.hairColor } : {};
    if (!p.color) opts.solid = (ALPHA.has(p.kind) && h.hairColor) ? h.hairColor : p.factor.slice(0, 3);
    const raw = await tileImage(p.color, t.s, opts);
    atlasC.composites.push({ input: raw, raw: { width: t.s, height: t.s, channels: 4 }, left: region.x + t.x, top: region.y + t.y });
    if (atlasN && p.normal) {
      const nraw = await tileImage(p.normal, t.s);
      atlasN.composites.push({ input: nraw, raw: { width: t.s, height: t.s, channels: 4 }, left: region.x + t.x, top: region.y + t.y });
    }
  }
  // Geometrie zusammenführen: deckend zuerst, dann Alpha
  const order = [...parts.filter(p => !ALPHA.has(p.kind)), ...parts.filter(p => ALPHA.has(p.kind))];
  const pos = [], nor = [], uv = [], jn = [], wt = [], surf = [], idx = []; let base = 0, wrapped = 0; const groups = [];
  const AW = atlasC.w, AH = atlasC.h;
  for (const p of order) {
    const P = p.prim.getAttribute('POSITION'), N = p.prim.getAttribute('NORMAL'), U = p.prim.getAttribute('TEXCOORD_0'), J = p.prim.getAttribute('JOINTS_0'), W = p.prim.getAttribute('WEIGHTS_0'), I = p.prim.getIndices();
    const n = P.getCount(), e = [];
    const t = p.tile, x0 = region.x + t.x + PAD, y0 = region.y + t.y + PAD, s = t.s - 2 * PAD;
    for (let i = 0; i < n; i++) {
      pos.push(...P.getElement(i, e)); nor.push(...N.getElement(i, e));
      let [u, v] = U ? U.getElement(i, e) : [0.5, 0.5];
      if (u < -0.001 || u > 1.001 || v < -0.001 || v > 1.001) { wrapped++; u -= Math.floor(u); v -= Math.floor(v); }
      uv.push((x0 + Math.min(1, Math.max(0, u)) * s) / AW, (y0 + Math.min(1, Math.max(0, v)) * s) / AH);
      const jj = J.getElement(i, []), ww = W.getElement(i, []);
      const tot = ww.reduce((a, b) => a + b, 0) || 1;
      for (let k = 0; k < 4; k++) { jn.push(p.joints ? p.joints[jj[k]] : jj[k]); wt.push(ww[k] / tot); }
      surf.push(ROUGH[p.kind] ?? 0.8, p.normal ? 1 : 0, PART[p.kind] ?? 1, 0);
    }
    const start = idx.length;
    const ia = I.getArray(); for (let i = 0; i < ia.length; i++) idx.push(ia[i] + base);
    const alpha = ALPHA.has(p.kind);
    const last = groups[groups.length - 1];
    if (last && last.alpha === alpha) last.count += ia.length; else groups.push({ start, count: ia.length, alpha });
    base += n;
  }
  // Binär kodieren
  const nv = pos.length / 3, big = nv > 65535;
  const bufs = [
    ['position', new Float32Array(pos)],
    ['normal', Int8Array.from(Array.from({ length: nv * 4 }, (_, i) => (i % 4 === 3 ? 0 : Math.round(Math.max(-1, Math.min(1, nor[(i >> 2) * 3 + (i % 4)])) * 127))))],
    ['uv', Uint16Array.from(uv.map(x => Math.round(Math.max(0, Math.min(1, x)) * 65535)))],
    ['joints', Uint8Array.from(jn)],
    ['weights', Uint8Array.from(wt.map(x => Math.round(x * 255)))],
    ['surf', Uint8Array.from(surf.map((x, i) => (i % 4 === 2 ? x : Math.round(x * 255))))],
    ['index', big ? Uint32Array.from(idx) : Uint16Array.from(idx)]
  ];
  const head = { id: h.id, role: h.role || 'student', class: cls, female: !!h.female, skinTone: h.skinTone, hairTone: h.hairTone, top: h.top, tint: !!h.tintTop,
    joints: meta.joints, parents: meta.parents, fingers: meta.fingers, height: meta.height, vertices: nv, groups,
    atlas: atlasKey || h.id, normalMap: !!atlasN, buffers: [] };
  let off = 0; for (const [name, a] of bufs) { head.buffers.push({ name, type: a.constructor.name, offset: off, length: a.length }); off += Math.ceil(a.byteLength / 4) * 4; }
  const json = Buffer.from(JSON.stringify(head)); const jl = Math.ceil(json.length / 4) * 4;
  const file = Buffer.alloc(8 + jl + off); file.write('HPK1', 0); file.writeUInt32LE(jl, 4); json.copy(file, 8); file.fill(32, 8 + json.length, 8 + jl);
  for (const [i, [, a]] of bufs.entries()) Buffer.from(a.buffer, a.byteOffset, a.byteLength).copy(file, 8 + jl + head.buffers[i].offset);
  const gz = zlib.gzipSync(file, { level: 9 });
  fs.writeFileSync(path.join(out, h.id + '.hpk'), gz);
  return { id: h.id, class: cls, verts: nv, tris: idx.length / 3, kb: Math.round(gz.length / 1024), wrapped, tiles: Object.fromEntries(parts.map(p => [p.obj + ":" + p.kind, p.size])) };
}

const enc = (png, o) => encodeToKTX2(new Uint8Array(png), { generateMipmap: true, qualityLevel: 200, compressionLevel: 2, needSupercompression: true, isKTX2File: true,
  imageDecoder: async b => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; }, ...o });
const quiet = async fn => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
async function writeAtlas(file, a, normal) {
  const png = await sharp({ create: { width: a.w, height: a.h, channels: 4, background: normal ? { r: 128, g: 128, b: 255, alpha: 1 } : { r: 128, g: 110, b: 100, alpha: 1 } } })
    .composite(a.composites).png().toBuffer();
  if (args.includes('--png')) fs.writeFileSync(file.replace('.ktx2', '.png'), png);
  const k = await quiet(() => enc(png, normal ? { isUASTC: true, isNormalMap: true, isSetKTX2SRGBTransferFunc: false } : { isUASTC: false, isSetKTX2SRGBTransferFunc: true }));
  fs.writeFileSync(file, k);
  return Math.round(k.length / 1024);
}

const all = roster.humans.filter(h => fs.existsSync(path.join(src, h.id + '.glb')));
const index = fs.existsSync(path.join(out, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8')) : { humans: {} };
// Hauptfiguren: je eigener Atlas
for (const h of all.filter(h => h.class !== 'crowd' && (!only || only.includes(h.id)))) {
  const cls = h.role === 'player' ? 'player' : 'hero', w = TILES[cls].w * M, hh = TILES[cls].h * M;
  const aC = { w, h: hh, composites: [] }, aN = { w: w / 2, h: hh / 2, composites: [] };
  // Normalen in halber Auflösung: gleicher Atlas, danach verkleinert
  const aN2 = { w, h: hh, composites: [] };
  const r = await packFigure(h, { x: 0, y: 0 }, aC, aN2);
  const kc = await writeAtlas(path.join(out, h.id + '_c.ktx2'), aC);
  let kn = 0;
  if (aN2.composites.length) {
    const big = await sharp({ create: { width: w, height: hh, channels: 4, background: { r: 128, g: 128, b: 255, alpha: 1 } } }).composite(aN2.composites).png().toBuffer();
    aN.composites = [{ input: await sharp(big).resize(w / 2, hh / 2).png().toBuffer(), left: 0, top: 0 }];
    kn = await writeAtlas(path.join(out, h.id + '_n.ktx2'), aN, true);
  }
  index.humans[h.id] = { ...r, role: h.role, female: !!h.female, atlasKB: kc, normalKB: kn };
  console.log(`✓ ${h.id.padEnd(9)} ${r.verts} Vertices, ${r.tris} Dreiecke, Geometrie ${r.kb} KB, Atlas ${kc} KB${kn ? `, Normalen ${kn} KB` : ''}${r.wrapped ? `, ${r.wrapped} UVs gefaltet` : ''}`);
}
// Menge: zwei gemeinsame Atlanten (Frauen/Männer) zu 4×2 Kacheln à 1024 px → je Atlas ein Draw Call (plus Haar)
const crowd = all.filter(h => h.class === 'crowd');
if (crowd.length && (!only || only.includes('crowd'))) {
  index.crowdAtlas = {};
  for (const [key, list] of [['crowd_f', crowd.filter(h => h.female)], ['crowd_m', crowd.filter(h => !h.female)]]) {
    if (!list.length) continue;
    const tile = TILES.crowd.w * M, cols = 4, rows = Math.ceil(list.length / cols);
    const aC = { w: tile * cols, h: tile * rows, composites: [] };
    for (const [i, h] of list.entries()) {
      const r = await packFigure(h, { x: (i % cols) * tile, y: Math.floor(i / cols) * tile }, aC, null, key);
      index.humans[h.id] = { ...r, atlas: key, role: 'student', female: !!h.female, skinTone: h.skinTone, hairTone: h.hairTone, top: h.top, tint: !!h.tintTop };
      console.log(`✓ ${h.id.padEnd(9)} ${r.verts} Vertices, ${r.tris} Dreiecke, Geometrie ${r.kb} KB${r.wrapped ? `, ${r.wrapped} UVs gefaltet` : ''}`);
    }
    const kc = await writeAtlas(path.join(out, key + '_c.ktx2'), aC);
    index.crowdAtlas[key] = { w: aC.w, h: aC.h, kb: kc };
    console.log(`✓ Atlas ${key} ${aC.w}×${aC.h}: ${kc} KB`);
  }
}
index.profile = profile;
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 1));
