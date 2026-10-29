// Erzeugt docs/ASSETS.md: Herkunft, Lizenz und Prüfsumme aller heruntergeladenen Quellen, Zusammensetzung der Figuren,
// Stimme. node tools/pipeline/assets-doc.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const read = f => (fs.existsSync(path.join(root, f)) ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : null);
const fetched = read('assets/src/fetched.json') || {};
const sources = (read('tools/pipeline/sources.json') || {}).sources || [];
const roster = read('tools/pipeline/humans.json') || { humans: [] };
const author = frag => { const base = String(frag).split('/')[0]; if (!base.includes('_') || /^(eyebrow|eyelashes|short|long|bob|braid|ponytail|afro|shoes|teeth|tongue)\d*/.test(base)) return 'MakeHuman-Team'; const a = base.split('_')[0]; return ['high-poly', 'low-poly', 'short01', 'short02', 'short03', 'short04', 'long01', 'ponytail01', 'bob01', 'bob02', 'afro01', 'braid01', 'shoes01', 'shoes02', 'shoes03', 'shoes04', 'shoes05', 'shoes06', 'male', 'female', 'young', 'middleage', 'old', 'teeth', 'eyebrow001', 'eyelashes01', 'eyelashes02'].some(k => frag.startsWith(k)) ? 'MakeHuman-Team' : a; };

