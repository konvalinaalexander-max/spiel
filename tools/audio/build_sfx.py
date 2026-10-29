"""Klangwelt aus echten Aufnahmen (Auftrag V3, Phase 6b): Kandidaten aus tools/pipeline/audio_sources.json schneiden, säubern,
mastern und als Opus ablegen.

    tools/.venv/bin/python tools/audio/build_sfx.py [--only chalkTap,rain]

Eingabe:  tools/pipeline/audio_sources.json (Quellen, Lizenz, Schnittfenster, Qualität)
          tools/audio/levels_synth.json      (Pegel der bisherigen synthetischen Klänge – die Mischung im Spiel bleibt erhalten)
Ausgabe:  assets/build/sfx/<name>_<n>.ogg, assets/build/sfx/manifest.json (Varianten, Schleife, Herkunft),
          docs/audio/check.json (Lautheit, Spitzenpegel, Grundrauschen je Clip – siehe tools/audio-check.mjs)

Einmal-Klänge: mono, Hochpass, bei hörbarem Rauschen Entrauschen (FFT), Ereignis automatisch eingrenzen, wenn kein Schnittfenster
angegeben ist, Expander gegen Rauschen in Pausen (≤ −60 dBFS), Ein-/Ausblenden, Spitzenpegel wie der bisherige Klang (≤ −1 dBFS).
Schleifen: Stereo, Hochpass, nahtlos (gleichleistungs-Überblendung des Endes in den Anfang), Pegel (RMS) wie der bisherige Klang.
Opus: Einmal-Klänge 64 kbit/s mono, Schleifen 96 kbit/s stereo, 48 kHz.
"""
import json, os, sys, subprocess, hashlib
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SR = 48000
ARGS = sys.argv[1:]
ONLY = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None
OUT = os.path.join(ROOT, 'assets', 'build', 'sfx')
os.makedirs(OUT, exist_ok=True)

LOOPS = {'roomTone', 'murmur', 'rain', 'wind', 'traffic', 'ventilation', 'projectorFan', 'music'}
# Varianten je Klang (wie bisher die synthetischen Varianten; mehr, wo es Kandidaten gibt)
VARIANTS = {'chalkTap': 4, 'stepParquet': 4, 'stepCarpet': 3, 'stepStair': 3, 'keyClick': 5, 'cough': 4, 'coughHigh': 3, 'chairCreak': 4, 'bird': 4,
            'chalkScratch': 3, 'cloth': 3, 'pageTurn': 3, 'doorClose': 3, 'doorBang': 2, 'glass': 3, 'laughSoft': 3, 'tramBell': 3, 'murmurBurst': 2}
# Höchstlänge der Einmal-Klänge (s); was länger ist, wird ausgeblendet
MAXLEN = {'chalkTap': 0.5, 'keyClick': 0.35, 'penClick': 0.4, 'touchpad': 0.3, 'clicker': 0.4, 'stepParquet': 0.8, 'stepCarpet': 0.7, 'stepStair': 0.9,
          'cough': 1.6, 'coughHigh': 1.4, 'throatClear': 1.2, 'chalkScratch': 1.4, 'penWrite': 1.6, 'pageTurn': 1.2, 'zipper': 1.2, 'cloth': 1.4,
          'sponge': 2.4, 'boardSlide': 3.2, 'seatFlip': 1.6, 'chairCreak': 1.3, 'doorOpen': 2.2, 'doorClose': 1.6, 'doorBang': 1.6, 'hinge': 1.2,
          'lidClose': 0.8, 'phoneRing': 3.0, 'phoneVibrate': 1.8, 'tramBell': 2.5, 'bird': 3.0, 'laughSoft': 3.0, 'murmurBurst': 3.0, 'glass': 1.2,
          'pour': 3.0, 'bottleDrop': 1.4, 'micThump': 0.9, 'micFeedback': 2.0, 'breath': 1.2}
LOOP_XF = 2.0  # Überblendung der Schleifen (s)
QUAL = {'gut': 0, 'ok': 1, 'schwach': 2}


