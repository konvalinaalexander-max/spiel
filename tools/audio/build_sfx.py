"""Klangwelt aus echten Aufnahmen (Auftrag V3, Phase 6b): Kandidaten aus tools/pipeline/audio_sources.json schneiden, säubern,
mastern und als Opus ablegen.

    nice -n 10 tools/.venv/bin/python -I tools/audio/build_sfx.py [--only chalkTap,rain] [--measure]

Eingabe:  tools/pipeline/audio_sources.json (Quellen, Lizenz, Schnittfenster, Qualität; geladen mit tools/audio/fetch_sfx.py)
          tools/audio/levels_synth.json      (Pegel der früheren synthetischen Klänge – die Mischung im Spiel bleibt erhalten)
Ausgabe:  assets/build/sfx/<name>_<n>.ogg, assets/build/sfx/manifest.json (Varianten, Schleife, Pegel, Herkunft),
          docs/audio/check.json (Messwerte der fertigen, wieder dekodierten Dateien – geprüft von tools/audio-check.mjs)

Einmal-Klänge: mono, Hochpass, bei hörbarem Rauschen Entrauschen (FFT), Ereignis automatisch eingrenzen, wenn kein Schnittfenster
angegeben ist, Expander und Pausen-Gate gegen Rauschen in Pausen (≤ −60 dBFS), Stille an Anfang/Ende ≤ 80 ms, Ein-/Ausblenden,
Spitze −2 dBFS (Reserve für den Opus-Kodierer: True Peak der fertigen Datei ≤ −1 dBTP).
Schleifen: Stereo, Hochpass, nahtlos (Überblendung des Endes in den Anfang, 2 s), −22 LUFS, Spitzenbegrenzer (True Peak ≤ −1 dBTP),
Nahtprüfung an der fertigen Datei.
Geschichtet (alles echte Aufnahmen, nur gemischt): „keyboards“ (Tastaturen aus mehreren Reihen: Pegel, Panorama, Tiefpass je Reihe,
Tipp-Pausen), „laughSmall/Mid/Big“ (Gruppen-Lachen in 3 Stärken aus 3/6/10 einzelnen Lachern).
Hall: „irFront“/„irBack“ – echte binaurale Impulsantworten eines Hörsaals (TU Berlin, Auditorium 3; tools/audio/extract_ir.py), Direktschall
entfernt, Ende bei −60 dB, Lautheit des Hallanteils wie die frühere synthetische Impulsantwort (die Mischung bleibt).
Pegel im Spiel: „gain“ im Verzeichnis bringt jeden Klang auf den Pegel des früheren synthetischen Klangs bzw. eines vergleichbaren
Klangs (LEVEL_LIKE). Opus: Einmal-Klänge 64 kbit/s, Schleifen 96 kbit/s (bzw. „br“ je Quelle), 48 kHz.
"""
import json, os, sys, subprocess, hashlib
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SR = 48000
ARGS = sys.argv[1:]
ONLY = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None
OUT = os.path.join(ROOT, 'assets', 'build', 'sfx')
os.makedirs(OUT, exist_ok=True)

LOOPS = {'roomTone', 'murmur', 'murmurQuiet', 'murmurBreak', 'keyboards', 'rain', 'rainHeavy', 'wind', 'birds', 'traffic', 'streetFar',
         'corridor', 'ventilation', 'projectorFan', 'music'}
COMPOSITE = {'keyboards', 'laughLayer'}   # Schichten, gemischt in build_keyboards() / build_laughs()
IRS = {'irFront', 'irBack'}
# Varianten je Klang (wie bisher die synthetischen Varianten; mehr, wo es Kandidaten gibt)
VARIANTS = {'chalkTap': 4, 'stepParquet': 4, 'stepCarpet': 3, 'stepStair': 3, 'keyClick': 5, 'cough': 4, 'coughHigh': 3, 'chairCreak': 4, 'bird': 4,
            'chalkScratch': 3, 'cloth': 3, 'pageTurn': 3, 'doorClose': 3, 'doorBang': 2, 'glass': 3, 'laughSoft': 3, 'tramBell': 3, 'murmurBurst': 2,
            'sneeze': 5, 'yawn': 5, 'cupDown': 3, 'cutlery': 4, 'appleBite': 4, 'paperTear': 4, 'bag': 3, 'highlighter': 3, 'penWrite': 3,
            'phoneVibrate': 3, 'shush': 3}
