// Prüf- und Dokubilder: mehrere Ansichten in einer Sitzung: je Ansicht rendern, ins 2D-Blatt kopieren, am Ende einmal auslesen.
// node tools/sheet.mjs <out.jpg> <q> <w> <h> <views.json>   (WEATHER=rain für anderes Wetter, SHOT_LANG=de für deutsche Oberfläche; Ansichten in tools/shots/)   views: [{ pre: "js (g, W) → void", steps: 0, cam: "js → [x,y,z,tx,ty,tz,fov]" }]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, q = 'low', w = 640, h = 400, viewsFile] = process.argv.slice(2);
const views = JSON.parse(fs.readFileSync(viewsFile, 'utf8'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('pageerror', e => console.log('pageerror', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
// SHOT_LANG=de|en: Sprache der Oberfläche (sonst Browsersprache, headless meist Englisch)
if (process.env.SHOT_LANG) await page.addInitScript(l => { try { localStorage.setItem('boku-ttt-v2:lang', JSON.stringify(l)); localStorage.setItem('boku-ttt-v3:lang', JSON.stringify(l)); } catch (e) { /* egal */ } }, process.env.SHOT_LANG);
await page.goto('file:///home/user/spiel/dist/BOKU_TicTacTierernaehrung_v3.html?q=' + q);
await page.waitForFunction(() => window.__state && window.__world && window.__state() === 'menu', null, { timeout: 300000, polling: 500 });
const weather = process.env.WEATHER || null;
await page.evaluate(w => { window.__hold = true; if (w) window.__ui.cfg.weather = w; window.__ui.hooks.start(window.__ui.cfg); }, weather);
// anderes Wetter → die Seite lädt neu und startet die Vorlesung selbst
// nach dem Neuladen wartet das Spiel am Eingang („Vorlesung betreten“, Klick für Ton/Zeiger) – hier per Haken betreten
await page.waitForFunction(() => window.__state && ['gate', 'game'].includes(window.__state()), null, { timeout: 600000, polling: 500 });
if (await page.evaluate(() => window.__state() === 'gate')) await page.evaluate(() => { window.__hold = true; window.__ui.hooks.gate(); });
await page.waitForFunction(() => window.__state && window.__state() === 'game', null, { timeout: 300000, polling: 500 });
await page.evaluate(() => { window.__hold = true; });
const cols = Math.min(3, views.length), rows = Math.ceil(views.length / cols);
await page.evaluate(([cols, rows, W, H]) => { const c = document.createElement('canvas'); c.width = cols * W; c.height = rows * H; window.__sheet = c; window.__sheetCtx = c.getContext('2d'); }, [cols, rows, +w, +h]);
for (let i = 0; i < views.length; i++) {
  const v = views[i];
  const info = await page.evaluate(([v, i, cols, W, H]) => {
    const g = window.__game(), Wd = window.__world;
    if (v.pre) (new Function('g', 'W', v.pre))(g, Wd);
    if (v.steps) window.__step(v.steps);
    if (v.until) { let n = 0; const cond = new Function('g', 'return (' + v.until + ')'); while (!cond(g) && n++ < 20 * (v.max || 600)) window.__step(0.05); }
    const cam = v.cam ? (new Function('g', 'W', 'return (' + v.cam + ')'))(g, Wd) : null;
    if (!cam && g.player && g.player.update) { /* Ich-Sicht: Kamera kommt aus PlayerView (letzter Schritt) */ }
    const gfx = window.__gfx;
    if (cam) { gfx.camera.position.set(cam[0], cam[1], cam[2]); gfx.camera.lookAt(cam[3], cam[4], cam[5]); if (cam[6]) { gfx.camera.fov = cam[6]; gfx.camera.updateProjectionMatrix(); } }
    gfx.render(0.016); if (g.renderPiP) g.renderPiP();
    window.__sheetCtx.drawImage(gfx.renderer.domElement, (i % cols) * W, Math.floor(i / cols) * H, W, H);
    window.__sheetCtx.fillStyle = '#fff'; window.__sheetCtx.font = '14px sans-serif'; window.__sheetCtx.fillText(v.label || String(i), (i % cols) * W + 6, Math.floor(i / cols) * H + 16);
    return { t: g.session.t.toFixed(1), act: g.session.prof.activity, label: v.label, dbg: window.__dbg || '' };
  }, [v, i, cols, +w, +h]);
  console.log('Ansicht', i, JSON.stringify(info));
}
const d = await page.evaluate(() => window.__sheet.toDataURL('image/jpeg', 0.88));
fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
console.log('✓', out);
await browser.close();
