"""Hörprobe „60 Sekunden Hörsaal“ (Auftrag V3, Phase 6b / Anhang E) als Offline-Mischung aus den AUSGELIEFERTEN Dateien.

    nice -n 10 tools/.venv/bin/python -I tools/audio/mix_demo.py            → docs/audio/hoersaal_mix.m4a
    nice -n 10 tools/.venv/bin/python -I tools/audio/mix_demo.py --reels    → zusätzlich docs/audio/foley_beispiele.m4a, atmo_beispiele.m4a

Nachgebaut wird, was die Audio-Engine im Spiel macht (src/audio/engine.js): Hörer auf einem Platz in Reihe 5 mit Blick zur Tafel,
Quellen mit Entfernungsdämpfung (Web Audio „inverse“, refDistance 1,2 m, rolloff 1,1) und Gleichleistungs-Panorama, Hall-Send über
die echten Hörsaal-Impulsantworten (vorne/hinten nach Entfernung gemischt, Vorverzögerung), Schleifen mit den Pegeln aus
AudioEngine.ambience() (Phase „part1“, Wetter bewölkt), Pegelfaktoren („gain“) aus assets/build/sfx/manifest.json,
Kanalregler wie voreingestellt (Effekte 0,8, Master 0,85). Keine Stimmen. Am Ende: −20 LUFS, True Peak ≤ −1 dBTP, AAC 160 kbit/s.

Ablauf der Minute: Raumton, Lüftung, Beamerlüfter, leises Gemurmel, Tastaturen; der Prof geht zur Tafel und schreibt (Kreide), wischt;
Husten, Niesen, Knarzen, Blättern, Kuli, Textmarker; eine Spätkommerin öffnet hinten die Tür (der Gang wird hörbar), Schritte auf den
Stufen, Klappsitz; ein Lacher im Saal; eigenes Tippen, Handy vibriert.
"""
import json, os, subprocess, sys
import numpy as np
from scipy.signal import fftconvolve
from scipy.ndimage import uniform_filter1d

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SFX = os.path.join(ROOT, 'assets', 'build', 'sfx')
SR = 48000
MAN = json.load(open(os.path.join(SFX, 'manifest.json'), encoding='utf-8'))
rng = np.random.default_rng(31)
VOL_SFX, VOL_MASTER = 0.8, 0.85


def dec(fn):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=channels', '-of', 'json', os.path.join(SFX, fn)],
                                  capture_output=True, text=True, check=True).stdout)['streams'][0]
    ch = int(j['channels'])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(SFX, fn), '-f', 'f32le', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, ch)


CACHE = {}
def clip(name, i=None):
    m = MAN[name]; fn = m['files'][rng.integers(len(m['files'])) if i is None else i]
    if fn not in CACHE: CACHE[fn] = dec(fn)
    return CACHE[fn] * m['gain']


# Hörer: Reihe 5, Platz 7 (LY: Reihe i vorne bei z = −3 + 0,8 i, Boden 0,14 i, Augen 1,2 m über dem Boden), Blick −z (zur Tafel), rechts = +x
LIS = np.array([0.5, 0.7 + 1.2, -3.0 + 5 * 0.8 + 0.58])
LECTERN = np.array([3.65, 1.6, -4.55])


def spatial(x, pos, ref=1.2, rolloff=1.1):
    """Entfernungsdämpfung (inverse) und Panorama aus dem Azimut (equalpower) – liefert Stereo."""
    v = np.asarray(pos, float) - LIS; d = max(np.linalg.norm(v), 1e-3)
    g = ref / (ref + rolloff * (max(d, ref) - ref))
    az = np.arctan2(v[0], -v[2])  # 0 = geradeaus, +90° = rechts
    p = (np.clip(np.sin(az), -1, 1) + 1) * np.pi / 4
    m = x.mean(axis=1) if x.ndim > 1 else x
    return np.stack([m * np.cos(p), m * np.sin(p)], axis=1) * g


def rate(x, r):
    if abs(r - 1) < 1e-4: return x
    idx = np.arange(0, len(x) - 1, r); return np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(x.shape[1])], axis=1)


def lowpass(x, f):
    from scipy.signal import butter, sosfilt
    return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x, axis=0)


