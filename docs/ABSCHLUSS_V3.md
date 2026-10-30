# Version 3 – Abschluss: Stand und Nachweise

Statusbericht zum Auftrag `AUFTRAG_V3.md`. Zahlen sind gemessen (Werkzeug in Klammern), Grenzen stehen am Ende.

## Lieferungen

| Lieferung | Datei | Stand |
|---|---|---|
| A (Schärfe, Lesbarkeit) | `dist/BOKU_TicTacTierernaehrung_v3-alpha.html` | geliefert |
| B (Zwischenstand) | – | entfallen: Der Auftraggeber wollte nach den neuen Figuren keine Zwischenlieferung mehr, nur die fertige Fassung |
| **C (final)** | `dist/BOKU_TicTacTierernaehrung_v3.html` + `…_stimme_de.js` / `…_stimme_en.js`, `dist/SHA256.txt`, Mobil-Fassung + ZIP über den Pages-Workflow (`npm run build:mobile` baut beides lokal) | siehe unten |

**Spielen:** im Browser über GitHub Pages (`https://konvalinaalexander-max.github.io/spiel/`, nach einmaligem Einschalten) oder
offline per Download der HTML-Datei (README, Abschnitt „Spielen“).

## Zielwerte aus Abschnitt 2

| Bereich | Ziel | Stand | Nachweis |
|---|---|---|---|
| Auflösung | Render- = Bildschirmpixel bis DPR 2 | erfüllt: alle Stufen `maxDpr 2`, `renderScale 1`, Regler 50–200 % mit Pixelanzeige | `src/gfx/quality.js` |
| Folie ohne Zoom (K1) | OCR ≥ 85 % | **86,7 %** (v2: 62,2 %) | `docs/SCHAERFE.md` |
| Folie mit Zoom (K4) | OCR ≥ 97 % | <!--K4-->**97,8 %** (2. Lauf 93,3 %: Prof stand vor der letzten Zeile, alle sichtbaren Wörter erkannt)<!--/K4--> | `docs/SCHAERFE.md` |
| Laptop (K2) | OCR ≥ 98 % | **98,1 %** (Messung 29.10.; in der Endfassung sprengt Full HD den Speicher des Software-Renderers) | `docs/SCHAERFE.md` |
| Kantenschärfe | ≥ 3 × v2 | Leinwand **4,3 ×**, Zoom **3,1 ×**, Laptop **3,6 ×** | `docs/SCHAERFE.md` |
| Menschen | ≥ 40 Studierende, ≥ 16 Looks, echte Hände | **erfüllt**: Microsoft Rocketbox (MIT), 29 Figuren für die Menge (≈ 110 Plätze), Prof, Nachbarin, Tutorin, 3 Spielfiguren; Bewegung aus Motion Capture, Finger aus den Aufnahmen + Griffe | `docs/ASSETS.md`, `docs/ITERATIONEN.md` |
| Gesichter | Blinzeln, Blick, Mund zur Stimme; Prof ≥ 6 Mundformen | **erfüllt**: Prof/Nachbarin/Tutorin 15 Visemes (Gesichtsformen), Blinzeln, Brauen; Studierende Kiefer + Lider; Blick mit Sakkaden | `src/chars/clipCharacter.js` |
| Requisiten | ≥ 70 Typen aus Paketen, 0 Primitiven | 72 Poly-Haven-Modelle (+ prozedurale Kleinteile, siehe Grenzen) | `docs/ASSETS.md` |
| Materialien | PBR aus ambientCG/Poly Haven, KTX2 | erfüllt (17 ambientCG-Materialien, Requisiten-Atlas) | `docs/ASSETS.md` |
| Licht | Lightmap ≥ 4 × 2048², rauschfrei | **4 × 2048²** (Cycles, OpenImageDenoise), Wetter sonnig/bewölkt, mobil 4 × 1024² | `docs/PIPELINE.md` |
| Dialog | ≥ 1 500 Sätze je Sprache, ≥ 60 Anekdoten, ≥ 8 Running Gags, ≥ 6 Varianten, 0 Wiederholungen | **DE 1 560, EN 1 616**, 64 Anekdoten/Witze, **8 Running Gags**, alle 101 Ereignisse mit ≥ 6 Varianten, 0 Wiederholungen in 10 simulierten Vorlesungen | `npm test` |
| Stimme | menschliche Qualität, 100 % (laut Auftraggeber: Deutsch reicht) | <!--VOICE-->**Deutsch 100 %: 1 697 von 1 697 Aufnahmen** (XTTS v2, 45,4 MB, ≤ −1 dBTP)<!--/VOICE-->; Englisch: Kokoro-82M, 1 193 von 1 622 Prof-Sätzen, Rest Untertitel; 0 Browser-TTS | `docs/AUDIO.md`, `docs/audio/beispiele/` |
| Klang | 0 synthetische Quellen (außer ≤ 5 UI-Töne), ≥ 120 Clips | 151 echte Aufnahmen für 72 Klänge, 5 synthetische Laptop-Signaltöne | `docs/AUDIO.md`, `tools/audio-check.mjs` |
| Desktop-Build | ≤ 80 MB | **71 MB** (+ Stimmen als Begleitdateien) | `dist/SHA256.txt` |
| Mobil-Build | ≤ 30 MB, PWA | **Kern 27,9 MB**, Manifest, Service Worker | `npm test` |
| Leistung „Mittel“ | ≤ 250 Draw Calls, ≤ 1,5 Mio. Dreiecke | **246**, **1,13 Mio.** (je Bild inkl. Schatten und Nachbearbeitung) | `docs/PERFORMANCE.md` |
| Leistung Mobil | ≤ 120 Draw Calls, ≤ 400 k Dreiecke | **116**, **357 k** | `docs/PERFORMANCE.md` |
| Figuren Draw Calls | ≤ 12 Desktop / ≤ 6 Mobil | **7** / **5** | `docs/PERFORMANCE.md` |
| Touch | automatisierter Durchlauf | **bestanden** (Start → Laptop → Feld → Mitschreiben → Quiz → Ende, 0 Konsolenfehler) | `docs/touch-e2e.json` |
| Dauerlauf | 10 Vorlesungen ohne Fehler | <!--SOAK-->folgt<!--/SOAK--> | `docs/soak.json` |
| Tests | alle grün | <!--TESTS-->36 Tests grün<!--/TESTS--> | `npm test` |
| Balancing | Bachelor 45–60 %, monoton | **86 / 54 / 28 / 16 %** (80 Läufe je Stufe, echtes Sprechtempo) | `docs/BALANCING.md` |

