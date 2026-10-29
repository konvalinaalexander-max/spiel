# Asset-Pipeline (Version 3)

Alles, was im Spiel zu sehen und zu hören ist, entsteht reproduzierbar aus freien Quellen und Skripten. Rohdaten und Werkzeuge
liegen nicht im Repository (`.gitignore`). Ins Repository kommen nur die verarbeiteten Fassungen in `assets/build/`.

## Überblick

| Schritt | Befehl | Eingabe | Ausgabe |
|---|---|---|---|
| Quellen laden | `npm run assets:fetch` | `tools/pipeline/sources.json` | `assets/src/` + `assets/src/fetched.json` (SHA-256) |
| Erreichbarkeit prüfen | `npm run assets:check` | `tools/pipeline/sources.json` | Bericht |
| Materialien | `node tools/pipeline/textures.mjs --profile desktop\|mobile` | ambientCG-Pakete | `assets/build/<profil>/textures/*.ktx2` |
| Figuren laden (Rocketbox) | `python3 -I tools/pipeline/people-fetch.py` | `tools/pipeline/people.json` | `assets/src/rocketbox/` (FBX, Texturen als PNG, Animationen) |
| Figuren verpacken (Rocketbox) | `node tools/pipeline/people.mjs --profile desktop\|mobile [--only prof,clips]` | Rocketbox-FBX | `assets/build/<profil>/people/` (HPK, KTX2-Atlanten, Animationen CLP2) |
| Requisiten | `node tools/pipeline/props.mjs [--fetch] --profile desktop\|mobile` | `tools/pipeline/props.json`, Poly Haven | `assets/build/<profil>/props/` (GLB + Texturatlas) |
| Licht backen | `node tools/lightmap-export.mjs` → `blender … lightmap.py` → `node tools/pipeline/lightmap.mjs` | Saalgeometrie | `assets/build/<profil>/lightmap/` |
| ältere Figuren (Rückfall) | `node tools/pipeline/humans.mjs`, `humans-pack.mjs` | MakeHuman-Pakete | `assets/build/<profil>/humans/` (nur mit `--old-humans`) |
| Sprachkorpus | `node tools/voice/corpus.mjs` | Dialog- und Abschnittsdateien | `tools/.cache/voice/corpus.json` |
| Stimmen Deutsch | `VOICE_OUT=tools/.cache/voice/out tools/.venv/bin/python tools/voice/render.py --lang de`, danach `python3 -I tools/voice/sync.py` | Korpus | `assets/build/voice/de/` |
| Hörproben | `python3 -I tools/voice/samples.py` | Aufnahmen | `docs/audio/beispiele/` (30 je Sprache + Transkript) |
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

## Figuren (Microsoft Rocketbox, MIT)

Seit der Überarbeitung (Rückmeldung „steif, seltsame Hände, keine echten Animationen“) stammen alle Menschen aus der
**Microsoft Rocketbox Avatar Library** und bewegen sich mit deren **Motion-Capture-Aufnahmen**.

`tools/pipeline/people.mjs` liest die FBX-Dateien mit dem FBXLoader von three.js (in Node, ohne Browser). Blender scheidet hier
aus: Die Animationsdateien enthalten keine Bindepose, Blender rechnet die Spuren relativ zu einer fehlenden Ruhepose und verdreht
die Arme. three.js liest sie als absolute lokale Drehungen – sie passen ohne Umrechnung auf jede Rocketbox-Figur (gleiches
3ds-Max-Biped-Skelett, 81 Knochen).

1. **Ruhepose:** Geometrie per CPU-Skinning in die Bindepose, Knochen mit Eigendrehung (lokale Ruhe-TRS im HPK, `rest`) und
   Spielnamen als Verweise (`alias`: hips, head, handL …).
2. **Teile:** Körper, Kopf und Haar (Material „opacity“) verschweißt; Haar mit nach außen gekämmten Normalen
   (`tools/pipeline/hair.mjs`), Farbe in durchsichtige Bereiche ausgeblutet, Deckung beim Verkleinern erhalten (Alphatest).
   Sonderfall Prof (Male_Adult_03): Farbkanal der Haartextur ist Kopfhaut → Haarfarbe aus `people.json` (`hairTint`).
3. **Gesichtsformen** (nur Prof, Nachbarin, Tutorin aus den `_facial`-Dateien): 15 Visemes (`AA_VI_*`), Blinzeln, Brauen, Kiefer,
   dünn besetzt als Int16 gespeichert.