# Höchstlänge der Einmal-Klänge (s); was länger ist, wird ausgeblendet
MAXLEN = {'chalkTap': 0.5, 'keyClick': 0.35, 'penClick': 0.4, 'touchpad': 0.3, 'clicker': 0.4, 'stepParquet': 0.8, 'stepCarpet': 0.7, 'stepStair': 0.9,
          'cough': 1.6, 'coughHigh': 1.4, 'throatClear': 1.2, 'chalkScratch': 1.4, 'penWrite': 1.6, 'pageTurn': 1.2, 'zipper': 1.2, 'cloth': 1.4,
          'sponge': 2.4, 'boardSlide': 3.2, 'seatFlip': 1.6, 'chairCreak': 1.3, 'doorOpen': 2.2, 'doorClose': 1.6, 'doorBang': 1.6, 'hinge': 1.2,
          'lidClose': 0.8, 'phoneRing': 3.0, 'phoneVibrate': 1.8, 'tramBell': 2.5, 'bird': 3.0, 'laughSoft': 3.0, 'murmurBurst': 3.0, 'glass': 1.2,
          'pour': 3.0, 'bottleDrop': 1.4, 'micThump': 0.9, 'micFeedback': 2.0, 'breath': 1.2,
          'sneeze': 1.2, 'yawn': 3.6, 'cupDown': 0.8, 'cutlery': 1.4, 'appleBite': 0.9, 'paperTear': 1.2, 'bag': 2.6, 'highlighter': 0.9, 'shush': 1.1}
# Neue Klänge ohne synthetischen Vorgänger: Pegel wie ein vergleichbarer bisheriger Klang
LEVEL_LIKE = {'sneeze': 'cough', 'yawn': 'breath', 'cupDown': 'glass', 'cutlery': 'glass', 'appleBite': 'pageTurn', 'paperTear': 'pageTurn',
              'bag': 'cloth', 'highlighter': 'penWrite', 'shush': 'throatClear',
              'murmurQuiet': 'murmur', 'murmurBreak': 'murmur', 'keyboards': 'murmur', 'rainHeavy': 'rain', 'birds': 'wind', 'corridor': 'roomTone',
              'streetFar': 'traffic'}
# Gruppen-Lacher: Spitzenpegel im Spiel wie 1 / 3 / 6 gleichzeitige leise Einzel-Lacher (früher: 5 × laughSoft)
LEVEL_PEAK = {'laughSmall': -12.0, 'laughMid': -8.0, 'laughBig': -5.0}
# Hinweisgeräusche über dem (jetzt echten, leiser gemischten) Raumbett: Kreide (Spielmechanik: Ende des Kratzens = Prof dreht sich um),
# Schritte des Profs, Schwamm – in dB über dem Pegel des früheren synthetischen Klangs (gemessen mit tools/audio/mix_demo.py, Reihe 5)
LEVEL_TRIM_DB = {'chalkScratch': 4.0, 'chalkTap': 4.0, 'sponge': 3.0, 'stepParquet': 3.0, 'stepStair': 3.0}
LAUGHS = {'laughSmall': (3, 0.35), 'laughMid': (6, 0.6), 'laughBig': (10, 0.9)}   # Anzahl Lacher, Streuung des Einsatzes (s)
LOOP_XF = 2.0     # Überblendung der Schleifen (s)
CLIP_PEAK = -2.0  # Spitzenpegel der Einmal-Klänge in der Datei (dBFS)
TP_MAX = -1.0     # True Peak der fertigen Datei (dBTP)
ATMO_LUFS = -22.0
QUAL = {'gut': 0, 'ok': 1, 'schwach': 2}


def decode(path, a=None, b=None, ch=1, af='highpass=f=50'):
    cmd = ['ffmpeg', '-v', 'error']
    if a is not None: cmd += ['-ss', f'{a:.3f}']
    if b is not None: cmd += ['-to', f'{b:.3f}']
    cmd += ['-i', path, '-af', af, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x.reshape(-1, ch) if ch > 1 else x


def decode_native(path):
    """fertige Datei so dekodieren, wie der Browser sie bekommt (Kanäle unverändert, 48 kHz)"""
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=channels,sample_rate', '-of', 'json', path],
                                  capture_output=True, text=True, check=True).stdout)['streams'][0]
    ch = int(j['channels'])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, ch), int(j['sample_rate'])


def movavg(x, win):
    """gleitender Mittelwert (zentriert, O(n) über die kumulierte Summe)"""
    win = max(1, min(int(win), len(x)))
    c = np.concatenate([[0.0], np.cumsum(x, dtype=np.float64)])
    h = win // 2; i = np.arange(len(x)); lo = np.clip(i - h, 0, len(x)); hi = np.clip(i - h + win, 0, len(x))
    return (c[hi] - c[lo]) / win


def rms_env(x, win):
    return np.sqrt(np.maximum(movavg(x * x, win), 1e-12))


def db(v): return 20 * np.log10(max(float(v), 1e-12))


def mono(x): return x if x.ndim == 1 else x.mean(axis=1)


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


def expander(x, thr_db=-45, ratio=4.0):
    """Abwärts-Expander: unter der Schwelle wird leiser geregelt (Rauschen in Pausen ≤ −60 dBFS)."""
    env = rms_env(mono(x), int(0.02 * SR))
    thr = 10 ** (thr_db / 20)
    g = np.where(env >= thr, 1.0, (env / thr) ** (ratio - 1))
    g = movavg(g, 0.08 * SR)  # Release 80 ms
    return x * (g if x.ndim == 1 else g[:, None])


