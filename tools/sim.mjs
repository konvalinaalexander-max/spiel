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
  if (args.md) {
    const { DIFFICULTIES } = await import('../src/game/config.js');
    const pc = v => Math.round(v * 100) + ' %', f1 = v => (Math.round(v * 100) / 100).toString().replace('.', ',');
    const mm = v => { const s = Math.round(v); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    const rows = diffs.map(d => { const r = summary[d]; return `| ${d} | ${DIFFICULTIES[d].target} | ${pc(r.success)} | ${f1(r.caughtPerRun)} | ${pc(r.kicked)} | ${f1(r.wins)} / ${f1(r.losses)} / ${f1(r.draws)} | ${f1(r.quizRight)} / ${f1(r.quizAsked)} | ${f1(r.grade)} | ${mm(r.duration)} | ${Math.round(r.laptop)} s |`; }).join('\n');
    const par = diffs.map(d => { const D = DIFFICULTIES[d], P = D.prof, de = v => String(v).replace('.', ','); return `| ${d} | ${de(D.mul)} | ${P.shoulderEvery.join('–')} s | ${de(P.telegraph)} s | ${pc(P.bluffChance)} | ${pc(P.playerFixChance)} | ${P.fixation.map(de).join('–')} s | ${de(P.turnRate)} | ${de(D.oppSkill)} | ${D.neighbor} |`; }).join('\n');
    const md = `# Balancing

Automatisierter Test: \`node tools/sim.mjs --runs ${runs} --difficulty all --md docs/BALANCING.md\` (läuft ohne Rendering, ${((Date.now() - t0) / 1000).toFixed(0)} s).
Der Bot (\`src/game/bot.js\`, Geschick ${skill}) spielt **nur mit Hinweisen, die auch ein Mensch hat**: grobe, verzögerte und verrauschte
Blickrichtung des Profs, das Ende des Kreidekratzens, Warnungen der Nachbarin, Reaktionszeit ${(0.55 - skill * 0.3).toFixed(2).replace('.', ',')} s ± 0,1 s; er sieht
keine internen Werte (Verdacht/Beweis). Er schaltet über dieselbe API wie die Eingabe (\`setMode\`, \`tttPlay\`, \`answerQuiz\`, \`signList\`),
schreibt in ruhigen Momenten mit und beantwortet Prüfungsfragen umso besser, je länger er im jeweiligen Abschnitt zugehört hat.
Vorlesungslänge „${length}“ (${length === 'normal' ? '720' : length} s ≙ 90 Spielminuten), Sitzplatz Reihe 5 / Platz 8, Gegner:in im Hörsaal,
${runs} Durchläufe je Stufe mit unterschiedlichen Seeds (Vorlesungsablauf, Besetzung, Prof-Verhalten).

## Ergebnis

| Stufe | Ziel (Siege) | Erfolgsquote | Erwischt pro Lauf | Rauswurf | Siege / Niederl. / Unentsch. | Quiz richtig / gestellt | Ø Note | Ø Dauer | Ø Zeit am Spiel |
|---|---|---|---|---|---|---|---|---|---|
${rows}

Zielband laut Auftrag: **„Bachelor“ ≈ 50 %** Erfolgsquote eines mittelguten Bots. Die Stufen sind monoton gestaffelt
(leicht → sehr schwer), „Erstsemester“ ist für den Einstieg bewusst gutmütig, „Diplomand:in“ eine echte Herausforderung.
„Erfolg“ = Siegziel erreicht und nicht rausgeworfen. Kürzere Durchläufe als 12:00 entstehen durch Rauswurf.

## Parameter (Tuning-Datei \`src/game/config.js\`)

| Stufe | Verdachts-Multiplikator | Schulterblick alle | Vorwarnung (Kreide stoppt) | Bluff | Blick auf Spieler:in | Fixationsdauer | Drehrate | Gegner-Stärke | Nachbarin |
|---|---|---|---|---|---|---|---|---|---|
${par}

Weitere Größen (alle Stufen): Verdachtsmodell \`src/game/suspicion.js\` (Aufmerksamkeit steigt 70/s × Sichtbarkeit × Auffälligkeit, fällt 28/s;
Verdacht ab Aufmerksamkeit 20; Beweis nur foveal und ab Verdacht 12), Sichtkegel \`src/game/vision.js\` (Fovea ±5°, Peripherie bis 60°,
Verdeckung durch Köpfe/Oberkörper der Vorderleute, Pultfronten, Pult und Tisch).

## Verlauf der Abstimmung

1. Erste Messung (20 Läufe): Erstsemester 100 %, Bachelor 85 %, Prüfungswoche 60 %, Diplom 20 % – Bachelor deutlich zu leicht.
2. Strengerer Prof (Multiplikator 1,15 → 1,5, Schulterblick alle 8–19 s, kürzere Vorwarnung): Bachelor 65 %. Auffällig: Mehr Wachsamkeit
   senkt die Erwischt-Quote teils sogar, weil der Bot auf frühe „Hm?“-Reaktionen vorsichtiger reagiert – der Prof wirkt also fair.
3. Mit 40 Läufen gemessen (20 streuen um ±11 Prozentpunkte): Bachelor 75 % → Siegziel 6 → 7: 60 %.
4. Stärkere Gegner:in im Hörsaal (0,42 → 0,48): **Bachelor 55 %**, Prüfungswoche 35 %, Diplom 23 %, Erstsemester 90 %.\n5. Mehr Kleidungsvarianten (anderer Besetzungs-Zufall) verschoben „Diplom“ auf 35 % – zu nah an „Prüfungswoche“.\n   → Siegziel 7 → 8, Multiplikator 2,1 → 2,2: Diplom 18 %.\n6. Endkontrolle mit **80 Läufen** je Stufe (40 Läufe streuen bei den schweren Stufen noch um ±8 Prozentpunkte, kleine Parameteränderungen\n   mischen die Zufallsfolge neu). „Blick auf Spieler:in“ ist jetzt monoton (Prüfungswoche 0,19 → 0,24, Diplom 0,22 → 0,24) – damit lag\n   Prüfungswoche mit 46–51 % zu nah an Bachelor, und der Verdachts-Multiplikator wirkte kaum (1,95/2,05: 47 %/49 %, nur mehr Rauswürfe).\n   Entscheidend ist, ob das Siegziel erreicht wird → Gegner:in in Prüfungswoche stärker (0,50 → 0,56): 35 %. Diplom mit gleicher Gegner-Stärke\n   (0,60 → 0,56): 11 %. Endstand siehe Tabelle oben.
`;
    fs.writeFileSync(path.resolve(root, args.md), md);
    console.log('Bericht:', args.md);
  }
  if (args.log) {
    const { s, director } = runOne(args.difficulty && args.difficulty !== 'all' ? args.difficulty : 'bachelor', +(args.seed || 4242), { log: true, weather: args.weather });
    const fmt = m => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    const lines = director.log.map(e => `[${String(e.t.toFixed(1)).padStart(6)} s | ${fmt(e.clock)}] ${e.type.padEnd(8)} ${Object.entries(e).filter(([k]) => !['t', 'clock', 'type'].includes(k)).map(([k, v]) => `${k}=${v}`).join('  ')}`);
    const types = new Set(director.log.filter(e => e.type === 'event').map(e => e.name));
    const header = `Ablauf-Log eines kompletten Durchlaufs (Bot, Schwierigkeit ${s.diff.id}, Länge ${s.seconds} s, Seed ${args.seed || 4242}, Wetter ${args.weather || "sunny"})\nErgebnis: ${JSON.stringify(s.result)}\nVerschiedene Ereignistypen: ${types.size} → ${[...types].join(', ')}\n\n`;
    fs.writeFileSync(path.resolve(root, args.log), header + lines.join('\n') + '\n');
    console.log('Log:', args.log, lines.length, 'Zeilen,', types.size, 'Ereignistypen');
  }
}
