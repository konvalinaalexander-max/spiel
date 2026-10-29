// Schärfe- und Lesbarkeitsmessung (Auftrag V3, Anhang B).
// node tools/sharpness.mjs --html tools/.cache/baseline_v2.html --label v2 [--dpr 1,2] [--views K1,K2,K3,K4] [--q medium] [--w 1920 --h 1080]
// Misst für feste Kameras den Bildausschnitt so, wie ihn der Spieler sieht (Seiten-Screenshot in Gerätepixeln, also inkl.
// Hochskalierung durch den Browser): Laplace-Varianz (Kantenschärfe) und OCR-Trefferquote (Anteil der Wörter des Quelltexts,
// die tesseract.js im 3-fach vergrößerten Ausschnitt exakt wiederfindet). Ergebnis: docs/schaerfe/<label>.json + Bilder.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = path.resolve(root, args.html || 'dist/BOKU_TicTacTierernaehrung_v3.html');
const label = args.label || path.basename(html, '.html');
const dprs = String(args.dpr || '1,2').split(',').map(Number);
const views = String(args.views || 'K1,K2,K3,K4').split(',');
const q = args.q || 'medium', W = +(args.w || 1920), H = +(args.h || 1080);
const outDir = path.join(root, 'docs/schaerfe'); fs.mkdirSync(outDir, { recursive: true });
const cache = path.join(root, 'tools/.cache/tessdata'); fs.mkdirSync(cache, { recursive: true });
const t0 = Date.now(); const lap = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

const words = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}%,.:–\-]+/gu, ' ').split(/\s+/).map(w => w.replace(/^[,.:–\-]+|[,.:–\-]+$/g, '')).filter(w => w.length >= 3);
function recall(truth, ocr) {
  const pool = new Map(); for (const w of words(ocr)) pool.set(w, (pool.get(w) || 0) + 1);
  const tw = words(truth); let hit = 0;
  for (const w of tw) { const n = pool.get(w) || 0; if (n > 0) { hit++; pool.set(w, n - 1); } }
  return tw.length ? hit / tw.length : null;
}
async function laplaceVar(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height; let s = 0, s2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; const v = data[i - w] + data[i + w] + data[i - 1] + data[i + 1] - 4 * data[i];
    s += v; s2 += v * v; n++;
  }
  const m = s / n; return s2 / n - m * m;
}