def gate(x, rel_db=-28, range_db=-30):
    """Pausen-Gate relativ zum lautesten 50-ms-Fenster: darunter fällt die Verstärkung steil (bis −30 dB), weich geregelt."""
    env = rms_env(mono(x), int(0.05 * SR)); thr = env.max() * 10 ** (rel_db / 20)
    g = np.where(env >= thr, 1.0, np.maximum(10 ** (range_db / 20), (env / max(thr, 1e-9)) ** 4))
    g = movavg(g, 0.06 * SR)
    return x * (g if x.ndim == 1 else g[:, None])


def fades(x, fin=0.003, fout=0.03):
    n = len(x); a = min(int(fin * SR), n // 4); b = min(int(fout * SR), n // 3)
    w = np.ones(n)
    if a: w[:a] = np.linspace(0, 1, a)
    if b: w[-b:] = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x * (w if x.ndim == 1 else w[:, None])


def trim_silence(x, rel_db=-45, pre=0.01, post=0.04):
    """Stille an Anfang und Ende kürzen (Anhang E: ≤ 80 ms) – Schwelle relativ zur Spitze."""
    a = np.abs(mono(x)); thr = a.max() * 10 ** (rel_db / 20)
    idx = np.nonzero(a > thr)[0]
    if not len(idx): return x
    s = max(0, idx[0] - int(pre * SR)); e = min(len(x), idx[-1] + int(post * SR))
    return x[s:e]


def make_loop(x):
    xf = min(int(LOOP_XF * SR), len(x) // 4)
    n = len(x) - xf
    t = np.linspace(0, np.pi / 2, xf)
    fi, fo = np.sin(t), np.cos(t)  # Gleichleistung (sin² + cos² = 1) – Raumklang ist überwiegend unkorreliert
    out = x[:n].copy()
    out[:xf] = x[:xf] * fi[:, None] + x[n:n + xf] * fo[:, None]
    return out


def limiter(x, ceil_db, circular=False):
    """Spitzenbegrenzer mit Vorausschau (5 ms), Release ~ 5 ms geglättet; bei Schleifen ringförmig (Naht bleibt unberührt)."""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    a = np.abs(x).max(axis=1) if x.ndim > 1 else np.abs(x)
    w = int(0.005 * SR); pad = 4 * w
    if circular: a = np.concatenate([a[-pad:], a, a[:pad]])
    ceil = 10 ** (ceil_db / 20)
    env = maximum_filter1d(a, size=2 * w + 1)
    g = np.minimum(1.0, ceil / np.maximum(env, 1e-12))
    g = minimum_filter1d(g, size=2 * w + 1)
    g = uniform_filter1d(g, size=w)
    if circular: g = g[pad:-pad]
    return x * (g[:, None] if x.ndim > 1 else g)


def encode(x, path, loop, br=None):
    ch = 1 if x.ndim == 1 else x.shape[1]
    raw = np.clip(x, -1, 1).astype(np.float32).tobytes()
    br = f'{br}k' if br else ('96k' if loop else '64k')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', '-c:a', 'libopus', '-b:a', br, '-vbr', 'on',
                    '-application', 'audio', path], input=raw, check=True)


def true_peak(x):
    from scipy.signal import resample_poly
    x = x if x.ndim > 1 else x[:, None]
    return max(float(np.abs(resample_poly(x[:, c], 4, 1)).max()) for c in range(x.shape[1]))


def measure_file(path, loop=False, ir=False):
    """Messwerte der fertigen Datei: Lautheit (BS.1770), Spitze, True Peak (4× überabgetastet), Rauschen in Pausen (50-ms-Fenster ≥ 30 dB
    unter dem lautesten), übersteuerte Samples, Abtastrate, Stille an Anfang/Ende (Einmal-Klänge), Nahtsprung (Schleifen)."""
    import pyloudnorm as pyln
    x, sr = decode_native(path)
    dur = len(x) / SR
    lufs = pyln.Meter(SR).integrated_loudness(x if x.shape[1] > 1 else x[:, 0]) if dur > 0.45 else None
    m = x.mean(axis=1)
    win = int(0.05 * SR)
    r = np.array([np.sqrt(np.mean(m[i:i + win] ** 2)) for i in range(0, max(1, len(m) - win), win)] or [np.sqrt(np.mean(m ** 2))])
    loud = r.max() if len(r) else 0
    pauses = r[(r < loud * 10 ** (-30 / 20)) & (r > 1e-7)]
    pk = float(np.abs(x).max())
    out = {'dur': round(dur, 3), 'sr': sr, 'ch': x.shape[1], 'lufs': round(float(lufs), 1) if lufs is not None and np.isfinite(lufs) else None,
           'peakDb': round(db(pk), 1), 'truePeakDb': round(db(true_peak(x)), 1),
           'floorDb': round(db(float(np.median(pauses))), 1) if len(pauses) >= 3 and not loop and not ir else None,
           'clip': int(np.sum(np.abs(x) >= 0.999))}
    if not loop and not ir:
        a = np.abs(m); thr = pk * 10 ** (-45 / 20); idx = np.nonzero(a > thr)[0]  # gleiche Schwelle wie trim_silence()
        out['leadMs'] = int(idx[0] / SR * 1000) if len(idx) else None
        out['tailMs'] = int((len(a) - 1 - idx[-1]) / SR * 1000) if len(idx) else None
    if loop:
        # Naht (Anhang E: Verhältnis < 2): Effektivwert der Sample-Differenzen in 2 ms um die Nahtstelle (Ende → Anfang, so wie die
        # Schleife abspielt) im Verhältnis zum Effektivwert der Differenzen der ganzen Datei; ein Klick an der Naht treibt den Wert hoch,
        # eine saubere Naht liegt um 1. Dazu der einzelne Sprung letztes → erstes Sample (wie in v2) und die Pegel der letzten und
        # ersten 250 ms (dB-Differenz) gegen die übliche Schwankung der Datei.
        w2 = int(0.001 * SR)
        ring = np.concatenate([x[-w2:], x[:w2]], axis=0)
        d_all = np.sqrt(np.mean(np.diff(x, axis=0) ** 2, axis=0)); d_seam = np.sqrt(np.mean(np.diff(ring, axis=0) ** 2, axis=0))
        out['seamRatio'] = round(float((d_seam / np.maximum(d_all, 1e-12)).max()), 2)
        out['seamStep'] = round(float((np.abs(x[-1] - x[0]) / np.maximum(np.abs(np.diff(x, axis=0)).mean(axis=0), 1e-12)).max()), 2)
        q = int(0.25 * SR)
        rr = np.array([np.sqrt(np.mean(m[i:i + q] ** 2)) for i in range(0, len(m) - q, q)])
        out['seamDb'] = round(db(np.sqrt(np.mean(m[-q:] ** 2))) - db(np.sqrt(np.mean(m[:q] ** 2))), 2)
        out['levelSpreadDb'] = round(float(np.std(20 * np.log10(np.maximum(rr, 1e-9)))), 2)
    return out


