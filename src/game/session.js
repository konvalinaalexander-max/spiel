// Spielsitzung: verbindet Director, Prof-Logik, Sichtmodell, Verdacht, Spieler, Tic Tac Toe, Gegner:in,
// Nachbarin, Tutorin, Exkursionsliste, Quiz, Konsequenzen, Punkte, Note und Erfolge.
// DOM-frei: läuft im Spiel (mit Darstellung) und im Bot-Test (ohne Rendering) identisch.
import * as THREE from 'three';
import * as LY from '../scene/layout.js';
import { planPopulation } from './population.js';
import { Vision } from './vision.js';
import { ProfLogic, EYE_H } from './profLogic.js';
import { Suspicion } from './suspicion.js';
import { Director } from './director.js';
import { TicTacToe } from './tictactoe.js';
import { Opponent } from './opponent.js';
import { DIFFICULTIES, LENGTHS, seatMultiplier, customDifficulty, scaledTarget } from './config.js';
import { clamp, damp, makeRng, smoothstep } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Session {
  /**
   * cfg: { difficulty: id | custom-Objekt, length: 'short'|'normal'|'long'|'realtime' | Sekunden, seat: {row,k},
   *        mode: 'tournament'|'bo5'|'blitz', opponent: 'hall'|'online', oppSkill, seed, lang, weather }
   * content: { sections, dialogue }, emit(type, data)
   */
  constructor(cfg, content, emit = () => {}) {
    this.cfg = cfg; this.emit = emit;
    this.rng = makeRng(cfg.seed || 20261027);
    this.diff = typeof cfg.difficulty === 'object' ? customDifficulty(cfg.difficulty) : (DIFFICULTIES[cfg.difficulty] || DIFFICULTIES.bachelor);
    this.seconds = typeof cfg.length === 'number' ? cfg.length : LENGTHS[cfg.length || 'normal'];
    this.target = scaledTarget(this.diff.target, this.seconds);
    this.seat = { ...(cfg.seat || { row: 4, k: 7 }) };
    this.pop = planPopulation(cfg.popSeed || 4711, this.seat);
    this.vision = new Vision(this.pop);
    this.prof = new ProfLogic((cfg.seed || 1) + 3, this.diff.prof);
    this.prof.scanTargets = this.pop.students.map(s => V(s.seat.x, s.seat.floor + 1.22, s.seat.z));
    this.susp = new Suspicion({ rateMul: 1 });
    this.t = 0; this.state = 'playing'; this.endReason = null;
    // Spieler
    this.player = {
      mode: 'listen', blend: 0, headYaw: 0, headPitch: 0, motion: 0, lastYaw: 0, lastPitch: 0,
      lid: 108, brightness: 0.85, headphones: false, muted: false, gameVisible: true, app: 'ttt', luma: 0.3,
      hands: 0, forcedT: 0, laptopTime: 0, notes: {}, notesTotal: 0, listenTime: 0, listT: 0,
      head: V(), headTag: 'player', tellNotify: 0
    };
    this._placePlayer();
    // Tic Tac Toe + Gegner:in
    this.ttt = new TicTacToe({ mode: cfg.mode || 'tournament', onEvent: (t, d) => this._tttEvent(t, d) });
    const oppStudent = cfg.opponent === 'online' ? null : this.pop.opponent;
    this.opp = new Opponent({
      mode: cfg.opponent === 'online' ? 'online' : 'hall', skill: cfg.oppSkill ?? this.diff.oppSkill,
      name: oppStudent ? oppStudent.name : (cfg.lang === 'en' ? 'Online opponent' : 'Online-Gegner'),
      where: oppStudent ? { row: oppStudent.seat.row + 1, k: oppStudent.seat.k + 1 } : null,
      student: oppStudent, ttt: this.ttt, rng: this.rng.fork(9), prof: this.prof, vision: this.vision,
      chat: key => this._chat(key)
    });
    this.opp.onCaught = () => this._opponentCaught();
    // Director
    this.director = new Director({
      sections: content.sections, dialogue: content.dialogue, lang: cfg.lang || 'de', seconds: this.seconds, seed: (cfg.seed || 1) + 17,
      prof: this.prof, population: this.pop, difficulty: this.diff, weather: cfg.weather || 'sunny',
      out: (t, d) => this._directorOut(t, d), busy: () => this.externalBusy(),
      playerRow: () => this.seat.row + 1, blockQuiz: () => this.state !== 'playing'
    });
    this.content = content;
    // Statistik
    this.stats = { quizRight: 0, quizWrong: 0, quizAsked: 0, strikes: 0, warnings: 0, chalkMoves: 0, breakWins: 0, snake: 0, signed: false, movedFront: false, closeCalls: 0, laptopSeconds: 0, oppCaught: 0, maxStreak: 0 };
    this.achievements = new Set();
    this.quiz = null; this.caughtSeq = null; this.list = null; this.neighbor = { warnT: 0, glanceT: 6, betrayT: 30, chatT: 70 };
    this.tutor = { active: false, t: 0 };
    this.visT = 0; this.lastVis = { vis: 0, fovea: 0, cone: 0, los: 0, angle: 3 };
    this.externalBusy = () => false;
    this.hintsShown = new Set();
  }
  // ------------------------------------------------------------------ Spieler-Schnittstelle
  _placePlayer() {
    const s = LY.allSeats().find(x => x.row === this.seat.row && x.k === this.seat.k);
    this.seatInfo = s;
    this.player.headBase = V(s.x, s.floor + 1.2, s.z - 0.04);
    this.player.head.copy(this.player.headBase);
  }
  setMode(m) {
    const p = this.player;
    if (this.state === 'ended') return;
    if (p.forcedT > 0 && m === 'laptop') return;
    if (this.quiz && m === 'laptop') return;
    if (m === p.mode) return;
    // Hektisches Umschalten im Blick des Profs fällt auf
    if (m === 'listen' && p.mode === 'laptop') this.susp.spike('jerk', this.lastVis.vis * (p.blend > 0.5 ? 1 : 0.5));
    p.mode = m;
    this.emit('mode', m);
  }
  /** Kopfdrehung der Kamera (rad) – Bewegung wird zu "Unruhe" */
  setHead(yaw, pitch, dt) {
    const p = this.player;
    if (dt > 0) { const v = Math.hypot(yaw - p.lastYaw, pitch - p.lastPitch) / dt; p.motion = Math.max(p.motion * Math.exp(-dt * 4), clamp((v - 0.6) / 4, 0, 1)); }
    p.lastYaw = yaw; p.lastPitch = pitch; p.headYaw = yaw; p.headPitch = pitch;
  }
  laptop(o) { Object.assign(this.player, o); }
  handActivity(a = 0.4) { this.player.hands = Math.min(1, this.player.hands + a); }
  notifyRaised(muted) { if (!muted && !this.player.headphones) { this.susp.spike('notify', this.lastVis.cone); this.player.tellNotify = 1; } else this.susp.spike('flicker', this.lastVis.vis * 0.5); }
  appSwitched() { this.susp.spike('switch', this.lastVis.fovea); }
  canPlay() { return this.state === 'playing' && this.player.mode === 'laptop' && this.player.blend > 0.6 && this.player.app === 'ttt' && this.player.forcedT <= 0; }
  tttPlay(i) {
    if (!this.canPlay() || !this.ttt.canPlay(i)) return false;
    const ok = this.ttt.play(i, 'X');
    if (ok) { this.handActivity(0.5); if (this.prof.activity === 'write') this.stats.chalkMoves++; this.emit('tttMove', { who: 'X', i }); }
    return ok;
  }
  nextRound() { if (this.ttt.over && this.state === 'playing') { this.ttt.newRound(); this.emit('tttRound', {}); } }
  answerQuiz(idx) { if (!this.quiz || this.quiz.answered) return; this._finishQuiz(idx === this.quiz.correctIndex ? 'right' : 'wrong', idx); }
  peekNotes() { // Blick in die Mitschrift: 4 s Zeitstrafe, eine falsche Antwort fällt weg
    const q = this.quiz; if (!q || q.peeked) return null;
    const n = this.player.notes[q.section] || 0; if (n < 0.25) return null;
    q.peeked = true; q.time = Math.max(2, q.time - 4);
    const wrong = q.answers.map((_, i) => i).filter(i => i !== q.correctIndex);
    q.removed = wrong[Math.floor(this.rng.next() * wrong.length)];
    return q.removed;
  }
  signList() { const L = this.list; if (!L || L.holder !== 'player' || L.signed) return false; L.signing = 2.6; return true; }
  // ------------------------------------------------------------------ Director-Ausgaben
  _directorOut(type, d) {
    if (type === 'quiz') this._startQuiz(d);
    if (type === 'fx') this._fx(d);
    if (type === 'end') this._finish('time');
    if (type === 'phase') this.emit('phase', d);
    if (type === 'section') { this.player.notes[d.id] = this.player.notes[d.id] || 0; }
    if (type === 'say' && d.kind === 'lecture') this._lastLecture = this.t;
    this.emit(type, d);
  }
  _fx(d) {
    switch (d.kind) {
      case 'attendanceStart': this._startList(); break;
      case 'attendanceCollect': if (this.list) this.list.done = true; break;
      case 'breakStart': this.breakActive = true; break;
      case 'breakEnd': this.breakActive = false; break;
      case 'phoneVibratePlayer': this.susp.spike('notify', this.lastVis.cone * 0.6); break;
      case 'tutorPass': this.tutor.active = true; this.tutor.t = 0; break;
    }
  }
  _chat(key) { const text = this.director.pick(key); this.emit('chat', { from: 'opp', text }); }
  _tttEvent(type, d) {
    if (type === 'over') {
      this.opp.onRoundOver(d.winner);
      if (d.winner === 'X') { this.stats.maxStreak = Math.max(this.stats.maxStreak, this.ttt.stats.streak); if (this.breakActive) this.stats.breakWins++; }
      this.emit('tttOver', d);
    }
    if (type === 'move' && d.who === 'O') this.emit('tttMove', d);
  }
  _opponentCaught() {
    this.stats.oppCaught++;
    const row = this.opp.where ? this.opp.where.row : 1;
    this.director.interject([{ type: 'say', key: 'opponent_caught', vars: { row }, look: 'student', kind: 'alert' }]);
    this.prof.lookAt(this.opp.head, 4, 'student');
    this.emit('opponentCaught', {});
    this._chatDelayed = { t: 6, key: 'chat_opponent_caught' };
  }
  // ------------------------------------------------------------------ Hauptschritt
  step(dt) {
    if (this.state === 'ended') return;
    this.t += dt;
    const p = this.player;
    // Übergang Laptop ↔ Zuhören
    const want = p.mode === 'laptop' ? 1 : 0;
    p.blend = clamp(p.blend + Math.sign(want - p.blend) * dt / 0.32, 0, 1);
    if (p.forcedT > 0) { p.forcedT -= dt; if (p.mode === 'laptop') p.mode = 'listen'; }
    p.hands = Math.max(0, p.hands - dt * 0.9);
    p.tellNotify = Math.max(0, p.tellNotify - dt);
    if (p.mode === 'laptop' && p.app === 'ttt') { p.laptopTime += dt; this.stats.laptopSeconds += dt; }
    // Kopfposition (beim Laptop nach vorne gebeugt)
    const b = p.blend, notes = p.mode === 'notes' ? 1 : 0;
    p.head.set(p.headBase.x, p.headBase.y - 0.14 * b - 0.1 * notes, p.headBase.z - 0.13 * b - 0.08 * notes);
    // Prof
    this.prof.player = { head: p.head, motion: p.motion, suspicionPull: this.susp.suspicion > 45 ? 0.1 + this.susp.suspicion / 500 : 0, stick: clamp(this.susp.attention / 130 + this.susp.suspicion / 220, 0, 0.85) };
    this.prof.update(dt);
    this.director.update(dt);
    for (const ev of this.prof.drainEvents()) this.emit('prof:' + ev.type, ev.data);
    // Sicht (15 Hz)
    this.visT -= dt;
    if (this.visT <= 0) {
      this.visT = 1 / 15;
      const eye = this.prof.eye(V()), gaze = this.prof.gazeDir(V());
      const hd = p.head;
      const pts = [{ p: hd.clone(), w: 1 }, { p: V(hd.x, hd.y - 0.3, hd.z + 0.05), w: 0.6 }, { p: V(hd.x, this.seatInfo.floor + LY.DESK_H + 0.12, this.seatInfo.deskZ), w: 0.5 }];
      this.lastVis = this.vision.assess(eye, gaze, pts, null);
    }
    // Spieler-Signale
    const lidF = smoothstep(80, 120, p.lid);
    const glow = p.blend * p.brightness * (0.25 + p.luma * 0.75) * lidF;
    const lookAway = p.mode === 'listen' ? clamp((Math.abs(p.headYaw) - 0.75) / 0.6, 0, 1) : 0;
    const studying = p.mode === 'laptop' && p.app === 'live' ? b : 0; // Folien am Laptop mitlesen
    const signals = { laptop: b, notes, lookAway, motion: p.motion, glow, hands: Math.min(1, p.hands + p.tellNotify * 0.5), gameVisible: p.app === 'ttt' || p.app === 'snake', studying };
    const mods = { mul: this.diff.mul, tolerance: this.prof.tolerance, focus: this.prof.focusPlayer > 0 };
    if (this.state === 'playing' && !this.caughtSeq) {
      const caught = this.susp.update(dt, this.lastVis, signals, mods);
      if (caught) this._caught();
      this._reactions(dt);
    }
    // Folien mitlesen zählt halb so viel wie Mitschreiben (Hilfe bei Prüfungsfragen)
    if (signals.studying > 0.6 && this.director.currentSection && this.prof.talking) {
      const id = this.director.currentSection.sec.id; p.notes[id] = clamp((p.notes[id] || 0) + dt / 80, 0, 1);
    }
    // Notizen
    if (p.mode === 'notes' && this.director.currentSection && this.prof.talking) {
      const id = this.director.currentSection.sec.id;
      p.notes[id] = clamp((p.notes[id] || 0) + dt / 40, 0, 1);
      this.emit('notesProgress', { id, value: p.notes[id] });
    }
    if (p.mode === 'listen' || p.mode === 'notes') p.listenTime += dt;
    // Tic Tac Toe / Gegner
    this.ttt.tick(dt, p.mode === 'laptop' && p.app === 'ttt');
    if (this.state === 'playing') this.opp.update(dt);
    if (this._chatDelayed) { this._chatDelayed.t -= dt; if (this._chatDelayed.t <= 0) { this._chat(this._chatDelayed.key); this._chatDelayed = null; } }
    this._updateNeighbor(dt); this._updateTutor(dt); this._updateList(dt);
    this._updateQuiz(dt); this._updateCaught(dt);
    this._hints();
  }
  // ------------------------------------------------------------------ Reaktionen des Profs auf Verdacht
  _reactions(dt) {
    const s = this.susp; this._hmT = (this._hmT || 0) - dt;
    if (s.suspicion > 55 && this._hmT <= 0 && this.lastVis.cone > 0.4) {
      this._hmT = 35 + this.rng.next() * 20;
      if (s.suspicion > 75) { this.director.interject([{ type: 'say', key: 'attention_lock', kind: 'alert', vars: { row: this.seat.row + 1 } }]); this.prof.lookPlayer(3.2); }
      else { this.prof.lookPlayer(1.8); this.emit('say', { text: this.director.pick('attention_hm', { row: this.seat.row + 1 }), dur: 1.2, speaker: 'prof', kind: 'alert' }); }
    }
  }
  _caught() {
    const st = this.stats; st.strikes++;
    const strike = st.strikes;
    let key = strike === 1 ? 'caught_1' : strike === 2 ? 'caught_2' : null;
    let move = false;
    if (strike >= 3) {
      const fleiss = this.fleiss();
      if (!st.movedFront && (fleiss >= 0.45 || st.quizRight >= 2)) { key = 'caught_3_move'; move = true; }
      else key = 'caught_3_kick';
    }
    this.ttt.abort();
    this.player.forcedT = 6; this.player.mode = 'listen';
    this.prof.lookPlayer(5); this.prof.setFace('class');
    if (strike === 2) this.prof.focusPlayer = 90;
    const text = this.director.pick(key, { row: this.seat.row + 1 });
    const dur = this.director._say(text, { speaker: 'prof', kind: 'alert', key });
    this.caughtSeq = { t: 0, dur: Math.max(4.5, dur + 1), move, kick: key === 'caught_3_kick', strike };
    this.director.paused = true;
    this.director.noteCaught(this.seat.row + 1);
    this.emit('caught', { strike, move, kick: this.caughtSeq.kick, text });
    this._chatDelayed = { t: 8, key: 'chat_you_caught' };
  }
  _updateCaught(dt) {
    const c = this.caughtSeq; if (!c) return;
    c.t += dt;
    if (c.t < c.dur || this.externalBusy()) return;
    this.caughtSeq = null; this.director.paused = false; this.susp.reset();
    if (c.kick) { this._finish('kicked'); return; }
    if (c.move) {
      this.stats.movedFront = true; this.stats.strikes = 2;
      // freier Platz in der ersten Reihe, möglichst nah an der bisherigen Spalte
      const free = this.pop.emptySeats.filter(s => s.row === 0).sort((a, b) => Math.abs(a.k - this.seat.k) - Math.abs(b.k - this.seat.k));
      const k = free.length ? free[0].k : Math.min(LY.SEATS - 2, Math.max(1, this.seat.k));
      this.seat = { row: 0, k }; this._placePlayer();
      this.emit('moveSeat', { seat: this.seat });
    }
    this.ttt.newRound(); this.emit('tttRound', {});
  }
  // ------------------------------------------------------------------ Quiz
  _startQuiz(d) {
    const p = this.player;
    this.stats.quizAsked++;
    const startled = p.blend > 0.4;
    if (startled) { this.susp.attention = clamp(this.susp.attention + 35, 0, 100); this.susp.suspicion = clamp(this.susp.suspicion + 18, 0, 100); }
    p.mode = 'listen';
    // hinten versteht man schlechter → etwas weniger Zeit
    const tl = Math.max(8, d.timeLimit - (this.seat.row >= 7 ? 2 : 0));
    this.quiz = { ...d, timeLimit: tl, time: tl, total: tl, startled, answered: false };
    this.emit('quizOpen', this.quiz);
  }
  _updateQuiz(dt) {
    const q = this.quiz; if (!q || q.answered) return;
    if (this.externalBusy() && q.time === q.total) return; // erst ablaufen lassen, wenn die Frage gesprochen ist
    q.time -= dt;
    if (q.time <= 0) this._finishQuiz('timeout', -1);
  }
  _finishQuiz(result, idx) {
    const q = this.quiz; q.answered = true; q.result = result; q.choice = idx;
    if (result === 'right') { this.stats.quizRight++; this.susp.relieve(25); this.prof.tolerance++; }
    else { this.stats.quizWrong++; this.prof.focusPlayer = Math.max(this.prof.focusPlayer, 60); this.susp.suspicion = clamp(this.susp.suspicion + 12, 0, 100); }
    this.director.answerQuiz(result);
    this.emit('quizResult', { result, correctIndex: q.correctIndex, choice: idx });
    this.quiz = null;
  }
  // ------------------------------------------------------------------ Nachbarin
  _updateNeighbor(dt) {
    const n = this.neighbor, p = this.player, mode = this.diff.neighbor;
    n.warnT -= dt; n.glanceT -= dt; n.betrayT -= dt; n.chatT -= dt;
    if (n.glanceT <= 0) { n.glanceT = this.rng.range(8, 20); this.emit('neighborGlance', { atScreen: p.blend > 0.5 }); }
    if (p.blend < 0.5 || this.state !== 'playing') return;
    // Warnung kurz bevor/als der Blick des Profs auf dich zukommt
    const cone = this.lastVis.cone, rising = cone > (n.lastCone || 0) + 0.02;
    n.lastCone = cone;
    if (mode !== 'betrayer' && n.warnT <= 0 && cone > 0.3 && rising && this.rng.chance(mode === 'helpful' ? 0.45 : 0.18)) {
      n.warnT = 22; this.stats.warnings++;
      this.emit('say', { text: this.director.pick('neighbor_warn'), dur: 1.1, speaker: 'neighbor', kind: 'whisper' });
      this.emit('neighborWarn', {});
    }
    if (mode === 'betrayer' && n.betrayT <= 0 && this.prof.lookingAtClass() && p.laptopTime > 40 && this.rng.chance(dt * 0.15)) {
      n.betrayT = 70;
      this.emit('say', { text: this.director.pick('neighbor_betray'), dur: 1.6, speaker: 'neighbor', kind: 'whisper' });
      this.susp.attention = clamp(this.susp.attention + 30, 0, 100); this.prof.lookPlayer(1.6);
    }
    if (mode !== 'betrayer' && n.chatT <= 0 && this.rng.chance(dt * 0.03)) { n.chatT = 90; this.emit('say', { text: this.director.pick('neighbor_smalltalk'), dur: 1.4, speaker: 'neighbor', kind: 'whisper' }); this.susp.spike('jerk', this.lastVis.vis * 0.4); }
  }
  // ------------------------------------------------------------------ Tutorin (zweite, schwächere Blickquelle)
  _updateTutor(dt) {
    const tu = this.tutor; if (!tu.active) return;
    tu.t += dt;
    // geht hinten entlang und den rechten Gang herunter; nahe am Spieler sieht sie den Bildschirm direkt
    const pos = tutorPathAt(tu.t);
    this.emit('tutorPos', { pos, t: tu.t });
    const d = Math.hypot(pos.x - this.player.head.x, pos.z - this.player.head.z);
    if (d < 2.2 && this.player.blend > 0.5 && this.player.app === 'ttt' && !tu.saw) {
      tu.saw = true; this.susp.suspicion = clamp(this.susp.suspicion + 7, 0, 100);
      this.emit('say', { text: this.director.pick('tutor_pass'), dur: 1.3, speaker: 'tutor', kind: 'whisper' });
    }
    if (tu.t > TUTOR_PATH_DUR) { tu.active = false; tu.saw = false; this.emit('tutorDone', {}); }
  }
  // ------------------------------------------------------------------ Exkursionsliste (geht durch die Reihen)
  _startList() {
    const order = this.pop.students.slice().filter(s => s.seat.row < this.seat.row || (s.seat.row === this.seat.row && s.seat.k < this.seat.k)).sort((a, b) => a.seat.row - b.seat.row || (a.seat.row % 2 ? b.seat.k - a.seat.k : a.seat.k - b.seat.k));
    this.list = { order, i: 0, holderT: 0, holder: order.length ? order[0].id : 'player', signed: false, signing: 0, done: false, wait: 0 };
    this.emit('listMove', { holder: this.list.holder });
  }
  _updateList(dt) {
    const L = this.list; if (!L || L.done) return;
    if (L.holder === 'player') {
      L.wait += dt;
      if (L.signing > 0) { L.signing -= dt; this.player.mode === 'laptop' && (this.player.mode = 'listen'); if (L.signing <= 0) { L.signed = true; this.stats.signed = true; this.emit('listSigned', {}); L.holder = 'after'; L.holderT = 0; this.emit('listMove', { holder: 'after' }); } return; }
      if (L.wait > 28) { L.holder = 'after'; this.emit('listMove', { holder: 'after', missed: true }); }
      return;
    }
    if (L.holder === 'after') { L.holderT += dt; if (L.holderT > 30) { L.done = true; } return; }
    L.holderT += dt;
    if (L.holderT > 3.5 + this.rng.next() * 3) {
      L.holderT = 0; L.i++;
      const next = L.order[L.i];
      if (!next || (next.id === this.pop.neighbor.id)) {
        L.holder = 'player'; L.wait = 0;
        this.emit('say', { text: this.director.pick('attendance_neighbor'), dur: 1.3, speaker: 'neighbor', kind: 'whisper' });
        this.emit('listMove', { holder: 'player' });
      } else { L.holder = next.id; this.emit('listMove', { holder: next.id }); }
    }
  }
  // ------------------------------------------------------------------ Hinweise (Tutorial)
  _hints() {
    const H = (id, cond) => { if (!this.hintsShown.has(id) && cond) { this.hintsShown.add(id); this.emit('hint', { id }); } };
    const ph = this.director.phase;
    H('welcome', this.t > 1.5);
    H('laptop', this.t > 6 && ph === 'arrival');
    H('play', this.player.blend > 0.9 && this.t > 8);
    H('chalk', this.prof.activity === 'write' && this.t > 20);
    H('suspicion', this.susp.attention > 40);
    H('notes', ph === 'part1' && this.t > 60);
    H('zoom', ph === 'part1' && this.t > 95 && this.player.mode === 'listen');
    H('live', this.player.blend > 0.9 && this.t > 150 && this.player.app !== 'live');
    H('lid', this.player.laptopTime > 45);
    H('alttab', this.susp.suspicion > 30 && this.player.blend > 0.5);
    H('list', this.list && this.list.holder === 'player');
  }
  // ------------------------------------------------------------------ Ende, Punkte, Note, Erfolge
  fleiss() {
    const pres = this.director.presented.map(p => p.id);
    if (!pres.length) return 0;
    return pres.reduce((a, id) => a + (this.player.notes[id] || 0), 0) / pres.length;
  }
  success() {
    const g = this.ttt, m = this.ttt.mode.id;
    if (m === 'bo5') return g.series.done && g.series.winner === 'you';
    if (m === 'blitz') return g.stats.wins >= Math.max(1, this.target - 1);
    return g.stats.wins >= this.target;
  }
  _finish(reason) {
    if (this.state === 'ended') return;
    this.state = 'ended'; this.endReason = reason;
    this.result = this.computeResult();
    this.emit('end', this.result);
  }
  computeResult() {
    const st = this.stats, g = this.ttt.stats, mul = seatMultiplier(this.seat.row);
    const fleiss = this.fleiss();
    st.closeCalls = this.susp.closeCalls;
    const parts = {
      wins: Math.round(g.wins * 100 * mul), draws: g.draws * 30, quiz: st.quizRight * 60, fleiss: Math.round(fleiss * 120),
      excursion: st.signed ? 20 : 0, risk: st.closeCalls * 15, strikes: -st.strikes * 60, snake: Math.min(50, st.snake * 2)
    };
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    const success = this.success();
    const honest = this.stats.laptopSeconds < 3;
    let grade;
    if (this.endReason === 'kicked') grade = 5;
    else if (honest && fleiss >= 0.6 && st.quizWrong === 0) grade = 1;
    else if (success) grade = 3 - (st.strikes <= 1 ? 1 : 0) - (fleiss >= 0.45 || st.quizRight >= 2 ? 1 : 0);
    else grade = g.wins >= this.target - 1 ? 4 : 5;
    grade = clamp(grade, 1, 5);
    // Erfolge
    const A = this.achievements;
    if (st.quizAsked >= 2 && st.quizWrong === 0 && st.quizRight === st.quizAsked) A.add('pansenProfi');
    if (this.susp.cleanTime >= this.seconds * 0.66 && g.rounds >= 3) A.add('invisible');
    if (honest && this.endReason !== 'kicked') A.add('honest');
    if (st.maxStreak >= 3) A.add('streak3');
    if (this.susp.peakEvidence > 90 && st.strikes === 0) A.add('closeCall');
    if (st.movedFront && success && this.endReason !== 'kicked') A.add('frontRow');
    if (fleiss >= 0.8) A.add('scribe');
    if (st.chalkMoves >= 6) A.add('chalkTime');
    if (st.breakWins >= 2) A.add('breakKing');
    if (st.snake >= 20) A.add('snake20');
    if (st.warnings >= 3) A.add('accomplice');
    if (this.ttt.mode.id === 'blitz' && success) A.add('blitzWin');
    if (this.seconds >= 5400 && success) A.add('hardcore');
    if (st.signed) A.add('excursion');
    return {
      reason: this.endReason, success, grade, total, parts, fleiss, mul,
      wins: g.wins, losses: g.losses, draws: g.draws, rounds: g.rounds, series: this.ttt.series,
      quizRight: st.quizRight, quizAsked: st.quizAsked, strikes: st.strikes, closeCalls: st.closeCalls,
      achievements: [...A], seconds: this.t, laptopSeconds: Math.round(st.laptopSeconds), difficulty: this.diff.id, mode: this.ttt.mode.id
    };
  }
}

