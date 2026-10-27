// Test-Bot: spielt wie ein Mensch – nur mit beobachtbaren Hinweisen (Haltung/Blick des Profs, Kreide stoppt,
// Warnung der Nachbarin) und menschlicher Reaktionszeit. Für automatisierte Balancing-Läufe.
import { chooseMove } from './tictactoe.js';
import { makeRng, clamp } from '../core/util.js';

export class Bot {
  /** skill: 0–1 (Reaktionsschnelle, Vorsicht, Spielstärke) */
  constructor(session, skill = 0.5, seed = 1) {
    this.s = session; this.skill = skill; this.rng = makeRng(seed);
    this.react = 0.55 - skill * 0.3;       // mittlere Reaktionszeit in s
    this.greed = 0.55 + (1 - skill) * 0.25; // Risikobereitschaft
    this.pending = null; this.cooldown = 0; this.moveT = 0; this.notesT = 0;
    this.lastShoulder = -9; this.lastWarn = -9;
    this.heard = { chalkStop: -9 };
    this.listenSec = {}; // Zuhörzeit je Abschnitt (für Quizwissen)
  }
  onEvent(type) {
    const t = this.s.t;
    if (type === 'prof:chalkStop' && !this.s.player.headphones) this.heard.chalkStop = t;
    if (type === 'neighborWarn') this.lastWarn = t;
  }
  /** Gefahr aus Sicht eines Menschen (kein Zugriff auf versteckte Werte wie Verdacht/Beweis) */
  danger() {
    const s = this.s, pr = s.prof;
    // grob sichtbar, aber verrauscht und verzögert: schaut er in meine Richtung?
    this.coneHist = this.coneHist || [];
    this.coneHist.push(s.lastVis.cone); if (this.coneHist.length > 5) this.coneHist.shift();
    const cone = clamp(this.coneHist[0] + (this.rng.next() - 0.5) * 0.3, 0, 1);
    const facing = pr.lookingAtClass();
    const writing = pr.activity === 'write' && pr.shoulder.phase === 0;
    const lectern = pr.face.mode === 'lectern' && !pr.glancing;
    let d = 0;
    if (facing) d = Math.max(d, 0.35 + cone * 0.65);
    if (writing || lectern) d *= 0.25;
    if (s.t - this.heard.chalkStop < 1.2) d = Math.max(d, 0.6);
    if (s.t - this.lastWarn < 1.5) d = 1;
    if (s.quiz) d = 1;
    return d;
  }
  update(dt) {
    const s = this.s, p = s.player;
    if (s.state === 'ended') return;
    // Quiz beantworten (Wissen ~ Zuhören)
    if (s.quiz && !s.quiz.answered && !this.quizT) this.quizT = this.rng.range(3, 8);
    if (s.quiz && this.quizT) {
      this.quizT -= dt;
      if (this.quizT <= 0) {
        this.quizT = 0;
        const sec = s.quiz.section, heard = clamp((this.listenSec[sec] || 0) / 35, 0, 1);
        const pRight = 0.33 + 0.5 * heard + (p.notes[sec] || 0) * 0.15;
        s.answerQuiz(this.rng.chance(pRight) ? s.quiz.correctIndex : (s.quiz.correctIndex + 1 + this.rng.int(0, 2)) % s.quiz.answers.length);
      }
      return;
    }
    if (p.mode !== 'laptop' && s.director.currentSection) { const id = s.director.currentSection.sec.id; this.listenSec[id] = (this.listenSec[id] || 0) + dt; }
    // Liste unterschreiben
    if (s.list && s.list.holder === 'player' && !s.list.signed && !s.list.signing) { if (p.mode === 'laptop') s.setMode('listen'); if (this.rng.chance(dt * 0.8)) s.signList(); return; }
    // ausstehende Reaktion ausführen
    if (this.pending) { this.pending.t -= dt; if (this.pending.t <= 0) { s.setMode(this.pending.mode); this.pending = null; this.cooldown = this.rng.range(0.8, 2.5); } return; }
    this.cooldown -= dt;
    const d = this.danger();
    const want = s.ttt.over ? 'next' : s.ttt.turn === 'X' ? 'move' : 'wait';
    s.setHead(Math.sin(s.t * 0.3) * 0.15, -0.1, dt);
    if (p.mode === 'laptop') {
      // Gefahr erkannt → zurück (mit Reaktionszeit; manchmal übersehen)
      const notice = p.blend > 0.5 ? 0.75 + this.skill * 0.2 : 1;
      if (d > 0.5 && this.rng.chance(notice * Math.min(1, dt * 12))) { this.pending = { mode: 'listen', t: Math.max(0.12, this.react + this.rng.gauss() * 0.1) }; return; }
      if (want === 'wait' && this.rng.chance(dt * 0.25 * (1 - this.greed))) { this.pending = { mode: 'listen', t: 0.3 }; return; }
      if (want === 'next') { if (this.rng.chance(dt * 0.6)) s.nextRound(); return; }
      if (want === 'move' && p.blend > 0.7) {
        this.moveT += dt;
        if (this.moveT > 0.6 + this.rng.next() * 1.5) {
          this.moveT = 0;
          const i = chooseMove(s.ttt.board.slice(), 'X', 0.45 + this.skill * 0.4, () => this.rng.next());
          s.tttPlay(i);
        }
      }
    } else {
      // Notizen machen, wenn gerade nichts zu tun ist
      if (p.mode === 'listen' && want === 'wait' && this.rng.chance(dt * 0.05)) s.setMode('notes');
      if (p.mode === 'notes' && this.rng.chance(dt * 0.12)) s.setMode('listen');
      if (this.cooldown > 0) return;
      const safe = d < 0.25 + this.greed * 0.25;
      if (safe && (want === 'move' || want === 'next') && this.rng.chance(dt * (1.5 + this.skill))) this.pending = { mode: 'laptop', t: Math.max(0.15, this.react * 0.8 + this.rng.gauss() * 0.1) };
    }
  }
}