def finish(x, fn, loop=False, br=None, ir=False):
    """kodieren, dekodiert nachmessen; liegt der True Peak über −1 dBTP, leiser (Einmal-Klänge) bzw. stärker begrenzt (Schleifen)
    und neu kodieren. Liefert (Signal, Messwerte)."""
    path = os.path.join(OUT, fn)
    for _ in range(4):
        encode(x, path, loop, br)
        m = measure_file(path, loop=loop, ir=ir)
        if m['truePeakDb'] <= TP_MAX: break
        over = m['truePeakDb'] - TP_MAX + 0.2
        if loop:
            x = limiter(x, db(np.abs(x).max()) - over, circular=True)
        else:
            x = x * 10 ** (-over / 20)
    return x, m


def level_gain(name, x, loop, levels):
    lv = levels.get(name) or levels.get(LEVEL_LIKE.get(name, ''), {}) or {}
    trim = 10 ** (LEVEL_TRIM_DB.get(name, 0) / 20)
    if name in LEVEL_PEAK: return 10 ** ((LEVEL_PEAK[name] - db(np.abs(x).max())) / 20)
    if loop:
        return 10 ** ((lv['rmsDb'] - db(np.sqrt(np.mean(x ** 2)))) / 20) if lv.get('rmsDb') is not None else None
    return trim * 10 ** ((lv['peakDb'] - db(np.abs(x).max())) / 20) if lv.get('peakDb') is not None else None


def origin_of(e, fn, **kw):
    return {'file': fn, 'source': e.get('page') or e.get('url'), 'license': e['license'], 'author': e.get('author'),
            'attribution': e.get('attribution'), 'quality': e.get('quality'), **kw}


def src_path(e): return os.path.join(ROOT, e.get('extractedFile') or e['file'])


def is_noisy(e): return (e.get('noiseFloorDb') or -90) > -58


def master_loop(x):
    x = make_loop(x)
    import pyloudnorm as pyln
    lu = pyln.Meter(SR).integrated_loudness(x)
    if np.isfinite(lu): x = x * 10 ** ((ATMO_LUFS - lu) / 20)
    if np.abs(x).max() > 10 ** (-1.6 / 20): x = limiter(x, -1.6, circular=True)
    return x


# Atem-/Stimmgeräusche mit langen leisen Ausläufern (Gähnen, Niesen …): strengeres Pausen-Gate, damit kein Raumrauschen der Aufnahme bleibt
GATE_STRONG = {'yawn', 'sneeze', 'bag', 'cough', 'coughHigh'}


def master_clip(x, strong=False):
    x = x / max(np.abs(x).max(), 1e-9) * 10 ** (-3 / 20)
    x = expander(x)
    x = gate(x)
    if strong: x = gate(x, rel_db=-26, range_db=-45)
    x = trim_silence(x)
    x = fades(x)
    return x / max(np.abs(x).max(), 1e-9) * 10 ** (CLIP_PEAK / 20)


