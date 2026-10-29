// Prüfansicht der Rocketbox-Figuren im Spielmaßstab (Pultbank: Sitz 45 cm, Pult 76 cm) mit Clip-Steuerung (ClipCharacter).
//   node tools/peopleview.mjs <figur:modus[:sekunden],…> [desktop|mobile] [ausgabe]
// Modi: listen, type, work, sleep, calm, relaxed (sitzend), handup, phone, coffee (IK), stand, talk, walk (stehend), face (Gesicht),
//       once=<clip> (Einzelclip im Sitzen). Ausgabe: <figur>_<modus>_{side,front,face}.png
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const specs = process.argv[2].split(','), profile = process.argv[3] || 'desktop';
const out = path.resolve(process.argv[4] || path.join(root, 'tools/.cache/peopleview')); fs.mkdirSync(out, { recursive: true });
const hd = path.join(root, 'assets/build', profile, 'people');
const files = {}; for (const f of fs.readdirSync(hd)) if (/\.(hpk|ktx2|bin\.gz)$/.test(f)) files[f] = fs.readFileSync(path.join(hd, f)).toString('base64');
const basis = path.join(root, 'node_modules/three/examples/jsm/libs/basis');
const block = JSON.stringify({ index: JSON.parse(fs.readFileSync(path.join(hd, 'index.json'), 'utf8')), files, basis: { js: fs.readFileSync(path.join(basis, 'basis_transcoder.js')).toString('base64'), wasm: fs.readFileSync(path.join(basis, 'basis_transcoder.wasm')).toString('base64') } });
const js = (await build({ entryPoints: [path.join(root, 'tools/peopleview/view.js')], bundle: true, format: 'iife', write: false, logLevel: 'error' })).outputFiles[0].text;
const html = path.join(out, 'view.html');
fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="text/plain" id="assets-humans">${block}</script><script>${js}</script>`);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.text().slice(0, 300)); });
await page.goto('file://' + html);
const shots = await page.evaluate(s => window.run(s), specs);
for (const [k, v] of Object.entries(shots)) { if (k.startsWith('__')) { console.log(k, v); continue; } fs.writeFileSync(path.join(out, k.replace(/[^\w.-]+/g, '_') + '.png'), Buffer.from(v.split(',')[1], 'base64')); }
console.log('✓', Object.keys(shots).filter(k => !k.startsWith('__')).length, 'Bilder →', out);
await browser.close();
