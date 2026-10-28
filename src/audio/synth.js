// Prozedurale Klangerzeugung mit OfflineAudioContext. Jede Funktion baut einen Graphen in `ctx` auf.
// Loops werden mit Überblendung an der Schnittstelle nahtlos gemacht (kein Knacken).

const SR = 44100;
const OAC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (typeof webkitOfflineAudioContext !== 'undefined' ? webkitOfflineAudioContext : null);
let rngState = 12345;
const rnd = () => { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; };

function noiseBuffer(ctx, seconds, color = 'white') {
  const n = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; }
    else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}
function src(ctx, buf, t = 0, loop = false) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.start(t); return s; }
function filt(ctx, type, f, q = 0.7, gain = 0) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; }
function env(ctx, t, a, d, peak = 1, sus = 0, rel = 0) {
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.max(a, 0.001));
  if (sus > 0) { g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0002), t + a + d); g.gain.setValueAtTime(Math.max(sus, 0.0002), t + a + d + rel); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + rel + 0.05); }
  else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  return g;
}
function osc(ctx, type, f, t, dur) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur); return o; }
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

async function render(seconds, build, channels = 1) {
  if (!OAC) return null;
  const ctx = new OAC(channels, Math.ceil(seconds * SR), SR);
  build(ctx, ctx.destination);
  return ctx.startRendering();
}
/**
 * Pegel-Normalisierung der Einzelklänge: Spitzenpegel in das Fenster −12 … −1 dBFS bringen.
 * Das Klangdesign (laut/leise) bleibt innerhalb des Fensters erhalten; nichts übersteuert, nichts verschwindet.
 */
const PEAK_MAX = 0.891, PEAK_MIN = 0.251;
function normalize(buf) {
  if (!buf) return buf;
  let pk = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } }
  if (pk < 1e-6) return buf;
  const target = Math.min(PEAK_MAX, Math.max(PEAK_MIN, pk)), g = target / pk;
  if (Math.abs(g - 1) > 1e-3) for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= g; }
  return buf;
}
/** nahtloser Loop: rendert len+xf, blendet Ende in Anfang über */
async function renderLoop(len, xf, build, channels = 1) {
  const buf = await render(len + xf, build, channels);
  if (!buf) return null;
  const n = Math.floor(len * SR), x = Math.floor(xf * SR);
  const out = new AudioBuffer({ length: n, numberOfChannels: buf.numberOfChannels, sampleRate: SR });
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const s = buf.getChannelData(ch), d = out.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = s[i];
    for (let i = 0; i < x; i++) { const k = i / x; d[i] = s[i] * Math.sin(k * Math.PI / 2) + s[n + i] * Math.cos(k * Math.PI / 2); }
  }
  return out;
}

