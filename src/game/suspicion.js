// Dreistufiges Verdachtsmodell:
//  Aufmerksamkeit (kurzlebig) → Verdacht (mittelfristig) → Beweis (nur bei direktem Blick auf eindeutiges Verhalten).
// Erwischt wird man erst, wenn der Beweis 100 erreicht.
import { clamp } from '../core/util.js';

export const SUSPICION_TUNING = {
  attRise: 70, attDecay: 28,
  susRise: 30, susDecay: 2.6, susDecayNotes: 6, susGate: 20,
  evRise: 72, evDecay: 6, evGate: 12,
  jerkSpike: 22, switchSpike: 12, notifySpike: 16, flickerSpike: 8,
  rateMul: 1
};

export class Suspicion {
  constructor(tuning = {}) {
    this.T = { ...SUSPICION_TUNING, ...tuning };
    this.attention = 0; this.suspicion = 0; this.evidence = 0;
    this.peakEvidence = 0; this.closeCalls = 0; this._wasHigh = false;
    this.maxSuspicionSince = 0; this.cleanTime = 0; // für Erfolg „Unsichtbar“
  }
  /**
   * s = { vis, fovea, cone, los }  (vom Sichtmodell)
   * p = { laptop (0–1: Kopf unten am Laptop), notes (0–1), lookAway (0–1), motion (0–1), glow (0–1), hands (0–1), gameVisible (bool), studying (0–1: Folien am Laptop mitlesen) }
   * mods = { mul (Schwierigkeit), tolerance, focus }
   */
  update(dt, s, p, mods = {}) {
    const T = this.T, mul = (mods.mul ?? 1) * T.rateMul;
    const tol = 1 - Math.min(0.5, (mods.tolerance || 0) * 0.12);
    // Aufmerksamkeit: jede auffällige Bewegung/Haltung im Sichtfeld (auch peripher)
    const salient = p.laptop * 0.6 + p.motion * 0.9 + p.glow * 0.35 + p.lookAway * 0.3 + p.hands * 0.3;
    this.attention += s.vis * salient * T.attRise * mul * dt;
    this.attention -= T.attDecay * dt * (s.vis < 0.05 ? 1.4 : 0.6);
    // Verdacht: nur wenn er bewusst hinschaut (Aufmerksamkeit über Schwelle)
    if (this.attention > T.susGate) {
      // Wer am Laptop die Folien mitliest, wirkt wie jemand, der lernt: deutlich weniger verräterisch
      const tell = p.laptop * (1 - 0.65 * (p.studying || 0)) + p.glow * 0.4 + p.hands * 0.5 + p.lookAway * 0.25;
      this.suspicion += s.vis * tell * T.susRise * mul * tol * dt;
    }
    const legit = p.notes > 0.5 && p.laptop < 0.3;
    const decay = legit ? T.susDecayNotes : (p.studying || 0) > 0.6 ? (T.susDecay + T.susDecayNotes) / 2 : T.susDecay;
    this.suspicion -= decay * dt * (s.vis < 0.05 ? 1 : 0.5);
    // Beweis: direkter (fovealer) Blick + eindeutig am Laptop + Spiel offen, ab einem Grundverdacht
    if (this.suspicion > T.evGate && s.fovea > 0) {
      const proof = p.laptop * (0.55 + 0.25 * p.hands + 0.2 * p.glow) * (p.gameVisible ? 1 : 0.25);
      this.evidence += s.fovea * proof * T.evRise * mul * tol * (0.6 + this.suspicion / 100) * dt;
    } else this.evidence -= T.evDecay * dt;
    this.attention = clamp(this.attention, 0, 100); this.suspicion = clamp(this.suspicion, 0, 100); this.evidence = clamp(this.evidence, 0, 100);
    this.peakEvidence = Math.max(this.peakEvidence, this.evidence);
    // knapp entkommen?
    if (this.evidence > 75) this._wasHigh = true;
    if (this._wasHigh && this.evidence < 20) { this._wasHigh = false; this.closeCalls++; }
    if (this.suspicion < 30) this.cleanTime += dt; else this.cleanTime = 0;
    this.maxSuspicionSince = Math.max(this.maxSuspicionSince, this.suspicion);
    return this.evidence >= 100;
  }
  spike(kind, vis) {
    const T = this.T;
    const v = { jerk: T.jerkSpike, switch: T.switchSpike, notify: T.notifySpike, flicker: T.flickerSpike }[kind] || 10;
    this.attention = clamp(this.attention + v * (0.3 + vis), 0, 100);
    if (vis > 0.4 && kind === 'notify') this.suspicion = clamp(this.suspicion + 8, 0, 100);
  }
  relieve(amount) { this.suspicion = clamp(this.suspicion - amount, 0, 100); this.attention = clamp(this.attention - amount, 0, 100); this.evidence = clamp(this.evidence - amount * 0.5, 0, 100); }
  reset() { this.attention = 0; this.suspicion = 25; this.evidence = 0; this._wasHigh = false; }
  /** zusammengefasster "Stress" für Herzschlag/Vignette (0–1) */
  get stress() { return clamp(Math.max(this.attention * 0.006, this.suspicion * 0.009, this.evidence * 0.012), 0, 1); }
}
