# Fertige Aufnahmen aus dem Arbeitsordner eines langen Laufs (VOICE_OUT, Standard tools/.cache/voice/out) nach
# assets/build/voice/<sprache>/ übernehmen: neue/geänderte .ogg kopieren, Verzeichnis (manifest.json) ersetzen.
#   python3 -I tools/voice/sync.py [--lang de]
import json, os, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
# mehrere Arbeitsordner (z. B. aus --shard-Läufen) mit Doppelpunkt getrennt: VOICE_OUT=…/out0:…/out1
src_roots = (os.environ.get('VOICE_OUT') or os.path.join(ROOT, 'tools', '.cache', 'voice', 'out')).split(':')
langs = sys.argv[sys.argv.index('--lang') + 1].split(',') if '--lang' in sys.argv else ['de']
for lang in langs:
    dst = os.path.join(ROOT, 'assets', 'build', 'voice', lang)
    dm = os.path.join(dst, 'manifest.json')
    man = json.load(open(dm, encoding='utf-8')) if os.path.isfile(dm) else {}
    n = 0
    for root in src_roots:
        src = os.path.join(root, lang)
        if not os.path.isfile(os.path.join(src, 'manifest.json')): print(lang, ': kein Arbeitsordner', src); continue
        part = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
        for k, v in part.items():
            a, b = os.path.join(src, k + '.ogg'), os.path.join(dst, k + '.ogg')
            if not os.path.isfile(a): continue
            if not os.path.exists(b) or os.path.getsize(a) != os.path.getsize(b) or os.path.getmtime(a) > os.path.getmtime(b): shutil.copy2(a, b); n += 1
            man[k] = v
    json.dump(man, open(dm, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{lang}: {n} Aufnahmen übernommen, Verzeichnis mit {len(man)} Einträgen')
