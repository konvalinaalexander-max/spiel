// Dokumentations-Screenshots für Phase 2–4: Qualitätsstufen im Vergleich, Orbit-Ansichten (6 Winkel),
// Spielerperspektiven (3), 10-Bild-Sequenz Gehen/Schreiben/Umdrehen, Vergleich v1 ↔ v2.
// node tools/phaseshots.mjs [--only presets,orbit,player,seq,v1]
import { createRequire } from 'node:module';
import { DIST } from './dist.mjs';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return acc; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'docs/screenshots');
const only = String(args.only || 'presets,orbit,player,seq,v1').split(',');
const t0 = Date.now(); const lap = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const flags = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
const W = 1280, H = 720;
const save = (name, dataUrl) => { fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64')); lap(name); };
const perf = [];

async function openGame(browser, q, seed = 4242) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.addInitScript(() => { try { localStorage.setItem('boku-ttt-v2:lang', JSON.stringify('de')); } catch (e) { /* egal */ } });
  await page.goto('file://' + path.join(root, DIST) + `?q=${q}`);
  await page.waitForFunction(() => window.__world && window.__state && window.__state() === 'menu', null, { timeout: 600000, polling: 1000 });
  await page.evaluate(s => { window.__hold = true; window.__ui.cfg.seed = s; window.__ui.hooks.start({ ...window.__ui.cfg, seed: s }); }, seed);
  await page.waitForFunction(() => window.__state() === 'game', null, { timeout: 60000 });
  return page;
}
// feste Kameraposition: Sitzplatz Reihe 5, Platz 8, Blick auf Tafel und Leinwand
const SEAT_CAM = [1.1, 1.92, 0.75, -0.6, 1.75, -6, 60];

function writePerf() {
  if (!perf.length) return;
  fs.writeFileSync(path.join(root, 'docs/perf_presets.json'), JSON.stringify(perf, null, 1));
  // Tabelle in docs/PERFORMANCE.md zwischen den Markierungen ersetzen
  const names = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', ultra: 'Ultra' };
  const de = n => n.toLocaleString('de-AT');
  const rows = perf.map(p => `| ${names[p.preset] || p.preset} | ${p.view === 'seat' ? 'Sitzplatz' : 'Laptop'} | ${de(p.calls)} | ${de(p.triangles)} | ${p.geometries} | ${p.textures} | ${p.programs} | ${de(p.ms)} ms |`);
  const table = ['| Stufe | Blick | Draw Calls | Dreiecke | Geometrien | Texturen | Shader-Programme | Bildzeit SwiftShader* |', '|---|---|---|---|---|---|---|---|', ...rows,
    '', `\\* CPU-Rasterizer, nur relativ vergleichbar. Gemessen am ${new Date().toISOString().slice(0, 10)}.`].join('\n');
  const f = path.join(root, 'docs/PERFORMANCE.md');
  const md = fs.readFileSync(f, 'utf8').replace(/<!--PERF-TABLE-->[\s\S]*?<!--\/PERF-TABLE-->/, `<!--PERF-TABLE-->\n${table}\n<!--/PERF-TABLE-->`);
  fs.writeFileSync(f, md);
}

