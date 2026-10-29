"""Auswahl der Profstimme ohne Schlüssel (Auftrag V3, Anhang E, Stufe 2).

Synthetisiert Prüfsätze mit offenen Modellen und bewertet sie objektiv, weil ein Hörtest im Container nicht möglich ist:
  * Verständlichkeit: faster-whisper transkribiert zurück -> Wortfehlerrate (WER) gegen den Quelltext
  * Signalqualität: torchaudio SQUIM (geschätzte STOI/PESQ/SI-SDR ohne Referenz) -> Rauschen/Artefakte
  * Lautheit/Rauschboden: pyloudnorm (LUFS), leisestes 300-ms-Fenster (dBFS RMS)
  * Tempo: Echtzeitfaktor (Rechenzeit / Audiodauer)
Ergebnis: tools/.cache/voice_eval/*.wav + results.json; Zusammenfassung in docs/AUDIO.md (Stimme).

Aufruf:  tools/.venv/bin/python tools/voice/eval_tts.py xtts      (Coqui XTTS v2, eingebaute Studiosprecher)
         tools/.venv-cb/bin/python tools/voice/eval_tts.py chatterbox --ref <wav>   (Chatterbox Multilingual)
         tools/.venv/bin/python tools/voice/eval_tts.py score       (bewertet alle erzeugten Dateien)
"""
import json, os, sys, time, glob, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'tools', '.cache', 'voice_eval')
os.makedirs(OUT, exist_ok=True)

DE = [
    "Herrschaften, grüß Gott! Heute geht's um die Weender Analyse – die ist älter als die Straßenbahn in Wien.",
    "Rohprotein, Rohfett, Rohfaser, Rohasche – und der Rest sind die stickstofffreien Extraktstoffe.",
    "Im Pansen leben Bakterien, Protozoen und Pilze. Die machen aus Zellulose flüchtige Fettsäuren.",
    "Das kommt zur Prüfung. Ich sag das nicht, weil ich's muss. Ich sag's, weil ich's gern sag.",
    "Eine Milchkuh mit vierzig Kilogramm Milch braucht ungefähr hundertzwanzig Megajoule Nettoenergie Laktation am Tag.",
    "Herr Kollege in Reihe fünf, ich weiß nicht, was auf Ihrem Bildschirm so spannend ist – aber ich wette, es hat keinen Pansen.",
    "Gras ist kein Futtermittel. Gras ist ein Zustand.",
    "So, jetzt wird's wichtig. Sie dürfen das mitschreiben.",
]
EN = [
    "Good morning, ladies and gentlemen. Today we're talking about the Weende analysis – older than the Vienna tram network.",
    "Crude protein, crude fat, crude fibre and ash – the rest is nitrogen-free extract.",
    "That will be on the exam. I'm not saying it because I have to. I'm saying it because I enjoy it.",
    "The gentleman in row five – I don't know what's on your screen, but I bet it doesn't have a rumen.",
]
XTTS_SPEAKERS = ['Viktor Menelaos', 'Baldur Sanjin', 'Damien Black', 'Ludvig Milivoj', 'Craig Gutsy', 'Torcull Diarmuid', 'Dionisio Schuyler', 'Aaron Dreschner']


def save(path, wav, sr):
    import soundfile as sf
    sf.write(path, wav, sr)


def run_xtts():
    os.environ['COQUI_TOS_AGREED'] = '1'  # CPML (nicht-kommerziell) – Fan-Projekt, in docs/ASSETS.md vermerkt
    import torch
    torch.set_num_threads(4)
    from TTS.api import TTS
    tts = TTS('tts_models/multilingual/multi-dataset/xtts_v2').to('cpu')
    meta = []
    nspk = int(os.environ.get('EVAL_SPEAKERS', len(XTTS_SPEAKERS))); nde = int(os.environ.get('EVAL_DE', len(DE)))
    for spk in XTTS_SPEAKERS[:nspk]:
        for lang, sents in (('de', DE[:nde]), ('en', EN[:2])):
            for i, s in enumerate(sents):
                f = os.path.join(OUT, f"xtts_{spk.replace(' ', '_')}_{lang}{i}.wav")
                if os.path.exists(f):
                    continue
                t0 = time.time()
                wav = tts.tts(text=s, speaker=spk, language=lang)
                dt = time.time() - t0
                save(f, wav, 24000)
                meta.append({'file': os.path.basename(f), 'engine': 'xtts_v2', 'voice': spk, 'lang': lang, 'text': s, 'secs': dt})
                print(f'{spk} {lang}{i}: {dt:.1f}s', flush=True)
                json.dump(meta, open(os.path.join(OUT, 'meta_xtts.json'), 'w'), ensure_ascii=False, indent=1)


