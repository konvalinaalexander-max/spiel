// Audio-Engine: Mixer (Master/Stimme/Effekte/Ambiente/Musik), Hall, räumliche Quellen, Loops,
// Sprachausgabe (Web Speech API) + synthetisches "Murmeln" (räumlich, wenn keine/keine gewünschte TTS).
import { synthesizeAll, makeImpulse } from './synth.js';
import { storage, clamp, lerp } from '../core/util.js';

const AC = typeof AudioContext !== 'undefined' ? AudioContext : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.buffers = null; this.ready = false;
    this.vol = storage.get('volumes', { master: 0.85, voice: 1, sfx: 0.8, amb: 0.65, music: 0.5 });
    this.loops = {}; this.listenerPos = [0, 1.5, 0];
    this.muffle = 0; this.headphones = false;
    this.voiceMode = storage.get('voiceMode', 'tts'); // 'tts' | 'murmur' | 'off'
    this.ttsRate = storage.get('ttsRate', 1.0); this.ttsPitch = storage.get('ttsPitch', 0.9);
    this.tts = { supported: typeof speechSynthesis !== 'undefined', voice: null, speaking: false, utter: null };
    this.lang = 'de';
    this.music = null;
    this._pickVoiceBound = () => this.pickVoice();
    if (this.tts.supported) { try { speechSynthesis.addEventListener('voiceschanged', this._pickVoiceBound); } catch (e) { speechSynthesis.onvoiceschanged = this._pickVoiceBound; } }
  }
  /** Klänge vorab synthetisieren (geht ohne Nutzerinteraktion) */
  async prepare(progress) {
    try { this.buffers = await synthesizeAll(progress); } catch (e) { console.warn('Audio-Synthese fehlgeschlagen', e); this.buffers = {}; }
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
    // Hall (Send)
    this.reverb = ctx.createConvolver(); this.reverb.buffer = makeImpulse(ctx, 1.15);
    this.reverbIn = ctx.createGain(); this.reverbIn.gain.value = 0.35;
    const rvOut = ctx.createGain(); rvOut.gain.value = 0.8;
    this.reverbIn.connect(this.reverb); this.reverb.connect(rvOut); rvOut.connect(this.bus.sfx);
    // Dämpfung (Laptop-Fokus/Kopfhörer) für Raumklänge
    this.roomLP = ctx.createBiquadFilter(); this.roomLP.type = 'lowpass'; this.roomLP.frequency.value = 20000;
    this.roomBus = ctx.createGain(); this.roomBus.connect(this.roomLP); this.roomLP.connect(this.bus.sfx);
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
    const bus = o.bus === 'ui' ? this.bus.ui : o.bus === 'amb' ? this.bus.amb : o.bus === 'player' ? this.bus.sfx : this.roomBus;
    out.connect(bus);
    const rv = o.reverb ?? (o.pos ? 0.6 : 0);
    if (rv > 0) { const sg = ctx.createGain(); sg.gain.value = rv; out.connect(sg); sg.connect(this.reverbIn); }
    s.start(ctx.currentTime + (o.delay || 0));
    return s;
  }
  /** Loop starten/ändern */
  loop(name, o = {}) {
    if (!this.ready) return;
    let L = this.loops[name];
    if (!L) {
      const buf = this._buf(name); if (!buf) return;
      const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(g);
      let out = g;
      if (o.pos) { const p = this._panner(o.pos, 'equalpower', o.ref ?? 2); g.connect(p); out = p; }
      out.connect(o.bus === 'room' ? this.roomBus : this.bus.amb);
      if (o.reverb) { const sg = this.ctx.createGain(); sg.gain.value = o.reverb; out.connect(sg); sg.connect(this.reverbIn); }
      s.start(this.ctx.currentTime + Math.random() * 0.05, Math.random() * buf.duration);
      L = this.loops[name] = { s, g };
    }
    L.g.gain.setTargetAtTime(o.gain ?? 1, this.ctx.currentTime, o.fade ?? 0.6);
  }
  stopLoops(fade = 0.5) { for (const k in this.loops) this.loops[k].g.gain.setTargetAtTime(0, this.ctx.currentTime, fade); }

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
  setVoiceMode(m) { this.voiceMode = m; storage.set('voiceMode', m); if (m !== 'tts') this.stopSpeech(); }
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
    } else if (this.voiceMode !== 'off' && this.ready) {
      this._murmur(text, est, o);
    }
    return est;
  }
  stopSpeech() {
    if (this.tts.supported) { try { speechSynthesis.cancel(); } catch (e) { /* egal */ } }
    this.tts.speaking = false;
    if (this._murmurNodes) { try { this._murmurNodes.forEach(n => n.stop && n.stop()); } catch (e) { /* schon gestoppt */ } this._murmurNodes = null; }
  }
  get speaking() { return this.tts.speaking || (this._murmurEnd && this.ctx && this.ctx.currentTime < this._murmurEnd); }
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

  // ---------------------------------------------------------------- Menü-Musik
  /** Ruhige, generative Musik ("Campus am Morgen") – nur in Menüs */
  startMusic() {
    if (!this.ready || this.music) return;
    const ctx = this.ctx; const out = ctx.createGain(); out.gain.value = 0; out.connect(this.bus.music);
    out.gain.setTargetAtTime(0.35, ctx.currentTime, 1.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(out);
    const sg = ctx.createGain(); sg.gain.value = 0.5; lp.connect(sg); sg.connect(this.reverbIn);
    const chords = [[57, 64, 67, 71], [53, 60, 64, 69], [50, 57, 60, 65], [55, 62, 65, 71]]; // Am7 Fmaj7 Dm7 G7(sus)
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const state = { out, stop: false, i: 0 };
    const schedule = () => {
      if (state.stop) return;
      const t = ctx.currentTime + 0.05; const ch = chords[state.i % chords.length]; state.i++;
      for (const m of ch) {
        for (const det of [-4, 4]) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 6.4);
          o.connect(g); g.connect(lp); o.start(t); o.stop(t + 6.6);
        }
      }
      // ein paar Arpeggio-Töne
      for (let k = 0; k < 4; k++) {
        if (Math.random() < 0.35) continue;
        const tt = t + 0.8 + k * 1.3; const m = ch[(k + state.i) % 4] + 12;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.05, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.2);
        o.connect(g); g.connect(lp); o.start(tt); o.stop(tt + 2.3);
      }
      if (Math.random() < 0.4) this.play('bird', { bus: 'music', gain: 0.15, delay: 1 + Math.random() * 4 });
      state.timer = setTimeout(schedule, 6000);
    };
    schedule();
    this.music = state;
  }
  stopMusic() {
    if (!this.music) return;
    const m = this.music; m.stop = true; clearTimeout(m.timer);
    m.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6);
    this.music = null;
  }
}
export const audio = new AudioEngine();
