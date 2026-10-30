// Vorgerenderte Stimmen (Auftrag V3, Phase 6): Aufnahmen aus tools/voice/render.py (offenes Modell, gemastert, Opus) liegen im
// eingebetteten Block <script id="assets-voice">. Jeder Satz ist über eine Kennung auffindbar:
//   FNV-1a-32("<sprache>|<sprecher>|<text>")  – identisch mit tools/voice/corpus.mjs.
// Sätze mit Platzhaltern ({row}, {section}, {minutes}) werden aus Stücken zusammengesetzt: Text vor dem Platzhalter, Wert, Rest.
// Zu jeder Aufnahme gibt es eine Lautstärkekurve (20 Hz) für die Mundbewegung.
// Fehlt eine Aufnahme, bleibt es beim Untertitel – es gibt keine Computerstimme als Ersatz.

import { b64, embedded, remote, fetchBytes, fetchJSON } from '../core/assets.js';

export function fnv(s) { let h = 0x811c9dc5; for (const ch of s) { const c = ch.codePointAt(0); h ^= c & 0xff; h = Math.imul(h, 0x01000193) >>> 0; if (c > 0xff) { h ^= c >>> 8; h = Math.imul(h, 0x01000193) >>> 0; } } return h.toString(16).padStart(8, '0'); }
const GAP = 0.06; // Pause zwischen zusammengesetzten Stücken (s)
// Dekodierte Aufnahmen liegen als PCM im Speicher (48 kHz Float ≈ 190 KB je Sekunde). Sätze wiederholen sich kaum – ohne Grenze
// sammelten sich über eine 90-Minuten-Vorlesung Hunderte MB an (auf Handys ein Absturzrisiko). Ein laufender Satz behält seinen
// Puffer über die Abspielquelle, auch wenn er hier schon verdrängt ist.
const CACHE_MAX = 48;

export class VoiceBank {
  constructor() {
    const t = embedded('assets-voice');
    // Desktop: Begleitdateien je Sprache (window.__voicePacks), sonst eingebetteter Block
    const packs = typeof window !== 'undefined' && window.__voicePacks;
    this.data = t ? JSON.parse(t) : (packs && Object.keys(packs).length ? packs : null);
    this.cache = new Map();   // id → Promise<AudioBuffer>; begrenzt (CACHE_MAX), älteste zuerst raus
    this.titles = {};         // Abschnittstitel → Text (für {section})
    // Mobil-Build: nur die Verzeichnisse (Dauer, Lautstärkekurve) laden; die Aufnahmen selbst holt buffer() bei Bedarf
    this.remote = !this.data && remote && remote.voice ? remote.voice : null;
    this.ready = this.remote ? this._loadRemote() : Promise.resolve();
  }
  async _loadRemote() {
    const data = {};
    for (const lang of ['de', 'en']) { try { data[lang] = { clips: await fetchJSON(`${this.remote}${lang}/manifest.json`) }; } catch (e) { /* Sprache fehlt */ } }
    this.data = data;
  }
  get available() { return !!(this.data || this.remote); }
  has(lang, id) { return !!(this.data && this.data[lang] && this.data[lang].clips[id]); }
  meta(lang, id) { return this.data?.[lang]?.clips[id] || null; }
  /** Kennungen der Stücke eines Satzes; null, wenn ein Stück fehlt */
  parts(lang, speaker, tpl, vars) {
    if (!this.data || !this.data[lang]) return null;
    const ids = [];
    for (const p of String(tpl).split(/(\{[a-z]+\})/).filter(Boolean)) {
      let text = p, sp = speaker;
      const m = /^\{([a-z]+)\}$/.exec(p);
      if (m) { const v = vars ? vars[m[1]] : undefined; if (v === undefined) return null; text = String(v); sp = 'prof'; }
      text = text.trim();
      if (!m && !text.replace(/[\s–,.:;!?…-]/g, '')) continue;
      const id = fnv(`${lang}|${sp}|${text}`);
      if (!this.has(lang, id)) return null;
      ids.push(id);
    }
    return ids.length ? ids : null;
  }
  buffer(ctx, lang, id) {
    const key = lang + id;
    let p = this.cache.get(key);
    if (p) { this.cache.delete(key); this.cache.set(key, p); return p; }   // zuletzt benutzt ans Ende
    const c = this.data[lang].clips[id];
    const bytes = c.a ? Promise.resolve(b64(c.a)) : fetchBytes(`${this.remote}${lang}/${id}.ogg`);
    p = bytes.then(b => ctx.decodeAudioData(b.buffer)).catch(() => null);
    this.cache.set(key, p);
    while (this.cache.size > CACHE_MAX) this.cache.delete(this.cache.keys().next().value);
    return p;
  }
  /** Gesamtdauer (s) und Lautstärkekurve (0–1) über die Zeit seit Beginn */
  shape(lang, ids) {
    const segs = []; let t = 0;
    for (const id of ids) { const c = this.data[lang].clips[id]; segs.push({ t, d: c.d, e: c.e ? b64(c.e) : null }); t += c.d + GAP; }
    const dur = Math.max(0, t - GAP);
    const env = time => {
      for (const s of segs) if (time >= s.t && time < s.t + s.d) { if (!s.e) return 0.5; const i = Math.min(s.e.length - 1, Math.floor((time - s.t) * 20)); return s.e[i] / 255; }
      return 0;
    };
    return { dur, env };
  }
  /** Vorladen (dekodieren) der Stücke, damit der Satz ohne Verzögerung startet */
  preload(ctx, lang, ids) { return Promise.all(ids.map(id => this.buffer(ctx, lang, id))); }
}
