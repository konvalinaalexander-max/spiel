// Menüs im Stil von boku.ac.at: Ladebildschirm, Startseite (Live-Hero), LV-Seite (BOKUonline-Optik),
// Einstellungen, Mensa-Pause, Zeugnis, Erfolge, Bestenliste, Hilfe, Impressum/Lizenzen.
import { t, getLang, setLang, translateDom } from './i18n.js';
import { bus, storage, clamp } from '../core/util.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, LENGTHS, seatMultiplier, scaledTarget } from '../game/config.js';
import { DEFAULT_KEYS, keyLabel } from '../core/input.js';
import * as LY from '../scene/layout.js';

export const ACHIEVEMENTS = ['pansenProfi', 'invisible', 'honest', 'streak3', 'closeCall', 'frontRow', 'scribe', 'chalkTime', 'breakKing', 'snake20', 'accomplice', 'blitzWin', 'hardcore', 'excursion'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Schriftzug im BOKU-Stil (nachgebaut, kein Original-Logo) */
const WORDMARK = `<span class="wordmark" aria-hidden="true"><span class="wm-bars"><i></i><i></i><i></i></span><span class="wm-text">BOKU</span></span>`;

export const DEFAULT_CFG = { difficulty: 'bachelor', mode: 'tournament', length: 'normal', opponent: 'hall', weather: 'sunny', seat: { row: 4, k: 7 }, avatar: 'a', hints: true, custom: { vigilance: 1, target: 5, oppSkill: 0.5, neighbor: 'helpful' } };
export const DEFAULT_SETTINGS = { quality: 'auto', dprScale: 1, fov: 60, dof: true, grain: true, ca: true, vignette: true, subtitles: true, subSize: 'm', colorblind: false, photosensitive: false, reducedMotion: false, highContrast: false, susIndicator: true, minimalHud: false, pointerLock: true, sens: 1, invertY: false, cellKeys: true, name: '' };

export class UI {
  constructor(root, hooks) {
    this.root = root; this.hooks = hooks; // { start(cfg), resume(), quit(), applySettings(s), reloadQuality(), audio, preview(cfg) }
    this.cfg = { ...DEFAULT_CFG, ...storage.get('cfg', {}) }; this.cfg.custom = { ...DEFAULT_CFG.custom, ...(this.cfg.custom || {}) };
    this.settings = { ...DEFAULT_SETTINGS, ...storage.get('settings', {}) };
    this.unlocked = new Set(storage.get('achievements', []));
    this.board = storage.get('leaderboard', []);
    this.screen = null;
    this._build();
    bus.on('lang', () => { translateDom(this.root); this._refreshDynamic(); });
    translateDom(this.root);
  }
  // ------------------------------------------------------------------ Aufbau
  _build() {
    const R = this.root;
    R.innerHTML = '';
    // Ladebildschirm
    R.append(h(`<section id="scr-loading" class="screen loading" aria-live="polite">
      <div class="load-card">
        <div class="load-head">${WORDMARK}<div><div class="load-uni" data-i18n="brand.university"></div><div class="load-sub" data-i18n="brand.game"></div></div></div>
        <h1 data-i18n="load.title"></h1>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="bar"></div></div>
        <p class="load-step" id="load-step"></p>
        <p class="load-tip" id="load-tip"></p>
        <p class="disclaimer" data-i18n="brand.disclaimer"></p>
      </div></section>`));
    // Klick-Tor (Audio/Pointer Lock brauchen eine Nutzeraktion)
    R.append(h(`<section id="scr-gate" class="screen gate" hidden><div class="gate-card"><h2 data-i18n="gate.title"></h2><p data-i18n="gate.text"></p><button class="btn btn-primary" id="gate-go" data-i18n="gate.go"></button></div></section>`));
    // Startseite (Website-Optik)
    R.append(h(`<section id="scr-start" class="screen site" hidden>
      <header class="site-header">
        <div class="topbar"><div class="container"><span data-i18n="site.topbar"></span><nav class="lang" aria-label="Sprache / Language"><button data-lang="de" class="lang-btn">DE</button><span>|</span><button data-lang="en" class="lang-btn">EN</button></nav></div></div>
        <div class="container head-row">${WORDMARK}<div class="head-uni"><strong data-i18n="brand.university"></strong><span data-i18n="brand.uniSub"></span></div>
          <nav class="mainnav" aria-label="Hauptnavigation"><a href="#" data-go="lv" data-i18n="nav.course"></a><a href="#" data-go="settings" data-i18n="nav.settings"></a><a href="#" data-go="achievements" data-i18n="nav.achievements"></a><a href="#" data-go="leaderboard" data-i18n="nav.leaderboard"></a><a href="#" data-go="help" data-i18n="nav.help"></a></nav></div>
      </header>
      <div class="hero"><div class="hero-shade"></div><div class="container hero-inner">
        <p class="hero-kicker" data-i18n="hero.kicker"></p><h1 class="hero-title" data-i18n="hero.title"></h1><p class="hero-lead" data-i18n="hero.lead"></p>
        <div class="hero-cta"><button class="btn btn-primary btn-lg" data-go="lv" data-i18n="hero.cta"></button><button class="btn btn-ghost btn-lg" data-go="help" data-i18n="hero.how"></button></div>
        <p class="hero-load" id="hero-load" hidden></p>
      </div></div>
      <div class="site-body"><main class="container site-main">
        <nav class="breadcrumb" aria-label="Breadcrumb"><span data-i18n="crumb.home"></span> › <span data-i18n="crumb.study"></span> › <span data-i18n="crumb.course"></span></nav>
        <div class="grid3">
          <article class="teaser keyfact kf-green"><div class="kf-num">110</div><div data-i18n="kf.seats"></div></article>
          <article class="teaser keyfact kf-purple"><div class="kf-num">90</div><div data-i18n="kf.minutes"></div></article>
          <article class="teaser keyfact kf-orange"><div class="kf-num">3×</div><div data-i18n="kf.strikes"></div></article>
        </div>
        <h2 class="h2bar" data-i18n="start.newsTitle"></h2>
        <div class="grid3">
          <article class="teaser"><h3 data-i18n="start.n1.t"></h3><p data-i18n="start.n1.b"></p></article>
          <article class="teaser"><h3 data-i18n="start.n2.t"></h3><p data-i18n="start.n2.b"></p></article>
          <article class="teaser"><h3 data-i18n="start.n3.t"></h3><p data-i18n="start.n3.b"></p></article>
        </div>
        <div class="infobox" role="note"><strong data-i18n="brand.fanTitle"></strong> <span data-i18n="brand.disclaimerLong"></span></div>
      </main>
      <footer class="site-footer"><div class="container foot-grid">
        <div><strong data-i18n="brand.university"></strong><br><span data-i18n="foot.address"></span></div>
        <div><a href="#" data-go="credits" data-i18n="foot.credits"></a><br><a href="#" data-go="help" data-i18n="foot.controls"></a></div>
        <div class="muted" data-i18n="brand.disclaimer"></div>
      </div></footer></div>
    </section>`));
    // LV-Seite (BOKUonline-Stil)
    R.append(h(`<section id="scr-lv" class="screen online" hidden>
      <header class="online-head"><div class="container online-row">${WORDMARK}<span class="online-brand">BOKU<b>online</b></span><span class="online-path" data-i18n="lv.path"></span><button class="btn btn-small" data-go="start" data-i18n="ui.back"></button></div></header>
      <main class="container online-main">
        <h1 class="lv-title"><span data-i18n="lv.title"></span> <small class="lv-nr">932.301 · VO · 2,0 SWS · 3 ECTS</small></h1>
        <div class="lv-grid">
          <div class="lv-col">
            <table class="lv-table"><tbody>
              <tr><th data-i18n="lv.semester"></th><td data-i18n="lv.semesterV"></td></tr>
              <tr><th data-i18n="lv.lecturer"></th><td data-i18n="lv.lecturerV"></td></tr>
              <tr><th data-i18n="lv.when"></th><td data-i18n="lv.whenV"></td></tr>
              <tr><th data-i18n="lv.where"></th><td data-i18n="lv.whereV"></td></tr>
              <tr><th data-i18n="lv.curriculum"></th><td data-i18n="lv.curriculumV"></td></tr>
            </tbody></table>
            <fieldset class="opt"><legend data-i18n="lv.difficulty"></legend><div class="seg" id="opt-diff"></div><p class="opt-desc" id="diff-desc"></p>
              <div id="custom-box" class="custom" hidden>
                <label><span data-i18n="lv.c.vigilance"></span> <input type="range" min="0.5" max="1.8" step="0.05" id="c-vig"><output id="c-vig-o"></output></label>
                <label><span data-i18n="lv.c.target"></span> <input type="range" min="1" max="10" step="1" id="c-target"><output id="c-target-o"></output></label>
                <label><span data-i18n="lv.c.opp"></span> <input type="range" min="0" max="1" step="0.05" id="c-opp"><output id="c-opp-o"></output></label>
                <label><span data-i18n="lv.c.neighbor"></span> <select id="c-nb"><option value="helpful" data-i18n="lv.nb.helpful"></option><option value="neutral" data-i18n="lv.nb.neutral"></option><option value="betrayer" data-i18n="lv.nb.betrayer"></option></select></label>
              </div></fieldset>
            <fieldset class="opt"><legend data-i18n="lv.mode"></legend><div class="seg" id="opt-mode"></div><p class="opt-desc" id="mode-desc"></p></fieldset>
            <fieldset class="opt"><legend data-i18n="lv.length"></legend><div class="seg" id="opt-length"></div></fieldset>
            <fieldset class="opt"><legend data-i18n="lv.opponent"></legend><div class="seg" id="opt-opp"></div>
              <div class="seg sub-seg" id="opt-oppskill" hidden></div></fieldset>
            <fieldset class="opt"><legend data-i18n="lv.weather"></legend><div class="seg" id="opt-weather"></div></fieldset>
            <fieldset class="opt"><legend data-i18n="lv.avatar"></legend><div class="seg" id="opt-avatar"></div></fieldset>
            <label class="check"><input type="checkbox" id="opt-hints"> <span data-i18n="lv.hints"></span></label>
          </div>
          <div class="lv-col">
            <fieldset class="opt"><legend data-i18n="lv.seat"></legend>
              <div class="seatmap" id="seatmap" role="grid" aria-label="Sitzplan"></div>
              <p class="opt-desc" id="seat-desc"></p></fieldset>
            <div class="infobox" data-i18n="lv.info"></div>
            <button class="btn btn-primary btn-lg btn-block" id="lv-start" data-i18n="lv.start"></button>
          </div>
        </div>
      </main></section>`));
    // Einstellungen
    R.append(h(`<section id="scr-settings" class="screen site modal-page" hidden>
      <div class="page-card"><header class="page-head"><h1 data-i18n="set.title"></h1><button class="btn btn-small" data-back data-i18n="ui.back"></button></header>
      <div class="tabs" role="tablist"><button role="tab" data-tab="gfx" data-i18n="set.tab.gfx"></button><button role="tab" data-tab="audio" data-i18n="set.tab.audio"></button><button role="tab" data-tab="controls" data-i18n="set.tab.controls"></button><button role="tab" data-tab="a11y" data-i18n="set.tab.a11y"></button><button role="tab" data-tab="lang" data-i18n="set.tab.lang"></button></div>
      <div class="tabpanel" data-panel="gfx">
        <label class="row"><span data-i18n="set.quality"></span><select id="s-quality"><option value="auto" data-i18n="set.q.auto"></option><option value="low" data-i18n="set.q.low"></option><option value="medium" data-i18n="set.q.medium"></option><option value="high" data-i18n="set.q.high"></option><option value="ultra" data-i18n="set.q.ultra"></option></select></label>
        <label class="row"><span data-i18n="set.dpr"></span><input type="range" id="s-dpr" min="0.5" max="1" step="0.05"><output id="s-dpr-o"></output></label>
        <label class="row"><span data-i18n="set.fov"></span><input type="range" id="s-fov" min="50" max="80" step="1"><output id="s-fov-o"></output></label>
        <label class="row check"><input type="checkbox" id="s-dof"> <span data-i18n="set.dof"></span></label>
        <label class="row check"><input type="checkbox" id="s-grain"> <span data-i18n="set.grain"></span></label>
        <label class="row check"><input type="checkbox" id="s-ca"> <span data-i18n="set.ca"></span></label>
        <label class="row check"><input type="checkbox" id="s-vignette"> <span data-i18n="set.vignette"></span></label>
        <p class="opt-desc" data-i18n="set.qualityNote"></p><p class="opt-desc" id="s-gpu"></p>
        <button class="btn" id="s-reload" data-i18n="set.reload"></button>
      </div>
      <div class="tabpanel" data-panel="audio" hidden>
        ${['master', 'voice', 'sfx', 'amb', 'music'].map(k => `<label class="row"><span data-i18n="set.vol.${k}"></span><input type="range" min="0" max="1" step="0.05" data-vol="${k}"><output></output></label>`).join('')}
        <label class="row"><span data-i18n="set.voice"></span><select id="s-voice"><option value="tts" data-i18n="set.voice.tts"></option><option value="murmur" data-i18n="set.voice.murmur"></option><option value="off" data-i18n="set.voice.off"></option></select></label>
        <label class="row"><span data-i18n="set.ttsRate"></span><input type="range" id="s-rate" min="0.7" max="1.4" step="0.05"><output id="s-rate-o"></output></label>
        <p class="opt-desc" id="s-voiceinfo"></p>
        <button class="btn" id="s-test" data-i18n="set.test"></button>
      </div>
      <div class="tabpanel" data-panel="controls" hidden>
        <label class="row"><span data-i18n="set.sens"></span><input type="range" id="s-sens" min="0.3" max="2.5" step="0.05"><output id="s-sens-o"></output></label>
        <label class="row check"><input type="checkbox" id="s-invert"> <span data-i18n="set.invert"></span></label>
        <label class="row check"><input type="checkbox" id="s-plock"> <span data-i18n="set.pointerLock"></span></label>
        <label class="row check"><input type="checkbox" id="s-cellkeys"> <span data-i18n="set.cellKeys"></span></label>
        <h2 class="h2bar" data-i18n="set.keys"></h2><div class="keys" id="s-keys"></div><button class="btn btn-small" id="s-keys-reset" data-i18n="set.keysReset"></button>
        <p class="opt-desc" data-i18n="set.gamepad"></p>
      </div>
      <div class="tabpanel" data-panel="a11y" hidden>
        <label class="row check"><input type="checkbox" id="s-subs"> <span data-i18n="set.subs"></span></label>
        <label class="row"><span data-i18n="set.subSize"></span><select id="s-subsize"><option value="s">S</option><option value="m">M</option><option value="l">L</option><option value="xl">XL</option></select></label>
        <label class="row check"><input type="checkbox" id="s-cb"> <span data-i18n="set.colorblind"></span></label>
        <label class="row check"><input type="checkbox" id="s-photo"> <span data-i18n="set.photo"></span></label>
        <label class="row check"><input type="checkbox" id="s-motion"> <span data-i18n="set.motion"></span></label>
        <label class="row check"><input type="checkbox" id="s-contrast"> <span data-i18n="set.contrast"></span></label>
        <label class="row check"><input type="checkbox" id="s-sus"> <span data-i18n="set.susIndicator"></span></label>
        <label class="row check"><input type="checkbox" id="s-minhud"> <span data-i18n="set.minimalHud"></span></label>
      </div>
      <div class="tabpanel" data-panel="lang" hidden>
        <div class="seg"><button data-lang="de" class="btn">Deutsch (Österreich)</button><button data-lang="en" class="btn">English</button></div>
        <p class="opt-desc" data-i18n="set.langNote"></p>
        <label class="row"><span data-i18n="set.name"></span><input type="text" id="s-name" maxlength="24" autocomplete="off"></label>
      </div></div></section>`));
    // Pause
    R.append(h(`<section id="scr-pause" class="screen scrim" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="pause-t">
      <div class="dlg-head"><h2 id="pause-t" data-i18n="pause.title"></h2></div><p data-i18n="pause.text"></p>
      <div class="stack"><button class="btn btn-primary" id="p-resume" data-i18n="pause.resume"></button><button class="btn" data-go="settings" data-i18n="nav.settings"></button><button class="btn" data-go="help" data-i18n="nav.help"></button><button class="btn" id="p-quit" data-i18n="pause.quit"></button></div></div></section>`));
    // Zeugnis
    R.append(h(`<section id="scr-result" class="screen site modal-page" hidden><div class="page-card certificate" id="cert"></div></section>`));
    // Erfolge / Bestenliste / Hilfe / Credits
    R.append(h(`<section id="scr-achievements" class="screen site modal-page" hidden><div class="page-card"><header class="page-head"><h1 data-i18n="nav.achievements"></h1><button class="btn btn-small" data-back data-i18n="ui.back"></button></header><div class="badges" id="badges"></div></div></section>`));
    R.append(h(`<section id="scr-leaderboard" class="screen site modal-page" hidden><div class="page-card"><header class="page-head"><h1 data-i18n="nav.leaderboard"></h1><button class="btn btn-small" data-back data-i18n="ui.back"></button></header><table class="lv-table board"><thead><tr><th>#</th><th data-i18n="lb.name"></th><th data-i18n="lb.score"></th><th data-i18n="lb.grade"></th><th data-i18n="lb.diff"></th><th data-i18n="lb.date"></th></tr></thead><tbody id="lb-body"></tbody></table><p class="opt-desc" data-i18n="lb.note"></p></div></section>`));
    R.append(h(`<section id="scr-help" class="screen site modal-page" hidden><div class="page-card"><header class="page-head"><h1 data-i18n="help.title"></h1><button class="btn btn-small" data-back data-i18n="ui.back"></button></header><div class="help" id="help"></div></div></section>`));
    R.append(h(`<section id="scr-credits" class="screen site modal-page" hidden><div class="page-card"><header class="page-head"><h1 data-i18n="credits.title"></h1><button class="btn btn-small" data-back data-i18n="ui.back"></button></header><div data-i18n-html="credits.body"></div><pre class="licenses" id="licenses"></pre></div></section>`));
    // Navigation
    R.addEventListener('click', e => {
      const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); this.show(go.dataset.go, { from: this.screen }); this.hooks.click?.(); return; }
      const back = e.target.closest('[data-back]'); if (back) { e.preventDefault(); this.back(); this.hooks.click?.(); return; }
      const lb = e.target.closest('[data-lang]'); if (lb) { setLang(lb.dataset.lang); this.hooks.lang?.(lb.dataset.lang); return; }
    });
    $('#gate-go').addEventListener('click', () => this.hooks.gate?.());
    $('#p-resume').addEventListener('click', () => this.hooks.resume?.());
    $('#p-quit').addEventListener('click', () => this.hooks.quit?.());
    $('#lv-start').addEventListener('click', () => { this._saveCfg(); this.hooks.start?.(this.cfg); });
    const lic = document.getElementById('third-party'); if (lic) $('#licenses').textContent = lic.textContent;
    this._buildLV(); this._buildSettings(); this._buildHelp();
    addEventListener('keydown', e => { if (e.key === 'Escape' && this.screen && ['settings', 'achievements', 'leaderboard', 'help', 'credits'].includes(this.screen)) { e.preventDefault(); this.back(); } });
  }
  // ------------------------------------------------------------------ Navigation
  show(name, o = {}) {
    if (o.from && o.from !== name) this._prev = o.from;
    for (const s of $$('.screen', this.root)) s.hidden = s.id !== 'scr-' + name;
    this.screen = name;
    this.root.classList.toggle('ui-hidden', !name);
    if (name === 'achievements') this._renderBadges();
    if (name === 'leaderboard') this._renderBoard();
    if (name === 'lv') this._refreshLV();
    if (name === 'settings') this._refreshSettings();
    const scr = name && $('#scr-' + name);
    if (scr) { const f = scr.querySelector('.btn-primary') || scr.querySelector('button, a, input'); if (f && !o.noFocus) setTimeout(() => f.focus({ preventScroll: true }), 30); scr.scrollTop = 0; }
    this.hooks.screen?.(name);
    const pre = document.getElementById('preload'); if (pre) pre.remove();
  }
  hide() { this.show(null); }
  back() { const p = this._prev && this._prev !== this.screen ? this._prev : (this.hooks.inGame?.() ? 'pause' : 'start'); this._prev = null; this.show(p); }
  // ------------------------------------------------------------------ Laden
  loading(f, key) {
    const bar = $('#scr-loading .bar'); if (!bar) return; bar.style.width = Math.round(f * 100) + '%';
    $('#scr-loading .progress').setAttribute('aria-valuenow', Math.round(f * 100));
    if (key) $('#load-step').textContent = t(key);
    if (!this._tipSet) { this._tipSet = true; $('#load-tip').textContent = t('load.tips'); }
  }
  /** Fortschritt des Hintergrund-Ladens auf Startseite/LV-Seite (null = fertig) */
  setWorldLoading(f) {
    this.root.classList.toggle('world-loading', f !== null);
    const chip = $('#hero-load');
    if (f === null) { if (chip) chip.hidden = true; return; }
    if (chip) { chip.hidden = false; chip.textContent = t('load.chip', { p: Math.round(f * 100) }); }
  }
  // ------------------------------------------------------------------ LV-Seite
  _seg(el, items, current, onPick) {
    el.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn seg-btn'; b.dataset.v = it.v; b.dataset.i18n = it.k; b.textContent = t(it.k);
      b.setAttribute('aria-pressed', String(it.v === current));
      b.addEventListener('click', () => { for (const x of el.children) x.setAttribute('aria-pressed', String(x === b)); onPick(it.v); this.hooks.click?.(); });
      el.append(b);
    }
  }
  _buildLV() {
    const c = this.cfg;
    this._seg($('#opt-diff'), [...DIFFICULTY_ORDER.map(v => ({ v, k: 'diff.' + v })), { v: 'custom', k: 'diff.custom' }], typeof c.difficulty === 'object' ? 'custom' : c.difficulty, v => { c.difficultyId = v; c.difficulty = v === 'custom' ? 'custom' : v; this._refreshLV(); });
    this._seg($('#opt-mode'), ['tournament', 'bo5', 'blitz'].map(v => ({ v, k: 'mode.' + v })), c.mode, v => { c.mode = v; this._refreshLV(); });
    this._seg($('#opt-length'), Object.keys(LENGTHS).map(v => ({ v, k: 'len.' + v })), c.length, v => { c.length = v; this._refreshLV(); });
    this._seg($('#opt-opp'), ['hall', 'online'].map(v => ({ v, k: 'opp.' + v })), c.opponent, v => { c.opponent = v; this._refreshLV(); });
    c.oppSkill = c.oppSkill ?? 0.5;
    this._seg($('#opt-oppskill'), [[0.25, 'opp.easy'], [0.5, 'opp.mid'], [0.85, 'opp.hard']].map(([v, k]) => ({ v: String(v), k })), String(c.oppSkill), v => { c.oppSkill = +v; this._refreshLV(); });
    this._seg($('#opt-weather'), ['sunny', 'cloudy', 'rain'].map(v => ({ v, k: 'weather.' + v })), c.weather, v => { c.weather = v; });
    this._seg($('#opt-avatar'), ['a', 'b', 'c'].map(v => ({ v, k: 'avatar.' + v })), c.avatar, v => { c.avatar = v; });
    $('#opt-hints').checked = c.hints !== false; $('#opt-hints').addEventListener('change', e => { c.hints = e.target.checked; });
    const cu = c.custom;
    const bind = (id, key, fmt) => { const el = $(id), o = $(id + '-o'); el.value = cu[key]; o.textContent = fmt(cu[key]); el.addEventListener('input', () => { cu[key] = +el.value; o.textContent = fmt(cu[key]); }); };
    bind('#c-vig', 'vigilance', v => '×' + (+v).toFixed(2)); bind('#c-target', 'target', v => v); bind('#c-opp', 'oppSkill', v => Math.round(v * 100) + ' %');
    $('#c-nb').value = cu.neighbor; $('#c-nb').addEventListener('change', e => { cu.neighbor = e.target.value; });
    // Sitzplan: Reihe 1 vorne (oben = Tafel)
    const map = $('#seatmap'); map.innerHTML = '<div class="board-strip" data-i18n="lv.boardStrip"></div>';
    for (let r = 0; r < LY.ROWS; r++) {
      const row = document.createElement('div'); row.className = 'seat-row'; row.setAttribute('role', 'row');
      const lab = document.createElement('span'); lab.className = 'row-lab'; lab.textContent = r + 1; row.append(lab);
      for (let k = 0; k < LY.SEATS; k++) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'seat'; b.dataset.r = r; b.dataset.k = k; b.setAttribute('role', 'gridcell');
        b.setAttribute('aria-label', t('lv.seatLabel', { r: r + 1, k: k + 1, m: seatMultiplier(r).toFixed(2) }));
        b.style.setProperty('--m', (seatMultiplier(r) - 0.75) / 0.6);
        b.addEventListener('click', () => { c.seat = { row: r, k }; this._refreshLV(); this.hooks.click?.(); });
        row.append(b);
      }
      map.append(row);
    }
  }
  _refreshLV() {
    const c = this.cfg, id = c.difficulty === 'custom' || typeof c.difficulty === 'object' ? 'custom' : c.difficulty;
    $('#custom-box').hidden = id !== 'custom';
    $('#opt-oppskill').hidden = c.opponent !== 'online';
    for (const b of $('#opt-oppskill').children) b.setAttribute('aria-pressed', String(+b.dataset.v === c.oppSkill));
    $('#diff-desc').textContent = t('diffDesc.' + id, { target: scaledTarget(id === 'custom' ? c.custom.target : DIFFICULTIES[id].target, LENGTHS[c.length] || 720) });
    $('#mode-desc').textContent = t('modeDesc.' + c.mode);
    for (const b of $$('.seat', this.root)) b.setAttribute('aria-pressed', String(+b.dataset.r === c.seat.row && +b.dataset.k === c.seat.k));
    $('#seat-desc').textContent = t('lv.seatDesc', { r: c.seat.row + 1, k: c.seat.k + 1, m: seatMultiplier(c.seat.row).toFixed(2) });
    for (const sel of ['#opt-diff', '#opt-mode', '#opt-length', '#opt-opp', '#opt-weather', '#opt-avatar']) for (const b of $(sel).children) b.setAttribute('aria-pressed', String(b.dataset.v === ({ '#opt-diff': id, '#opt-mode': c.mode, '#opt-length': c.length, '#opt-opp': c.opponent, '#opt-weather': c.weather, '#opt-avatar': c.avatar }[sel])));
  }
  _saveCfg() { storage.set('cfg', this.cfg); }
  /** Konfiguration für die Session (custom → Objekt) */
  sessionCfg() {
    const c = this.cfg;
    return { ...c, difficulty: c.difficulty === 'custom' ? { ...c.custom } : c.difficulty };
  }
  // ------------------------------------------------------------------ Einstellungen
  _buildSettings() {
    const S = this.settings, A = this.hooks.audio;
    $$('[role=tab]', this.root).forEach(tb => tb.addEventListener('click', () => this._tab(tb.dataset.tab)));
    const chk = (id, key, live = true) => { const el = $(id); el.checked = !!S[key]; el.addEventListener('change', () => { S[key] = el.checked; this._saveSettings(live); }); };
    const rng = (id, key, fmt) => { const el = $(id), o = $(id + '-o'); el.value = S[key]; if (o) o.textContent = fmt(S[key]); el.addEventListener('input', () => { S[key] = +el.value; if (o) o.textContent = fmt(S[key]); this._saveSettings(true); }); };
    $('#s-quality').value = S.quality; $('#s-quality').addEventListener('change', e => { S.quality = e.target.value; this._saveSettings(true); });
    rng('#s-dpr', 'dprScale', v => Math.round(v * 100) + ' %'); rng('#s-fov', 'fov', v => v + '°');
    chk('#s-dof', 'dof'); chk('#s-grain', 'grain'); chk('#s-ca', 'ca'); chk('#s-vignette', 'vignette');
    $('#s-reload').addEventListener('click', () => this.hooks.reloadQuality?.());
    // Audio
    for (const el of $$('[data-vol]', this.root)) { const k = el.dataset.vol, o = el.nextElementSibling; el.value = A.vol[k]; o.textContent = Math.round(A.vol[k] * 100) + ' %'; el.addEventListener('input', () => { A.setVolume(k, +el.value); o.textContent = Math.round(el.value * 100) + ' %'; }); }
    $('#s-voice').value = A.voiceMode; $('#s-voice').addEventListener('change', e => A.setVoiceMode(e.target.value));
    $('#s-rate').value = A.ttsRate; $('#s-rate-o').textContent = '×' + A.ttsRate.toFixed(2);
    $('#s-rate').addEventListener('input', e => { A.ttsRate = +e.target.value; storage.set('ttsRate', A.ttsRate); $('#s-rate-o').textContent = '×' + A.ttsRate.toFixed(2); });
    $('#s-test').addEventListener('click', () => this.hooks.testVoice?.());
    // Steuerung
    rng('#s-sens', 'sens', v => '×' + (+v).toFixed(2)); chk('#s-invert', 'invertY'); chk('#s-plock', 'pointerLock'); chk('#s-cellkeys', 'cellKeys');
    $('#s-keys-reset').addEventListener('click', () => { this.hooks.input?.setKeys({}); this._renderKeys(); });
    // A11y
    chk('#s-subs', 'subtitles'); chk('#s-cb', 'colorblind'); chk('#s-photo', 'photosensitive'); chk('#s-motion', 'reducedMotion'); chk('#s-contrast', 'highContrast'); chk('#s-sus', 'susIndicator'); chk('#s-minhud', 'minimalHud');
    $('#s-subsize').value = S.subSize; $('#s-subsize').addEventListener('change', e => { S.subSize = e.target.value; this._saveSettings(true); });
    $('#s-name').value = S.name; $('#s-name').addEventListener('input', e => { S.name = e.target.value.slice(0, 24); this._saveSettings(false); });
  }
  _tab(id) { for (const tb of $$('[role=tab]', this.root)) tb.setAttribute('aria-selected', String(tb.dataset.tab === id)); for (const p of $$('.tabpanel', this.root)) p.hidden = p.dataset.panel !== id; if (id === 'controls') this._renderKeys(); }
  _refreshSettings() {
    if (!$$('[role=tab][aria-selected=true]', this.root).length) this._tab('gfx');
    const A = this.hooks.audio;
    $('#s-voiceinfo').textContent = A.ttsAvailable ? t('set.voiceInfo', { v: A.tts.voice ? A.tts.voice.name + ' (' + A.tts.voice.lang + ')' : t('set.voiceDefault') }) : t('set.noTTS');
    $('#s-gpu').textContent = this.hooks.gpuInfo?.() || '';
  }
  _renderKeys() {
    const inp = this.hooks.input; if (!inp) return;
    const box = $('#s-keys'); box.innerHTML = '';
    const acts = ['toggleLaptop', 'notes', 'altTab', 'lid', 'brightUp', 'brightDown', 'headphones', 'mute', 'nextRound', 'sign', 'peek', 'pause', 'help'];
    for (const a of acts) {
      const row = document.createElement('div'); row.className = 'keyrow';
      const lab = document.createElement('span'); lab.textContent = t('act.' + a);
      const b = document.createElement('button'); b.className = 'btn btn-small key'; b.textContent = (inp.keys[a] || DEFAULT_KEYS[a]).map(keyLabel).join(' / ');
      b.addEventListener('click', () => {
        b.textContent = t('set.pressKey');
        inp.onKey = e => { e.preventDefault(); inp.onKey = null; if (e.code !== 'Escape') { const k = { ...storage.get('keys', {}) }; k[a] = [e.code]; inp.setKeys(k); } this._renderKeys(); };
      });
      row.append(lab, b); box.append(row);
    }
  }
  _saveSettings(live) { storage.set('settings', this.settings); if (live) this.hooks.applySettings?.(this.settings); }
  // ------------------------------------------------------------------ Hilfe
  _buildHelp() {
    const rows = [['help.k.look', 'help.v.look'], ['help.k.laptop', 'help.v.laptop'], ['help.k.play', 'help.v.play'], ['help.k.notes', 'help.v.notes'], ['help.k.alttab', 'help.v.alttab'], ['help.k.lid', 'help.v.lid'], ['help.k.bright', 'help.v.bright'], ['help.k.phones', 'help.v.phones'], ['help.k.sign', 'help.v.sign'], ['help.k.quiz', 'help.v.quiz'], ['help.k.pause', 'help.v.pause'], ['help.k.pad', 'help.v.pad'], ['help.k.touch', 'help.v.touch']];
    $('#help').innerHTML = `<p class="lead" data-i18n="help.lead"></p><table class="lv-table"><tbody>${rows.map(([k, v]) => `<tr><th data-i18n="${k}"></th><td data-i18n="${v}"></td></tr>`).join('')}</tbody></table>
      <h2 class="h2bar" data-i18n="help.rulesTitle"></h2><div data-i18n-html="help.rules"></div>`;
  }
  // ------------------------------------------------------------------ Zeugnis
  showResult(res, cfg) {
    const newOnes = res.achievements.filter(a => !this.unlocked.has(a));
    for (const a of res.achievements) this.unlocked.add(a);
    storage.set('achievements', [...this.unlocked]);
    const name = this.settings.name || t('cert.anon');
    if (res.reason !== 'aborted') { this.board.push({ name, score: res.total, grade: res.grade, diff: res.difficulty, mode: res.mode, date: new Date().toISOString().slice(0, 10) }); this.board.sort((a, b) => b.score - a.score); this.board = this.board.slice(0, 20); storage.set('leaderboard', this.board); }
    const gradeWord = t('grade.' + res.grade);
    const parts = Object.entries(res.parts).map(([k, v]) => `<tr><th>${esc(t('cert.part.' + k))}</th><td class="num">${v > 0 ? '+' : ''}${v}</td></tr>`).join('');
    const ach = res.achievements.length ? res.achievements.map(a => `<li class="badge on${newOnes.includes(a) ? ' new' : ''}"><span class="b-ico">★</span><b>${esc(t('ach.' + a + '.t'))}</b><small>${esc(t('ach.' + a + '.d'))}</small></li>`).join('') : `<li class="muted">${esc(t('cert.noAch'))}</li>`;
    const reason = t('cert.reason.' + res.reason);
    const mm = Math.floor(res.seconds / 60), ss = String(Math.round(res.seconds % 60)).padStart(2, '0');
    $('#cert').innerHTML = `
      <header class="cert-head">${WORDMARK}<div><div class="cert-uni">${esc(t('brand.university'))}</div><div class="cert-kind">${esc(t('cert.kind'))}</div></div></header>
      <h1>${esc(t('cert.title'))}</h1>
      <table class="lv-table cert-meta"><tbody>
        <tr><th>${esc(t('cert.name'))}</th><td>${esc(name)}</td></tr>
        <tr><th>${esc(t('cert.course'))}</th><td>${esc(t('lv.title'))} · 932.301 · ${esc(t('lv.semesterV'))}</td></tr>
        <tr><th>${esc(t('cert.examiner'))}</th><td>${esc(t('lv.lecturerV'))}</td></tr>
        <tr><th>${esc(t('cert.mode'))}</th><td>${esc(t(typeof cfg.difficulty === 'object' ? 'diff.custom' : 'diff.' + cfg.difficulty))} · ${esc(t('mode.' + res.mode))} · ${mm}:${ss} min</td></tr>
      </tbody></table>
      <div class="grade-box g${res.grade}"><div class="grade-num">${res.grade}</div><div><div class="grade-word">${esc(gradeWord)}</div><div class="grade-reason">${esc(reason)}</div></div></div>
      <div class="cert-grid">
        <div><h2 class="h2bar">${esc(t('cert.score'))}</h2><table class="lv-table"><tbody>${parts}<tr class="total"><th>${esc(t('cert.total'))}</th><td class="num">${res.total}</td></tr></tbody></table>
          <p class="opt-desc">${esc(t('cert.stats', { w: res.wins, l: res.losses, d: res.draws, q: res.quizRight, qa: res.quizAsked, s: res.strikes, c: res.closeCalls, f: Math.round(res.fleiss * 100), lap: res.laptopSeconds }))}</p></div>
        <div><h2 class="h2bar">${esc(t('nav.achievements'))}</h2><ul class="badges small">${ach}</ul></div>
      </div>
      <p class="disclaimer">${esc(t('cert.disclaimer'))}</p>
      <div class="cert-actions"><button class="btn btn-primary" id="r-again">${esc(t('cert.again'))}</button><button class="btn" id="r-lv">${esc(t('cert.change'))}</button><button class="btn" id="r-home">${esc(t('cert.home'))}</button></div>`;
    this.show('result');
    $('#r-again').addEventListener('click', () => this.hooks.start?.(this.cfg, true));
    $('#r-lv').addEventListener('click', () => this.hooks.toMenu?.('lv'));
    $('#r-home').addEventListener('click', () => this.hooks.toMenu?.('start'));
  }
  _renderBadges() {
    $('#badges').innerHTML = ACHIEVEMENTS.map(a => { const on = this.unlocked.has(a); return `<div class="badge${on ? ' on' : ''}"><span class="b-ico" aria-hidden="true">${on ? '★' : '☆'}</span><b>${esc(t('ach.' + a + '.t'))}</b><small>${esc(on ? t('ach.' + a + '.d') : t('ach.' + a + '.hint'))}</small><span class="sr">${on ? t('ach.unlocked') : t('ach.locked')}</span></div>`; }).join('');
  }
  _renderBoard() {
    $('#lb-body').innerHTML = this.board.length ? this.board.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td class="num">${e.score}</td><td>${e.grade}</td><td>${esc(t(e.diff === 'custom' ? 'diff.custom' : 'diff.' + e.diff))}</td><td>${esc(e.date)}</td></tr>`).join('') : `<tr><td colspan="6" class="muted">${esc(t('lb.empty'))}</td></tr>`;
  }
  _refreshDynamic() {
    if (this.screen === 'lv') this._refreshLV();
    if (this.screen === 'achievements') this._renderBadges();
    if (this.screen === 'leaderboard') this._renderBoard();
    if (this.screen === 'settings') { this._refreshSettings(); this._renderKeys(); }
    for (const b of $$('.seat', this.root)) b.setAttribute('aria-label', t('lv.seatLabel', { r: +b.dataset.r + 1, k: +b.dataset.k + 1, m: seatMultiplier(+b.dataset.r).toFixed(2) }));
    this._tipSet = false;
  }
}
export { clamp, getLang };
