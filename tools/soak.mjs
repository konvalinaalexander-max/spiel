// Dauerlauf (Auftrag V3, Phase 8): N Vorlesungen hintereinander im selben Tab, gespielt vom Test-Bot (?bot), mit Ladezeit,
// Speicher (JS-Heap, GPU-Ressourcen) und Konsolenfehlern je Vorlesung.
//   node tools/soak.mjs [--runs 10] [--q low] [--length short] [--out docs/soak.json]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const runs = +(args.runs || 10), q = args.q || 'low', length = args.length || 'short';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
let errors = [];
page.on('console', m => { if (m.type() === 'error' && !/GPU stall|GL Driver|ReadPixels/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('pageerror ' + e.message));
const url = 'file://' + path.join(root, DIST) + `?q=${q}&bot=0.6`;
const rows = [];
for (let i = 0; i < runs; i++) {
  errors = [];
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__state && window.__world && window.__state() === 'menu', null, { timeout: 300000, polling: 250 });
  const loadS = (Date.now() - t0) / 1000;
  const heap = () => page.evaluate(() => { if (window.gc) window.gc(); const m = performance.memory || {}; const r = window.__gfx.renderer.info.memory; return { heapMB: +((m.usedJSHeapSize || 0) / 1048576).toFixed(1), geometries: r.geometries, textures: r.textures }; });
  const h0 = await heap();
  await page.evaluate(([len, seed]) => { window.__hold = true; const cfg = { ...window.__ui.cfg, length: len, seed }; window.__ui.cfg.length = len; window.__ui.hooks.start(cfg); }, [length, 100 + i]);
  // Vorlesung durchlaufen: Logik in Schritten, alle 20 s Spielzeit ein Bild rendern
  const res = await page.evaluate(async () => {
    const g = window.__game(); const t0 = performance.now(); let frames = 0, mid = null;
    while (!g.ended && g.session.t < 3600) {
      window.__step(20, 0.05); window.__gfx.render(0.016); frames++;
      if (!mid && g.session.t > g.session.seconds / 2) { const m = performance.memory || {}; mid = +((m.usedJSHeapSize || 0) / 1048576).toFixed(1); }
      await new Promise(r => setTimeout(r, 0));
    }
    const r = g.session.result || {};
    return { ended: !!g.ended, simS: +g.session.t.toFixed(0), wallS: +((performance.now() - t0) / 1000).toFixed(0), frames, midHeapMB: mid, success: r.success, grade: r.grade, reason: r.reason, wins: r.wins };
  });
  const h1 = await heap();
  rows.push({ run: i + 1, loadS: +loadS.toFixed(1), start: h0, ...res, end: h1, errors: errors.slice(0, 5), errorCount: errors.length });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
await browser.close();
const out = args.out || 'docs/soak.json';
fs.writeFileSync(path.join(root, out), JSON.stringify({ q, length, runs: rows }, null, 1));
const ok = rows.every(r => r.ended && r.errorCount === 0);
console.log(ok ? '✓ Dauerlauf ohne Fehler' : '✗ Dauerlauf mit Fehlern', '→', out);
process.exit(ok ? 0 : 1);
