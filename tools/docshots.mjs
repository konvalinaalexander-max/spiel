// Erzeugt die Dokumentations-Screenshots (Phase 7: alle Screens DE/EN in drei Auflösungen).
// node tools/docshots.mjs [--q low] [--langs de,en] [--sizes 1920x1080,1366x768,1024x768] [--screens start,lv,...]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'docs/screenshots/ui');
fs.mkdirSync(out, { recursive: true });
const langs = String(args.langs || 'de,en').split(',');
const sizes = String(args.sizes || '1920x1080,1366x768,1024x768').split(',').map(s => s.split('x').map(Number));
const screens = String(args.screens || 'loading,start,lv,settings,help,achievements,leaderboard,game,quiz,pause,result').split(',');
const t0 = Date.now(); const lap = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
for (const lang of langs) for (const [w, h] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', e => errors.push(`${lang} ${w}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`${lang} ${w}: ${m.text()}`); });
  await page.addInitScript(l => { try { localStorage.setItem('boku-ttt-v2:lang', JSON.stringify(l)); } catch (e) { /* egal */ } }, lang);
  await page.goto('file://' + path.join(root, 'dist/BOKU_TicTacTierernaehrung_v2.html') + `?q=${args.q || 'low'}&bot=0.6`);
  const tag = `${lang}_${w}x${h}`;
  const shot = async name => { await page.screenshot({ path: path.join(out, `${name}_${tag}.jpg`), type: 'jpeg', quality: 82, timeout: 180000 }); lap(`${name}_${tag}`); };
  if (screens.includes('loading')) { await page.waitForTimeout(900); await page.evaluate(() => window.__ui && window.__ui.show('loading')); await shot('loading'); }
  await page.waitForFunction(() => window.__world && window.__state && window.__state() === 'menu', null, { timeout: 300000, polling: 500 });
  // ein paar Bilder der Kamerafahrt, dann Rendering anhalten (das letzte Bild bleibt stehen)
  await page.evaluate(() => { window.__render(); window.__hold = true; });
  for (const s of ['start', 'lv', 'settings', 'help', 'achievements', 'leaderboard']) if (screens.includes(s)) { await page.evaluate(n => window.__ui.show(n), s); await page.waitForTimeout(150); await shot(s); }
  if (screens.includes('game') || screens.includes('quiz') || screens.includes('pause') || screens.includes('result')) {
    await page.evaluate(() => { window.__ui.cfg.length = 'short'; window.__ui.hooks.start(window.__ui.cfg); });
    await page.waitForFunction(() => window.__state() === 'game', null, { timeout: 120000 });
    await page.evaluate(() => { window.__step(40); window.__render(); });
    if (screens.includes('game')) await shot('game');
    if (screens.includes('quiz')) {
      await page.evaluate(() => { const g = window.__game(); let n = 0; while (!g.session.quiz && n++ < 12000) window.__step(0.05); window.__step(0.5); window.__render(); });
      await shot('quiz');
    }
    if (screens.includes('pause')) { await page.evaluate(() => { const g = window.__game(); g.hooks.pause(); }); await page.waitForTimeout(200); await shot('pause'); await page.evaluate(() => window.__ui.hooks.resume()); }
    if (screens.includes('result')) {
      await page.evaluate(() => { const g = window.__game(); let n = 0; while (!g.ended && n++ < 20000) window.__step(0.05); });
      await page.waitForFunction(() => window.__state() === 'result', null, { timeout: 60000 });
      await page.waitForTimeout(300); await shot('result');
    }
  }
  await page.close();
}
console.log(errors.length ? errors.slice(0, 20).join('\n') : '(keine Fehler)');
await browser.close();
