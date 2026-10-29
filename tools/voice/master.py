"""Mastering einer Sprachaufnahme (gemeinsam für alle Sprachmodelle): Hochpass 80 Hz, leichte De-Esser-Absenkung (−3 dB um 6,5 kHz),
Stille am Anfang/Ende auf ≤ 80 ms, Lautheit −16 LUFS (EBU R128, zweistufig), True Peak −1,5 dBTP, Opus 28 kbit/s mono 48 kHz.
Rückgabe: (Dauer in s, Lautstärkekurve 20 Hz als Base64-Bytes 0–255) für die Mundbewegung im Spiel."""
import json, os, re, subprocess, base64
import numpy as np


def master(wav_in, ogg_out):
    """ffmpeg: Filterkette + zweistufige Lautheitsnormierung, Opus 28 kbit/s"""
    pre = 'highpass=f=80,equalizer=f=6500:t=q:w=1.2:g=-3,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.07,areverse'
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', wav_in, '-af', pre + ',loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr, re.S)
    meas = json.loads(m.group(0)) if m else None
    ln = 'loudnorm=I=-16:TP=-1.5:LRA=9'
    if meas: ln += f":measured_I={meas['input_i']}:measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}:linear=true"
    tmp = ogg_out + '.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', wav_in, '-af', pre + ',' + ln + ',aresample=48000', '-ac', '1', '-c:a', 'pcm_s16le', tmp], check=True)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libopus', '-b:a', '28k', '-vbr', 'on', '-application', 'voip', '-frame_duration', '20', ogg_out], check=True)
    import soundfile as sf
    x, sr = sf.read(tmp, dtype='float32'); os.remove(tmp)
    if x.ndim > 1: x = x.mean(axis=1)
    hop = sr // 20
    env = [float(np.sqrt(np.mean(x[i:i + hop] ** 2))) for i in range(0, len(x), hop)]
    peak = max(env) or 1
    env8 = bytes(int(min(255, 255 * (e / peak) ** 0.6)) for e in env)
    return len(x) / sr, base64.b64encode(env8).decode()