# ------------------------------------------------------------------------------------------------ geschichtete Klänge
def tile(x, n, rng, xf=0.3):
    """Material auf n Samples bringen: Abschnitte ab zufälligen Stellen, mit Überblendung aneinandergereiht."""
    k = int(xf * SR); out = np.zeros(n); pos = 0
    while pos < n:
        seg_len = min(len(x), n - pos + k)
        st = int(rng.uniform(0, max(1, len(x) - seg_len)))
        seg = x[st:st + seg_len].copy()
        if pos > 0:
            r = np.linspace(0, 1, min(k, len(seg))); seg[:len(r)] *= np.sin(r * np.pi / 2)
            out[pos - len(r):pos] *= np.cos(r * np.pi / 2)  # Ende des vorigen Abschnitts ausblenden
            p0 = pos - len(r)
        else:
            p0 = 0
        m = min(len(seg), n - p0); out[p0:p0 + m] += seg[:m]; pos = p0 + m
    return out


def bursts(n, rng, on=(3.0, 9.0), off=(1.0, 4.5), ramp=0.25):
    """Tipp-Phasen und Pausen (niemand tippt 30 s am Stück)."""
    env = np.zeros(n); t = int(rng.uniform(0, 2.0) * SR); typing = rng.random() < 0.7
    if typing: t = 0
    while t < n:
        d = int(rng.uniform(*(on if typing else off)) * SR)
        if typing: env[t:t + d] = 1
        t += d; typing = not typing
    return movavg(env, ramp * SR)


def build_keyboards(layers, loop_len=30.0):
    n = int((loop_len + LOOP_XF) * SR); out = np.zeros((n, 2)); used = []
    for e in sorted(layers, key=lambda e: e['mix'].get('seed', 0)):
        mx = e['mix']; rng = np.random.default_rng(1000 + mx.get('seed', 0))
        a, b = e.get('trim') or [None, None]
        af = 'highpass=f=90' + (',' + e['af'] if e.get('af') else '') + (',afftdn=nr=12:nf=-50:tn=1' if is_noisy(e) else '') + f',lowpass=f={mx.get("lowpass", 8000)}'
        x = decode(src_path(e), a, b, ch=1, af=af)
        x = x / max(np.sqrt(np.mean(x ** 2)), 1e-9)
        y = tile(x, n, rng) * bursts(n, rng)
        p = (mx.get('pan', 0) + 1) * np.pi / 4  # gleichleistungs-Panorama
        out += y[:, None] * np.array([np.cos(p), np.sin(p)]) * 10 ** (mx.get('gainDb', 0) / 20)
        used.append(e)
    return out, used


def build_laughs(layers):
    from scipy.signal import butter, sosfilt
    segs = []
    for e in layers:
        a, b = e.get('trim') or [None, None]
        af = 'highpass=f=120' + (',afftdn=nr=14:nf=-48:tn=1' if is_noisy(e) else '')
        x = decode(src_path(e), a, b, ch=1, af=af)
        x = fades(expander(x / max(np.abs(x).max(), 1e-9)), 0.01, 0.12)
        segs.append((x, e))
    res = {}
    lp = butter(2, 3200, 'low', fs=SR, output='sos')
    for si, (name, (k, spread)) in enumerate(LAUGHS.items()):
        res[name] = []
        for v in range(3):
            rng = np.random.default_rng(500 + 10 * si + v)
            pick = rng.permutation(len(segs))[:k] if k <= len(segs) else rng.integers(0, len(segs), k)
            parts, used = [], []
            for j, i in enumerate(pick):
                x, e = segs[i]
                rate = rng.uniform(0.93, 1.07)  # Stimmlage leicht variieren (Abspielrate), damit keine Stimme doppelt klingt
                y = np.interp(np.arange(0, len(x) - 1, rate), np.arange(len(x)), x)
                if rng.random() < 0.45: y = sosfilt(lp, y)  # weiter hinten im Saal: dumpfer
                g = 10 ** (rng.uniform(-9, -1 if j else 0) / 20)
                off = 0 if j == 0 else int(rng.uniform(0.05, spread) * SR)
                p = (rng.uniform(-0.8, 0.8) + 1) * np.pi / 4
                parts.append((off, y * g, np.cos(p), np.sin(p))); used.append(e)
            n = max(o + len(y) for o, y, _, _ in parts); mix = np.zeros((n, 2))
            for o, y, l, r in parts: mix[o:o + len(y), 0] += y * l; mix[o:o + len(y), 1] += y * r
            res[name].append((mix, used))
    return res


def synth_ir_reference(rt60=1.15, pre=0.018):
    """Nachbau der früheren synthetischen Impulsantwort (engine/synth makeImpulse) – nur als Pegel-Referenz für den echten Hall."""
    rng = np.random.default_rng(7); n = int((rt60 * 1.4 + pre) * SR); pd = int(pre * SR); out = np.zeros((n, 2))
    t = (np.arange(n) - pd) / SR
    for ch in range(2):
        lp = 0.0; d = np.zeros(n); w = rng.uniform(-1, 1, n)
        for i in range(pd, n):
            tt = t[i]; damp = 0.25 + 0.7 * np.exp(-tt * 2.2); lp += damp * (w[i] - lp); d[i] = lp * 10 ** (-3 * tt / rt60) * 0.6
        for ms, a in [[11, 0.5], [17, 0.35], [23, 0.3], [31, 0.25], [43, 0.2], [57, 0.15]]:
            i = pd + int((ms + (1.3 if ch else 0)) * SR / 1000)
            if i < n: d[i] += a * (-1 if ch else 1)
        out[:, ch] = d
    return out


