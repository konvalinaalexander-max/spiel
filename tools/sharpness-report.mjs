// Erzeugt docs/SCHAERFE.md aus den Messungen in docs/schaerfe/*.json (tools/sharpness.mjs).
// node tools/sharpness-report.mjs [--base v2] [--labels v2,v3a]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'docs/schaerfe');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1]]); return a; }, []));
const base = args.base || 'v2';
const runs = Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); return [j.label, j]; }));
const labels = args.labels ? args.labels.split(',') : [base, ...Object.keys(runs).filter(l => l !== base).sort()];
const VIEWS = { K1: 'Leinwand aus Reihe 5 (ohne Zoom)', K2: 'Laptop-Blick (Skriptum)', K3: 'Tafel aus Reihe 5', K4: 'Leinwand mit „genau hinschauen“' };
const TARGET = { K1: 85, K2: 98, K4: 97 };
const de = (v, d = 1) => v == null ? '–' : (+v).toFixed(d).replace('.', ',');
const get = (l, v, dpr) => runs[l]?.results.find(r => r.view === v && r.dpr === dpr);

let md = `# Schärfe und Lesbarkeit (Messung)

Gemessen mit \`node tools/sharpness.mjs\` (Auftrag V3, Anhang B): feste Kameras, Viewport ${runs[labels[0]]?.viewport?.join(' × ') || '1920 × 1080'}, Stufe „Mittel“,
Gerätepixelverhältnis (DPR) 1 und 2. Der Ausschnitt wird so bewertet, wie ihn die Spielerin sieht: Renderpuffer → auf Gerätepixel
gebracht (bilinear hochskaliert, wenn der Puffer kleiner ist als der Bildschirm – genau das war in Version 2 der Fall).

- **Laplace-Varianz**: Kantenschärfe (höher = schärfer; nur innerhalb derselben Ansicht und DPR vergleichbar).
- **OCR-Trefferquote**: Anteil der Wörter (≥ 3 Zeichen) des bekannten Quelltexts (Folie bzw. Laptop-Skriptum), die tesseract.js im
  3-fach vergrößerten Ausschnitt exakt wiederfindet. Zielwerte laut Auftrag: Folie ohne Zoom ≥ 85 %, mit Zoom ≥ 97 %, Laptop ≥ 98 %.

| Ansicht | DPR | ${labels.map(l => `${l}: Pixel · Laplace · OCR`).join(' | ')} | Faktor Laplace ${labels.length > 1 ? labels[labels.length - 1] + '/' + base : ''} | Ziel OCR |
|---|---|${labels.map(() => '---|').join('')}---|---|
`;
for (const v of Object.keys(VIEWS)) for (const dpr of [1, 2]) {
  const cells = labels.map(l => { const r = get(l, v, dpr); return r ? `${r.pxW}×${r.pxH} · ${de(r.laplace, 0)} · ${r.ocr == null ? '–' : de(r.ocr) + ' %'}` : '–'; });
  const a = get(base, v, dpr), b = get(labels[labels.length - 1], v, dpr);
  const f = a && b && labels.length > 1 ? de(b.laplace / a.laplace, 2) + ' ×' : '–';
  md += `| ${VIEWS[v]} | ${dpr} | ${cells.join(' | ')} | ${f} | ${TARGET[v] ? '≥ ' + TARGET[v] + ' %' : '–'} |\n`;
}
md += `\nBilder: \`docs/schaerfe/<label>_<Ansicht>_dpr<n>.png\` (Ausschnitte in Gerätepixeln).\n`;
const extra = path.join(dir, 'NOTES.md');
if (fs.existsSync(extra)) md += '\n' + fs.readFileSync(extra, 'utf8');
fs.writeFileSync(path.join(root, 'docs/SCHAERFE.md'), md);
console.log(md);
