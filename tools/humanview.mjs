// Testansicht echter Figuren: node tools/humanview.mjs <figur.glb> [ausgabeordner]
// Bündelt tools/humanview/entry.js, lädt das GLB (+ .meta.json) in Chromium (CPU-Renderer) und speichert PNG-Ansichten.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const glb = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3] || path.join(path.dirname(glb), 'view'));
fs.mkdirSync(out, { recursive: true });
const meta = JSON.parse(fs.readFileSync(glb.replace(/\.glb$/, '.meta.json'), 'utf8'));
const js = (await build({ entryPoints: [path.join(root, 'tools/humanview/entry.js')], bundle: true, format: 'iife', write: false, logLevel: 'error' })).outputFiles[0].text;
const html = path.join(out, 'index.html');
fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0"><script>${js}</script>`);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
await page.goto('file://' + html);
const r = await page.evaluate(([b, m]) => window.run(b, m), [fs.readFileSync(glb).toString('base64'), meta]);
for (const [k, v] of Object.entries(r.shots)) fs.writeFileSync(path.join(out, `${meta.id}_${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
console.log(r.cent, r.nodes); console.log(meta.id, 'Vertices', r.verts, 'Gruppen', r.groups, r.kinds.join(','), '→', out);
await browser.close();
