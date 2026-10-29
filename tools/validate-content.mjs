// Prüft alle Inhaltsdateien gegen docs/CONTENT_SCHEMA.md.
// Aufruf: node tools/validate-content.mjs [--sections-only | --dialogue-only]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];
const warn = [];
const err = (f, m) => errors.push(`${f}: ${m}`);

const BOARD_OK = /^[A-Za-z0-9äöüÄÖÜß .,:;!?()[\]/+\-=%'"<>*_^{}→←↑↓×·−≈≤≥°µΣΔ~]*$/;
const DIAGRAMS = new Set(['flow', 'stack', 'bars', 'cascade', 'line', 'table', 'stomach', 'barrel', 'cycle', 'pie']);
const LOOKS = new Set(['class', 'board', 'screen', 'notes', 'window', 'student']);
const GESTURES = new Set(['explain', 'count', 'question', 'emphasis', 'open', 'point', 'shrug', 'pocket', 'glasses']);
const args = process.argv.slice(2);
let sentencesDe = 0;

function checkLang(f, L, lang) {
  const p = `${lang}`;
  if (!L || typeof L !== 'object') return err(f, `${p} fehlt`);
  for (const k of ['title', 'subtitle', 'learningGoals', 'slides', 'board', 'beats', 'quiz', 'calc', 'notes', 'script'])
    if (!(k in L)) err(f, `${p}.${k} fehlt`);
  if (!Array.isArray(L.learningGoals) || L.learningGoals.length < 2 || L.learningGoals.length > 4) err(f, `${p}.learningGoals: 2–4 erwartet`);
  (L.learningGoals || []).forEach((g, i) => g.length > 100 && err(f, `${p}.learningGoals[${i}] > 100 Zeichen`));
  if (!Array.isArray(L.slides) || L.slides.length < 1 || L.slides.length > 2) err(f, `${p}.slides: 1–2 erwartet`);
  (L.slides || []).forEach((s, i) => {
    if (!s.title) err(f, `${p}.slides[${i}].title fehlt`);
    if (!Array.isArray(s.bullets) || s.bullets.length < 3 || s.bullets.length > 6) err(f, `${p}.slides[${i}].bullets: 3–6`);
    (s.bullets || []).forEach((b, j) => b.length > 70 && err(f, `${p}.slides[${i}].bullets[${j}] > 70 Zeichen (${b.length})`));
    if (!s.diagram || !DIAGRAMS.has(s.diagram.type)) err(f, `${p}.slides[${i}].diagram.type ungültig`);
    else checkDiagram(f, `${p}.slides[${i}].diagram`, s.diagram);
    if (!s.source) warn.push(`${f}: ${p}.slides[${i}].source fehlt`);
  });
  const boardIds = new Set();
  if (!Array.isArray(L.board) || L.board.length < 2 || L.board.length > 3) err(f, `${p}.board: 2–3 Blöcke`);
  (L.board || []).forEach((b, i) => {
    if (!b.id) err(f, `${p}.board[${i}].id fehlt`);
    boardIds.add(b.id);
    if (!Array.isArray(b.lines) || b.lines.length < 2 || b.lines.length > 5) err(f, `${p}.board[${i}].lines: 2–5`);
    (b.lines || []).forEach((l, j) => {
      const plain = l.replace(/[\^_]\{([^}]*)\}/g, '$1');
      if (plain.length > 30) err(f, `${p}.board[${i}].lines[${j}] > 30 Zeichen: "${l}"`);
      if (!BOARD_OK.test(l)) err(f, `${p}.board[${i}].lines[${j}] unerlaubtes Zeichen: "${l}"`);
    });
  });
  if (!Array.isArray(L.beats) || L.beats.length < 8 || L.beats.length > 10) err(f, `${p}.beats: 8–10 erwartet (${(L.beats || []).length})`);
  const used = new Set();
  (L.beats || []).forEach((b, i) => {
    if (!Array.isArray(b.variants) || b.variants.length !== 3) err(f, `${p}.beats[${i}].variants: genau 3`);
    (b.variants || []).forEach((v, j) => {
      if (typeof v !== 'string' || !v.trim()) err(f, `${p}.beats[${i}].variants[${j}] leer`);
      else if (v.length > 220) err(f, `${p}.beats[${i}].variants[${j}] > 220 Zeichen (${v.length})`);
      if (lang === 'de') sentencesDe += Math.max(1, (v.match(/[.!?…](\s|$)/g) || []).length);
    });
    if (i === 0 && b.slide !== 0) err(f, `${p}.beats[0].slide muss 0 sein`);
    if (b.slide !== null && b.slide !== undefined && !(b.slide >= 0 && b.slide < (L.slides || []).length)) err(f, `${p}.beats[${i}].slide ungültig`);
    if (b.board) { if (!boardIds.has(b.board)) err(f, `${p}.beats[${i}].board "${b.board}" unbekannt`); if (used.has(b.board)) err(f, `${p}: Tafelblock ${b.board} doppelt`); used.add(b.board); }
    if (!LOOKS.has(b.look)) err(f, `${p}.beats[${i}].look ungültig: ${b.look}`);
    if (!GESTURES.has(b.gesture)) err(f, `${p}.beats[${i}].gesture ungültig: ${b.gesture}`);
    if (typeof b.pause !== 'number' || b.pause < 0.3 || b.pause > 1.5) err(f, `${p}.beats[${i}].pause 0.3–1.5`);
  });
  for (const id of boardIds) if (!used.has(id)) err(f, `${p}: Tafelblock ${id} wird von keinem Beat verwendet`);
  if (!Array.isArray(L.quiz) || L.quiz.length !== 3) err(f, `${p}.quiz: genau 3`);
  if ((L.quiz || []).filter(q => q.calc === true).length !== 1) err(f, `${p}.quiz: genau 1 mit calc:true`);
  (L.quiz || []).forEach((q, i) => {
    if (!q.q || !q.correct || !q.explain) err(f, `${p}.quiz[${i}] unvollständig`);
    if (!Array.isArray(q.wrong) || q.wrong.length !== 3) err(f, `${p}.quiz[${i}].wrong: genau 3`);
    [q.correct, ...(q.wrong || [])].forEach(a => a && a.length > 60 && err(f, `${p}.quiz[${i}] Antwort > 60 Zeichen: "${a}"`));
    if ((q.wrong || []).includes(q.correct)) err(f, `${p}.quiz[${i}] correct ist auch in wrong`);
  });
  const c = L.calc || {};
  if (!c.title || !c.given || !Array.isArray(c.steps) || !c.result) err(f, `${p}.calc unvollständig`);
  (c.steps || []).forEach((s, j) => {
    const plain = s.replace(/[\^_]\{([^}]*)\}/g, '$1');
    if (plain.length > 30) err(f, `${p}.calc.steps[${j}] > 30 Zeichen: "${s}"`);
    if (!BOARD_OK.test(s)) err(f, `${p}.calc.steps[${j}] unerlaubtes Zeichen: "${s}"`);
  });
  if ((c.steps || []).length > 5) err(f, `${p}.calc.steps > 5`);
  if (!Array.isArray(L.notes) || L.notes.length < 4 || L.notes.length > 6) err(f, `${p}.notes: 4–6`);
  (L.notes || []).forEach((n, j) => n.length > 45 && err(f, `${p}.notes[${j}] > 45 Zeichen`));
  const words = (L.script || '').split(/\s+/).filter(Boolean).length;
  if (words < 150 || words > 260) err(f, `${p}.script: 150–250 Wörter (${words})`);
}
function checkDiagram(f, p, d) {
  const lbl = (s, w) => typeof s === 'string' && s.length > 18 && err(f, `${p}: Label > 18 Zeichen "${s}" (${w})`);
  const lim = (arr, n, w) => Array.isArray(arr) ? (arr.length > n && err(f, `${p}.${w} > ${n} Einträge`)) : err(f, `${p}.${w} fehlt`);
  switch (d.type) {
    case 'flow': case 'cycle': lim(d.items, 8, 'items'); (d.items || []).forEach(x => lbl(x, 'items')); break;
    case 'stack': case 'pie': lim(d.parts, 8, 'parts'); (d.parts || []).forEach(x => { lbl(x.label, 'parts'); if (typeof x.value !== 'number') err(f, `${p}.parts value`); }); break;
    case 'bars': lim(d.items, 8, 'items'); (d.items || []).forEach(x => { lbl(x.label, 'items'); if (typeof x.value !== 'number') err(f, `${p}.items value`); }); break;
    case 'cascade': lim(d.levels, 6, 'levels'); (d.levels || []).forEach(x => lbl(x.label, 'levels')); break;
    case 'line': if (!Array.isArray(d.x) || !Array.isArray(d.y) || d.x.length !== d.y.length) err(f, `${p}: x/y ungleich`); break;
    case 'table': if (!Array.isArray(d.head) || d.head.length > 4) err(f, `${p}.head max 4`); lim(d.rows, 6, 'rows'); (d.rows || []).forEach(r => r.length !== (d.head || []).length && err(f, `${p}: Zeilenlänge ≠ Kopf`)); break;
    case 'stomach': if (!['pansen', 'netzmagen', 'blaettermagen', 'labmagen'].includes(d.highlight)) err(f, `${p}.highlight`); break;
    case 'barrel': lim(d.staves, 8, 'staves'); (d.staves || []).forEach(x => { lbl(x.label, 'staves'); if (!(x.value >= 0 && x.value <= 1)) err(f, `${p}.staves value 0–1`); }); break;
  }
}
function sameShape(f, a, b, p = '') {
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return err(f, `de/en ungleich bei ${p} (${a.length} vs ${Array.isArray(b) ? b.length : typeof b})`);
    a.forEach((x, i) => sameShape(f, x, b[i], `${p}[${i}]`));
  } else if (a && typeof a === 'object') {
    for (const k of Object.keys(a)) { if (!(k in (b || {}))) err(f, `en fehlt ${p}.${k}`); else sameShape(f, a[k], b[k], `${p}.${k}`); }
  }
}

