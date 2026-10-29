// Vorlesungs-Director: Zeitleiste, Abschnittsauswahl nach Zeitbudget, Beat-Ausführung (Sprache, Folie, Tafel,
// Blick, Geste), Ereignis-Pool mit Wahrscheinlichkeiten/Abklingzeiten, Dialogauswahl ohne Wiederholung, Ablauf-Log.
import * as THREE from 'three';
import * as LY from '../scene/layout.js';
import { clamp, makeRng } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SPEECH_RATE = 0.064;   // s pro Zeichen (ca. 14 Zeichen/s, ruhiger Vortrag)
const CHALK_CPS = 2.6;        // Zeichen pro Sekunde an der Tafel

export function estimateSpeech(text, rate = 1) { return 0.7 + text.length * SPEECH_RATE / rate; }
const plainLen = s => s.replace(/[\^_]\{([^}]*)\}/g, '$1').length;

/** Phasen-Anteile an der Gesamtzeit; Uhrzeit (Spielminuten) pro Phase */
export const PHASES = [
  { id: 'arrival', share: 0.06, clock: [10 * 60 + 10, 10 * 60 + 15] },
  { id: 'intro', share: 0.07, clock: [10 * 60 + 15, 10 * 60 + 21] },
  { id: 'part1', share: 0.37, clock: [10 * 60 + 21, 10 * 60 + 57] },
  { id: 'break', share: 0.06, clock: [10 * 60 + 57, 11 * 60 + 2] },
  { id: 'part2', share: 0.37, clock: [11 * 60 + 2, 11 * 60 + 39] },
  { id: 'closing', share: 0.07, clock: [11 * 60 + 39, 11 * 60 + 45] }
];

