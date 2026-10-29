"""Stimmen vorrendern (Auftrag V3, Phase 6, Stufe 2 ohne API-Schlüssel): offenes Modell XTTS v2 mit eingebauten,
synthetischen Studiosprechern (keine geklonte reale Person), danach Mastering mit ffmpeg.

    tools/.venv/bin/python tools/voice/render.py [--lang de] [--speaker prof] [--limit 200] [--order events,asides,beats]

Eingabe:  tools/.cache/voice/corpus.json  (node tools/voice/corpus.mjs)
Ausgabe:  assets/build/voice/<lang>/<id>.ogg  (Opus 28 kbit/s mono, 48 kHz) + manifest.json (Dauer, Lautstärkekurve 20 Hz)
Wiederaufnahme: vorhandene Dateien werden übersprungen; jederzeit abbrechbar.

Mastering je Clip: Hochpass 80 Hz, leichte De-Esser-Absenkung (−3 dB um 6,5 kHz), Stille am Anfang/Ende auf ≤ 80 ms,
Lautheit −16 LUFS (EBU R128, zweistufig), True Peak −1 dBTP, kein Hall (der kommt zur Laufzeit aus dem Raum).
"""
import json, os, sys, time, subprocess, base64, hashlib, re
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.dirname(__file__))
from normalize import speech  # noqa: E402
from master import master  # noqa: E402

ARGS = sys.argv[1:]
opt = lambda k, d=None: ARGS[ARGS.index('--' + k) + 1] if '--' + k in ARGS else d
LANGS = (opt('lang') or 'de,en').split(',')
SPEAKERS = (opt('speaker') or 'prof,neighbor,student_f,student_m').split(',')
LIMIT = int(opt('limit', '0'))
ORDER = (opt('order') or 'part,event,question,var-row,var-minutes,title,aside,lecture').split(',')
# Stimmen: eingebaute XTTS-Studiosprecher (synthetisch). Auswahl siehe docs/AUDIO.md (Prüfsätze, WER/SQUIM).
VOICE = {'prof': os.environ.get('PROF_VOICE', 'Damien Black'), 'neighbor': 'Daisy Studious', 'student_f': 'Sofia Hellen', 'student_m': 'Andrew Chipper'}
SPEED = {'prof': 0.95, 'neighbor': 1.05, 'student_f': 1.05, 'student_m': 1.05}
# VOICE_OUT: Arbeitsordner während langer Läufe (z. B. tools/.cache/voice/out), übernommen mit tools/voice/sync.py
OUT = os.environ.get('VOICE_OUT') or os.path.join(ROOT, 'assets', 'build', 'voice')
TMP = os.path.join(ROOT, 'tools', '.cache', 'voice', 'wav')
os.makedirs(TMP, exist_ok=True)

corpus = json.load(open(os.path.join(ROOT, 'tools', '.cache', 'voice', 'corpus.json'), encoding='utf-8'))
clips = [c for c in corpus['clips'] if c['lang'] in LANGS and c['speaker'] in SPEAKERS]
rank = {k: i for i, k in enumerate(ORDER)}
# Reihenfolge: Ereignis-Sätze, Fragen, Werte, Titel, Anekdoten, dann Lehrsätze (je Takt zuerst Variante 0, dann 1, 2)
clips.sort(key=lambda c: (LANGS.index(c['lang']), c.get('vi', 0) if c['kind'] == 'lecture' else -1, rank.get(c['kind'], 99), SPEAKERS.index(c['speaker'])))
if LIMIT: clips = clips[:LIMIT]


def manifest_path(lang): return os.path.join(OUT, lang, 'manifest.json')


def load_manifest(lang):
    p = manifest_path(lang)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def main():
    os.environ['COQUI_TOS_AGREED'] = '1'  # CPML: nicht-kommerziell – Fan-Projekt, in docs/ASSETS.md vermerkt
    import torch
    torch.set_num_threads(int(os.environ.get('THREADS', '4')))
    from TTS.api import TTS
    tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to('cpu')
    import soundfile as sf
    man = {l: load_manifest(l) for l in LANGS}
    todo = [c for c in clips if c['id'] not in man[c['lang']]]
    print(f'{len(todo)} von {len(clips)} Aufnahmen offen', flush=True)
    t0 = time.time(); audio = 0.0
    for i, c in enumerate(todo):
        lang, sp = c['lang'], c['speaker']
        text = speech(c['text'], lang)
        if c['kind'].startswith('var-'): text = text + '.'
        os.makedirs(os.path.join(OUT, lang), exist_ok=True)
        wav = os.path.join(TMP, f"{lang}_{c['id']}.wav"); ogg = os.path.join(OUT, lang, c['id'] + '.ogg')
        ts = time.time()
        try:
            y = tts.tts(text=text, speaker=VOICE[sp], language=lang, speed=SPEED.get(sp, 1.0), temperature=0.65, repetition_penalty=5.0)
        except Exception as e:  # sehr kurze oder ungewöhnliche Texte
            print('FEHLER', c['id'], text[:60], e, flush=True); continue
        sf.write(wav, np.asarray(y, dtype=np.float32), 24000)
        dur, env = master(wav, ogg); os.remove(wav)
        man[lang][c['id']] = {'d': round(dur, 3), 'e': env, 's': sp, 'k': c['kind'], 't': c['text'], 'v': VOICE[sp], 'sha': hashlib.sha256(open(ogg, 'rb').read()).hexdigest()[:16]}
        audio += dur
        if i % 5 == 0 or i == len(todo) - 1:
            for l in LANGS: json.dump(man[l], open(manifest_path(l), 'w', encoding='utf-8'), ensure_ascii=False)
        el = time.time() - t0
        print(f'[{i + 1}/{len(todo)}] {lang} {sp} {c["kind"]} {dur:.1f}s Audio in {time.time() - ts:.1f}s · gesamt {audio / 60:.1f} min Audio, {el / 60:.1f} min Rechenzeit, Echtzeitfaktor {el / max(audio, 1):.2f}', flush=True)
    for l in LANGS: json.dump(man[l], open(manifest_path(l), 'w', encoding='utf-8'), ensure_ascii=False)


if __name__ == '__main__':
    main()