def wet_lufs(ir):
    import pyloudnorm as pyln
    from scipy.signal import fftconvolve
    rng = np.random.default_rng(3); n = 6 * SR
    spec = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); spec[1:] /= np.sqrt(f[1:]); spec[0] = 0
    pink = np.fft.irfft(spec, n); pink /= np.sqrt(np.mean(pink ** 2)) * 10
    y = np.stack([fftconvolve(pink, ir[:, c])[:n] for c in range(2)], axis=1)
    return pyln.Meter(SR).integrated_loudness(y[SR:])


def build_ir(e):
    x = decode(src_path(e), ch=2, af='anull')
    a = np.abs(x).max(axis=1); on = int(np.argmax(a > 0.1 * a.max()))
    x = x[max(0, on - int(0.0005 * SR)):].copy()
    # Direktschall entfernen (der trockene Klang kommt schon über den Panner): die ersten 2,5 ms nach dem Einsatz stumm, 1 ms Rampe
    d1 = int(0.0025 * SR); d2 = d1 + int(0.001 * SR); w = np.ones(len(x)); w[:d1] = 0; w[d1:d2] = np.sin(np.linspace(0, np.pi / 2, d2 - d1)) ** 2
    x *= w[:, None]
    # Ende: Energieabklingkurve (Schroeder) bei −60 dB, höchstens 0,95 s, 60 ms ausblenden
    e2 = (x ** 2).sum(axis=1); edc = np.cumsum(e2[::-1])[::-1]; edc_db = 10 * np.log10(edc / edc[0] + 1e-30)
    end = int(np.argmax(edc_db < -60)) or len(x); end = min(end, int(0.95 * SR)); x = x[:end]
    k = int(0.06 * SR); x[-k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    # Lautheit des Hallanteils wie bisher (gleiche Sendepegel im Spiel). Der frühere ConvolverNode normalisierte seine synthetische
    # Impulsantwort selbst (Web Audio: normalize = true → Faktor 0,00125 / RMS · 44100 / 48000); jetzt normalize = false und die
    # echte Antwort bekommt genau die Lautheit, die der Hallanteil vorher hatte.
    ref = synth_ir_reference(); ref = ref * (0.00125 / np.sqrt(np.mean(ref ** 2)) * 44100 / SR)
    target = wet_lufs(ref); cur = wet_lufs(x)
    ir = x * 10 ** ((target - cur) / 20)
    s = 10 ** (-3 / 20) / np.abs(ir).max()   # Datei: Spitze −3 dBFS; der Rest steckt im Pegelfaktor „gain“
    t30 = None
    i5, i35 = int(np.argmax(edc_db <= -5)), int(np.argmax(edc_db <= -35))
    if i35 > i5: t30 = round((i35 - i5) / SR * 2, 3)
    return ir * s, 1 / s, {'t30': t30, 'lenS': round(len(ir) / SR, 3), 'wetLufsRef': round(target, 1)}


# ------------------------------------------------------------------------------------------------ Ableitungen (wie bisher)
# Klänge ohne eigene Aufnahme: aus echten Aufnahmen abgeleitet (Alias oder Bearbeitung), nicht synthetisiert
ALIAS = {'uiClick': 'touchpad', 'ttPlace': 'keyClick'}
PIANO = 'assets/src/audio/incompetech/clear-waters/Clear Waters.mp3'   # Kevin MacLeod, CC BY 4.0
BELL = 'tramBell'


def onsets(x, n=12, min_gap=0.35):
    """stärkste Anschläge (Spektralfluss grob über RMS-Anstieg)"""
    env = rms_env(x, int(0.01 * SR)); d = np.diff(env, prepend=env[0]); d[d < 0] = 0
    order = np.argsort(-d); out = []
    for i in order:
        if all(abs(i - j) > min_gap * SR for j in out): out.append(int(i))
        if len(out) >= n: break
    return sorted(out)


def derived(name, src_by):
    """Liefert [(Signal, Herkunftseintrag)] für abgeleitete Klänge."""
    res = []
    if name in ('good', 'quizSting', 'sting'):
        f = os.path.join(ROOT, PIANO)
        if not os.path.exists(f): return res
        x = decode(f, 0, 60, ch=1, af='highpass=f=40')
        ons = onsets(x, 16)
        ons = sorted(ons, key=lambda i: -np.abs(x[i:i + int(0.2 * SR)]).max())  # lauteste Anschläge zuerst
        pick = {'good': ons[0], 'quizSting': ons[1], 'sting': ons[2]}[name]
        seg = x[max(0, pick - int(0.01 * SR)): pick + int(1.6 * SR)]
        if name == 'sting':
            # tiefer und dunkler: dieselbe Aufnahme um eine Quinte tiefer (Abspielrate 2/3)
            idx = np.arange(0, len(seg) - 1, 2 / 3); seg = np.interp(idx, np.arange(len(seg)), seg)
        e = {'file': PIANO, 'page': 'https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100241', 'license': 'CC-BY-4.0', 'author': 'Kevin MacLeod',
             'attribution': '"Clear Waters" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 – einzelne Klaviertöne als Signal', 'quality': 'ok'}
        res.append((fades(seg, 0.002, 0.4), e))
    elif name == 'heart':
        # Herzschlag aus einer echten dumpfen Aufnahme (Mikrofon-Stoß), tiefpassgefiltert, „lub-dub“
        for e in src_by.get('micThump', [])[:1]:
            a, b = e.get('trim') or [None, None]
            x = decode(src_path(e), a, b, ch=1, af='lowpass=f=140,highpass=f=30')
            x = find_event(x, 0.25); x = x / max(np.abs(x).max(), 1e-6)
            out = np.zeros(int(0.75 * SR))
            out[:len(x)] += x[:len(out)]; o2 = int(0.19 * SR); m = min(len(x), len(out) - o2); out[o2:o2 + m] += 0.7 * x[:m]
            res.append((fades(out, 0.002, 0.1), e))
    elif name == 'micFeedback':
        # Rückkopplung: stärkster Teilton einer echten Glocke, schmalbandig herausgefiltert und gehalten
        for e in src_by.get(BELL, [])[:1]:
            f = src_path(e); a, b = e.get('trim') or [0, 2]
            x = decode(f, a, b, ch=1, af='highpass=f=600')
            spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))); fr = np.fft.rfftfreq(len(x), 1 / SR)
            band = (fr > 1500) & (fr < 4000); f0 = float(fr[band][np.argmax(spec[band])])
            y = decode(f, a, b, ch=1, af=f'bandpass=f={f0:.0f}:width_type=q:w=40,bandpass=f={f0:.0f}:width_type=q:w=40')
            y = y / max(np.abs(y).max(), 1e-6)
            # gehaltener Ton: kurzer Abschnitt nach dem Anschlag, mehrfach mit Überblendung aneinandergereiht, langsam anschwellend
            k = int(0.25 * SR); st = int(np.argmax(np.abs(y))) + int(0.05 * SR); piece = y[st:st + k]
            if len(piece) < k: piece = np.pad(piece, (0, k - len(piece)))
            reps = 7; xf = int(0.05 * SR); out = np.zeros(reps * (k - xf) + xf); w = np.linspace(0, 1, xf)
            for r in range(reps):
                seg = piece.copy(); seg[:xf] *= w; seg[-xf:] *= w[::-1]; o = r * (k - xf); out[o:o + k] += seg
            out *= np.linspace(0.6, 1, len(out)) ** 2
            res.append((fades(out, 0.02, 0.15), {**e, 'attribution': (e.get('attribution') or '') + ' – bearbeitet (Rückkopplungston)'}))
    return res


