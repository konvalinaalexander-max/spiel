// Mobil-Build (Auftrag V3, Phase 7): gehosteter Ordner dist/mobile/ + PWA + ZIP für eigenes Hosting.
//   node tools/build.mjs --target mobile     (npm run build:mobile)
// Aufbau:
//   dist/mobile/index.html             Spiel (JS/CSS eingebettet), Assets werden per fetch geladen (#assets-remote)
//   dist/mobile/assets/humans/…        Figuren im Profil „mobile“ (HPK + KTX2 ≤ 1K)
//   dist/mobile/assets/basis/…         KTX2-Transkodierer
//   dist/mobile/assets/voice/<l>/…     Stimmen (Verzeichnis + Opus-Dateien, bei Bedarf geladen)
//   dist/mobile/manifest.webmanifest, icons/, sw.js (Precache aller Kerndateien → offline nach erstem Start)
//   dist/BOKU_TicTacTierernaehrung_v3_mobile.zip
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { MOBILE_ZIP, writeSums } from './dist.mjs';
const require = createRequire(import.meta.url);

let OUT, core = [], voiceFiles = {};
const rel = f => path.relative(OUT, f).split(path.sep).join('/');
function copy(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); return dst; }

export async function buildMobile({ root, humDir, noVoice }) {
  OUT = path.join(root, 'dist/mobile');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const remote = { basis: 'assets/basis/' };
  // Figuren
  if (fs.existsSync(path.join(humDir, 'index.json'))) {
    remote.humans = 'assets/humans/'; remote.humansFiles = {};
    for (const f of fs.readdirSync(humDir)) {
      if (!/\.(hpk|ktx2|json|bin\.gz)$/.test(f)) continue;
      const d = copy(path.join(humDir, f), path.join(OUT, 'assets/humans', f)); core.push(rel(d));
      if (f !== 'index.json') remote.humansFiles[f] = fs.statSync(d).size;
    }
  }
  const basis = path.join(root, 'node_modules/three/examples/jsm/libs/basis');
  for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) core.push(rel(copy(path.join(basis, f), path.join(OUT, 'assets/basis', f))));
  // Stimmen: schlankes Verzeichnis (Dauer + Lautstärkekurve) + Dateien; nicht im Precache (Sprache wird nach dem Start nachgeladen)
  if (!noVoice) {
    for (const lang of ['de', 'en']) {
      const dir = path.join(root, 'assets/build/voice', lang), mf = path.join(dir, 'manifest.json');
      if (!fs.existsSync(mf)) continue;
      const man = JSON.parse(fs.readFileSync(mf, 'utf8')), slim = {}; voiceFiles[lang] = [];
      for (const [id, m] of Object.entries(man)) {
        const f = path.join(dir, id + '.ogg'); if (!fs.existsSync(f)) continue;
        slim[id] = { d: m.d, e: m.e };
        voiceFiles[lang].push(rel(copy(f, path.join(OUT, 'assets/voice', lang, id + '.ogg'))));
      }
      const mo = path.join(OUT, 'assets/voice', lang, 'manifest.json');
      fs.mkdirSync(path.dirname(mo), { recursive: true }); fs.writeFileSync(mo, JSON.stringify(slim)); core.push(rel(mo));
    }
    if (Object.keys(voiceFiles).length) remote.voice = 'assets/voice/';
  }
  // Materialien (Profil mobile, ≤ 1K)
  const texDir = path.join(root, 'assets/build', 'mobile');
  if (fs.existsSync(path.join(texDir, 'textures.json'))) {
    const index = JSON.parse(fs.readFileSync(path.join(texDir, 'textures.json'), 'utf8'));
    for (const id of Object.keys(index)) for (const k of ['color', 'normal', 'orm']) {
      const f = path.join(texDir, 'textures', `${id}_${k}.ktx2`); if (fs.existsSync(f)) core.push(rel(copy(f, path.join(OUT, 'assets/textures', `${id}_${k}.ktx2`))));
    }
    core.push(rel(copy(path.join(texDir, 'textures.json'), path.join(OUT, 'assets/textures/textures.json'))));
    remote.textures = 'assets/textures/';
  }
  // Requisiten (Profil mobile)
  const propDir = path.join(root, 'assets/build/mobile/props');
  if (fs.existsSync(path.join(propDir, 'index.json'))) {
    const index = JSON.parse(fs.readFileSync(path.join(propDir, 'index.json'), 'utf8'));
    for (const id of Object.keys(index)) { const f = path.join(propDir, id + '.glb'); if (fs.existsSync(f)) core.push(rel(copy(f, path.join(OUT, 'assets/props', id + '.glb')))); else delete index[id]; }
    fs.mkdirSync(path.join(OUT, 'assets/props'), { recursive: true }); fs.writeFileSync(path.join(OUT, 'assets/props/index.json'), JSON.stringify(index)); core.push('assets/props/index.json');
    remote.props = 'assets/props/';
  }
  // gebackenes Licht: Verzeichnis, UVs und Atlanten (Kern, offline nötig)
  const lmDir = path.join(root, 'assets/build/mobile/lightmap');
  if (fs.existsSync(path.join(lmDir, 'index.json'))) {
    const index = JSON.parse(fs.readFileSync(path.join(lmDir, 'index.json'), 'utf8'));
    for (const f of ['index.json', 'uv.bin.gz', ...index.files]) core.push(rel(copy(path.join(lmDir, f), path.join(OUT, 'assets/lightmap', f))));
    remote.lightmap = 'assets/lightmap/';
  }
  // Geräusche (gehören zum Kern: ohne sie fehlt die Klangwelt)
  const sfxDir = path.join(root, 'assets/build/sfx');
  if (fs.existsSync(path.join(sfxDir, 'manifest.json'))) {
    const man = JSON.parse(fs.readFileSync(path.join(sfxDir, 'manifest.json'), 'utf8')), slim = {};
    for (const [name, m] of Object.entries(man)) {
      const files = m.files.filter(f => fs.existsSync(path.join(sfxDir, f)));
      for (const f of files) core.push(rel(copy(path.join(sfxDir, f), path.join(OUT, 'assets/sfx', f))));
      if (files.length) slim[name] = { loop: !!m.loop, gain: m.gain ?? 1, files };
    }
    fs.writeFileSync(path.join(OUT, 'assets/sfx/manifest.json'), JSON.stringify(slim)); core.push('assets/sfx/manifest.json');
    remote.sfx = 'assets/sfx/';
  }
  // Symbole (PNG aus SVG: grünes Feld mit Tic-Tac-Toe-Gitter, X und O)
  const sharp = require('sharp');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#00aa5a"/>
    <g stroke="#fff" stroke-width="22" stroke-linecap="round" fill="none"><path d="M200 112v288M312 112v288M112 200h288M112 312h288"/>
    <path d="M132 132l48 48M180 132l-48 48" stroke-width="20"/><circle cx="256" cy="256" r="30" stroke-width="20"/><path d="M332 332l48 48M380 332l-48 48" stroke-width="20"/></g></svg>`;
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
  for (const s of [192, 512]) { await sharp(Buffer.from(svg)).resize(s, s).png().toFile(path.join(OUT, `icons/icon-${s}.png`)); core.push(`icons/icon-${s}.png`); }
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(path.join(OUT, 'icons/apple-touch-icon.png')); core.push('icons/apple-touch-icon.png');
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
    name: 'Tic Tac Tierernährung', short_name: 'Tic Tac Tier',
    description: 'Heimlich Tic Tac Toe in der Tierernährungs-Vorlesung (Fan-Projekt, kein offizielles Angebot der BOKU).',
    lang: 'de', start_url: './', scope: './', display: 'standalone', orientation: 'landscape',
    background_color: '#0e1512', theme_color: '#00aa5a',
    icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
  }, null, 1));
  core.push('manifest.webmanifest');
  const headExtra = `<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n`;
  // Service Worker registrieren; neue Version → Hinweis mit „Neu laden“; Stimmen der gewählten Sprache nach dem Start vorhalten
  const reg = `<script>(function(){if(!('serviceWorker'in navigator)||location.protocol==='file:')return;
var V=${JSON.stringify(Object.fromEntries(Object.entries(voiceFiles)))};
function toast(){var d=document.createElement('div');d.setAttribute('role','status');d.style.cssText='position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:99;background:#0e1512;color:#fff;border:1px solid #00aa5a;border-radius:10px;padding:10px 14px;font:600 15px/1.3 system-ui,sans-serif;display:flex;gap:12px;align-items:center';
var de=(document.documentElement.lang||'de').indexOf('en')!==0;d.innerHTML='<span>'+(de?'Neue Version verfügbar.':'A new version is available.')+'</span>';var b=document.createElement('button');b.textContent=de?'Neu laden':'Reload';b.style.cssText='min-height:44px;padding:0 14px;border-radius:8px;border:0;background:#00aa5a;color:#fff;font:inherit';
b.onclick=function(){navigator.serviceWorker.getRegistration().then(function(r){if(r&&r.waiting)r.waiting.postMessage('skipWaiting');else location.reload();});};d.appendChild(b);document.body.appendChild(d);}
var reloading=false;navigator.serviceWorker.addEventListener('controllerchange',function(){if(!reloading){reloading=true;location.reload();}});
window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').then(function(r){if(r.waiting&&navigator.serviceWorker.controller)toast();
r.addEventListener('updatefound',function(){var w=r.installing;w&&w.addEventListener('statechange',function(){if(w.state==='installed'&&navigator.serviceWorker.controller)toast();});});
setTimeout(function(){var c=navigator.connection;if(c&&c.saveData)return;var l='';try{l=JSON.parse(localStorage.getItem('boku-ttt-v2:lang')||'""');}catch(x){}if(!l)l=(navigator.language||'de').toLowerCase().indexOf('de')===0?'de':'en';navigator.serviceWorker.ready.then(function(s){s.active&&V[l]&&s.active.postMessage({cacheVoice:V[l]});});},20000);}).catch(function(){});});})();</script>\n`;
  return { remoteBlock: `<script type="application/json" id="assets-remote">${JSON.stringify(remote)}</script>\n`, headExtra: headExtra + reg };
}

export async function finishMobile({ root, html, t0 }) {
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  core.unshift('./', 'index.html');
  const hash = crypto.createHash('sha256');
  for (const f of core) if (f !== './') hash.update(fs.readFileSync(path.join(OUT, f)));
  const version = hash.digest('hex').slice(0, 12);
  fs.writeFileSync(path.join(OUT, 'sw.js'), `// Service Worker (Mobil-Build): Kerndateien beim Installieren vorhalten → offline nach dem ersten Start.
