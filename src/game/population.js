// Besetzungsplan (deterministisch per Seed): wer sitzt wo, sieht wie aus, verhält sich wie.
// Rein logisch – wird von Simulation (Sichtmodell) und Darstellung gleichermaßen genutzt.
import { makeRng } from '../core/util.js';
import * as LY from '../scene/layout.js';

// Reihenbelegung: hinten voller als vorne (Recherche Kap. 6.6)
const ROW_P = [0.12, 0.22, 0.32, 0.42, 0.5, 0.55, 0.62, 0.66, 0.6, 0.5];

const SKIN = [0xf3d2b9, 0xeec3a2, 0xe0ac86, 0xc98f67, 0xa46d4b, 0x7a4a31];
const HAIR = [0x2b1f17, 0x3b2a1e, 0x5a3b22, 0x7a5232, 0x9c6b3a, 0xc59a5a, 0xd8bf86, 0x161210, 0x6b2c1a, 0x8a8580];
const TOPS = [
  ['sweater', 0x6b7f5a], ['sweater', 0x3a4a63], ['sweater', 0x8a3a2e], ['sweater', 0xc9b89a], ['sweater', 0x2f2f33],
  ['hoodie', 0x00aa5a], ['hoodie', 0x4a4f57], ['hoodie', 0x2d4a6b], ['hoodie', 0x7a2f3a], ['hoodie', 0xd8d2c4],
  ['flannel', 0x8a2a24], ['flannel', 0x3c5a3a], ['flannel', 0x2d4a6b],
  ['tshirt', 0xf2f2f0], ['tshirt', 0x3e3e42], ['tshirt', 0x5f7f9a],
  ['jacket', 0x2f3b2f], ['jacket', 0x5b4632], ['jacket', 0x1f2a3a], ['shirt', 0xdfe8f0], ['shirt', 0xe9e2d0],
  ['polo', 0x1f3b5a], ['polo', 0xa8323a], ['cardigan', 0x7a6a58], ['cardigan', 0x3d4a3a], ['turtleneck', 0x2b2b30], ['turtleneck', 0xb8a58a],
  ['vest', 0x5a5f4a]
];
export const TOP_TYPES = [...new Set(TOPS.map(t => t[0]))];
const LEGS = [0x2c3e58, 0x3a4f6e, 0x1f2328, 0x4a4f57, 0x6b5a45, 0x3c4a35, 0x2a3440];
const SHOES = [0xe9e7e2, 0x2a2420, 0x5b3a26, 0x3b3f46, 0x9a8a72];
const HAIRSTYLES_F = ['long', 'ponytail', 'bun', 'long', 'curly', 'short', 'sidepart'];
const HAIRSTYLES_M = ['short', 'short', 'buzz', 'curly', 'sidepart', 'short', 'long', 'bald'];
export const PROFILES = ['writer', 'typer', 'listener', 'phone', 'sleeper', 'coffee', 'whisper', 'asker'];
const PROFILE_W = { writer: 0.24, typer: 0.3, listener: 0.18, phone: 0.1, sleeper: 0.03, coffee: 0.08, whisper: 0.05, asker: 0.02 };
const LAPTOP_SCREENS = ['notes', 'slides', 'pdf', 'feed', 'video', 'mail', 'sheet'];
const NAMES_F = ['Lena', 'Anna', 'Sophie', 'Marie', 'Katharina', 'Julia', 'Hannah', 'Theresa', 'Magdalena', 'Elif', 'Sarah', 'Laura'];
const NAMES_M = ['Jonas', 'Lukas', 'Felix', 'Paul', 'Florian', 'Tobias', 'Maximilian', 'David', 'Simon', 'Matthias', 'Elias', 'Jakob'];

function pickWeighted(rng, weights) {
  let s = 0; for (const k in weights) s += weights[k];
  let r = rng.next() * s;
  for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
  return Object.keys(weights)[0];
}

