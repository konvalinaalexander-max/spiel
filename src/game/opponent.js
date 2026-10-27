// Tic-Tac-Toe-Gegner: entweder ein:e sichtbare:r Mitstudierende:r im Saal (zieht nur, wenn der Prof
// nicht zu ihr/ihm schaut, kann selbst erwischt werden, chattet) oder eine Online-KI mit drei Stärken.
import * as THREE from 'three';
import { chooseMove } from './tictactoe.js';
import { clamp } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Opponent {
  /**
   * o: { mode: 'hall'|'online', skill (0–1), name, where, student (Plan-Eintrag oder null), ttt, rng, prof, vision, chat(key) }
   */
  constructor(o) {
    Object.assign(this, o);
    this.think = 0; this.typing = false; this.waiting = false; this.waitT = 0;
    this.pausedT = 0; this.chatT = o.rng.range(25, 60); this.lastWaitMsg = -99;
    this.exposure = 0; this.nerve = o.mode === 'hall' ? o.rng.range(0.25, 0.45) : 1;
    this.caughtCount = 0; this.t = 0;
    this.head = o.student ? V(o.student.seat.x, o.student.seat.floor + 1.22, o.student.seat.z) : null;
  }
  /** wie sehr schaut der Prof gerade zur/zum Gegner:in (0–1, ohne Verdeckung) */
  _exposure() {
    if (!this.head) return 0;
    const e = this.prof.eye(V()), g = this.prof.gazeDir(V());
    const d = V().subVectors(this.head, e).normalize();
    const ang = Math.acos(clamp(d.dot(g), -1, 1));
    return this.vision.coneWeight(ang);
  }
  update(dt, ctx = {}) {
    this.t += dt;
    const g = this.ttt;
    this.exposure = this.mode === 'hall' ? this._exposure() : 0;
    if (this.pausedT > 0) { this.pausedT -= dt; this.typing = false; return; }
    // Smalltalk im Chat
    this.chatT -= dt;
    if (this.chatT <= 0) { this.chatT = this.rng.range(45, 110); if (this.rng.chance(0.55)) this.chat('chat_opponent_idle'); }
    if (g.over || g.turn !== g.opp) { this.typing = false; this.think = 0; this.waiting = false; return; }
    if (this.think <= 0 && !this.waiting) this.think = this.rng.range(1.2, 3.4) * (this.mode === 'online' ? 0.6 : 1) + (g.board.filter(Boolean).length < 2 ? 0.6 : 0);
    // Saal-Gegner: wartet, wenn der Prof in seine Richtung schaut
    if (this.mode === 'hall' && this.exposure > this.nerve) {
      if (!this.waiting) { this.waiting = true; this.waitT = 0; if (this.t - this.lastWaitMsg > 40 && this.rng.chance(0.5)) { this.lastWaitMsg = this.t; this.chat('chat_opponent_wait'); } }
      this.waitT += dt; this.typing = false;
      return;
    }
    if (this.waiting && this.mode === 'hall') { this.waiting = false; this.think = Math.max(this.think, this.rng.range(0.6, 1.4)); }
    this.typing = this.think < 1.2;
    this.think -= dt;
    if (this.think <= 0) {
      // Risiko: zieht trotz Blick (selten) → kann selbst erwischt werden
      if (this.mode === 'hall' && this.exposure > 0.85 && this.rng.chance(0.25)) { this.gotCaught(); return; }
      const i = chooseMove(g.board.slice(), g.opp, this.skill, () => this.rng.next());
      if (i >= 0) { g.play(i, g.opp); if (!g.over && this.rng.chance(0.22)) this.chat('chat_opponent_move'); }
      this.think = 0; this.typing = false;
    }
  }
  gotCaught() {
    this.caughtCount++; this.pausedT = 50 + this.rng.range(0, 30); this.typing = false;
    this.onCaught && this.onCaught();
  }
  onRoundOver(winner) {
    const k = winner === this.ttt.opp ? 'chat_opponent_win' : winner === this.ttt.player ? 'chat_opponent_lose' : winner === 'draw' ? 'chat_opponent_draw' : null;
    if (k && this.rng.chance(0.75)) this.chat(k);
  }
}
