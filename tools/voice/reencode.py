# Aufnahmen einer Sprache neu mit niedrigerer Opus-Bitrate kodieren (Speicherbudget Sprache ≤ 50 MB je Sprache, Auftrag V3).
#   python3 -I tools/voice/reencode.py --lang de --kbps 20 [--src tools/.cache/voice/out0:tools/.cache/voice/out1]
# Quelle: gleichnamige Datei aus --src (z. B. die 28-kbit/s-Arbeitsordner, vermeidet doppelte Kodierverluste), sonst die Datei selbst.
# Opus überschwingt bei niedriger Bitrate: vor dem Kodieren ein Limiter (−3,3 dBFS, 4-fach überabgetastet), danach True Peak
# messen und bei > −1 dBTP mit strengerem Limiter wiederholen. Dauer bleibt gleich (Verzeichnis unverändert);
# Prüfung danach mit node tools/audio-check.mjs.
import os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
a = sys.argv[1:]; arg = lambda k, d: a[a.index(k) + 1] if k in a else d
lang, kbps = arg('--lang', 'de'), arg('--kbps', '20')
srcs = [os.path.join(p if os.path.isabs(p) else os.path.join(ROOT, p), lang) for p in arg('--src', '').split(':') if p]
d = os.path.join(ROOT, 'assets', 'build', 'voice', lang)
files = sorted(f for f in os.listdir(d) if f.endswith('.ogg'))
def true_peak(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'Peak:\s+(-?[\d.]+|-inf) dBFS', r.stderr)
    return float(m[-1]) if m and m[-1] != '-inf' else -99.0
def one(f):
    src = next((os.path.join(s, f) for s in srcs if os.path.isfile(os.path.join(s, f))), os.path.join(d, f))
    tmp = os.path.join(d, f + '.tmp.ogg')
    for lim in (0.68, 0.6, 0.5):
        af = f'aresample=192000,alimiter=limit={lim}:attack=1:release=40:level=disabled,aresample=48000'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-af', af, '-c:a', 'libopus', '-b:a', kbps + 'k', '-vbr', 'on', '-application', 'voip', '-frame_duration', '20', tmp], check=True)
        tp = true_peak(tmp)
        if tp <= -1.0: break
    os.replace(tmp, os.path.join(d, f))
    return src != os.path.join(d, f), tp
before = sum(os.path.getsize(os.path.join(d, f)) for f in files)
with ThreadPoolExecutor(4) as ex: res = list(ex.map(one, files))
after = sum(os.path.getsize(os.path.join(d, f)) for f in files)
print(f'{lang}: {len(files)} Aufnahmen ({sum(r[0] for r in res)} aus --src), {before / 1048576:.1f} MB → {after / 1048576:.1f} MB ({kbps} kbit/s), '
      f'True Peak max {max(r[1] for r in res):.1f} dBTP, {sum(r[1] > -1 for r in res)} über −1 dBTP')