def sha16(fn): return hashlib.sha256(open(os.path.join(OUT, fn), 'rb').read()).hexdigest()[:16]


def remeasure(man):
    check = {}
    for name, m in man.items():
        if m.get('alias'): continue
        for fn in m['files']:
            if os.path.exists(os.path.join(OUT, fn)):
                o = next((o for o in m.get('origin', []) if o['file'] == fn), {})
                check[fn] = {**measure_file(os.path.join(OUT, fn), loop=m['loop'], ir=bool(m.get('ir'))), 'loop': m['loop'], 'ir': bool(m.get('ir')),
                             'name': name, 'license': o.get('license')}
    return check


def main():
    src = json.load(open(os.path.join(ROOT, 'tools', 'pipeline', 'audio_sources.json'), encoding='utf-8'))
    lv_path = os.path.join(ROOT, 'tools', 'audio', 'levels_synth.json')
    levels = json.load(open(lv_path)) if os.path.exists(lv_path) else {}
    by = {}
    for e in src['sounds']:
        if not e.get('downloaded') or (e.get('file') or '').endswith('.zip') and not e.get('archivePath'): continue
        by.setdefault(e['name'], []).append(e)
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path, encoding='utf-8')) if os.path.exists(man_path) else {}
    cp = os.path.join(ROOT, 'docs', 'audio', 'check.json')
    if '--measure' in ARGS:
        json.dump(remeasure(man), open(cp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('neu gemessen'); return
    want = lambda n: not ONLY or n in ONLY

    def store(name, items, loop, gains, extra=None):
        """items: [(Signal, [Herkunft…], br)] → Dateien, Verzeichnis-Eintrag"""
        files, origin, gl = [], [], []
        for i, (x, srcs, br) in enumerate(items):
            fn = f'{name}_{i}.ogg'
            x, m = finish(x, fn, loop=loop, br=br, ir=name in IRS)
            g = level_gain(name, x, loop, levels)
            if g is not None: gl.append(g)
            files.append(fn); h = sha16(fn)
            for e in srcs: origin.append({**origin_of(e, fn, sha=h), **({'derived': True} if e.get('_derived') else {})})
        gain = gains if gains is not None else (round(float(np.mean(gl)), 4) if gl else 1.0)
        man[name] = {'files': files, 'loop': loop, 'gain': gain, 'origin': origin, **(extra or {})}
        print(f'✓ {name:14} {len(files)} Datei(en){" (Schleife)" if loop else ""}  gain {gain}', flush=True)

    for name, cands in sorted(by.items()):
        if name in COMPOSITE or name in IRS or not want(name): continue
        loop = name in LOOPS
        cands = sorted(cands, key=lambda e: QUAL.get(e.get('quality'), 3))
        best = QUAL.get(cands[0].get('quality'), 3)
        cands = [c for c in cands if QUAL.get(c.get('quality'), 3) <= max(best, 1)]  # schwache Kandidaten nur, wenn es nichts Besseres gibt
        cands = cands[:1 if loop else VARIANTS.get(name, 2)]
        items = []
        for e in cands:
            f = src_path(e)
            a, b = (e.get('trim') or [None, None])
            extra_af = (',' + e['af']) if e.get('af') else ''
            af = ('highpass=f=40' if loop else ('highpass=f=60,afftdn=nr=14:nf=-48:tn=1' if is_noisy(e) else 'highpass=f=60')) + extra_af
            try:
                if loop:
                    # Musik: 60 Takte bei 90 BPM (160 s) – Schnitt am Taktende; Atmosphären: höchstens 40 s
                    if a is None: a, b = 0, min(160.0, (e.get('duration') or 40) - LOOP_XF - 0.05) if name == 'music' else min(40.0, e.get('duration') or 40)
                    x = master_loop(decode(f, a, b + LOOP_XF, ch=2, af=af))
                else:
                    mlen = e.get('maxLen') or MAXLEN.get(name, 2.0)
                    pad = 0.0 if a is None else 0.05
                    x = decode(f, None if a is None else max(0, a - pad), None if b is None else b + pad, ch=1, af=af)
                    x = find_event(x, mlen) if a is None or (b - a) > mlen + 0.1 else x
                    if len(x) < int(0.03 * SR): raise ValueError('zu kurz')
                    x = master_clip(x, strong=name in GATE_STRONG)
            except Exception as ex:
                print('✗', name, e['file'], ex, flush=True); continue
            items.append((x, [e], e.get('br')))
        if items: store(name, items, loop, None)

    # Tastaturen aus mehreren Reihen (Schleife)
    if want('keyboards') and by.get('keyboards'):
        x, used = build_keyboards([e for e in by['keyboards'] if e.get('mix')])
        store('keyboards', [(master_loop(x), used, 80)], True, None)
    # Gruppen-Lachen in drei Stärken
    if any(want(n) for n in LAUGHS) and by.get('laughLayer'):
        for name, variants in build_laughs(by['laughLayer']).items():
            if not want(name): continue
            items = []
            for mix, used in variants:
                y = mix / max(np.abs(mix).max(), 1e-9) * 10 ** (-3 / 20)
                y = fades(trim_silence(gate(gate(expander(y)), rel_db=-26, range_db=-45)), 0.005, 0.08)
                items.append((y / np.abs(y).max() * 10 ** (CLIP_PEAK / 20), list({id(e): e for e in used}.values()), None))
            store(name, items, False, None)
    # Hall: echte Impulsantworten
    for name in sorted(IRS):
        if not want(name) or not by.get(name): continue
        e = by[name][0]
        x, g, info = build_ir(e)
        store(name, [(x, [e], 128)], False, round(float(g), 4), {'ir': True, **info})
    # Aliasse: Klang nutzt die Aufnahmen eines anderen (z. B. UI-Klick = echter Touchpad-Klick)
    for name, s in ALIAS.items():
        if not want(name) or s not in man: continue
        man[name] = {**man[s], 'alias': s}
        print(f'✓ {name:14} = {s}', flush=True)
    # Ableitungen
    for name in ('good', 'quizSting', 'sting', 'heart', 'micFeedback'):
        if not want(name): continue
        items = []
        for x, e in derived(name, by):
            x = gate(expander(x / max(np.abs(x).max(), 1e-6) * 10 ** (-3 / 20)))
            x = fades(trim_silence(x), 0.002, 0.03)
            items.append((x / max(np.abs(x).max(), 1e-6) * 10 ** (CLIP_PEAK / 20), [{**e, '_derived': True}], None))
        if items: store(name, items, False, None)

    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # verwaiste Dateien entfernen (nur beim vollständigen Lauf)
    if not ONLY:
        keep = {f for m in man.values() for f in m['files']} | {'manifest.json'}
        for f in os.listdir(OUT):
            if f not in keep: os.remove(os.path.join(OUT, f)); print('  entfernt', f)
    os.makedirs(os.path.dirname(cp), exist_ok=True)
    json.dump(remeasure(man), open(cp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in {f for m in man.values() for f in m['files']} if os.path.exists(os.path.join(OUT, f)))
    print(f'{len(man)} Klänge, {len({f for m in man.values() for f in m["files"]})} Dateien, {total / 1048576:.2f} MB')


if __name__ == '__main__':
    main()
