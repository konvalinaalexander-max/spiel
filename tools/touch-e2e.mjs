// Touch-Durchlauf auf dem Mobil-Build (Auftrag V3, Phase 7): echte Touch-Eingaben (CDP) im emulierten Handy, Querformat.
// Start → „Zur Lehrveranstaltung“ → „Vorlesung betreten“ → Laptop (Taste) → Feld setzen (Tipp aufs Spielfeld) → Mitschreiben
// (Taste halten) → Prüfungsfrage (Antwort antippen) → Ende (Zeugnis). Bericht: docs/touch-e2e.json
//   node tools/touch-e2e.mjs [--port 8765]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = +(process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : 8765);
const srv = spawn('python3', ['-I', '-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.join(root, 'dist/mobile'), stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const steps = [], errors = [];
const log = (name, ok, info = '') => { steps.push({ name, ok, info }); console.log(ok ? '✓' : '✗', name, info); };
let browser;
try {
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const dev = devices['Pixel 7'];
  const ctx = await browser.newContext({ ...dev, viewport: { width: dev.viewport.height * 2, height: dev.viewport.width }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/GPU stall|GL Driver|ReadPixels/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror ' + e.message));
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tap = async (x, y, hold = 0) => { await touch('touchStart', x, y); if (hold) await page.waitForTimeout(hold); await touch('touchEnd', x, y); await page.waitForTimeout(150); };
  const tapSel = async (sel, hold = 0) => { const b = await page.locator(sel).first().boundingBox(); if (!b) throw new Error('nicht sichtbar: ' + sel); await tap(b.x + b.width / 2, b.y + b.height / 2, hold); };
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?q=low`);
  await page.waitForFunction(() => window.__state && window.__state() === 'menu', null, { timeout: 300000, polling: 250 });
  log('Startseite', true, `${((Date.now() - t0) / 1000).toFixed(1)} s bis bereit`);
  await tapSel('[data-go="lv"]'); await page.waitForTimeout(400);
  log('LV-Seite per Tipp', await page.evaluate(() => !document.querySelector('#scr-lv')?.hidden));
  await tapSel('#lv-start');
  await page.waitForFunction(() => window.__state() === 'game' || !document.querySelector('#scr-gate')?.hidden, null, { timeout: 300000, polling: 250 });
  if (await page.evaluate(() => window.__state() !== 'game')) await tapSel('#gate-go');
  await page.waitForFunction(() => window.__state() === 'game', null, { timeout: 120000 });
  await page.evaluate(() => { window.__hold = true; window.__step(2); });
  log('Vorlesung betreten', true);
  const bar = await page.evaluate(() => { const b = document.querySelector('[data-act="toggleLaptop"]'); return b && b.offsetParent !== null; });
  log('Tastenleiste sichtbar', bar);
  await tapSel('[data-act="toggleLaptop"]'); await page.evaluate(() => window.__step(1.5));
  log('Laptop per Taste', await page.evaluate(() => window.__game().session.player.mode === 'laptop'));
  // Feld setzen: Bildschirmposition der Mittelzelle über den Laptop-Bildschirm berechnen und antippen
  await page.evaluate(() => { const g = window.__game(); g.os.render?.(); window.__gfx.render(0.016); });
  const pt = await page.evaluate(() => {
    const g = window.__game(), os = g.os, W = os.canvas.width / os.scale, H = os.canvas.height / os.scale;
    const free = [4, 0, 2, 6, 8, 1, 3, 5, 7].find(i => g.session.ttt.canPlay(i));
    const r = os.regions.find(x => x.id === 'cell:' + free); if (!r) return null;
    const p = window.__world.props.player.laptop.screenWorld((r.x + r.w / 2) / W, (r.y + r.h / 2) / H);
    p.project(window.__gfx.camera);
    return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, cell: free, before: g.session.ttt.board.filter(Boolean).length };
  });
  if (pt) { await tap(pt.x, pt.y); await page.evaluate(() => window.__step(0.3)); }
  const placed = pt && await page.evaluate(n => window.__game().session.ttt.board.filter(Boolean).length > n, pt.before);
  log('Feld per Tipp gesetzt', !!placed, pt ? `Zelle ${pt.cell}` : 'keine Zelle gefunden');
  await tapSel('[data-act="toggleLaptop"]'); await page.evaluate(() => window.__step(1.2));
  // Mitschreiben: Taste halten
  const nb = await page.locator('[data-act="notes"]').first().boundingBox();
  await touch('touchStart', nb.x + nb.width / 2, nb.y + nb.height / 2); await page.waitForTimeout(300);
  await page.evaluate(() => window.__step(2));
  const notes = await page.evaluate(() => window.__game().session.player.mode === 'notes');
  await touch('touchEnd', 0, 0); await page.evaluate(() => window.__step(1));
  log('Mitschreiben (halten)', notes);
  // Prüfungsfrage abwarten und Antwort antippen
  await page.evaluate(() => { const g = window.__game(); let n = 0; while (!g.session.quiz && !g.ended && n++ < 20 * 900) window.__step(0.05); });
  const hasQuiz = await page.evaluate(() => !!window.__game().session.quiz);
  if (hasQuiz) { await page.waitForTimeout(300); await tapSel('.quiz-btn'); await page.evaluate(() => window.__step(1)); }
  const answered = hasQuiz && await page.evaluate(() => { const q = window.__game().session.quiz; return !q || q.answered; });
  log('Prüfungsfrage per Tipp beantwortet', !!answered, hasQuiz ? '' : 'keine Frage gestellt');
  // bis zum Ende
  await page.evaluate(() => { const g = window.__game(); let n = 0; while (!g.ended && n++ < 20 * 3600) { if (g.session.quiz && !g.session.quiz.answered) g.session.answerQuiz(0); window.__step(0.05); } });
  await page.waitForTimeout(800);
  const ended = await page.evaluate(() => window.__game()?.ended || window.__state() === 'result');
  log('Vorlesung beendet, Zeugnis', !!ended);
  log('0 Konsolenfehler', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) { log('Ablauf', false, e.message); }
if (browser) await browser.close();
srv.kill();
fs.writeFileSync(path.join(root, 'docs/touch-e2e.json'), JSON.stringify({ device: 'Pixel 7 (emuliert, Querformat)', steps, errors }, null, 1));
const ok = steps.length && steps.every(s => s.ok);
console.log(ok ? '✓ Touch-Durchlauf bestanden' : '✗ Touch-Durchlauf mit Fehlern');
process.exit(ok ? 0 : 1);