4. **Atlanten:** Hauptfiguren je eigener Atlas (Spielfiguren mit großer Körperkachel für die Hände), Menge je Geschlecht ein Atlas.
   Profil `mobile` halbiert alles. Positionen als Int16 (1/16384 m).
5. **Animationen** (CLP2): je Geschlecht ein Satz (Sitzen am Tisch: 14 Clips inkl. Eigenheiten; Stehen, Gehen) und ein Prof-Satz
   (Sprechen, Präsentieren, Moderieren, Nachdenken). Wurzel in den Spielraum umgerechnet, Gesichtsspuren entfernt, konstante
   Spuren weggelassen, Drehungen als Int16-Differenzen (gzip packt das gut). 15 bzw. 20 Bilder/s (mobil 12/15).

Laufzeit: `src/chars/clipCharacter.js` spielt die Clips (Überblendungen, zufällige Eigenheiten, Gehtempo) und legt darüber nur,
was das Spiel steuert: Blick mit Sakkaden, Arm-IK in Weltachsen, Griffe (Fingerketten), Vorbeugen/Nicken/Lachen, Blinzeln,
Visemes. Prüfansicht: `node tools/peopleview.mjs neighbor:listen:4,prof:talk:4,player_a:type:3` (Pultbank im Spielmaßstab).

## Requisiten und Atlas

`tools/pipeline/props.mjs` vereinfacht die Poly-Haven-Modelle auf ein Dreiecksbudget und packt alle undurchsichtigen Materialien
ohne Leuchten mit UVs im Bereich 0…1 in **einen Texturatlas** (Farbe inkl. Farbfaktor, Normalen, ORM). Im Spiel teilen sich
diese Requisiten ein Material je Atlasseite (ein- bzw. beidseitig), der Batcher verschmilzt sie zu wenigen Draw Calls.
Glas mit `KHR_materials_transmission` wird zu halbtransparentem Glas (sonst zeichnet three.js alle undurchsichtigen Objekte ein
zweites Mal). Übrig bleiben eigene Materialien nur für Transparentes (Glas, Laub), Klarlack und Leuchtendes.

## Licht

`tools/lightmap-export.mjs` schreibt die Saalflächen (Empfänger) und Verdecker, `tools/pipeline/blender/lightmap.py` backt in
Cycles indirektes Licht (Deckenleuchten, Himmel, Sonne getrennt) und Umgebungsverdeckung auf 4 Atlanten à 2048² (entrauscht mit
OpenImageDenoise), `tools/pipeline/lightmap.mjs` mischt die Wettervarianten und kodiert KTX2 (mobil 1024²). Die zweite UV-Spur
liegt kompakt in `uv.bin.gz` (Format 2: Uint16-Differenzen, UVs als Uint16).

## Figuren (ältere Fassung, MakeHuman/MPFB)

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
Diese Fassung wird nur noch mit `node tools/build.mjs --old-humans` eingebettet.

## Stimmen

- **Korpus:** Jeder gesprochene Satz bekommt eine Kennung (FNV-1a über Sprache, Sprecher:in, Text). Sätze mit Platzhaltern werden
  in Stücke geteilt, die Werte (Reihe, Minuten) als eigene Aufnahmen.
- **Sprechfassung:** `tools/voice/normalize.py` schreibt Zahlen, Einheiten, Jahreszahlen und Fachabkürzungen aus.
- **Modelle:** Deutsch mit Coqui XTTS v2, Englisch mit Kokoro-82M. Beide mit eingebauten synthetischen Stimmen, keine geklonte
  reale Person. Auswahl und Messwerte stehen in `docs/AUDIO.md`.
- **Mastering** (`tools/voice/master.py`): Hochpass, De-Esser, Stille kürzen, −16 LUFS, True Peak −1,5 dBTP, Opus 28 kbit/s,
  Lautstärkekurve 20 Hz für die Mundbewegung.
- Beide Renderer sind wiederaufnehmbar: vorhandene Aufnahmen werden übersprungen. Lange Läufe schreiben mit `VOICE_OUT` in einen
  Arbeitsordner außerhalb des Repositorys; `tools/voice/sync.py` übernimmt die fertigen Aufnahmen gebündelt.
- **Sprechtempo:** Der Ablauf schätzt Sprechdauern mit dem gemessenen Tempo (Deutsch 0,081 s/Zeichen, Englisch 0,048) und wartet
  im Spiel zusätzlich auf das Ende der Aufnahme.

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
