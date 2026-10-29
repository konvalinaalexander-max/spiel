// Erzeugt docs/ASSETS.md: Herkunft, Lizenz und Prüfsumme aller heruntergeladenen Quellen, Zusammensetzung der Figuren,
// Stimme. node tools/pipeline/assets-doc.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const read = f => (fs.existsSync(path.join(root, f)) ? JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')) : null);
const fetched = read('assets/src/fetched.json') || {};
const sources = (read('tools/pipeline/sources.json') || {}).sources || [];
const roster = read('tools/pipeline/humans.json') || { humans: [] };
const author = frag => { const a = String(frag).split('/')[0].split('_')[0]; return ['high-poly', 'low-poly', 'short01', 'short02', 'short03', 'short04', 'long01', 'ponytail01', 'bob01', 'bob02', 'afro01', 'braid01', 'shoes01', 'shoes02', 'shoes03', 'shoes04', 'shoes05', 'shoes06', 'male', 'female', 'young', 'middleage', 'old', 'teeth', 'eyebrow001', 'eyelashes01', 'eyelashes02'].some(k => frag.startsWith(k)) ? 'MakeHuman-Team' : a; };

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
for (const h of roster.humans) for (const f of [h.skin, h.hair, h.eyebrows, ...(h.clothes || []), ...(h.accessories || [])]) if (f) authors.add(author(f));
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
fs.writeFileSync(path.join(root, 'docs/ASSETS.md'), md);
console.log('docs/ASSETS.md geschrieben');
