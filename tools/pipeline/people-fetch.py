# Lädt die Rocketbox-Figuren und -Animationen aus tools/pipeline/people.json nach assets/src/rocketbox (Cache, nicht im Repo).
#   python3 -I tools/pipeline/people-fetch.py
# Quelle: github.com/microsoft/Microsoft-Rocketbox (MIT). Die Dateiliste kommt einmalig aus der Git-Baumansicht der GitHub-API
# (tools/.cache/rocketbox_files.txt). Texturen werden gleich in PNG (≤ 2048 px) gewandelt und die TGA-Rohdaten gelöscht.
# Fehlende Dateien (404) werden gemeldet und übersprungen. Heruntergeladene Daten gelten als fremd: sie landen nur unter
# assets/src/rocketbox, Pfade werden auf diesen Ordner geprüft.
import json, os, subprocess, sys, urllib.parse
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CFG = json.load(open(os.path.join(ROOT, 'tools/pipeline/people.json'), encoding='utf-8'))
OUT = os.path.join(ROOT, 'assets/src/rocketbox'); CACHE = os.path.join(ROOT, 'tools/.cache')
BASE = CFG['base']  # …/Microsoft-Rocketbox/master/Assets
os.makedirs(CACHE, exist_ok=True)
missing = []

def safe(p):
    p = os.path.abspath(p)
    if not p.startswith(OUT + os.sep): raise SystemExit('Pfad außerhalb des Zielordners: ' + p)
    return p

def fetch(url, dst):
    dst = safe(dst)
    if os.path.exists(dst) and os.path.getsize(dst) > 0: return True
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = subprocess.run(['curl', '-sS', '-f', '--retry', '3', '-o', dst + '.part', url], capture_output=True, text=True)
    if r.returncode != 0:
        missing.append(url); print('  ✗', url.split('/Assets/')[-1], r.stderr.strip()[:80], flush=True)
        if os.path.exists(dst + '.part'): os.remove(dst + '.part')
        return False
    os.replace(dst + '.part', dst); return True

def url(rel): return BASE + '/' + urllib.parse.quote(rel)

# Dateiliste (einmalig)
listing = os.path.join(CACHE, 'rocketbox_files.txt')
if not os.path.exists(listing):
    api = 'https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/master?recursive=1'
    tree = json.loads(subprocess.run(['curl', '-sS', '-f', api], capture_output=True, text=True, check=True).stdout)
    open(listing, 'w').write('\n'.join(t['path'] for t in tree['tree'] if t['type'] == 'blob'))
files = open(listing).read().split('\n')

# Figuren
avatars = {}
for g in CFG['crowd'].values():
    for a in g: avatars.setdefault(a, False)
for h in CFG['heroes'].values(): avatars[h['avatar']] = avatars.get(h['avatar'], False) or bool(h.get('facial'))
for a, facial in avatars.items():
    grp = 'Adults'; d = os.path.join(OUT, 'avatars', a)
    fetch(url(f'Avatars/{grp}/{a}/Export/{a}.fbx'), os.path.join(d, 'Export', a + '.fbx'))
    if facial: fetch(url(f'Avatars/{grp}/{a}/Export/{a}_facial.fbx'), os.path.join(d, 'Export', a + '_facial.fbx'))
    if os.path.exists(os.path.join(d, '.textures_done')): continue
    pre = f'Assets/Avatars/{grp}/{a}/Textures/'
    # nur die Standardtexturen (Varianten wie „… - wr.tga“ auslassen)
    tex = [f[len(pre):] for f in files if f.startswith(pre) and ' ' not in f[len(pre):] and f.lower().endswith('.tga')]
    ok = all(fetch(url(f'Avatars/{grp}/{a}/Textures/{t}'), os.path.join(d, 'Textures', t)) for t in tex)
    if not ok: continue
    r = subprocess.run([sys.executable, '-I', '-c', '''
import sys, glob, os
from PIL import Image
for f in glob.glob(os.path.join(sys.argv[1], 'Textures', '*.tga')):
    im = Image.open(f); im = im.convert('RGBA' if 'opacity' in f else 'RGB')
    if im.size[0] > 2048: im = im.resize((2048, 2048), Image.LANCZOS)
    im.save(f[:-4] + '.png'); os.remove(f)
''', d])
    if r.returncode == 0: open(os.path.join(d, '.textures_done'), 'w').close(); print('Figur', a, flush=True)

# Animationen
FOLDER = {'static': 'all_animations_max_motextr_static', 'xy': 'all_animations_max_motextr_xy', 'xyz': 'all_animations_max_motextr_xyz'}
def clip(g, n):
    f, n2 = ('static', n) if ':' not in n else n.split(':')
    fetch(url(f'Animations/{FOLDER[f]}/{g}_{n2}.max.fbx'), os.path.join(OUT, 'anims', f'{g}_{n2}.fbx'))
for g in ('m', 'f'):
    for n in CFG['clips']['common'].values(): clip(g, n)
for n in CFG['clips']['prof'].values(): clip('m', n)
print('fertig,', len(missing), 'fehlend')