let md = `# Assets, Herkunft und Lizenzen (Version 3)

Alle Inhalte des Spiels stammen aus freien Quellen (CC0) oder sind selbst erzeugt. Rohdaten werden mit
\`npm run assets:fetch\` geladen (Prüfsummen unten, Cache in \`assets/src/\`), verarbeitet mit den Skripten in \`tools/pipeline/\`.
Weitergegeben werden nur die verarbeiteten Fassungen in \`assets/build/\` bzw. eingebettet in der HTML-Datei.
Keine Logos oder Fotos der BOKU, keine realen Personen; Prof. Haferkorn und alle Studierenden sind frei erfunden.

## Werkzeuge

| Werkzeug | Zweck | Lizenz |
|---|---|---|
| Blender 4.5 LTS | Figuren erzeugen, posieren, exportieren (ohne Oberfläche, per Skript) | GPL-3.0 (Werkzeug; erzeugte Dateien sind frei) |
| MPFB 2 (MakeHuman-Erweiterung für Blender) | parametrische Menschen, Skelett, Gewichte | GPL-3.0 (Werkzeug); erzeugte Modelle CC0 |
| Basis Universal (über \`ktx2-encoder\`) | Texturkompression KTX2 | Apache-2.0 |
| Coqui XTTS v2 | Sprachsynthese Deutsch (vorgerendert) | Coqui Public Model License (CPML): nur nicht-kommerzielle Nutzung – dieses Fan-Projekt ist nicht kommerziell |
| Kokoro-82M (hexgrad) | Sprachsynthese Englisch (vorgerendert) | Apache-2.0 |
| meshoptimizer | Detailstufen der Figuren | MIT |
| ffmpeg / libopus | Mastering, Opus-Kodierung | LGPL / BSD |

## Heruntergeladene Quellen

| Kennung | Datei | Lizenz | Urheber:in | SHA-256 (Anfang) | Größe |
|---|---|---|---|---|---|
`;
for (const s of sources) {
  const f = fetched[s.id];
  md += `| ${s.id} | \`${s.file}\` | ${s.license || f?.license || '–'} | ${s.author || f?.author || '–'} | ${f ? '`' + f.sha256.slice(0, 16) + '`' : 'noch nicht geladen'} | ${f ? (f.bytes / 1048576).toFixed(1) + ' MB' : '–'} |\n`;
}
// Rocketbox-Figuren (Microsoft Rocketbox Avatar Library, MIT) – im Spiel verwendet, sofern verpackt
const people = read('assets/build/desktop/people/index.json'), peopleCfg = read('tools/pipeline/people.json');
if (people && peopleCfg) {
  md += `
## Figuren und Bewegungen (Microsoft Rocketbox, MIT)

Alle Menschen im Spiel stammen aus der **Microsoft Rocketbox Avatar Library** (github.com/microsoft/Microsoft-Rocketbox,
MIT-Lizenz, „Copyright (c) 2020 Microsoft“; Lizenztext: \`docs/licenses/Microsoft-Rocketbox-LICENSE.md\`, im Spiel unter
„Impressum, Quellen & Lizenzen“). Die Bewegungen sind die Motion-Capture-Animationen derselben Bibliothek (Sitzen am Tisch,
Stehen, Gehen, Sprechgesten). Geladen mit \`python3 -I tools/pipeline/people-fetch.py\`, verpackt mit
\`node tools/pipeline/people.mjs\` (Skelett in Ruhepose, Atlanten KTX2, Gesichtsformen für Prof/Nachbarin/Tutorin, Animationen
als Int16-Differenzen). Haarkarten: Normalen nach außen gekämmt, Deckung beim Verkleinern erhalten (\`tools/pipeline/hair.mjs\`).

| Rolle | Figur | Gesichtsformen |
|---|---|---|
`;
  for (const [id, h] of Object.entries(peopleCfg.heroes)) md += `| ${id} (${h.role}) | ${h.avatar} | ${h.facial ? 'ja (Visemes, Blinzeln, Brauen)' : '–'} |\n`;
  md += `| Studierende (weiblich) | ${peopleCfg.crowd.f.join(', ')} | – |\n| Studierende (männlich) | ${peopleCfg.crowd.m.join(', ')} | – |\n`;
  md += `\nAnimationen (Rocketbox, je männlich/weiblich): ${Object.entries(peopleCfg.clips.common).map(([k, v]) => `${k} (\`${v.replace(/^.*:/, '')}\`)`).join(', ')}.\n`;
  md += `Prof zusätzlich: ${Object.entries(peopleCfg.clips.prof).map(([k, v]) => `${k} (\`${v}\`)`).join(', ')}.\n`;
  md += `\nDie älteren MakeHuman/MPFB-Figuren (unten) bleiben als Rückfallebene im Werkzeug (\`node tools/build.mjs --old-humans\`), werden aber nicht mehr eingebettet.\n`;
}
md += `
## Figuren (MakeHuman-Assetpakete, CC0)

Alle Figuren werden mit \`node tools/pipeline/humans.mjs\` aus \`tools/pipeline/humans.json\` erzeugt (Blender + MPFB) und mit
\`node tools/pipeline/humans-pack.mjs\` verpackt. Die Assetpakete der MakeHuman Community sind ausdrücklich CC0
(Dateinamen \`*_cc0.zip\`); die Urheber:innen sind am Präfix der Asset-Namen erkennbar und werden hier trotzdem genannt.

| Figur | Rolle | Haut | Haar | Kleidung | Zubehör |
|---|---|---|---|---|---|
`;
for (const h of roster.humans) {
  const b = f => (f ? path.basename(path.dirname(f)) : '–');
  md += `| ${h.id} | ${h.role || 'Studierende'} | ${b(h.skin)} | ${b(h.hair)}${h.hairMaterial ? ' (' + path.dirname(h.hairMaterial) + ')' : ''} | ${(h.clothes || []).map(b).join(', ')} | ${(h.accessories || []).map(b).join(', ') || '–'} |\n`;
}
const authors = new Set();
for (const h of roster.humans) for (const f of [h.skin, h.hair, h.hairMaterial, h.eyebrows, ...(h.clothes || []), ...(h.accessories || [])]) if (f) authors.add(author(f));
md += `\nUrheber:innen der verwendeten Assets (laut Paket): ${[...authors].sort().join(', ')}.\n`;
md += `
## Stimme

Stufe 2 laut Auftrag (offenes Modell, kein API-Schlüssel vorhanden): **Coqui XTTS v2** mit eingebauten, synthetischen
Studiosprechern – keine geklonte reale Person. Auswahl nach Prüfsätzen (Rückerkennung mit Whisper, Signalqualität mit SQUIM),
Details in \`docs/AUDIO.md\`. Deutsch (XTTS): Prof. Haferkorn „Damien Black“, Nachbarin „Daisy Studious“,
Studierende „Sofia Hellen“ / „Andrew Chipper“; Lizenz der Modellausgabe CPML, nicht-kommerziell. Englisch (Kokoro-82M, Apache-2.0):
Prof „bm_daniel“, Nachbarin „bf_emma“, Studierende „af_heart“ / „am_michael“.
Mit einem Azure-Schlüssel (\`AZURE_SPEECH_KEY\`, \`AZURE_SPEECH_REGION\`) kann die Stimme gegen „de-AT-JonasNeural“
(österreichisches Deutsch) ausgetauscht werden.
`;
// Requisiten (Phase 5): Poly Haven, CC0
const props = read('assets/build/desktop/props/index.json') || {};
const textures = read('assets/build/desktop/textures.json') || {};
if (Object.keys(textures).length) {
  md += `\n## Materialien (ambientCG, CC0)\n\nVerarbeitet mit \`tools/pipeline/textures.mjs\` (KTX2: Farbe ETC1S, Normalen UASTC, ORM).\n\n| Material | Verwendung | Quelle |\n|---|---|---|\n`;
  for (const [id, t] of Object.entries(textures)) md += `| ${id} | ${t.use} | ${t.source} |\n`;
}
if (Object.keys(props).length) {
  md += `\n## Requisiten (Poly Haven, CC0)\n\nVerarbeitet mit \`tools/pipeline/props.mjs\` (vereinfacht, KTX2, Meshopt).\n\n| Modell | Verwendung | Urheber:in | Dreiecke | Quelle |\n|---|---|---|---|---|\n`;
  for (const p of Object.values(props)) md += `| ${p.name} | ${p.use} | ${(p.authors || []).join(', ')} | ${p.tris} | ${p.source} |\n`;
}
// Geräusche (Phase 6b): Herkunft je Aufnahme aus assets/build/sfx/manifest.json
const sfx = read('assets/build/sfx/manifest.json') || {};
const sounds = new Map();
for (const [name, m] of Object.entries(sfx)) for (const o of m.origin || []) {
  const key = o.attribution || `${o.source} (${o.license})`;
  if (!sounds.has(key)) sounds.set(key, { names: new Set(), license: o.license, author: o.author, source: o.source });
  sounds.get(key).names.add(name);
}
if (sounds.size) {
  md += `\n## Geräusche, Musik und Hall (echte Aufnahmen)\n\nAufbereitet mit \`tools/audio/build_sfx.py\` aus den Kandidaten in \`tools/pipeline/audio_sources.json\`
(geladen und geprüft mit \`tools/audio/fetch_sfx.py\`, Prüfsummen dort; Recherche: \`docs/AUDIO_QUELLEN.md\`, Übersicht und Clipliste: \`docs/AUDIO.md\`).
Der Hall (\`irFront\`, \`irBack\`) stammt aus echten Impulsantworten eines Hörsaals (TU Berlin, Auditorium 3; \`tools/audio/extract_ir.py\`).
CC-BY-Aufnahmen sind im Spiel unter „Impressum, Quellen & Lizenzen“ genannt.\n\n| Klang | Lizenz | Herkunft |\n|---|---|---|\n`;
  for (const [k, v] of sounds) md += `| ${[...v.names].join(', ')} | ${v.license} | ${k.replace(/\|/g, '/')} |\n`;
}
fs.writeFileSync(path.join(root, 'docs/ASSETS.md'), md);
// Nennungen für die Credits-Seite im Spiel
const rbLicense = fs.existsSync(path.join(root, 'docs/licenses/Microsoft-Rocketbox-LICENSE.md')) ? fs.readFileSync(path.join(root, 'docs/licenses/Microsoft-Rocketbox-LICENSE.md'), 'utf8').trim() : '';
const credits = {
  figures: people && peopleCfg ? [...new Set([...Object.values(peopleCfg.heroes).map(h => h.avatar), ...peopleCfg.crowd.f, ...peopleCfg.crowd.m])].sort() : [...authors].sort(),
  figuresSource: people && peopleCfg ? 'rocketbox' : 'makehuman',
  figuresLicense: people && peopleCfg ? rbLicense : '',
  voices: { de: 'Coqui XTTS v2 (CPML, nicht-kommerziell): Damien Black, Daisy Studious, Sofia Hellen, Andrew Chipper – synthetische Studiosprecher',
    en: 'Kokoro-82M by hexgrad (Apache-2.0): bm_daniel, bf_emma, af_heart, am_michael – synthetic voices' },
  models: [...new Set(Object.values(props).flatMap(p => p.authors || []))].sort(),
  sounds: [...sounds.entries()].map(([k, v]) => ({ line: k, license: v.license, names: [...v.names] })).sort((a, b) => a.line.localeCompare(b.line))
};
fs.mkdirSync(path.join(root, 'assets/build'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/build/credits.json'), JSON.stringify(credits, null, 1));
console.log('docs/ASSETS.md geschrieben');
