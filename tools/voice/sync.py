# Fertige Aufnahmen aus dem Arbeitsordner eines langen Laufs (VOICE_OUT, Standard tools/.cache/voice/out) nach
# assets/build/voice/<sprache>/ übernehmen: neue/geänderte .ogg kopieren, Verzeichnis (manifest.json) ersetzen.
#   python3 -I tools/voice/sync.py [--lang de]
import json, os, shutil, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
src_root = os.environ.get('VOICE_OUT') or os.path.join(ROOT, 'tools', '.cache', 'voice', 'out')
langs = sys.argv[sys.argv.index('--lang') + 1].split(',') if '--lang' in sys.argv else ['de']
for lang in langs:
    src, dst = os.path.join(src_root, lang), os.path.join(ROOT, 'assets', 'build', 'voice', lang)
    if not os.path.isfile(os.path.join(src, 'manifest.json')): print(lang, ': kein Arbeitsordner'); continue
    man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8'))
    n = 0
    for f in os.listdir(src):
        if not f.endswith('.ogg'): continue
        a, b = os.path.join(src, f), os.path.join(dst, f)
        if not os.path.exists(b) or os.path.getsize(a) != os.path.getsize(b) or os.path.getmtime(a) > os.path.getmtime(b): shutil.copy2(a, b); n += 1
    shutil.copy2(os.path.join(src, 'manifest.json'), os.path.join(dst, 'manifest.json'))
    print(f'{lang}: {n} Aufnahmen übernommen, Verzeichnis mit {len(man.get("clips", man))} Einträgen')