// ---------------------------------------------------------------------------- Einzelklänge
const SOUNDS = {
  chalkTap: [0.12, (c, o) => { const t = 0.005; chain(src(c, noiseBuffer(c, 0.12), t), filt(c, 'bandpass', 2600 + rnd() * 1200, 1.4), env(c, t, 0.002, 0.05, 0.5), o); chain(src(c, noiseBuffer(c, 0.05), t), filt(c, 'lowpass', 700), env(c, t, 0.001, 0.02, 0.6), o); }],
  chalkScratch: [0.35, (c, o) => { const t = 0.01; const g = env(c, t, 0.02, 0.3, 0.35); chain(src(c, noiseBuffer(c, 0.35), t), filt(c, 'bandpass', 3400, 2.2), g, o); const s2 = chain(src(c, noiseBuffer(c, 0.35), t), filt(c, 'highpass', 5000)); const g2 = env(c, t, 0.02, 0.28, 0.08); s2.connect(g2); g2.connect(o); }],
  stepParquet: [0.25, (c, o) => { const t = 0.005; chain(src(c, noiseBuffer(c, 0.2), t), filt(c, 'bandpass', 900, 1.0), env(c, t, 0.002, 0.08, 0.7), o); chain(osc(c, 'sine', 95, t, 0.12), env(c, t, 0.002, 0.09, 0.5), o); chain(src(c, noiseBuffer(c, 0.2), t + 0.03), filt(c, 'highpass', 2500), env(c, t + 0.03, 0.002, 0.04, 0.15), o); }],
  stepCarpet: [0.25, (c, o) => { const t = 0.005; chain(src(c, noiseBuffer(c, 0.2, 'pink'), t), filt(c, 'lowpass', 420), env(c, t, 0.01, 0.12, 0.9), o); }],
  stepStair: [0.3, (c, o) => { const t = 0.005; chain(src(c, noiseBuffer(c, 0.25), t), filt(c, 'bandpass', 600, 0.8), env(c, t, 0.002, 0.12, 0.8), o); chain(osc(c, 'sine', 70, t, 0.15), env(c, t, 0.002, 0.12, 0.7), o); }],
  chairCreak: [0.6, (c, o) => { const t = 0.02; const s = src(c, noiseBuffer(c, 0.6), t); const f = filt(c, 'bandpass', 900, 18); f.frequency.setValueAtTime(700 + rnd() * 400, t); f.frequency.linearRampToValueAtTime(1100 + rnd() * 500, t + 0.4); chain(s, f, env(c, t, 0.08, 0.4, 0.9), o); }],
  seatFlip: [0.4, (c, o) => { const t = 0.01; chain(src(c, noiseBuffer(c, 0.3), t), filt(c, 'lowpass', 1200), env(c, t, 0.001, 0.12, 1), o); chain(osc(c, 'triangle', 180, t, 0.2), env(c, t, 0.001, 0.15, 0.4), o); }],
  cough: [0.9, (c, o) => { for (let k = 0; k < 2; k++) { const t = 0.02 + k * (0.26 + rnd() * 0.1); const f = filt(c, 'bandpass', 500 + rnd() * 300, 1.2); chain(src(c, noiseBuffer(c, 0.4), t), f, env(c, t, 0.01, 0.2, 0.9 - k * 0.3), o); chain(osc(c, 'sawtooth', 120 + rnd() * 60, t, 0.15), filt(c, 'lowpass', 600), env(c, t, 0.01, 0.12, 0.25), o); } }],
  coughHigh: [0.8, (c, o) => { for (let k = 0; k < 2; k++) { const t = 0.02 + k * 0.24; chain(src(c, noiseBuffer(c, 0.35), t), filt(c, 'bandpass', 900 + rnd() * 300, 1.4), env(c, t, 0.01, 0.17, 0.8 - k * 0.3), o); chain(osc(c, 'sawtooth', 220 + rnd() * 50, t, 0.12), filt(c, 'lowpass', 900), env(c, t, 0.01, 0.1, 0.2), o); } }],
  throatClear: [0.7, (c, o) => { const t = 0.02; const s = osc(c, 'sawtooth', 105, t, 0.6); s.frequency.linearRampToValueAtTime(140, t + 0.4); chain(s, filt(c, 'lowpass', 700), env(c, t, 0.05, 0.45, 0.35), o); chain(src(c, noiseBuffer(c, 0.6), t), filt(c, 'bandpass', 700, 1), env(c, t, 0.05, 0.45, 0.4), o); }],
  pageTurn: [0.6, (c, o) => { const t = 0.01; const f = filt(c, 'bandpass', 2500, 0.6); f.frequency.setValueAtTime(1500, t); f.frequency.linearRampToValueAtTime(4500, t + 0.35); chain(src(c, noiseBuffer(c, 0.6), t), f, env(c, t, 0.08, 0.35, 0.5), o); }],
  penClick: [0.12, (c, o) => { for (const t of [0.005, 0.05]) chain(src(c, noiseBuffer(c, 0.03), t), filt(c, 'bandpass', 4200, 3), env(c, t, 0.001, 0.015, 0.8), o); }],
  penWrite: [0.5, (c, o) => { const t = 0.01; const g = env(c, t, 0.03, 0.4, 0.2); chain(src(c, noiseBuffer(c, 0.5), t), filt(c, 'bandpass', 5200, 1.6), g, o); }],
  keyClick: [0.08, (c, o) => { const t = 0.002; chain(src(c, noiseBuffer(c, 0.05), t), filt(c, 'bandpass', 3000 + rnd() * 1500, 2), env(c, t, 0.001, 0.025, 0.6), o); chain(src(c, noiseBuffer(c, 0.05), t + 0.01), filt(c, 'lowpass', 900), env(c, t + 0.01, 0.001, 0.02, 0.3), o); }],
  touchpad: [0.06, (c, o) => { const t = 0.002; chain(src(c, noiseBuffer(c, 0.04), t), filt(c, 'bandpass', 2000, 3), env(c, t, 0.001, 0.012, 0.6), o); }],
  hinge: [0.5, (c, o) => { const t = 0.01; const f = filt(c, 'bandpass', 600, 12); f.frequency.linearRampToValueAtTime(900, t + 0.4); chain(src(c, noiseBuffer(c, 0.5), t), f, env(c, t, 0.05, 0.38, 0.5), o); }],
  lidClose: [0.4, (c, o) => { const t = 0.01; chain(src(c, noiseBuffer(c, 0.2), t), filt(c, 'lowpass', 1500), env(c, t, 0.001, 0.08, 1), o); chain(osc(c, 'sine', 160, t, 0.15), env(c, t, 0.001, 0.1, 0.5), o); }],
  notify: [0.7, (c, o) => { const t = 0.01; for (const [f, d] of [[1318, 0], [1760, 0.12]]) chain(osc(c, 'sine', f, t + d, 0.5), env(c, t + d, 0.005, 0.4, 0.35), o); }],
  heart: [0.6, (c, o) => { for (const [d, a] of [[0.01, 1], [0.2, 0.7]]) { const s = osc(c, 'sine', 62, d, 0.18); s.frequency.exponentialRampToValueAtTime(40, d + 0.15); chain(s, env(c, d, 0.005, 0.15, a), o); } }],
  breath: [1.4, (c, o) => { const t = 0.02; chain(src(c, noiseBuffer(c, 1.4, 'pink'), t), filt(c, 'bandpass', 900, 0.6), env(c, t, 0.4, 0.8, 0.25), o); }],
  clicker: [0.08, (c, o) => { const t = 0.002; chain(src(c, noiseBuffer(c, 0.03), t), filt(c, 'bandpass', 3500, 4), env(c, t, 0.001, 0.01, 0.7), o); }],
  micFeedback: [1.6, (c, o) => { const t = 0.05; const s = osc(c, 'sine', 2900, t, 1.4); s.frequency.linearRampToValueAtTime(3050, t + 1.2); chain(s, env(c, t, 0.4, 0.9, 0.18), o); }],
  micThump: [0.4, (c, o) => { const t = 0.01; chain(osc(c, 'sine', 70, t, 0.3), env(c, t, 0.002, 0.25, 1), o); chain(src(c, noiseBuffer(c, 0.2), t), filt(c, 'lowpass', 400), env(c, t, 0.002, 0.1, 0.6), o); }],
  glass: [0.8, (c, o) => { const t = 0.01; chain(osc(c, 'sine', 2350, t, 0.7), env(c, t, 0.001, 0.6, 0.2), o); chain(osc(c, 'sine', 3510, t, 0.5), env(c, t, 0.001, 0.4, 0.1), o); chain(src(c, noiseBuffer(c, 0.05), t), filt(c, 'highpass', 3000), env(c, t, 0.001, 0.02, 0.3), o); }],
  pour: [1.6, (c, o) => { const t = 0.05; const f = filt(c, 'bandpass', 900, 3); f.frequency.linearRampToValueAtTime(1600, t + 1.3); chain(src(c, noiseBuffer(c, 1.6), t), f, env(c, t, 0.1, 1.3, 0.3), o); }],
  bottleDrop: [1.5, (c, o) => { const t = 0.01; chain(src(c, noiseBuffer(c, 0.2), t), filt(c, 'lowpass', 900), env(c, t, 0.001, 0.12, 1), o); for (let k = 1; k < 7; k++) { const tt = t + 0.15 * k + rnd() * 0.05; chain(osc(c, 'triangle', 300 + rnd() * 80, tt, 0.06), env(c, tt, 0.001, 0.05, 0.3 / k), o); } }],
  doorOpen: [1.2, (c, o) => { const t = 0.01; chain(src(c, noiseBuffer(c, 0.1), t), filt(c, 'bandpass', 1800, 2), env(c, t, 0.001, 0.05, 0.7), o); const f = filt(c, 'bandpass', 300, 6); f.frequency.linearRampToValueAtTime(420, t + 0.8); chain(src(c, noiseBuffer(c, 1.0), t + 0.1), f, env(c, t + 0.1, 0.1, 0.7, 0.3), o); }],
  doorClose: [1.0, (c, o) => { const t = 0.02; chain(osc(c, 'sine', 85, t, 0.4), env(c, t, 0.002, 0.35, 1), o); chain(src(c, noiseBuffer(c, 0.3), t), filt(c, 'lowpass', 700), env(c, t, 0.002, 0.2, 0.9), o); chain(src(c, noiseBuffer(c, 0.08), t + 0.05), filt(c, 'bandpass', 2400, 3), env(c, t + 0.05, 0.001, 0.05, 0.5), o); }],
  doorBang: [1.4, (c, o) => { const t = 0.02; chain(osc(c, 'sine', 65, t, 0.6), env(c, t, 0.001, 0.55, 1), o); chain(src(c, noiseBuffer(c, 0.5), t), filt(c, 'lowpass', 1200), env(c, t, 0.001, 0.35, 1), o); }],
  sponge: [1.2, (c, o) => { const t = 0.02; const f = filt(c, 'bandpass', 1400, 0.8); chain(src(c, noiseBuffer(c, 1.2), t), f, env(c, t, 0.15, 0.9, 0.4), o); }],
  boardSlide: [1.8, (c, o) => { const t = 0.02; const f = filt(c, 'bandpass', 220, 3); f.frequency.linearRampToValueAtTime(320, t + 1.4); chain(src(c, noiseBuffer(c, 1.8), t), f, env(c, t, 0.2, 1.3, 0.8), o); chain(osc(c, 'sine', 55, t + 1.45, 0.3), env(c, t + 1.45, 0.002, 0.25, 0.9), o); }],
  phoneRing: [3.2, (c, o) => { const notes = [1318, 988, 1175, 1568, 1318, 988, 1175, 1568]; notes.forEach((f, i) => { const t = 0.05 + i * 0.18 + Math.floor(i / 4) * 0.5; chain(osc(c, 'square', f, t, 0.16), filt(c, 'lowpass', 3000), env(c, t, 0.005, 0.15, 0.15), o); }); }],
  phoneVibrate: [1.2, (c, o) => { for (const t of [0.02, 0.55]) { const s = osc(c, 'sawtooth', 160, t, 0.4); chain(s, filt(c, 'lowpass', 400), env(c, t, 0.02, 0.36, 0.5), o); } }],
  tramBell: [1.6, (c, o) => { for (const t of [0.02, 0.38]) { [1046, 2093, 3140].forEach((f, k) => chain(osc(c, 'sine', f * (1 + rnd() * 0.003), t, 1.1), env(c, t, 0.001, 1.0 - k * 0.2, 0.25 / (k + 1)), o)); } }],
  bird: [1.2, (c, o) => { let t = 0.02; for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) { const s = osc(c, 'sine', 3200 + rnd() * 1500, t, 0.12); s.frequency.exponentialRampToValueAtTime(2200 + rnd() * 2000, t + 0.1); chain(s, env(c, t, 0.005, 0.1, 0.25), o); t += 0.09 + rnd() * 0.08; } }],
  zipper: [0.8, (c, o) => { for (let k = 0; k < 18; k++) { const t = 0.02 + k * 0.035; chain(src(c, noiseBuffer(c, 0.02), t), filt(c, 'bandpass', 3000 + k * 80, 3), env(c, t, 0.001, 0.015, 0.4), o); } }],
  cloth: [0.7, (c, o) => { const t = 0.02; chain(src(c, noiseBuffer(c, 0.7, 'pink'), t), filt(c, 'bandpass', 1800, 0.5), env(c, t, 0.1, 0.5, 0.35), o); }],
  laughSoft: [1.4, (c, o) => { for (let k = 0; k < 5; k++) { const t = 0.05 + k * 0.17; const s = osc(c, 'sawtooth', 170 + rnd() * 90, t, 0.13); chain(s, filt(c, 'bandpass', 900, 2), env(c, t, 0.01, 0.1, 0.12), o); chain(src(c, noiseBuffer(c, 0.13), t), filt(c, 'bandpass', 1400, 1), env(c, t, 0.01, 0.1, 0.1), o); } }],
  ttWin: [0.8, (c, o) => { [784, 988, 1175].forEach((f, i) => chain(osc(c, 'triangle', f, 0.02 + i * 0.08, 0.3), env(c, 0.02 + i * 0.08, 0.005, 0.25, 0.25), o)); }],
  ttLose: [0.8, (c, o) => { [440, 349].forEach((f, i) => chain(osc(c, 'triangle', f, 0.02 + i * 0.15, 0.35), env(c, 0.02 + i * 0.15, 0.005, 0.3, 0.25), o)); }],
  ttPlace: [0.15, (c, o) => { chain(osc(c, 'sine', 900, 0.005, 0.1), env(c, 0.005, 0.002, 0.08, 0.25), o); }],
  snakeEat: [0.15, (c, o) => { const s = osc(c, 'square', 600, 0.005, 0.1); s.frequency.linearRampToValueAtTime(1200, 0.08); chain(s, filt(c, 'lowpass', 2500), env(c, 0.005, 0.002, 0.08, 0.15), o); }],
  snakeDie: [0.5, (c, o) => { const s = osc(c, 'square', 400, 0.005, 0.4); s.frequency.linearRampToValueAtTime(100, 0.35); chain(s, filt(c, 'lowpass', 1500), env(c, 0.005, 0.01, 0.35, 0.15), o); }],
  sting: [1.6, (c, o) => { [[659, 0], [523, 0.16], [392, 0.34]].forEach(([f, d]) => chain(osc(c, 'sawtooth', f, 0.02 + d, 0.8), filt(c, 'lowpass', 1800), env(c, 0.02 + d, 0.01, 0.7, 0.12), o)); }],
  quizSting: [0.6, (c, o) => { chain(osc(c, 'sine', 660, 0.01, 0.3), env(c, 0.01, 0.005, 0.25, 0.2), o); chain(osc(c, 'sine', 990, 0.14, 0.4), env(c, 0.14, 0.005, 0.35, 0.2), o); }],
  good: [0.7, (c, o) => { chain(osc(c, 'sine', 784, 0.01, 0.3), env(c, 0.01, 0.005, 0.25, 0.2), o); chain(osc(c, 'sine', 1175, 0.12, 0.5), env(c, 0.12, 0.005, 0.45, 0.2), o); }],
  uiClick: [0.06, (c, o) => { chain(osc(c, 'sine', 1400, 0.002, 0.04), env(c, 0.002, 0.001, 0.03, 0.2), o); }],
  murmurBurst: [2.0, (c, o) => { const s = src(c, noiseBuffer(c, 2, 'pink'), 0.02); chain(s, filt(c, 'bandpass', 700, 0.8), env(c, 0.02, 0.4, 1.4, 0.4), o); }]
};