export function makeSpec(rng, female, opts = {}) {
  const [topType, topColor] = rng.pick(TOPS);
  const hairStyle = female ? rng.pick(HAIRSTYLES_F) : rng.pick(HAIRSTYLES_M);
  const skin = rng.pick(SKIN);
  const hair = rng.pick(HAIR);
  return {
    female, height: female ? rng.range(0.93, 1.0) : rng.range(0.98, 1.06), build: female ? rng.range(0.9, 1.0) : rng.range(0.95, 1.1),
    skin, hair, hairStyle, eyeColor: rng.pick([0x3d2b1f, 0x4a6b8a, 0x5b6b3a, 0x2a1d14]),
    top: { type: topType, color: topColor, color2: topType === 'hoodie' ? topColor : (topType === 'jacket' ? rng.pick([0x2f3b2f, 0x1f1f22, 0x5b4632]) : topType === 'cardigan' ? rng.pick([0xf0f0ea, 0x2f2f33, 0x9ab0c4]) : rng.pick([0xf0f0ea, 0x222222, topColor])), shirt: topType === 'vest' ? rng.pick([0xdfe8f0, 0xf2f2f0, 0xd8cfc0]) : undefined },
    legs: { color: rng.pick(LEGS) }, shoes: { color: rng.pick(SHOES) },
    glasses: rng.chance(0.3), glassesColor: rng.pick([0x1c1c1c, 0x5a3b22, 0x8a8a8a]),
    beard: !female && rng.chance(0.28), beardColor: hair,
    beanie: rng.chance(0.08) ? rng.pick([0x3a4a63, 0x8a3a2e, 0x00aa5a, 0x2f2f33]) : null,
    cap: rng.chance(0.04) ? rng.pick([0x1f2a3a, 0x5b4632]) : null,
    scarf: rng.chance(0.14) ? rng.pick([0x8a3a2e, 0xc9b89a, 0x3a4a63, 0x6b7f5a]) : null,
    headphones: rng.chance(0.06) ? 0x1f1f1f : null,
    belly: rng.chance(0.15) ? rng.range(0.005, 0.02) : 0,
    ...opts
  };
}

/**
 * playerSeat: { row, k }. Liefert { students, neighbor, opponent, latecomer, player, emptySeats }.
 */