## Was in dieser Runde dazukam (Rückmeldungen des Auftraggebers)

1. **Menschen neu:** „schlecht, steif, seltsame Hände“ → Rocketbox-Figuren mit Motion Capture, Griffe, Blick, Mundformen
   (`docs/ITERATIONEN.md`, Bilder `docs/screenshots/v3/figuren_*.jpg`).
2. **Haar der Frau („metallener Schädel“):** Ursache nach innen zeigende Normalen der Haarkarten → behoben.
3. **„Deutsch reicht“:** Deutsch wird vollständig vertont, Englisch bleibt Textfassung mit den vorhandenen Aufnahmen.
4. **„Wie spiele ich?“:** GitHub-Pages-Veröffentlichung vom Standard-Branch (Spielen im Browser ohne Download), README vereinfacht.

## Ehrliche Grenzen

- **Kein Grafikchip im Container:** gemessen mit dem Software-Renderer (SwiftShader). Draw Calls, Dreiecke und Speicher sind
  hardwareunabhängig; echte Bildraten (Iris Xe, Handys) sind nicht messbar. DPR 2 sprengt den Speicher des Testcontainers –
  gemessen ist DPR 1.
- **Stimme:** XTTS spricht Standarddeutsch, keine österreichische Färbung (dafür bräuchte es einen Azure-Schlüssel). Englisch ist
  nicht vollständig vertont (Entscheidung „Deutsch reicht“).
- **Nicht angehört:** Im Container gibt es keine Tonausgabe – Stimmen und Geräusche sind gemessen (Pegel, Wortfehlerrate,
  Signalqualität), nicht gehört. Die Hörproben in `docs/audio/` sind zum Anhören da.
- **Primitiven:** Der Saal (Bänke, Pulte, Wände) und kleiner Pultkram (Stifte, Mappen, Rucksäcke …) sind prozedural modelliert
  (abgerundet, texturiert, verschmolzen), keine Paket-Modelle. Paket-Modelle: 72 Requisiten, alle Menschen.
- **Rocketbox-Tippen:** Es gibt keine Aufnahme vom Tippen im Sitzen; die Hände an der Tastatur liegen per IK auf einer ruhigen
  Sitz-Aufnahme, die Finger mit Griffhaltungen.
- **Mobil:** Echtzeitschatten nur von Wänden, Rollos und Menschen (der Rest ist gebacken), weniger Kleinkram auf den Pulten,
  Außenwelt vereinfacht – nötig für ≤ 120 Draw Calls / ≤ 400 k Dreiecke.

## Das musst du noch tun

1. **GitHub Pages einschalten (einmalig, 1 Minute):** Repository → *Settings* → *Pages* → *Build and deployment* → *Source*:
   „GitHub Actions“. Danach unter *Actions* → *Pages* → *Run workflow* (oder beim nächsten Push automatisch). Adresse:
   `https://konvalinaalexander-max.github.io/spiel/` (Handy und Computer), volle Qualität am Computer:
   `https://konvalinaalexander-max.github.io/spiel/BOKU_TicTacTierernaehrung_v3.html`.
2. **Anhören:** `docs/audio/beispiele/` (30 Prof-Sätze je Sprache), `docs/audio/hoersaal_mix.m4a`.
3. **Handy-Test (5 Minuten):** Checkliste in `docs/MOBILE.md`.
4. **Optional, österreichische Stimme:** `AZURE_SPEECH_KEY` und `AZURE_SPEECH_REGION` in den Umgebungseinstellungen hinterlegen
   (nie in den Chat kopieren); dann kann `tools/voice/render.py` auf „de-AT-JonasNeural“ umgestellt werden.