// ---------------------------------------------------------------------------- Loops
const LOOPS = {
  ventilation: [8, 1.5, (c, o) => { chain(src(c, noiseBuffer(c, 9.5, 'pink'), 0), filt(c, 'lowpass', 520), filt(c, 'highshelf', 2000, 0.7, -12), gainNode(c, 0.6), o); chain(osc(c, 'sine', 100, 0, 9.5), gainNode(c, 0.015), o); }],
  projectorFan: [6, 1.2, (c, o) => { chain(src(c, noiseBuffer(c, 7.2), 0), filt(c, 'bandpass', 1500, 0.6), gainNode(c, 0.25), o); [190, 380, 570].forEach((f, i) => chain(osc(c, 'sine', f, 0, 7.2), gainNode(c, 0.02 / (i + 1)), o)); }],
  roomTone: [10, 2, (c, o) => { chain(src(c, noiseBuffer(c, 12, 'brown'), 0), filt(c, 'lowpass', 180), gainNode(c, 0.5), o); }],
  murmur: [9, 2, (c, o) => {
    // Pausengemurmel: viele überlagerte Silben-Hüllkurven auf formantgefiltertem Rauschen
    const base = src(c, noiseBuffer(c, 11, 'pink'), 0);
    const f1 = filt(c, 'bandpass', 600, 1.2), f2 = filt(c, 'bandpass', 1500, 1.5);
    const g = c.createGain(); g.gain.value = 0;
    let t = 0; while (t < 11) { const a = 0.15 + rnd() * 0.25; g.gain.setValueAtTime(0.05, t); g.gain.linearRampToValueAtTime(a, t + 0.06); g.gain.linearRampToValueAtTime(0.08, t + 0.18 + rnd() * 0.1); t += 0.12 + rnd() * 0.16; }
    base.connect(f1); base.connect(f2); f1.connect(g); f2.connect(g); g.connect(o);
  }],
  rain: [8, 2, (c, o) => {
    chain(src(c, noiseBuffer(c, 10, 'pink'), 0), filt(c, 'highpass', 600), filt(c, 'lowpass', 7000), gainNode(c, 0.7), o);
    for (let k = 0; k < 220; k++) { const t = rnd() * 10; chain(src(c, noiseBuffer(c, 0.03), t), filt(c, 'bandpass', 2500 + rnd() * 3000, 3), env(c, t, 0.001, 0.02, 0.2 + rnd() * 0.3), o); }
  }],
  wind: [10, 3, (c, o) => { const s = src(c, noiseBuffer(c, 13, 'pink'), 0); const f = filt(c, 'bandpass', 400, 0.7); for (let t = 0; t < 13; t += 1.3) f.frequency.linearRampToValueAtTime(250 + rnd() * 500, t); const g = c.createGain(); for (let t = 0; t < 13; t += 1.7) g.gain.linearRampToValueAtTime(0.2 + rnd() * 0.5, t); chain(s, f, g, o); }],
  traffic: [12, 3, (c, o) => { chain(src(c, noiseBuffer(c, 15, 'brown'), 0), filt(c, 'lowpass', 300), gainNode(c, 0.6), o); const s = src(c, noiseBuffer(c, 15, 'pink'), 0); const g = c.createGain(); g.gain.value = 0.02; for (let t = 1; t < 14; t += 4 + rnd() * 3) { g.gain.linearRampToValueAtTime(0.02, t); g.gain.linearRampToValueAtTime(0.18, t + 1.5); g.gain.linearRampToValueAtTime(0.02, t + 3.5); } chain(s, filt(c, 'bandpass', 500, 0.6), g, o); }]
};
function gainNode(c, v) { const g = c.createGain(); g.gain.value = v; return g; }

