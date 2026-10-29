// Sprachkorpus (Auftrag V3, Phase 6): alle gesprochenen Sätze aus den Inhalten sammeln, nach Sprecher:in trennen,
// Platzhalter-Sätze in Stücke teilen und Kennungen vergeben, über die das Spiel die Aufnahmen findet.
//   node tools/voice/corpus.mjs  →  tools/.cache/voice/corpus.json
// Kennung = FNV-1a-32 über "<sprache>|<sprecher>|<text>" (gleiche Funktion im Spiel: src/audio/voice.js).
// Platzhalter: {row} → Zahlwort, {section} → Abschnittstitel, {minutes} → Zahl (Regie rundet auf 5 ab 10). Gesprochen wird
// „Teil vor dem Platzhalter“ · „Wert“ · „Teil danach“, jeweils als eigene Aufnahme.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export function fnv(s) { let h = 0x811c9dc5; for (const ch of s) { const c = ch.codePointAt(0); h ^= c & 0xff; h = Math.imul(h, 0x01000193) >>> 0; if (c > 0xff) { h ^= c >>> 8; h = Math.imul(h, 0x01000193) >>> 0; } } return h.toString(16).padStart(8, '0'); }

const d = JSON.parse(fs.readFileSync(path.join(root, 'src/content/dialogue.json'), 'utf8'));
const sections = fs.readdirSync(path.join(root, 'src/content/sections')).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(root, 'src/content/sections', f), 'utf8')));
const SPEAKER = { latecomer_enter: 'student', phone_ring_student: 'student', student_gras: 'student', neighbor_warn: 'neighbor', neighbor_betray: 'neighbor', neighbor_smalltalk: 'neighbor', attendance_neighbor: 'neighbor' };
const clips = new Map(); // id → { id, lang, speaker, text, kind }
const lines = [];        // { lang, speaker, key, template, parts: [ {text}|{var} ] }
const add1 = (lang, speaker, text, kind, vi = 0) => { const id = fnv(`${lang}|${speaker}|${text}`); if (!clips.has(id)) clips.set(id, { id, lang, speaker, text, kind, vi }); return id; };
// Studierende sprechen mit einer jungen Männer- oder Frauenstimme (je nach Figur) → beide Fassungen
const add = (lang, speaker, text, kind, vi = 0) => { text = text.trim(); if (!text) return null; if (speaker === 'student') { add1(lang, 'student_f', text, kind, vi); return add1(lang, 'student_m', text, kind, vi); } return add1(lang, speaker, text, kind, vi); };
const split = tpl => tpl.split(/(\{[a-z]+\})/).filter(Boolean).map(p => (/^\{[a-z]+\}$/.test(p) ? { var: p.slice(1, -1) } : { text: p }));

for (const lang of ['de', 'en']) {
  for (const [key, pool] of Object.entries(d[lang])) {
    if (key.startsWith('chat_')) continue; // Chat am Laptop: nur Text
    if (key === 'audience_questions') {
      for (const q of pool) { add(lang, 'student', q.student, 'question'); add(lang, 'prof', q.repeat, 'event'); for (const a of q.answer) add(lang, 'prof', a, 'lecture'); }
      continue;
    }
    const speaker = SPEAKER[key] || 'prof';
    for (const tpl of pool) {
      const parts = split(tpl);
      for (const p of parts) if (p.text && p.text.replace(/[\s–,.:;!?…-]/g, '')) p.id = add(lang, speaker, p.text, 'part');
      lines.push({ lang, speaker, key, template: tpl, parts });
    }
  }
  for (const s of sections) {
    const L = s[lang];
    add(lang, 'prof', L.title, 'title');
    for (const b of L.beats) b.variants.forEach((v, vi) => add(lang, 'prof', v, 'lecture', vi));
    for (const a of s.asides || []) add(lang, 'prof', a[lang], 'aside');
    for (const q of L.quiz || []) { if (q.q) add(lang, 'prof', q.q, 'question'); if (q.explain) add(lang, 'prof', q.explain, 'lecture'); }
  }
  // Werte für Platzhalter
  const num = lang === 'de' ? ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf'] : ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  for (let r = 1; r <= 12; r++) add(lang, 'prof', String(r), 'var-row');
  for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90]) add(lang, 'prof', String(m), 'var-minutes');
  void num;
}
const out = path.join(root, 'tools/.cache/voice'); fs.mkdirSync(out, { recursive: true });
const list = [...clips.values()];
fs.writeFileSync(path.join(out, 'corpus.json'), JSON.stringify({ clips: list, lines }, null, 1));
const stat = {};
for (const c of list) { const k = c.lang + ' ' + c.speaker; stat[k] = stat[k] || { n: 0, chars: 0 }; stat[k].n++; stat[k].chars += c.text.length; }
console.log(stat);
console.log('Zeilen mit Platzhaltern:', lines.filter(l => l.parts.some(p => p.var)).length);
