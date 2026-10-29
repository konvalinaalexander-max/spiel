// Audio-Engine: Mixer (Master/Stimme/Effekte/Ambiente/Musik), Hall aus echten Hörsaal-Impulsantworten, räumliche Quellen,
// Atmosphären-Schleifen je Phase/Wetter (ambience), Raumgeräusch-Auswahl (crowdFoley), Lachen im Saal (laughCrowd),
// vorgerenderte Stimmen (voice.js); Browser-Sprachausgabe und "Murmeln" nur noch als ausdrücklich gewählte Notlösung.
import { synthesizeAll } from './synth.js';
import { storage, clamp, lerp } from '../core/util.js';
import { VoiceBank } from './voice.js';
import { loadSfx } from './sfx.js';

const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);

// Gemurmel in drei Dichten je Phase: [vor Beginn (murmur), Pause (murmurBreak), leise während der Vorlesung (murmurQuiet)]
const MURMUR = { arrival: [0.55, 0, 0], intro: [0.15, 0, 0.26], part1: [0, 0, 0.25], break: [0.12, 0.9, 0], part2: [0, 0, 0.24], closing: [0.45, 0, 0.1], end: [0.3, 0, 0] };
// Raumgeräusche einzelner Studierender je Phase: [Name, Gewicht, Höhe relativ zum Kopf (m), Pegelfaktor]
const DESK = -0.45, SEAT = -0.6;
const CROWD = {
  lecture: [['cough', 0.07, 0, 1], ['throatClear', 0.05, 0, 1], ['sneeze', 0.025, 0, 0.9], ['yawn', 0.035, 0, 0.9], ['chairCreak', 0.2, SEAT, 1],
    ['pageTurn', 0.16, DESK, 1], ['penClick', 0.1, DESK, 1], ['penWrite', 0.06, DESK, 1], ['highlighter', 0.05, DESK, 1], ['paperTear', 0.015, DESK, 1],
    ['zipper', 0.06, -0.5, 1], ['cloth', 0.1, -0.3, 1], ['seatFlip', 0.03, SEAT, 1], ['cupDown', 0.02, DESK, 0.8], ['phoneVibrate', 0.01, DESK, 0.6],
    ['shush', 0.01, 0, 0.7]],
  break: [['appleBite', 0.12, -0.1, 1], ['cutlery', 0.1, DESK, 0.9], ['cupDown', 0.1, DESK, 1], ['bag', 0.1, SEAT, 1], ['zipper', 0.1, -0.5, 1],
    ['chairCreak', 0.12, SEAT, 1], ['seatFlip', 0.1, SEAT, 1], ['lidClose', 0.06, DESK, 0.8], ['cough', 0.05, 0, 1], ['sneeze', 0.02, 0, 0.9],
    ['laughSoft', 0.08, 0, 0.9], ['paperTear', 0.02, DESK, 1], ['cloth', 0.08, -0.3, 1], ['pageTurn', 0.05, DESK, 1]],
  arrival: [['bag', 0.18, SEAT, 1], ['zipper', 0.15, -0.5, 1], ['seatFlip', 0.15, SEAT, 1], ['chairCreak', 0.1, SEAT, 1], ['lidClose', 0.06, DESK, 0.8],
    ['hinge', 0.05, DESK, 1], ['cloth', 0.1, -0.3, 1], ['cough', 0.05, 0, 1], ['pageTurn', 0.07, DESK, 1], ['cupDown', 0.05, DESK, 1], ['laughSoft', 0.04, 0, 0.8]]
};

