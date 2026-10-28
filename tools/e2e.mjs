// Headless-Durchlauf im echten Build (Chromium + SwiftShader): Ladebildschirm → Startseite → LV-Seite → Spiel.
// node tools/e2e.mjs [--q low] [--out docs/screenshots/e2e] [--steps "listen,laptop,board"] [--sim 120]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = path.resolve(root, args.out || 'docs/screenshots/e2e');
fs.mkdirSync(outDir, { recursive: true });
const w = +(args.w || 1280), h = +(args.h || 720);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
const qs = new URLSearchParams({ q: args.q || 'low', ...(args.lang ? {} : {}) });
if (args.query) for (const kv of String(args.query).split('&')) { const [k, v] = kv.split('='); qs.set(k, v ?? ''); }
const t0 = Date.now();
const lap = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
await page.addInitScript(l => { try { if (l) localStorage.setItem('boku-ttt-v2:lang', JSON.stringify(l)); } catch (e) {} }, args.lang || null);
await page.goto('file://' + path.join(root, 'dist/BOKU_TicTacTierernaehrung_v2.html') + '?' + qs);
const shotCanvas = async (name, cam) => { const d = await page.evaluate(c => window.__render(c), cam || null); fs.writeFileSync(path.join(outDir, name + '.jpg'), Buffer.from(d.split(',')[1], 'base64')); lap('canvas ' + name); };
const shotPage = async name => { await page.evaluate(() => { window.__hold = true; window.__render(); }); await page.screenshot({ path: path.join(outDir, name + '.jpg'), type: 'jpeg', quality: 85, timeout: 180000 }); lap('page ' + name); };
try {
  if (args.loading) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(outDir, 'loading.png'), timeout: 180000 }); lap('loading'); }
  await page.waitForFunction(() => window.__state && window.__world && window.__state() === 'menu', null, { timeout: 300000, polling: 500 });
  lap('menu ready');
  const steps = String(args.steps || 'start,lv,game,listen,laptop').split(',');
  for (const st of steps) {
    if (st === 'start') { await shotPage('start'); await page.evaluate(() => { window.__hold = false; }); }
    else if (st === 'lv') { await page.evaluate(() => window.__ui.show('lv')); await shotPage('lv'); await page.evaluate(() => { window.__hold = false; }); }
    else if (st === 'settings') { await page.evaluate(() => window.__ui.show('settings')); await shotPage('settings'); await page.evaluate(() => { window.__hold = false; }); }
    else if (st === 'help') { await page.evaluate(() => window.__ui.show('help')); await shotPage('help'); await page.evaluate(() => { window.__hold = false; }); }
    else if (st === 'game') { await page.evaluate(() => { window.__hold = true; window.__ui.hooks.start(window.__ui.cfg); }); lap('game started: ' + await page.evaluate(() => window.__state())); }
    else if (st.startsWith('sim')) { const sec = +(st.slice(3) || args.sim || 60); const tt = await page.evaluate(s => window.__step(s), sec); lap(`sim +${sec}s → t=${tt.toFixed(1)}`); }
    else if (st === 'listen') { await page.evaluate(() => window.__step(0.5)); await shotCanvas('listen'); await shotPage('listen_hud'); }
    else if (st === 'laptop') { await page.evaluate(() => { window.__game().session.setMode('laptop'); window.__step(1.2); }); await shotCanvas('laptop'); await shotPage('laptop_hud'); await page.evaluate(() => { window.__game().session.setMode('listen'); window.__step(0.6); }); }
    else if (st === 'notes') { await page.evaluate(() => { window.__game().input.down.add('KeyN'); window.__step(6); }); await shotCanvas('notes'); await page.evaluate(() => { window.__game().input.down.delete('KeyN'); window.__step(0.6); }); }
    else if (st.startsWith('look:')) { const [, yaw, pitch, name] = st.split(':'); const r = await page.evaluate(([y, p]) => { const pv = window.__game().player; pv.yaw = +y; pv.pitch = +p; window.__step(0.6); return [pv.yaw, pv.camDir.x, pv.camDir.z].map(v => v.toFixed(2)).join(' '); }, [yaw, pitch]); lap('look ' + r); await shotCanvas(name || 'look'); }
    else if (st.startsWith('cfg:')) { const [k, v] = st.slice(4).split('='); await page.evaluate(([k, v]) => { window.__ui.cfg[k] = isNaN(+v) ? v : +v; }, [k, v]); }
    else if (st.startsWith('until:')) { const [, what, max] = st.split(':'); const r = await page.evaluate(([w, m]) => { const g = window.__game(); let n = 0; const cond = () => w === 'quiz' ? !!g.session.quiz : w === 'caught' ? !!g.session.caughtSeq : w === 'end' ? g.ended : w === 'write' ? g.session.prof.activity === 'write' : w === 'break' ? g.session.director.phase === 'break' : false; while (!cond() && n++ < (+m || 900) * 20) window.__step(0.05); return [g.session.t.toFixed(1), cond()]; }, [what, max]); lap(`until ${what}: t=${r[0]} ok=${r[1]}`); }
    else if (st.startsWith('page:')) { await shotPage(st.slice(5)); await page.evaluate(() => { window.__hold = true; }); }
    else if (st.startsWith('canvas:')) { await shotCanvas(st.slice(7)); }
    else if (st.startsWith('cam:')) { const p = st.split(':'); await shotCanvas(p[1], p[2].split('/').map(Number)); }
    else if (st.startsWith('wait:')) { await page.waitForTimeout(+st.slice(5)); }
    else if (st === 'audiotest') { const r = await page.evaluate(() => ({ loops: window.__loopTest(), sounds: window.__soundList() })); fs.writeFileSync(path.join(outDir, 'audiotest.json'), JSON.stringify(r, null, 1)); lap('audiotest: ' + Object.keys(r.loops).length + ' Loops, ' + r.sounds.length + ' Klänge'); }
    else if (st === 'state') { console.log(await page.evaluate(() => { const g = window.__game(), S = g.session; return JSON.stringify({ t: S.t.toFixed(1), phase: S.director.phase, prof: S.prof.activity, face: S.prof.face.mode, pos: [S.prof.pos.x.toFixed(2), S.prof.pos.z.toFixed(2)], wins: S.ttt.stats.wins, susp: [S.susp.attention | 0, S.susp.suspicion | 0, S.susp.evidence | 0], stats: window.__gfx.stats() }); })); }
  }
} catch (e) { console.log('FEHLER:', e.message); }
const filtered = logs.filter(l => !/GPU stall|GL Driver Message|ReadPixels|Automatic fallback to software WebGL/.test(l));
console.log(filtered.slice(0, 40).join('\n') || '(keine Fehler/Warnungen)');
await browser.close();
