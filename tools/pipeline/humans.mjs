// Menschen-Pipeline (Auftrag V3, Phase 4): erzeugt alle Figuren aus tools/pipeline/humans.json mit Blender + MPFB.
//   node tools/pipeline/humans.mjs [--only prof,m01] [--parallel 2] [--check]
// Voraussetzungen: Blender 4.5 LTS unter tools/blender/, MPFB-Erweiterung und MakeHuman-Assetpakete (npm run assets:fetch,
// dann node tools/pipeline/humans.mjs --install). Ausgabe: assets/build/humans/<id>.glb + <id>.meta.json (Rohfassung,
// danach fasst tools/pipeline/humans-pack.mjs Texturen zu Atlanten zusammen).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = k => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : null);
const only = opt('only') ? opt('only').split(',') : null;
const parallel = +(opt('parallel') || 2);
const blender = path.join(root, 'tools/blender/blender-4.5.15-linux-x64/blender');
const userRes = path.join(root, 'tools/.cache/blender-user');
const data = path.join(userRes, 'extensions/.user/user_default/mpfb/data');
const out = path.join(root, 'assets/build/humans'); fs.mkdirSync(out, { recursive: true });
const tmp = path.join(root, 'tools/.cache/humans'); fs.mkdirSync(tmp, { recursive: true });
const roster = JSON.parse(fs.readFileSync(path.join(root, 'tools/pipeline/humans.json'), 'utf8'));

// --install: MPFB-Erweiterung installieren und Assetpakete (ZIP, CC0) in die MPFB-Benutzerdaten entpacken (mit Pfadprüfung)
if (args.includes('--install')) {
  const env = { ...process.env, BLENDER_USER_RESOURCES: userRes };
  execFileSync(blender, ['--background', '--factory-startup', '--command', 'extension', 'install-file', '-r', 'user_default', '-e', path.join(root, 'assets/src/tools/mpfb-2.0.18.zip')], { env, stdio: 'inherit' });
  fs.mkdirSync(data, { recursive: true });
  execFileSync('python3', ['-I', '-c', `
import zipfile, sys, os
dst = os.path.abspath(sys.argv[1]); src = sys.argv[2]
for f in sorted(os.listdir(src)):
    if not f.endswith('_cc0.zip'): continue
    z = zipfile.ZipFile(os.path.join(src, f))
    for n in z.namelist():
        if not os.path.abspath(os.path.join(dst, n)).startswith(dst + os.sep): raise SystemExit('unsicherer Pfad ' + n)
    z.extractall(dst); print('entpackt', f)
`, data, path.join(root, 'assets/src/makehuman')], { stdio: 'inherit' });
  process.exit(0);
}

// Spezifikation vervollständigen und Assets prüfen
const find = (sub, frag) => { const base = path.basename(frag); const dir = path.join(data, sub); const hits = []; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === base) hits.push(p); } }; if (fs.existsSync(dir)) walk(dir); return hits[0]; };
const specs = roster.humans.filter(h => !only || only.includes(h.id)).map(h => ({ ...roster.defaults[h.class], ...h }));
let missing = 0;
for (const s of specs) {
  const req = [['skins', s.skin], ['eyes', s.eyes], ['eyebrows', s.eyebrows], ['eyelashes', s.eyelashes], ['hair', s.hair], ['teeth', s.teeth], ['proxymeshes', s.proxy],
    ['hair', s.hairMaterial], ...(s.clothes || []).map(c => ['clothes', c]), ...(s.accessories || []).map(c => ['clothes', c]),
    ...Object.values(s.clothesMaterial || {}).map(v => ['clothes', v + '.mhmat']), ['eyes', s.eyeColor && s.eyeColor + '.mhmat']].filter(r => r[1]);
  for (const [sub, f] of req) if (!find(sub, f)) { console.log(`✗ ${s.id}: ${sub}/${f} fehlt`); missing++; }
}
if (missing) process.exit(1);
if (args.includes('--check')) { console.log(`✓ ${specs.length} Figuren, alle Assets vorhanden`); process.exit(0); }

const run = s => new Promise(res => {
  const sp = path.join(tmp, s.id + '.spec.json'); fs.writeFileSync(sp, JSON.stringify(s, null, 1));
  const t0 = Date.now(); const log = fs.openSync(path.join(tmp, s.id + '.log'), 'w');
  const p = spawn('nice', ['-n', '5', blender, '--background', '--python', path.join(root, 'tools/pipeline/blender/human.py'), '--', sp, path.join(out, s.id + '.glb')], { env: { ...process.env, BLENDER_USER_RESOURCES: userRes }, stdio: ['ignore', log, log] });
  p.on('close', code => {
    const meta = path.join(out, s.id + '.meta.json');
    const ok = code === 0 && fs.existsSync(meta);
    const m = ok ? JSON.parse(fs.readFileSync(meta, 'utf8')) : null;
    console.log(`${ok ? '✓' : '✗'} ${s.id.padEnd(9)} ${((Date.now() - t0) / 1000).toFixed(0).padStart(4)} s  ${ok ? `${m.polys} Polygone, ${(fs.statSync(path.join(out, s.id + '.glb')).size / 1048576).toFixed(1)} MB, ${m.height} m` : 'Fehler – siehe ' + path.relative(root, path.join(tmp, s.id + '.log'))}`);
    res(ok);
  });
});
const queue = [...specs]; let fails = 0;
await Promise.all(Array.from({ length: parallel }, async () => { while (queue.length) if (!(await run(queue.shift()))) fails++; }));
console.log(fails ? `${fails} Fehler` : `fertig: ${specs.length} Figuren → assets/build/humans/`);
process.exit(fails ? 1 : 0);
