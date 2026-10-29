# Asset-Pipeline (Version 3)

Alles, was im Spiel zu sehen und zu hören ist, entsteht reproduzierbar aus freien Quellen und Skripten. Rohdaten und Werkzeuge
liegen nicht im Repository (`.gitignore`). Ins Repository kommen nur die verarbeiteten Fassungen in `assets/build/`.

## Überblick

| Schritt | Befehl | Eingabe | Ausgabe |
|---|---|---|---|
| Quellen laden | `npm run assets:fetch` | `tools/pipeline/sources.json` | `assets/src/` + `assets/src/fetched.json` (SHA-256) |
| Erreichbarkeit prüfen | `npm run assets:check` | `tools/pipeline/sources.json` | Bericht |
| Materialien | `node tools/pipeline/textures.mjs --profile desktop\|mobile` | ambientCG-Pakete | `assets/build/<profil>/textures/*.ktx2` |
| Figuren erzeugen | `node tools/pipeline/humans.mjs [--only prof] [--parallel 2]` | `tools/pipeline/humans.json`, MakeHuman-Pakete | `assets/build/humans/*.glb` (Rohfassung) |
| Figuren verpacken | `node tools/pipeline/humans-pack.mjs --profile desktop\|mobile` | Rohfassungen | `assets/build/<profil>/humans/` |
| Sprachkorpus | `node tools/voice/corpus.mjs` | Dialog- und Abschnittsdateien | `tools/.cache/voice/corpus.json` |
| Stimmen Deutsch | `tools/.venv/bin/python tools/voice/render.py --lang de` | Korpus | `assets/build/voice/de/` |
| Stimmen Englisch | `tools/.venv-kokoro/bin/python tools/voice/render_kokoro.py` | Korpus | `assets/build/voice/en/` |
| Lizenzliste | `node tools/pipeline/assets-doc.mjs` | Quellen, Figuren | `docs/ASSETS.md` |
| Desktop-Build | `npm run build:desktop` | Quellcode + `assets/build/desktop` | `dist/BOKU_TicTacTierernaehrung_v3.html` |
| Mobil-Build | `npm run build:mobile` | Quellcode + `assets/build/mobile` | `dist/mobile/`, ZIP |

## Werkzeuge

- **Blender 4.5 LTS** unter `tools/blender/` (ohne Oberfläche, per Skript), dazu die Erweiterung **MPFB 2**.
  `node tools/pipeline/humans.mjs --install` richtet MPFB und die MakeHuman-Assetpakete ein.
- **Node 22** mit `sharp`, `ktx2-encoder` (Basis Universal), `@gltf-transform`, `meshoptimizer`.
- **Python 3.13** in `tools/.venv` (Coqui XTTS v2, faster-whisper, torchaudio, pyloudnorm) und **Python 3.12** in
  `tools/.venv-kokoro` (Kokoro-82M). Beide Umgebungen entstehen mit `uv venv` und `uv pip install`.
- **ffmpeg** mit libopus für das Mastering.

## Figuren

`tools/pipeline/blender/human.py` baut je Eintrag in `humans.json` eine Figur:

1. **Erzeugen** mit MPFB: Grundkörper (Alter, Geschlecht, Proportionen), Haut, Augen, Brauen, Wimpern, Haar, Zähne, Kleidung,
   Zubehör, Standardskelett. Menge-Figuren nutzen einen leichten Körper-Proxy.
2. **Aufräumen:** Hilfsgeometrie löschen, Polygonbudget je Teil (`maxVerts`) per Dezimieren.
3. **Kleidungsschichten:** Innere Schichten werden knapp unter die äußere gedrückt, erst je Vertex, dann je Flächenmitte.
   Danach entfernt ein Strahltest Flächen, die vollständig unter einer äußeren Schicht liegen. So entstehen weder Durchstoßstellen
   noch Lücken am Halsausschnitt. Schuhe liegen unter dem Hosensaum.
4. **Pose:** Arme und Beine werden gerade gestellt, damit die Spielanimation mit Drehungen um feste Achsen arbeitet.
5. **Spielskelett:** Gewichte werden auf das Skelett des Spiels übertragen (Hände mit allen Fingergliedern bei Hauptfiguren).
6. **Export** als GLB mit vereinfachten Materialien und einer Metadatei (Gelenke, Eltern, Teile).

`tools/pipeline/humans-pack.mjs` verpackt für das Spiel:

- Texturen jeder Hauptfigur in einen Farb- und einen Normalenatlas, die Menge in zwei gemeinsame Atlanten (Frauen, Männer).
  Farbe als KTX2 ETC1S, Normalen als KTX2 UASTC. Profil `mobile` halbiert die Kachelgrößen.
- Geometrie im kompakten Binärformat HPK (gzip): Positionen, Normalen, Atlas-UVs, Knochen, Gewichte, Oberflächenwerte.
- Für die Menge zusätzlich eine **Detailstufe 1** mit rund 30 % der Dreiecke (meshoptimizer). Im Spiel bekommen nur die
  Sitznachbar:innen rund um den eigenen Platz die volle Geometrie.

Prüfansicht: `node tools/humanview-packed.mjs prof,m01,fp:player_a desktop <ordner>` rendert Ganzkörper, Gesicht und Ich-Perspektive.

## Stimmen

- **Korpus:** Jeder gesprochene Satz bekommt eine Kennung (FNV-1a über Sprache, Sprecher:in, Text). Sätze mit Platzhaltern werden
  in Stücke geteilt, die Werte (Reihe, Minuten) als eigene Aufnahmen.
- **Sprechfassung:** `tools/voice/normalize.py` schreibt Zahlen, Einheiten, Jahreszahlen und Fachabkürzungen aus.
- **Modelle:** Deutsch mit Coqui XTTS v2, Englisch mit Kokoro-82M. Beide mit eingebauten synthetischen Stimmen, keine geklonte
  reale Person. Auswahl und Messwerte stehen in `docs/AUDIO.md`.
- **Mastering** (`tools/voice/master.py`): Hochpass, De-Esser, Stille kürzen, −16 LUFS, True Peak −1,5 dBTP, Opus 28 kbit/s,
  Lautstärkekurve 20 Hz für die Mundbewegung.
- Beide Renderer sind wiederaufnehmbar: vorhandene Aufnahmen werden übersprungen.

## Einbettung

- **Desktop:** `tools/build.mjs` bettet Figuren, KTX2-Transkodierer und Stimmen als Base64 in `<script type="text/plain">`-Blöcke ein.
  Die Datei läuft offline per Doppelklick.
- **Mobil:** `tools/build-mobile.mjs` legt dieselben Dateien einzeln ab. Das Spiel lädt sie per `fetch`, der Service Worker hält sie
  für den Offline-Betrieb vor (siehe `docs/MOBILE.md`).

## Messwerkzeuge

| Werkzeug | Zweck |
|---|---|
| `node tools/sharpness.mjs --label v3` | Schärfe und Lesbarkeit (Laplace, OCR) je Kamera und DPR → `docs/schaerfe/` |
| `node tools/sharpness-report.mjs` | Tabelle `docs/SCHAERFE.md` |
| `node tools/sim.mjs --runs 80 --difficulty all` | Spielbalance mit dem Test-Bot |
| `tools/.venv/bin/python tools/voice/eval_tts.py score` | Stimmen bewerten (Wortfehlerrate, Signalqualität) |
