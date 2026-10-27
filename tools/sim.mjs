// Headless-Simulation ganzer Vorlesungen mit dem Test-Bot (ohne Rendering).
// node tools/sim.mjs [--runs 20] [--difficulty bachelor|all] [--length normal] [--skill 0.5] [--log docs/RUN_LOG.txt] [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import { Session } from '../src/game/session.js';
import { Bot } from '../src/game/bot.js';
import { DIFFICULTY_ORDER } from '../src/game/config.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const sections = fs.readdirSync(path.join(root, 'src/content/sections')).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(root, 'src/content/sections', f), 'utf8')));
const dialogue = JSON.parse(fs.readFileSync(path.join(root, 'src/content/dialogue.json'), 'utf8'));
const runs = +(args.runs || 5), skill = +(args.skill ?? 0.5), length = args.length || 'normal';
const diffs = args.difficulty === 'all' || !args.difficulty ? DIFFICULTY_ORDER : [args.difficulty];
const lang = args.lang || 'de';

export function runOne(difficulty, seed, opts = {}) {
  const events = [];
  let bot;
  const s = new Session({ difficulty, length: opts.length || length, seat: opts.seat || { row: 4, k: 7 }, mode: opts.mode || 'tournament', opponent: opts.opponent || 'hall', seed, popSeed: 4711 + seed, lang, weather: opts.weather || 'sunny' }, { sections, dialogue }, (type, d) => { if (opts.log) events.push({ t: s ? s.t : 0, type, d }); bot && bot.onEvent(type, d); });
  bot = new Bot(s, opts.skill ?? skill, seed * 7 + 1);
  const dt = 1 / 30; let guard = 0;
  while (s.state !== 'ended' && guard++ < (s.seconds + 240) * 30) { bot.update(dt); s.step(dt); }
  if (s.state !== 'ended') s._finish('timeout');
  return { s, r: s.result, events, director: s.director };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const summary = {};
  const t0 = Date.now();
  for (const d of diffs) {
    const rows = [];
    for (let i = 0; i < runs; i++) { const { r } = runOne(d, 1000 + i); rows.push(r); }
    const n = rows.length, mean = f => rows.reduce((a, r) => a + f(r), 0) / n;
    summary[d] = {
      runs: n, success: mean(r => (r.success && r.reason !== 'kicked' ? 1 : 0)), kicked: mean(r => (r.reason === 'kicked' ? 1 : 0)),
      caughtPerRun: mean(r => r.strikes), wins: mean(r => r.wins), losses: mean(r => r.losses), draws: mean(r => r.draws), rounds: mean(r => r.rounds),
      quizRight: mean(r => r.quizRight), quizAsked: mean(r => r.quizAsked), grade: mean(r => r.grade), duration: mean(r => r.seconds), laptop: mean(r => r.laptopSeconds), score: mean(r => r.total), closeCalls: mean(r => r.closeCalls)
    };
    console.log(d.padEnd(15), JSON.stringify(summary[d], (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (args.json) fs.writeFileSync(path.resolve(root, args.json), JSON.stringify({ skill, length, runs, summary }, null, 1));
  if (args.log) {
    const { s, director } = runOne(args.difficulty && args.difficulty !== 'all' ? args.difficulty : 'bachelor', 4242, { log: true });
    const fmt = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    const lines = director.log.map(e => `[${String(e.t.toFixed(1)).padStart(6)} s | ${fmt(e.clock)}] ${e.type.padEnd(8)} ${Object.entries(e).filter(([k]) => !['t', 'clock', 'type'].includes(k)).map(([k, v]) => `${k}=${v}`).join('  ')}`);
    const types = new Set(director.log.filter(e => e.type === 'event').map(e => e.name));
    const header = `Ablauf-Log eines kompletten Durchlaufs (Bot, Schwierigkeit ${s.diff.id}, Länge ${s.seconds} s, Seed 4242)\nErgebnis: ${JSON.stringify(s.result)}\nVerschiedene Ereignistypen: ${types.size} → ${[...types].join(', ')}\n\n`;
    fs.writeFileSync(path.resolve(root, args.log), header + lines.join('\n') + '\n');
    console.log('Log:', args.log, lines.length, 'Zeilen,', types.size, 'Ereignistypen');
  }
}
