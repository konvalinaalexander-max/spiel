"""Quellaufnahmen für die Klangwelt laden (Auftrag V3, Phase 6b) – reproduzierbar aus tools/pipeline/audio_sources.json.

    tools/.venv/bin/python -I tools/audio/fetch_sfx.py               # alles laden, was fehlt
    tools/.venv/bin/python -I tools/audio/fetch_sfx.py --add neu.json  # neue Kandidaten prüfen, laden und eintragen
    tools/.venv/bin/python -I tools/audio/fetch_sfx.py --only sneeze,yawn

Regeln (Downloads sind nicht vertrauenswürdig):
- jede Datei landet in einem eigenen Verzeichnis unter assets/src/audio/<quelle>/<name>/ (gitignored),
- Prüfsumme (SHA-256) wird beim ersten Laden festgehalten und bei jedem weiteren Laden verglichen,
- aus Archiven (nur ZIP) wird ausschließlich das angegebene Mitglied entpackt, nach Prüfung des Pfads (kein „..“, kein absoluter
  Pfad) – nach <verzeichnis>/x/<archivPfad>,
- Python liest die Dateien nur über ffmpeg/ffprobe (Dekodierung) und zipfile; Aufruf immer mit `python -I`.
Gemessen wird je Datei: Dauer, Abtastrate, Kanäle, Codec, Bitrate, Spitze und Grundrauschen (leiseste 300 ms, RMS).
"""
import hashlib, json, os, subprocess, sys, zipfile
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_JSON = os.path.join(ROOT, 'tools', 'pipeline', 'audio_sources.json')
BASE = os.path.join(ROOT, 'assets', 'src', 'audio')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''): h.update(chunk)
    return h.hexdigest()


def inside(path, base):
    p, b = os.path.realpath(path), os.path.realpath(base)
    return p == b or p.startswith(b + os.sep)


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + '.part'
    subprocess.run(['curl', '-sS', '-L', '--fail', '--max-time', '1800', '-A', 'Mozilla/5.0 (X11; Linux x86_64) tic-tac-tierernaehrung-audio',
                    '-o', tmp, url], check=True)
    os.replace(tmp, dest)


def extract_member(archive, member, out_dir):
    """Nur ein Mitglied aus einem ZIP entpacken – Pfad vorher prüfen (Path Traversal)."""
    norm = os.path.normpath(member)
    if os.path.isabs(member) or norm.startswith('..') or '..' in norm.split(os.sep):
        raise ValueError(f'unsicherer Archivpfad: {member!r}')
    target = os.path.join(out_dir, norm)
    if not inside(target, out_dir): raise ValueError(f'Archivpfad außerhalb des Zielordners: {member!r}')
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        for n in names:  # ganzes Verzeichnis prüfen: ein Archiv mit bösartigen Pfaden wird nicht angefasst
            nn = os.path.normpath(n)
            if os.path.isabs(n) or nn.startswith('..'): raise ValueError(f'Archiv enthält unsicheren Pfad: {n!r}')
        if member not in names: raise KeyError(f'{member!r} nicht im Archiv ({len(names)} Einträge)')
        info = z.getinfo(member)
        if info.file_size > 400 << 20: raise ValueError('Mitglied zu groß')
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(info) as src, open(target, 'wb') as dst:
            while True:
                b = src.read(1 << 20)
                if not b: break
                dst.write(b)
    return target


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate:format=duration,bit_rate',
                        '-of', 'json', path], capture_output=True, text=True, check=True)
    j = json.loads(r.stdout); s = (j.get('streams') or [{}])[0]; fm = j.get('format', {})
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    win = 2400
    r50 = np.array([np.sqrt(np.mean(x[i:i + win] ** 2)) for i in range(0, max(1, len(x) - win), win)]) if len(x) > win else np.array([np.sqrt(np.mean(x ** 2))])
    nz = r50[r50 > 1e-6]
    floor = None
    if len(nz) >= 6:
        k = np.convolve(nz, np.ones(6) / 6, mode='valid')  # leiseste 300 ms (6 Fenster à 50 ms), digitale Stille ausgenommen
        floor = round(20 * np.log10(max(float(k.min()), 1e-9)), 1)
    br = s.get('bit_rate') or fm.get('bit_rate')
    return {'duration': round(float(fm.get('duration') or len(x) / 48000), 3), 'sampleRate': int(s.get('sample_rate') or 0),
            'channels': int(s.get('channels') or 0), 'codec': s.get('codec_name'), 'bitrateKbps': int(int(br) / 1000) if br else None,
            'peakDb': round(20 * np.log10(max(float(np.abs(x).max()) if len(x) else 0, 1e-9)), 1), 'noiseFloorDb': floor,
            'noiseFloorMethod': 'leiseste 300 ms (RMS, ohne digitale Stille)'}


