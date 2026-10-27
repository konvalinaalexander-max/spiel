// Tic Tac Toe: Regeln, Minimax mit Fehlerquote, Serien-/Blitz-/Turnier-Modi. Rein logisch (testbar in Node).

export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function result(b) {
  for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { winner: b[l[0]], line: l };
  return b.every(Boolean) ? { winner: 'draw', line: null } : null;
}
/** Minimax mit Tiefenbewertung; me = Spieler am Zug, gibt Wert aus Sicht von `me` zurück */
export function minimax(b, toMove, me, depth = 0) {
  const r = result(b);
  if (r) return r.winner === 'draw' ? 0 : r.winner === me ? 10 - depth : depth - 10;
  const other = toMove === 'X' ? 'O' : 'X';
  let best = toMove === me ? -99 : 99;
  for (let i = 0; i < 9; i++) if (!b[i]) {
    b[i] = toMove; const v = minimax(b, other, me, depth + 1); b[i] = null;
    best = toMove === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}
export function bestMoves(b, me) {
  const other = me === 'X' ? 'O' : 'X';
  let best = -99, list = [];
  for (let i = 0; i < 9; i++) if (!b[i]) {
    b[i] = me; const v = minimax(b, other, me, 1); b[i] = null;
    if (v > best) { best = v; list = [i]; } else if (v === best) list.push(i);
  }
  return { moves: list, value: best };
}
/**
 * Zug wählen. skill 0–1: Wahrscheinlichkeit für einen perfekten Zug; sonst "menschlicher" Fehler
 * (offensichtliche Gewinne/Blocks werden meist trotzdem gesehen).
 */
export function chooseMove(b, me, skill, rnd = Math.random) {
  const empty = b.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return -1;
  const other = me === 'X' ? 'O' : 'X';
  const winNow = empty.find(i => { b[i] = me; const w = result(b); b[i] = null; return w && w.winner === me; });
  const blockNow = empty.find(i => { b[i] = other; const w = result(b); b[i] = null; return w && w.winner === other; });
  if (rnd() < skill) { const { moves } = bestMoves(b, me); return moves[Math.floor(rnd() * moves.length)]; }
  if (winNow !== undefined && rnd() < 0.85) return winNow;
  if (blockNow !== undefined && rnd() < 0.6) return blockNow;
  // Lieblingsfelder: Mitte, Ecken
  const pref = empty.filter(i => i === 4 || [0, 2, 6, 8].includes(i));
  const pool = pref.length && rnd() < 0.6 ? pref : empty;
  return pool[Math.floor(rnd() * pool.length)];
}

export const MODES = {
  tournament: { id: 'tournament', bestOf: 0, blitz: 0 },
  bo5: { id: 'bo5', bestOf: 5, blitz: 0 },
  blitz: { id: 'blitz', bestOf: 0, blitz: 6 } // Sekunden pro Zug
};

export class TicTacToe {
  constructor(opts = {}) {
    this.mode = MODES[opts.mode || 'tournament'];
    this.player = 'X'; this.opp = 'O';
    this.stats = { wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, rounds: 0, blitzWins: 0 };
    this.series = { you: 0, opp: 0, done: false, winner: null };
    this.round = 0;
    this.onEvent = opts.onEvent || (() => {});
    this.newRound(true);
  }
  newRound(first = false) {
    this.board = Array(9).fill(null);
    this.round++;
    // abwechselnd beginnen
    this.turn = this.round % 2 === 1 ? this.player : this.opp;
    this.over = null; this.lastMove = -1;
    this.moveTimer = this.mode.blitz;
    if (!first) this.onEvent('round', { round: this.round, turn: this.turn });
  }
  canPlay(i) { return !this.over && this.turn === this.player && i >= 0 && i < 9 && !this.board[i]; }
  play(i, who) {
    if (this.over || this.turn !== who || this.board[i]) return false;
    this.board[i] = who; this.lastMove = i;
    const r = result(this.board);
    if (r) this._finish(r);
    else { this.turn = who === 'X' ? 'O' : 'X'; this.moveTimer = this.mode.blitz; }
    this.onEvent('move', { who, i });
    return true;
  }
  /** Blitz: Zugzeit läuft nur, wenn `ticking` (Spieler schaut auf den Laptop) */
  tick(dt, playerTicking) {
    if (!this.mode.blitz || this.over) return;
    if (this.turn === this.player && !playerTicking) return;
    this.moveTimer -= dt;
    if (this.moveTimer <= 0) {
      // Zeit abgelaufen → zufälliger Zug für den, der dran ist
      const empty = this.board.map((v, k) => (v ? -1 : k)).filter(k => k >= 0);
      this.play(empty[Math.floor(Math.random() * empty.length)], this.turn);
      this.onEvent('timeout', { who: this.turn });
    }
  }
  _finish(r) {
    this.over = r; this.stats.rounds++;
    const s = this.stats;
    if (r.winner === this.player) { s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); this.series.you++; if (this.mode.blitz) s.blitzWins++; }
    else if (r.winner === this.opp) { s.losses++; s.streak = 0; this.series.opp++; }
    else { s.draws++; }
    if (this.mode.bestOf) {
      const need = Math.ceil(this.mode.bestOf / 2);
      if (this.series.you >= need || this.series.opp >= need) { this.series.done = true; this.series.winner = this.series.you >= need ? 'you' : 'opp'; }
    }
    this.onEvent('over', { winner: r.winner, line: r.line });
  }
  /** Laptop zugeklappt: laufende Runde verfällt */
  abort() { if (!this.over) { this.over = { winner: 'aborted', line: null }; this.onEvent('aborted', {}); } }
}