export class Director {
  /**
   * ctx: { sections (Abschnitte mit de/en), dialogue, lang, seconds (Gesamtdauer), seed, prof (ProfLogic),
   *        population, difficulty, out(type, data), busy() → true solange Sprache/Tafel extern noch läuft }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = makeRng(ctx.seed || 11);
    this.lang = ctx.lang || 'de';
    this.total = ctx.seconds;
    this.t = 0; this.phaseIdx = 0; this.phaseT = 0;
    this.phases = PHASES.map(p => ({ ...p, dur: p.share * this.total }));
    if (this.total < 300) { this.phases[3].dur *= 0.7; }
    this.queue = []; this.step = null; this.stepT = 0;
    this.used = new Map();
    this.cool = {}; this.counts = {};
    this.log = [];
    this.presented = []; // { id, beats gesprochen }
    this.boardState = { lowLines: 0, highUsed: false, blocks: [] };
    this.slideNo = 0; this.slideTotal = 0;
    this.sectionPlan = this._planSections();
    this.sectionIdx = -1; this.currentSection = null;
    this.quizPending = null; this.nextQuizAt = this._quizInterval() * 0.8;
    this.paused = false; this.ended = false;
    this.speedUp = 1;
    // Erzähl-Gedächtnis (V3): Running Gags mit Steigerung, Rückbezüge auf Ereignisse, Anekdoten je Abschnitt
    this.mem = { gags: {}, asked: null, latecomer: false, phone: false, caught: null, rightStreak: 0, lastAside: -999, callbacks: new Set(), told: new Set() };
    this.usedAsides = new Set();
    this._enqueuePhase();
  }
  // ------------------------------------------------------------------ Hilfen
  L(sec) { return sec[this.lang] || sec.de; }
  D() { return this.ctx.dialogue[this.lang] || this.ctx.dialogue.de; }
  /** Variante wählen, ohne Wiederholung innerhalb eines Durchlaufs */
  pick(key, vars) {
    const list = Array.isArray(key) ? key : this.D()[key];
    if (!list || !list.length) return '';
    const k = Array.isArray(key) ? JSON.stringify(key).slice(0, 40) : key;
    const used = this.used.get(k) || new Set();
    const free = list.map((_, i) => i).filter(i => !used.has(i));
    const idx = free.length ? free[Math.floor(this.rng.next() * free.length)] : Math.floor(this.rng.next() * list.length);
    used.add(idx); if (used.size >= list.length) used.clear(); this.used.set(k, used);
    let s = list[idx];
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, v) => (vars[v] !== undefined ? vars[v] : m));
    return s;
  }
  clockMinutes() {
    const ph = this.phases[this.phaseIdx] || this.phases[this.phases.length - 1];
    const f = clamp(this.phaseT / Math.max(1, ph.dur), 0, 1);
    return ph.clock[0] + (ph.clock[1] - ph.clock[0]) * f;
  }
  get phase() { return (this.phases[this.phaseIdx] || {}).id || 'end'; }
  out(type, data) {
    this.ctx.out(type, data);
    if (type !== 'tick') this.log.push({ t: +this.t.toFixed(1), clock: this.clockMinutes(), type, ...(data && typeof data === 'object' ? summarize(data) : { v: data }) });
  }
  _quizInterval() { const d = this.ctx.difficulty; return (d.quizEvery || 0.16) * this.total; }

  // ------------------------------------------------------------------ Abschnittsplanung
  _planSections() {
    const secs = this.ctx.sections.slice().sort((a, b) => a.order - b.order);
    const budget = (this.phases[2].dur + this.phases[4].dur) * 0.8; // 20 % für Ereignisse
    const estBeat = b => estimateSpeech(b.variants[0]) + b.pause + 0.5;
    const estSec = (s, beats) => beats.reduce((a, b) => a + estBeat(b) + (b.board ? 6 : 0), 0) + 6;
    // Kern zuerst, dann optionale in Lehrplanreihenfolge, solange Budget reicht
    const L = s => this.L(s);
    const chosen = new Map();
    let used = 0;
    const beatsFor = (s, maxBeats) => {
      const beats = L(s).beats;
      if (beats.length <= maxBeats) return beats.map((_, i) => i);
      // immer: erster, letzter, Folienwechsel, Tafelanschriebe; Rest auffüllen
      const keep = new Set([0, beats.length - 1]);
      beats.forEach((b, i) => { if (b.slide !== null || b.board) keep.add(i); });
      for (let i = 0; keep.size < maxBeats && i < beats.length; i++) keep.add(i);
      return [...keep].sort((a, b) => a - b).slice(0, Math.max(maxBeats, keep.size));
    };
    const tryAdd = (s, maxBeats) => {
      const idx = beatsFor(s, maxBeats);
      const cost = estSec(s, idx.map(i => L(s).beats[i]));
      if (used + cost <= budget || chosen.size === 0) { chosen.set(s.id, idx); used += cost; return true; }
      return false;
    };
    const core = secs.filter(s => s.core), opt = secs.filter(s => !s.core);
    // Zielgröße pro Abschnitt je nach Gesamtzeit
    const per = this.total >= 2400 ? 99 : this.total >= 900 ? 8 : this.total >= 600 ? 6 : 4;
    for (const s of core) if (!tryAdd(s, per)) tryAdd(s, Math.max(3, per - 2));
    for (const s of opt) tryAdd(s, per);
    const plan = secs.filter(s => chosen.has(s.id)).map(s => ({ sec: s, beats: chosen.get(s.id) }));
    this.slideTotal = plan.reduce((a, p) => a + this.L(p.sec).slides.length, 0) + 3;
    return plan;
  }

  // ------------------------------------------------------------------ Phasen → Schritte
  _enqueuePhase() {
    const ph = this.phase; const q = this.queue; const pl = this.ctx.prof;
    const D = this.D();
    if (ph === 'arrival') {
      q.push({ type: 'goto', spot: 'lectern', then: 'lectern' });
      q.push({ type: 'beamer', on: true });
      q.push({ type: 'slide', kind: 'boot' });
      q.push({ type: 'wait', t: 2.5 });
      q.push({ type: 'say', key: 'projector_wait', look: 'notes' });
      q.push({ type: 'slide', kind: 'desktop' });
      q.push({ type: 'event', name: 'mic_check' });
      q.push({ type: 'slide', kind: 'title' });
      q.push({ type: 'wait', t: 2 });
      q.push({ type: 'fill', until: 'phaseEnd' });
    } else if (ph === 'intro') {
      q.push({ type: 'goto', spot: 'front', then: 'class' });
      if (this.rng.chance(0.5)) q.push({ type: 'say', key: 'time_quarter', look: 'clock' });
      q.push({ type: 'say', key: 'greeting', look: 'class', gesture: 'open' });
      // Wetter vor dem Fenster (mit Bezug zu Tier und Futter), sonst Smalltalk
      if (this.D()['weather_' + this.ctx.weather] && this.rng.chance(0.75)) q.push({ type: 'say', key: 'weather_' + this.ctx.weather, look: 'window', gesture: 'explain' });
      if (this.rng.chance(0.45)) q.push({ type: 'say', key: 'smalltalk', look: 'class', gesture: 'explain' });
      q.push({ type: 'event', name: 'excursion_announce' });
      q.push({ type: 'say', key: 'recap', look: 'class', gesture: 'count' });
      q.push({ type: 'slide', kind: 'agenda' });
      q.push({ type: 'say', key: 'agenda', vars: () => ({ section: this.L(this.sectionPlan[0].sec).title }), look: 'screen', gesture: 'point' });
    } else if (ph === 'part1' || ph === 'part2') {
      q.push({ type: 'sections', until: 'phaseEnd' });
      if (ph === 'part1') q.unshift({ type: 'goto', spot: 'lectern', then: 'lectern' });
      else { q.unshift({ type: 'say', key: 'break_end', look: 'class' }); q.unshift({ type: 'goto', spot: 'frontR', then: 'class' }); q.unshift({ type: 'event', name: 'break_end' }); }
    } else if (ph === 'break') {
      q.push({ type: 'say', key: 'break_announce', look: 'class', gesture: 'open' });
      if (this.rng.chance(0.6)) q.push({ type: 'say', key: 'gag_mensa_break', look: 'class', after: () => this._gagDone('mensa') });
      q.push({ type: 'event', name: 'break_start' });
      q.push({ type: 'slide', kind: 'break' });
      q.push({ type: 'goto', spot: 'lectern', then: 'lectern' });
      q.push({ type: 'event', name: 'drink' });
      q.push({ type: 'fill', until: 'phaseEnd' });
    } else if (ph === 'closing') {
      q.push({ type: 'say', key: 'clock_check', vars: { minutes: 5 }, look: 'clock' });
      q.push({ type: 'goto', spot: 'front', then: 'class' });
      q.push({ type: 'slide', kind: 'end' });
      q.push({ type: 'say', key: 'closing', look: 'class', gesture: 'open' });
      if (this.mem.gags.rudi && this.rng.chance(0.6)) q.push({ type: 'say', key: 'gag_rudi_bye', look: 'class' });
      if (this.mem.gags.mensa && this.rng.chance(0.5)) q.push({ type: 'say', key: 'gag_mensa_end', look: 'class' });
      else if (this.mem.gags.bus40a && this.rng.chance(0.5)) q.push({ type: 'say', key: 'gag_bus40a_end', look: 'class' });
      q.push({ type: 'say', key: 'exam_info', look: 'class', gesture: 'count' });
      q.push({ type: 'say', key: 'slides_online', look: 'class' });
      q.push({ type: 'event', name: 'attendance_collect' });
      q.push({ type: 'event', name: 'knock' });
      q.push({ type: 'end' });
    }
  }

  // ------------------------------------------------------------------ Hauptschleife
  update(dt) {
    if (this.ended) return;
    this.t += dt; this.phaseT += dt;
    if (this.paused) return;
    const ph = this.phases[this.phaseIdx];
    // Phasenwechsel (weich: erst wenn der aktuelle Schritt fertig ist)
    if (ph && this.phaseT >= ph.dur && (!this.step || this.step.soft) && this.phase !== 'closing') {
      this.phaseIdx++; this.phaseT = 0; this.queue.length = 0; this.step = null;
      this.out('phase', { phase: this.phase });
      this._enqueuePhase();
    }
    if (this.step) {
      if (this._runStep(dt)) {
        this.step = null;
        // Phasenende direkt nach einem abgeschlossenen Schritt prüfen
        const p2 = this.phases[this.phaseIdx];
        if (p2 && this.phaseT >= p2.dur && this.phase !== 'closing') return;
      } else return;
    }
    // Ereignisse zwischen Schritten
    if (!this.step && this.queue.length && this._maybeEvent()) return;
    if (!this.step) {
      const next = this.queue[0];
      if (!next) return;
      if (next.type === 'sections') { if (!this._nextBeat()) { this.queue.shift(); this.queue.unshift({ type: 'fill', until: 'phaseEnd' }); } return; }
      if (next.type === 'fill') { this._filler(); return; }
      this.step = this.queue.shift(); this.stepT = 0; this._startStep(this.step);
    }
  }
  // ------------------------------------------------------------------ Schritte
  _startStep(s) {
    const pl = this.ctx.prof;
    switch (s.type) {
      case 'goto': s.eta = pl.goTo(s.spot, s.then); s.soft = true; break;
      case 'beamer': this.out('beamer', { on: s.on }); s.done = true; break;
      case 'slide': this._slide(s); s.done = true; break;
      case 'wait': s.soft = true; break;
      case 'say': {
        const vars = typeof s.vars === 'function' ? s.vars() : s.vars;
        const text = s.text || this.pick(s.key, vars);
        if (!text) { s.done = true; break; }
        s.dur = this._say(text, { speaker: s.speaker || 'prof', who: s.who, kind: s.kind || 'event', key: s.key });
        if (s.after) s.after();
        if (s.look) this._look(s.look);
        if (s.gesture) pl.gesture = s.gesture;
        break;
      }
      case 'beat': this._startBeat(s); break;
      case 'event': this._runEvent(s.name, s); break;
      case 'board': this._boardWrite(s); break;
      case 'end': this.ended = true; this.out('end', {}); break;
      case 'fn': s.fn && s.fn(); s.done = true; break;
      default: s.done = true;
    }
  }
  /** true = Schritt fertig */
  _runStep(dt) {
    const s = this.step, pl = this.ctx.prof; this.stepT += dt;
    if (s.done) return true;
    switch (s.type) {
      case 'goto': return !pl.walking || this.stepT > (s.eta || 5) + 6;
      case 'wait': return this.stepT >= s.t;
      case 'say': return this.stepT >= s.dur && !this.ctx.busy();
      case 'beat': return this._updateBeat(dt);
      case 'board': return this._updateBoard(dt);
      case 'event': return s.update ? s.update(dt, this.stepT) : this.stepT >= (s.dur || 0.1) && !this.ctx.busy();
      case 'quiz': return !!s.answered && this.stepT > s.answeredAt + 0.2;
      default: return true;
    }
  }
  _say(text, o = {}) {
    const dur = estimateSpeech(text) * (o.speaker === 'prof' ? 1 : 0.85);
    const pl = this.ctx.prof;
    if (o.speaker === 'prof') pl.talking = true;
    this.out('say', { text, dur, speaker: o.speaker || 'prof', who: o.who, kind: o.kind || 'lecture', key: o.key, section: this.currentSection?.sec.id });
    return dur;
  }
  _look(look, who) {
    const pl = this.ctx.prof;
    switch (look) {
      case 'class': pl.gaze.fixT = 0; break;
      case 'board': break;
      case 'screen': if (pl.face.mode !== 'screen') pl.lookAt(V(LY.SCREEN.x, LY.SCREEN.y, LY.SCREEN.z), 1.6, 'screen'); break;
      case 'notes': pl.lookAt(V(pl.pos.x, LY.PODIUM.h + 0.95, pl.pos.z + 0.4), 1.8, 'notes'); break;
      case 'window': pl.lookAt(V(LY.ROOM.x0 - 8, 2.6, pl.pos.z + 1), 1.8, 'window'); break;
      case 'clock': pl.lookAt(V(LY.CLOCK.x, LY.CLOCK.y, LY.CLOCK.z), 1.4, 'clock'); break;
      case 'student': {
        const s = who || this.rng.pick(this.ctx.population.students);
        pl.lookAt(V(s.seat.x, s.seat.floor + 1.2, s.seat.z), 2.2, 'student');
        break;
      }
    }
  }
  _slide(s) {
    const sec = this.currentSection ? this.L(this.currentSection.sec) : null;
    if (s.kind === 'content') this.slideNo++;
    this.out('slide', { kind: s.kind, section: this.currentSection?.sec.id, index: s.index ?? 0, no: this.slideNo, total: this.slideTotal, title: sec?.title, agenda: this.sectionPlan.map(p => this.L(p.sec).title), current: this.sectionIdx });
  }

  // ------------------------------------------------------------------ Beats
  _nextBeat() {
    let cs = this.currentSection;
    // Anekdote/Pointe nach dem eben gesprochenen Lehrsatz (einmal je Satzgrenze geprüft)
    if (cs && cs.pos > 0 && cs.asideAt !== cs.pos) { cs.asideAt = cs.pos; if (this._maybeAside(cs, cs.beats[cs.pos - 1])) return true; }
    if (!cs || cs.pos >= cs.beats.length) {
      this.sectionIdx++;
      if (this.sectionIdx >= this.sectionPlan.length) return false;
      const p = this.sectionPlan[this.sectionIdx];
      cs = this.currentSection = { sec: p.sec, beats: p.beats, pos: 0, slidesShown: new Set() };
      this.presented.push({ id: p.sec.id, beats: [] });
      if (this.sectionIdx > 0) this.queue.unshift({ type: 'say', key: 'transition', vars: { section: this.L(p.sec).title }, look: 'class', gesture: 'open', kind: 'transition' });
      this._sectionHooks(p.sec.id);
      this.out('section', { id: p.sec.id, title: this.L(p.sec).title, notes: this.L(p.sec).notes });
      return true;
    }
    const bi = cs.beats[cs.pos++];
    this.step = { type: 'beat', bi, sec: cs.sec }; this.stepT = 0; this._startBeat(this.step);
    return true;
  }
  _startBeat(s) {
    const pl = this.ctx.prof; const S = this.L(s.sec); const b = S.beats[s.bi];
    s.b = b; s.phase = 'move';
    const text = this.pick(b.variants.map(v => v));
    s.text = text;
    // Ort festlegen
    let spot = null, then = 'class';
    if (b.board) { spot = this._boardSpot(); then = 'board'; }
    else if (b.look === 'screen') { spot = 'screen'; then = 'screen'; }
    else if (b.look === 'notes') { spot = 'lectern'; then = 'lectern'; }
    else if (b.look === 'class' && (pl.face.mode === 'board' || pl.face.mode === 'screen' || pl.face.mode === 'lectern') && this.rng.chance(0.55)) { spot = this.rng.pick(['front', 'frontL', 'frontR', 'table']); then = 'class'; }
    else if (b.look === 'class' && this.rng.chance(0.12)) { spot = this.rng.pick(['front', 'frontL', 'frontR']); }
    if (this.aisleBeats > 0) {
      this.aisleBeats--;
      if (!b.board) { spot = null; then = 'class'; }
      if (this.aisleBeats === 0) this.queue.unshift({ type: 'say', key: 'aisle_return', look: 'class' }, { type: 'goto', spot: 'front', then: 'class' });
    }
    if (b.board && pl.activity === 'aisle') spot = this._boardSpot();
    if (spot && pl.distanceTo(spot) > 0.4) { s.eta = pl.goTo(spot, then); }
    else if (spot || b.board) pl.setFace(then);
    else if (b.look === 'class' && pl.face.mode !== 'class') pl.setFace('class');
    // Sprechen beginnt sofort (außer beim Tafelanschrieb: erst hingehen)
    s.speakNow = !b.board;
    if (b.slide !== null && b.slide !== undefined && !this.currentSection.slidesShown.has(b.slide)) {
      this.currentSection.slidesShown.add(b.slide);
      this.out('clicker', {});
      this._slide({ kind: 'content', index: b.slide });
    }
    if (s.speakNow) this._startBeatSpeech(s);
    pl.gesture = b.gesture;
    this.presented[this.presented.length - 1].beats.push(s.bi);
  }
  _startBeatSpeech(s) {
    s.dur = this._say(s.text, { speaker: 'prof', kind: 'lecture' }); s.speakT = 0; s.speaking = true;
    if (s.b.look !== 'board') this._look(s.b.look);
  }
  _updateBeat(dt) {
    const s = this.step, pl = this.ctx.prof;
    if (s.b.board && s.phase === 'move') {
      if (pl.walking) return false;
      s.phase = 'write';
      const block = this.L(s.sec).board.find(x => x.id === s.b.board);
      s.write = this._boardWrite({ lines: block ? block.lines : [], inline: true });
      this._startBeatSpeech(s);
    }
    if (s.speaking) { s.speakT += dt; if (s.speakT >= s.dur && !this.ctx.busy()) s.speaking = false; }
    if (s.write && !s.write.done) { this._updateBoard(dt, s.write); return false; }
    if (s.speaking) return false;
    // Pause nach dem Beat
    s.pauseT = (s.pauseT || 0) + dt;
    if (s.pauseT < (s.b.pause || 0.5) / this.speedUp) return false;
    pl.talking = false;
    if (s.write) pl.setWriting(false);
    return true;
  }
  _boardSpot() {
    const st = this.boardState;
    // Stiftposition: Zeilen beginnen links → Standort links/Mitte
    return st.lowLines < 2 ? 'boardL' : st.lowLines < 4 ? 'boardC' : 'boardR';
  }
  /** Tafelanschrieb (synchron mit Darstellung über 'board'-Ereignis, Dauer aus Zeichenzahl) */
  _boardWrite(s) {
    const pl = this.ctx.prof, st = this.boardState;
    const lines = s.lines;
    // Platz? Sonst Tafel schieben bzw. wischen (eigene Ereignisse)
    if (st.lowLines + lines.length > 5) {
      if (!st.highUsed) { this.out('board', { action: 'slide' }); st.highUsed = true; st.lowLines = 0; this._count('board_slide'); }
      else { this.out('board', { action: 'wipe' }); st.lowLines = 0; st.highUsed = false; this._count('board_wipe'); }
      s.preDelay = 3.2;
    }
    const chars = lines.reduce((a, l) => a + plainLen(l), 0);
    const dur = Math.max(2.5, chars / CHALK_CPS) / this.speedUp;
    const job = { lines, dur, t: -(s.preDelay || 0), done: false, row: st.lowLines };
    st.lowLines += lines.length;
    pl.setWriting(true);
    this.out('board', { action: 'write', lines, duration: dur, delay: s.preDelay || 0, row: job.row });
    if (!s.inline) { s.job = job; }
    return job;
  }
  _updateBoard(dt, job) {
    const j = job || this.step.job; const pl = this.ctx.prof;
    j.t += dt;
    if (j.t < 0) { pl.activity = 'board'; return false; }
    pl.activity = 'write';
    // Stiftposition (logisch) für den Blick: wandert über die Zeile
    const lineK = Math.min(j.lines.length - 1, Math.floor(j.t / j.dur * j.lines.length));
    const u = (j.t / j.dur * j.lines.length) % 1;
    pl.writePen = V(LY.BOARD.x - LY.BOARD.w / 2 + 0.25 + u * 2.4, LY.BOARD.lowY + LY.BOARD.panelH - 0.2 - (j.row + lineK) * 0.19, LY.BOARD.zFront + 0.02);
    if (j.t >= j.dur) { j.done = true; pl.writePen = null; pl.setWriting(false); return true; }
    return false;
  }

  // ------------------------------------------------------------------ Füllen (Arrival/Pause)
  // ------------------------------------------------------------------ Erzählen (V3)
  _gagDone(id) { this.mem.gags[id] = (this.mem.gags[id] || 0) + 1; }
  /** nächste Stufe eines gesteigerten Running Gags (beamer: 1–3) */
  _gagKey(id) { const n = Math.min(3, (this.mem.gags[id] || 0) + 1); return `gag_${id}_${n}`; }
  /** Anekdote aus dem Abschnitt nach Lehrsatz bi – mit Abstand zur letzten Pointe, nie während Rechnung/Frage */
  _maybeAside(cs, bi) {
    const list = (cs.sec.asides || []).filter((a, i) => a.after === bi && !this.usedAsides.has(cs.sec.id + i));
    // Dosis laut Persona-Bibel: etwa 8–12 Anekdoten/Pointen je 90 Minuten (inkl. Witze aus dem Pool), nie zwei direkt hintereinander
    const maxAsides = Math.max(2, Math.round(this.total / 140)), gap = Math.max(50, this.total / 10);
    if (!list.length || this.usedAsides.size >= maxAsides || this.t - this.mem.lastAside < gap || this.quizPending || !this.rng.chance(0.5)) return false;
    const a = list[0], idx = cs.sec.asides.indexOf(a);
    this.usedAsides.add(cs.sec.id + idx); this.mem.lastAside = this.t;
    if (a.gag) this._gagDone(a.gag);
    this.step = { type: 'event', name: 'aside', aside: a }; this.stepT = 0; this._runEvent('aside', this.step);
    return true;
  }
  /** Abschnittsbezogene Running Gags und Rückbezüge beim Themenwechsel */
  _sectionHooks(id) {
    const q = this.queue, g = this.mem.gags, m = this.mem, once = k => (m.told.has(k) ? false : (m.told.add(k), true));
    const push = (key, o = {}) => q.splice(1, 0, { type: 'say', key, look: 'class', kind: 'joke', ...o });
    if (id === 'energie' && !g.mensa && this.rng.chance(0.65) && once('mensa_energy')) push('gag_mensa_energy', { after: () => this._gagDone('mensa') });
    if ((id === 'protein_wdk' || id === 'umwelt') && g.rudi && this.rng.chance(0.55) && once('rudi_cb')) push('gag_rudi_callback');
    if ((id === 'einfuehrung' || id === 'ration_milchkuh') && this.rng.chance(0.45) && once('rosi')) push('gag_rosi', { after: () => this._gagDone('rosi') });
    if ((id === 'futtermittel' || id === 'konservierung') && this.rng.chance(0.6) && once('gras')) q.splice(1, 0, { type: 'event', name: 'gras_callout' });
    // Rückbezüge: höchstens einer je Themenwechsel
    const cands = [];
    if (m.asked && !m.callbacks.has('question')) cands.push(['question', 'callback_question', { row: m.asked }]);
    if (m.latecomer && !m.callbacks.has('late')) cands.push(['late', 'callback_latecomer']);
    if (m.phone && !m.callbacks.has('phone')) cands.push(['phone', 'callback_phone']);
    if (m.caught && this.t - m.caught.t > 60 && !m.callbacks.has('caught')) cands.push(['caught', 'callback_caught', { row: m.caught.row }]);
    if (cands.length && this.rng.chance(0.4)) { const [k, key, vars] = this.rng.pick(cands); m.callbacks.add(k); push(key, { vars }); }
  }
  /** vom Spiel gemeldet: Spieler:in wurde ermahnt (für einen späteren, freundlichen Rückbezug) */
  noteCaught(row) { this.mem.caught = { row, t: this.t }; }
  _filler() {
    const ph = this.phase, pl = this.ctx.prof;
    if (ph === 'arrival') { this.step = { type: 'wait', t: 1.5, soft: true }; this.stepT = 0; pl.setFace('lectern'); return; }
    if (ph === 'break') { this.step = { type: 'wait', t: 2, soft: true }; this.stepT = 0; if (pl.face.mode !== 'lectern' && !pl.walking) pl.goTo('lectern', 'lectern'); return; }
    // Abschnitte aufgebraucht: Wiederholung / Fragen ans Publikum
    this.step = { type: 'say', key: this.rng.chance(0.5) ? 'exam_hint' : 'recap', vars: { section: this.currentSection ? this.L(this.currentSection.sec).title : '' }, look: 'class' };
    this.stepT = 0; this._startStep(this.step);
  }

  // ------------------------------------------------------------------ Ereignisse
  _count(name) { this.counts[name] = (this.counts[name] || 0) + 1; this.cool[name] = this.t; }
  _cooled(name, cd) { return this.cool[name] === undefined || this.t - this.cool[name] > cd; }
  _maybeEvent() {
    if (this.phase !== 'part1' && this.phase !== 'part2') return false;
    const D = this.ctx.difficulty; const f = this.t / this.total;
    // Direktfrage an den Spieler
    if (this.t >= this.nextQuizAt && this.presented.length && !this.ctx.blockQuiz?.()) {
      this.nextQuizAt = this.t + this._quizInterval() * (0.8 + this.rng.next() * 0.5);
      this.step = { type: 'event', name: 'direct_question' }; this.stepT = 0; this._runEvent('direct_question', this.step); return true;
    }
    const table = [
      ['latecomer', 0, 0.12, 0.35, 1, 0.05],
      ['audience_question', 140, 0.15, 0.95, 4, 0.05],
      ['phone_ring', 200, 0.15, 0.9, 1, 0.012],
      ['projector_lost', 9999, 0.25, 0.8, 1, 0.01],
      ['aisle_walk', 260, 0.2, 0.9, 2, 0.012 * (D.aisle ?? 1)],
      ['attendance_start', 9999, 0.22, 0.5, 1, 0.05],
      ['joke', 80, 0.1, 0.95, 6, 0.04],
      ['drink', 150, 0.1, 0.95, 3, 0.02],
      ['clock_check', 300, 0.6, 0.85, 1, 0.03],
      ['exam_hint', 120, 0.2, 0.95, 4, 0.03],
      ['mic_feedback', 9999, 0.05, 0.4, 1, 0.01],
      ['blinds', 9999, 0.08, 0.5, 1, this.ctx.weather === 'sunny' ? 0.02 : 0],
      ['rain_start', 9999, 0.3, 0.7, 1, this.ctx.weather === 'cloudy' ? 0.015 : 0],
      ['door_bang', 400, 0.3, 0.95, 1, 0.006],
      ['leaves_early', 9999, 0.7, 0.92, 1, 0.012],
      ['cough_fit', 300, 0.1, 0.95, 1, 0.008],
      ['light_flicker', 300, 0.1, 0.95, 2, 0.008],
      ['bottle_drop', 9999, 0.1, 0.95, 1, 0.006],
      ['long_calc', 9999, 0.25, 0.85, 1, this.currentSection?.sec.id === 'ration_milchkuh' ? 0.5 : 0.008],
      ['tutor_pass', 240, 0.2, 0.9, 2, 0.01],
      ['clicker_fail', 200, 0.15, 0.9, 2, 0.01],
      ['phone_vibrate', 240, 0.1, 0.9, 2, 0.008],
      ['student_laugh', 9999, 0, 0, 0, 0]
    ];
    for (const [name, cd, f0, f1, max, p] of table) {
      if (f < f0 || f > f1 || (this.counts[name] || 0) >= max || !this._cooled(name, cd) || !p) continue;
      if (this.rng.chance(p)) { this.step = { type: 'event', name }; this.stepT = 0; this._runEvent(name, this.step); return true; }
    }
    return false;
  }
  _runEvent(name, s) {
    const pl = this.ctx.prof, pop = this.ctx.population, D = this.D();
    this._count(name);
    this.out('event', { name });
    const say = (key, o = {}) => { const tx = o.text || this.pick(key, o.vars); return tx ? this._say(tx, { speaker: o.speaker || 'prof', who: o.who, kind: o.kind || 'event', key }) : 0; };
    const seq = (steps) => { // kleine Schrittfolge innerhalb des Ereignisses
      let i = -1, tt = 0, cur = null;
      s.update = (dt) => {
        tt += dt;
        if (!cur || cur.done(tt, dt)) { i++; tt = 0; if (i >= steps.length) return true; cur = steps[i]; cur.start && cur.start(); }
        return false;
      };
    };
    const sayStep = (key, o = {}) => { let d = 0; return { start: () => { d = say(key, o); if (o.look) this._look(o.look, o.whoObj); }, done: t => t >= d && !this.ctx.busy() }; };
    const wait = d => ({ done: t => t >= d });
    const act = fn => ({ start: fn, done: () => true });
    const until = (fn, max = 20) => ({ done: t => fn() || t > max });
    // Reaktion des Saals auf eine Pointe: meist Lachen (manchmal mit Antwort des Profs), selten betretene Stille
    const react = () => { const r = this.rng.next(); if (r < 0.72) return [act(() => this.out('fx', { kind: 'laugh' })), wait(0.9), ...(this.rng.chance(0.3) ? [sayStep('laugh_response')] : [])]; if (r < 0.85) return [wait(1.4), sayStep('joke_flop')]; return [wait(0.6)]; };
    switch (name) {
      case 'mic_check':
        seq([act(() => this.out('fx', { kind: 'micThump' })), sayStep('mic_check', { look: 'class' }), wait(0.6), act(() => { if (this.rng.chance(0.35)) { this.out('fx', { kind: 'micFeedback' }); this._count('mic_feedback'); } }), wait(0.5)]);
        break;
      case 'mic_feedback':
        seq([act(() => this.out('fx', { kind: 'micFeedback' })), wait(1.2), sayStep('mic_feedback')]);
        break;
      case 'excursion_announce':
        seq([sayStep('orga_excursion', { look: 'class' }), wait(0.2)]);
        break;
      case 'direct_question': {
        const q = this._pickQuiz();
        if (!q) { s.done = true; break; }
        const row = this.ctx.playerRow();
        seq([
          act(() => { pl.lookPlayer(30); pl.setFace('class'); this.out('quizIntro', {}); }),
          sayStep('direct_question_intro', { vars: { row } }),
          act(() => { this._say(q.q, { speaker: 'prof', kind: 'question' }); this.quizPending = { ...q, askedAt: this.t }; this.out('quiz', { q: q.q, answers: q.answers, correctIndex: q.correctIndex, explain: q.explain, section: q.section, calc: q.calc, timeLimit: this.ctx.difficulty.quizTime || 16 }); }),
          until(() => this.quizPending && this.quizPending.result !== undefined, 60),
          { start: () => { const r = this.quizPending.result; this.mem.rightStreak = r === 'right' ? this.mem.rightStreak + 1 : 0; const k = r === 'right' ? (this.mem.rightStreak >= 2 && this.D().quiz_right_streak ? 'quiz_right_streak' : 'quiz_right') : r === 'timeout' ? 'quiz_timeout' : 'quiz_wrong'; this._qd = say(k); if (r !== 'right') this._qd2 = this.quizPending.explain; }, done: t => t >= (this._qd || 1) && !this.ctx.busy() },
          { start: () => { if (this._qd2) { this._qd = this._say(this._qd2, { speaker: 'prof', kind: 'event' }); } else this._qd = 0; this._qd2 = null; }, done: t => t >= (this._qd || 0) && !this.ctx.busy() },
          act(() => { pl.gaze.overrideT = 0; this.quizPending = null; })
        ]);
        break;
      }
      case 'latecomer': {
        seq([
          act(() => this.out('fx', { kind: 'latecomer' })), act(() => pl.lookAt(V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1.6, LY.BACK_DOOR.z), 3, 'door')),
          wait(2.2), sayStep('latecomer_enter', { speaker: 'student', who: 'late', kind: 'whisper' }),
          act(() => { this.mem.latecomer = true; if (this.rng.chance(0.6)) { if (this.rng.chance(0.5) && this.D().gag_bus40a_late) { this.queue.unshift({ type: 'say', key: 'gag_bus40a_late', look: 'class', kind: 'joke' }); this._gagDone('bus40a'); } this.queue.unshift({ type: 'say', key: 'latecomer_prof', look: 'class' }); } })
        ]);
        break;
      }
      case 'audience_question': {
        const sid = this.presented[this.presented.length - 1]?.id;
        const list = (D.audience_questions || []).filter(a => this.presented.some(p => p.id === a.section));
        const candidates = list.filter(a => a.section === sid).concat(list);
        const qa = candidates.find(a => !this.usedAQ?.has(a.student)) || null;
        if (!qa) { s.done = true; break; }
        (this.usedAQ = this.usedAQ || new Set()).add(qa.student);
        const asker = pop.students.find(x => x.profile === 'asker' && x.seat) || this.rng.pick(pop.students);
        const askerHead = V(asker.seat.x, asker.seat.floor + 1.25, asker.seat.z);
        this.mem.asked = asker.seat.row + 1;
        seq([
          act(() => this.out('fx', { kind: 'handRaise', who: asker.id })), wait(1.6 + this.rng.next()),
          act(() => { pl.lookAt(askerHead, 12, 'student'); pl.setFace('class'); }),
          { start: () => { this._qd = this._say(qa.student, { speaker: 'student', who: asker.id, kind: 'question' }); }, done: t => t >= this._qd },
          act(() => this.out('fx', { kind: 'handDown', who: asker.id })),
          { start: () => { this._qd = this._say(qa.repeat, { speaker: 'prof', kind: 'event' }); }, done: t => t >= this._qd && !this.ctx.busy() },
          ...qa.answer.map(a => ({ start: () => { this._qd = this._say(a, { speaker: 'prof', kind: 'lecture' }); pl.gaze.overrideT = 0; }, done: t => t >= this._qd && !this.ctx.busy() }))
        ]);
        break;
      }
      case 'phone_ring': {
        const who = this.rng.pick(pop.students);
        this.mem.phone = true;
        const resume = this.currentSection && this.rng.chance(0.4) ? [wait(0.4), sayStep('resume_after_interrupt', { vars: { section: this.L(this.currentSection.sec).title } })] : [];
        seq([act(() => this.out('fx', { kind: 'phoneRing', who: who.id })), wait(1.8), act(() => pl.lookAt(V(who.seat.x, who.seat.floor + 1.1, who.seat.z), 3, 'student')), sayStep('phone_ring_prof'), sayStep('phone_ring_student', { speaker: 'student', who: who.id, kind: 'whisper' }), ...resume]);
        break;
      }
      case 'projector_lost':
        seq([
          act(() => { this.out('slide', { kind: 'nosignal' }); }), wait(1.2), sayStep('projector_lost'),
          act(() => pl.goTo('lectern', 'lectern')), until(() => !pl.walking, 12),
          sayStep('projector_fixing', { look: 'notes' }), wait(4 + this.rng.next() * 5), sayStep('projector_fixing', { look: 'notes' }), wait(2 + this.rng.next() * 3),
          act(() => this.out('slide', { kind: 'restore' })), sayStep('projector_back'),
          { start: () => { this._qd = say(this._gagKey('beamer'), { kind: 'joke' }); this._gagDone('beamer'); }, done: t => t >= (this._qd || 0) && !this.ctx.busy() },
          ...(this.currentSection ? [sayStep('resume_after_interrupt', { vars: { section: this.L(this.currentSection.sec).title } })] : [])
        ]);
        break;
      case 'aisle_walk': {
        const row = this.rng.int(3, 7);
        seq([sayStep('aisle_walk'), act(() => pl.planAisle(row)), until(() => !pl.walking, 25), act(() => { pl.setFace('class'); this.aisleBeats = 2; this.out('fx', { kind: 'aisle', row }); })]);
        break;
      }
      case 'attendance_start':
        seq([act(() => this.out('fx', { kind: 'attendanceStart' })), sayStep('attendance_start', { look: 'class' })]);
        break;
      case 'attendance_collect':
        seq([sayStep('attendance_collect', { look: 'class' }), act(() => this.out('fx', { kind: 'attendanceCollect' }))]);
        break;
      case 'joke':
        seq([sayStep('joke', { look: 'class', kind: 'joke' }), ...react()]);
        break;
      case 'drink':
        seq([sayStep('drink'), act(() => { pl.gesture = 'drink'; this.out('fx', { kind: 'drink' }); }), wait(5.5), act(() => { pl.gesture = 'none'; })]);
        break;
      case 'clock_check':
        seq([act(() => this._look('clock')), wait(1.2), sayStep('clock_check', { vars: { minutes: Math.round(11 * 60 + 45 - this.clockMinutes()) } }), act(() => { this.speedUp = 1.25; })]);
        break;
      case 'exam_hint':
        seq([this.rng.chance(0.4) && this.D().gag_pruefung ? sayStep('gag_pruefung', { look: 'class', kind: 'joke' }) : sayStep('exam_hint', { vars: { section: this.currentSection ? this.L(this.currentSection.sec).title : '' }, look: 'class' })]);
        break;
      case 'blinds':
        seq([act(() => pl.lookAt(V(LY.SCREEN.x, LY.SCREEN.y, LY.SCREEN.z), 2, 'screen')), sayStep('blinds'), act(() => { pl.goTo('lectern', 'lectern'); }), until(() => !pl.walking, 10), act(() => this.out('fx', { kind: 'blinds', window: 0, value: 0.85 })), wait(2)]);
        break;
      case 'rain_start':
        seq([act(() => this.out('fx', { kind: 'rain' })), wait(3), act(() => this._look('window')), sayStep('rain_start'), ...(this.rng.chance(0.5) ? [sayStep('gag_bus40a_weather', { kind: 'joke' }), act(() => this._gagDone('bus40a'))] : [])]);
        break;
      case 'door_bang':
        seq([act(() => this.out('fx', { kind: 'doorBang' })), act(() => pl.lookAt(V(LY.BACK_DOOR.x, LY.BACK_FLOOR + 1.6, LY.BACK_DOOR.z), 2.2, 'door')), wait(1.2), sayStep('door_bang')]);
        break;
      case 'leaves_early': {
        const who = pop.students.find(x => x.seat.k <= 1 || x.seat.k >= LY.SEATS - 2) || pop.students[0];
        seq([act(() => this.out('fx', { kind: 'leave', who: who.id })), wait(4), act(() => pl.lookAt(V(who.seat.x, who.seat.floor + 1.6, who.seat.z), 2, 'student')), sayStep('leaves_early')]);
        break;
      }
      case 'cough_fit': {
        const who = this.rng.pick(pop.students);
        seq([act(() => this.out('fx', { kind: 'coughFit', who: who.id })), wait(3.5), act(() => pl.lookAt(V(who.seat.x, who.seat.floor + 1.2, who.seat.z), 2.5, 'student')), sayStep('cough_fit')]);
        break;
      }
      case 'light_flicker':
        seq([act(() => this.out('fx', { kind: 'flicker' })), wait(1.2), act(() => pl.lookAt(V(0, LY.ROOM.h, -1), 1.5, 'ceiling')), sayStep('light_flicker')]);
        break;
      case 'bottle_drop': {
        const who = this.rng.pick(pop.students);
        seq([act(() => this.out('fx', { kind: 'bottleDrop', who: who.id })), wait(1.5), sayStep('bottle_drop')]);
        break;
      }
      case 'long_calc': {
        const sec = this.currentSection ? this.L(this.currentSection.sec) : null;
        const c = sec?.calc; if (!c) { s.done = true; break; }
        const steps = c.steps.slice(0, 5);
        seq([
          sayStep('long_calc_intro', { look: 'class' }),
          { start: () => { this.ctx.prof.goTo(this._boardSpot(), 'board'); }, done: () => !pl.walking },
          { start: () => { this._calcJob = this._boardWrite({ lines: [c.title.slice(0, 28), ...steps.slice(0, 2)], inline: true }); }, done: (t, dt) => this._updateBoard(dt, this._calcJob) },
          sayStep('long_calc_step'),
          { start: () => { this._calcJob = steps.length > 2 ? this._boardWrite({ lines: steps.slice(2), inline: true }) : { done: true }; }, done: (t, dt) => this._calcJob.done || this._updateBoard(dt, this._calcJob) },
          act(() => pl.setFace('class')),
          sayStep('long_calc_end', { look: 'class' })
        ]);
        break;
      }
      case 'tutor_pass':
        seq([act(() => this.out('fx', { kind: 'tutorPass' })), wait(6)]);
        break;
      case 'aside': {
        const a = s.aside, text = a[this.lang] || a.de;
        // Beim Erzählen wandert der Blick: erst ins Erinnern (Fenster/Notizen), zur Pointe zurück in den Saal
        const lookAt = a.kind === 'frage' ? 'student' : a.kind === 'anecdote' ? this.rng.pick(['window', 'notes', 'window', 'class']) : 'class';
        seq([act(() => { pl.setFace('class'); pl.gesture = 'explain'; }),
          { start: () => { this._qd = say(null, { text, kind: a.kind === 'frage' ? 'question' : 'joke' }); this._qBack = lookAt === 'class' || lookAt === 'student'; this._look(lookAt); },
            done: t => { if (!this._qBack && t > this._qd * 0.65) { this._qBack = true; this._look('class'); } return t >= this._qd && !this.ctx.busy(); } },
          ...(a.kind === 'frage' ? [wait(0.8)] : react())]);
        break;
      }
      case 'clicker_fail':
        seq([act(() => this.out('clicker', {})), wait(1.1), act(() => this.out('clicker', {})), wait(0.8), act(() => this._look('screen')),
          { start: () => { this._qd = say(this._gagKey('beamer'), { kind: 'joke' }); this._gagDone('beamer'); }, done: t => t >= (this._qd || 0) && !this.ctx.busy() }, act(() => this.out('clicker', {})), wait(0.5)]);
        break;
      case 'gras_callout': {
        const who = this.rng.pick(pop.students);
        seq([act(() => pl.lookAt(V(who.seat.x, who.seat.floor + 1.2, who.seat.z), 3, 'student')), sayStep('student_gras', { speaker: 'student', who: who.id, kind: 'whisper' }), wait(0.5), sayStep('gag_gras', { look: 'class', kind: 'joke' }), ...react()]);
        break;
      }
      case 'phone_vibrate':
        seq([act(() => this.out('fx', { kind: 'phoneVibratePlayer' })), wait(1.5)]);
        break;
      case 'break_start':
        seq([act(() => this.out('fx', { kind: 'breakStart' })), wait(0.5)]);
        break;
      case 'break_end':
        seq([act(() => this.out('fx', { kind: 'breakEnd' })), wait(2)]);
        break;
      case 'knock':
        seq([act(() => this.out('fx', { kind: 'knock' })), wait(3.5)]);
        break;
      default: s.done = true;
    }
  }
  /** Quizfrage: aus präsentierten Abschnitten, Antwort im Gesagten/auf Folie/Tafel vorhanden */
  _pickQuiz() {
    const asked = this.askedQuiz || (this.askedQuiz = new Set());
    const cand = [];
    for (let i = this.presented.length - 1; i >= 0; i--) {
      const sec = this.ctx.sections.find(s => s.id === this.presented[i].id); if (!sec) continue;
      const L = this.L(sec);
      const said = this.presented[i].beats.map(b => L.beats[b].variants.join(' ')).join(' ') + ' ' + L.slides.map(s => s.bullets.join(' ')).join(' ') + ' ' + L.board.map(b => b.lines.join(' ')).join(' ');
      L.quiz.forEach((q, k) => {
        const id = sec.id + ':' + k; if (asked.has(id)) return;
        const words = q.correct.toLowerCase().split(/[^a-zäöüß0-9,]+/).filter(w => w.length > 3);
        const hit = words.length ? words.filter(w => said.toLowerCase().includes(w)).length / words.length : 0.5;
        cand.push({ id, sec, q, score: hit + (i === this.presented.length - 1 ? 0.5 : 0) + (q.calc ? 0.1 : 0) });
      });
    }
    if (!cand.length) return null;
    cand.sort((a, b) => b.score - a.score);
    const c = cand[0]; asked.add(c.id);
    const answers = this.rng.shuffle([c.q.correct, ...c.q.wrong]);
    return { q: c.q.q, answers, correctIndex: answers.indexOf(c.q.correct), explain: c.q.explain, section: c.sec.id, calc: !!c.q.calc };
  }
  /** Session meldet Quiz-Ergebnis */
  answerQuiz(result) { if (this.quizPending) this.quizPending.result = result; }
  /** Reaktionen von außen (Erwischt, Aufmerksamkeit) unterbrechen den laufenden Schritt nicht, sondern werden vorgezogen */
  interject(steps) { if (this.step && this.step.type === 'beat' && this.step.speaking) { /* Beat fertig sprechen lassen */ } this.queue.unshift(...steps); }
  sayNow(key, vars, o = {}) { return this._say(this.pick(key, vars), { speaker: 'prof', kind: o.kind || 'alert', key }); }
}

function summarize(d) {
  const o = {};
  for (const k of ['name', 'kind', 'speaker', 'action', 'phase', 'section', 'index', 'key', 'who', 'id', 'title']) if (d[k] !== undefined) o[k] = d[k];
  if (d.text) o.text = d.text.length > 90 ? d.text.slice(0, 88) + '…' : d.text;
  if (d.lines) o.lines = d.lines.join(' | ');
  if (d.q) o.q = d.q;
  return o;
}
