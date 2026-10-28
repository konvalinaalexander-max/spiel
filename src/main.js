// Einstieg: Laden, Startseite mit Live-Hero, LV-Seite, Spiel, Pause, Zeugnis.
// Eine neue Vorlesung mit anderem Sitzplatz/Wetter/Qualität lädt die Seite neu (sauberer GPU-Speicher).
import { Graphics } from './gfx/graphics.js';
import { PRESETS, guessFromGPU, FrameTimer, saveDetected, loadDetected } from './gfx/quality.js';
import { buildWorld, heroCamera } from './game/world.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';
import { HUD } from './ui/hud.js';
import { Input } from './core/input.js';
import { audio } from './audio/engine.js';
import { t, getLang, translateDom } from './ui/i18n.js';
import { bus, storage } from './core/util.js';
import { SECTIONS, DIALOGUE } from 'virtual:content';

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const uiRoot = document.getElementById('ui'), hudRoot = document.getElementById('hud');
const content = { sections: SECTIONS, dialogue: DIALOGUE };
let gfx, world, game = null, ui, hud, input, frameTimer = new FrameTimer();
let state = 'loading'; // loading | gate | menu | game | pause | result
let last = performance.now(), clock = 0;
const HERO_FOCUS = { x: 0.4, y: 1.75, z: -5.2, clone() { return { ...this }; } };

function pickQuality(settings) {
  if (qs.get('q') && PRESETS[qs.get('q')]) return qs.get('q');
  if (settings.quality && settings.quality !== 'auto') return settings.quality;
  return loadDetected() || null;
}
function probeGPU() {
  try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const r = guessFromGPU({ getContext: () => gl }); const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); return r; }
  catch (e) { return { preset: 'medium', gpu: '?' }; }
}
function applyGfxSettings(s) {
  if (!gfx) return;
  gfx.photosensitive = !!s.photosensitive;
  const next = { ...gfx.preset, renderScale: PRESETS[gfx.presetId].renderScale * (s.dprScale ?? 1), grain: s.grain !== false && PRESETS[gfx.presetId].grain };
  gfx.applyLive(next);
  gfx.caDisabled = s.ca === false || s.photosensitive;
  if (gfx.vignette) gfx.vignette.offset = s.vignette === false ? 0.9 : 0.32;
  if (game) { game.settings = s; game.player.fovBase = s.fov || 60; game.os.opts.colorblind = s.colorblind; game.os.dirty = true; }
  hud?.applySettings(s);
  input.sens = s.sens ?? 1; input.invertY = !!s.invertY; input.cellKeys = s.cellKeys !== false;
  document.documentElement.classList.toggle('reduced-motion', !!s.reducedMotion);
}

