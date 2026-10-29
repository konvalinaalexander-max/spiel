// Textur-Pipeline (Auftrag V3, Phase 3): ambientCG-Materialien (CC0) → KTX2 (Basis Universal) je Profil.
// node tools/pipeline/textures.mjs [--profile desktop|mobile] [--only WoodFloor052,...]
// Ausgabe: assets/build/<profil>/textures/<id>_{color,normal,orm}.ktx2 + assets/build/<profil>/textures.json
//   color : sRGB, ETC1S (klein, für Farbe gut genug)
//   normal: linear, UASTC (Normalen verlieren mit ETC1S sichtbar Qualität)
//   orm   : linear, ETC1S – R = Umgebungsverdeckung, G = Rauheit, B = Metallizität (glTF-Konvention)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const profile = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : 'desktop';
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
// Material: Größe der Farbtextur je Profil, physische Kantenlänge (m) für die Welt-UVs, Metall ja/nein
export const MATERIALS = {
  WoodFloor052: { size: { desktop: 2048, mobile: 1024 }, meters: 1.6, use: 'Fischgrätparkett' },
  Wood066: { size: { desktop: 2048, mobile: 1024 }, meters: 1.2, use: 'Pultbänke, Tische' },
  Wood060: { size: { desktop: 1024, mobile: 512 }, meters: 1.5, use: 'Vertäfelung' },
  Plaster001: { size: { desktop: 1024, mobile: 512 }, meters: 2.0, use: 'Wände' },
  Plaster002: { size: { desktop: 1024, mobile: 512 }, meters: 2.5, use: 'Decke' },
  Fabric030: { size: { desktop: 1024, mobile: 512 }, meters: 0.6, use: 'Rollos' },
  Fabric066: { size: { desktop: 1024, mobile: 512 }, meters: 0.5, use: 'Stoffe' },
  Metal032: { size: { desktop: 1024, mobile: 512 }, meters: 1.0, metal: true, use: 'Aluminium' },
  Metal048A: { size: { desktop: 512, mobile: 256 }, meters: 0.5, metal: true, use: 'Messing' },
  Metal055A: { size: { desktop: 512, mobile: 256 }, meters: 1.0, metal: true, use: 'Stahl' },
  Leather030: { size: { desktop: 512, mobile: 256 }, meters: 0.5, use: 'Leder braun' },
  Leather026: { size: { desktop: 512, mobile: 256 }, meters: 0.5, use: 'Leder schwarz' },
  Marble021: { size: { desktop: 1024, mobile: 512 }, meters: 1.0, use: 'Fensterbank' },
  Asphalt031: { size: { desktop: 1024, mobile: 512 }, meters: 4.0, use: 'Straße' },
  PavingStones128: { size: { desktop: 1024, mobile: 512 }, meters: 2.0, use: 'Gehsteig' },
  PavingStones150: { size: { desktop: 1024, mobile: 512 }, meters: 2.0, use: 'Kopfsteinpflaster' },
  Grass001: { size: { desktop: 1024, mobile: 512 }, meters: 3.0, use: 'Wiese' }
};

const src = path.join(root, 'assets/src/ambientcg'), tmp = path.join(root, 'tools/.cache/ambientcg');
const out = path.join(root, 'assets/build', profile, 'textures'); fs.mkdirSync(out, { recursive: true });
const decode = async buf => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const enc = (png, o) => encodeToKTX2(new Uint8Array(png), { generateMipmap: true, qualityLevel: 160, compressionLevel: 2, needSupercompression: true, imageDecoder: decode, isKTX2File: true, ...o });
const quiet = async fn => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

const manifest = fs.existsSync(path.join(root, 'assets/build', profile, 'textures.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'assets/build', profile, 'textures.json'), 'utf8')) : {};
for (const [id, m] of Object.entries(MATERIALS)) {
  if (only && !only.includes(id)) continue;
  const zip = path.join(src, `${id}_2K-JPG.zip`); if (!fs.existsSync(zip)) { console.log(`✗ ${id}: Quelle fehlt (npm run assets:fetch)`); continue; }
  const dir = path.join(tmp, id); fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  const f = s => { const p = path.join(dir, `${id}_2K-JPG_${s}.jpg`); return fs.existsSync(p) ? p : null; };
  const size = m.size[profile] || m.size.desktop, nsize = Math.max(256, size / 2);
  const t0 = Date.now();
  // Farbe
  const color = await sharp(f('Color')).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer();
  const colorK = await quiet(() => enc(color, { isUASTC: false, isSetKTX2SRGBTransferFunc: true }));
  // Normalen (OpenGL-Konvention = three.js)
  const normal = await sharp(f('NormalGL')).resize(nsize, nsize, { kernel: 'lanczos3' }).png().toBuffer();
  const normalK = await quiet(() => enc(normal, { isUASTC: true, isNormalMap: true, isSetKTX2SRGBTransferFunc: false }));
  // ORM packen
  const ch = async (p, fill) => p ? (await sharp(p).resize(nsize, nsize).greyscale().raw().toBuffer()) : Buffer.alloc(nsize * nsize, fill);
  const ao = await ch(f('AmbientOcclusion'), 255), rough = await ch(f('Roughness'), 200), metal = await ch(f('Metalness'), m.metal ? 255 : 0);
  const orm = Buffer.alloc(nsize * nsize * 3); for (let i = 0; i < nsize * nsize; i++) { orm[i * 3] = ao[i]; orm[i * 3 + 1] = rough[i]; orm[i * 3 + 2] = metal[i]; }
  const ormPng = await sharp(orm, { raw: { width: nsize, height: nsize, channels: 3 } }).png().toBuffer();
  const ormK = await quiet(() => enc(ormPng, { isUASTC: false, isSetKTX2SRGBTransferFunc: false }));
  for (const [k, b] of [['color', colorK], ['normal', normalK], ['orm', ormK]]) fs.writeFileSync(path.join(out, `${id}_${k}.ktx2`), b);
  // mittlere Farbe (sRGB 0–1): das Spiel färbt damit auf den gewünschten Ton um (Materialfarbe = Wunsch / Mittel)
  const st = await sharp(color).stats(); const avg = st.channels.slice(0, 3).map(c => +(c.mean / 255).toFixed(4));
  manifest[id] = { meters: m.meters, metal: !!m.metal, use: m.use, size, nsize, avg, bytes: colorK.length + normalK.length + ormK.length, license: 'CC0-1.0', source: `https://ambientcg.com/view?id=${id}` };
  console.log(`✓ ${id}  ${size}/${nsize} px  ${(manifest[id].bytes / 1024).toFixed(0)} KB  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  fs.writeFileSync(path.join(root, 'assets/build', profile, 'textures.json'), JSON.stringify(manifest, null, 1));
}
