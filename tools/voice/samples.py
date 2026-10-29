# Hörproben (Auftrag V3, Anhang E): 30 zufällige Prof-Sätze je Sprache als AAC (.m4a) + Transkript.
#   python3 -I tools/voice/samples.py [--n 30] [--seed 7]
# Quelle: assets/build/voice/<sprache>/manifest.json + <id>.ogg (für Deutsch während eines laufenden Renderlaufs auch der
# Arbeitsordner VOICE_OUT). Ausgabe: docs/audio/beispiele/<sprache>_<nn>.m4a, docs/audio/beispiele/TRANSKRIPT.md
import json, os, random, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
args = sys.argv[1:]
opt = lambda k, d: args[args.index('--' + k) + 1] if '--' + k in args else d
N, SEED = int(opt('n', 30)), int(opt('seed', 7))
OUT = os.path.join(ROOT, 'docs', 'audio', 'beispiele'); os.makedirs(OUT, exist_ok=True)
ENGINE = {'de': 'Coqui XTTS v2 (Studiosprecher „Damien Black“, synthetisch; CPML, nicht-kommerziell)', 'en': 'Kokoro-82M (Stimme „bm_daniel“, Apache-2.0)'}
md = ['# Hörproben Prof. Haferkorn', '', f'Je Sprache {N} zufällig gezogene Sätze des Profs (Zufallszahl {SEED}), gemastert wie im Spiel (−16 LUFS, Opus → AAC für diese Proben).', '']
for lang in ('de', 'en'):
    base = os.path.join(ROOT, 'assets', 'build', 'voice', lang)
    stage = os.path.join(os.environ.get('VOICE_OUT', os.path.join(ROOT, 'tools', '.cache', 'voice', 'out')), lang)
    src = stage if lang == 'de' and os.path.isfile(os.path.join(stage, 'manifest.json')) else base
    man = json.load(open(os.path.join(src, 'manifest.json'), encoding='utf-8')); clips = man.get('clips', man)
    pool = sorted(k for k, v in clips.items() if v.get('s') == 'prof' and os.path.isfile(os.path.join(src, k + '.ogg')))
    pick = random.Random(SEED).sample(pool, min(N, len(pool)))
    for f in os.listdir(OUT):
        if f.startswith(lang + '_') and f.endswith('.m4a'): os.remove(os.path.join(OUT, f))
    md += [f'## {"Deutsch" if lang == "de" else "Englisch"}', '', f'Modell: {ENGINE[lang]}. Gezogen aus {len(pool)} vorhandenen Prof-Aufnahmen.', '', '| Datei | Art | Dauer | Text |', '|---|---|---|---|']
    for i, k in enumerate(pick, 1):
        v = clips[k]
        name = f'{lang}_{i:02d}.m4a'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(src, k + '.ogg'), '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, name)], check=True)
        md.append(f'| `{name}` | {v.get("k", "")} | {v["d"]:.1f} s | {v["t"].replace("|", "/")} |')
    md.append('')
    print(lang, len(pick), 'Proben aus', len(pool))
open(os.path.join(OUT, 'TRANSKRIPT.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