// Stimmen landen beim Abspielen bzw. nach dem Start (Nachricht cacheVoice) im Zwischenspeicher „voice“.
const VERSION = ${JSON.stringify(version)};
const CORE = ${JSON.stringify(core)};
self.addEventListener('install', e => { e.waitUntil(caches.open('core-' + VERSION).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('core-') && k !== 'core-' + VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  else if (e.data && e.data.cacheVoice) e.waitUntil((async () => { const c = await caches.open('voice'); for (const u of e.data.cacheVoice) { if (await c.match(u)) continue; try { const r = await fetch(u); if (r.ok) await c.put(u, r); } catch (x) { return; } } })());
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true }); if (hit) return hit;
    const r = await fetch(req);
    if (r.ok && /\\/assets\\/voice\\//.test(req.url)) { const c = await caches.open('voice'); c.put(req, r.clone()); }
    return r;
  })());
});
`);
  // Größen
  let coreBytes = 0; for (const f of core) if (f !== './') coreBytes += fs.statSync(path.join(OUT, f)).size;
  let voiceBytes = {}; for (const [l, fs2] of Object.entries(voiceFiles)) voiceBytes[l] = fs2.reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  // ZIP für eigenes Hosting
  const zip = path.join(root, 'dist', MOBILE_ZIP);
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', zip, '.'], { cwd: OUT });
  writeSums(root);
  const mb = b => (b / 1048576).toFixed(1) + ' MB';
  console.log(`dist/mobile/  Kern (Precache) ${mb(coreBytes)}${Object.entries(voiceBytes).map(([l, b]) => ` · Stimmen ${l} ${mb(b)}`).join('')}  ·  ZIP ${mb(fs.statSync(zip).size)}  (${Date.now() - t0} ms)`);
  if (coreBytes > 30 * 1048576) { console.error('Mobil-Kern größer als 30 MB!'); process.exit(1); }
}
