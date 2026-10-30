// Leistungstabelle je Qualitätsstufe (Auftrag V3, Phase 8): Draw Calls und Dreiecke eines Bildes (alle Durchgänge inkl. Schatten
// und Nachbearbeitung), Geometrien, Texturen, Shader-Programme, Ladezeit, Bildzeit im Software-Renderer (nur relativ).
//   node tools/perf-table.mjs [--presets low,medium,high,ultra] [--url <Mobil-URL>] [--out docs/perf_v3.json]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const presets = String(args.presets || 'low,medium,high,ultra').split(',');
const base = args.url || 'file://' + path.join(root, DIST);
const rows = [];
for (const q of presets) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const t0 = Date.now();
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'q=' + q);
  await page.waitForFunction(() => window.__state && window.__world && window.__state() === 'menu', null, { timeout: 300000, polling: 250 });
  const loadS = (Date.now() - t0) / 1000;
  await page.evaluate(() => { window.__hold = true; window.__ui.hooks.start(window.__ui.cfg); });
  await page.evaluate(() => window.__step(3));
  const frame = () => page.evaluate(() => {
    const R = window.__gfx.renderer, info = R.info, ar = info.autoReset; info.autoReset = false; info.reset();
    window.__gfx.render(0.016); const g = window.__game(); if (g.renderPiP) g.renderPiP();
    const r = { calls: info.render.calls, triangles: info.render.triangles }; info.autoReset = ar; return r;
  });
  const listen = await frame();
  await page.evaluate(() => { window.__game().session.setMode('laptop'); window.__step(1.5); });
  const laptop = await frame();
  const perf = await page.evaluate(() => window.__perf(5));
  const mem = await page.evaluate(() => { const m = window.__gfx.renderer.info.memory, p = window.__gfx.renderer.info.programs; return { geometries: m.geometries, textures: m.textures, programs: p ? p.length : 0, heapMB: +((performance.memory?.usedJSHeapSize || 0) / 1048576).toFixed(0) }; });
  const row = { preset: q, loadS: +loadS.toFixed(1), listen, laptop, msSwiftShader: perf.ms, ...mem };
  rows.push(row); console.log(JSON.stringify(row));
  await browser.close();
}
fs.writeFileSync(path.join(root, args.out || 'docs/perf_v3.json'), JSON.stringify(rows, null, 1));
console.log('| Stufe | Draw Calls (Zuhören / Laptop) | Dreiecke (Zuhören) | Geometrien | Texturen | Shader | Ladezeit | Bildzeit SwiftShader* |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.preset} | ${r.listen.calls} / ${r.laptop.calls} | ${(r.listen.triangles / 1e6).toFixed(2)} Mio. | ${r.geometries} | ${r.textures} | ${r.programs} | ${r.loadS} s | ${r.msSwiftShader} ms |`);
