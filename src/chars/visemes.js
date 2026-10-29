// Mundformen beim Sprechen (Auftrag V3, Phase 4: Prof ≥ 6 Mundformen). Aus dem gesprochenen Text wird eine Folge von Lautklassen
// (Visemen) gebildet und über die Lautstärkekurve der Aufnahme zeitlich verteilt: wo viel Energie ist, liegen die Laute dichter.
// Ergebnis je Zeitpunkt: Gewichte für Kiefer, Ober-/Unterlippe, Mundwinkel (breit ↔ rund) und Lippen nach vorne.

// Ziel-Formen (Einheiten: Kiefer 0–1 relativ zur vollen Öffnung; Lippen −1…1 relativ zum Ausschlag im Rig)
export const VISEMES = {
  rest: { jaw: 0.05, up: 0, low: 0, wide: 0, fwd: 0 },
  A: { jaw: 1.0, up: 0.35, low: 0.2, wide: 0.15, fwd: 0 },      // a, ä, ah
  E: { jaw: 0.55, up: 0.25, low: 0.1, wide: 0.75, fwd: -0.1 },  // e, ä
  I: { jaw: 0.3, up: 0.2, low: 0.05, wide: 1.0, fwd: -0.2 },    // i, ie, y
  O: { jaw: 0.65, up: 0.1, low: 0.15, wide: -0.75, fwd: 0.7 },  // o, ö
  U: { jaw: 0.35, up: 0.05, low: 0.1, wide: -1.0, fwd: 1.0 },   // u, ü
  F: { jaw: 0.12, up: 0.3, low: -0.9, wide: 0.15, fwd: 0 },     // f, v, w
  M: { jaw: 0.0, up: -0.25, low: -0.25, wide: 0.05, fwd: 0.15 }, // m, b, p (Lippen geschlossen)
  S: { jaw: 0.2, up: 0.15, low: 0.05, wide: 0.45, fwd: 0 },     // s, z, t, d, n, l, k, g, ch, sch, r
  L: { jaw: 0.35, up: 0.1, low: 0.05, wide: 0.2, fwd: 0 }       // l, r (offener)
};
const KEYS = ['jaw', 'up', 'low', 'wide', 'fwd'];

/** Text → Folge von Visem-Namen (grobe, sprachabhängige Buchstabenregeln; Satzzeichen = Pause) */
export function textToVisemes(text, lang = 'de') {
  const s = String(text || '').toLowerCase()
    .replace(/sch/g, 'S').replace(/ch/g, 'S').replace(/ie/g, 'i').replace(/ei|ai/g, 'aI').replace(/eu|äu/g, 'OI').replace(/au/g, 'aU')
    .replace(lang === 'en' ? /th/g : /$^/g, 'S').replace(lang === 'en' ? /oo/g : /$^/g, 'u').replace(lang === 'en' ? /ee/g : /$^/g, 'i');
  const out = [];
  for (const ch of s) {
    let v = null;
    if ('aàá'.includes(ch)) v = 'A'; else if ('äeéè'.includes(ch)) v = 'E'; else if ('iíyI'.includes(ch)) v = 'I';
    else if ('oóöO'.includes(ch)) v = 'O'; else if ('uúüU'.includes(ch)) v = 'U';
    else if ('fvw'.includes(ch)) v = 'F'; else if ('mbp'.includes(ch)) v = 'M'; else if ('lr'.includes(ch)) v = 'L';
    else if ('sztdnkgcjqxhS'.includes(ch)) v = 'S';
    else if (/[.,;:!?…–—]/.test(ch)) v = 'pause';
    if (v && out[out.length - 1] !== v) out.push(v);
  }
  return out;
}

/**
 * Spur über die Zeit: track(t) → Gewichte { jaw, up, low, wide, fwd } (bereits mit der Lautstärke moduliert).
 * env(t) liefert die Lautstärke 0–1 (20 Hz); ohne Kurve wird gleichmäßig verteilt.
 */
export function makeVisemeTrack(text, lang, dur, env = null) {
  const seq = textToVisemes(text, lang).filter(v => v !== 'pause');
  if (!seq.length || !(dur > 0)) return () => VISEMES.rest;
  // kumulierte Energie (nur stimmhafte Abschnitte) → Zeitpunkte der Laute
  const N = Math.max(2, Math.round(dur * 20)), cum = new Float32Array(N + 1);
  for (let i = 0; i < N; i++) { const e = env ? env((i + 0.5) / 20) : 0.6; cum[i + 1] = cum[i] + (e > 0.08 ? e : 0); }
  const total = cum[N] || 1;
  const times = seq.map((_, k) => {
    const target = (k + 0.5) / seq.length * total;
    let lo = 0, hi = N; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid + 1] < target) lo = mid + 1; else hi = mid; }
    return (lo + 0.5) / 20;
  });
  const out = { jaw: 0, up: 0, low: 0, wide: 0, fwd: 0, v0: 'rest', v1: 'rest', f: 0, e: 0 };
  return t => {
    const e = env ? Math.min(1, env(t) * 1.6) : 0.6;
    // nächste zwei Laute weich überblenden
    let k = 0; while (k < times.length - 1 && times[k + 1] <= t) k++;
    const a = VISEMES[seq[k]], b = VISEMES[seq[Math.min(seq.length - 1, k + 1)]];
    const span = Math.max(0.04, (times[k + 1] ?? times[k] + 0.1) - times[k]);
    let f = Math.min(1, Math.max(0, (t - times[k]) / span)); f = f * f * (3 - 2 * f);
    const voiced = e > 0.06 ? 1 : 0;
    // für Figuren mit Gesichtsformen (Rocketbox-Visemes): aktuelle/nächste Lautklasse, Überblendung, Lautstärke
    out.v0 = voiced ? seq[k] : 'rest'; out.v1 = voiced ? seq[Math.min(seq.length - 1, k + 1)] : 'rest'; out.f = f; out.e = e;
    for (const key of KEYS) {
      const v = a[key] + (b[key] - a[key]) * f;
      out[key] = voiced ? (key === 'jaw' ? v * e : v * Math.min(1, 0.4 + e)) : VISEMES.rest[key];
    }
    return out;
  };
}