def fetch(e, cache):
    f = os.path.join(ROOT, e['file'])
    if not inside(f, BASE): raise ValueError('Ziel liegt nicht unter assets/src/audio: ' + e['file'])
    if not os.path.exists(f):
        if e['url'] in cache and os.path.exists(cache[e['url']]):
            f = cache[e['url']]
        else:
            if os.path.isdir(os.path.dirname(f)) and os.listdir(os.path.dirname(f)) and not e.get('sharedDir'):
                print('  (Verzeichnis existiert schon, Datei fehlt – lade nach)', os.path.dirname(f))
            print('↓', e['url'], flush=True)
            download(e['url'], f)
    h = sha256(f)
    if e.get('sha256') and e['sha256'] != h: raise ValueError(f'SHA-256 stimmt nicht: {e["file"]} ({h[:16]} statt {e["sha256"][:16]})')
    e['sha256'] = h; cache[e['url']] = f
    target = f
    if f.endswith('.zip') and not e.get('archivePath'):
        # nur auflisten (Pfade prüfen) – welches Mitglied verwendet wird, steht danach in eigenen Einträgen mit archivePath
        with zipfile.ZipFile(f) as z:
            names = z.namelist()
        bad = [n for n in names if os.path.isabs(n) or os.path.normpath(n).startswith('..')]
        if bad: raise ValueError(f'Archiv enthält unsichere Pfade: {bad[:3]}')
        e['members'] = names; e['downloaded'] = True
        return e
    if e.get('extractedFile') and not e.get('archivePath'):
        # aus einem Datensatz abgeleitet (z. B. Impulsantworten aus SOFA, tools/audio/extract_ir.py)
        target = os.path.join(ROOT, e['extractedFile'])
        if not os.path.exists(target): raise FileNotFoundError(e['extractedFile'] + ' fehlt – zuerst das Ableitungsskript ausführen')
        e['extractedSha256'] = sha256(target)
    elif e.get('archivePath'):
        out_dir = os.path.join(os.path.dirname(f), 'x')
        target = os.path.join(out_dir, os.path.normpath(e['archivePath']))
        if not os.path.exists(target): target = extract_member(f, e['archivePath'], out_dir)
        e['extractedFile'] = os.path.relpath(target, ROOT); eh = sha256(target)
        if e.get('extractedSha256') and e['extractedSha256'] != eh: raise ValueError('SHA-256 des entpackten Mitglieds stimmt nicht: ' + e['archivePath'])
        e['extractedSha256'] = eh
    for k, v in probe(target).items():
        if k == 'noiseFloorDb' and e.get(k) is not None: continue
        e[k] = v
    e['downloaded'] = True
    return e


def main():
    args = sys.argv[1:]
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    data = json.load(open(SRC_JSON, encoding='utf-8'))
    added = []
    if '--add' in args:
        added = json.load(open(args[args.index('--add') + 1], encoding='utf-8'))
        known = {(e.get('file'), e.get('archivePath'), tuple(e.get('trim') or []), e['name']) for e in data['sounds']}
        added = [e for e in added if (e.get('file'), e.get('archivePath'), tuple(e.get('trim') or []), e['name']) not in known]
    cache, ok, bad = {}, 0, 0
    todo = added if added else [e for e in data['sounds'] if e.get('url') and e.get('file') and (not only or e['name'] in only)]
    for e in todo:
        try:
            fetch(e, cache); ok += 1
            print(f'✓ {e["name"]:14} {os.path.relpath(os.path.join(ROOT, e.get("extractedFile") or e["file"]), BASE)}  {e.get("duration")} s, '
                  f'{e.get("channels")} ch, {e.get("sampleRate")} Hz, Rauschen {e.get("noiseFloorDb")} dBFS', flush=True)
        except Exception as ex:
            bad += 1; e['downloaded'] = False; print('✗', e['name'], e.get('url'), ex, flush=True)
    if added:
        data['sounds'].extend([e for e in added if e.get('downloaded')])
    json.dump(data, open(SRC_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{ok} geladen/geprüft, {bad} fehlgeschlagen')


if __name__ == '__main__':
    main()
