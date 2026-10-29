// Schiebetafel-Flügel mit Kreide-Canvas: Strich-für-Strich-Animation, Altspuren, Wischen.
import * as THREE from 'three';
import { layoutText } from './strokefont.js';
import { makeRng, makeNoise, clamp } from '../core/util.js';

const GRAIN_N = 256;
let GRAIN = null;
function grain() {
  if (GRAIN) return GRAIN;
  const n = makeNoise(77), r = makeRng(78);
  GRAIN = new Float32Array(GRAIN_N * GRAIN_N);
  for (let y = 0; y < GRAIN_N; y++) for (let x = 0; x < GRAIN_N; x++) {
    const v = n.fbm(x / GRAIN_N, y / GRAIN_N, 32, 3) * 0.7 + r.next() * 0.3;
    GRAIN[y * GRAIN_N + x] = clamp((v - 0.25) * 1.9, 0.05, 1);
  }
  return GRAIN;
}

export class ChalkPanel {
  /**
   * opts: { width (m), height (m), px (Breite in Pixel), seed, ghost: [Text…] }
   */
  constructor(gfx, opts) {
    this.wM = opts.width; this.hM = opts.height;
    this.W = opts.px; this.H = Math.round(opts.px * opts.height / opts.width);
    this.pxPerM = this.W / this.wM;
    this.rng = makeRng(opts.seed || 3);
    this.canvas = document.createElement('canvas'); this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.bg = document.createElement('canvas'); this.bg.width = this.W; this.bg.height = this.H;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = gfx.renderer.capabilities.getMaxAnisotropy();
    // Teil-Uploads: beim Schreiben wird nur das Rechteck der neuen Kreidetupfer übertragen (texSubImage2D aus dem Canvas),
    // sonst müsste die 4096er-Textur 20-mal pro Sekunde komplett hochgeladen werden. flipY aus, die Tafelfläche hat gespiegelte UVs.
    this.tex.flipY = false;
    this.srcTex = new THREE.Texture(this.canvas); // nie in einem Material – Quelle für copyTextureToTexture
    this.renderer = gfx.renderer; this.box = null;
    this.jobs = []; this.job = null; this.dirty = true; this.uploadT = 0;
    this.pen = null; this.penDown = false; this.chalkPressure = 0;
    this.written = 0; this.cursorY = 0.16; // nächste freie Zeile (m von oben)
    this.color = opts.color || '#26372e';
    this._drawBackground(opts.ghost || []);
    this.ctx.drawImage(this.bg, 0, 0);
    this.wipe = null;
  }
  _drawBackground(ghost) {
    const c = this.bg.getContext('2d'), W = this.W, H = this.H, r = this.rng;
    c.fillStyle = this.color; c.fillRect(0, 0, W, H);
    // großflächige Wischspuren und Kreidestaub-Schleier
    for (let i = 0; i < 70; i++) {
      const x = r.next() * W, y = r.next() * H, rw = (0.15 + r.next() * 0.6) * W * 0.3, rh = (0.05 + r.next() * 0.2) * H;
      const g = c.createRadialGradient(x, y, 0, x, y, rw);
      g.addColorStop(0, `rgba(220,225,215,${0.018 + r.next() * 0.03})`); g.addColorStop(1, 'rgba(220,225,215,0)');
      c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, rh / rw); c.translate(-x, -y); c.fillRect(x - rw, y - rw, rw * 2, rw * 2); c.restore();
    }
    // horizontale Wischbahnen des Schwamms
    for (let i = 0; i < 9; i++) {
      const y = r.next() * H, h = H * (0.06 + r.next() * 0.08);
      c.fillStyle = `rgba(255,255,255,${0.012 + r.next() * 0.015})`;
      c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= W; x += W / 20) c.lineTo(x, y + Math.sin(x * 0.004 + i) * h * 0.2); c.lineTo(W, y + h); c.lineTo(0, y + h); c.fill();
    }
    // halb gelöschte Altformeln
    const g = grain();
    for (const t of ghost) {
      const lay = layoutText(t.text, { size: t.size * this.pxPerM, x: t.x * this.pxPerM, y: t.y * this.pxPerM, rng: r.next, jitter: 0.06 });
      c.strokeStyle = `rgba(230,232,225,${t.alpha ?? 0.07})`; c.lineWidth = Math.max(2, t.size * this.pxPerM * 0.09); c.lineCap = 'round'; c.lineJoin = 'round';
      for (const s of lay.strokes) { c.beginPath(); s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    }
    // Kreidestaub an der Unterkante
    for (let i = 0; i < 900; i++) {
      const x = r.next() * W, y = H - r.next() * r.next() * H * 0.06;
      c.fillStyle = `rgba(235,235,228,${0.05 + r.next() * 0.12 * g[(i * 37) % g.length]})`;
      c.fillRect(x, y, 1 + r.next() * 3, 1 + r.next() * 2);
    }
  }
  /** Schreibt Zeilen ab Position (x,y in m von links oben). Gibt Job zurück. */
  write(lines, opts = {}) {
    const size = (opts.size ?? 0.105) * this.pxPerM;
    const lh = (opts.lineHeight ?? 1.75) * size;
    const x0 = (opts.x ?? 0.18) * this.pxPerM;
    let y = (opts.y ?? this.cursorY) * this.pxPerM + size;
    const strokes = []; let total = 0;
    for (const line of lines) {
      const lay = layoutText(line, { size, x: x0 + (this.rng.next() - 0.5) * size * 0.2, y, rng: this.rng.next, jitter: 0.05, slant: 0.05 + this.rng.next() * 0.03 });
      // leichte Zeilenneigung
      const tilt = (this.rng.next() - 0.5) * 0.012;
      for (const s of lay.strokes) { for (const p of s) p[1] += (p[0] - x0) * tilt; strokes.push(s); }
      total += lay.total;
      y += lh;
    }
    this.cursorY = y / this.pxPerM - size / this.pxPerM * 0.6;
    const job = { strokes, total, done: 0, si: 0, pi: 1, carry: 0, width: size * 0.085, finished: false, lines };
    this.jobs.push(job);
    return job;
  }
  /** Platz für weitere Zeilen? */
  spaceLeft() { return this.hM - this.cursorY; }
  get busy() { return !!(this.job || this.jobs.length || this.wipe); }
  /** Schreibgeschwindigkeit in px/s; gibt Stiftposition (px) zurück oder null */
  update(dt, speedPx) {
    if (this.wipe) return this._updateWipe(dt);
    if (!this.job) this.job = this.jobs.shift() || null;
    const job = this.job;
    if (!job) { this.penDown = false; this._upload(dt); return null; }
    let budget = speedPx * dt;
    const c = this.ctx, g = grain();
    const w = job.width;
    while (budget > 0 && job.si < job.strokes.length) {
      const s = job.strokes[job.si];
      if (job.pi >= s.length) { job.si++; job.pi = 1; job.carry = 0; budget -= w * 4; this.penDown = false; continue; } // Absetzen kostet Zeit
      const a = s[job.pi - 1], b = s[job.pi];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const start = job.carry;
      const take = Math.min(segLen - start, budget);
      // Kreidetupfer entlang des Segments
      const step = Math.max(0.8, w * 0.28);
      for (let d = start; d < start + take; d += step) {
        const t = segLen > 0 ? d / segLen : 0;
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        const gi = ((Math.floor(y * 1.7) & (GRAIN_N - 1)) * GRAIN_N) + (Math.floor(x * 1.7) & (GRAIN_N - 1));
        const al = g[gi] * (0.5 + 0.5 * this.rng.next());
        if (al < 0.12) continue;
        c.fillStyle = `rgba(243,243,236,${(al * 0.55).toFixed(3)})`;
        const s2 = w * (0.65 + 0.5 * this.rng.next());
        const rx = x - s2 / 2 + (this.rng.next() - 0.5) * w * 0.35, ry = y - s2 / 2 + (this.rng.next() - 0.5) * w * 0.35;
        c.fillRect(rx, ry, s2, s2);
        this._grow(rx, ry, s2);
      }
      job.carry += take; budget -= take; job.done += take;
      this.pen = [a[0] + (b[0] - a[0]) * (job.carry / (segLen || 1)), a[1] + (b[1] - a[1]) * (job.carry / (segLen || 1))];
      this.penDown = true;
      if (job.carry >= segLen - 1e-3) { job.pi++; job.carry = 0; }
    }
    if (job.si >= job.strokes.length) { job.finished = true; this.job = null; this.penDown = false; if (job.onDone) job.onDone(); }
    this.dirty = true;
    this._upload(dt);
    return this.pen;
  }
  _grow(x, y, s) {
    const b = this.box || (this.box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x + s); b.y1 = Math.max(b.y1, y + s);
  }
  _upload(dt) {
    this.uploadT -= dt;
    if (!this.dirty || this.uploadT > 0) return;
    this.uploadT = 1 / 30; this.dirty = false;
    const b = this.box; this.box = null;
    const ready = this.renderer.properties.get(this.tex).__webglInit && !this.tex.needsUpdate;
    if (!b || !ready || this._full) { this._full = false; this.tex.needsUpdate = true; return; }
    const x0 = Math.max(0, Math.floor(b.x0) - 2), y0 = Math.max(0, Math.floor(b.y0) - 2), x1 = Math.min(this.W, Math.ceil(b.x1) + 2), y1 = Math.min(this.H, Math.ceil(b.y1) + 2);
    if (x1 <= x0 || y1 <= y0) return;
    this.renderer.copyTextureToTexture(this.srcTex, this.tex, new THREE.Box2(new THREE.Vector2(x0, y0), new THREE.Vector2(x1, y1)), new THREE.Vector2(x0, y0));
  }
  /** Wischen: Schwamm-Bahnen von links nach rechts */
  startWipe(duration = 5) {
    this.jobs = []; this.job = null;
    this.wipe = { t: 0, dur: duration, lastX: 0 };
  }
  _updateWipe(dt) {
    const wp = this.wipe; wp.t += dt;
    const k = clamp(wp.t / wp.dur, 0, 1);
    const x = k * this.W;
    const c = this.ctx;
    // zwischen lastX und x Spalten abwischen (Bahnen auf/ab)
    const band = this.W / 9;
    for (let xx = wp.lastX; xx < x; xx += 6) {
      const bi = Math.floor(xx / band);
      c.globalAlpha = 0.5;
      c.drawImage(this.bg, xx, 0, 8, this.H, xx, 0, 8, this.H);
      c.globalAlpha = 1;
      c.fillStyle = `rgba(230,232,225,${0.03 + 0.02 * (bi % 2)})`;
      c.fillRect(xx, 0, 8, this.H);
    }
    wp.lastX = x;
    this.dirty = true; this._full = true; this._upload(dt);
    const penY = (0.5 + 0.38 * Math.sin(wp.t * 5.5)) * this.H;
    this.pen = [x, penY];
    if (k >= 1) {
      // Rest leicht verwischt lassen
      c.globalAlpha = 0.85; c.drawImage(this.bg, 0, 0); c.globalAlpha = 1;
      this.wipe = null; this.cursorY = 0.16; this.tex.needsUpdate = true;
    }
    return this.pen;
  }
  clearInstant() { this.ctx.drawImage(this.bg, 0, 0); this.cursorY = 0.16; this.jobs = []; this.job = null; this.tex.needsUpdate = true; }
  /** px → lokale Panel-Koordinaten in m (Ursprung Mitte, +y oben) */
  pxToLocal(p, out = new THREE.Vector3()) { return out.set(p[0] / this.pxPerM - this.wM / 2, this.hM / 2 - p[1] / this.pxPerM, 0); }
}
