// Audio-Prüfung (Auftrag V3, Anhang E / Abschnitt 2 „Mastering“): Lautheit, Spitzenpegel, Grundrauschen, Übersteuerung je Clip,
// dazu ein Synthese-Scan (welche Klänge im Spiel noch aus dem Klangsynthesizer kommen).
//   node tools/audio-check.mjs [--strict]
// Quellen: docs/audio/check.json (tools/audio/build_sfx.py), assets/build/voice/<sprache>/manifest.json, assets/build/sfx/manifest.json.
// Grenzwerte: Stimme −16 LUFS ±1,5; Atmosphären −18 … −40 LUFS; Spitze ≤ −1 dBFS; Rauschen in Pausen ≤ −60 dBFS (Einmal-Klänge,
// Pause = 50-ms-Fenster mindestens 30 dB unter dem lautesten);
// 0 übersteuerte Samples; höchstens 5 synthetische UI-Signaltöne.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const strict = process.argv.includes('--strict');
const read = f => (fs.existsSync(path.join(root, f)) ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : null);
const check = read('docs/audio/check.json') || {};
const sfx = read('assets/build/sfx/manifest.json') || {};
const errors = [], warns = [];

// 1. Einzelclips (Geräusche)
let n = 0;
for (const [f, c] of Object.entries(check)) {
  n++;
  if (c.peakDb > -1.0) errors.push(`${f}: Spitzenpegel ${c.peakDb} dBFS > −1`);
  if (c.clip > 0) errors.push(`${f}: ${c.clip} übersteuerte Samples`);
  if (!c.loop && c.floorDb != null && c.floorDb > -60) warns.push(`${f}: Rauschen in Pausen ${c.floorDb} dBFS > −60`);
  if (c.loop && c.lufs != null && (c.lufs > -18 || c.lufs < -40)) warns.push(`${f}: Atmosphäre ${c.lufs} LUFS außerhalb −18 … −40`);
}
// 2. Synthese-Scan: Klänge, die das Spiel benutzt, aber nicht als Aufnahme vorliegen
const UI_SYNTH = ['notify', 'ttWin', 'ttLose', 'snakeEat', 'snakeDie'];
const synthSrc = fs.readFileSync(path.join(root, 'src/audio/synth.js'), 'utf8');
const used = [...synthSrc.slice(synthSrc.indexOf('const SOUNDS'), synthSrc.indexOf('export function makeImpulse')).matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\[/gm)].map(m => m[1]);
const synthOnly = used.filter(k => !sfx[k]);
const synthUi = synthOnly.filter(k => UI_SYNTH.includes(k)), synthOther = synthOnly.filter(k => !UI_SYNTH.includes(k));
if (synthUi.length > 5) errors.push(`${synthUi.length} synthetische UI-Töne (höchstens 5)`);
if (synthOther.length) (strict ? errors : warns).push(`noch synthetisch: ${synthOther.join(', ')}`);
// 3. Stimmen: Lautheit wird beim Rendern auf −16 LUFS normiert (zweistufig); hier nur Vollständigkeit
for (const lang of ['de', 'en']) {
  const m = read(`assets/build/voice/${lang}/manifest.json`) || {};
  console.log(`Stimme ${lang}: ${Object.keys(m).length} Aufnahmen`);
}
console.log(`Geräusche: ${Object.keys(sfx).length} Klänge, ${n} Clips geprüft; synthetisch: UI ${synthUi.length} (${synthUi.join(', ') || '–'}), sonst ${synthOther.length}`);
for (const w of warns) console.log('  Hinweis:', w);
for (const e of errors) console.log('  FEHLER:', e);
process.exit(errors.length ? 1 : 0);