def decode(path, a=None, b=None, ch=1, af='highpass=f=50'):
    cmd = ['ffmpeg', '-v', 'error']
    if a is not None: cmd += ['-ss', f'{a:.3f}']
    if b is not None: cmd += ['-to', f'{b:.3f}']
    cmd += ['-i', path, '-af', af, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    return x.reshape(-1, ch) if ch > 1 else x


def rms_env(x, win):
    p = np.convolve(x * x, np.ones(win) / win, mode='same')
    return np.sqrt(np.maximum(p, 1e-12))


def db(v): return 20 * np.log10(max(v, 1e-12))


def find_event(x, maxlen):
    """Lautestes Ereignis finden: Beginn 20 ms vor dem Anstieg, Ende wenn der Pegel 150 ms lang unter der Schwelle bleibt."""
    env = rms_env(x, int(0.01 * SR)); pk = env.max()
    floor = np.percentile(env, 10)
    thr = max(floor * 4, pk * 10 ** (-35 / 20))
    i = int(np.argmax(env))
    s = i
    while s > 0 and env[s] > thr: s -= 1
    s = max(0, s - int(0.02 * SR))
    e = i; quiet = 0; need = int(0.15 * SR)
    while e < len(x) - 1 and quiet < need:
        quiet = quiet + 1 if env[e] < thr else 0
        e += 1
    e = min(e, s + int(maxlen * SR))
    return x[s:e]


def expander(x, thr_db=-52, ratio=3.0):
    """Abwärts-Expander: unter der Schwelle wird leiser geregelt (Rauschen in Pausen ≤ −60 dBFS)."""
    env = rms_env(x if x.ndim == 1 else x.mean(axis=1), int(0.02 * SR))
    thr = 10 ** (thr_db / 20)
    g = np.where(env >= thr, 1.0, (env / thr) ** (ratio - 1))
    # Glätten (Release 80 ms)
    k = int(0.08 * SR); g = np.convolve(g, np.ones(k) / k, mode='same')
    return x * (g if x.ndim == 1 else g[:, None])


def fades(x, fin=0.003, fout=0.03):
    n = len(x); a = min(int(fin * SR), n // 4); b = min(int(fout * SR), n // 3)
    w = np.ones(n)
    if a: w[:a] = np.linspace(0, 1, a)
    if b: w[-b:] = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x * (w if x.ndim == 1 else w[:, None])


def make_loop(x):
    xf = min(int(LOOP_XF * SR), len(x) // 4)
    n = len(x) - xf
    t = np.linspace(0, np.pi / 2, xf)
    fi, fo = np.sin(t) ** 2, np.cos(t) ** 2  # Summe 1 (unkorreliert wäre gleichleistung besser; Raumklang ist teils korreliert)
    fi, fo = np.sqrt(fi), np.sqrt(fo)
    out = x[:n].copy()
    out[:xf] = x[:xf] * fi[:, None] + x[n:n + xf] * fo[:, None]
    return out


def encode(x, path, loop):
    ch = 1 if x.ndim == 1 else x.shape[1]
    raw = np.clip(x, -1, 1).astype(np.float32).tobytes()
    br = '96k' if loop else '64k'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', '-c:a', 'libopus', '-b:a', br, '-vbr', 'on',
                    '-application', 'audio', path], input=raw, check=True)


def measure(x):
    import pyloudnorm as pyln
    m = x if x.ndim == 1 else x
    dur = len(m) / SR
    lufs = pyln.Meter(SR).integrated_loudness(m) if dur > 0.45 else None
    pk = float(np.abs(m).max())
    mono = m if m.ndim == 1 else m.mean(axis=1)
    win = int(0.3 * SR)
    r = [np.sqrt(np.mean(mono[i:i + win] ** 2)) for i in range(0, max(1, len(mono) - win), win // 2)] or [np.sqrt(np.mean(mono ** 2))]
    return {'dur': round(dur, 3), 'lufs': round(float(lufs), 1) if lufs is not None and np.isfinite(lufs) else None, 'peakDb': round(db(pk), 1),
            'floorDb': round(db(min(r)), 1), 'clip': int(np.sum(np.abs(m) >= 0.999))}


def main():
    src = json.load(open(os.path.join(ROOT, 'tools', 'pipeline', 'audio_sources.json'), encoding='utf-8'))
    lv_path = os.path.join(ROOT, 'tools', 'audio', 'levels_synth.json')
    levels = json.load(open(lv_path)) if os.path.exists(lv_path) else {}
    by = {}
    for e in src['sounds']:
        if not e.get('downloaded'): continue
        by.setdefault(e['name'], []).append(e)
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {}
    check = {}
    for name, cands in sorted(by.items()):
        if ONLY and name not in ONLY: continue
        loop = name in LOOPS
        cands = sorted(cands, key=lambda e: QUAL.get(e.get('quality'), 3))
        best = QUAL.get(cands[0].get('quality'), 3)
        # schwache Kandidaten nur, wenn es nichts Besseres gibt
        cands = [c for c in cands if QUAL.get(c.get('quality'), 3) <= max(best, 1)]
        k = 1 if loop else VARIANTS.get(name, 2)
        cands = cands[:k]
        files, origin = [], []
        lv = levels.get(name) or {}
        for i, e in enumerate(cands):
            f = os.path.join(ROOT, e.get('extractedFile') or e['file'])
            a, b = (e.get('trim') or [None, None])
            noisy = (e.get('noiseFloorDb') or -90) > -58
            af = 'highpass=f=40' if loop else ('highpass=f=60,afftdn=nr=14:nf=-48:tn=1' if noisy else 'highpass=f=60')
            try:
                if loop:
                    if a is None: a, b = 0, min(40.0, e.get('duration') or 40)
                    x = decode(f, a, b + LOOP_XF, ch=2, af=af)
                    x = make_loop(x)
                    if lv.get('rmsDb') is not None:
                        cur = db(np.sqrt(np.mean(x ** 2)))
                        x = x * 10 ** ((lv['rmsDb'] - cur) / 20)
                    pk = np.abs(x).max()
                    if pk > 0.89: x *= 0.89 / pk
                else:
                    pad = 0.0 if a is None else 0.05
                    x = decode(f, None if a is None else max(0, a - pad), None if b is None else b + pad, ch=1, af=af)
                    x = find_event(x, MAXLEN.get(name, 2.0)) if a is None or (b - a) > MAXLEN.get(name, 2.0) + 0.1 else x
                    if len(x) < int(0.03 * SR): raise ValueError('zu kurz')
                    x = x / max(np.abs(x).max(), 1e-6) * 10 ** (-3 / 20)
                    x = expander(x)
                    x = fades(x)
                    target = min(-1.0, lv.get('peakDb', -3.0))
                    x = x / max(np.abs(x).max(), 1e-6) * 10 ** (target / 20)
            except Exception as ex:
                print('✗', name, e['file'], ex, flush=True); continue
            fn = f'{name}_{i}.ogg'
            encode(x, os.path.join(OUT, fn), loop)
            check[fn] = {**measure(x), 'loop': loop, 'source': e['file'], 'license': e['license']}
            files.append(fn)
            origin.append({'file': fn, 'source': e.get('page') or e.get('url'), 'license': e['license'], 'author': e.get('author'),
                           'attribution': e.get('attribution'), 'quality': e.get('quality'), 'sha': hashlib.sha256(open(os.path.join(OUT, fn), 'rb').read()).hexdigest()[:16]})
        if files:
            man[name] = {'files': files, 'loop': loop, 'origin': origin}
            print(f'✓ {name:14} {len(files)} Variante(n){" (Schleife)" if loop else ""}', flush=True)
    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.makedirs(os.path.join(ROOT, 'docs', 'audio'), exist_ok=True)
    cp = os.path.join(ROOT, 'docs', 'audio', 'check.json')
    old = json.load(open(cp, encoding='utf-8')) if os.path.exists(cp) else {}
    old.update(check)
    json.dump(old, open(cp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
