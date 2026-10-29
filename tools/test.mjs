// Testsuite ohne externe Abhängigkeiten:  npm test   (optional: --e2e für den Headless-Browserlauf, --quick ohne Simulation)
// Prüft Spielregeln (Minimax), Sichtmodell, Verdachtsmodell, Regie, Übersetzungen, Inhalte und den Build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIST, DIST_NAME } from './dist.mjs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { result, minimax, bestMoves, chooseMove, TicTacToe } from '../src/game/tictactoe.js';
import { Vision, VISION } from '../src/game/vision.js';
import { Suspicion } from '../src/game/suspicion.js';
import { planPopulation } from '../src/game/population.js';
import { makeRng } from '../src/core/util.js';
import * as LY from '../src/scene/layout.js';
import * as SESSION from '../src/game/session.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
let pass = 0, fail = 0; const failures = [];
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; failures.push(name + ': ' + e.message); console.log('  ✗ ' + name + '\n      ' + e.message); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} erwartet ${JSON.stringify(b)}, erhalten ${JSON.stringify(a)}`); };
const ok = (c, m = 'Bedingung nicht erfüllt') => { if (!c) throw new Error(m); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

console.log('Tic Tac Toe');
test('Gewinnreihe wird erkannt', () => { const b = ['X', 'X', 'X', null, 'O', 'O', null, null, null]; eq(result(b).winner, 'X'); eq(result(b).line.join(), '0,1,2'); });
test('Unentschieden wird erkannt', () => { eq(result(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']).winner, 'draw'); });
test('Leeres Brett ist bei perfektem Spiel unentschieden', () => { eq(minimax(Array(9).fill(null), 'X', 'X'), 0); });
test('Sofortgewinn wird gewählt', () => { const b = ['O', 'O', null, 'X', 'X', null, null, null, null]; const m = bestMoves(b, 'X'); ok(m.moves.includes(5), 'Zug 5 erwartet, ' + m.moves); });
test('Drohung wird geblockt', () => { const b = ['O', 'O', null, null, 'X', null, null, null, null]; const m = bestMoves(b, 'X'); eq(m.moves.join(), '2'); });
test('Perfekte KI verliert nie gegen Zufall (300 Partien)', () => {
  const r = makeRng(5);
  for (let g = 0; g < 300; g++) {
    const b = Array(9).fill(null); let turn = g % 2 ? 'X' : 'O';
    while (!result(b)) { const i = turn === 'O' ? chooseMove(b, 'O', 1, r.next) : r.pick(b.map((v, k) => (v ? -1 : k)).filter(k => k >= 0)); b[i] = turn; turn = turn === 'X' ? 'O' : 'X'; }
    ok(result(b).winner !== 'X', 'perfekte KI hat verloren in Partie ' + g);
  }
});
test('Schwache KI macht Fehler (gewinnbar)', () => {
  const r = makeRng(9); let lost = 0;
  for (let g = 0; g < 200; g++) {
    const b = Array(9).fill(null); let turn = 'X';
    while (!result(b)) { const i = turn === 'O' ? chooseMove(b, 'O', 0.2, r.next) : bestMoves(b, 'X').moves[0]; b[i] = turn; turn = turn === 'X' ? 'O' : 'X'; }
    if (result(b).winner === 'X') lost++;
  }
  ok(lost > 20, 'zu stark: nur ' + lost + ' Niederlagen');
});
test('Spielmodi: Best of 5 endet bei 3 Siegen', () => {
  const g = new TicTacToe({ mode: 'bo5' });
  for (let k = 0; k < 3; k++) { g.board = ['X', 'X', null, 'O', 'O', null, null, null, null]; g.turn = 'X'; g.over = null; g.play(2, 'X'); if (k < 2) g.newRound(); }
  ok(g.series.done && g.series.winner === 'you', 'Serie nicht gewonnen: ' + JSON.stringify(g.series));
});

console.log('Sichtmodell');
const pop = planPopulation(4711, { row: 4, k: 7 });
const vis = new Vision(pop);
test('Kegelgewichtung fällt monoton ab', () => { let last = 2; for (let a = 0; a <= 1.2; a += 0.05) { const w = vis.coneWeight(a); ok(w <= last + 1e-9, 'nicht monoton bei ' + a); last = w; } eq(vis.coneWeight(0), 1); eq(vis.coneWeight(VISION.periphery + 0.01), 0); });
test('Hinter dem Rücken sieht er nichts', () => { const r = vis.assess(V(0, 1.85, -5), V(0, 0, -1), [{ p: V(0, 1.3, 0), w: 1 }]); eq(r.vis, 0); });
test('Pultfront verdeckt den Laptop von vorne unten', () => {
  const s = LY.allSeats().find(x => x.row === 4 && x.k === 7);
  const lap = V(s.x, s.floor + LY.DESK_H + 0.02, LY.deskZ(4));
  const eye = V(s.x, LY.PODIUM.h + 1.72, -4.6);
  const pts = [{ p: lap, w: 1 }];
  const r = vis.assess(eye, lap.clone().sub(eye).normalize(), pts);
  ok(r.vis < 0.6, 'Laptopunterteil sollte (teilweise) verdeckt sein, vis=' + r.vis.toFixed(2));
});
test('Direkter Blick auf freien Kopf ist foveal', () => {
  const s0 = LY.allSeats().find(x => x.row === 0 && x.k === 10); // erste Reihe außen: nichts dazwischen
  const head = V(s0.x, s0.floor + 1.2, s0.z);
  const eye = V(0.5, LY.PODIUM.h + 1.72, -4.6);
  const r = vis.assess(eye, head.clone().sub(eye).normalize(), [{ p: head, w: 1 }]);
  ok(r.fovea > 0.9 && r.vis > 0.3, JSON.stringify(r));
});

console.log('Verdachtsmodell');
test('Ohne Blick kein Beweis', () => { const s = new Suspicion(); let c = false; for (let i = 0; i < 600; i++) c = c || s.update(1 / 30, { vis: 0, fovea: 0, cone: 0, los: 0 }, { laptop: 1, notes: 0, lookAway: 0, motion: 0, glow: 1, hands: 1, gameVisible: true }); ok(!c && s.evidence === 0); });
test('Starrer Blick auf offenes Spiel → erwischt', () => { const s = new Suspicion(); let c = false; for (let i = 0; i < 30 * 20 && !c; i++) c = s.update(1 / 30, { vis: 1, fovea: 1, cone: 1, los: 1 }, { laptop: 1, notes: 0, lookAway: 0, motion: 0.2, glow: 1, hands: 1, gameVisible: true }, { mul: 1 }); ok(c, 'nicht erwischt'); });
test('Mitschreiben baut Verdacht schneller ab', () => {
  const a = new Suspicion(), b = new Suspicion(); a.suspicion = b.suspicion = 60;
  for (let i = 0; i < 300; i++) { a.update(1 / 30, { vis: 0, fovea: 0, cone: 0, los: 0 }, { laptop: 0, notes: 1, lookAway: 0, motion: 0, glow: 0, hands: 0 }); b.update(1 / 30, { vis: 0, fovea: 0, cone: 0, los: 0 }, { laptop: 0, notes: 0, lookAway: 0, motion: 0, glow: 0, hands: 0 }); }
  ok(a.suspicion < b.suspicion, `${a.suspicion} !< ${b.suspicion}`);
});
test('Folien am Laptop mitlesen ist weniger verdächtig als Spielen und liefert keinen Beweis', () => {
  const seen = { vis: 0.5, fovea: 0.5, cone: 1, los: 1 };
  const play = new Suspicion(), study = new Suspicion(); play.attention = study.attention = 60; play.suspicion = study.suspicion = 40;
  for (let i = 0; i < 45; i++) {
    play.update(1 / 30, seen, { laptop: 1, notes: 0, lookAway: 0, motion: 0, glow: 0.3, hands: 0.5, gameVisible: true, studying: 0 });
    study.update(1 / 30, seen, { laptop: 1, notes: 0, lookAway: 0, motion: 0, glow: 0.3, hands: 0.5, gameVisible: false, studying: 1 });
  }
  ok(study.suspicion < play.suspicion, `Verdacht ${study.suspicion} !< ${play.suspicion}`);
  ok(study.evidence < play.evidence * 0.4, `Beweis ${study.evidence} vs ${play.evidence}`);
});

console.log('Übersetzungen');
const DE = JSON.parse(fs.readFileSync(path.join(root, 'src/content/strings.de.json'), 'utf8'));
const EN = JSON.parse(fs.readFileSync(path.join(root, 'src/content/strings.en.json'), 'utf8'));
test('DE und EN haben dieselben Schlüssel', () => { const a = Object.keys(DE).sort(), b = Object.keys(EN).sort(); const miss = a.filter(k => !(k in EN)).concat(b.filter(k => !(k in DE))); ok(!miss.length, 'Abweichungen: ' + miss.join(', ')); });
test('Platzhalter stimmen überein', () => {
  const ph = s => [...String(Array.isArray(s) ? s.join(' ') : s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  const bad = Object.keys(DE).filter(k => k in EN && ph(DE[k]) !== ph(EN[k])); ok(!bad.length, bad.join(', '));
});
test('Alle im Code verwendeten Schlüssel existieren', () => {
  const files = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(path.join(root, 'src'));
  const used = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\('([a-zA-Z][\w.]*)'/g)) if (m[1].includes('.')) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-html)?="([a-zA-Z][\w.]*)"/g)) used.add(m[1]);
  }
  const miss = [...used].filter(k => !(k in DE) && !k.endsWith('.'));
  ok(!miss.length, 'fehlend: ' + miss.join(', '));
});
test('Dynamische Schlüssel (Erfolge, Noten, Phasen, Modi) vollständig', () => {
  const need = [];
  for (const a of ['pansenProfi', 'invisible', 'honest', 'streak3', 'closeCall', 'frontRow', 'scribe', 'chalkTime', 'breakKing', 'snake20', 'accomplice', 'blitzWin', 'hardcore', 'excursion']) for (const s of ['t', 'd', 'hint']) need.push(`ach.${a}.${s}`);
  for (let g = 1; g <= 5; g++) need.push('grade.' + g);
  for (const p of ['arrival', 'intro', 'part1', 'break', 'part2', 'closing']) need.push('phase.' + p);
  for (const m of ['tournament', 'bo5', 'blitz']) need.push('mode.' + m, 'modeDesc.' + m);
  for (const d of ['erstsemester', 'bachelor', 'pruefungswoche', 'diplom', 'custom']) need.push('diff.' + d, 'diffDesc.' + d);
  for (const h of ['welcome', 'laptop', 'play', 'chalk', 'suspicion', 'notes', 'lid', 'alttab', 'list']) need.push('hint.' + h);
  for (const k of ['oeh', 'online', 'exkursion', 'mensa', 'peer']) for (const f of ['from', 'subject', 'body', 'time']) need.push(`os.mail.${k}.${f}`);
  for (const p of ['wins', 'draws', 'quiz', 'fleiss', 'excursion', 'risk', 'strikes', 'snake']) need.push('cert.part.' + p);
  for (const r of ['time', 'kicked', 'aborted']) need.push('cert.reason.' + r);
  for (const r of ['right', 'wrong', 'timeout']) need.push('quiz.' + r);
  const miss = need.filter(k => !(k in DE) || !(k in EN)); ok(!miss.length, miss.join(', '));
});

console.log('Inhalte');
test('Inhaltsvalidierung (tools/validate-content.mjs)', () => { execFileSync(process.execPath, [path.join(root, 'tools/validate-content.mjs')], { stdio: 'pipe' }); });
test('≥14 Abschnitte, ≥40 Quizfragen, ≥8 Rechenbeispiele', () => {
  const secs = fs.readdirSync(path.join(root, 'src/content/sections')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(root, 'src/content/sections', f), 'utf8')));
  const quiz = secs.reduce((a, s) => a + s.de.quiz.length, 0), calcs = secs.filter(s => s.de.calc && s.de.calc.steps && s.de.calc.steps.length).length;
  ok(secs.length >= 14 && quiz >= 40 && calcs >= 8, `${secs.length} Abschnitte, ${quiz} Fragen, ${calcs} Rechnungen`);
});

if (!args.includes('--quick')) {
  console.log('Regie & Simulation');
  const { runOne } = await import('./sim.mjs');
  test('Kurze Vorlesung läuft bis zum Ende (alle Phasen, ≥10 Ereignistypen)', () => {
    const { s, events } = runOne('bachelor', 77, { length: 'short', log: true });
    ok(s.state === 'ended', 'nicht beendet');
    const phases = new Set(events.filter(e => e.type === 'phase').map(e => e.d.phase));
    ok(['intro', 'part1', 'break', 'part2', 'closing'].every(p => phases.has(p)), 'Phasen: ' + [...phases]);
    const types = new Set(events.filter(e => e.type === 'event').map(e => e.d.name));
    ok(types.size >= 10, 'nur ' + types.size + ' Ereignistypen: ' + [...types]);
  });
  test('Normale Vorlesung dauert ±5 % der Sollzeit', () => { const { s } = runOne('erstsemester', 3, {}); ok(Math.abs(s.t - s.seconds) / s.seconds < 0.05, `t=${s.t.toFixed(0)} soll=${s.seconds}`); });
  test('Wer nie spielt, wird nie erwischt (Diplom)', () => {
    const { Session } = SESSION;
    const sections = fs.readdirSync(path.join(root, 'src/content/sections')).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(root, 'src/content/sections', f), 'utf8')));
    const dialogue = JSON.parse(fs.readFileSync(path.join(root, 'src/content/dialogue.json'), 'utf8'));
    const s = new Session({ difficulty: 'diplom', length: 'short', seat: { row: 1, k: 5 }, seed: 5, popSeed: 4711 }, { sections, dialogue });
    while (s.state !== 'ended' && s.t < 600) { if (s.quiz) s.answerQuiz(s.quiz.correctIndex); s.step(1 / 30); }
    eq(s.stats.strikes, 0, 'Verwarnungen');
    ok(s.result.achievements.includes('honest'), 'Erfolg „Ehrliche Haut“ fehlt');
  });
}

console.log('Build');
test(`${DIST} existiert, ≤ 120 MB, Prüfsummen stimmen`, () => {
  const f = path.join(root, DIST);
  ok(fs.existsSync(f), 'Build fehlt – npm run build');
  const buf = fs.readFileSync(f); ok(buf.length <= 120 * 1024 * 1024, 'zu groß');
  const sums = Object.fromEntries(fs.readFileSync(path.join(root, 'dist/SHA256.txt'), 'utf8').trim().split('\n').map(l => l.split(/\s+/).reverse()));
  eq(crypto.createHash('sha256').update(buf).digest('hex'), sums[DIST_NAME], 'SHA256 v3');
  for (const v of ['BOKU_TicTacTierernaehrung_v2.html', 'BOKU_TicTacTierernaehrung_v1.html']) if (sums[v]) eq(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', v))).digest('hex'), sums[v], 'SHA256 ' + v);
  const html = buf.toString('utf8');
  // erlaubt: die Stimmen-Begleitdateien im selben Ordner (offline per Doppelklick ladbar)
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  ok(srcs.every(u => /^BOKU_TicTacTierernaehrung_v3_stimme_(de|en)\.js$/.test(u)), 'externe Skripte gefunden: ' + srcs.join(', '));
  for (const u of srcs) { ok(fs.existsSync(path.join(root, 'dist', u)), 'Begleitdatei fehlt: ' + u); eq(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dist', u))).digest('hex'), sums[u], 'SHA256 ' + u); }
  ok(!/<link[^>]+stylesheet/.test(html), 'externe Stylesheets gefunden');
  ok(!/type="module"/.test(html), 'ES-Module funktionieren nicht über file://');
  ok(html.includes('kein offizielles Angebot der BOKU'), 'Hinweis fehlt');
});

console.log('Assets (Version 3)');
const readJ = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const has = f => fs.existsSync(path.join(root, f));
test('Figuren: alle Dateien des Verzeichnisses vorhanden (Desktop, Mobil)', () => {
  for (const prof of ['desktop', 'mobile']) {
    const idx = readJ(`assets/build/${prof}/humans/index.json`);
    ok(Object.keys(idx.humans).length >= 22, prof + ': zu wenige Figuren');
    for (const id of Object.keys(idx.humans)) ok(has(`assets/build/${prof}/humans/${id}.hpk`), `${prof}/${id}.hpk fehlt`);
    for (const k of ['crowd_f', 'crowd_m']) ok(has(`assets/build/${prof}/humans/${k}_c.ktx2`), `${prof}/${k}_c.ktx2 fehlt`);
  }
});
test('Materialien und Requisiten: Dateien vorhanden, Lizenz und Quelle je Eintrag', () => {
  for (const prof of ['desktop', 'mobile']) {
    const tx = readJ(`assets/build/${prof}/textures.json`);
    for (const [id, t] of Object.entries(tx)) { ok(t.license === 'CC0-1.0' && t.source, id + ': Lizenz/Quelle'); for (const k of ['color', 'normal', 'orm']) ok(has(`assets/build/${prof}/textures/${id}_${k}.ktx2`), `${prof}/${id}_${k}.ktx2`); }
    const pr = readJ(`assets/build/${prof}/props/index.json`);
    ok(Object.keys(pr).length >= 25, prof + ': zu wenige Requisiten');
    for (const [id, p] of Object.entries(pr)) { ok(p.license === 'CC0-1.0' && p.source && (p.authors || []).length, id + ': Lizenz/Quelle/Urheber'); ok(has(`assets/build/${prof}/props/${id}.glb`), `${prof}/${id}.glb`); }
  }
});
test('Geräusche: Dateien vorhanden, jede CC-BY-Aufnahme steht in den Credits', () => {
  const man = readJ('assets/build/sfx/manifest.json'), credits = readJ('assets/build/credits.json');
  const lines = new Set(credits.sounds.map(c => c.line));
  for (const [name, m] of Object.entries(man)) {
    for (const f of m.files) ok(has(`assets/build/sfx/${f}`), f + ' fehlt');
    for (const o of m.origin || []) { ok(o.license, name + ': Lizenz fehlt'); if (/^CC-BY/.test(o.license)) ok(lines.has(o.attribution), name + ': CC-BY-Nennung fehlt in den Credits'); }
  }
});
test('Audio-Prüfung (Spitzen, Übersteuerung, ≤ 5 synthetische UI-Töne)', () => {
  try { execFileSync(process.execPath, [path.join(root, 'tools/audio-check.mjs')], { encoding: 'utf8' }); } catch (e) { throw new Error((e.stdout || '').split('\n').filter(l => /FEHLER/.test(l)).join('; ')); }
});
test('Stimmen: jede Aufnahme im Verzeichnis existiert', () => {
  for (const lang of ['de', 'en']) { if (!has(`assets/build/voice/${lang}/manifest.json`)) continue; const m = readJ(`assets/build/voice/${lang}/manifest.json`); for (const id of Object.keys(m)) ok(has(`assets/build/voice/${lang}/${id}.ogg`), `${lang}/${id}.ogg fehlt`); }
});
if (has('dist/mobile/index.html')) test('Mobil-Build: Kern ≤ 30 MB, Web-App-Manifest gültig', () => {
  const sw = fs.readFileSync(path.join(root, 'dist/mobile/sw.js'), 'utf8'); const core = JSON.parse(/const CORE = (\[.*?\]);/s.exec(sw)[1]);
  const bytes = core.filter(f => f !== './').reduce((a, f) => a + fs.statSync(path.join(root, 'dist/mobile', f)).size, 0);
  ok(bytes <= 30 * 1048576, `Kern ${(bytes / 1048576).toFixed(1)} MB`);
  const wm = readJ('dist/mobile/manifest.webmanifest');
  ok(wm.name && wm.start_url && wm.display === 'standalone', 'Pflichtfelder');
  for (const s2 of ['192x192', '512x512']) ok(wm.icons.some(i => i.sizes === s2 && has('dist/mobile/' + i.src)), 'Symbol ' + s2);
});

if (args.includes('--e2e')) {
  console.log('Browser (headless)');
  const out = execFileSync(process.execPath, [path.join(root, 'tools/e2e.mjs'), '--steps', 'game,sim20,state', '--out', 'docs/screenshots/e2e-test'], { encoding: 'utf8', timeout: 900000 });
  test('Spiel startet ohne Konsolenfehler', () => { ok(/keine Fehler\/Warnungen/.test(out), out.split('\n').slice(-12).join('\n')); });
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) { console.log(failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
