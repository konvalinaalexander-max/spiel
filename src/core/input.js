// Eingabe: Maus (Pointer Lock), Tastatur (frei belegbar), Gamepad, Touch. Liefert abstrahierte Aktionen.
import { storage, clamp } from './util.js';
import { bus } from './util.js';

export const DEFAULT_KEYS = {
  toggleLaptop: ['Space'], notes: ['KeyN'], altTab: ['Tab'], lid: ['KeyL'], brightUp: ['Equal', 'NumpadAdd', 'BracketRight'], brightDown: ['Minus', 'NumpadSubtract', 'Slash'],
  headphones: ['KeyH'], mute: ['KeyM'], nextRound: ['Enter', 'NumpadEnter'], sign: ['KeyE'], pause: ['Escape', 'KeyP'], help: ['F1'], profView: ['F3'],
  lookLeft: ['ArrowLeft', 'KeyA'], lookRight: ['ArrowRight', 'KeyD'], lookUp: ['ArrowUp', 'KeyW'], lookDown: ['ArrowDown', 'KeyS'], snakeUp: ['ArrowUp', 'KeyW'], snakeDown: ['ArrowDown', 'KeyS'], snakeLeft: ['ArrowLeft', 'KeyA'], snakeRight: ['ArrowRight', 'KeyD'],
  answer1: ['Digit1', 'Numpad1'], answer2: ['Digit2', 'Numpad2'], answer3: ['Digit3', 'Numpad3'], answer4: ['Digit4', 'Numpad4'], peek: ['KeyR']
};
// Ziffern 1–9 setzen direkt ein Feld (Ziffernblock-Layout: 7 8 9 oben)
const CELL_KEYS = { Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8, KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyY: 6, KeyZ: 6, KeyX: 7, KeyC: 8 };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = { ...DEFAULT_KEYS, ...storage.get('keys', {}) };
    this.sens = storage.get('mouseSens', 1); this.invertY = storage.get('invertY', false);
    this.down = new Set(); this.pressed = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0, clicks: 0, rclicks: 0, x: 0, y: 0, buttons: 0 };
    this.locked = false; this.enabled = false;
    this.touch = { active: false, look: null, dx: 0, dy: 0, taps: [] };
    this.gp = { connected: false, prev: [], axes: [0, 0, 0, 0] };
    this.onKey = null; // für Tastenbelegung im Menü
    this.cellKeys = storage.get('cellKeys', true);
    const kd = e => {
      if (this.onKey) { this.onKey(e); return; }
      if (!this.enabled) return;
      if (['Tab', 'Space', 'F1', 'F3', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    addEventListener('keydown', kd, { capture: true });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); });
    canvas.addEventListener('mousedown', e => {
      if (!this.enabled) return;
      if (!this.locked && !this.touch.active) { this.requestLock(); }
      if (e.button === 0) this.mouse.clicks++; if (e.button === 2) this.mouse.rclicks++;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (!this.enabled) return;
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
    });
    canvas.addEventListener('wheel', e => { if (this.enabled) { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.enabled) bus.emit('input:unlock');
    });
    // Touch: Ziehen = Umschauen / Cursor, Tippen = Klick
    canvas.addEventListener('touchstart', e => {
      if (!this.enabled) return; this.touch.active = true;
      for (const t of e.changedTouches) if (!this.touch.look) this.touch.look = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now() };
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      const L = this.touch.look; if (!L) return;
      for (const t of e.changedTouches) if (t.identifier === L.id) { this.touch.dx += t.clientX - L.x; this.touch.dy += t.clientY - L.y; L.x = t.clientX; L.y = t.clientY; }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      const L = this.touch.look; if (!L) return;
      for (const t of e.changedTouches) if (t.identifier === L.id) {
        if (performance.now() - L.t0 < 260 && Math.hypot(t.clientX - L.x0, t.clientY - L.y0) < 14) this.touch.taps.push({ x: t.clientX, y: t.clientY });
        this.touch.look = null;
      }
    });
    addEventListener('gamepadconnected', () => { this.gp.connected = true; bus.emit('input:gamepad', true); });
    addEventListener('gamepaddisconnected', () => { this.gp.connected = false; bus.emit('input:gamepad', false); });
  }
  requestLock() { try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch (e) { /* kein Pointer Lock */ } }); } catch (e) { /* kein Pointer Lock */ } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }
  setKeys(k) { this.keys = { ...DEFAULT_KEYS, ...k }; storage.set('keys', k); }
  is(action) { return (this.keys[action] || []).some(c => this.down.has(c)); }
  hit(action) { return (this.keys[action] || []).some(c => this.pressed.has(c)); }
  cellHit() { if (!this.cellKeys) return -1; for (const c of this.pressed) if (c in CELL_KEYS && (c.startsWith('Numpad') || this._laptopFocus)) return CELL_KEYS[c]; return -1; }
  /** Pro Frame einmal aufrufen; gibt zusammengefasste Werte zurück und setzt Zähler zurück */
  poll() {
    const m = this.mouse;
    const out = { dx: m.dx * this.sens, dy: m.dy * this.sens * (this.invertY ? -1 : 1), wheel: m.wheel, click: m.clicks > 0, rclick: m.rclicks > 0, taps: this.touch.taps.splice(0), gp: null };
    out.dx += this.touch.dx * 1.6; out.dy += this.touch.dy * 1.6; this.touch.dx = this.touch.dy = 0;
    m.dx = m.dy = 0; m.wheel = 0; m.clicks = 0; m.rclicks = 0;
    // Gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && [...pads].find(x => x && x.connected);
    if (p) {
      const dz = v => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
      const prev = this.gp.prev; const btn = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const edge = i => btn(i) && !prev[i];
      out.gp = { lx: dz(p.axes[0] || 0), ly: dz(p.axes[1] || 0), rx: dz(p.axes[2] || 0), ry: dz(p.axes[3] || 0), a: edge(0), b: edge(1), x: btn(2), xEdge: edge(2), y: edge(3), lb: btn(4), rb: btn(5), lt: (p.buttons[6]?.value || 0), rt: (p.buttons[7]?.value || 0), back: edge(8), start: edge(9), up: edge(12), down: edge(13), left: edge(14), right: edge(15) };
      this.gp.prev = p.buttons.map(b => b.pressed);
    }
    return out;
  }
  endFrame() { this.pressed.clear(); }
}
export const keyLabel = code => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Numpad', 'Num ').replace('Space', '␣ Leertaste').replace('Escape', 'Esc').replace('Arrow', '');
export { clamp };
