// Licht backen, Schritt 1 (Auftrag V3, Phase 3): statische Saalgeometrie aus dem echten Build exportieren.
//   node tools/lightmap-export.mjs            → assets/src/lightmap/scene.json + scene.bin
// Empfänger (bekommen eine Lightmap): die gebatchten Saal-Meshes („hall“) ohne Glas und Leuchtflächen, in Szenenreihenfolge –
// die Reihenfolge und Vertexzahl dienen zur Laufzeit als Fingerabdruck. Verdecker (werfen nur Schatten/Okklusion): Requisiten,
// Einbauten, Details. Dazu Lichtquellen: LED-Panels, Fenster, Sonnenrichtung, Tafelstrahler.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(root, 'assets/src/lightmap');
fs.mkdirSync(OUT, { recursive: true });

// Grundfarbe je Material (linear wird in Blender gerechnet): Tönung der echten Materialien bzw. Grundfarbe der prozeduralen
const ALBEDO = {
  plaster: '#ebe7de', ceilingPlaster: '#f3f1ec', benchWood: '#48311f', benchTop: '#4f3624', beadboard: '#5a3c28', paneling: '#583d29',
  parquet: '#b8915c', tableWood: '#7d583c', whitePaint: '#f7f6f1', darkGrey: '#36393d', whitePlastic: '#ecebe6', blackMatte: '#101113',
  alu: '#b9bec4', brass: '#b8955a', radiator: '#e9e6de', sillStone: '#d6d1c6', red: '#b5241c', bokuGreen: '#00aa5a', screenBlack: '#0a0b0d', bins: '#8a8d90'
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('file://' + path.join(root, DIST) + '?q=low&weather=sunny');
await page.waitForFunction(() => window.__state && window.__world && window.__state() === 'menu', null, { timeout: 300000, polling: 500 });
const data = await page.evaluate(() => {
  const W = window.__world, gfx = window.__gfx, scene = gfx.scene;
  scene.updateMatrixWorld(true);
  const enc = arr => { const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const geo = (m, world = true) => {
    const g = m.geometry, p = g.attributes.position, n = g.attributes.normal, e = m.matrixWorld.elements, nm = new Float32Array(9);
    // Normalenmatrix (3×3 aus der Weltmatrix, ohne Skalierungsfehler: alle statischen Meshes haben Einheitsmatrizen)
    const pos = new Float32Array(p.count * 3), nor = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; pos[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; pos[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (n) { const a = n.getX(i), b = n.getY(i), c = n.getZ(i); nor[i * 3] = e[0] * a + e[4] * b + e[8] * c; nor[i * 3 + 1] = e[1] * a + e[5] * b + e[9] * c; nor[i * 3 + 2] = e[2] * a + e[6] * b + e[10] * c; }
    }
    void nm; void world;
    const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: p.count }, (_, i) => i);
    return { pos: enc(pos), nor: enc(nor), idx: enc(idx), verts: p.count, tris: idx.length / 3 };
  };
  const receivers = [], occluders = [], names = {};
  let hallIndex = 0;
  scene.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    names[o.name] = (names[o.name] || 0) + 1;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (o.name === 'hall') {
      const i = hallIndex++;
      const emissive = mat.emissive && mat.emissiveIntensity > 0.5 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.3;
      if (mat.transparent || emissive) return;
      receivers.push({ index: i, material: mat.name || '', ...geo(o) });
    } else if (['props', 'details', 'fixtures', 'static', ''].includes(o.name) && !mat.transparent && !o.isSkinnedMesh && !o.isInstancedMesh) {
      if (o.geometry.attributes.position.count > 200000) return;
      // nur, was im Saal steht (Einbauten, Fensterrahmen, Heizkörper, Türen …), nicht Himmel und Außenwelt
      o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (bb.min.x < -6 || bb.max.x > 5.5 || bb.min.z < -7 || bb.max.z > 7 || bb.min.y < -1 || bb.max.y > 4.5) return;
      occluders.push({ name: o.name, material: mat.name || '', ...geo(o) });
    }
  });
  const LY = { ledPanels: W.hall.ledPanels, sunDir: gfx.sunDir.toArray() };
  return { receivers, occluders, names, light: LY, hallCount: hallIndex };
});
await browser.close();
// Binärdaten in eine Datei, JSON mit Offsets
const bins = []; let off = 0;
const put = b64 => { const b = Buffer.from(b64, 'base64'); bins.push(b); const r = [off, b.length]; off += b.length; return r; };
for (const list of [data.receivers, data.occluders]) for (const r of list) { r.pos = put(r.pos); r.nor = put(r.nor); r.idx = put(r.idx); r.albedo = ALBEDO[r.material] || '#8c8c8c'; }
fs.writeFileSync(path.join(OUT, 'scene.bin'), Buffer.concat(bins));
fs.writeFileSync(path.join(OUT, 'scene.json'), JSON.stringify({ hallCount: data.hallCount, receivers: data.receivers, occluders: data.occluders, light: data.light }, null, 1));
console.log('Mesh-Namen', JSON.stringify(data.names));
console.log(`Empfänger ${data.receivers.length} (${data.receivers.reduce((a, r) => a + r.tris, 0)} Dreiecke), Verdecker ${data.occluders.length} (${data.occluders.reduce((a, r) => a + r.tris, 0)} Dreiecke), ${(off / 1e6).toFixed(1)} MB`);
