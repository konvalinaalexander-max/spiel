// Synthese nur noch für die fünf Signaltöne des Laptop-OS (Auftrag V3, Anhang E: höchstens 5 synthetische UI-Töne).
// Alle anderen Klänge, alle Atmosphären und der Hall kommen aus echten Aufnahmen (src/audio/sfx.js, tools/audio/build_sfx.py).
// Ein Name, für den eine Aufnahme existiert, wird übersprungen.

const SR = 44100;
const OAC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (typeof webkitOfflineAudioContext !== 'undefined' ? webkitOfflineAudioContext : null);

function filt(ctx, type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function env(ctx, t, a, d, peak = 1) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.max(a, 0.001));
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}
function osc(ctx, type, f, t, dur) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur); return o; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

async function render(seconds, build) {
  if (!OAC) return null;
  const ctx = new OAC(1, Math.ceil(seconds * SR), SR);
  build(ctx, ctx.destination);
  return ctx.startRendering();
}
/** Spitzenpegel in das Fenster −12 … −1 dBFS bringen (nichts übersteuert, nichts verschwindet). */
const PEAK_MAX = 0.891, PEAK_MIN = 0.251;
function normalize(buf) {
  if (!buf) return buf;
  const d = buf.getChannelData(0); let pk = 0;
  for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
  if (pk < 1e-6) return buf;
  const g = Math.min(PEAK_MAX, Math.max(PEAK_MIN, pk)) / pk;
  if (Math.abs(g - 1) > 1e-3) for (let i = 0; i < d.length; i++) d[i] *= g;
  return buf;
}

// ---------------------------------------------------------------------------- Signaltöne des Laptop-OS (UI)
const SOUNDS = {
  notify: [0.7, (c, o) => { const t = 0.01; for (const [f, d] of [[1318, 0], [1760, 0.12]]) chain(osc(c, 'sine', f, t + d, 0.5), env(c, t + d, 0.005, 0.4, 0.35), o); }],
  ttWin: [0.8, (c, o) => { [784, 988, 1175].forEach((f, i) => chain(osc(c, 'triangle', f, 0.02 + i * 0.08, 0.3), env(c, 0.02 + i * 0.08, 0.005, 0.25, 0.25), o)); }],
  ttLose: [0.8, (c, o) => { [440, 349].forEach((f, i) => chain(osc(c, 'triangle', f, 0.02 + i * 0.15, 0.35), env(c, 0.02 + i * 0.15, 0.005, 0.3, 0.25), o)); }],
  snakeEat: [0.15, (c, o) => { const s = osc(c, 'square', 600, 0.005, 0.1); s.frequency.linearRampToValueAtTime(1200, 0.08); chain(s, filt(c, 'lowpass', 2500), env(c, 0.005, 0.002, 0.08, 0.15), o); }],
  snakeDie: [0.5, (c, o) => { const s = osc(c, 'square', 400, 0.005, 0.4); s.frequency.linearRampToValueAtTime(100, 0.35); chain(s, filt(c, 'lowpass', 1500), env(c, 0.005, 0.01, 0.35, 0.15), o); }]
};

/** Erzeugt die UI-Töne, für die es keine Aufnahme gibt; progress(k) wird aufgerufen. Liefert {name: [AudioBuffer]} */
export async function synthesizeAll(progress, skip = new Set()) {
  const out = {}; const names = Object.keys(SOUNDS).filter(n => !skip.has(n));
  let done = 0;
  for (const n of names) {
    const [dur, fn] = SOUNDS[n];
    const b = normalize(await render(dur, fn));
    if (b) out[n] = [b];
    progress && progress(++done / names.length);
  }
  if (!names.length) progress && progress(1);
  return out;
}
export const SOUND_NAMES = Object.keys(SOUNDS);
