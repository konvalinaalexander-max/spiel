// Baut das Spiel in EINE offline-fähige HTML-Datei:
//   dist/BOKU_TicTacTierernaehrung_v3.html  +  dist/SHA256.txt (Prüfsummen aller ausgelieferten Dateien)
// Aufruf: npm run build   (optional: --dev für unminifizierten Build mit Sourcemap-Kommentaren)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DIST, DIST_NAME, writeSums } from './dist.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dev = process.argv.includes('--dev');
// Ziel: desktop (eine HTML-Datei, alles eingebettet) oder mobile (gehosteter Ordner dist/mobile/ + PWA + ZIP)
const target = process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : 'desktop';
const mobile = target === 'mobile';
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
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()), __DEV__: String(dev), __MOBILE__: String(mobile) },
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
// Echte Figuren (Phase 4): verpackte Geometrie (HPK) + Atlanten (KTX2) + Basis-Transkodierer als eingebetteter Datenblock.
// Liegt kein verpacktes Profil vor, bleibt der Block leer und das Spiel nutzt die prozeduralen Figuren.
const profile = process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : (mobile ? 'mobile' : 'desktop');
const humDir = path.join(root, 'assets/build', profile, 'humans');
let humansBlock = '';
if (!mobile && fs.existsSync(path.join(humDir, 'index.json')) && !process.argv.includes('--no-humans')) {
  const index = JSON.parse(fs.readFileSync(path.join(humDir, 'index.json'), 'utf8'));
  const files = {};
  for (const f of fs.readdirSync(humDir)) if (/\.(hpk|ktx2)$/.test(f)) files[f] = fs.readFileSync(path.join(humDir, f)).toString('base64');
  const basis = path.join(root, 'node_modules/three/examples/jsm/libs/basis');
  humansBlock = JSON.stringify({ index, files, basis: { js: fs.readFileSync(path.join(basis, 'basis_transcoder.js')).toString('base64'), wasm: fs.readFileSync(path.join(basis, 'basis_transcoder.wasm')).toString('base64') } });
}
// Vorgerenderte Stimmen (Phase 6): assets/build/voice/<sprache>/manifest.json + <id>.ogg (Opus) → eingebetteter Block
let voiceBlock = '';
// Desktop: Stimmen als Begleitdateien je Sprache (dist/BOKU_TicTacTierernaehrung_v3_stimme_<l>.js, per <script src> auch offline
// ladbar). So bleibt die HTML-Datei unter der 100-MB-Grenze von GitHub; fehlt eine Begleitdatei, bleibt es beim Untertitel.
// --voice-inline bettet die Stimmen wie bisher direkt ein.
const voiceSidecar = !process.argv.includes('--voice-inline');
let voiceScripts = '';
if (!mobile && !process.argv.includes('--no-voice')) {
  const vb = {}; let n = 0, bytes = 0;
  for (const lang of ['de', 'en']) {
    const dir = path.join(root, 'assets/build/voice', lang), mf = path.join(dir, 'manifest.json');
    if (!fs.existsSync(mf)) continue;
    const man = JSON.parse(fs.readFileSync(mf, 'utf8')); const clips = {};
    for (const [id, m] of Object.entries(man)) {
      const f = path.join(dir, id + '.ogg'); if (!fs.existsSync(f)) continue;
      const b = fs.readFileSync(f); bytes += b.length; n++;
      clips[id] = { a: b.toString('base64'), d: m.d, e: m.e };
    }
    vb[lang] = { clips };
  }
  if (n && voiceSidecar) {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    for (const [lang, data] of Object.entries(vb)) {
      const name = DIST_NAME.replace('.html', `_stimme_${lang}.js`);
      fs.writeFileSync(path.join(root, 'dist', name), `/* Stimmen (${lang}) für ${DIST_NAME} – gehört in denselben Ordner */\n(window.__voicePacks=window.__voicePacks||{})[${JSON.stringify(lang)}]=${JSON.stringify(data)};\n`);
      voiceScripts += `<script src="${name}"></script>\n`;
    }
    console.log(`Stimmen: ${n} Aufnahmen, ${(bytes / 1048576).toFixed(1)} MB in Begleitdateien`);
  } else if (n) { voiceBlock = JSON.stringify(vb); console.log(`Stimmen: ${n} Aufnahmen, ${(bytes / 1048576).toFixed(1)} MB`); }
}
// Echte Geräusche (Phase 6b): assets/build/sfx/manifest.json + <name>_<n>.ogg → eingebetteter Block
let sfxBlock = '';
const sfxMan = path.join(root, 'assets/build/sfx/manifest.json');
if (!mobile && fs.existsSync(sfxMan) && !process.argv.includes('--no-sfx')) {
  const man = JSON.parse(fs.readFileSync(sfxMan, 'utf8')), out = {}; let n = 0, bytes = 0;
  for (const [name, m] of Object.entries(man)) {
    const files = m.files.filter(f => fs.existsSync(path.join(root, 'assets/build/sfx', f))).map(f => { const b = fs.readFileSync(path.join(root, 'assets/build/sfx', f)); bytes += b.length; n++; return b.toString('base64'); });
    if (files.length) out[name] = { loop: !!m.loop, gain: m.gain ?? 1, files };
  }
  sfxBlock = JSON.stringify(out); console.log(`Geräusche: ${Object.keys(out).length} Klänge, ${n} Aufnahmen, ${(bytes / 1048576).toFixed(1)} MB`);
}
// Echte Materialien (Phase 3): assets/build/<profil>/textures.json + KTX2 → eingebetteter Block (Transkodierer kommt aus dem Figurenblock)
let texBlock = '';
const texMan = path.join(root, 'assets/build', profile, 'textures.json');
if (!mobile && fs.existsSync(texMan) && !process.argv.includes('--no-textures')) {
  const index = JSON.parse(fs.readFileSync(texMan, 'utf8')), files = {}; let bytes = 0;
  for (const id of Object.keys(index)) for (const k of ['color', 'normal', 'orm']) {
    const f = path.join(root, 'assets/build', profile, 'textures', `${id}_${k}.ktx2`); if (!fs.existsSync(f)) continue;
    const b = fs.readFileSync(f); bytes += b.length; files[`${id}_${k}.ktx2`] = b.toString('base64');
  }
  const basis = path.join(root, 'node_modules/three/examples/jsm/libs/basis');
  texBlock = JSON.stringify({ index, files, basis: humansBlock ? null : { js: fs.readFileSync(path.join(basis, 'basis_transcoder.js')).toString('base64'), wasm: fs.readFileSync(path.join(basis, 'basis_transcoder.wasm')).toString('base64') } });
  console.log(`Materialien: ${Object.keys(index).length}, ${(bytes / 1048576).toFixed(1)} MB`);
}
// Gebackenes Licht (Phase 3): assets/build/<profil>/lightmap/index.json + uv.bin + lm_*.ktx2 → eingebetteter Block
let lightmapBlock = '';
const lmDir = path.join(root, 'assets/build', profile, 'lightmap');
if (!mobile && fs.existsSync(path.join(lmDir, 'index.json')) && !process.argv.includes('--no-lightmap')) {
  const index = JSON.parse(fs.readFileSync(path.join(lmDir, 'index.json'), 'utf8')), files = {};
  for (const f of [...index.files, 'uv.bin.gz']) files[f] = fs.readFileSync(path.join(lmDir, f)).toString('base64');
  lightmapBlock = JSON.stringify({ index, files });
}
// Echte Requisiten (Phase 5): assets/build/<profil>/props/index.json + <id>.glb → eingebetteter Block
let propsBlock = '';
const propsDir = path.join(root, 'assets/build', profile, 'props');
if (!mobile && fs.existsSync(path.join(propsDir, 'index.json')) && !process.argv.includes('--no-props')) {
  const index = JSON.parse(fs.readFileSync(path.join(propsDir, 'index.json'), 'utf8')), files = {}; let bytes = 0;
  for (const id of Object.keys(index)) { const f = path.join(propsDir, id + '.glb'); if (!fs.existsSync(f)) { delete index[id]; continue; } const b = fs.readFileSync(f); bytes += b.length; files[id + '.glb'] = b.toString('base64'); }
  propsBlock = JSON.stringify({ index, files });
  console.log(`Requisiten: ${Object.keys(index).length} Modelle, ${(bytes / 1048576).toFixed(1)} MB`);
}
const creditsFile = path.join(root, 'assets/build/credits.json');
const creditsBlock = fs.existsSync(creditsFile) ? fs.readFileSync(creditsFile, 'utf8').replace(/<\//g, '<\\/') : '';
let remoteBlock = '', headExtra = '';
if (mobile) {
  const { buildMobile } = await import('./build-mobile.mjs');
  ({ remoteBlock, headExtra } = await buildMobile({ root, humDir, profile, noVoice: process.argv.includes('--no-voice') }));
}
html = html
  .replace('<!--HEADEXTRA-->', () => headExtra)
  .replace('<!--STYLE-->', () => `<style>\n${css}\n</style>`)
  // Bundle erst nach dem ersten Bild ausführen (schneller erster Paint: Vorlader sichtbar, bevor 2 MB JS laufen)
  .replace('<!--SCRIPT-->', () => `${remoteBlock}${voiceScripts}<script type="text/plain" id="assets-humans">${humansBlock}</script>\n<script type="text/plain" id="assets-voice">${voiceBlock}</script>\n<script type="text/plain" id="assets-sfx">${sfxBlock}</script>\n<script type="text/plain" id="assets-textures">${texBlock}</script>\n<script type="text/plain" id="assets-props">${propsBlock}</script>\n<script type="text/plain" id="assets-lightmap">${lightmapBlock}</script>\n<script type="application/json" id="credits-data">${creditsBlock}</script>\n<script type="text/plain" id="bundle">\n${safeJs}\n</script>\n<script>(function(){function run(){var t=document.getElementById('bundle').textContent,s=document.createElement('script');try{s.src=URL.createObjectURL(new Blob([t],{type:'text/javascript'}));}catch(e){s.text=t;}document.body.appendChild(s);}requestAnimationFrame(function(){setTimeout(run,30);});})();</script>`)
  .replace('<!--LICENSES-->', () => `<!--\n${third.replace(/--/g, '- -')}\n-->`)
  .replace('<!--THIRDTEXT-->', () => third.replace(/<\//g, '<\\/'));

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
if (mobile) {
  const { finishMobile } = await import('./build-mobile.mjs');
  await finishMobile({ root, html, t0 });
  process.exit(0);
}
const out = path.join(root, DIST);
fs.writeFileSync(out, html);
writeSums(root);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`${DIST}  ${kb} KB  (${Date.now() - t0} ms)`);
// Auftrag V3: Ziel ≤ 80 MB, harte Grenze 120 MB
if (Buffer.byteLength(html) > 120 * 1024 * 1024) { console.error('Build größer als 120 MB!'); process.exit(1); }
if (Buffer.byteLength(html) > 80 * 1024 * 1024) console.warn('Hinweis: Build über dem Ziel von 80 MB');
