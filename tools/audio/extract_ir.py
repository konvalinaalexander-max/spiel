"""Echte Hörsaal-Impulsantworten aus dem SOFA-Datensatz holen (Auftrag V3, Phase 6b, Hall).

Quelle: H. Wierstorf, M. Geier: „Binaural room impulse responses recorded with KEMAR in a mid-size lecture hall“
(Auditorium 3, Telefunken-Hochhaus der TU Berlin), Zenodo 10.5281/zenodo.160749, CC BY 4.0.
Datei: assets/src/audio/zenodo/wierstorf-auditorium3/QU_KEMAR_Auditorium3.sofa (343 MB, MD5 f5d47d69…, siehe audio_sources.json).

Messaufbau (measurement_setup_sketch.pdf): Kunstkopf KEMAR bei (0, 0), Blick +y; sechs Lautsprecher (Genelec 8250A),
Kopf in 1°-Schritten von 0° bis 180° (globaler Azimut) gedreht. Wir nehmen je Position den Kopfwinkel, der zur Quelle schaut:
  vorne  = Lautsprecher 4, 1,50 m geradeaus  (Kopf 90°)  → wie ein Platz in den ersten Reihen
  hinten = Lautsprecher 2, 5,49 m schräg vorn (Kopf 38°)  → wie ein Platz weiter hinten (mehr Nachhall, weniger Direktschall)
Ausgabe: 44,1 kHz, Stereo (linkes/rechtes Ohr), 32-bit float WAV unter …/x/ – weiterverarbeitet in tools/audio/build_sfx.py.

    python3 -m venv tools/.venv-ir && tools/.venv-ir/bin/pip install h5py numpy
    tools/.venv-ir/bin/python -I tools/audio/extract_ir.py
"""
import os, subprocess, sys
import h5py, numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets', 'src', 'audio', 'zenodo', 'wierstorf-auditorium3', 'QU_KEMAR_Auditorium3.sofa')
OUT = os.path.join(os.path.dirname(SRC), 'x')
PICK = {'front': 4, 'back': 2}  # Lautsprecher-Nummer (1-basiert)


def main():
    f = h5py.File(SRC, 'r')
    sr = int(f['Data.SamplingRate'][()][0])
    if f.attrs.get('License', b'') not in (b'Creative Commons Attribution 4.0', 'Creative Commons Attribution 4.0'):
        sys.exit('Lizenzangabe im SOFA-Kopf weicht ab – abgebrochen')
    az = f['ListenerView'][()][:, 0]
    em = f['EmitterPosition'][()][:, :, 0]
    os.makedirs(OUT, exist_ok=True)
    for name, e in PICK.items():
        x, y = em[e - 1, 0], em[e - 1, 1]
        a = float(np.degrees(np.arctan2(y, x))); idx = int(np.argmin(np.abs(az - a)))
        ir = np.asarray(f['Data.IR'][idx, :, e - 1, :], dtype=np.float32)  # (2 Ohren, N)
        path = os.path.join(OUT, f'auditorium3_{name}_ls{e}_az{int(round(az[idx]))}.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', path],
                       input=np.ascontiguousarray(ir.T).tobytes(), check=True)
        print(f'{name}: Lautsprecher {e} ({x:.2f} m, {y:.2f} m), Abstand {np.hypot(x, y):.2f} m, Kopf {az[idx]:.0f}° → {os.path.relpath(path, ROOT)}')


if __name__ == '__main__':
    main()
