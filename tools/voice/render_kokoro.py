"""Englische Stimmen mit Kokoro-82M vorrendern (Apache-2.0, eingebaute synthetische Stimmen, keine geklonte reale Person).
Kokoro klingt im Englischen natürlicher als XTTS und rechnet etwa zehnmal schneller; Deutsch kann es nicht (dafür bleibt XTTS).

    tools/.venv-kokoro/bin/python tools/voice/render_kokoro.py [--speaker prof] [--limit 200]

Eingabe/Ausgabe wie tools/voice/render.py: tools/.cache/voice/corpus.json → assets/build/voice/en/<id>.ogg + manifest.json.
Gemeinsames Mastering: tools/voice/master.py. Wiederaufnahme: vorhandene Aufnahmen werden übersprungen.
"""
import json, os, sys, time, hashlib
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from normalize import speech  # noqa: E402
from master import master  # noqa: E402

ARGS = sys.argv[1:]
opt = lambda k, d=None: ARGS[ARGS.index('--' + k) + 1] if '--' + k in ARGS else d
SPEAKERS = (opt('speaker') or 'prof,neighbor,student_f,student_m').split(',')
LIMIT = int(opt('limit', '0'))
ORDER = 'part,event,question,var-row,var-minutes,title,aside,lecture'.split(',')
# Stimmen (Auswahl nach Prüfsätzen, siehe docs/AUDIO.md): erster Buchstabe a = amerikanisch, b = britisch
VOICE = {'prof': os.environ.get('PROF_VOICE_EN', 'bm_daniel'), 'neighbor': 'bf_emma', 'student_f': 'af_heart', 'student_m': 'am_michael'}
SPEED = {'prof': 0.95, 'neighbor': 1.03, 'student_f': 1.03, 'student_m': 1.03}
OUT = os.path.join(ROOT, 'assets', 'build', 'voice', 'en')
TMP = os.path.join(ROOT, 'tools', '.cache', 'voice', 'wav')
os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)

corpus = json.load(open(os.path.join(ROOT, 'tools', '.cache', 'voice', 'corpus.json'), encoding='utf-8'))
clips = [c for c in corpus['clips'] if c['lang'] == 'en' and c['speaker'] in SPEAKERS]
rank = {k: i for i, k in enumerate(ORDER)}
clips.sort(key=lambda c: (c.get('vi', 0) if c['kind'] == 'lecture' else -1, rank.get(c['kind'], 99), SPEAKERS.index(c['speaker'])))
if LIMIT: clips = clips[:LIMIT]
MAN = os.path.join(OUT, 'manifest.json')


def main():
    import torch, soundfile as sf
    from kokoro import KPipeline
    torch.set_num_threads(int(os.environ.get('THREADS', '3')))
    pipes = {}
    pipe = lambda v: pipes.get(v[0]) or pipes.setdefault(v[0], KPipeline(lang_code=v[0], repo_id='hexgrad/Kokoro-82M'))
    man = json.load(open(MAN, encoding='utf-8')) if os.path.exists(MAN) else {}
    todo = [c for c in clips if c['id'] not in man]
    print(f'{len(todo)} von {len(clips)} Aufnahmen offen', flush=True)
    t0 = time.time(); audio = 0.0
    for i, c in enumerate(todo):
        sp = c['speaker']; v = VOICE[sp]
        text = speech(c['text'], 'en')
        if c['kind'].startswith('var-'): text = text + '.'
        wav = os.path.join(TMP, f"en_{c['id']}.wav"); ogg = os.path.join(OUT, c['id'] + '.ogg')
        try:
            y = np.concatenate([a.numpy() for _, _, a in pipe(v)(text, voice=v, speed=SPEED.get(sp, 1.0))])
        except Exception as e:
            print('FEHLER', c['id'], text[:60], e, flush=True); continue
        sf.write(wav, y.astype(np.float32), 24000)
        dur, env = master(wav, ogg); os.remove(wav)
        man[c['id']] = {'d': round(dur, 3), 'e': env, 's': sp, 'k': c['kind'], 't': c['text'], 'v': 'kokoro:' + v, 'sha': hashlib.sha256(open(ogg, 'rb').read()).hexdigest()[:16]}
        audio += dur
        if i % 10 == 0 or i == len(todo) - 1: json.dump(man, open(MAN, 'w', encoding='utf-8'), ensure_ascii=False)
        el = time.time() - t0
        if i % 10 == 0: print(f'[{i + 1}/{len(todo)}] {sp} {c["kind"]} · {audio / 60:.1f} min Audio in {el / 60:.1f} min, Echtzeitfaktor {el / max(audio, 1):.2f}', flush=True)
    json.dump(man, open(MAN, 'w', encoding='utf-8'), ensure_ascii=False)
    print('fertig', flush=True)


if __name__ == '__main__':
    main()
