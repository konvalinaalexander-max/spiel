// HUD während der Vorlesung: bewusst sparsam. Uhr/Phase, Spielstand, Verwarnungen, Untertitel, Hinweise,
// Quiz-Dialog, „Erwischt“-Einblendung, Bauchgefühl-Anzeige (abschaltbar), Erfolgs-Toasts, Debug (F3).
import { t } from './i18n.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SPEAKER = { prof: 'spk.prof', neighbor: 'spk.neighbor', tutor: 'spk.tutor', student: 'spk.student', opp: 'spk.opp' };

export class HUD {
  constructor(root, settings) {
    this.root = root; this.settings = settings;
    root.innerHTML = `
      <div class="hud-top-left"><div class="hud-clock" id="h-clock">09:57</div><div class="hud-phase" id="h-phase"></div><div class="hud-section" id="h-section"></div></div>
      <div class="hud-top-right"><div class="hud-score" id="h-score"></div><div class="hud-strikes" id="h-strikes" aria-label=""></div></div>
      <div class="hud-sus" id="h-sus" aria-hidden="true"><svg viewBox="0 0 48 28" width="48" height="28"><path d="M2 14 Q24 -6 46 14 Q24 34 2 14Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle id="h-pupil" cx="24" cy="14" r="6" fill="currentColor"/></svg><div class="sus-bar"><i id="h-susbar"></i></div></div>
      <div class="hud-hints" id="h-hints" aria-live="polite"></div>
      <div class="hud-toasts" id="h-toasts" aria-live="polite"></div>
      <div class="hud-prompt" id="h-prompt" hidden></div>
      <div class="hud-modebar" id="h-mode"></div>
      <div class="hud-subs" id="h-subs" aria-live="polite"></div>
      <div class="hud-caught" id="h-caught" hidden><div class="caught-card"><div class="caught-title" id="h-caught-t"></div><div class="caught-text" id="h-caught-x"></div></div></div>
      <div class="hud-quiz" id="h-quiz" hidden role="dialog" aria-modal="false" aria-labelledby="h-quiz-q"></div>
      <div class="hud-cross" id="h-cross"></div>
      <div class="hud-debug" id="h-debug" hidden></div>
      <div class="hud-touch" id="h-touch" hidden><button data-act="toggleLaptop" data-i18n="touch.laptop"></button><button data-act="notes" data-i18n="touch.notes"></button><button data-act="altTab" data-i18n="touch.alttab"></button><button data-act="pause" data-i18n="touch.pause"></button></div>`;
    this.el = id => root.querySelector('#' + id);
    this.subs = []; this.hints = []; this.quizEl = this.el('h-quiz');
    this.applySettings(settings);
  }
  applySettings(s) {
    this.settings = s;
    this.root.style.setProperty('--subtitle-size', { s: '15px', m: '18px', l: '23px', xl: '29px' }[s.subSize] || '18px');
    this.root.classList.toggle('hc', !!s.highContrast);
    this.root.classList.toggle('cb', !!s.colorblind);
    this.el('h-sus').hidden = !s.susIndicator;
    this.el('h-subs').hidden = !s.subtitles;
  }
  show(on) { this.root.hidden = !on; }
  // ------------------------------------------------------------------ Statuszeilen
  setClock(text, phaseKey, section) {
    if (text !== this._clk) { this._clk = text; this.el('h-clock').textContent = text; }
    if (phaseKey !== this._ph) { this._ph = phaseKey; this.el('h-phase').textContent = t('phase.' + phaseKey); }
    if (section !== this._sec) { this._sec = section; this.el('h-section').textContent = section || ''; }
  }
  setScore(ttt, target) {
    const s = ttt.stats, m = ttt.mode;
    const txt = m.bestOf ? t('hud.series', { a: ttt.series.you, b: ttt.series.opp, n: m.bestOf }) : t('hud.wins', { w: s.wins, target, d: s.draws, l: s.losses });
    if (txt !== this._score) { this._score = txt; this.el('h-score').textContent = txt; }
  }
  setStrikes(n) {
    if (n === this._strikes) return; this._strikes = n;
    const el = this.el('h-strikes'); el.innerHTML = [0, 1, 2].map(i => `<span class="strike${i < n ? ' on' : ''}"></span>`).join('');
    el.setAttribute('aria-label', t('hud.strikes', { n }));
  }
  /** Bauchgefühl: Auge öffnet sich mit Aufmerksamkeit, Balken = Verdacht, rot = Beweis */
  setSuspicion(att, sus, ev, looking) {
    const el = this.el('h-sus'); if (el.hidden) return;
    const tier = ev > 25 ? 3 : sus > 40 ? 2 : att > 30 ? 1 : 0;
    if (tier !== this._tier) { this._tier = tier; el.dataset.tier = tier; }
    this.el('h-pupil').setAttribute('r', (3 + Math.min(1, att / 100) * 5).toFixed(1));
    this.el('h-susbar').style.width = Math.round(Math.max(sus, ev)) + '%';
    el.classList.toggle('looking', looking);
  }
  setMode(mode, extra) {
    const key = mode === 'laptop' ? 'hud.mode.laptop' : mode === 'notes' ? 'hud.mode.notes' : 'hud.mode.listen';
    const txt = t(key, extra);
    if (txt !== this._mode) { this._mode = txt; this.el('h-mode').innerHTML = txt; }
  }
  crosshair(on) { this.el('h-cross').hidden = !on; }
  // ------------------------------------------------------------------ Untertitel
  say(speaker, text, dur, kind) {
    if (!this.settings.subtitles) return;
    const box = this.el('h-subs');
    const line = document.createElement('div'); line.className = 'sub ' + (kind || '') + ' spk-' + speaker;
    line.innerHTML = `<b>${esc(t(SPEAKER[speaker] || 'spk.student'))}:</b> ${esc(text)}`;
    box.append(line);
    while (box.children.length > 2) box.firstElementChild.remove();
    const life = Math.max(2.2, dur + 0.8) * 1000;
    setTimeout(() => { line.classList.add('out'); setTimeout(() => line.remove(), 400); }, life);
  }
  clearSubs() { this.el('h-subs').innerHTML = ''; }
  // ------------------------------------------------------------------ Hinweise & Toasts
  hint(id, vars) {
    const box = this.el('h-hints');
    const el = document.createElement('div'); el.className = 'hint';
    el.innerHTML = `<span class="hint-ico">i</span><span>${t('hint.' + id, vars)}</span>`;
    box.append(el); while (box.children.length > 2) box.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 7000);
  }
  toast(text, kind = '') {
    const box = this.el('h-toasts');
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = text;
    box.append(el); while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3800);
  }
  prompt(html) { const el = this.el('h-prompt'); if (!html) { el.hidden = true; this._prompt = null; return; } if (html !== this._prompt) { this._prompt = html; el.innerHTML = html; } el.hidden = false; }
  // ------------------------------------------------------------------ Erwischt
  caught(strike, text, kick, move) {
    const el = this.el('h-caught'); el.hidden = false;
    this.el('h-caught-t').textContent = kick ? t('hud.kicked') : move ? t('hud.moved') : t('hud.caught', { n: strike });
    this.el('h-caught-x').textContent = text;
    el.classList.remove('anim'); void el.offsetWidth; el.classList.add('anim');
    clearTimeout(this._cT); this._cT = setTimeout(() => { el.hidden = true; }, 4200);
  }
  // ------------------------------------------------------------------ Quiz
  quiz(q, hooks) {
    const el = this.quizEl; el.hidden = false; this._quiz = q;
    el.innerHTML = `<div class="quiz-card"><div class="quiz-head"><span class="quiz-tag">${esc(t('quiz.tag'))}</span><span class="quiz-timer"><i id="h-qbar"></i></span></div>
      <p class="quiz-q" id="h-quiz-q">${esc(q.q)}</p>
      <ol class="quiz-a">${q.answers.map((a, i) => `<li><button class="btn quiz-btn" data-i="${i}"><kbd>${i + 1}</kbd> ${esc(a)}</button></li>`).join('')}</ol>
      <div class="quiz-foot"><button class="btn btn-small" id="h-peek" ${hooks.canPeek ? '' : 'disabled'}>${esc(t('quiz.peek'))}</button><span class="muted">${esc(t('quiz.keys'))}</span></div></div>`;
    el.querySelectorAll('.quiz-btn').forEach(b => b.addEventListener('click', () => hooks.answer(+b.dataset.i)));
    el.querySelector('#h-peek').addEventListener('click', () => hooks.peek());
  }
  quizTimer(frac) { const b = this.quizEl.querySelector('#h-qbar'); if (b) b.style.width = Math.max(0, frac * 100) + '%'; }
  quizRemove(i) { const b = this.quizEl.querySelector(`.quiz-btn[data-i="${i}"]`); if (b) { b.disabled = true; b.classList.add('struck'); } const p = this.quizEl.querySelector('#h-peek'); if (p) p.disabled = true; }
  quizResult(r, q) {
    const el = this.quizEl; if (el.hidden) return;
    el.querySelectorAll('.quiz-btn').forEach(b => { const i = +b.dataset.i; b.disabled = true; if (i === r.correctIndex) b.classList.add('right'); else if (i === r.choice) b.classList.add('wrong'); });
    const card = el.querySelector('.quiz-card');
    const msg = document.createElement('div'); msg.className = 'quiz-res ' + r.result;
    msg.innerHTML = `<b>${esc(t('quiz.' + r.result))}</b> ${esc(q.explain || '')}`;
    card.append(msg);
    clearTimeout(this._qT); this._qT = setTimeout(() => { el.hidden = true; }, r.result === 'right' ? 4200 : 6500);
  }
  quizClose() { this.quizEl.hidden = true; }
  // ------------------------------------------------------------------ Debug
  debug(on, text) { const el = this.el('h-debug'); el.hidden = !on; if (on) el.textContent = text; }
  touch(on) { this.el('h-touch').hidden = !on; }
}