export class AudioEngine {
  constructor() {
    this.ctx = null; this.buffers = null; this.ready = false;
    this.vol = storage.get('volumes', { master: 0.85, voice: 1, sfx: 0.8, amb: 0.65, music: 0.5 });
    this.loops = {}; this.listenerPos = [0, 1.5, 0];
    this.muffle = 0; this.headphones = false;
    // V3: vorgerenderte Stimmen ('voice'); Browser-TTS/Murmeln nur noch als ausdrückliche Wahl, Standard ist die echte Aufnahme
    this.bank = new VoiceBank();
    this.voiceMode = storage.get('voiceMode3', this.bank.available ? 'voice' : 'tts'); // 'voice' | 'tts' | 'murmur' | 'off'
    this.ttsRate = storage.get('ttsRate', 1.0); this.ttsPitch = storage.get('ttsPitch', 0.9);
    this.tts = { supported: typeof speechSynthesis !== 'undefined', voice: null, speaking: false, utter: null };
    this.lang = 'de';
    this.music = null;
    this._pickVoiceBound = () => this.pickVoice();
    if (this.tts.supported) { try { speechSynthesis.addEventListener('voiceschanged', this._pickVoiceBound); } catch (e) { speechSynthesis.onvoiceschanged = this._pickVoiceBound; } }
  }
  /** Klänge vorab synthetisieren (geht ohne Nutzerinteraktion) */
  async prepare(progress) {
    // zuerst die echten Aufnahmen, dann nur noch synthetisieren, was fehlt (UI-Signaltöne des Laptops)
    let real = {};
    try { real = await loadSfx(f => progress && progress(f * 0.7)); } catch (e) { console.warn('Geräusche: Rückfall auf Synthese', e); }
    this.realSounds = new Set(Object.keys(real));
    let synth = {};
    try { synth = await synthesizeAll(f => progress && progress(0.7 + f * 0.3), this.realSounds); } catch (e) { console.warn('Audio-Synthese fehlgeschlagen', e); }
    this.buffers = { ...synth, ...real };
    this._attachIR();
  }
  /** Faltungshall anlegen, sobald Kontext und Impulsantworten da sind (start() kann vor dem Laden kommen). Fehlen die Antworten,
   *  bleibt der Raum trocken – es gibt keine synthetische Ersatz-Impulsantwort mehr. */
  async _attachIR() {
    if (!this.ctx || !this.preDelay || this.rv.front || this._irPending || !this.buffers) return;
    this._irPending = true;
    try {
      for (const [k, name] of [['front', 'irFront'], ['back', 'irBack']]) {
        const ir = this._buf(name); if (!ir) continue;
        // ConvolverNode verlangt die Abtastrate des Kontexts (Geräte laufen oft mit 44,1 kHz, die Aufnahmen mit 48 kHz)
        const buf = await this._resample(ir, this.ctx.sampleRate);
        const c = this.ctx.createConvolver(); c.normalize = false; c.buffer = buf;
        const g = this.ctx.createGain(); g.gain.value = k === 'front' ? 1 : 0;
        this.preDelay.connect(c); c.connect(g); g.connect(this.rvOut); this.rv[k] = g;
      }
      if (this.rv.front && !this.rv.back) this.rv.back = this.rv.front;
      if (this.rv.back && !this.rv.front) this.rv.front = this.rv.back;
      this._rvT = -1;
    } catch (e) { console.warn('Hall nicht verfügbar', e); }
    this._irPending = false;
  }
  /** AudioBuffer auf eine andere Abtastrate bringen (Resampler des Browsers über einen OfflineAudioContext) */
  async _resample(buf, rate) {
    if (buf.sampleRate === rate) return buf;
    const OAC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : webkitOfflineAudioContext;
    const oc = new OAC(buf.numberOfChannels, Math.ceil(buf.duration * rate), rate);
    const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
    return oc.startRendering();
  }
  /** Muss nach einer Nutzerinteraktion aufgerufen werden */
  start() {
    if (!AC) return;
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.bus = {};
    for (const k of ['voice', 'sfx', 'amb', 'music', 'ui']) { const g = ctx.createGain(); g.connect(this.master); this.bus[k] = g; }
    // Dämpfung (Laptop-Fokus/Kopfhörer) für Raumklänge
    this.roomLP = ctx.createBiquadFilter(); this.roomLP.type = 'lowpass'; this.roomLP.frequency.value = 20000;
    this.roomBus = ctx.createGain(); this.roomBus.connect(this.roomLP); this.roomLP.connect(this.bus.sfx);
    // Atmosphären-Schleifen im Raum: gedämpft wie alle Raumklänge, aber am Regler „Raumklang“ (amb; Voreinstellung 0,65 = Faktor 1)
    this.roomAmb = ctx.createGain(); this.roomAmb.connect(this.roomBus);
    // Hall (Send): echte binaurale Impulsantworten eines Hörsaals (TU Berlin, Auditorium 3; vorne 1,5 m / hinten 5,5 m von der Quelle),
    // gemischt nach der Hörposition (setListener), Vorverzögerung nach Entfernung. Der Hallanteil läuft durch die Raumdämpfung
    // (Laptop-Fokus, Kopfhörer). Pegel: build_sfx.py kalibriert die Antworten auf die Lautheit des früheren Halls (normalize = false).
    this.reverbIn = ctx.createGain(); this.reverbIn.gain.value = 0.35;
    this.preDelay = ctx.createDelay(0.1); this.preDelay.delayTime.value = 0.008;
    const rvOut = ctx.createGain(); rvOut.gain.value = 0.8;
    this.reverbIn.connect(this.preDelay);
    this.rvOut = rvOut; this.rv = {}; this._rvT = -1;
    rvOut.connect(this.roomBus);
    this._attachIR();
    this.voiceLP = ctx.createBiquadFilter(); this.voiceLP.type = 'lowpass'; this.voiceLP.frequency.value = 20000;
    this.voiceLP.connect(this.bus.voice);
    this.applyVolumes();
    this.ready = true;
    this.pickVoice();
  }
  applyVolumes() {
    if (!this.ctx) return;
    const v = this.vol, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(v.master, t, 0.05);
    this.bus.voice.gain.setTargetAtTime(v.voice, t, 0.05);
    this.bus.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
    this.bus.ui.gain.setTargetAtTime(v.sfx * 0.9, t, 0.05);
    this.bus.amb.gain.setTargetAtTime(v.amb, t, 0.05);
    this.roomAmb.gain.setTargetAtTime(v.amb / 0.65, t, 0.05);
    this.bus.music.gain.setTargetAtTime(v.music, t, 0.05);
  }
  setVolume(k, val) { this.vol[k] = clamp(val, 0, 1); storage.set('volumes', this.vol); this.applyVolumes(); }
  /** Laptop-Fokus / Kopfhörer: Raumklang dumpfer und leiser */
  setMuffle(m, headphones) {
    this.muffle = m; this.headphones = headphones;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = headphones ? 900 : lerp(20000, 3200, m);
    this.roomLP.frequency.setTargetAtTime(f, t, 0.08);
    this.voiceLP.frequency.setTargetAtTime(headphones ? 700 : lerp(20000, 2400, m), t, 0.08);
    this.roomBus.gain.setTargetAtTime(headphones ? 0.35 : 1 - m * 0.25, t, 0.08);
  }
  setListener(pos, fwd, up) {
    if (!this.ctx) return;
    const L = this.ctx.listener; this.listenerPos = [pos.x, pos.y, pos.z];
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(pos.x, t, 0.02); L.positionY.setTargetAtTime(pos.y, t, 0.02); L.positionZ.setTargetAtTime(pos.z, t, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, t, 0.02); L.forwardY.setTargetAtTime(fwd.y, t, 0.02); L.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
      L.upX.setTargetAtTime(up.x, t, 0.02); L.upY.setTargetAtTime(up.y, t, 0.02); L.upZ.setTargetAtTime(up.z, t, 0.02);
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    this._roomBlend(pos);
  }
  /** Hall nach Hörposition: nah am Pult → Antwort „vorne“, weiter hinten → „hinten“ (gleichleistungs-Überblendung), Vorverzögerung
   *  kürzer, je weiter weg (Direktschall und erste Reflexionen kommen dort dichter hintereinander an). */
  _roomBlend(pos) {
    const ref = this.amb?.places?.lectern; if (!ref || !this.rv || !this.rv.front || this.rv.front === this.rv.back) return;
    const d = Math.hypot(pos.x - ref.x, pos.z - ref.z), t = clamp((d - 3.5) / 7, 0, 1);
    if (Math.abs(t - this._rvT) < 0.01) return;
    this._rvT = t; const now = this.ctx.currentTime;
    this.rv.front.gain.setTargetAtTime(Math.cos(t * Math.PI / 2), now, 0.3);
    this.rv.back.gain.setTargetAtTime(Math.sin(t * Math.PI / 2), now, 0.3);
    this.preDelay.delayTime.setTargetAtTime(lerp(0.012, 0.003, t), now, 0.3);
  }
  _buf(name) { const a = this.buffers && this.buffers[name]; return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }
  _panner(pos, model = 'equalpower', ref = 1.2) {
    const p = this.ctx.createPanner(); p.panningModel = model; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.1; p.maxDistance = 60;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    return p;
  }
  /**
   * Einmal-Klang. o: { pos (Vector3) → räumlich im Raum, gain, rate, bus ('sfx'|'ui'|'amb'|'room'), reverb (0–1), detune }
   */
  play(name, o = {}) {
    if (!this.ready) return null;
    const buf = this._buf(name); if (!buf) return null;
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = buf;
    s.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * (o.vary ?? 0.06));
    const g = ctx.createGain(); g.gain.value = o.gain ?? 1;
    s.connect(g);
    let out = g;
    if (o.pos) { const p = this._panner(o.pos, o.hrtf ? 'HRTF' : 'equalpower', o.ref ?? 1.2); g.connect(p); out = p; }
    const bus = o.bus === 'ui' ? this.bus.ui : o.bus === 'amb' ? this.bus.amb : o.bus === 'music' ? this.bus.music : o.bus === 'player' ? this.bus.sfx : o.bus === 'voice' ? this.voiceLP : this.roomBus;
    out.connect(bus);
    const rv = o.reverb ?? (o.pos ? 0.6 : 0);
    if (rv > 0) { const sg = ctx.createGain(); sg.gain.value = rv; out.connect(sg); sg.connect(this.reverbIn); }
    s.start(ctx.currentTime + (o.delay || 0));
    if (name === 'doorOpen' && !(o.rate > 1.4)) this._doorSwell(o.delay || 0);
    return s;
  }
  /** Tür geht auf: der Gang davor wird für ein paar Sekunden lauter und heller */
  _doorSwell(delay = 0, dur = 3.2) {
    const L = this.loops.corridor; if (!L || !L.f) return;
    const t = this.ctx.currentTime + delay;
    L.g.gain.setTargetAtTime(Math.max(L.base, 0.05) * 3, t + 0.15, 0.25); L.f.frequency.setTargetAtTime(7000, t + 0.15, 0.2);
    L.g.gain.setTargetAtTime(L.base, t + dur, 0.6); L.f.frequency.setTargetAtTime(L.lp, t + dur, 0.6);
  }
  /** Loop starten/ändern */
  loop(name, o = {}) {
    if (!this.ready) return;
    let L = this.loops[name];
    if (!L) {
      if (!((o.gain ?? 1) > 0)) return; // stumme Schleife gar nicht erst starten
      const buf = this._buf(name); if (!buf) return;
      const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      let f = null;
      if (o.lowpass) { f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lowpass; s.connect(f); f.connect(g); } else s.connect(g);
      let out = g;
      if (o.pos) { const p = this._panner(o.pos, 'equalpower', o.ref ?? 2); g.connect(p); out = p; }
      out.connect(o.bus === 'room' ? this.roomAmb : this.bus.amb);
      if (o.reverb) { const sg = this.ctx.createGain(); sg.gain.value = o.reverb; out.connect(sg); sg.connect(this.reverbIn); }
      s.start(this.ctx.currentTime + Math.random() * 0.05, Math.random() * buf.duration);
      L = this.loops[name] = { s, g, f, lp: o.lowpass || 20000 };
    }
    L.base = o.gain ?? 1;
    L.g.gain.setTargetAtTime(L.base, this.ctx.currentTime, o.fade ?? 0.6);
  }
  stopLoops(fade = 0.5) {
    clearTimeout(this._rainTimer); this._rainTimer = null; if (this.amb) this.amb.raining = false;
    if (!this.ctx) return;
    for (const k in this.loops) this.loops[k].g.gain.setTargetAtTime(0, this.ctx.currentTime, fade);
  }

  // ---------------------------------------------------------------- Atmosphären
  /**
   * Atmosphären-Schleifen nach Vorlesungsphase und Wetter setzen (weich übergeblendet). Mehrfach aufrufbar; o wird mit dem
   * bisherigen Zustand zusammengeführt: { phase, weather ('sunny'|'cloudy'|'rain'), raining (Regen setzt mitten in der
   * Vorlesung ein), places: { window, street, streetFar, wind, birds, door, lectern } (Vector3) }.
   */
  ambience(o = {}) {
    const S = this.amb = { ...(this.amb || {}), ...o }, P = S.places || {};
    if (!this.ready) return;
    const ph = S.phase || 'arrival', w = S.weather || 'cloudy', rain = w === 'rain' || !!S.raining;
    const lecture = ph === 'intro' || ph === 'part1' || ph === 'part2';
    const m = MURMUR[ph] || MURMUR.arrival, slow = o.phase ? 3 : 0.6;
    // Saal: Lüftung, Raumton, Gemurmel (3 Dichten), Tastaturen aus mehreren Reihen
    // Lüftung und Raumton deutlich leiser als in v2 (0,25/0,35): als echte Aufnahmen tragen sie den Raum schon bei kleinem Pegel; so
    // liegen Kreide, Husten, Schritte und Tür darüber (Reihe 5: Bett ≈ −38 dB, deren Spitzen im Band 2–8 kHz 5–9 dB höher, docs/AUDIO.md)
    this.loop('ventilation', { gain: 0.05, bus: 'room' });
    this.loop('roomTone', { gain: 0.1, bus: 'room' });
    this.loop('murmur', { gain: m[0], bus: 'room', fade: slow });
    this.loop('murmurBreak', { gain: m[1], bus: 'room', fade: slow });
    this.loop('murmurQuiet', { gain: m[2], bus: 'room', fade: slow });
    this.loop('keyboards', { gain: lecture ? 0.15 : ph === 'break' ? 0.05 : ph === 'closing' ? 0.06 : 0, bus: 'room', fade: 4 });
    // Gang vor der Tür (hinter der hinteren Tür, gedämpft; bei offener Tür lauter – siehe _doorSwell)
    this.loop('corridor', { pos: P.door, ref: 2.5, gain: ph === 'break' || ph === 'arrival' || ph === 'closing' ? 0.32 : 0.14, lowpass: 1300, bus: 'room', fade: slow });
    // draußen: Straße nah (Fenster) und fern mit Bim/Bus, Wind, Herbstvögel, Regen in zwei Stärken
    this.loop('traffic', { pos: P.street, gain: rain ? 0.2 : 0.3, bus: 'room' });
    this.loop('streetFar', { pos: P.streetFar, ref: 6, gain: rain ? 0.16 : 0.24, bus: 'room' });
    this.loop('wind', { pos: P.wind, gain: w !== 'sunny' ? 0.12 : 0, bus: 'room' });
    this.loop('birds', { pos: P.birds, ref: 3, gain: rain ? 0 : w === 'sunny' ? 0.26 : 0.12, bus: 'room', fade: 4 });
    const fadeIn = o.raining && w !== 'rain' ? 6 : 0.6;
    this.loop('rain', { pos: P.window, gain: rain ? 0.42 : 0, bus: 'room', fade: fadeIn });
    if (rain && !this._rainTimer) this._rainGusts(o.raining && w !== 'rain' ? 20 : 8);
  }
  /** Regen wechselt zwischen leicht und kräftig (zweite Aufnahme), alle 20–50 s neu ausgewürfelt */
  _rainGusts(first = 8) {
    const P = this.amb?.places || {};
    const step = () => {
      if (!this.ready || !this.amb || !(this.amb.weather === 'rain' || this.amb.raining)) { this._rainTimer = null; return; }
      const k = Math.random() < 0.55 ? 0 : 0.4 + Math.random() * 0.6;
      this.loop('rainHeavy', { pos: P.window, gain: 0.45 * k, bus: 'room', fade: 5 });
      this.loop('rain', { pos: P.window, gain: 0.42 * (1 - 0.35 * k), bus: 'room', fade: 5 });
      this._rainTimer = setTimeout(step, (20 + Math.random() * 30) * 1000);
    };
    this._rainTimer = setTimeout(step, first * 1000);
  }
  /** Raumgeräusch für eine zufällige Person im Saal, nach Phase gewichtet: { name, dy (Höhe relativ zum Kopf, m), gain } */
  crowdFoley(phase) {
    const T = CROWD[phase === 'break' ? 'break' : phase === 'arrival' || phase === 'closing' ? 'arrival' : 'lecture'];
    const have = T.filter(r => this.buffers && this.buffers[r[0]]);
    let r = Math.random() * have.reduce((a, x) => a + x[1], 0);
    for (const [name, wgt, dy, gain] of have) if ((r -= wgt) <= 0) return { name, dy, gain };
    return { name: 'cloth', dy: -0.3, gain: 1 };
  }
  /**
   * Lachen im Saal (Pointe des Profs): ein Gruppen-Lacher in einer von drei Stärken (geschichtet aus echten Lachern, Stereo über
   * den Raum) und 1–3 einzelne Lacher an Plätzen. strength 0/1/2 (leise/mittel/laut), sonst zufällig gewichtet. Rückgabe: Stärke.
   */
  laughCrowd(positions = [], strength) {
    if (!this.ready) return -1;
    const s = strength ?? (Math.random() < 0.45 ? 0 : Math.random() < 0.75 ? 1 : 2);
    this.play(['laughSmall', 'laughMid', 'laughBig'][s], { bus: 'room', gain: 0.55, reverb: 0.3, vary: 0.04 });
    positions.slice(0, s + 1).forEach(p => this.play('laughSoft', { pos: p, gain: 0.3, delay: 0.15 + Math.random() * 0.5 }));
    return s;
  }

  // ---------------------------------------------------------------- Stimme
  pickVoice() {
    if (!this.tts.supported) return;
    let vs = [];
    try { vs = speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    const want = this.lang === 'en' ? [/en[-_]GB/i, /en[-_](IE|AU)/i, /en[-_]US/i, /^en/i] : [/de[-_]AT/i, /de[-_]DE/i, /de[-_]CH/i, /^de/i];
    const male = /male|mann|herr|stefan|markus|hans|klaus|yannick|conrad|jonas|daniel|george|arthur|oliver|guy|ryan|thomas/i;
    let best = null;
    for (const re of want) { const cands = vs.filter(v => re.test(v.lang)); if (cands.length) { best = cands.find(v => male.test(v.name) && !/female|frau/i.test(v.name)) || cands.find(v => v.localService) || cands[0]; break; } }
    this.tts.voice = best;
  }
  setLang(l) { this.lang = l; this.pickVoice(); }
  setVoiceMode(m) { this.voiceMode = m; storage.set('voiceMode3', m); if (m !== 'tts') this.stopSpeech(); }
  /**
   * Vorgerenderte Aufnahme abspielen. o: { speaker ('prof' | 'student_m' | 'student_f' | 'neighbor'), tpl (Satz mit Platzhaltern),
   * vars, pos (Vector3), gain }. Rückgabe { dur, env(t) } oder null, wenn (noch) keine Aufnahme vorliegt.
   */
  speakClip(o) {
    if (!this.ready || this.voiceMode !== 'voice' || !this.bank.available) return null;
    const lang = this.lang || 'de';
    const ids = this.bank.parts(lang, o.speaker, o.tpl, o.vars); if (!ids) return null;
    const shape = this.bank.shape(lang, ids);
    const ctx = this.ctx, token = {};
    if (o.speaker === 'prof') { this._stopProfClip(); this._profToken = token; }
    const out = ctx.createGain(); out.gain.value = (o.gain ?? 0.95);
    if (o.pos) { const p = this._panner(o.pos, 'HRTF', o.speaker === 'prof' ? 3 : 0.9); out.connect(p); p.connect(this.voiceLP); }
    else out.connect(this.voiceLP);
    // Raumanteil über den Hall (Hörsaal), beim Prof etwas mehr
    const send = ctx.createGain(); send.gain.value = o.speaker === 'prof' ? 0.2 : 0.1; out.connect(send); send.connect(this.reverbIn);
    const start = ctx.currentTime + 0.04;
    this._clipEnd = Math.max(this._clipEnd || 0, start + shape.dur);
    Promise.all(ids.map(id => this.bank.buffer(ctx, lang, id))).then(bufs => {
      if (o.speaker === 'prof' && this._profToken !== token) return;
      let t = Math.max(ctx.currentTime + 0.01, start); const srcs = [];
      for (const b of bufs) { if (!b) continue; const sN = ctx.createBufferSource(); sN.buffer = b; sN.connect(out); sN.start(t); srcs.push(sN); t += b.duration + 0.06; }
      if (o.speaker === 'prof') this._profSrcs = srcs;
    });
    return shape;
  }
  _stopProfClip() { if (this._profSrcs) { for (const sN of this._profSrcs) { try { sN.stop(); } catch (e) { /* schon zu Ende */ } } this._profSrcs = null; } this._profToken = null; }
  get ttsAvailable() { return this.tts.supported; }
  /**
   * Prof spricht einen Satz. o: { pos (Vector3 Kopf), gain (0–1 Lautheit), onEnd, onStart }
   * Gibt geschätzte Dauer (s) zurück.
   */
  speak(text, o = {}) {
    const est = 0.9 + text.length * 0.062 / (this.ttsRate || 1);
    const useTTS = this.voiceMode === 'tts' && this.tts.supported;
    if (useTTS) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.tts.voice ? this.tts.voice.lang : (this.lang === 'en' ? 'en-GB' : 'de-AT');
        if (this.tts.voice) u.voice = this.tts.voice;
        u.rate = this.ttsRate; u.pitch = this.ttsPitch;
        // Lautheit nach Entfernung/Laptop-Fokus/Kopfhörer (TTS lässt sich nicht räumlich routen)
        const base = this.vol.master * this.vol.voice * (o.gain ?? 1);
        u.volume = clamp(base * (this.headphones ? 0.35 : 1 - this.muffle * 0.45), 0, 1);
        this.tts.speaking = true; this.tts.utter = u;
        u.onstart = () => o.onStart && o.onStart();
        u.onend = u.onerror = () => { if (this.tts.utter === u) this.tts.speaking = false; o.onEnd && o.onEnd(); };
        speechSynthesis.speak(u);
      } catch (e) { this.tts.speaking = false; }
    } else if (this.voiceMode === 'murmur' && this.ready) {
      this._murmur(text, est, o);
    }
    return est;
  }
  stopSpeech() {
    this._stopProfClip(); this._clipEnd = 0;
    if (this.tts.supported) { try { speechSynthesis.cancel(); } catch (e) { /* egal */ } }
    this.tts.speaking = false;
    if (this._murmurNodes) { try { this._murmurNodes.forEach(n => n.stop && n.stop()); } catch (e) { /* schon gestoppt */ } this._murmurNodes = null; }
  }
  get speaking() { return this.tts.speaking || (this._murmurEnd && this.ctx && this.ctx.currentTime < this._murmurEnd) || (this._clipEnd && this.ctx && this.ctx.currentTime < this._clipEnd); }
  /** Synthetische, sprachähnliche Silbenfolge (Formantfilter), räumlich am Kopf des Profs */
  _murmur(text, dur, o) {
    const ctx = this.ctx; const t0 = ctx.currentTime + 0.02;
    this.stopSpeech();
    const src = ctx.createOscillator(); src.type = 'sawtooth';
    const noise = ctx.createBufferSource(); noise.buffer = this._buf('roomTone') || null; noise.loop = true;
    const f0 = 112; src.frequency.setValueAtTime(f0, t0);
    const env = ctx.createGain(); env.gain.value = 0.0001;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
    const mix = ctx.createGain(); mix.gain.value = 0.9;
    src.connect(f1); src.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(env);
    // Silben aus Vokalgruppen schätzen
    const syl = Math.max(3, (text.match(/[aeiouäöüy]+/gi) || []).length);
    const sd = dur / syl;
    const F = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720], [440, 1020]];
    let t = t0;
    for (let i = 0; i < syl; i++) {
      const [a, b] = F[Math.floor(Math.random() * F.length)];
      f1.frequency.setValueAtTime(a, t); f2.frequency.setValueAtTime(b, t);
      src.frequency.setValueAtTime(f0 * (1 + 0.12 * Math.sin(i * 0.7) + (i === syl - 1 ? -0.1 : 0)), t);
      const pk = 0.22 + Math.random() * 0.12;
      env.gain.setTargetAtTime(pk, t, 0.02);
      env.gain.setTargetAtTime(0.02, t + sd * 0.55, 0.03);
      if (/[,.;:]/.test(text[Math.floor(i / syl * text.length)] || '')) t += 0.18;
      t += sd;
    }
    env.gain.setTargetAtTime(0.0001, t, 0.05);
    let out = env;
    if (o.pos) { const p = this._panner(o.pos, 'HRTF', 2.5); env.connect(p); out = p; }
    const g = ctx.createGain(); g.gain.value = (o.gain ?? 1) * 0.55; out.connect(g); g.connect(this.voiceLP);
    const sg = ctx.createGain(); sg.gain.value = 0.5; g.connect(sg); sg.connect(this.reverbIn);
    src.start(t0); src.stop(t + 0.3);
    this._murmurNodes = [src]; this._murmurEnd = t;
    if (o.onEnd) setTimeout(() => o.onEnd(), (t - ctx.currentTime) * 1000 + 50);
  }

  /**
   * Nebenstimmen (Sitznachbarin, Tutorin, Studierende): leises, räumliches Flüstern/Murmeln aus
   * gefiltertem Rauschen bzw. Stimmton – läuft parallel zur Sprachausgabe des Profs.
   * o: { pos, gain, f0 (Grundton), whisper (bool), dur }
   */
  voice(text, o = {}) {
    if (!this.ready || this.voiceMode === 'off') return 0;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.03;
    const dur = o.dur ?? (0.6 + text.length * 0.055);
    const syl = Math.max(2, (text.match(/[aeiouäöüy]+/gi) || []).length), sd = dur / syl;
    let src;
    if (o.whisper) { src = ctx.createBufferSource(); src.buffer = this._noiseBuf || (this._noiseBuf = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })()); src.loop = true; }
    else { src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = o.f0 || 190; }
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = o.whisper ? 3 : 6;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = o.whisper ? 4 : 8;
    const env = ctx.createGain(); env.gain.value = 0.0001;
    src.connect(f1); src.connect(f2); f1.connect(env); f2.connect(env);
    const F = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [300, 870], [660, 1720], [440, 1020]];
    let t = t0;
    for (let i = 0; i < syl; i++) {
      const [a, b] = F[Math.floor(Math.random() * F.length)], k = o.whisper ? 1.25 : (o.f0 > 160 ? 1.15 : 1);
      f1.frequency.setValueAtTime(a * k, t); f2.frequency.setValueAtTime(b * k, t);
      if (!o.whisper) src.frequency.setValueAtTime((o.f0 || 190) * (1 + 0.1 * Math.sin(i * 0.9)), t);
      env.gain.setTargetAtTime((o.whisper ? 0.5 : 0.22) * (0.8 + Math.random() * 0.4), t, 0.02);
      env.gain.setTargetAtTime(0.01, t + sd * 0.6, 0.03);
      t += sd;
    }
    env.gain.setTargetAtTime(0.0001, t, 0.04);
    let out = env;
    if (o.pos) { const p = this._panner(o.pos, 'HRTF', 0.8); env.connect(p); out = p; }
    const g = ctx.createGain(); g.gain.value = (o.gain ?? 0.6); out.connect(g); g.connect(this.voiceLP);
    src.start(t0); src.stop(t + 0.2);
    return dur;
  }

  // ---------------------------------------------------------------- Menü-Musik
  /** Menü-Musik: „Almost Bliss“ (Kevin MacLeod, CC BY 4.0) als Schleife, leise im Hintergrund – nur in Menüs, keine Synthese */
  startMusic() {
    if (!this.ready || this.music) return;
    const rec = this._buf('music');
    if (rec) {
      const ctx = this.ctx, out = ctx.createGain(); out.gain.value = 0; out.connect(this.bus.music);
      out.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
      const s = ctx.createBufferSource(); s.buffer = rec; s.loop = true; s.connect(out); s.start();
      this.music = { out, stop: false, src: s };
    }
  }
  stopMusic() {
    if (!this.music) return;
    const m = this.music; m.stop = true; clearTimeout(m.timer);
    m.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    if (m.src) { try { m.src.stop(this.ctx.currentTime + 3); } catch (e) { /* schon gestoppt */ } }
    this.music = null;
  }
}
export const audio = new AudioEngine();
