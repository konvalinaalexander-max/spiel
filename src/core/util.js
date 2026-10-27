// Kleine, abhängigkeitsfreie Helfer: Mathe, Zufall (seeded), Rauschen, Easing.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const angleDamp = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
export const deg = d => (d * Math.PI) / 180;
export const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/** Deterministischer Zufallsgenerator (mulberry32). */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    gauss: () => { let u = 0, v = 0; while (u === 0) u = next(); while (v === 0) v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); },
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    fork: s => makeRng((seed * 9301 + 49297 + s * 233280) >>> 0)
  };
  return rng;
}
export const hashString = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Kachelbares 2D-Value-Noise mit FBM. Periodisch in [0, period). */
export function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  const r = makeRng(seed);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = r.next();
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function value(x, y, period) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const h = (a, b) => vals[perm[(perm[a & 255] + b) & 255]];
    const u = fade(xf), v = fade(yf);
    return lerp(lerp(h(x0, y0), h(x1, y0), u), lerp(h(x0, y1), h(x1, y1), u), v);
  }
  return {
    value,
    /** fbm(x,y) mit x,y in [0,1), Grundfrequenz freq (ganzzahlig für Kachelbarkeit) */
    fbm(x, y, freq = 4, octaves = 4, gain = 0.5) {
      let sum = 0, amp = 1, norm = 0, f = freq;
      for (let o = 0; o < octaves; o++) { sum += value(x * f, y * f, f) * amp; norm += amp; amp *= gain; f *= 2; }
      return sum / norm;
    }
  };
}

export class EventBus {
  constructor() { this.map = new Map(); }
  on(type, fn) { if (!this.map.has(type)) this.map.set(type, new Set()); this.map.get(type).add(fn); return () => this.map.get(type).delete(fn); }
  emit(type, data) { const s = this.map.get(type); if (s) for (const fn of [...s]) fn(data); const all = this.map.get('*'); if (all) for (const fn of [...all]) fn(type, data); }
}
export const bus = new EventBus();

export const storage = {
  get(key, fallback) { try { const v = localStorage.getItem('boku-ttt-v2:' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
  set(key, value) { try { localStorage.setItem('boku-ttt-v2:' + key, JSON.stringify(value)); } catch (e) { /* privater Modus o. ä. */ } }
};

export const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
