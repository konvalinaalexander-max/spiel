// Baut das Spiel in EINE offline-fähige HTML-Datei:
//   dist/BOKU_TicTacTierernaehrung_v2.html  +  dist/SHA256.txt
// Aufruf: npm run build   (optional: --dev für unminifizierten Build mit Sourcemap-Kommentaren)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dev = process.argv.includes('--dev');
const t0 = Date.now();

// Inhaltsdateien zu einem Modul bündeln (Abschnitte werden nach `order` sortiert)
function contentModule() {
  const dir = path.join(root, 'src/content/sections');
  const sections = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.order - b.order);
  const dialogue = JSON.parse(fs.readFileSync(path.join(root, 'src/content/dialogue.json'), 'utf8'));
  return `export const SECTIONS = ${JSON.stringify(sections)};\nexport const DIALOGUE = ${JSON.stringify(dialogue)};\n`;
}

const result = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'chrome90', 'firefox90', 'safari15'],
  minify: !dev,
  legalComments: 'none',
  write: false,
  charset: 'utf8',
  loader: { '.glsl': 'text', '.css': 'text', '.svg': 'text' },
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()), __DEV__: String(dev) },
  plugins: [{
    name: 'content',
    setup(b) {
      b.onResolve({ filter: /^virtual:content$/ }, () => ({ path: 'content', namespace: 'virtual' }));
      b.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({ contents: contentModule(), loader: 'js' }));
    }
  }],
  logLevel: 'warning'
});

const js = result.outputFiles[0].text;
// Work Sans (OFL) als eingebettete Webfont – nur Latin + Latin-Ext, drei Schnitte
const fontDir = path.join(root, 'node_modules/@fontsource/work-sans/files');
const fontFaces = [400, 600, 700].flatMap(w => ['latin', 'latin-ext'].map(sub => {
  const f = path.join(fontDir, `work-sans-${sub}-${w}-normal.woff2`);
  const range = sub === 'latin' ? 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD' : 'U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF';
  return `@font-face{font-family:'Work Sans';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2');unicode-range:${range}}`;
})).join('\n');
const css = fontFaces + '\n' + ['src/ui/tokens.css', 'src/ui/styles.css'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const third = fs.readFileSync(path.join(root, 'tools/THIRD_PARTY.txt'), 'utf8');
if (!html.includes('<!--STYLE-->') || !html.includes('<!--SCRIPT-->')) throw new Error('Template-Platzhalter fehlen');
// </script> im Bundle unschädlich machen
const safeJs = js.replace(/<\/script/gi, '<\\/script');
html = html
  .replace('<!--STYLE-->', () => `<style>\n${css}\n</style>`)
  .replace('<!--SCRIPT-->', () => `<script>\n${safeJs}\n</script>`)
  .replace('<!--LICENSES-->', () => `<!--\n${third.replace(/--/g, '- -')}\n-->`)
  .replace('<!--THIRDTEXT-->', () => third.replace(/<\//g, '<\\/'));

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/BOKU_TicTacTierernaehrung_v2.html');
fs.writeFileSync(out, html);
const hash = crypto.createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(root, 'dist/SHA256.txt'), `${hash}  BOKU_TicTacTierernaehrung_v2.html\n`);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`dist/BOKU_TicTacTierernaehrung_v2.html  ${kb} KB  (${Date.now() - t0} ms)`);
if (Buffer.byteLength(html) > 25 * 1024 * 1024) { console.error('Build größer als 25 MB!'); process.exit(1); }