def build(dur=60.0):
    n = int(dur * SR); dry = np.zeros((n, 2)); send = np.zeros((n, 2))

    def add(sig, t, send_level=0.0):
        i = int(t * SR); m = min(len(sig), n - i)
        if m <= 0: return
        dry[i:i + m] += sig[:m]
        if send_level: send[i:i + m] += sig[:m] * send_level

    def loop(name, gain, pos=None, ref=2.0, lp=None, env=None):
        x = clip(name, 0); k = int(rng.integers(len(x)))
        y = np.concatenate([x[k:], x] + [x] * (n // len(x) + 1))[:n]
        if y.shape[1] == 1: y = np.repeat(y, 2, axis=1)
        if lp: y = lowpass(y, lp)
        y = spatial(y, pos, ref=ref) if pos is not None else y
        if env is not None: y = y * env[:, None]
        dry[:] += y * gain

    def ev(name, t, pos=None, gain=0.5, rv=None, vary=0.06, ref=1.2, i=None):
        x = rate(clip(name, i), 1 + (rng.random() - 0.5) * vary)
        if pos is None:
            add((x if x.shape[1] == 2 else np.repeat(x, 2, axis=1)) * gain, t, rv or 0.0)
        else:
            add(spatial(x, pos, ref=ref) * gain, t, 0.6 if rv is None else rv)

    T = np.arange(n) / SR
    # Schleifen (wie AudioEngine.ambience, Phase part1, bewölkt)
    loop('ventilation', 0.05); loop('roomTone', 0.1); loop('murmurQuiet', 0.25); loop('keyboards', 0.15)
    door = np.array([3.75, 1.4 + 1.2, 6.0 + 1.5])
    swell = np.ones(n); s0, s1 = int(36.0 * SR), int(39.4 * SR)
    swell[s0:s1] = 3.0; swell = uniform_filter1d(swell, int(0.3 * SR))
    loop('corridor', 0.14, door, ref=2.5, lp=1300, env=swell)  # Gang hinter der Tür (gedämpft), bei offener Tür lauter …
    bright = np.zeros(n); bright[s0:s1] = 1.0; bright = uniform_filter1d(bright, int(0.3 * SR))
    loop('corridor', 0.3, door, ref=2.5, env=bright)  # … und heller (AudioEngine._doorSwell)
    loop('traffic', 0.3, (-4.6 - 3, 1, 0)); loop('streetFar', 0.24, (-4.6 - 14, 2, 8), ref=6); loop('wind', 0.12, (-4.6 - 1, 2.5, -2))
    loop('birds', 0.12, (-4.6 - 7, 5, 1), ref=3); loop('projectorFan', 0.25, (2.45, 3.78, -2.0))
    # Prof geht vom Pult zur Tafel (Parkett), schreibt, wischt, klickt weiter
    for k, t in enumerate(np.arange(2.2, 8.5, 0.62)):
        x = 3.4 - k * 0.55; ev('stepParquet', t, (x, 0.2, -4.4), gain=0.5, vary=0.15)
    t = 9.5
    while t < 22.5:
        for _ in range(int(rng.integers(3, 7))):
            ev('chalkTap' if rng.random() < 0.3 else 'chalkScratch', t, (-2.2 + rng.uniform(-1, 1), 1.6, -5.9), gain=0.55, ref=2); t += rng.uniform(0.09, 0.18)
        t += rng.uniform(0.4, 1.1)
    ev('sponge', 24.0, (-2.2, 1.5, -5.9), gain=0.6)
    ev('clicker', 29.5, (-1.0, 1.1, -4.6), gain=0.35)
    # Saal
    ev('cough', 5.8, (-2.4, 1.3, -0.2), gain=0.5); ev('chairCreak', 12.4, (1.8, 0.9, 3.2), gain=0.45); ev('sneeze', 15.2, (2.6, 2.1, 4.0), gain=0.5)
    ev('pageTurn', 18.3, (-0.7, 1.3, 1.1), gain=0.5); ev('penClick', 26.8, (1.1, 1.4, 0.9), gain=0.45); ev('highlighter', 32.6, (-0.1, 1.4, 1.2), gain=0.5)
    ev('throatClear', 34.0, (-3.0, 1.0, -1.8), gain=0.45)
    # Spätkommerin: Tür hinten auf, Schritte die Stufen hinunter, Tür fällt zu, Klappsitz
    ev('doorOpen', 36.0, door - (0, 0, 1.5), gain=0.8)
    for k, t in enumerate(np.arange(37.0, 41.0, 0.55)):
        ev('stepStair', t, (3.9, 1.4 - k * 0.12 + 0.05, 5.5 - k * 0.8), gain=0.5, vary=0.15)
    ev('doorClose', 38.5, door - (0, 0, 1.5), gain=0.6); ev('seatFlip', 41.8, (3.0, 0.9, 1.9), gain=0.5); ev('bag', 42.6, (3.0, 0.9, 1.9), gain=0.5)
    ev('yawn', 44.5, (-1.5, 1.6, 2.6), gain=0.5); ev('paperTear', 46.7, (0.9, 1.0, -0.6), gain=0.5); ev('zipper', 47.9, (-2.0, 1.2, 0.4), gain=0.5)
    # Lacher im Saal (AudioEngine.laughCrowd, mittlere Stärke) – ohne die Pointe des Profs (keine Stimmen in dieser Hörprobe)
    ev('laughMid', 50.2, None, gain=0.55, rv=0.3, vary=0.04)
    for p in [(-1.2, 1.4, 1.0), (2.0, 1.6, 3.3)]: ev('laughSoft', 50.4 + rng.uniform(0, 0.5), p, gain=0.3)
    # eigener Platz: Tippen am Laptop, Mitschreiben, Handy vibriert
    t = 53.0
    while t < 56.0: ev('keyClick', t, None, gain=0.3, rv=0.0); t += rng.uniform(0.08, 0.22)
    ev('penWrite', 56.4, None, gain=0.35, rv=0.0); ev('phoneVibrate', 58.2, None, gain=0.3, rv=0.0)  # im Spiel 0,6 als Alarm – hier leiser, damit es die Minute nicht dominiert

    # Hall: echte Impulsantworten, nach Entfernung zum Pult gemischt (wie AudioEngine._roomBlend)
    d = np.hypot(*(LIS - LECTERN)[[0, 2]]); tb = np.clip((d - 3.5) / 7, 0, 1)
    irf, irb = clip('irFront', 0), clip('irBack', 0)
    pre = int((0.012 + (0.003 - 0.012) * tb) * SR)
    s = np.concatenate([np.zeros((pre, 2)), send])[:n] * 0.35  # reverbIn
    wet = np.zeros((n, 2))
    for ir, w in ((irf, np.cos(tb * np.pi / 2)), (irb, np.sin(tb * np.pi / 2))):
        for c in range(2): wet[:, c] += fftconvolve(s[:, c], ir[:, c])[:n] * w
    mix = (dry + wet * 0.8) * VOL_SFX * VOL_MASTER
    return mix, {'reihe': 5, 'abstandPultM': round(float(d), 2), 'hallHinten': round(float(tb), 2)}


def limiter(x, ceil_db):
    """Spitzenbegrenzer mit 5 ms Vorausschau (wie build_sfx.limiter)"""
    from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
    w = int(0.005 * SR); a = np.abs(x).max(axis=1)
    g = np.minimum(1.0, 10 ** (ceil_db / 20) / np.maximum(maximum_filter1d(a, size=2 * w + 1), 1e-12))
    return x * uniform_filter1d(minimum_filter1d(g, size=2 * w + 1), size=w)[:, None]


def master_out(mix, path, target=-20.0):
    import pyloudnorm as pyln
    from scipy.signal import resample_poly
    lu = pyln.Meter(SR).integrated_loudness(mix); mix = mix * 10 ** ((target - lu) / 20)
    ceil = -1.5
    for _ in range(5):
        mix = limiter(mix, ceil)
        tp = max(np.abs(resample_poly(mix[:, c], 4, 1)).max() for c in range(2))
        if tp <= 10 ** (-1.3 / 20): break
        ceil -= 0.5
    os.makedirs(os.path.dirname(path), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'aac', '-b:a', '160k',
                    '-movflags', '+faststart', path], input=mix.astype(np.float32).tobytes(), check=True)
    return round(float(pyln.Meter(SR).integrated_loudness(mix)), 1)


def reels():
    """Hörproben laut Anhang E: 20 Foley-Clips und 5 Atmosphären hintereinander (trocken, mit kurzer Pause)."""
    foley = ['chalkScratch', 'chalkTap', 'sponge', 'boardSlide', 'clicker', 'stepParquet', 'stepStair', 'doorOpen', 'doorClose', 'cough', 'sneeze',
             'yawn', 'pageTurn', 'penClick', 'highlighter', 'paperTear', 'zipper', 'bag', 'cupDown', 'appleBite', 'cutlery', 'phoneVibrate', 'laughMid']
    parts = []
    for nm in foley[:20] + ['laughMid']:
        x = clip(nm); x = x if x.shape[1] == 2 else np.repeat(x, 2, axis=1); parts += [x / max(np.abs(x).max(), 1e-9) * 0.5, np.zeros((int(0.6 * SR), 2))]
    out = {'foley_beispiele.m4a': np.concatenate(parts)}
    parts = []
    for nm in ['roomTone', 'murmurQuiet', 'murmurBreak', 'keyboards', 'rainHeavy', 'birds', 'corridor', 'streetFar']:
        x = clip(nm, 0)[:int(7 * SR)]; f = np.ones(len(x)); k = int(0.5 * SR); f[:k] = np.linspace(0, 1, k); f[-k:] = np.linspace(1, 0, k)
        parts += [x * f[:, None] / max(np.sqrt(np.mean(x ** 2)), 1e-9) * 0.08, np.zeros((int(0.5 * SR), 2))]
    out['atmo_beispiele.m4a'] = np.concatenate(parts)
    return out


if __name__ == '__main__':
    mix, info = build()
    lu = master_out(mix, os.path.join(ROOT, 'docs', 'audio', 'hoersaal_mix.m4a'))
    print('docs/audio/hoersaal_mix.m4a', f'{len(mix) / SR:.0f} s, {lu} LUFS', info)
    if '--reels' in sys.argv:
        for fn, x in reels().items():
            print('docs/audio/' + fn, f'{len(x) / SR:.0f} s, {master_out(x, os.path.join(ROOT, "docs", "audio", fn), -18.0)} LUFS')
