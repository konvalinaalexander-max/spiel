// Schwierigkeitsstufen, Vorlesungslängen, Spielmodi. Alle Tuning-Werte an einem Ort.

export const DIFFICULTIES = {
  erstsemester: {
    id: 'erstsemester', target: 4, mul: 0.62, quizEvery: 0.3, quizTime: 20, oppSkill: 0.28, neighbor: 'helpful', aisle: 0.6,
    prof: { shoulderEvery: [14, 30], telegraph: 0.65, bluffChance: 0.12, playerFixChance: 0.06, fixation: [0.9, 2.4], turnRate: 2.6 }
  },
  bachelor: {
    id: 'bachelor', target: 6, mul: 1.15, quizEvery: 0.24, quizTime: 16, oppSkill: 0.42, neighbor: 'helpful', aisle: 1,
    prof: { shoulderEvery: [10, 24], telegraph: 0.45, bluffChance: 0.22, playerFixChance: 0.13, fixation: [0.7, 2.2], turnRate: 3.2 }
  },
  pruefungswoche: {
    id: 'pruefungswoche', target: 6, mul: 1.45, quizEvery: 0.2, quizTime: 14, oppSkill: 0.5, neighbor: 'neutral', aisle: 1.4,
    prof: { shoulderEvery: [8, 18], telegraph: 0.32, bluffChance: 0.3, playerFixChance: 0.15, fixation: [0.6, 1.9], turnRate: 3.8 }
  },
  diplom: {
    id: 'diplom', target: 7, mul: 1.8, quizEvery: 0.17, quizTime: 12, oppSkill: 0.6, neighbor: 'betrayer', aisle: 1.8,
    prof: { shoulderEvery: [6, 14], telegraph: 0.24, bluffChance: 0.35, playerFixChance: 0.19, fixation: [0.5, 1.6], turnRate: 4.4 }
  }
};
export const DIFFICULTY_ORDER = ['erstsemester', 'bachelor', 'pruefungswoche', 'diplom'];

/** Benutzerdefiniert: vigilance 0.5–1.8, neighbor helpful|neutral|betrayer, oppSkill 0–1 */
export function customDifficulty(c) {
  const v = Math.max(0.5, Math.min(1.8, c.vigilance ?? 1));
  const lerp = (a, b) => a + (b - a) * (v - 0.5) / 1.3;
  return {
    id: 'custom', target: c.target ?? 4, mul: v, quizEvery: lerp(0.22, 0.11), quizTime: Math.round(lerp(20, 12)), oppSkill: c.oppSkill ?? 0.6, neighbor: c.neighbor || 'helpful', aisle: v,
    prof: { shoulderEvery: [lerp(14, 6), lerp(30, 14)], telegraph: lerp(0.65, 0.24), bluffChance: lerp(0.12, 0.35), playerFixChance: lerp(0.06, 0.19), fixation: [lerp(0.9, 0.5), lerp(2.4, 1.6)], turnRate: lerp(2.6, 4.4) }
  };
}

export const LENGTHS = { short: 420, normal: 720, long: 1200, realtime: 5400 };
export const MODES = ['tournament', 'bo5', 'blitz'];
export const WEATHERS = ['sunny', 'cloudy', 'rain'];
export const DEFAULT_SEAT = { row: 4, k: 7 };
/** Punkte-Multiplikator nach Reihe: vorne riskanter, aber mehr Punkte */
export const seatMultiplier = row => Math.round((1.35 - row * 0.06) * 100) / 100;
