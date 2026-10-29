// Lädt die Rohdaten der Asset-Pipeline (tools/pipeline/sources.json) nach assets/src/ – mit Cache und SHA256-Protokoll.
// node tools/pipeline/fetch.mjs [--only id1,id2] [--check]   (--check: nur Erreichbarkeit prüfen, nichts laden)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const check = args.includes('--check');
const par = args.includes('--parallel') ? +args[args.indexOf('--parallel') + 1] : 4;
const { sources } = JSON.parse(fs.readFileSync(path.join(root, 'tools/pipeline/sources.json'), 'utf8'));
const logFile = path.join(root, 'assets/src/fetched.json');
const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};
const sha = f => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', d => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) BOKU-TTT-Pipeline' };

async function one(s) {
  if (only && !only.includes(s.id)) return;
  const dest = path.join(root, 'assets/src', s.file);
  if (check) { const r = await fetch(s.url, { method: 'HEAD', headers: UA }).catch(e => ({ status: 'ERR ' + e.message })); console.log(`${String(r.status).padEnd(4)} ${s.id}  ${s.url}`); return; }
  if (fs.existsSync(dest)) {
    // vorhandene Datei: Protokolleintrag ergänzen statt neu zu laden (frisch einlesen – mehrere Läufe können parallel schreiben)
    const cur = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};
    if (!cur[s.id]?.sha256) { cur[s.id] = { url: s.url, file: s.file, sha256: await sha(dest), bytes: fs.statSync(dest).size, date: new Date().toISOString().slice(0, 10), license: s.license, author: s.author }; fs.writeFileSync(logFile, JSON.stringify(cur, null, 1)); }
    console.log(`✓ ${s.id} (Cache)`); return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const t0 = Date.now();
  const res = await fetch(s.url, { headers: UA });
  if (!res.ok) { console.log(`✗ ${s.id}: HTTP ${res.status}`); return; }
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest + '.part'));
  fs.renameSync(dest + '.part', dest);
  const h = await sha(dest);
  if (s.sha256 && s.sha256 !== h) { console.log(`✗ ${s.id}: SHA256 stimmt nicht (${h})`); fs.unlinkSync(dest); return; }
  const cur = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};
  cur[s.id] = log[s.id] = { url: s.url, file: s.file, sha256: h, bytes: fs.statSync(dest).size, date: new Date().toISOString().slice(0, 10), license: s.license, author: s.author };
  fs.writeFileSync(logFile, JSON.stringify(cur, null, 1));
  console.log(`↓ ${s.id}  ${(log[s.id].bytes / 1048576).toFixed(1)} MB  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// mehrere Downloads gleichzeitig (der MakeHuman-Server liefert je Verbindung nur ~100 KB/s)
const queue = [...sources];
await Promise.all(Array.from({ length: par }, async () => { while (queue.length) { const s = queue.shift(); try { await one(s); } catch (e) { console.log(`✗ ${s.id}: ${e.message}`); } } }));
