# Version 3 – Stand und Nachweise

Lebender Statusbericht zum Auftrag `AUFTRAG_V3.md`. Jede Lieferung aktualisiert diese Datei.

## Lieferungen

| Lieferung | Datei | Stand |
|---|---|---|
| **A** (Schärfe, Lesbarkeit) | `dist/BOKU_TicTacTierernaehrung_v3-alpha.html` | geliefert, enthält bereits echte Figuren, neue Prof-Texte, Touch-Steuerung und erste echte Stimmen |
| B (Hörsaal, Menschen, Requisiten, Stimme, Klangwelt) | `dist/BOKU_TicTacTierernaehrung_v3-beta.html` | in Arbeit |
| C (final, Hosting) | `dist/BOKU_TicTacTierernaehrung_v3.html`, `dist/mobile/`, ZIP | offen |

## Zielwerte aus Abschnitt 2

| Bereich | Ziel | Stand | Nachweis |
|---|---|---|---|
| Auflösung | Render- = Bildschirmpixel bis DPR 2 | erfüllt: alle Stufen `maxDpr 2`, `renderScale 1`; Regler 50–200 % mit Pixelanzeige | `src/gfx/quality.js`, Einstellungen |
| Folie ohne Zoom (K1) | OCR ≥ 85 % | **88,9 %** (v2: 62,2 %) | `docs/SCHAERFE.md` |
| Folie mit Zoom (K4) | OCR ≥ 97 % | 95,6 % (ein Wort von 45 unter Ziel; v2: 97,8 %) | `docs/SCHAERFE.md` |
| Laptop (K2) | OCR ≥ 98 % | **98,1 %** (v2: 62,1 %) | `docs/SCHAERFE.md` |
| Kantenschärfe | ≥ 3 × v2 | Leinwand **4,3 ×**, Laptop **3,6 ×** (DPR 1) | `docs/SCHAERFE.md` |
| Menschen | ≥ 40 Studierende, ≥ 16 Looks, echte Hände | erfüllt: 16 MakeHuman-Typen für die Menge (eingefärbt je Person), Prof, Nachbarin, Tutorin, 3 Spielfiguren mit voll gegliederten Händen | `docs/ASSETS.md`, `tools/pipeline/humans.json` |
| Gesichter | Blinzeln, Blick, Mund zur Stimme; Prof ≥ 6 Mundformen | teilweise: Blinzeln, Blick, Kiefer folgt der Lautstärkekurve; eigene Mundformen fehlen noch | `src/chars/character.js` |
| Requisiten | ≥ 70 Typen aus Paketen, 0 Primitiven | offen (Phase 5) | – |
| Materialien | PBR aus ambientCG/Poly Haven, KTX2 | Pipeline steht (`tools/pipeline/textures.mjs`), Einbau in den Saal offen (Phase 3) | – |
| Licht | gebackene Lightmaps | offen (Phase 3) | – |
| Dialog | ≥ 1 500 Sätze je Sprache, ≥ 60 Anekdoten, ≥ 8 Running Gags | DE 1 639 Zeilen, 100 Anekdoten, Running Gags siehe `docs/DIALOG.md` | `tools/validate-content.mjs` |
| Stimme | 100 % DE + EN, menschliche Qualität | in Arbeit: DE mit XTTS v2, EN mit Kokoro-82M, beide laufen im Hintergrund; ohne Azure-Schlüssel keine österreichische Färbung | `docs/AUDIO.md` |
| Klang | 0 synthetische Quellen (außer ≤ 5 UI-Töne) | in Arbeit: 126 geprüfte Aufnahmen für 45 Klänge recherchiert, Aufbereitung und Einbau laufen | `docs/AUDIO_QUELLEN.md` |
| Desktop-Build | ≤ 80 MB | 25 MB | `dist/SHA256.txt` |
| Mobil-Build | ≤ 30 MB, PWA | Kern 12 MB, Manifest, Service Worker, Update-Hinweis; Lighthouse offen | `docs/MOBILE.md` |
| Performance „Mittel“ | ≤ 1,5 Mio. Dreiecke | ≈ 0,66 Mio. sichtbar, ≈ 0,41 Mio. Schattenwerfer (Detailstufen der Menge) | `docs/PERFORMANCE.md` (Update folgt) |
| Balancing | Bachelor 45–60 %, monoton | **93 / 50 / 31 / 15 %** (80 Läufe je Stufe) | `docs/BALANCING.md` |

## Ehrliche Grenzen (Stand Lieferung A)

- Gemessen wird ohne Grafikchip (Software-Renderer). Echte Bildraten auf einem Iris-Xe-Laptop oder Handy sind nicht messbar.
- DPR 2 lässt sich im Container nicht messen: Der Software-Renderer sprengt bei 3840 × 2160 Pixeln den Speicher. Gemessen ist DPR 1.
- Die deutsche Stimme rechnet auf der CPU langsam. Bis alle Sätze vorliegen, bleibt bei fehlenden Aufnahmen der Untertitel.

## Das musst du noch tun

1. **Österreichische Stimme (optional):** In den Umgebungseinstellungen dieser Cloud-Umgebung `AZURE_SPEECH_KEY` und
   `AZURE_SPEECH_REGION` hinterlegen. Ein neuer Sitzungsstart liest sie ein. Schlüssel nie in den Chat kopieren.
2. **GitHub Pages:** Repository → Settings → Pages → Source: „GitHub Actions“ (einmalig, für den Mobil-Build).
3. **Handy-Test:** Checkliste in `docs/MOBILE.md`.
