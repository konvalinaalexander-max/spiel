// Studierenden-Laptop: Desktop, Taskleiste, Fenster und Apps (Tic Tac Toe, Snake, Skriptum, BOKUlearn, Mail).
// Gezeichnet in ein 1280×800-Canvas, das als Bildschirmtextur dient.
import { t, getLang } from '../ui/i18n.js';
import { drawBokuLogo } from '../scene/slides.js';
import { clamp, makeRng } from '../core/util.js';

const W = 1280, H = 800, TB = 46;
const FONT = 'Arial, Helvetica, sans-serif';
const C = { bg: '#1b2230', win: '#f4f5f7', title: '#2a3140', text: '#2b2f36', mut: '#7a8290', g: '#00aa5a', x: '#1f9d5c', o: '#e07a2e' };

function wrapLines(c, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/); let line = '';
    for (const w of words) { const tt = line ? line + ' ' + w : w; if (c.measureText(tt).width > maxW && line) { out.push(line); line = w; } else line = tt; }
    out.push(line);
  }
  return out;
}

export class LaptopOS {
  constructor(opts) {
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.opts = opts; // { getTime(), getSections(), sfx(name), ttt, opponent, onNotify(kind) }
    this.ttt = opts.ttt; this.opponent = opts.opponent;
    this.app = 'ttt'; this.lastGame = 'ttt';
    this.cursor = { x: W * 0.55, y: H * 0.5, visible: true };
    this.regions = [];
    this.hover = null;
    this.dirty = true;
    this.brightness = 0.85;
    this.battery = 63;
    this.muted = false;
    this.notifications = [];
    this.switchAnim = 0;
    this.mailOpen = 0;
    this.pdfPage = 0;
    this.rng = makeRng(17);
    this.snake = this._newSnake();
    this.chat = [];
    this.luma = 0.3; this.flicker = 0;
    this._wallpaper = this._makeWallpaper();
    this.closed = false;
    this.mails = null;
  }
  // ------------------------------------------------------------------ API
  get gameVisible() { return this.app === 'ttt' || this.app === 'snake'; }
  focus(app) { if (app === this.app) return; if (app === 'ttt' || app === 'snake') this.lastGame = app; this.app = app; this.switchAnim = 1; this.dirty = true; this.flicker = 1; this.opts.sfx?.('click'); }
  altTab() { this.focus(this.gameVisible ? 'pdf' : this.lastGame); }
  pointerTo(x, y) { const nx = clamp(x, 0, W - 1), ny = clamp(y, 0, H - 1); if (nx !== this.cursor.x || ny !== this.cursor.y) { this.cursor.x = nx; this.cursor.y = ny; this.dirty = true; } }
  pointerBy(dx, dy) { this.pointerTo(this.cursor.x + dx, this.cursor.y + dy); }
  click() {
    const r = this._hit(this.cursor.x, this.cursor.y);
    this.opts.sfx?.('touchpad');
    if (r) { r.fn(); this.dirty = true; return r.id || true; }
    return false;
  }
  key(code) {
    if (this.app === 'snake') {
      const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] }[code];
      if (d) { const s = this.snake; if (s.dead) { this.snake = this._newSnake(); this.snake.running = true; } else if (!(d[0] === -s.dir[0] && d[1] === -s.dir[1])) { s.next = d; s.running = true; } this.opts.sfx?.('key'); return true; }
    }
    if (this.app === 'pdf') {
      if (code === 'ArrowDown' || code === 'PageDown' || code === 'ArrowRight') { this.pdfPage++; this.dirty = true; return true; }
      if (code === 'ArrowUp' || code === 'PageUp' || code === 'ArrowLeft') { this.pdfPage = Math.max(0, this.pdfPage - 1); this.dirty = true; return true; }
    }
    if (this.app === 'mail' && (code === 'ArrowDown' || code === 'ArrowUp')) { const n = this._mails().length; this.mailOpen = (this.mailOpen + (code === 'ArrowDown' ? 1 : n - 1)) % n; this.dirty = true; return true; }
    return false;
  }
  notify(kind, title, body) {
    this.notifications.push({ kind, title, body, t: 5 });
    this.flicker = 1; this.dirty = true;
    if (!this.muted) this.opts.sfx?.('notify');
    this.opts.onNotify?.(kind, this.muted);
  }
  addChat(from, text) { this.chat.push({ from, text, time: this.opts.getTime() }); if (this.chat.length > 40) this.chat.shift(); this.dirty = true; if (this.app !== 'ttt') this.notify('chat', this.opponent.name, text); }
  update(dt, visible) {
    if (this.switchAnim > 0) { this.switchAnim = Math.max(0, this.switchAnim - dt * 4); this.dirty = true; }
    this.flicker = Math.max(0, this.flicker - dt * 2.5);
    for (const n of this.notifications) n.t -= dt;
    if (this.notifications.length && this.notifications[0].t <= 0) { this.notifications.shift(); this.dirty = true; }
    if (this.app === 'snake') this._snakeStep(dt);
    this.battery = Math.max(4, this.battery - dt * 0.004);
    this._clockT = (this._clockT || 0) + dt; if (this._clockT > 1) { this._clockT = 0; this.dirty = true; }
    if (this.ttt?.mode.blitz && !this.ttt.over) this.dirty = true;
    if (this.dirty && visible) { this.draw(); return true; }
    return false;
  }
  // ------------------------------------------------------------------ Zeichnen
  draw() {
    const c = this.ctx; this.regions = [];
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this._wallpaper, 0, 0);
    const lang = getLang();
    // Desktop-Icons
    const apps = [['ttt', t('os.app.ttt')], ['snake', t('os.app.snake')], ['pdf', t('os.app.pdf')], ['browser', t('os.app.browser')], ['mail', t('os.app.mail')]];
    // Fenster
    const wx = 70, wy = 30, ww = W - 140, wh = H - TB - 60;
    this._window(wx, wy, ww, wh, this._title());
    c.save(); c.beginPath(); c.rect(wx, wy + 34, ww, wh - 34); c.clip();
    c.translate(wx, wy + 34);
    const cw = ww, ch = wh - 34;
    if (this.app === 'ttt') this._drawTTT(c, cw, ch);
    else if (this.app === 'snake') this._drawSnake(c, cw, ch);
    else if (this.app === 'pdf') this._drawPDF(c, cw, ch);
    else if (this.app === 'browser') this._drawBrowser(c, cw, ch);
    else if (this.app === 'mail') this._drawMail(c, cw, ch);
    c.restore();
    // Taskleiste
    c.fillStyle = 'rgba(20,24,32,0.94)'; c.fillRect(0, H - TB, W, TB);
    c.fillStyle = '#e9eef5'; c.beginPath(); c.arc(28, H - TB / 2, 12, 0, 7); c.fill();
    c.fillStyle = '#1b2230'; c.fillRect(22, H - TB / 2 - 6, 5, 5); c.fillRect(29, H - TB / 2 - 6, 5, 5); c.fillRect(22, H - TB / 2 + 1, 5, 5); c.fillRect(29, H - TB / 2 + 1, 5, 5);
    apps.forEach(([id, label], i) => {
      const x = 64 + i * 58, y = H - TB + 5, s = 36;
      const on = this.app === id;
      if (on) { c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x - 4, y - 2, s + 8, s + 4); c.fillStyle = C.g; c.fillRect(x + 6, H - 4, s - 12, 3); }
      this._icon(c, id, x, y, s);
      this._region(x - 4, y - 2, s + 8, s + 4, () => this.focus(id), 'app:' + id, label);
    });
    // Infobereich rechts
    const tm = this.opts.getTime();
    c.fillStyle = '#e9eef5'; c.font = `15px ${FONT}`; c.textAlign = 'right';
    c.fillText(tm.hm, W - 16, H - 26); c.font = `12px ${FONT}`; c.fillText(tm.date, W - 16, H - 10);
    c.textAlign = 'left';
    // Akku
    const bx = W - 150, by = H - 30;
    c.strokeStyle = '#e9eef5'; c.lineWidth = 1.5; c.strokeRect(bx, by, 26, 13); c.fillRect(bx + 26, by + 4, 3, 5);
    c.fillStyle = this.battery < 15 ? '#e05b4b' : '#e9eef5'; c.fillRect(bx + 2, by + 2, 22 * this.battery / 100, 9);
    c.font = `12px ${FONT}`; c.fillStyle = '#e9eef5'; c.fillText(Math.round(this.battery) + '%', bx - 34, by + 11);
    // WLAN
    const wxp = W - 205, wyp = H - 16;
    for (let i = 1; i <= 3; i++) { c.strokeStyle = '#e9eef5'; c.lineWidth = 2; c.beginPath(); c.arc(wxp, wyp, i * 5, -Math.PI * 0.75, -Math.PI * 0.25); c.stroke(); }
    c.fillStyle = '#c9d2de'; c.font = `11px ${FONT}`; c.fillText('eduroam', wxp - 60, H - 12);
    // Lautsprecher (klickbar: stumm)
    const sx = W - 255, sy = H - 30;
    c.fillStyle = '#e9eef5'; c.fillRect(sx, sy + 4, 5, 6); c.beginPath(); c.moveTo(sx + 5, sy + 4); c.lineTo(sx + 11, sy); c.lineTo(sx + 11, sy + 14); c.lineTo(sx + 5, sy + 10); c.fill();
    if (this.muted) { c.strokeStyle = '#e05b4b'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx + 14, sy + 2); c.lineTo(sx + 22, sy + 12); c.moveTo(sx + 22, sy + 2); c.lineTo(sx + 14, sy + 12); c.stroke(); }
    else { c.strokeStyle = '#e9eef5'; c.lineWidth = 1.5; c.beginPath(); c.arc(sx + 12, sy + 7, 5, -0.8, 0.8); c.stroke(); c.beginPath(); c.arc(sx + 12, sy + 7, 9, -0.8, 0.8); c.stroke(); }
    this._region(sx - 4, sy - 4, 30, 24, () => { this.muted = !this.muted; }, 'mute');
    // Benachrichtigung
    const n = this.notifications[0];
    if (n) {
      const nx = W - 380, ny = 16, a = clamp(n.t, 0, 1);
      c.globalAlpha = a; c.fillStyle = 'rgba(30,36,48,0.96)'; c.fillRect(nx, ny, 360, 86);
      c.fillStyle = C.g; c.fillRect(nx, ny, 5, 86);
      c.fillStyle = '#fff'; c.font = `bold 16px ${FONT}`; c.fillText(n.title, nx + 18, ny + 30);
      c.fillStyle = '#c9d2de'; c.font = `14px ${FONT}`; wrapLines(c, n.body, 320).slice(0, 2).forEach((l, i) => c.fillText(l, nx + 18, ny + 54 + i * 18));
      c.globalAlpha = 1;
    }
    // Tooltip
    const hv = this._hit(this.cursor.x, this.cursor.y);
    if (hv && hv.tip) { c.font = `13px ${FONT}`; const tw = c.measureText(hv.tip).width + 16; c.fillStyle = 'rgba(20,24,32,0.95)'; c.fillRect(this.cursor.x + 14, this.cursor.y - 30, tw, 22); c.fillStyle = '#fff'; c.fillText(hv.tip, this.cursor.x + 22, this.cursor.y - 14); }
    // App-Wechsel-Animation
    if (this.switchAnim > 0) { c.fillStyle = `rgba(255,255,255,${this.switchAnim * 0.25})`; c.fillRect(0, 0, W, H - TB); }
    // Helligkeit
    if (this.brightness < 1) { c.fillStyle = `rgba(0,0,0,${(1 - this.brightness) * 0.85})`; c.fillRect(0, 0, W, H); }
    // Cursor
    if (this.cursor.visible) this._cursor(c, this.cursor.x, this.cursor.y, hv);
    this.luma = this._appLuma() * this.brightness;
    this.dirty = false;
    this.texture && (this.texture.needsUpdate = true);
    return lang;
  }
  _appLuma() { return { ttt: 0.32, snake: 0.18, pdf: 0.82, browser: 0.78, mail: 0.8 }[this.app] ?? 0.5; }
  _title() {
    switch (this.app) {
      case 'ttt': return t('os.title.ttt', { name: this.opponent.name });
      case 'snake': return t('os.title.snake');
      case 'pdf': return t('os.title.pdf');
      case 'browser': return t('os.title.browser');
      default: return t('os.title.mail');
    }
  }
  _window(x, y, w, h, title) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 6, y + 8, w, h);
    c.fillStyle = C.win; c.fillRect(x, y, w, h);
    c.fillStyle = C.title; c.fillRect(x, y, w, 34);
    c.fillStyle = '#e9eef5'; c.font = `15px ${FONT}`; c.fillText(title, x + 14, y + 22);
    c.strokeStyle = '#c9d2de'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x + w - 100, y + 18); c.lineTo(x + w - 88, y + 18); c.stroke();
    c.strokeRect(x + w - 64, y + 11, 12, 12);
    c.beginPath(); c.moveTo(x + w - 28, y + 11); c.lineTo(x + w - 16, y + 23); c.moveTo(x + w - 16, y + 11); c.lineTo(x + w - 28, y + 23); c.stroke();
  }
  _icon(c, id, x, y, s) {
    c.save(); c.translate(x, y);
    const r = (cx, cy, w, h, col) => { c.fillStyle = col; c.fillRect(cx, cy, w, h); };
    if (id === 'ttt') { r(0, 0, s, s, '#26324a'); c.strokeStyle = '#8da0c4'; c.lineWidth = 2; for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(i * s / 3, 5); c.lineTo(i * s / 3, s - 5); c.moveTo(5, i * s / 3); c.lineTo(s - 5, i * s / 3); c.stroke(); } c.strokeStyle = '#4fd18b'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, 6); c.lineTo(s / 3 - 3, s / 3 - 3); c.moveTo(s / 3 - 3, 6); c.lineTo(6, s / 3 - 3); c.stroke(); c.strokeStyle = '#f0954a'; c.beginPath(); c.arc(s / 2, s / 2, 5, 0, 7); c.stroke(); }
    else if (id === 'snake') { r(0, 0, s, s, '#101820'); c.fillStyle = '#58d68d'; for (let i = 0; i < 5; i++) c.fillRect(6 + i * 5, 20 - (i > 2 ? (i - 2) * 5 : 0), 5, 5); c.fillStyle = '#e74c3c'; c.fillRect(26, 8, 5, 5); }
    else if (id === 'pdf') { r(4, 0, s - 8, s, '#fff'); r(4, 0, s - 8, 9, '#c0392b'); c.fillStyle = '#fff'; c.font = `bold 8px ${FONT}`; c.fillText('PDF', 9, 8); for (let i = 0; i < 4; i++) r(9, 14 + i * 5, s - 18 - (i % 2) * 6, 2, '#999'); }
    else if (id === 'browser') { r(0, 0, s, s, '#fff'); r(0, 0, s, 8, '#ddd'); drawBokuLogo(c, 4, 12, 9); r(4, 26, s - 8, 2, '#bbb'); r(4, 30, s - 14, 2, '#bbb'); }
    else if (id === 'mail') { r(1, 6, s - 2, s - 12, '#3a7bd5'); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(2, 7); c.lineTo(s / 2, s / 2 + 2); c.lineTo(s - 2, 7); c.stroke(); const unread = this._mails().filter(m => !m.read && m.visible).length; if (unread) { c.fillStyle = '#e05b4b'; c.beginPath(); c.arc(s - 3, 4, 7, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = `bold 10px ${FONT}`; c.fillText(String(unread), s - 6, 8); } }
    c.restore();
  }
  _cursor(c, x, y, hv) {
    c.save(); c.translate(x, y);
    if (hv) { // Hand
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(3, 0); c.lineTo(3, 9); c.lineTo(9, 9); c.lineTo(11, 18); c.lineTo(2, 18); c.lineTo(-3, 11); c.lineTo(0, 9); c.closePath(); c.fill(); c.stroke();
    } else {
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 20); c.lineTo(5, 15); c.lineTo(9, 23); c.lineTo(12, 22); c.lineTo(8, 14); c.lineTo(14, 14); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }
  _region(x, y, w, h, fn, id, tip) { this.regions.push({ x, y, w, h, fn, id, tip }); }
  _hit(x, y) { for (let i = this.regions.length - 1; i >= 0; i--) { const r = this.regions[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; } return null; }
  _makeWallpaper() {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'); const r = makeRng(5);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7fa7c9'); g.addColorStop(0.55, '#d9e4ea'); g.addColorStop(1, '#6f9a5b');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const ridge = (base, amp, col, f) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, base - Math.abs(Math.sin(x * f + base)) * amp - Math.sin(x * f * 3.1) * amp * 0.2); c.lineTo(W, H); c.fill(); };
    ridge(430, 160, '#8ea3b5', 0.004); ridge(470, 110, '#71889c', 0.006);
    c.fillStyle = 'rgba(255,255,255,0.8)'; // Schneefelder
    for (let i = 0; i < 30; i++) c.fillRect(r.next() * W, 300 + r.next() * 60, 20 + r.next() * 30, 3);
    ridge(560, 50, '#5e8a4a', 0.009); ridge(620, 30, '#4f7a3d', 0.013);
    return cv;
  }
  _mails() {
    if (!this.mails) {
      const keys = ['oeh', 'online', 'exkursion', 'mensa', 'peer'];
      this.mails = keys.map((k, i) => ({ key: k, read: i > 1, visible: i < 3, from: t(`os.mail.${k}.from`), subject: t(`os.mail.${k}.subject`), body: t(`os.mail.${k}.body`), time: t(`os.mail.${k}.time`) }));
    }
    return this.mails;
  }
  deliverMail(key) { const m = this._mails().find(x => x.key === key); if (m && !m.visible) { m.visible = true; m.read = false; this.notify('mail', m.from, m.subject); } }
  refreshLang() { this.mails = null; this.dirty = true; }

  // ------------------------------------------------------------------ Tic Tac Toe
  _drawTTT(c, w, h) {
    const g = this.ttt; const op = this.opponent;
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1f2a40'); bg.addColorStop(1, '#141b2b'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const cs = 150, bx = 70, by = (h - cs * 3) / 2 + 4;
    const lastBoard = g.board;
    // Brett
    for (let i = 0; i < 9; i++) {
      const x = bx + (i % 3) * cs, y = by + Math.floor(i / 3) * cs;
      const hover = this._hit(this.cursor.x - 70, this.cursor.y - 64);
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(x + 4, y + 4, cs - 8, cs - 8);
      const canPlay = g.canPlay(i);
      this._region(70 + x, 64 + y, cs, cs, () => { if (this.ttt.canPlay(i)) this.opts.onCell?.(i); }, 'cell:' + i, null);
      const cur = this.cursor.x - 70 >= x && this.cursor.x - 70 < x + cs && this.cursor.y - 64 >= y && this.cursor.y - 64 < y + cs;
      if (cur && canPlay) { c.fillStyle = 'rgba(79,209,139,0.16)'; c.fillRect(x + 4, y + 4, cs - 8, cs - 8); }
      const v = lastBoard[i];
      const cx = x + cs / 2, cy = y + cs / 2;
      const fresh = i === g.lastMove ? 1 : 0;
      if (v === 'X') { c.strokeStyle = '#4fd18b'; c.lineWidth = 14; c.lineCap = 'round'; const d = 42; c.beginPath(); c.moveTo(cx - d, cy - d); c.lineTo(cx + d, cy + d); c.moveTo(cx + d, cy - d); c.lineTo(cx - d, cy + d); c.stroke(); if (this.opts.colorblind) { c.fillStyle = '#fff'; c.fillRect(cx - 5, cy - 5, 10, 10); } }
      else if (v === 'O') { c.strokeStyle = '#f0954a'; c.lineWidth = 13; c.beginPath(); c.arc(cx, cy, 44, 0, 7); c.stroke(); if (this.opts.colorblind) { c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 6, 0, 7); c.fill(); } }
      else { c.fillStyle = 'rgba(255,255,255,0.18)'; c.font = `16px ${FONT}`; c.fillText(String(i + 1), x + 12, y + 26); }
      if (fresh && v) { c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 3; c.strokeRect(x + 6, y + 6, cs - 12, cs - 12); }
    }
    c.strokeStyle = '#5a6c94'; c.lineWidth = 6; c.lineCap = 'round';
    for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(bx + i * cs, by + 12); c.lineTo(bx + i * cs, by + 3 * cs - 12); c.stroke(); c.beginPath(); c.moveTo(bx + 12, by + i * cs); c.lineTo(bx + 3 * cs - 12, by + i * cs); c.stroke(); }
    if (g.over && g.over.line) {
      const p = k => [bx + (k % 3) * cs + cs / 2, by + Math.floor(k / 3) * cs + cs / 2];
      const [a, b] = [p(g.over.line[0]), p(g.over.line[2])];
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 9; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
    }
    // rechte Spalte: Status, Spielstand, Chat
    const px = bx + cs * 3 + 50, pw = w - px - 30;
    c.fillStyle = '#e9eef5'; c.font = `bold 22px ${FONT}`; c.fillText(t('os.ttt.you') + '  X', px, 50);
    c.fillStyle = '#f0954a'; c.fillText(op.name + '  O', px, 82);
    c.fillStyle = '#8f9bb8'; c.font = `14px ${FONT}`; c.fillText(op.where, px, 104);
    const s = g.stats;
    c.fillStyle = '#e9eef5'; c.font = `bold 40px ${FONT}`; c.fillText(`${s.wins} : ${s.losses}`, px, 160);
    c.fillStyle = '#8f9bb8'; c.font = `14px ${FONT}`; c.fillText(t('os.ttt.score', { d: s.draws, target: this.opts.target() }), px, 184);
    if (g.mode.bestOf) c.fillText(t('os.ttt.series', { a: g.series.you, b: g.series.opp, n: g.mode.bestOf }), px, 204);
    // Statuszeile
    let status, col = '#e9eef5';
    if (g.over) {
      if (g.over.winner === 'X') { status = t('os.ttt.won'); col = '#4fd18b'; }
      else if (g.over.winner === 'O') { status = t('os.ttt.lost'); col = '#f07a6a'; }
      else if (g.over.winner === 'draw') status = t('os.ttt.draw');
      else status = t('os.ttt.aborted');
    } else if (g.turn === 'X') { status = t('os.ttt.yourturn'); col = '#4fd18b'; }
    else status = op.typing ? t('os.ttt.oppturn_typing', { name: op.name }) : t('os.ttt.oppturn', { name: op.name });
    c.fillStyle = col; c.font = `bold 20px ${FONT}`; c.fillText(status, px, 244);
    if (g.mode.blitz && !g.over) {
      const k = clamp(g.moveTimer / g.mode.blitz, 0, 1);
      c.fillStyle = '#2c3954'; c.fillRect(px, 256, pw, 8); c.fillStyle = k < 0.3 ? '#f07a6a' : '#4fd18b'; c.fillRect(px, 256, pw * k, 8);
    }
    if (g.over) {
      const bw2 = 190; c.fillStyle = C.g; c.fillRect(px, 276, bw2, 40); c.fillStyle = '#fff'; c.font = `bold 16px ${FONT}`; c.fillText(t('os.ttt.next'), px + 18, 302);
      this._region(70 + px, 64 + 276, bw2, 40, () => this.opts.onNextRound?.(), 'next');
    }
    // Chat
    const cy0 = 336, chH = h - cy0 - 20;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px, cy0, pw, chH);
    c.fillStyle = '#8f9bb8'; c.font = `bold 12px ${FONT}`; c.fillText(t('os.ttt.chat'), px + 12, cy0 + 20);
    c.font = `15px ${FONT}`;
    let yy = cy0 + chH - 14;
    for (let i = this.chat.length - 1; i >= 0 && yy > cy0 + 34; i--) {
      const m = this.chat[i]; const lines = wrapLines(c, (m.from === 'me' ? t('os.ttt.you') : op.name) + ': ' + m.text, pw - 24);
      for (let k = lines.length - 1; k >= 0 && yy > cy0 + 34; k--) { c.fillStyle = m.from === 'me' ? '#9fe0bd' : '#f3c9a6'; c.fillText(lines[k], px + 12, yy); yy -= 20; }
      yy -= 4;
    }
    if (op.typing) { c.fillStyle = '#8f9bb8'; c.font = `italic 13px ${FONT}`; c.fillText(t('os.ttt.typing', { name: op.name }), px + 12, cy0 + chH - 2 + 0); }
  }

  // ------------------------------------------------------------------ Snake
  _newSnake() { return { body: [[12, 8], [11, 8], [10, 8]], dir: [1, 0], next: [1, 0], food: [18, 8], t: 0, score: 0, best: this.snake ? this.snake.best : 0, dead: false, running: false }; }
  _snakeStep(dt) {
    const s = this.snake; if (!s.running || s.dead) return;
    s.t += dt; const step = Math.max(0.08, 0.16 - s.score * 0.003);
    if (s.t < step) return; s.t = 0;
    s.dir = s.next;
    const head = [s.body[0][0] + s.dir[0], s.body[0][1] + s.dir[1]];
    if (head[0] < 0 || head[1] < 0 || head[0] >= 28 || head[1] >= 16 || s.body.some(p => p[0] === head[0] && p[1] === head[1])) { s.dead = true; s.best = Math.max(s.best, s.score); this.opts.sfx?.('snakeDie'); this.opts.onSnake?.(s.score); this.dirty = true; return; }
    s.body.unshift(head);
    if (head[0] === s.food[0] && head[1] === s.food[1]) { s.score++; this.opts.sfx?.('snakeEat'); do { s.food = [this.rng.int(0, 27), this.rng.int(0, 15)]; } while (s.body.some(p => p[0] === s.food[0] && p[1] === s.food[1])); }
    else s.body.pop();
    this.dirty = true;
  }
  _drawSnake(c, w, h) {
    const s = this.snake; const cs = Math.floor(Math.min((w - 60) / 28, (h - 90) / 16));
    const ox = (w - cs * 28) / 2, oy = 60;
    c.fillStyle = '#0e151d'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e9eef5'; c.font = `bold 20px ${FONT}`; c.fillText(t('os.snake.score', { s: s.score, b: s.best }), ox, 38);
    c.fillStyle = '#121d27'; c.fillRect(ox, oy, cs * 28, cs * 16);
    c.fillStyle = '#e74c3c'; c.fillRect(ox + s.food[0] * cs + 3, oy + s.food[1] * cs + 3, cs - 6, cs - 6);
    s.body.forEach((p, i) => { c.fillStyle = i ? '#3fbf74' : '#7ef0a8'; c.fillRect(ox + p[0] * cs + 1, oy + p[1] * cs + 1, cs - 2, cs - 2); });
    if (!s.running || s.dead) { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(ox, oy + cs * 6, cs * 28, cs * 4); c.fillStyle = '#fff'; c.font = `bold 22px ${FONT}`; c.textAlign = 'center'; c.fillText(s.dead ? t('os.snake.dead') : t('os.snake.start'), ox + cs * 14, oy + cs * 8 + 8); c.textAlign = 'left'; }
  }

  // ------------------------------------------------------------------ Skriptum (PDF)
  _drawPDF(c, w, h) {
    c.fillStyle = '#525659'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#323639'; c.fillRect(0, 0, w, 40);
    c.fillStyle = '#e8eaed'; c.font = `14px ${FONT}`; c.fillText(t('os.pdf.file'), 16, 25);
    const secs = this.opts.getSections();
    const pages = this._pdfPages(secs);
    this.pdfPage = clamp(this.pdfPage, 0, pages.length - 1);
    c.textAlign = 'right'; c.fillText(`${this.pdfPage + 1} / ${pages.length}`, w - 20, 25); c.textAlign = 'left';
    const pw = 620, px = (w - pw) / 2, py = 56;
    c.fillStyle = '#fff'; c.fillRect(px, py, pw, h - py + 40);
    const pg = pages[this.pdfPage];
    drawBokuLogo(c, px + 40, py + 30, 26);
    c.fillStyle = '#929191'; c.font = `11px ${FONT}`; c.fillText(t('os.pdf.header'), px + 110, py + 48);
    c.fillStyle = '#222'; c.font = `bold 22px ${FONT}`; c.fillText(pg.title, px + 40, py + 100);
    c.fillStyle = '#00aa5a'; c.fillRect(px + 40, py + 110, pw - 80, 2);
    c.fillStyle = '#333'; c.font = `15px Georgia, 'Times New Roman', serif`;
    let y = py + 140;
    for (const l of pg.lines) { c.fillText(l, px + 40, y); y += 22; }
    if (pg.marked) { c.fillStyle = 'rgba(255,230,80,0.45)'; c.fillRect(px + 38, py + 140 + pg.marked * 22 - 16, pw - 90, 20); }
    c.fillStyle = '#929191'; c.font = `11px ${FONT}`; c.fillText(t('os.pdf.footer', { n: this.pdfPage + 1 }), px + 40, h - 10);
  }
  _pdfPages(secs) {
    const key = secs.map(s => s.id).join(',') + getLang();
    if (this._pdfKey === key) return this._pdfCache;
    const c = this.ctx; c.font = `15px Georgia, 'Times New Roman', serif`;
    const pages = [];
    for (const s of secs) {
      const lines = wrapLines(c, s.script, 540);
      for (let i = 0; i < lines.length; i += 20) pages.push({ title: s.title, lines: lines.slice(i, i + 20), marked: i === 0 ? 3 + (s.order % 5) : 0 });
    }
    if (!pages.length) pages.push({ title: t('os.pdf.empty'), lines: [], marked: 0 });
    this._pdfKey = key; this._pdfCache = pages;
    return pages;
  }

  // ------------------------------------------------------------------ BOKUlearn
  _drawBrowser(c, w, h) {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e8eaed'; c.fillRect(0, 0, w, 44);
    c.fillStyle = '#fff'; c.fillRect(12, 8, 280, 36); c.fillStyle = '#333'; c.font = `13px ${FONT}`; c.fillText(t('os.web.tab'), 24, 31);
    c.fillStyle = '#f1f3f4'; c.fillRect(0, 44, w, 40); c.fillStyle = '#fff'; c.fillRect(60, 50, w - 120, 28);
    c.fillStyle = '#5f6368'; c.font = `14px ${FONT}`; c.fillText('learn.boku.ac.at/course/view.php?id=…', 76, 69);
    c.fillStyle = '#fff'; c.fillRect(0, 84, w, 60); drawBokuLogo(c, 30, 96, 36);
    c.fillStyle = '#474747'; c.font = `bold 18px ${FONT}`; c.fillText('BOKUlearn', 120, 122);
    c.fillStyle = '#00aa5a'; c.fillRect(0, 144, w, 4);
    c.fillStyle = '#222'; c.font = `bold 26px ${FONT}`; c.fillText(t('os.web.course'), 30, 192);
    c.fillStyle = '#929191'; c.font = `14px ${FONT}`; c.fillText(t('os.web.crumb'), 30, 216);
    const box = (x, y, bw, title, items) => {
      c.fillStyle = '#efefef'; c.fillRect(x, y, bw, 34); c.fillStyle = '#222'; c.font = `bold 16px ${FONT}`; c.fillText(title, x + 14, y + 23);
      c.font = `15px ${FONT}`; items.forEach((it, i) => { c.fillStyle = it.startsWith('•') ? '#474747' : '#00aa5a'; c.fillText(it, x + 14, y + 62 + i * 26); });
    };
    box(30, 240, w / 2 - 45, t('os.web.news'), t('os.web.newsItems').split('|'));
    const secs = this.opts.getAllSections();
    box(w / 2 + 15, 240, w / 2 - 45, t('os.web.materials'), secs.slice(0, 11).map((s, i) => `📄 ${String(i + 1).padStart(2, '0')} ${s.title}`));
  }

  // ------------------------------------------------------------------ Mail
  _drawMail(c, w, h) {
    const mails = this._mails().filter(m => m.visible);
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f3f6fb'; c.fillRect(0, 0, 360, h);
    c.fillStyle = '#222'; c.font = `bold 18px ${FONT}`; c.fillText(t('os.mail.inbox'), 20, 34);
    this.mailOpen = clamp(this.mailOpen, 0, Math.max(0, mails.length - 1));
    mails.forEach((m, i) => {
      const y = 54 + i * 78; const on = i === this.mailOpen;
      if (on) { c.fillStyle = '#dbe8f8'; c.fillRect(0, y, 360, 76); }
      c.fillStyle = '#222'; c.font = `${m.read ? '' : 'bold '}15px ${FONT}`; c.fillText(m.from, 20, y + 24);
      c.fillStyle = '#5f6368'; c.font = `12px ${FONT}`; c.fillText(m.time, 300, y + 24);
      c.fillStyle = '#333'; c.font = `${m.read ? '' : 'bold '}14px ${FONT}`; c.fillText(m.subject.slice(0, 40), 20, y + 46);
      if (!m.read) { c.fillStyle = '#3a7bd5'; c.beginPath(); c.arc(9, y + 20, 4, 0, 7); c.fill(); }
      this._region(70, 64 + y, 360, 76, () => { this.mailOpen = i; m.read = true; }, 'mail:' + i);
    });
    const m = mails[this.mailOpen];
    if (m) {
      m.read = true;
      c.fillStyle = '#222'; c.font = `bold 22px ${FONT}`; c.fillText(m.subject, 390, 44);
      c.fillStyle = '#5f6368'; c.font = `14px ${FONT}`; c.fillText(m.from + ' · ' + m.time, 390, 70);
      c.fillStyle = '#333'; c.font = `16px ${FONT}`;
      wrapLines(c, m.body, w - 430).forEach((l, i) => c.fillText(l, 390, 110 + i * 24));
    }
  }
}
export const LAPTOP_SIZE = { W, H };
