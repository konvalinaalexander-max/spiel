// Schwierigkeitsstufen, Vorlesungslängen, Spielmodi. Alle Tuning-Werte an einem Ort.

export const DIFFICULTIES = {
  erstsemester: {
    id: 'erstsemester', target: 5, mul: 0.7, quizEvery: 0.3, quizTime: 20, oppSkill: 0.28, neighbor: 'helpful', aisle: 0.6,
    prof: { shoulderEvery: [14, 30], telegraph: 0.65, bluffChance: 0.12, playerFixChance: 0.06, fixation: [0.9, 2.4], turnRate: 2.6 }
  },
  bachelor: {
    id: 'bachelor', target: 6, mul: 1.65, quizEvery: 0.24, quizTime: 16, oppSkill: 0.4, neighbor: 'helpful', aisle: 1,
    prof: { shoulderEvery: [8, 18], telegraph: 0.31, bluffChance: 0.28, playerFixChance: 0.22, fixation: [0.7, 2.3], turnRate: 3.8 }
  },
  pruefungswoche: {
    id: 'pruefungswoche', target: 6, mul: 1.8, quizEvery: 0.2, quizTime: 14, oppSkill: 0.5, neighbor: 'neutral', aisle: 1.4,
    prof: { shoulderEvery: [6, 15], telegraph: 0.26, bluffChance: 0.33, playerFixChance: 0.24, fixation: [0.5, 1.7], turnRate: 4.4 }
  },
  diplom: {
    id: 'diplom', target: 6, mul: 2.2, quizEvery: 0.17, quizTime: 12, oppSkill: 0.52, neighbor: 'betrayer', aisle: 1.8,
    prof: { shoulderEvery: [5, 12], telegraph: 0.2, bluffChance: 0.38, playerFixChance: 0.24, fixation: [0.45, 1.5], turnRate: 5.0 }
  }
};
export const DIFFICULTY_ORDER = ['erstsemester', 'bachelor', 'pruefungswoche', 'diplom'];

/** Benutzerdefiniert: vigilance 0.5–1.8, neighbor helpful|neutral|betrayer, oppSkill 0–1 */
export function customDifficulty(c) {
  const v = Math.max(0.5, Math.min(1.8, c.vigilance ?? 1));
  const lerp = (a, b) => a + (b - a) * (v - 0.5) / 1.3;
  return {
    id: 'custom', target: c.target ?? 4, mul: v, quizEvery: lerp(0.22, 0.11), quizTime: Math.round(lerp(20, 12)), oppSkill: c.oppSkill ?? 0.6, neighbor: c.neighbor || 'helpful', aisle: v,
    prof: { shoulderEvery: [lerp(14, 6), lerp(30, 14)], telegraph: lerp(0.65, 0.24), bluffChance: lerp(0.12, 0.35), playerFixChance: lerp(0.06, 0.24), fixation: [lerp(0.9, 0.5), lerp(2.4, 1.6)], turnRate: lerp(2.6, 4.4) }
  };
}

export const LENGTHS = { short: 420, normal: 720, long: 1200, realtime: 5400 };
export const MODES = ['tournament', 'bo5', 'blitz'];
export const WEATHERS = ['sunny', 'cloudy', 'rain'];
export const DEFAULT_SEAT = { row: 4, k: 7 };
/** Punkte-Multiplikator nach Reihe: vorne riskanter, aber mehr Punkte */
export const seatMultiplier = row => Math.round((1.35 - row * 0.06) * 100) / 100;

/** Siegziel skaliert mit der Vorlesungslänge (Referenz: 12 Minuten ≙ „normal“); gilt auch für benutzerdefinierte Ziele */
export const scaledTarget = (target, seconds) => Math.max(2, Math.round(target * Math.min(6, Math.max(0.55, seconds / 720))));