const browser = await chromium.launch({ args: flags });
if (only.includes('presets')) for (const q of ['low', 'medium', 'high', 'ultra']) {
  const page = await openGame(browser, q);
  await page.evaluate(() => { const g = window.__game(); let n = 0; while (g.session.prof.activity !== 'write' && n++ < 8000) window.__step(0.05); window.__step(6); });
  save(`phase2_preset_${q}.jpg`, await page.evaluate(c => window.__render(c), SEAT_CAM));
  const p = await page.evaluate(c => { window.__render(c); return window.__perf(4); }, SEAT_CAM);
  perf.push({ view: 'seat', ...p });
  await page.evaluate(() => { window.__game().session.setMode('laptop'); window.__step(1.2); });
  perf.push({ view: 'laptop', ...(await page.evaluate(() => window.__perf(4))) });
  await page.close();
}
writePerf(); // sofort sichern, falls ein späterer Teil abstürzt
if (only.includes('orbit') || only.includes('player') || only.includes('seq')) {
  let page = await openGame(browser, 'medium');
  if (only.includes('orbit')) {
    await page.evaluate(() => window.__step(30));
    const cams = {
      orbit1_front_left: [-4.1, 2.6, -5.2, 1.0, 1.2, 3.0, 62], orbit2_front_right: [4.2, 2.7, -5.4, -1.0, 1.1, 3.0, 62],
      orbit3_back_left: [-4.0, 3.4, 5.6, 1.0, 1.0, -5.0, 62], orbit4_back_right: [4.0, 3.4, 5.6, -1.2, 1.2, -5.0, 62],
      orbit5_window_side: [-4.2, 2.4, 0.5, 3.0, 1.3, -1.5, 66], orbit6_podium: [0.0, 1.85, -5.6, 0.0, 1.4, 4.0, 70]
    };
    // Einzelbilder aus diesen Totalen dauern im CPU-Rasterizer 30–45 s; stürzt die Seite dabei ab (GPU-Watchdog),
    // wird sie neu geöffnet und das Bild einmal wiederholt
    for (const [n, c] of Object.entries(cams)) {
      try { save(`phase3_${n}.jpg`, await page.evaluate(cc => window.__render(cc), c)); }
      catch (e) {
        lap(`${n}: ${e.message.split('\n')[0]} – neuer Versuch`);
        await page.close().catch(() => {}); page = await openGame(browser, 'medium'); await page.evaluate(() => window.__step(30));
        save(`phase3_${n}.jpg`, await page.evaluate(cc => window.__render(cc), c));
      }
    }
  }
  if (only.includes('player')) {
    await page.evaluate(() => { window.__step(150); window.__game().player.yaw = 0.2; window.__step(0.6); });
    save('phase3_player1_listen.jpg', await page.evaluate(() => window.__render()));
    // Heft vor dem Laptop: nach dem Laptop-Blick stellt der Prof oft eine Frage, währenddessen ist Mitschreiben gesperrt
    await page.evaluate(() => { const g = window.__game(); g.input.down.add('KeyN'); window.__step(6); });
    lap('Heft: ' + JSON.stringify(await page.evaluate(() => { const S = window.__game().session; return { mode: S.player.mode, quiz: !!S.quiz }; })));
    save('phase3_player3_notes.jpg', await page.evaluate(() => window.__render()));
    await page.evaluate(() => { window.__game().input.down.delete('KeyN'); window.__step(1); });
    // läuft gerade eine Prüfungsfrage, wird sie beantwortet (währenddessen bleibt der Laptop zu)
    await page.evaluate(() => { const S = window.__game().session; let n = 0; while ((S.quiz || S.player.forcedT > 0) && n++ < 60) { if (S.quiz) S.answerQuiz(S.quiz.correctIndex); window.__step(0.5); } S.setMode('laptop'); window.__step(1.4); });
    lap('Laptop: ' + JSON.stringify(await page.evaluate(() => { const S = window.__game().session; return { mode: S.player.mode, blend: +S.player.blend.toFixed(2) }; })));
    save('phase3_player2_laptop.jpg', await page.evaluate(() => window.__render()));
  }
  if (only.includes('seq')) {
    // Sequenz: bis der Prof zur Tafel geht, dann 10 Bilder im Abstand von 0,45 s (feste Kamera seitlich vorne)
    await page.evaluate(() => { const g = window.__game(); let n = 0; while (!(g.session.prof.walking && g.session.prof.after === 'board') && n++ < 12000) window.__step(0.05); });
    for (let i = 0; i < 10; i++) {
      const d = await page.evaluate(() => { const g = window.__game(); window.__step(0.45); const P = g.session.prof; const cam = [P.pos.x + 1.6, 1.75, P.pos.z + 2.4, P.pos.x, 1.15, P.pos.z, 48]; return window.__render(cam); });
      save(`phase4_seq_${String(i + 1).padStart(2, '0')}.jpg`, d);
    }
    // Schulterblick: warten bis Phase 2 des Schulterblicks
    await page.evaluate(() => { const g = window.__game(); let n = 0; while (g.session.prof.shoulder.phase !== 2 && n++ < 12000) window.__step(0.05); });
    save('phase4_shoulder_check.jpg', await page.evaluate(() => { const P = window.__game().session.prof; return window.__render([P.pos.x + 1.2, 1.8, P.pos.z + 2.0, P.pos.x, 1.5, P.pos.z, 45]); }));
  }
  await page.close();
}
if (only.includes('v1')) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + path.join(root, 'dist/BOKU_TicTacTierernaehrung_v1.html'));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(out, 'compare_v1_seat.jpg'), type: 'jpeg', quality: 85 }); lap('compare_v1_seat.jpg');
  await page.close();
  const p2 = await openGame(browser, 'medium');
  await p2.evaluate(() => { window.__step(150); window.__game().player.yaw = 0.15; window.__step(0.6); });
  save('compare_v2_seat.jpg', await p2.evaluate(() => window.__render()));
  await p2.close();
}
await browser.close();