if (!args.includes('--dialogue-only')) {
  const dir = path.join(root, 'src/content/sections');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort() : [];
  let core = 0, quiz = 0, calc = 0;
  for (const file of files) {
    const f = 'sections/' + file;
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { err(f, 'JSON-Fehler: ' + e.message); continue; }
    if (!j.id || typeof j.order !== 'number' || typeof j.core !== 'boolean' || typeof j.plannedMinutes !== 'number') err(f, 'id/order/core/plannedMinutes');
    if (j.core) core++;
    checkLang(f, j.de, 'de'); checkLang(f, j.en, 'en'); sameShape(f, j.de, j.en, 'de');
    quiz += (j.de?.quiz || []).length; calc += j.de?.calc ? 1 : 0;
  }
  // V3: Anekdoten/Pointen je Abschnitt (asides) – Beat-Index gültig, beide Sprachen, Art bekannt
  for (const file of files) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const [i, a] of (j.asides || []).entries()) {
      if (!(a.after >= 0 && a.after < (j.de?.beats?.length || 0))) err('sections/' + file, `asides[${i}].after außerhalb`);
      if (!a.de || !a.en) err('sections/' + file, `asides[${i}] ohne de/en`);
      if (!['anecdote', 'pointe', 'frage'].includes(a.kind)) err('sections/' + file, `asides[${i}].kind unbekannt: ${a.kind}`);
    }
  }
  console.log(`Abschnitte: ${files.length}, core: ${core}, Quizfragen: ${quiz}, Rechenbeispiele: ${calc}, DE-Sätze in Beats: ${sentencesDe}`);
  if (core > 8) err('sections', `zu viele core-Abschnitte (${core})`);
}
if (!args.includes('--sections-only')) {
  const f = 'dialogue.json', p = path.join(root, 'src/content/dialogue.json');
  if (fs.existsSync(p)) {
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { err(f, 'JSON-Fehler: ' + e.message); j = null; }
    if (j) {
      const req = ['mic_check', 'projector_wait', 'greeting', 'smalltalk', 'recap', 'agenda', 'transition', 'latecomer_enter', 'latecomer_prof', 'phone_ring_prof', 'phone_ring_student', 'projector_lost', 'projector_fixing', 'projector_back', 'long_calc_intro', 'long_calc_step', 'long_calc_end', 'aisle_walk', 'aisle_return', 'attendance_start', 'attendance_neighbor', 'attendance_collect', 'direct_question_intro', 'quiz_right', 'quiz_wrong', 'quiz_timeout', 'neighbor_warn', 'neighbor_betray', 'neighbor_smalltalk', 'joke', 'drink', 'clock_check', 'break_announce', 'break_end', 'board_wipe', 'board_slide', 'mic_feedback', 'blinds', 'rain_start', 'door_bang', 'leaves_early', 'cough_fit', 'light_flicker', 'bottle_drop', 'exam_hint', 'slides_online', 'attention_hm', 'attention_lock', 'caught_1', 'caught_2', 'caught_3_kick', 'caught_3_move', 'opponent_caught', 'tutor_pass', 'closing', 'exam_info', 'chat_opponent_wait', 'chat_opponent_move', 'chat_opponent_win', 'chat_opponent_lose', 'chat_opponent_draw', 'chat_opponent_idle', 'chat_opponent_caught', 'chat_you_caught'];
      let n = 0;
      for (const lang of ['de', 'en']) {
        const L = j[lang] || {};
        for (const k of req) {
          if (!Array.isArray(L[k]) || L[k].length < 3) err(f, `${lang}.${k}: mind. 3 Varianten`);
          if (lang === 'de' && Array.isArray(L[k])) n += L[k].length;
        }
        if (Array.isArray(L.joke) && L.joke.length < 8) err(f, `${lang}.joke: mind. 8`);
        if (Array.isArray(L.exam_hint) && L.exam_hint.length < 6) err(f, `${lang}.exam_hint: mind. 6`);
        const aq = L.audience_questions;
        if (!Array.isArray(aq) || aq.length < 12) err(f, `${lang}.audience_questions: mind. 12`);
        else aq.forEach((q, i) => { if (!q.section || !q.student || !q.repeat || !Array.isArray(q.answer) || !q.answer.length) err(f, `${lang}.audience_questions[${i}] unvollständig`); if (lang === 'de') n += 2 + q.answer.length; });
      }
      // Ereignis-Pools: DE und EN sind eigene Fassungen (V3) – gleiche Schlüssel und Platzhalter, Anzahl darf abweichen (je ≥ 6).
      // Paarweise gleich aufgebaut bleiben nur die Saalfragen (Frage ↔ Antwort je Abschnitt).
      const ph = s => [...new Set(String(s).match(/\{[a-z]+\}/g) || [])].sort().join(',');
      for (const k of Object.keys(j.de)) {
        if (k === 'audience_questions') continue;
        const a = j.de[k], b = j.en?.[k];
        if (!Array.isArray(b)) { err(f, `en fehlt ${k}`); continue; }
        if (a.length < 6 || b.length < 6) err(f, `${k}: mind. 6 Varianten je Sprache (${a.length}/${b.length})`);
        const pa = [...new Set(a.map(ph))].sort().join('|'), pb = [...new Set(b.map(ph))].sort().join('|');
        if (pa !== pb) err(f, `${k}: Platzhalter de/en verschieden (${pa} / ${pb})`);
        for (const L of [a, b]) if (new Set(L).size !== L.length) err(f, `${k}: doppelte Zeile`);
      }
      for (const k of Object.keys(j.en)) if (!(k in j.de)) err(f, `de fehlt ${k}`);
      sameShape(f, j.de.audience_questions, j.en.audience_questions, 'audience_questions');
      sentencesDe += n;
      console.log(`Dialog-Zeilen (DE): ${n}`);
    }
  } else warn.push('dialogue.json fehlt noch');
}
console.log(`Gesamt DE-Sätze/Zeilen: ${sentencesDe}`);
warn.forEach(w => console.log('WARN  ' + w));
errors.forEach(e => console.log('FEHLER ' + e));
console.log(errors.length ? `${errors.length} Fehler` : 'OK – keine Fehler');
process.exit(errors.length ? 1 : 0);
