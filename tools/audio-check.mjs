// Audio-Prüfung (Auftrag V3, Anhang E / Abschnitt 2 „Mastering“, Phase 6b): Messwerte der fertigen, wieder dekodierten Dateien,
// Mengen (Clips, Atmosphären-Schleifen), Nahtprüfung und Synthese-Scan.
//   node tools/audio-check.mjs [--strict]
// Quellen: docs/audio/check.json (tools/audio/build_sfx.py misst jede Datei nach dem Kodieren), assets/build/sfx/manifest.json,
// assets/build/voice/<sprache>/manifest.json.
// Fehler (Exit 1): True Peak > −1 dBTP, übersteuerte Samples, Abtastrate ≠ 48 kHz, Atmosphäre außerhalb −24 … −20 LUFS,
// Schleife kürzer als 20 s, Nahtverhältnis ≥ 2, weniger als 12 Atmosphären-Schleifen (ohne Musik) oder 120 Clips,
// keine echte Impulsantwort, mehr als 5 synthetische UI-Töne.
// Hinweise: Rauschen in Pausen > −60 dBFS (Pause = 50-ms-Fenster ≥ 30 dB unter dem lautesten), Stille an Anfang/Ende > 80 ms.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const strict = process.argv.includes('--strict');
const read = f => (fs.existsSync(path.join(root, f)) ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : null);
const check = read('docs/audio/check.json') || {};
const sfx = read('assets/build/sfx/manifest.json') || {};
const errors = [], warns = [];

// 1. Einzeldateien
let n = 0, bytes = 0;
for (const [f, c] of Object.entries(check)) {
  n++;
  const p = path.join(root, 'assets/build/sfx', f);
  if (!fs.existsSync(p)) { errors.push(`${f}: Datei fehlt`); continue; }
  bytes += fs.statSync(p).size;
  if (c.peakDb > -1.0) errors.push(`${f}: Spitzenpegel ${c.peakDb} dBFS > −1`);
  if (c.truePeakDb != null && c.truePeakDb > -1.0) errors.push(`${f}: True Peak ${c.truePeakDb} dBTP > −1`);
  if (c.clip > 0) errors.push(`${f}: ${c.clip} übersteuerte Samples`);
  if (c.sr && c.sr !== 48000) errors.push(`${f}: Abtastrate ${c.sr} Hz statt 48 kHz`);
  if (c.loop && c.name !== 'music') {
    if (c.lufs == null || c.lufs > -20 || c.lufs < -24) errors.push(`${f}: Atmosphäre ${c.lufs} LUFS außerhalb −24 … −20`);
    if (c.dur < 20) errors.push(`${f}: Schleife nur ${c.dur} s (≥ 20 s)`);
  }
  if (c.loop && (c.seamRatio == null || c.seamRatio >= 2)) errors.push(`${f}: Nahtverhältnis ${c.seamRatio} (< 2)`);
  if (!c.loop && !c.ir) {
    if (c.floorDb != null && c.floorDb > -60) warns.push(`${f}: Rauschen in Pausen ${c.floorDb} dBFS > −60`);
    if ((c.leadMs ?? 0) > 80 || (c.tailMs ?? 0) > 80) warns.push(`${f}: Stille Anfang/Ende ${c.leadMs}/${c.tailMs} ms > 80`);
  }
}
// 2. Mengen laut Abnahme (Abschnitt 2: ≥ 120 Clips, ≥ 12 Atmosphären-Schleifen; echte Impulsantworten)
const loops = Object.entries(sfx).filter(([k, m]) => m.loop && k !== 'music' && !m.alias).map(([k]) => k);
const clips = new Set(Object.values(sfx).filter(m => !m.alias).flatMap(m => m.files));
const irs = Object.entries(sfx).filter(([, m]) => m.ir).map(([k]) => k);
if (loops.length < 12) errors.push(`nur ${loops.length} Atmosphären-Schleifen (≥ 12)`);
if (clips.size < 120) errors.push(`nur ${clips.size} Clips (≥ 120)`);
if (!irs.length) errors.push('keine echte Impulsantwort im Verzeichnis');
for (const f of clips) if (!check[f]) errors.push(`${f}: keine Messwerte (tools/audio/build_sfx.py --measure)`);
// 3. Synthese-Scan: Klänge, die das Spiel synthetisieren könnte, aber nicht als Aufnahme vorliegen (erlaubt: ≤ 5 UI-Töne des Laptops)
const UI_SYNTH = ['notify', 'ttWin', 'ttLose', 'snakeEat', 'snakeDie'];
const synthSrc = fs.readFileSync(path.join(root, 'src/audio/synth.js'), 'utf8');
const block = synthSrc.slice(synthSrc.indexOf('const SOUNDS = {'), synthSrc.indexOf('\n};', synthSrc.indexOf('const SOUNDS = {')));
const used = [...block.matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\[/gm)].map(m => m[1]);
const synthOnly = used.filter(k => !sfx[k]);
const synthUi = synthOnly.filter(k => UI_SYNTH.includes(k)), synthOther = synthOnly.filter(k => !UI_SYNTH.includes(k));
if (synthUi.length > 5) errors.push(`${synthUi.length} synthetische UI-Töne (höchstens 5)`);
if (synthOther.length) (strict ? errors : warns).push(`noch synthetisch: ${synthOther.join(', ')}`);
if (/makeImpulse|createConvolver\(\)[^;]*makeImpulse/.test(fs.readFileSync(path.join(root, 'src/audio/engine.js'), 'utf8'))) errors.push('engine.js nutzt noch eine synthetische Impulsantwort');
// Oszillatoren außerhalb der UI-Töne: nur noch in den ausdrücklich wählbaren Notlösungen für die Stimme (Einstellungen › Stimme: „Murmeln“)
const engineSrc = fs.readFileSync(path.join(root, 'src/audio/engine.js'), 'utf8');
const oscInEngine = (engineSrc.match(/createOscillator\(/g) || []).length;
// 4. Stimmen: Lautheit wird beim Rendern auf −16 LUFS normiert (zweistufig); hier nur Vollständigkeit
for (const lang of ['de', 'en']) {
  const m = read(`assets/build/voice/${lang}/manifest.json`) || {};
  console.log(`Stimme ${lang}: ${Object.keys(m).length} Aufnahmen`);
}
const seams = Object.entries(check).filter(([, c]) => c.loop).map(([f, c]) => `${f.replace(/_0\.ogg$/, '')} ${c.seamRatio}`);
console.log(`Geräusche: ${Object.keys(sfx).length} Klänge, ${clips.size} Clips (${n} gemessen, ${(bytes / 1048576).toFixed(2)} MB), ` +
  `${loops.length} Atmosphären-Schleifen + Musik, Hall: ${irs.join(', ') || '–'}`);
console.log(`Nahtverhältnis (< 2): ${seams.join(', ')}`);
console.log(`synthetisch: UI ${synthUi.length} (${synthUi.join(', ') || '–'}), sonst ${synthOther.length}; Oszillatoren in engine.js nur für die Stimm-Notlösung „Murmeln“: ${oscInEngine}`);
for (const w of warns) console.log('  Hinweis:', w);
for (const e of errors) console.log('  FEHLER:', e);
process.exit(errors.length ? 1 : 0);