export function planPopulation(seed, playerSeat, opts = {}) {
  const rng = makeRng(seed);
  const seats = LY.allSeats();
  const key = (r, k) => `${r}-${k}`;
  const taken = new Set([key(playerSeat.row, playerSeat.k)]);
  const students = [];
  const usedNames = new Set();
  const nameFor = female => { const pool = female ? NAMES_F : NAMES_M; for (let i = 0; i < 20; i++) { const n = rng.pick(pool); if (!usedNames.has(n)) { usedNames.add(n); return n; } } return rng.pick(pool); };
  const mk = (seat, profile, extra = {}) => {
    const female = extra.female ?? rng.chance(0.52);
    const s = {
      id: 's' + students.length, seat, profile, female, name: nameFor(female),
      spec: makeSpec(rng, female), hasLaptop: profile === 'typer' || (profile !== 'writer' && profile !== 'sleeper' && rng.chance(0.35)) || rng.chance(0.12),
      screen: rng.pick(LAPTOP_SCREENS), seed: rng.int(1, 1e6), phase: rng.next() * 10,
      cup: rng.chance(0.3), bottle: rng.chance(0.45), backpack: rng.chance(0.75), jacketOnBench: rng.chance(0.25), notebook: profile === 'writer' || rng.chance(0.35),
      ...extra
    };
    if (s.profile === 'typer') s.hasLaptop = true;
    students.push(s); taken.add(key(seat.row, seat.k));
    return s;
  };
  const seatAt = (r, k) => seats.find(s => s.row === r && s.k === k);
  // Nachbarin links (schreibt mit, schaut gelegentlich herüber)
  const nb = playerSeat.k > 0 ? seatAt(playerSeat.row, playerSeat.k - 1) : seatAt(playerSeat.row, playerSeat.k + 1);
  const neighbor = mk(nb, 'writer', { role: 'neighbor', female: true, hasLaptop: false, notebook: true, cup: true });
  // rechter Platz bleibt frei (dein Rucksack)
  if (playerSeat.k < LY.SEATS - 1) taken.add(key(playerSeat.row, playerSeat.k + 1));
  // Gegner:in im Saal (vorne, wenn du hinten sitzt – sonst hinten)
  const oppRow = playerSeat.row >= 4 ? 1 : 7;
  const oppK = Math.max(1, Math.min(LY.SEATS - 2, playerSeat.k + rng.int(-3, -1)));
  const opponent = mk(seatAt(oppRow, oppK), 'typer', { role: 'opponent', hasLaptop: true, screen: 'ttt' });
  // Flüsterpaare & Rest
  for (const seat of seats) {
    if (taken.has(key(seat.row, seat.k))) continue;
    // keine Verstopfung direkt vor dem Spieler: der Platz vor dir bleibt meist frei
    if (seat.row === playerSeat.row - 1 && Math.abs(seat.k - playerSeat.k) === 0 && rng.chance(0.75)) continue;
    if (!rng.chance(ROW_P[seat.row] ?? 0.4)) continue;
    let profile = pickWeighted(rng, PROFILE_W);
    if (profile === 'whisper') {
      const nxt = seatAt(seat.row, seat.k + 1);
      if (!nxt || taken.has(key(nxt.row, nxt.k))) profile = 'listener';
      else { const a = mk(seat, 'whisper', { pair: 'L' }); const b = mk(nxt, 'whisper', { pair: 'R' }); a.partner = b.id; b.partner = a.id; continue; }
    }
    mk(seat, profile);
  }
  // Spätkommer:in: freier Platz in den hinteren Reihen am Gang
  const free = seats.filter(s => !taken.has(key(s.row, s.k)) && s.row >= 5 && (s.k <= 1 || s.k >= LY.SEATS - 2));
  const lateSeat = free.length ? rng.pick(free) : seats.find(s => !taken.has(key(s.row, s.k)));
  const latecomer = { id: 'late', seat: lateSeat, profile: 'typer', female: rng.chance(0.5), name: '', spec: null, hasLaptop: true, screen: 'notes', seed: rng.int(1, 1e6), role: 'latecomer', backpack: true };
  latecomer.spec = makeSpec(rng, latecomer.female, { scarf: 0x8a3a2e });
  latecomer.name = nameFor(latecomer.female);
  taken.add(key(lateSeat.row, lateSeat.k));
  // Fragesteller:innen sicherstellen (mind. 2)
  let askers = students.filter(s => s.profile === 'asker');
  for (const s of students) { if (askers.length >= 2) break; if (s.profile === 'listener' || s.profile === 'writer') { if (s.role) continue; s.profile = 'asker'; askers = students.filter(x => x.profile === 'asker'); } }
  // Schläfer:in höchstens 2
  let sl = 0; for (const s of students) if (s.profile === 'sleeper' && ++sl > 2) s.profile = 'listener';
  const emptySeats = seats.filter(s => !taken.has(key(s.row, s.k)));
  return { students, neighbor, opponent, latecomer, player: playerSeat, emptySeats };
}

/** Prof. Haferkorn (fiktiv) */
export const PROF_SPEC = {
  height: 1.02, build: 1.06, skin: 0xe6b897, hair: 0xb9b6b0, hairStyle: 'receding', beard: true, beardColor: 0xa9a59f,
  glasses: true, glassesColor: 0x3a2a1e, eyeColor: 0x4a6b8a,
  top: { type: 'vest', color: 0x4b5a48, shirt: 0xc8d6e6 }, legs: { color: 0x6b4f3a }, shoes: { color: 0x3b2a1e }, soleColor: 0x2a2018,
  watch: 0x8f8f8f, belly: 0.03, browColor: 0x8f8a84
};
export const TUTOR_SPEC = {
  female: true, height: 0.97, build: 0.95, skin: 0xeec3a2, hair: 0x3b2a1e, hairStyle: 'ponytail', glasses: true,
  top: { type: 'hoodie', color: 0x00aa5a, color2: 0x00995a }, legs: { color: 0x2c3e58 }, shoes: { color: 0xe9e7e2 }
};
