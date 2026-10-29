// Schreibt die Tabellen der Klangwelt in docs/AUDIO.md (zwischen den Markierungen <!-- …:start --> / <!-- …:end -->):
// Atmosphären mit Nahtprüfung, Hall (Impulsantworten), vollständige Clipliste mit Quelle und Lizenz.
//   node tools/audio/audio-doc.mjs        (nach tools/audio/build_sfx.py)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const man = read('assets/build/sfx/manifest.json'), check = read('docs/audio/check.json');
const doc = path.join(root, 'docs/AUDIO.md');
const num = (v, d = 1) => (v == null ? '–' : Number(v).toFixed(d).replace('.', ',').replace('-', '−'));
const kb = f => Math.round(fs.statSync(path.join(root, 'assets/build/sfx', f)).size / 1024);
const lic = l => ({ 'CC0-1.0': 'CC0', 'PDM-1.0': 'Public Domain Mark', 'Public-Domain': 'Public Domain', 'CC-BY-4.0': 'CC BY 4.0', 'CC-BY-3.0': 'CC BY 3.0' }[l] || l);

// Verwendung im Spiel (src/game/game.js, src/audio/engine.js, src/laptop/os.js, src/main.js)
const USE = {
  chalkTap: 'Prof: Kreide-Tupfer synchron zum Strich (auch Klopfen an der Vordertür)', chalkScratch: 'Prof: Kreidestrich an der Tafel (Ende = Prof dreht sich um)',
  sponge: 'Prof wischt die Tafel', boardSlide: 'Tafel schieben; Jalousie', clicker: 'Folienwechsel, Beamer ein/aus', micThump: 'Mikrofon beim Start',
  micFeedback: 'Ereignis Rückkopplung', glass: 'Prof trinkt', pour: '(Vorrat, derzeit ohne Ereignis)', throatClear: 'Prof bei Abschnittswechsel; Saal',
  stepParquet: 'Schritte des Profs auf Podest/Parkett', stepStair: 'Schritte auf den Stufen (Prof, Spätkommer:in)', stepCarpet: '(Vorrat, derzeit ohne Ereignis)',
  cough: 'Saal (zufällig), Hustenanfall', coughHigh: 'Hustenanfall (helle Stimme)', sneeze: 'Saal (zufällig, Vorlesung/Pause)', yawn: 'Saal (Vorlesung)',
  chairCreak: 'Saal; eigener Sitz bei schnellem Umdrehen', seatFlip: 'Saal (Klappsitz), Ankommen', pageTurn: 'Saal; Anwesenheitsliste; Spickzettel im Quiz',
  penClick: 'Saal', penWrite: 'Mitschreiben (Heft), Unterschrift; Saal', highlighter: 'Saal (Textmarker)', paperTear: 'Saal (Zettel abreißen)',
  zipper: 'Saal; Studierende verlassen den Saal', cloth: 'Saal; eigene Bewegung, Kopfhörer', bag: 'Rucksack/Tasche: Ankommen, Pause, Gehen',
  cupDown: 'Becher abstellen (Saal, Pause)', cutlery: 'Besteck (Pause, Jause am Platz)', appleBite: 'Apfel/Knabbern (Pause)', shush: '„Pscht“ im Saal (selten)',
  keyClick: 'eigenes Tippen am Laptop, Alt-Tab, Helligkeit', touchpad: 'Touchpad/Laptop-Klicks', hinge: 'Laptopdeckel bewegen; Saal (Ankommen)',
  lidClose: 'Laptop zuklappen (Saal: Ankommen/Pause)', phoneRing: 'Ereignis Handy klingelt', phoneVibrate: 'eigenes Handy vibriert; Saal (selten)',
  bottleDrop: 'Ereignis Flasche fällt', doorOpen: 'Spätkommer:in, Tutorin (öffnet kurz den Gang); Klopfen (schneller abgespielt)', doorClose: 'Spätkommer:in', doorBang: 'Ereignis Tür knallt',
  tramBell: 'Straßenbahn hält am Linnéplatz', bird: 'Vögel bei Sonne (einzeln), Menü', laughSoft: 'einzelne Lacher (Pointe, Pause)',
  laughSmall: 'Gruppen-Lacher leise (Pointe des Profs)', laughMid: 'Gruppen-Lacher mittel', laughBig: 'Gruppen-Lacher laut', murmurBurst: '(Vorrat)',
  breath: 'Atem bei Stress ≥ 0,7', heart: 'Herzschlag bei Stress ≥ 0,45', sting: 'Erwischt; falsche Quizantwort', quizSting: 'Quiz kündigt sich an', good: 'richtige Quizantwort',
  uiClick: 'Menü-Klicks (= Touchpad-Aufnahme)', ttPlace: 'Tic-Tac-Toe-Feld setzen (= Tastenanschlag)', music: 'Menü-Musik',
  irFront: 'Hall, Plätze vorne', irBack: 'Hall, Plätze hinten'
};
const LOOPUSE = {
  ventilation: 'immer (0,05)', roomTone: 'immer (0,1)', murmur: 'vor Beginn 0,55, Einleitung 0,15, Ende 0,45', murmurQuiet: 'Vorlesung 0,24–0,26',
  murmurBreak: 'Pause 0,9', keyboards: 'Vorlesung 0,15, Pause 0,05', corridor: 'hinter der Tür 0,14 (Pause/Ankommen 0,32), Tür auf: ×3 und hell',
  traffic: 'Fenster 0,3 (Regen 0,2)', streetFar: 'fern 0,24 (Regen 0,16)', wind: 'nicht bei Sonne (0,12)', birds: 'Sonne 0,26, bewölkt 0,12, nicht bei Regen',
  rain: 'Regenwetter / Regen setzt ein (0,42)', rainHeavy: 'bei Regen alle 20–50 s neu: 0 … 0,45', projectorFan: 'sobald der Beamer läuft (0,25, am Projektor)', music: 'nur Menüs'
};
const DESC = {
  ventilation: 'Lüfter (Innenraum)', roomTone: 'Bibliothek, Ruheraum: Lüftung + leise Aktivität', murmur: 'Publikum vor Beginn (dicht)', murmurQuiet: 'gedämpftes Ankommen in einer Kirche: Flüstern, Schritte, Kleidung',
  murmurBreak: 'Uni-Cafeteria, laut und dicht', keyboards: 'Tastaturen aus 6 „Reihen“ (6 Aufnahmen geschichtet)', corridor: 'Stiegenhaus/Gang, KHM Wien', traffic: 'Straße, Wien Landstraße',
  streetFar: 'Straße mit Bim von innen gehört, Wien 7', wind: 'Wind im Park', birds: 'Herbstvögel (Freising, November)', rain: 'leichter Regen am Fenster', rainHeavy: 'kräftiger Regen am Fenster',
  projectorFan: 'Lüfter eines Kinoprojektors', music: '„Almost Bliss“ (Kevin MacLeod)'
};
const srcLine = o => `${o.author || '–'} – [${(o.source || '').replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 60)}](${o.source}) (${lic(o.license)})`;
const uniq = arr => [...new Map(arr.map(o => [o.source + '|' + o.author + '|' + o.license, o])).values()];

