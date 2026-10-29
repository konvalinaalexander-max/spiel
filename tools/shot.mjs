// Headless-Screenshot-Helfer.
// node tools/shot.mjs --out docs/screenshots/x.png [--q medium] [--w 1280 --h 800] [--wait 3000] [--eval "js"] [--query "a=b"]
import { createRequire } from 'node:module';
import { DIST } from './dist.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const file = 'file://' + path.join(root, DIST);
const w = +(args.w || 1280), h = +(args.h || 800);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
const q = [args.q ? 'q=' + args.q : '', args.query || ''].filter(Boolean).join('&');
await page.goto(file + (q ? '?' + q : ''));
await page.waitForTimeout(+(args.wait || 3000));
if (args.eval) { const r = await page.evaluate(args.eval); if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r)); }
if (args.wait2) await page.waitForTimeout(+args.wait2);
if (args.out && args.capture) {
  const data = await page.evaluate(n => window.__capture(n), +(args.frames || 3));
  (await import('node:fs')).writeFileSync(path.resolve(root, args.out), Buffer.from(data.split(',')[1], 'base64'));
} else if (args.out) await page.screenshot({ path: path.resolve(root, args.out), timeout: 120000 });
console.log(logs.filter(l => !/GPU stall|GL Driver Message|ReadPixels/.test(l)).slice(0, 30).join('\n') || '(keine Fehler/Warnungen)');
await browser.close();