// Weg der Tutorin: hinterer Gang → rechter Stufengang hinunter → vorne raus
const TUTOR_PTS = [[3.75, 5.6], [3.8, 4.6], [3.85, 2.0], [3.85, -0.5], [3.85, -2.6], [3.2, -3.4], [4.1, -5.0]];
const TUTOR_SPEED = 0.8;
const tutorSegs = (() => { let acc = 0; return TUTOR_PTS.slice(1).map((p, i) => { const a = TUTOR_PTS[i]; const l = Math.hypot(p[0] - a[0], p[1] - a[1]); const s = { a, b: p, l, t0: acc / TUTOR_SPEED }; acc += l; return s; }); })();
export const TUTOR_PATH_DUR = tutorSegs.reduce((a, s) => a + s.l, 0) / TUTOR_SPEED + 4;
export function tutorPathAt(t) {
  const tt = Math.max(0, t - 2) * TUTOR_SPEED;
  let acc = 0;
  for (const s of tutorSegs) { if (tt <= acc + s.l) { const k = (tt - acc) / s.l; const x = s.a[0] + (s.b[0] - s.a[0]) * k, z = s.a[1] + (s.b[1] - s.a[1]) * k; return { x, y: LY.floorAt(x, z), z, yaw: Math.atan2(s.b[0] - s.a[0], s.b[1] - s.a[1]) }; } acc += s.l; }
  const last = TUTOR_PTS[TUTOR_PTS.length - 1]; return { x: last[0], y: LY.floorAt(last[0], last[1]), z: last[1], yaw: Math.PI / 2 };
}