let atmo = '| Schleife | Inhalt | Länge | Lautheit | True Peak | Nahtverhältnis | Naht-Pegelsprung | Größe | Pegel im Spiel | Quelle |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const [n, m] of Object.entries(man).filter(([, m]) => m.loop).sort((a, b) => (a[0] === 'music') - (b[0] === 'music') || a[0].localeCompare(b[0]))) {
  const f = m.files[0], c = check[f] || {};
  atmo += `| \`${n}\` | ${DESC[n] || ''} | ${num(c.dur, 0)} s | ${num(c.lufs)} LUFS | ${num(c.truePeakDb)} dBTP | ${num(c.seamRatio, 2)} ${c.seamRatio < 2 ? '✓' : '✗'} | ${num(c.seamDb, 1)} dB (Streuung ${num(c.levelSpreadDb, 1)}) | ${kb(f)} KB | ${LOOPUSE[n] || ''} | ${uniq(m.origin).map(srcLine).join('; ')} |\n`;
}
let ir = '| Impulsantwort | Position | Länge | T30 (aus der Datei) | Pegelfaktor | Datei |\n|---|---|---|---|---|---|\n';
for (const n of ['irFront', 'irBack']) {
  const m = man[n]; if (!m) continue;
  ir += `| \`${n}\` | ${n === 'irFront' ? 'Lautsprecher 4, 1,50 m vor dem Kunstkopf (wie ein Platz vorne)' : 'Lautsprecher 2, 5,49 m vom Kunstkopf (wie ein Platz weiter hinten)'} | ${num(m.lenS, 2)} s | ${num(m.t30, 2)} s | ${num(m.gain, 4)} | \`${m.files[0]}\` (${kb(m.files[0])} KB) |\n`;
}
let clips = '| Klang | Dateien | Verwendung im Spiel | Herkunft (Urheber:in – Seite, Lizenz) |\n|---|---|---|---|\n';
let nClips = 0;
for (const [n, m] of Object.entries(man).sort((a, b) => a[0].localeCompare(b[0]))) {
  if (m.loop || m.ir) continue;
  nClips += m.alias ? 0 : m.files.length;
  const how = m.alias ? `= Aufnahmen von \`${m.alias}\`` : m.origin.some(o => o.derived) ? 'abgeleitet: ' : '';
  const layered = ['laughSmall', 'laughMid', 'laughBig'].includes(n) ? 'geschichtet aus ' : '';
  clips += `| \`${n}\` | ${m.alias ? '–' : m.files.length} | ${USE[n] || ''} | ${how}${layered}${m.alias ? '' : uniq(m.origin).map(srcLine).join('; ')} |\n`;
}
const total = new Set(Object.values(man).filter(m => !m.alias).flatMap(m => m.files));
const bytes = [...total].reduce((a, f) => a + fs.statSync(path.join(root, 'assets/build/sfx', f)).size, 0);
const loops = Object.entries(man).filter(([k, m]) => m.loop && k !== 'music').length;
const sum = `**${total.size} Dateien** (${nClips} Einmal-Klänge, ${loops} Atmosphären-Schleifen + Menü-Musik, 2 Impulsantworten), ${Object.keys(man).length} Klangnamen, ${(bytes / 1048576).toFixed(2).replace('.', ',')} MB (Opus).`;

let md = fs.readFileSync(doc, 'utf8');
const put = (key, body) => {
  const a = `<!-- ${key}:start -->`, b = `<!-- ${key}:end -->`;
  if (!md.includes(a)) throw new Error('Markierung fehlt in docs/AUDIO.md: ' + a);
  md = md.slice(0, md.indexOf(a) + a.length) + '\n' + body.trim() + '\n' + md.slice(md.indexOf(b));
};
put('summary', sum); put('atmo', atmo); put('ir', ir); put('clips', clips);
fs.writeFileSync(doc, md);
console.log('docs/AUDIO.md: Tabellen aktualisiert –', sum.replace(/\*/g, ''));