// Trainingsdaten liegen lokal (tools/.cache/tessdata, geladen von cdn.jsdelivr.net/npm/@tesseract.js-data/<lang>/4.0.0_best_int/)
for (const l of ['deu', 'eng']) if (!fs.existsSync(path.join(cache, l + '.traineddata.gz'))) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`);
  fs.writeFileSync(path.join(cache, l + '.traineddata.gz'), Buffer.from(await res.arrayBuffer()));
}
const worker = await createWorker(['deu', 'eng'], 1, { langPath: cache, cachePath: cache, logger: () => {} });
await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });

const flags = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const results = [];
async function openAt(browser, dpr) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.addInitScript(() => { try { localStorage.setItem('boku-ttt-v2:lang', JSON.stringify('de')); localStorage.setItem('boku-ttt-v3:lang', JSON.stringify('de')); } catch (e) { /* egal */ } });
  await page.goto('file://' + html + '?q=' + q);
  await page.waitForFunction(() => window.__world && window.__state && window.__state() === 'menu', null, { timeout: 900000, polling: 1000 });
  await page.evaluate(() => { window.__hold = true; window.__ui.hooks.start({ ...window.__ui.cfg, seed: 4242 }); });
  await page.waitForFunction(() => window.__state() === 'game', null, { timeout: 120000 });
  // bis eine Inhaltsfolie läuft und der Prof an der Tafel geschrieben hat
  await page.evaluate(() => { const g = window.__game(); let n = 0; while (!(g.lastSlide && g.lastSlide.kind === 'content' && g.session.t > 120) && n++ < 30000) window.__step(0.05); window.__step(3); });
  await page.evaluate(() => { for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  const info = await page.evaluate(() => ({ dprCanvas: window.__gfx.renderer.getPixelRatio(), buf: [window.__gfx.renderer.domElement.width, window.__gfx.renderer.domElement.height] }));
  lap(`${label} DPR ${dpr}: Canvas-Pixelverhältnis ${info.dprCanvas}, Puffer ${info.buf.join('×')}`);
  return { page, info };
}

for (const dpr of dprs) {
  const browser = await chromium.launch({ args: flags });
  for (const v of views) for (let attempt = 0; attempt < 2; attempt++) {
    let page, info;
    try {
    ({ page, info } = await openAt(browser, dpr));
    // Kamera setzen, rendern, Bildschirmrechteck des Zielobjekts (CSS-Pixel) und Quelltext bestimmen
    const r = await page.evaluate(view => {
      const g = window.__game(), W = window.__world, gfx = window.__gfx, cam = gfx.camera;
      const fx = W.fx, scr = fx.screen, sp = scr.geometry.parameters;
      const rect = pts => { const c = gfx.renderer.domElement, cw = c.clientWidth, ch = c.clientHeight; const p2 = pts.map(v => { const q = v.clone().project(cam); return [(q.x * 0.5 + 0.5) * cw, (0.5 - q.y * 0.5) * ch]; }); const xs = p2.map(p => p[0]), ys = p2.map(p => p[1]); return { x: Math.max(0, Math.min(...xs) - 6), y: Math.max(0, Math.min(...ys) - 6), x1: Math.min(cw, Math.max(...xs) + 6), y1: Math.min(ch, Math.max(...ys) + 6) }; };
      const corners = (obj, w, h) => [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => obj.localToWorld(new obj.position.constructor(sx * w / 2, sy * h / 2, 0)));
      const slideText = () => { const d = g.lastSlide; const s = d && g._sec(d.section); const sl = s && s.slides[d.index]; return sl ? [sl.title, sl.subtitle || '', ...(sl.bullets || [])].join(' ') : ''; };
      let box = null, truth = '';
      if (view === 'K1' || view === 'K4') {
        if (g.session.player.mode !== 'listen') { g.session.setMode('listen'); window.__step(1.5); }
        const p = scr.position;
        cam.position.set(1.1, 1.92, 0.75); cam.lookAt(p.x, p.y, p.z); cam.fov = view === 'K4' ? 25 : 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        gfx.render(0.016); box = rect(corners(scr, sp.width, sp.height)); truth = slideText();
      } else if (view === 'K3') {
        if (g.session.player.mode !== 'listen') { g.session.setMode('listen'); window.__step(1.5); }
        const pn = fx.lowPanel ? fx.lowPanel() : fx.panels[0], ch = pn.chalk, V = cam.position.constructor;
        const wc = (x, y) => { const t = new V(); ch.pxToLocal({ x, y }, t); t.z = 0.01; pn.group.updateMatrixWorld(true); return pn.group.localToWorld(t); };
        const pts = [wc(0, 0), wc(ch.W, 0), wc(ch.W, ch.H), wc(0, ch.H)];
        const c = pts.reduce((a, b) => a.add(b), new V()).multiplyScalar(0.25);
        cam.position.set(1.1, 1.92, 0.75); cam.lookAt(c.x, c.y, c.z); cam.fov = 60; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        gfx.render(0.016); box = rect(pts);
      } else if (view === 'K2') {
        const os = g.os; os.focus('pdf'); os.dirty = true;
        g.session.setMode('laptop'); window.__step(2.0);
        // Quelltext: alles, was das Laptop-OS beim nächsten Zeichnen schreibt
        const ctx = os.ctx, orig = ctx.fillText, rec = [];
        ctx.fillText = function (t, x, y, m) { const px = +((/(\d+(?:\.\d+)?)px/.exec(this.font) || [0, 0])[1]); if (px >= 15) rec.push(String(t)); return orig.call(this, t, x, y, m); };
        os.dirty = true; os.draw(); ctx.fillText = orig; if (g.osTex) g.osTex.needsUpdate = true;
        window.__step(0.05); gfx.render(0.016);
        const lp = W.props.player.laptop; box = rect([lp.screenWorld(0, 0, new cam.position.constructor()), lp.screenWorld(1, 0, new cam.position.constructor()), lp.screenWorld(1, 1, new cam.position.constructor()), lp.screenWorld(0, 1, new cam.position.constructor())]);
        truth = rec.join(' ');
      }
      return { box, truth, fov: cam.fov };
    }, v);
    if (!r.box) { lap(`${v}: kein Ausschnitt`); await page.close(); break; }
    const clip = { x: r.box.x, y: r.box.y, width: r.box.x1 - r.box.x, height: r.box.y1 - r.box.y };
    // Bild direkt aus dem Canvas (Renderpuffer) und auf Gerätepixel bringen, wie es der Browser beim Anzeigen tut
    // (bilineare Hochskalierung, wenn der Puffer kleiner als der Bildschirm ist) – Seiten-Screenshots hängen im CPU-Rasterizer
    const full = await page.evaluate(() => { window.__gfx.render(0.016); return window.__gfx.renderer.domElement.toDataURL('image/png'); });
    const buf0 = Buffer.from(full.split(',')[1], 'base64');
    const k = info.dprCanvas;
    const ext = { left: Math.round(clip.x * k), top: Math.round(clip.y * k), width: Math.round(clip.width * k), height: Math.round(clip.height * k) };
    const png = await sharp(buf0).extract(ext).resize({ width: Math.round(clip.width * dpr), height: Math.round(clip.height * dpr), kernel: Math.abs(k - dpr) < 0.01 ? 'nearest' : 'linear' }).png().toBuffer();
    const file = `${label}_${v}_dpr${dpr}.png`; fs.writeFileSync(path.join(outDir, file), png);
    const lv = await laplaceVar(png);
    let ocr = null, ocrText = '';
    if (r.truth) {
      const big = await sharp(png).resize({ width: Math.round(clip.width * dpr * 3), kernel: 'lanczos3' }).greyscale().png().toBuffer();
      const { data } = await worker.recognize(big); ocrText = data.text; ocr = recall(r.truth, ocrText);
    }
    const row = { label, view: v, dpr, canvasDpr: info.dprCanvas, pxW: Math.round(clip.width * dpr), pxH: Math.round(clip.height * dpr), laplace: +lv.toFixed(1), ocr: ocr == null ? null : +(ocr * 100).toFixed(1), words: words(r.truth).length, file };
    results.push(row);
    lap(`${v} DPR ${dpr}: ${row.pxW}×${row.pxH} px, Laplace ${row.laplace}, OCR ${row.ocr ?? '–'} % (${row.words} Wörter)`);
    if (args.debug) fs.writeFileSync(path.join(outDir, `${label}_${v}_dpr${dpr}.txt`), `QUELLTEXT:\n${r.truth}\n\nOCR:\n${ocrText}`);
    await page.close();
    break;
    } catch (e) {
      // CPU-Rasterizer stürzt bei sehr großen Bildern gelegentlich ab (GPU-Watchdog) → Seite neu öffnen, einmal wiederholen
      lap(`${v} DPR ${dpr}: ${String(e.message).split('\n')[0]}${attempt ? ' – aufgegeben' : ' – neuer Versuch'}`);
      try { await page?.close(); } catch (e2) { /* schon weg */ }
    }
  }
  await browser.close();
}
await worker.terminate();
fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify({ label, html: path.relative(root, html), q, viewport: [W, H], date: new Date().toISOString().slice(0, 10), results }, null, 1));
lap(`fertig → docs/schaerfe/${label}.json`);