async function boot() {
  input = new Input(canvas);
  hud = new HUD(hudRoot, {});
  hud.show(false);
  ui = new UI(uiRoot, {
    audio, input,
    start: (cfg, again) => startLecture(cfg, again),
    resume: () => resume(), quit: () => quitToMenu('start'), toMenu: s => quitToMenu(s),
    applySettings: s => applyGfxSettings(s), reloadQuality: () => { sessionStorage.setItem('boku-ttt-v2:menu', 'settings'); location.reload(); },
    gate: () => enterGate(), inGame: () => !!game && !game.ended, click: () => audio.play('uiClick', { bus: 'ui', gain: 0.3 }),
    lang: l => { audio.setLang(l); }, testVoice: () => { audio.start(); audio.speak(t('set.testLine')); },
    gpuInfo: () => gfx ? t('set.gpuInfo', { gpu: gfx.gpuName || '?', preset: t('set.q.' + gfx.presetId) }) : '',
    screen: name => { document.body.dataset.screen = name || 'none'; }
  });
  hud.applySettings(ui.settings);
  ui.show('loading');
  // Startparameter: anstehende Vorlesung (nach Neuladen) oder letzte Konfiguration
  let pending = null;
  try { pending = JSON.parse(sessionStorage.getItem('boku-ttt-v2:pending') || 'null'); } catch (e) { pending = null; }
  sessionStorage.removeItem('boku-ttt-v2:pending');
  const cfg = pending || ui.cfg;
  // Grafik: Stufe aus Einstellungen oder einmalig aus der GPU geschätzt
  let preset = pickQuality(ui.settings);
  const gpu = probeGPU();
  if (!preset) { preset = gpu.preset; saveDetected(preset); }
  gfx = new Graphics(canvas, preset);
  gfx.presetId = preset; gfx.gpuName = gpu.gpu;
  gfx.photosensitive = !!ui.settings.photosensitive;
  // Audio vorbereiten (Synthese) und Welt bauen
  const steps = { w: 0, a: 0 };
  const prog = () => ui.loading(steps.w * 0.8 + steps.a * 0.2, steps.key);
  const audioP = audio.prepare(f => { steps.a = f; prog(); });
  world = await buildWorld(gfx, { weather: cfg.weather || 'sunny', seat: cfg.seat || { row: 4, k: 7 } }, (f, key) => { steps.w = f; steps.key = key; prog(); });
  await audioP;
  steps.w = 1; steps.a = 1; steps.key = 'load.done'; prog();
  applyGfxSettings(ui.settings);
  world.fx.slides.title(world_meta(), { title: t('slide.title'), sub: t('slide.sub'), who: t('lv.lecturerV'), when: t('slide.when') });
  world.fx.updateSlideTextures(); world.fx.setBeamer(true); world.fx.beamer.level = 1; world.fx.updateBeamer(0);
  world.fresh = true; world.cfgKey = cfgKey(cfg);
  addEventListener('resize', () => gfx.resize());
  bus.on('input:unlock', () => { if (state === 'game' && game && !game.session.quiz && !game.ended) pause(); });
  bus.on('lang', () => { if (world && state !== 'game') { world.fx.slides.title(world_meta(), { title: t('slide.title'), sub: t('slide.sub'), who: t('lv.lecturerV'), when: t('slide.when') }); world.fx.updateSlideTextures(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'game') pause(); });
  window.__game = () => game; window.__gfx = gfx; window.__world = world; window.__ui = ui;
  // Test-Hilfen (headless): Spielzeit vorspulen, Einzelbild rendern
  window.__step = (sec, dt = 0.05) => { if (!game) return 0; const n = Math.round(sec / dt); for (let i = 0; i < n; i++) { clock += dt; game.update(dt, clock); } return game.session.t; };
  window.__render = () => { gfx.render(0.016); if (game) game.renderPiP(); return canvas.toDataURL('image/jpeg', 0.9); };
  window.__state = () => state;
  requestAnimationFrame(frame);
  if (pending) { state = 'gate'; ui.show('gate'); ui._pendingCfg = pending; }
  else if (qs.has('autostart')) { state = 'gate'; ui._pendingCfg = ui.sessionCfg(); ui.show('gate'); }
  else { state = 'menu'; const m = sessionStorage.getItem('boku-ttt-v2:menu'); sessionStorage.removeItem('boku-ttt-v2:menu'); ui.show(m || 'start'); }
}
const world_meta = () => ({ ...(getLang() === 'en' ? { university: 'University of Natural Resources and Life Sciences, Vienna', institute: 'Institute of Animal Nutrition, Animal Products and Nutrition Physiology', courseShort: 'Animal Nutrition (lecture)', footer: 'Animal Nutrition · Winter term 2026/27 · HS 31' } : { university: 'Universität für Bodenkultur Wien', institute: 'Institut für Tierernährung, Tierische Lebensmittel und Ernährungsphysiologie', courseShort: 'Tierernährung VO', footer: 'Tierernährung VO · WS 2026/27 · HS 31' }) });
const cfgKey = c => JSON.stringify({ w: c.weather, s: c.seat });

function startLecture(cfg, again) {
  audio.start();
  const sc = ui.sessionCfg();
  if (!world.fresh || cfgKey(cfg) !== world.cfgKey || again) {
    // Welt passt nicht (anderer Platz/Wetter) oder wurde schon benutzt → neu laden und direkt starten
    sessionStorage.setItem('boku-ttt-v2:pending', JSON.stringify(sc));
    location.reload();
    return;
  }
  ui._pendingCfg = sc;
  enterGate();
}
function enterGate() {
  audio.start();
  const cfg = ui._pendingCfg || ui.sessionCfg();
  world.fresh = false;
  ui.hide();
  input.enabled = true; input.requestLock();
  game = new Game({ gfx, world, content, ui, hud, input, audio, settings: ui.settings, cfg, botSkill: qs.has('bot') ? +(qs.get('bot') || 0.6) : null, hooks: { pause: () => pause(), help: () => { pause(); ui.show('help', { from: 'pause' }); } }, onEnd: res => showResult(res, cfg) });
  state = 'game';
  document.body.dataset.screen = 'game';
}
function pause() {
  if (!game || state !== 'game') return;
  state = 'pause'; game.paused = true; input.enabled = false; input.exitLock();
  try { speechSynthesis.pause(); } catch (e) { /* egal */ }
  if (audio.ctx) audio.ctx.suspend();
  ui.show('pause');
}
function resume() {
  if (!game) return;
  ui.hide(); state = 'game'; game.paused = false; input.enabled = true; input.requestLock();
  try { speechSynthesis.resume(); } catch (e) { /* egal */ }
  if (audio.ctx) audio.ctx.resume();
  last = performance.now();
}
function quitToMenu(screen) {
  if (game) { game.abort(); }
  try { speechSynthesis.cancel(); } catch (e) { /* egal */ }
  if (audio.ctx) audio.ctx.resume();
  input.enabled = false; input.exitLock(); hud.show(false);
  game = null; state = 'menu';
  if (!world.fresh) { sessionStorage.setItem('boku-ttt-v2:menu', screen); location.reload(); return; }
  ui.show(screen);
  audio.startMusic();
}
function showResult(res, cfg) {
  state = 'result'; input.enabled = false; input.exitLock(); hud.show(false);
  ui.showResult(res, cfg);
}

// ------------------------------------------------------------------ Hauptschleife
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__hold) { last = now; return; }
  const dtRaw = (now - last) / 1000; last = now;
  const dt = Math.min(0.05, Math.max(0, dtRaw));
  clock += dt;
  frameTimer.push(dtRaw * 1000);
  if (state === 'game' && game) {
    game.update(dt, clock);
    gfx.render(dt);
    game.renderPiP();
  } else if (state === 'pause' || state === 'result') {
    // stehendes Bild, gelegentlich neu zeichnen (z. B. nach Größenänderung)
    if ((clock * 4 | 0) !== (window.__lastPauseDraw | 0)) { window.__lastPauseDraw = clock * 4; gfx.render(0); }
  } else {
    // Menü: ruhige Kamerafahrt durch den Saal (Live-Hero), gedrosselt
    if (state === 'menu' || state === 'gate' || state === 'loading') {
      if (!world) return;
      heroCamera(gfx.camera, clock);
      world.light.update(dt, clock); world.outside.update(dt, clock); world.fx.updateBeamer(dt);
      world.crowd.update(dt, clock, { profHead: HERO_FOCUS, playerHead: HERO_FOCUS, camPos: gfx.camera.position });
      gfx.render(dt);
    }
  }
}

// Menümusik startet mit der ersten Interaktion
addEventListener('pointerdown', function first() { audio.start(); if (state === 'menu') audio.startMusic(); removeEventListener('pointerdown', first); }, { once: true });
addEventListener('keydown', function firstKey() { audio.start(); if (state === 'menu') audio.startMusic(); }, { once: true });
boot().then(() => { translateDom(uiRoot); translateDom(hudRoot); }).catch(err => {
  console.error(err);
  uiRoot.innerHTML = `<div class="fatal"><h1>${t('err.title')}</h1><p>${t('err.text')}</p><pre>${String(err && err.stack || err).replace(/</g, '&lt;')}</pre></div>`;
});
export { storage };