/** Hörsaal-Impulsantwort (stereo): frühe Reflexionen + exponentieller Nachhall, höhenbedämpft */
export function makeImpulse(ctx, rt60 = 1.15, preDelay = 0.018) {
  const len = Math.floor((rt60 * 1.4 + preDelay) * ctx.sampleRate);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    const pd = Math.floor(preDelay * ctx.sampleRate);
    for (let i = pd; i < len; i++) {
      const t = (i - pd) / ctx.sampleRate;
      const decay = Math.pow(10, (-3 * t) / rt60);
      const damp = 0.25 + 0.7 * Math.exp(-t * 2.2); // hohe Frequenzen klingen schneller ab
      lp = lp + damp * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * decay * 0.6;
    }
    // frühe Reflexionen (Wände/Decke)
    for (const [ms, a] of [[11, 0.5], [17, 0.35], [23, 0.3], [31, 0.25], [43, 0.2], [57, 0.15]]) {
      const i = pd + Math.floor((ms + (ch ? 1.3 : 0)) * ctx.sampleRate / 1000); if (i < len) d[i] += a * (ch ? -1 : 1);
    }
  }
  return buf;
}

/** Erzeugt alle Klänge; progress(k) wird aufgerufen. Liefert {name: AudioBuffer} */
export async function synthesizeAll(progress) {
  const out = {}; const names = Object.keys(SOUNDS), loops = Object.keys(LOOPS);
  const total = names.length + loops.length + 8; let done = 0;
  const tick = () => progress && progress(++done / total);
  // Varianten für häufige Klänge
  const variants = { chalkTap: 4, stepParquet: 4, stepCarpet: 3, stepStair: 2, keyClick: 5, cough: 3, coughHigh: 2, chairCreak: 3, bird: 4 };
  for (const n of names) {
    const [dur, fn] = SOUNDS[n];
    const k = variants[n] || 1;
    out[n] = [];
    for (let v = 0; v < k; v++) { rngState = (rngState + 7919 * (v + 1)) >>> 0; out[n].push(normalize(await render(dur, fn))); }
    tick();
  }
  for (const n of loops) { const [len, xf, fn] = LOOPS[n]; out[n] = [await renderLoop(len, xf, fn)]; tick(); }
  return out;
}
export const SOUND_NAMES = Object.keys(SOUNDS);
export const LOOP_NAMES = Object.keys(LOOPS);
