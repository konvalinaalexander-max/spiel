// Licht backen (Auftrag V3, Phase 3): Export → Cycles → KTX2.
//   node tools/pipeline/lightmap.mjs [--export] [--bake] [--size 2048] [--samples 48] [--ao-samples 64] [--threads 2]
// --export: statische Saalgeometrie aus dem Build holen (tools/lightmap-export.mjs, braucht dist/…_v3.html)
// --bake:   Blender/Cycles (tools/pipeline/blender/lightmap.py) → assets/src/lightmap/out/ (EXR, PNG, uv.json, uv.bin)
// immer:    PNG → KTX2 (ETC1S mit Alpha = Umgebungsverdeckung, sRGB) je Profil: Desktop volle Größe, Mobil halbe Kantenlänge
//           → assets/build/<profil>/lightmap/{index.json, uv.bin.gz, lm_<wetter>_<atlas>.ktx2}
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d);
const SRC = path.join(root, 'assets/src/lightmap'), OUT = path.join(SRC, 'out');
const blender = path.join(root, 'tools/blender/blender-4.5.15-linux-x64/blender');

if (args.includes('--export')) execFileSync('node', [path.join(root, 'tools/lightmap-export.mjs')], { stdio: 'inherit' });
if (args.includes('--bake')) {
  execFileSync('nice', ['-n', '10', blender, '--background', '--factory-startup', '--python', path.join(root, 'tools/pipeline/blender/lightmap.py'), '--',
    path.join(SRC, 'scene.json'), OUT, '--size', opt('size', '2048'), '--samples', opt('samples', '48'), '--ao-samples', opt('ao-samples', '64'), '--threads', opt('threads', '2')], { stdio: 'inherit' });
}

const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'uv.json'), 'utf8'));
const quiet = async fn => { const l = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = l; } };
const enc = png => quiet(() => encodeToKTX2(new Uint8Array(png), {
  generateMipmap: true, qualityLevel: +(process.env.LMQ || 230), compressionLevel: 2, needSupercompression: true, isKTX2File: true, isUASTC: false, isSetKTX2SRGBTransferFunc: true,
  imageDecoder: async b => { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; }
}));
// UV-Daten kompakt (Format 2): Vertexzuordnung und Dreiecke als Uint16-Differenzen, Lightmap-UVs als Uint16 (1/65535 Atlas ≈ 0,03 px)
function compactUV() {
  const src = fs.readFileSync(path.join(OUT, 'uv.bin')), parts = [], receivers = []; let off = 0;
  const add = a => { const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength); const o = off; parts.push(b); off += b.length; if (off % 4) { parts.push(Buffer.alloc(4 - (off % 4))); off += 4 - (off % 4); } return [o, a.length]; };
  const delta = a => { const d = new Uint16Array(a.length); let prev = 0; for (let i = 0; i < a.length; i++) { d[i] = (a[i] - prev) & 0xffff; prev = a[i]; } return d; };
  for (const r of meta.receivers) {
    const view = (key, T) => new T(src.buffer.slice(src.byteOffset + r[key][0], src.byteOffset + r[key][0] + r[key][1]));
    const map = view('map', Uint32Array), uv = view('uv', Float32Array), idx = view('idx', Uint32Array);
    if (r.verts > 65535 || r.newVerts > 65535) throw new Error('Format 2 braucht < 65536 Vertices je Empfänger');
    receivers.push({ ...r, map: add(delta(map)), uv: add(Uint16Array.from(uv, v => Math.round(Math.max(0, Math.min(1, v)) * 65535))), idx: add(delta(idx)) });
  }
  return { bin: Buffer.concat(parts), receivers };
}
const uvData = compactUV();
const uvOnly = process.argv.includes('--uv-only');   // nur UV-Daten neu schreiben, Atlanten behalten
for (const profile of ['desktop', 'mobile']) {
  const dir = path.join(root, 'assets/build', profile, 'lightmap');
  if (!uvOnly) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
  const size = profile === 'mobile' ? meta.size / 2 : meta.size;
  const files = [];
  for (const w of Object.keys(meta.weather)) for (let k = 0; k < meta.atlases; k++) {
    const src = path.join(OUT, `lm_${w}_${k}.png`); if (!fs.existsSync(src)) continue;
    const name = `lm_${w}_${k}.ktx2`; files.push(name);
    if (uvOnly) continue;
    const png = await sharp(src).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
    const k2 = await enc(png); fs.writeFileSync(path.join(dir, name), k2);
  }
  fs.writeFileSync(path.join(dir, 'uv.bin.gz'), zlib.gzipSync(uvData.bin, { level: 9 }));
  const index = { size, atlases: meta.atlases, weather: meta.weather, samples: meta.samples, aoSamples: meta.aoSamples, uvFormat: 2, receivers: uvData.receivers, files };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  const kb = files.reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0) / 1024;
  console.log(`✓ ${profile}: ${files.length} Lightmaps ${size}², ${kb.toFixed(0)} KB + UVs ${(fs.statSync(path.join(dir, 'uv.bin.gz')).size / 1024).toFixed(0)} KB`);
}
