// Prüfansicht für Figuren-GLBs: node tools/glbview.mjs <figur.glb> <views.json> <ausgabe-ordner> [clips.glb]
// views.json: { "views": [{ "name": "sit", "clip": "Sitting_Idle", "t": 1.2, "cam": [x,y,z,tx,ty,tz,fov] }], "chair": true, "scale": 1 }
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [glbPath, viewsPath, outDir, clipsPath] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const opts = JSON.parse(fs.readFileSync(viewsPath, 'utf8'));
const js = (await build({ entryPoints: [path.join(root, 'tools/glbview/view.js')], bundle: true, format: 'iife', write: false, logLevel: 'error' })).outputFiles[0].text;
const html = path.join(outDir, 'view.html');
fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="text/plain" id="glb">${fs.readFileSync(glbPath).toString('base64')}</script>${clipsPath ? `<script type="text/plain" id="clips">${fs.readFileSync(clipsPath).toString('base64')}</script>` : ''}<script>${js}</script>`);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: opts.w || 900, height: opts.h || 900 } });
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
await page.goto('file://' + html);
const r = await page.evaluate(o => window.run(o), { ...opts, clipsGlb: !!clipsPath });
console.log('Clips:', r.clips.join(' | '));
for (const [k, v] of Object.entries(r.shots)) fs.writeFileSync(path.join(outDir, k.replace(/[^\w.-]+/g, '_') + '.png'), Buffer.from(v.split(',')[1], 'base64'));
console.log('✓', Object.keys(r.shots).length, 'Bilder →', outDir);
await browser.close();