def run_chatterbox(ref):
    import torch, torchaudio
    torch.set_num_threads(4)
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    meta = []
    tag = os.path.splitext(os.path.basename(ref))[0] if ref else 'default'
    for lang, sents in (('de', DE), ('en', EN)):
        for i, s in enumerate(sents):
            f = os.path.join(OUT, f'cb_{tag}_{lang}{i}.wav')
            if os.path.exists(f):
                continue
            t0 = time.time()
            kw = {'language_id': lang, 'exaggeration': 0.55, 'cfg_weight': 0.45}
            if ref:
                kw['audio_prompt_path'] = ref
            wav = model.generate(s, **kw)
            dt = time.time() - t0
            torchaudio.save(f, wav, model.sr)
            meta.append({'file': os.path.basename(f), 'engine': 'chatterbox_mtl', 'voice': tag, 'lang': lang, 'text': s, 'secs': dt})
            print(f'cb {tag} {lang}{i}: {dt:.1f}s', flush=True)
            json.dump(meta, open(os.path.join(OUT, f'meta_cb_{tag}.json'), 'w'), ensure_ascii=False, indent=1)


def norm_words(s):
    s = s.lower().replace("'s", 's')
    s = re.sub(r"[^\wäöüß ]+", ' ', s)
    return [w for w in s.split() if w]


def wer(ref, hyp):
    r, h = norm_words(ref), norm_words(hyp)
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1): d[i][0] = i
    for j in range(len(h) + 1): d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1][-1] / max(1, len(r))


def score():
    import numpy as np, soundfile as sf, pyloudnorm as pyln, torch, torchaudio
    from faster_whisper import WhisperModel
    asr = WhisperModel('small', device='cpu', compute_type='int8')
    squim = torchaudio.pipelines.SQUIM_OBJECTIVE.get_model()
    meta = []
    for m in glob.glob(os.path.join(OUT, 'meta_*.json')):
        meta += json.load(open(m))
    res = []
    for e in meta:
        f = os.path.join(OUT, e['file'])
        wav, sr = sf.read(f, dtype='float32')
        if wav.ndim > 1: wav = wav.mean(axis=1)
        dur = len(wav) / sr
        lufs = pyln.Meter(sr).integrated_loudness(wav) if dur > 0.5 else None
        win = int(0.3 * sr)
        rms = [np.sqrt(np.mean(wav[i:i + win] ** 2)) for i in range(0, max(1, len(wav) - win), win // 2)]
        floor_db = 20 * np.log10(max(1e-9, min(rms)))
        segs, _ = asr.transcribe(f, language=e['lang'], beam_size=5)
        hyp = ' '.join(s.text for s in segs)
        w16 = torchaudio.functional.resample(torch.from_numpy(wav)[None], sr, 16000)
        with torch.no_grad():
            stoi, pesq, sisdr = [float(x) for x in squim(w16)]
        r = {**e, 'dur': round(dur, 2), 'rtf': round(e['secs'] / max(dur, 1e-3), 2), 'lufs': round(lufs, 1) if lufs else None,
             'floor_dbfs': round(floor_db, 1), 'wer': round(wer(e['text'], hyp), 3), 'hyp': hyp.strip(),
             'stoi': round(stoi, 3), 'pesq': round(pesq, 2), 'sisdr': round(sisdr, 1)}
        res.append(r)
        print(f"{e['file']}: WER {r['wer']:.2f} PESQ~{r['pesq']} STOI~{r['stoi']} SI-SDR~{r['sisdr']} RTF {r['rtf']}", flush=True)
    json.dump(res, open(os.path.join(OUT, 'results.json'), 'w'), ensure_ascii=False, indent=1)
    # Zusammenfassung je Stimme
    by = {}
    for r in res:
        by.setdefault((r['engine'], r['voice'], r['lang']), []).append(r)
    print('\nengine | voice | lang | n | WER | PESQ~ | STOI~ | SI-SDR~ | RTF')
    for k, v in sorted(by.items(), key=lambda kv: (kv[0][2], np.mean([x['wer'] for x in kv[1]]))):
        mean = lambda key: np.mean([x[key] for x in v])
        print(f"{k[0]} | {k[1]} | {k[2]} | {len(v)} | {mean('wer'):.3f} | {mean('pesq'):.2f} | {mean('stoi'):.3f} | {mean('sisdr'):.1f} | {mean('rtf'):.2f}")


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'xtts':
        run_xtts()
    elif cmd == 'chatterbox':
        ref = sys.argv[sys.argv.index('--ref') + 1] if '--ref' in sys.argv else None
        run_chatterbox(ref)
    elif cmd == 'score':
        score()
