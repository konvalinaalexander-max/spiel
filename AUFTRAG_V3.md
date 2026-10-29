# Auftrag: „Tic Tac Tierernährung“ → Version 3.0 – scharf, echt, überall spielbar

Du bist ein **Senior Game Developer** mit Technical-Art-, Engine- und Produktionserfahrung (Shipping-Titel auf PC, Konsole und Mobile), dazu Audio-Lead, Dialogautor:in und Fachlektor:in für Tierernährung – in einer Person. Du übernimmst das bestehende Spiel (Version 2.0 in diesem Repository) und hebst es auf **Produktionsniveau**.

Der Auftraggeber hat Version 2 gespielt und sagt wörtlich:

> „Die PowerPoint vom Beamer und der Screen sind irgendwie blurry. Generell hat das ganze Spiel so ein verschwommenes Feeling, auch der Bildschirm. Die Menschen sind komische Kreise, Würfel und Kugeln. Die Hand in der First Person ist keine Hand. Es soll am Handy wie auch am Computer spielbar sein. Und die Texte des Profs sollen ein bisschen realer und unterhaltsamer sein.“

Das ist dein Auftrag. Vier Ziele, alle Pflicht:

1. **Schärfe.** Kein verschwommenes Bild mehr – nirgends. Folien, Laptop-Bildschirm, Tafel, Kanten, Texturen. Lesbarkeit wird **gemessen** (OCR), nicht behauptet.
2. **Echte Assets.** Menschen, Hände, Möbel, Requisiten, Materialien kommen aus professionellen, frei lizenzierten Paketen und einer echten Asset-Pipeline (Blender, glTF-Transform, KTX2) – **nicht** aus handgeschriebenen Kugeln und Würfeln. Du modellierst nur, was es nirgends gibt, und dann in Blender, nicht in three.js-Primitiven.
3. **Mobil und Desktop.** Ein Build für den Desktop (eine herunterladbare Datei) und ein Build für Handys (gehostet, als PWA installierbar, Touch-Steuerung von Grund auf).
4. **Der Prof.** Dialoge, die sich wie ein echter, witziger, österreichischer Professor anhören – inhaltlich korrekt, mit Anekdoten, Rückbezügen, Reaktionen auf den Saal – und eine **echte Stimme** (neuronale TTS, vorgerendert) statt der Browser-Sprachausgabe.

Du arbeitest den Plan **vollständig** ab. Jede Phase hat Abnahmekriterien mit Zahlen. Du bist erst fertig, wenn alle erfüllt und belegt sind.

---

## 0. Diagnose – warum Version 2 verschwommen wirkt (gemessen, nicht geraten)

Lies das zuerst. Die Ursachen sind bekannt; du fängst nicht bei null an.

| # | Ursache | Wo im Code | Wirkung |
|---|---|---|---|
| 1 | **Render-Auflösung unter der Bildschirmauflösung.** `maxDpr: 1` für „Niedrig“ und „Mittel“, 1.5 für „Hoch“; „Niedrig“ zusätzlich `renderScale: 0.8`. Die Automatik wählt für Apple M1–M4, Intel Iris Xe und AMD-iGPUs „Mittel“, für Intel UHD „Niedrig“. | `src/gfx/quality.js` (PRESETS), `src/gfx/graphics.js:156` | Auf jedem HiDPI-Bildschirm (jedes MacBook, die meisten Windows-Laptops mit 125–200 % Skalierung) rendert das Spiel mit **der Hälfte oder weniger** der echten Pixel und der Browser skaliert hoch. **Das ist der Hauptgrund für das „verschwommene Feeling“.** Es betrifft alles: Folien, Laptop, Kanten, Texturen. |
| 2 | Der Regler „Renderauflösung“ geht nur **bis 100 %** (`#s-dpr`, `max="1"`). | `src/ui/ui.js:126` | Spieler:innen können die Unschärfe nicht einmal selbst beheben. |
| 3 | **Weichzeichnende Nachbearbeitung** als Standard: FXAA/SMAA, Filmkorn (`NoiseEffect` 0,05), Vignette 0,42, Sättigung −0,08, Bloom, Tiefenschärfe mit halber Auflösung und Bokeh 3,2 im Laptop-/Heftblick, N8AO in halber Auflösung. | `src/gfx/graphics.js` `buildPost()` | Weiches, graues, „nebliges“ Gesamtbild; der Laptop-Bildschirm wird von der Tiefenschärfe zusätzlich verwischt. |
| 4 | **Folien als Rasterbild**: 1920 × 1080-Canvas auf 3,6 m Leinwand. Aus Reihe 5 ist die Leinwand bei 1280 × 720 nur ≈ 340 px breit → Fließtext 3–4 px hoch, dann trilinear verkleinert. | `src/scene/slides.js`, `src/scene/fixtures.js` | Text ist physikalisch nicht lesbar; der nachträglich eingebaute Zoom (`F`) ist eine Krücke, keine Lösung. |
| 5 | **Laptop-Bildschirm** als 1280 × 800-Canvas (`const W = 1280, H = 800` in `src/laptop/os.js`), im Laptop-Blick ≈ 1100 px breit bei 1280 × 720 – bei 1920 × 1080 oder DPR 2 wird die Textur **vergrößert** statt verkleinert. | `src/laptop/os.js`, `src/chars/playerView.js` | Unscharfe Schrift genau dort, wo man am meisten liest. |
| 6 | **Figuren und Hände prozedural** aus Kapseln/Kugeln/Quadern, Requisiten aus Primitiven, Texturen prozedural auf der GPU. | `src/chars/rig.js`, `src/scene/props.js`, `src/gfx/textures.js` | „Baukasten“-Look; keine echten Gesichter, Hände, Kleidung, Materialien. |
| 7 | **Stimme**: Browser-`speechSynthesis`, je nach System robotisch; 553 Dialogsätze, Humor dünn. | `src/audio/*`, `src/content/dialogue.json` | Prof wirkt nicht wie ein Mensch. |
| 8 | **Mobil**: Touch rudimentär (Wischen, Tippen, 4 Schaltflächen), kein eigener Build, keine Hosting-Variante. Eine lokale HTML-Datei führt auf iOS (Files/Quick Look) **kein JavaScript** aus. | `src/core/input.js`, `src/ui/hud.js` | Am Handy faktisch nicht spielbar. |

Was in Version 2 **gut** ist und bleibt (nicht neu erfinden, nur ausbauen): Vorlesungs-Director mit 28 Ereignistypen, Sichtkegel mit Verdeckung, dreistufiges Verdachtsmodell, Laptop-OS mit Apps, Tic-Tac-Toe-Gegner:in im Saal, Quiz/Mitschrift, Noten/Erfolge/Rangliste, DE/EN, Audio-Mixer, 26 automatisierte Tests, Headless-Screenshot-Werkzeuge (`tools/e2e.mjs`, `tools/phaseshots.mjs`, `tools/docshots.mjs`), Bot-Balancing (`tools/sim.mjs`). Alles in `docs/` (README, RECHERCHE, ITERATIONEN, PERFORMANCE, BALANCING, AUDIO, ABSCHLUSS) lesen, bevor du etwas anfasst.

Ausgangspunkt: Commit `5a19149` auf `claude/amazing-hamilton-2758i1` (Version 2 final). Du arbeitest auf dem Branch, den dir deine Sitzung vorgibt. Keinen Pull Request anlegen, außer der Auftraggeber bittet darum.

---

## 1. Arbeitsregeln (gelten für alles)

1. **Keine Faulheit, keine Platzhalter.** Kein `// TODO`, kein „vereinfacht“, kein „kann später“. Wenn etwas wirklich unmöglich ist: dokumentieren warum, beste Alternative liefern.
2. **Download statt Handarbeit.** Du bist Game Developer, nicht Bildhauer. Figuren, Animationen, Möbel, Requisiten, PBR-Texturen, HDRIs, Stimmen kommen aus den in Anhang A gelisteten Quellen. Eigene Geometrie nur, wo es nichts Passendes gibt – und dann in **Blender per Skript** (`bpy`), mit Bevels, sauberen UVs, Lightmap-UVs und Texturen aus Anhang A. three.js-Primitiven (`BoxGeometry`, `CapsuleGeometry` …) sind für sichtbare Objekte **verboten**; erlaubt nur für Unsichtbares (Kollisions-/Sichtvolumen) und Kleinstteile unter 2 cm (Kreide, Kabelbinder).
3. **Lizenz-Hygiene ist Pflicht.** Nur CC0, CC-BY (mit Nennung) oder explizit spielkompatible Lizenzen. Jede Datei, die du herunterlädst, landet mit Quelle, Autor:in, Lizenz, Download-URL, Datum und SHA256 in `docs/ASSETS.md`. CC-BY-Nennungen erscheinen zusätzlich im Spiel (Credits-Seite). Unklare Lizenz = nicht verwenden. **Nicht erlaubt:** Mixamo-Rohdaten weiterverteilen, Sketchfab ohne Download-Lizenz, Microsoft Rocketbox (nur Forschung), alles „free for personal use“.
4. **Keine echten Personen, keine echten Logos/Fotos der BOKU.** Prof. Haferkorn bleibt fiktiv, die LV-Seite nennt „N. N.“, der Schriftzug „BOKU“ bleibt Nachbau. „Fan-Projekt, kein offizielles Angebot der BOKU“ bleibt sichtbar. Gesichter aus Asset-Paketen sind synthetisch – keine Scans realer Personen.
5. **Fachliche Korrektheit vor Witz.** Alles, was der Prof sagt, schreibt oder zeigt, stimmt (Bachelor-Niveau, Kirchgeßner, Jeroch/Drochner/Simon, GfE, DLG). Jede neue Aussage mit Zahl kommt in die Faktentabelle (`docs/DIALOG.md`).
6. **Österreichisches Deutsch + vollständiges Englisch.** Keine hartkodierten Texte; alles in `src/content/strings.*.json` bzw. `dialogue.*.json`. Der Übersetzungstest (`npm test`) muss grün bleiben.
7. **Messen statt behaupten.** Schärfe (OCR, Laplace-Varianz), Draw Calls, Dreiecke, Texturspeicher, Dateigröße, Ladezeit, fps-Budget. Jede Phase endet mit einer Messung, die in `docs/` steht.
8. **Bilder ansehen.** Nach jeder Phase Screenshots aus ≥ 4 Perspektiven **bei DPR 2** (Playwright `deviceScaleFactor: 2`, Viewport 1920 × 1080) und zusätzlich mobil emuliert (iPhone 13, Pixel 7, iPad). Du schaust sie dir an (Bild lesen) und bewertest sie kritisch, bevor du eine Phase abschließt. Dokumentiert in `docs/ITERATIONEN.md`.
9. **Keine Regressionen.** Alle Systeme aus Version 2 bleiben funktionsfähig; `npm test` und `node tools/test.mjs --e2e` bleiben grün und werden um neue Tests ergänzt (siehe Phase 9). Bot-Balancing wird nach Gameplay-Änderungen wiederholt.
10. **Commits pro Phase** mit aussagekräftigen Nachrichten; nach jeder Phase Push. **Drei Zwischenlieferungen** (siehe Abschnitt 4), damit der Auftraggeber früh prüfen kann – vor allem die Schärfe.
11. **Blockaden lösen, nicht abwarten.** Netzquelle nicht erreichbar → Alternative aus Anhang A, dokumentieren. Werkzeug fehlt → installieren (pip, npm, Tarball). Du stellst dem Auftraggeber **keine Rückfragen**, du entscheidest und dokumentierst. Einzige Ausnahme: Zugangsdaten (Sketchfab-Token, Hosting-Freischaltung) – dafür schreibst du am Ende eine klare „Das musst du noch tun“-Liste.

---

## 2. Messbare Ziele (Abnahme des Gesamtprojekts)

| Bereich | Kennzahl | Zielwert |
|---|---|---|
| Auflösung | Render-Pixel ÷ Bildschirm-Pixel | **= 1,0** auf allen Desktop-Stufen bei DPR ≤ 2 (DPR 3 auf Handys: ≥ 0,75 mit dynamischer Auflösung + Nachschärfung); Regler 50–200 % |
| Folie lesbar | OCR (tesseract.js, `deu`) auf dem Leinwand-Ausschnitt aus Reihe 5, 1920 × 1080, DPR 1, **ohne Zoom** | Zeichengenauigkeit **≥ 85 %** für Titel + Aufzählung |
| Folie lesbar | dasselbe mit „genau hinschauen“ | **≥ 97 %** |
| Folie lesbar | dasselbe am Laptop („Folien mitlesen“, Phase 2) | **≥ 98 %** |
| Laptop-Bildschirm | OCR auf Spiel-App, Chat, Skriptum im Laptop-Blick, 1920 × 1080 DPR 1 und DPR 2 | **≥ 98 %** |
| Kantenschärfe | Laplace-Varianz des Leinwand-Ausschnitts (gleiche Kamera wie v2-Messung) | **≥ 3 ×** v2-Wert; dokumentiert vorher/nachher |
| Menschen | Figuren im Saal aus echten, gerigten Modellen; sichtbar unterscheidbare Looks | ≥ 40 Studierende, ≥ 16 Looks (Körper × Gesicht × Haar × Kleidung), Prof, Tutorin, Spätkommer:in, eigener Körper mit **echten Händen** |
| Gesichter | Blinzeln, Blick, Mund zur Stimme | alle sprechenden Figuren; Prof mit ≥ 6 Mundformen (Shape Keys oder Kieferknochen + Lippen) |
| Requisiten | sichtbare Objekte aus Paketen/Blender | ≥ 70 Typen, **0** three.js-Primitiven für sichtbare Objekte > 2 cm |
| Materialien | PBR-Texturen aus ambientCG/Poly Haven, KTX2-komprimiert | alle Flächen; Desktop 2K, Mobil ≤ 1K |
| Licht | gebackene Lightmaps + HDRI-Umgebung + CSM-Sonne | Lightmap ≥ 4 × 2048², rauschfrei (Denoiser) |
| Dialog | Prof-Sätze DE und EN (keine 1:1-Übersetzung, gleich witzig) | **≥ 1 500** je Sprache, ≥ 60 Anekdoten, ≥ 8 Running Gags, ≥ 6 Varianten je Ereignisreaktion, **0 Wiederholungen** innerhalb einer Vorlesung |
| Stimme | vorgerenderte neuronale TTS für alle Prof-Sätze | 100 % DE + EN, AAC/Opus, Lippensynchronisation aus Hüllkurve |
| Desktop-Build | eine HTML-Datei, offline per Doppelklick | Ziel ≤ 80 MB, hart ≤ 120 MB; Startseite < 1 s, Hörsaal fertig ≤ 10 s (gemessen headless: Decode + Build ≤ 6 s) |
| Mobil-Build | gehostet + PWA, offline nach erstem Start | ≤ 30 MB Gesamtdownload, erster Start ≤ 20 s bei 4G, Lighthouse Mobile: Barrierefreiheit ≥ 90, PWA installierbar |
| Performance Desktop „Mittel“ | Draw Calls / Dreiecke / Texturspeicher | ≤ 250 / ≤ 1,5 Mio / ≤ 600 MB; Budget 16,6 ms auf Iris Xe (nicht messbar → Budgets einhalten + relative SwiftShader-Messung dokumentieren) |
| Performance Mobil | Draw Calls / Dreiecke / Texturspeicher | ≤ 120 / ≤ 400 k / ≤ 256 MB; 30-fps-Modus + 60-fps-Modus |
| Tests | `npm test` + E2E + neue Tests | alle grün, 0 Konsolenfehler, auf Desktop- und Mobil-Build |
| Balancing | Bot, 80 Läufe je Stufe | Bachelor 45–60 %, Stufen monoton |

---

## 3. Phasen

Reihenfolge ist Pflicht: Schärfe zuerst (das größte Ärgernis), dann Lesbarkeit, dann Assets, dann Stimme, dann Mobil. Jede Phase: **Ziel → Aufgaben → Werkzeuge → Abnahme**.

### Phase 0 – Werkzeugkette und Quellen (halber Tag)

**Ziel:** Alles installiert und geprüft, bevor Zeit in Inhalte fließt.

**Aufgaben**
1. Node-Werkzeuge: `@gltf-transform/cli`, `gltfpack` (meshoptimizer), `three` (aktuell; v2 nutzt r183 – nur mit Grund wechseln), `postprocessing`, `troika-three-text`, `tesseract.js`, `sharp` (Bildvergleich), `playwright` (vorinstalliert – **nicht** `playwright install` ausführen; Chromium liegt unter `/opt/pw-browsers/chromium`).
2. **Blender** headless: Tarball der aktuellen LTS von `download.blender.org` (erreichbar) nach `tools/blender/` entpacken; `blender -b -P script.py` muss laufen. Falls `pip install bpy` mit der Container-Python-Version (3.13) nicht geht: Tarball bringt eigenes Python mit.
3. **KTX-Software** (`toktx`/`ktx`) oder `basisu` aus den GitHub-Releases für KTX2-Texturen; `gltf-transform etc1s/uastc` braucht es.
4. **Piper TTS**: `pip install piper-tts` (PyPI erreichbar), Stimmen von `huggingface.co/rhasspy/piper-voices` (erreichbar): Deutsch `de_DE-thorsten-high` (Fallback `-medium`), Englisch `en_GB-alan-medium` oder `en_US-ryan-high`. `ffmpeg` ist installiert (`/usr/bin/ffmpeg`).
5. **Tesseract**: `tesseract.js` (WASM) mit `deu` + `eng`-Trainingsdaten, Download beim ersten Lauf in `tools/.cache/`.
6. **Netzquellen** aus Anhang A prüfen (HTTP-Status loggen). Stand 29.10.2026 aus dieser Umgebung: Poly Haven API ✓, ambientCG API ✓, quaternius.com ✓, kenney.nl ✓ (mit Browser-User-Agent), itch.io ✓, GitHub Raw ✓, HuggingFace ✓, PyPI ✓, download.blender.org ✓; **Ready Player Me ✗ (blockiert)**, Mixamo und Sketchfab brauchen Login/Token → nicht einplanen.
7. `docs/PIPELINE.md` anlegen: Werkzeugversionen, Befehle, Verzeichnisstruktur (`assets/src/` Rohdaten, `assets/build/` fertige GLB/KTX2/Audio, `tools/pipeline/*.mjs` + `tools/blender/*.py`), alles reproduzierbar mit `npm run assets`.

**Abnahme:** `npm run assets:check` listet jede Quelle mit Status; Blender rendert headless ein Testbild; Piper erzeugt einen deutschen Testsatz als `.m4a`; tesseract.js liest ein Testbild.

### Phase 1 – Schärfe-Fundament (Zwischenlieferung A danach)

**Ziel:** Das Spiel rendert in echter Bildschirmauflösung mit scharfer Kantenglättung und ohne weichzeichnende Standard-Effekte. Noch ohne neue Assets – der Auftraggeber soll den Unterschied **sofort** sehen.

**Aufgaben**
1. **Auflösung.** `maxDpr` auf allen Stufen ≥ 2 (Handy: 3, gedeckelt durch Phase 7), `renderScale` überall 1,0. Qualitätsstufen skalieren **Schatten, AO, Post, Texturgröße, Sichtweite** – **nie** die Auflösung (Ausnahme: dynamische Auflösung auf Mobil, nur bei Bedarf, nie unter 75 %, immer mit Nachschärfung). Regler „Renderauflösung“ 50–200 %, Standard 100 %, mit Live-Anzeige der echten Pixelzahl. Automatik darf auf Desktop nie unter 100 % gehen.
2. **Kantenglättung.** MSAA 4 × auf dem Hauptpass (WebGL2-Multisample-Rendertarget im `EffectComposer`, `multisampling: 4`), SMAA 1x nur als Fallback (z. B. iOS), **FXAA entfernen**. Prüfen, ob N8AO mit Multisampling korrekt arbeitet; wenn nicht: AO nur noch gebacken (Phase 3) und N8AO entfernen.
3. **Nachschärfung.** Eigener Pass „Contrast Adaptive Sharpening“ (AMD-FidelityFX-CAS-Portierung, ~40 Zeilen GLSL) nach der Kantenglättung, Stärke 0,3 Standard, Regler 0–0,6. Pflicht bei dynamischer Auflösung.
4. **Nachbearbeitung entgiften.** Standardwerte: Filmkorn **aus** (Option), Vignette 0,2, Sättigung 0, chromatische Aberration nur bei Stress und ≤ 0,0015, Bloom Schwelle ≥ 1,1 und Intensität ≤ 0,3 (nur Lampen, Fenster, LEDs), AgX-Tonemapping mit Kontrast +0,08, Belichtung kalibriert (18-%-Grau-Referenzfläche im Saal, Screenshot-Histogramm dokumentieren). **Tiefenschärfe**: nur im Laptop-/Heftblick, nur Fernfeld (Fokusebene exakt auf Bildschirm/Seite, Fokusbereich so breit, dass die gesamte Bildschirmfläche scharf ist), volle Auflösung, Bokeh ≤ 1,5; Option „aus“.
5. **Texturdisziplin.** Überall Mipmaps + anisotrope Filterung (`getMaxAnisotropy()`); Canvas-Texturen (Tafel, Laptop, Monitor, Zettel, Etiketten) mindestens **2 ×** so groß wie ihre maximale Bildschirmgröße; LOD-Bias −0,5 auf Schriftflächen; keine `NearestFilter`-Unfälle.
6. **Messharness** `tools/sharpness.mjs`: feste Kameras (Sitzplatz Reihe 5 → Leinwand; Laptop-Blick; Tafel), Viewport 1920 × 1080 bei DPR 1 **und** DPR 2, Ausschnitte speichern, Laplace-Varianz berechnen, OCR mit tesseract.js gegen den bekannten Folien-/Bildschirmtext (Levenshtein-Zeichengenauigkeit). Ergebnis als Tabelle in `docs/SCHAERFE.md`, **zuerst mit Version 2 als Baseline** (Build aus Commit `5a19149`), dann nach jeder Schärfe-Änderung.

**Abnahme:** Render-Pixel = Bildschirm-Pixel bei DPR 1 und 2 (Messwert im Einstellungsmenü sichtbar); Laplace-Varianz Leinwand ≥ 2 × Baseline (der Rest kommt in Phase 2); Laptop-OCR ≥ 95 % bei DPR 2; Screenshots DPR 2 aus 4 Perspektiven; `docs/SCHAERFE.md` mit Vorher/Nachher. **Zwischenlieferung A** (siehe Abschnitt 4).

### Phase 2 – Lesbarkeit: Folien, Laptop, Tafel (Zwischenlieferung A umfasst auch diese Phase)

**Ziel:** Den Vorlesungsstoff kann man lesen – am Beamer, am Laptop, an der Tafel, auf jedem Gerät.

**Aufgaben**
1. **Folien als Vektor/SDF statt Raster.** Titel, Aufzählungen, Beschriftungen mit `troika-three-text` (MSDF, scharf bei jeder Entfernung und jedem Zoom; Schrift „Work Sans“ liegt bereits als woff2 im Projekt, Fallback Arial-ähnliche freie Schrift). Diagramme (die 10 Typen aus `slides.js`) als Geometrie (Linien, Flächen, Balken) oder auf eine 4096 × 2304-Canvas gerendert. Foliengestaltung: ≥ 44 px Fließtext bei 1920-Breite, maximal 6 Aufzählungspunkte, Zeilenlänge ≤ 60 Zeichen, hoher Kontrast (`#1a1a1a` auf Weiß), BOKU-Stil bleibt.
2. **Leinwand als Lichtquelle, nicht als beleuchtete Fläche.** Unlit-Material für das Folienbild (Emission), Gewebe-Normalmap nur als dezente Überlagerung, kein Raumlicht-Grauschleier, Beamer-Projektion ab „Hoch“ deckungsgleich (v2-Lösung behalten), Bloom-Schwelle über Folienweiß.
3. **„Folien mitlesen“ am Laptop.** Neue Laptop-App „BOKUlearn Live“: zeigt die aktuelle Folie des Profs in Echtzeit (wie in echten Hybridvorlesungen), mit Folienarchiv (zurückblättern), Notizen-Spalte und Suchfeld. Spielregel: **Folien lesen ist nicht verdächtig** (Sichtmodell: App-Luma niedrig, „Lernhaltung“ senkt Verdacht wie Mitschreiben, aber langsamer). Das ist der Hauptweg, Stoff zu lesen – und erzählerisch korrekt.
4. **Laptop-Bildschirm nativ.** OS-Canvas Desktop 2560 × 1600 (Mobil 1920 × 1200), alle App-Schriften ≥ 18 px bei dieser Breite, Unlit-Material, keine Tiefenschärfe auf der Bildschirmebene, Laptop-Kamera so gerahmt, dass die Textur nie um mehr als Faktor 1,3 verkleinert und nie vergrößert wird (je Viewport dynamisch: Sichtfeld statt Abstand ändern).
5. **Tafel.** Kreideschrift als SDF-Text oder 4096-breite Canvas mit echter Kreide-Normalmap (ambientCG „Chalkboard“); Staubpartikel und Wischspuren bleiben; Handschrift-Schrift (freie Lizenz, z. B. aus Google Fonts OFL: „Caveat“ oder „Patrick Hand“) statt Hershey-Strichschrift, Strich-für-Strich-Aufbau bleibt (Maskierung).
6. **Zoom behalten, verbessern.** „Genau hinschauen“ (`F`/LT, Pinch auf Touch) mit weichem Ein-/Ausblenden, Blickempfindlichkeit skaliert, HUD-Hinweis.
7. **Hybrid-Monitor** zeigt die Folie (v2) – jetzt mit nativer Auflösung (2048 breit) und SDF-Text.
8. **Untertitel** in nativer Auflösung (DOM, nicht Canvas), Schriftgröße-Option bleibt.

**Abnahme:** OCR-Werte aus Abschnitt 2 (Folie ohne Zoom ≥ 85 %, mit Zoom ≥ 97 %, Laptop ≥ 98 %, „Folien mitlesen“ ≥ 98 %); Laplace ≥ 3 × Baseline; alle 30 Inhaltsfolien automatisch durchgerendert und geprüft (Überlauf = Test-Fehler); Screenshots DPR 2. **Zwischenlieferung A** = Desktop-Build nach Phase 1 + 2.

### Phase 3 – Asset-Pipeline und Hörsaal

**Ziel:** Der Hörsaal besteht aus echten Modellen mit echten Materialien und gebackenem Licht.

**Aufgaben**
1. **Pipeline** (`npm run assets`): Download (mit Cache + SHA256) → Blender-Skripte (Import, Aufräumen, Dezimieren, LODs, Lightmap-UVs, Baking, Export GLB) → `gltf-transform` (dedup, prune, resize, KTX2 ETC1S/UASTC, meshopt) → Manifest `assets/build/manifest.json` (Name, Pfad, Bytes, Lizenz-Verweis). Zwei Profile: `desktop` (2K-Texturen, LOD0/1), `mobile` (≤ 1K, LOD1/2, ETC1S).
2. **Materialien** aus ambientCG/Poly Haven (CC0, API-Download): Eichenparkett, dunkles Bankholz (gebeizt, abgegriffen), Putz, Deckenputz, Vertäfelung, Kreidetafel, Leinwandgewebe, Stoff (Sitzpolster, Jacken), gebürstetes Alu, Messing, Glas. Je Material Albedo/Normal/Roughness/AO, auf Desktop 2K, mit Detail-Normalmap für Nahbereich.
3. **Hörsaal-Geometrie in Blender per Skript** (`tools/blender/hall.py`): Reihen, Pultbänke mit echtem Profil (Rundungen, Nut, Nummernschilder, Steckdosen), Stufen, Podium, Pult, Schiebetafel, Leinwandkasten, Fenster mit Laibungen, Heizkörper, Türen, Garderobe, Rollos, Deckenleuchten – alles mit Bevels, UV1 (Material) und UV2 (Lightmap). Wo Poly Haven/Kenney passende Möbel haben (Stühle, Pult, Pflanzen, Türen), diese verwenden.
4. **Licht backen.** Cycles (CPU reicht; 64–256 Samples + OpenImageDenoise) auf Lightmap-Atlas (4 × 2048² Desktop, 2 × 1024² Mobil): Tageslicht durch die Fenster (HDRI von Poly Haven, bewölkt/sonnig/regen als drei Varianten), Deckenleuchten als Flächenlichter, Beamer-Streulicht. Zur Laufzeit: Lightmap (RGBM/RGBE in KTX2) + `LightProbe` aus HDRI + CSM nur für die **Sonne** (bewegte Schatten der Figuren) + dynamische Lichter nur für Laptop-Leuchten und Beamer. Rauschen = Abnahmefehler.
5. **Außenwelt** (v2: Gregor-Mendel-Straße, Linnéplatz, Busse, Türkenschanzpark) mit Kenney City/Nature Kit und Poly Haven-Bäumen; HDRI-Himmel statt prozeduralem Himmel; Fenster mit echter Reflexion (Environment-Map).
6. **Einbettung** in die Desktop-Datei: Binärassets Base64 in `<script type="text/plain">`-Blöcken, Dekodierung in einem Worker (kein Blockieren der Startseite), Ladefortschritt in Bytes; Mobil-Build lädt Dateien per `fetch` (gehostet).

**Abnahme:** 0 Primitiven für sichtbare Objekte (Test: Szene traversieren, Geometrietypen zählen); Lightmap sichtbar (Screenshot-Vergleich mit/ohne); Draw-Call-/Dreieck-/Texturbudget aus Abschnitt 2; `docs/ASSETS.md` vollständig; Screenshots DPR 2: 6 Orbit-Winkel, 3 Spielerperspektiven, 3 Wetter.

### Phase 4 – Menschen: Figuren, Hände, Gesichter, Animation

**Ziel:** Studierende, Prof, Tutorin, Spätkommer:in und der eigene Körper sind echte, gerigte, animierte Menschen mit Gesichtern und Händen.

**Aufgaben**
1. **Figurenquelle** (Reihenfolge, erste erreichbare mit passender Lizenz gewinnt, Entscheidung in `docs/ASSETS.md` begründen):
   - **Quaternius „Ultimate Modular Men/Women“ + „Universal Animation Library“** (CC0, quaternius.com erreichbar): modulare Körper, Haare, Kleidung, Mixamo-kompatibles Skelett, ≥ 100 Animationen (Sitzen, Tippen, Schreiben, Gehen, Reden, Gesten).
   - **MakeHuman/MPFB2 in Blender headless** (GPL-Werkzeug, erzeugte Modelle CC0): realistischere Proportionen und Gesichter, Kleidung aus dem MakeHuman-Asset-Repository (CC0 prüfen), Rig „game engine“/Mixamo-kompatibel, Gesichts-Shape-Keys.
   - **KayKit / Kenney Characters** (CC0, itch/kenney erreichbar) als Ergänzung für Varianz.
   Mindestens **16 Looks** durch Kombination: 3 Körpertypen × 6 Hauttöne × 10 Frisuren × 12 Oberteile × 6 Hosen × Brillen/Rucksäcke – per Skript erzeugt, nicht von Hand.
2. **Prof. Haferkorn**: ~58, grau, Brille, Hemd, Pullunder, Cordhose, Lederschuhe, Uhr, Kreide in der Hand – als eigener Look aus der gewählten Quelle, Gesicht mit **≥ 6 Mundformen** (Shape Keys: Kiefer, Lippen rund/breit, Augenbrauen, Blinzeln) oder Kiefer-/Lippenknochen; Blick mit Sakkaden bleibt (v2-Logik übernehmen).
3. **Animation.** Retargeting mit `SkeletonUtils.retargetClip` (three.js) oder in Blender; Zustandsmaschine mit Blending (Idle-Varianten, Gehen mit Fußfixierung, Tafel schreiben mit Zwei-Knochen-IK auf den Kreidestrich – v2-IK übernehmen –, Zeigen, Trinken, Hände in Taschen, Schulterblick, Erwischt-Blick). Studierende: Tippen mit Fingerbewegung, Schreiben, Scrollen, Handy, Schlafen, Flüstern, Nicken, Lachen, Aufstehen/Gehen in der Pause. Alle Zustände aus `src/chars/*.js` von v2 abdecken (Liste in `docs/ITERATIONEN.md` abhaken).
4. **Ich-Perspektive mit echtem Körper.** Der eigene Avatar ist ein vollständiges Modell (Kopf unsichtbar, Kamera an den Augen) – damit sind die Hände **echte Hände mit Fingern**: Tippen (prozedurale Fingertipps auf echten Tasten), Kuli-Griff (Finger an der Stiftachse), Deckel greifen, Hand am Touchpad, Ruhehaltung; Ärmel aus dem Kleidungsset; Nahbereich-Normalmaps für Haut/Stoff; kein Clipping in der Nahkamera (Prüfbilder aus Laptop-, Heft- und Zuhör-Blick).
5. **Crowd-Technik.** Zusammengeführte Skinned-Meshes pro Material (v2-Ansatz) **oder** Instancing mit Knochen-Texturen; LOD0 nahe (Finger, Gesicht), LOD1 mittel, LOD2 fern; auf Mobil hintere Reihen als gebackene **Impostor-Sprites** (8 Winkel, aus Blender gerendert). Animations-Update entfernt mit 15–20 Hz.
6. **Gesichter.** Blinzeln, Augenbewegung, Mund zur Stimme (Phase 6 liefert Hüllkurven), Emotionen bei Pointe/Erwischt-Moment; Studierende mit zufälligen Mikroausdrücken.

**Abnahme:** Screenshots DPR 2: Prof an der Tafel (nah), Prof Schulterblick, Studierende seitlich, eigene Hände beim Tippen/Schreiben/Deckel, Gruppenbild aus dem Podium; 10-Bild-Sequenz Gehen→Tafel; keine Fußrutscher, kein Clipping; Draw Calls der Figuren ≤ 12 (Desktop) / ≤ 6 (Mobil); Lizenzliste komplett.

### Phase 5 – Requisiten und Details

**Ziel:** Alles auf den Tischen, an den Wänden, am Pult ist ein echtes Modell.

**Aufgaben**
1. Aus Kenney (Furniture Kit, Food Kit, Office-Teile), Poly Haven (Becher, Bücher, Pflanzen, Rucksäcke, Flaschen, Laptops, Stühle …), Quaternius (Office/Furniture-Packs), KayKit: Laptops (≥ 4 Modelle, Sticker als Decals), Notizblöcke, Kulis, Textmarker, Mensa-Becher, PET-Flaschen, Rucksäcke, Jacken, Handys, Kopfhörer, Skriptum mit Eselsohr, Äpfel, Weckerl, Thermoskannen, Futtermittel-Probengläser mit echten Etiketten, Pansenmodell, Kreide, Schwamm, Laserpointer, Clicker, Wanduhr, Feuerlöscher, Rauchmelder, Lautsprecher, Thermostat, Mülltrennung, Plakate (nachempfunden, nicht kopiert), Garderobenhaken, Steckdosen, Kabel.
2. Was es nicht gibt (z. B. der BOKU-Mensa-Becher, die Schiebetafel, das Pansenmodell): in Blender per Skript modellieren, mit Bevels und ambientCG-Materialien, AO gebacken.
3. Platzierung mit Vielfalt (Rotation, Abnutzung, Kaffeeringe als Decals, Kratzer-Decals auf Bänken); ≥ 70 Typen, ≥ 900 Instanzen; statisch gebatcht/instanziert.
4. Das v2-Detailniveau (Stufen-LEDs, Kaugummi unter der Bank, Flackern, Knarzen, Silhouetten im Gang) bleibt erhalten – jetzt mit Modellen.

**Abnahme:** „Baukasten?“-Checkliste aus `docs/ITERATIONEN.md` (v2) erneut durchgehen – jede Zeile „nein“; Nahaufnahmen von 10 Requisiten bei DPR 2; Budget eingehalten.

### Phase 6 – Prof. Haferkorn: Texte und Stimme

**Ziel:** Ein Prof, der klingt wie ein Mensch: witzig, warm, streng, österreichisch, fachlich wasserdicht – und mit echter Stimme.

**Aufgaben**
1. **Persona-Bibel** (`docs/DIALOG.md`): Biografie (fiktiv: aufgewachsen auf einem Hof im Weinviertel, Dissertation über Pansenprotozoen, Jahr in Brasilien an einem Feedlot, radelt zur BOKU, Allergie gegen das Wort „Gras“ als Futtermittel), Sprechweise (Wiener Hochschuldeutsch mit Schmäh: „Herrschaften“, „passt“, „so, jetzt wird’s wichtig“, „ja?“ als Rückfrage, „Sie dürfen das mitschreiben“), Running Gags (die Fernbedienung des Beamers, die Mensa-Kaspressknödel, der Prüfungstermin, „Rudi“ der Fistelochse, der 40A), Tabus (keine Herabwürdigung, keine Politik, keine realen Personen, nichts Sexualisiertes), Humorregeln (Pointe aus dem Fach, Selbstironie, Timing: Pause vor der Pointe).
2. **Textkorpus** je Sprache ≥ 1 500 Sätze in `src/content/dialogue.de.json` / `dialogue.en.json`, strukturiert nach: Phasen (Ankommen, Einstieg, 15 Abschnitte, Pause, Teil 2, Abschluss), Ereignisreaktionen (alle 28 Ereignistypen von v2, je ≥ 6 Varianten), Anekdoten (≥ 60, je an einen Fachinhalt gebunden), Fragen in den Saal mit Reaktionen auf richtige/falsche/keine Antwort, Rückbezüge („wie die Dame in Reihe 3 vorhin gesagt hat“), Zeit-/Wetter-/Wochentagsbezug, Erwischt-Dialoge in drei Eskalationsstufen, Prüfungswarnungen, Abschiedsformeln. **Englisch ist eine eigene Fassung** (gleicher Witz, britisch-trockene Färbung, gelegentliches „Grüß Gott, ladies and gentlemen“), keine Maschinenübersetzung.
3. **Dialog-Engine erweitern:** Gedächtnis innerhalb der Vorlesung (Callbacks), Variantenwahl ohne Wiederholung, Pausen/Atmer zwischen Sätzen, Sprechen während des Schreibens (kürzere Sätze), Unterbrechungen (Handy klingelt → Prof reagiert, setzt den Satz fort), Namen fiktiver Studierender aus dem Besetzungsplan.
4. **Zwei Redaktionsdurchgänge**, dokumentiert: (a) Komik/Timing (jede Pointe: Setup, Pause, Punchline; Streichung von Flachem), (b) Fachlektorat: jede Zahl/Aussage in der Faktentabelle mit Quelle (Kirchgeßner, GfE, DLG, Jeroch).
5. **Stimme vorrendern** (`tools/voice.mjs`): Piper, deutsche Stimme mit leicht reduziertem Tempo (0,92) und Satzpausen, englische Stimme; Nachbearbeitung mit ffmpeg (Normalisierung −16 LUFS, leichter Hörsaal-Hall bleibt zur Laufzeit per Convolver), Encoding AAC 48 kbit/s mono (`.m4a`, läuft auf iOS) und Opus/WebM als Alternative; Hüllkurve (20 Hz, Uint8) je Clip für die Lippensynchronisation; Clip-Manifest mit Dauer. Budget: Desktop ≤ 35 MB Audio gesamt; Mobil: Signatursätze (Reaktionen, Anekdoten, Pointen, Erwischt-Dialoge) vorgerendert ≤ 12 MB, Lehrinhalt-Sätze per Browser-TTS mit Hüllkurven-Schätzung.
6. **Räumlichkeit**: vorgerenderte Clips laufen durch den vorhandenen Mixer (Panner, Convolver, Dämpfung am Laptop), Untertitel bleiben immer.

**Abnahme:** Zähltests (≥ 1 500/Sprache, Varianten, keine Wiederholung in 10 simulierten Vorlesungen), Faktentabelle vollständig, Hörprobe: 20 zufällige Clips als `docs/audio/beispiele/*.m4a` plus Transkript; Lippensynchronisation im Screenshot-Video (10 Bilder) sichtbar; Bot-Balancing wiederholt (Dialoglängen ändern das Timing).

### Phase 7 – Mobil: Touch, Build, Hosting, PWA

**Ziel:** Am Handy ist das Spiel kein Kompromiss, sondern eine eigene, gute Erfahrung.

**Aufgaben**
1. **Zwei Builds aus einer Quelle** (`npm run build:desktop`, `npm run build:mobile`): Mobil mit `mobile`-Asset-Profil (≤ 1K KTX2 ETC1S, LOD1/2, Impostoren ab Reihe 7, 1 Schattenkaskade, SMAA statt MSAA, kein N8AO, Lightmap 2 × 1024²), gehostet als Ordner (`dist/mobile/index.html` + `assets/`), **≤ 30 MB**.
2. **Touch-Steuerung von Grund auf** (`docs/MOBILE.md` mit Skizze): Querformat primär (Hochformat im Laptop-Blick erlaubt und gut: der Laptop füllt das Bild); Ziehen irgendwo = Blick; **Pinch = genau hinschauen**; Tippen auf Laptop-Felder; untere Leiste mit großen Tasten (≥ 48 px, Safe-Area-Insets): Laptop/Zuhören, Mitschreiben (halten), Fenster, Hinschauen (halten), Pause; Halte-Tasten mit sichtbarem Fortschrittsring; Haptik (`navigator.vibrate`) auf Android; kein Hover; Audio-Freischaltung beim ersten Tipp (iOS); Vollbild auf Android; Hinweis zum Drehen; Bildschirm-wach (Wake Lock).
3. **Leistung mobil:** dynamische Auflösung 0,75–1,0 (CAS an), 30/60-fps-Umschalter, thermische Drossel (fps-Einbruch → Stufe runter), Speicherbudget ≤ 256 MB Texturen, Ladebalken in Bytes, Startseite sofort.
4. **PWA:** `manifest.webmanifest` (Name, Icons 192/512, `display: standalone`, Querformat-Präferenz), Service Worker mit Precache aller Assets (offline nach erstem Start), Update-Hinweis.
5. **Hosting:** GitHub-Actions-Workflow `.github/workflows/pages.yml` (Build → Deploy auf GitHub Pages, Quelle „GitHub Actions“). Die Freischaltung von Pages ist eine Repo-Einstellung – das kommt in die „Das musst du noch tun“-Liste (ein Klick: Settings → Pages → Source: GitHub Actions). README mit QR-Code zur Pages-URL. Zusätzlich `dist/BOKU_TicTacTierernaehrung_v3_mobile.zip` für eigenes Hosting.
6. **Testmatrix** (Playwright-Geräteprofile: iPhone 13, iPhone SE, Pixel 7, Galaxy S21, iPad Mini, iPad Pro; Hoch- und Querformat): Startseite, LV-Seite, Spiel, Laptop, Quiz, Ergebnis – Screenshots in `docs/screenshots/mobile/`; Lighthouse Mobile (Barrierefreiheit ≥ 90, PWA-Checks grün). Dazu eine **Checkliste für echte Geräte** für den Auftraggeber (was er auf iPhone/Android in 5 Minuten prüfen soll).

**Abnahme:** Mobil-Build ≤ 30 MB, 0 Konsolenfehler in allen Profilen, OCR am Laptop im Hochformat ≥ 95 %, Touch-Durchlauf automatisiert (Start → Laptop → Feld setzen → Mitschreiben → Quiz → Ende), PWA installierbar (Lighthouse), Draw Calls ≤ 120.

### Phase 8 – Performance und Stabilität

**Aufgaben:** Budget-Tabellen je Plattform (Draw Calls, Dreiecke, Texturspeicher, Shader-Programme, Ladezeit, Speicher) in `docs/PERFORMANCE.md` mit Messung je Stufe (Harness aus v2 `tools/phaseshots.mjs --only presets` erweitern); Frustum-Culling-Blöcke, LOD-Übergänge ohne Popping (Dithering), Shader-Vorkompilierung (`compileAsync`), Worker für Asset-Dekodierung, Speicherlecks (10 Vorlesungen hintereinander im selben Tab → stabile Heap-Größe), Wiederherstellung nach `webglcontextlost`.

**Abnahme:** Budgets aus Abschnitt 2 eingehalten; Dauerlauf 10 Vorlesungen ohne Fehler; Ladezeit headless gemessen.

### Phase 9 – Qualitätssicherung, Dokumentation, Auslieferung

**Aufgaben**
1. **Tests** (`npm test`): v2-Tests + neu: Schärfe-KPIs (OCR/Laplace mit Schwellwerten), Primitiven-Verbot, Asset-Manifest-Integrität (SHA256), Lizenzliste vollständig (jedes Asset im Manifest hat Lizenzeintrag), Dialog-Zähltests, Keine-Wiederholung-Test, Folien-Überlauf-Test, Mobil-Build-Größe, PWA-Manifest valide, Touch-Durchlauf, Desktop-Build-Größe, SHA256.
2. **Screenshots** DPR 2: Qualitätsstufen, 6 Orbit, 3 Spielerperspektiven, Sequenz, Gesichter nah, Hände nah, 3 Wetter, UI DE/EN in 1920 × 1080 / 1366 × 768 / 1024 × 768, mobile Matrix.
3. **Dokumente:** `README.md` (Spielen am Desktop/Handy, Steuerung, Build, Pipeline), `docs/SCHAERFE.md`, `docs/ASSETS.md`, `docs/PIPELINE.md`, `docs/MOBILE.md`, `docs/DIALOG.md`, `docs/PERFORMANCE.md`, `docs/AUDIO.md` (Stimme), `docs/BALANCING.md`, `docs/ITERATIONEN.md` (jede Optik-Iteration mit Bild), `docs/CHANGELOG.md`, `docs/ABSCHLUSS_V3.md` (Checkliste aller Punkte dieses Auftrags mit Status und Nachweis, ehrliche Grenzen, „Das musst du noch tun“-Liste).
4. **Credits-Seite im Spiel** (Asset-Autor:innen, Lizenzen, Stimmen, Schriften) im BOKU-Stil.
5. **Auslieferung:** `dist/BOKU_TicTacTierernaehrung_v3.html` (Desktop), `dist/mobile/` + `dist/BOKU_TicTacTierernaehrung_v3_mobile.zip`, `dist/SHA256.txt`, Pages-Workflow; Version 2 bleibt als `dist/BOKU_TicTacTierernaehrung_v2.html` liegen.

### Phase 10 – optional, nur wenn alles davor abgenommen ist

Desktop-Pakete mit **Tauri** (Windows/macOS/Linux) aus dem Desktop-Build, Gamepad-Feinschliff, Cloud-Bestenliste (nur Vorbereitung, kein Backend-Zwang), Replay-Export des Erwischt-Moments als GIF.

---

## 4. Zwischenlieferungen

Der Auftraggeber will schnell sehen, dass das Verschwommene weg ist. Deshalb:

- **Lieferung A – nach Phase 2:** Desktop-Datei `dist/BOKU_TicTacTierernaehrung_v3-alpha.html` mit Schärfe-Fundament und lesbaren Folien/Laptop, noch mit v2-Figuren. Dazu `docs/SCHAERFE.md` (Vorher/Nachher-Bilder bei DPR 2) und eine kurze Nachricht, was sich geändert hat und was noch kommt.
- **Lieferung B – nach Phase 5:** `v3-beta.html` mit Hörsaal, Menschen, Händen, Requisiten.
- **Lieferung C – nach Phase 9:** finale Builds, Hosting-Workflow, Abschlussbericht.

Jede Lieferung: Commit + Push, Datei an den Auftraggeber, Status in `docs/ABSCHLUSS_V3.md`.

---

## 5. Was du dem Auftraggeber am Ende sagst

Kurz, ehrlich, ohne Werbesprache: Was gemessen wurde (mit Zahlen), was nicht messbar war (echte GPU-fps, echte Geräte) und wie er es selbst prüft, welche Lizenznennungen im Spiel stehen, was er noch tun muss (GitHub Pages freischalten, Handy-Checkliste), und wo die Grenzen liegen.

---

## Anhang A – Asset-Quellen (Lizenz prüfen, Stand und Erreichbarkeit vom 29.10.2026)

| Quelle | Inhalt | Lizenz | Zugriff | Status |
|---|---|---|---|---|
| **Poly Haven** – `api.polyhaven.com/assets?t=models|textures|hdris`, Dateien über `dl.polyhaven.org` | Möbel, Pflanzen, Becher, Bücher, Rucksäcke, Laptops, Bäume; PBR-Texturen (Holz, Parkett, Putz, Metall, Stoff); HDRIs (bewölkt, sonnig) | CC0 | JSON-API + Direktdownload | ✓ erreichbar |
| **ambientCG** – `ambientcg.com/api/v2/full_json`, Downloads `…/get?file=` | PBR-Texturen (Wood, WoodFloor, Plaster, Fabric, Metal, Chalkboard, Leather, Paper) | CC0 | JSON-API + Direktdownload | ✓ |
| **Quaternius** – quaternius.com (Packs, teils via itch.io) | „Ultimate Modular Men/Women“, „Universal Animation Library“, Office/Furniture-Packs | CC0 | Zip-Download | ✓ |
| **Kenney** – kenney.nl/assets/* (Zip-Links, Browser-User-Agent nötig) | Furniture Kit, Food Kit, City Kit, Nature Kit, Character-Packs, UI/Audio | CC0 | Zip-Download | ✓ |
| **KayKit** – kaylousberg.itch.io | Character-Packs mit Animationen, Props | CC0 | itch-Download (Seite erreichbar; Download-Link ggf. per Browser-Automation) | ✓ |
| **MakeHuman / MPFB2** – github.com/makehumancommunity | Menschen-Generator in Blender, Kleidung/Haare aus dem Asset-Repo | GPL-Werkzeug; **erzeugte Modelle CC0**; Assets einzeln prüfen | GitHub | ✓ (GitHub Raw) |
| **Google Fonts (OFL)** | Handschrift (Caveat, Patrick Hand), Work Sans (liegt vor) | OFL | GitHub Raw / fonts.google.com | ✓ |
| **Piper TTS** – PyPI `piper-tts`; Stimmen `huggingface.co/rhasspy/piper-voices` | `de_DE-thorsten-high/medium`, `en_GB-alan-medium`, `en_US-ryan-high` | MIT (Piper), Stimmen je Modellkarte prüfen (Thorsten: CC-BY/… – nennen) | pip + HTTPS | ✓ |
| **Freesound / Kenney Audio** | Foley (Kreide, Tür, Stuhl, Husten …) | CC0-Filter | API-Key (Freesound) / Zip (Kenney) | Kenney ✓ |
| **Blender** – download.blender.org | DCC headless | GPL (Werkzeug) | Tarball | ✓ |
| **KTX-Software / basisu** – GitHub Releases | KTX2-Encoder | Apache-2.0 | GitHub | ✓ |
| Ready Player Me | realistische Avatare | — | CDN **blockiert** aus dieser Umgebung | ✗ nicht einplanen |
| Mixamo, Sketchfab | Animationen/Modelle | Login/Token nötig | — | ✗ nur, wenn der Auftraggeber Zugang liefert |
| Microsoft Rocketbox | Avatare | nur Forschung | — | ✗ verboten |

Für jede verwendete Datei: `docs/ASSETS.md` mit Quelle, Autor:in, Lizenz, URL, Datum, SHA256, Verwendungsort.

## Anhang B – Schärfe-Messung (Definition)

- Kameras: K1 Sitzplatz Reihe 5/Platz 8 → Leinwandmitte (FOV 60), K2 Laptop-Blick (Spielzustand `laptop`), K3 Tafel (Prof schreibt), K4 „genau hinschauen“ aus K1.
- Viewports: 1920 × 1080 bei DPR 1 und DPR 2; mobil 844 × 390 (iPhone 13 quer) bei DPR 3.
- Ausschnitt: projizierte Begrenzung der Leinwand/des Laptop-Bildschirms + 6 px.
- Laplace-Varianz: Graustufen, 3 × 3-Laplace, Varianz; Baseline = Version 2 (Commit `5a19149`) mit identischer Kamera.
- OCR: tesseract.js `deu`/`eng`, PSM 6, gegen den bekannten Quelltext; Kennzahl = 1 − Levenshtein/Länge, über 5 Folien gemittelt.
- Tabelle in `docs/SCHAERFE.md`: Kamera × DPR × Build (v2, A, C) → Laplace, OCR, Bildlink.

## Anhang C – Prof. Haferkorn, Tonbeispiele (fiktiv; Richtung, nicht Kopiervorlage)

- „Herrschaften, die Weender Analyse ist von 1860. Älter als die Straßenbahn in Wien – und wir verwenden sie noch immer, weil sie funktioniert. So wie der 40A, meistens.“
- „Ich sag’s gleich: ‚Gras‘ ist kein Futtermittel. Gras ist ein Zustand. Das Futtermittel heißt Wiesenfutter, und wenn’s vergoren ist, Grassilage. Wer in der Prüfung ‚Gras‘ schreibt, kriegt ein Bienchen. Aber keinen Punkt.“
- „Mein erster Pansen: 1992, Versuchsgut, ein Fistelochse namens Rudi. Rudi hat mich mehr über Mikrobiologie gelehrt als drei Semester Vorlesung. Rudi hat 22 Stunden am Tag gefressen oder wiedergekäut. Ungefähr wie Sie in der Prüfungswoche – nur produktiver.“
- (Spätkommer:in) „Grüß Gott, kommen S’ nur herein, wir sind erst beim Protein. Das Fett kommt später, da zahlt sich das Hereinschauen noch aus.“
- (Handy klingelt) „Wenn das der Futtermittelhändler ist: Sojaschrot ist eh schon wieder teurer geworden, sagen S’ ihm das.“
- „Das kommt zur Prüfung. Ich sag das nicht, weil ich’s muss. Ich sag’s, weil ich’s gern sag.“
- (Sonnig) „Bei dem Wetter gehört man auf die Weide. Die Kühe sehen das genauso – deswegen geht die Milchleistung im Frühjahr rauf. Stichwort Weidegras: Zucker, Rohprotein, wenig Struktur. Ja, Sie dürfen das mitschreiben.“
- (Erwischt, Stufe 1) „Herr Kollege in Reihe fünf. Ich hab keine Ahnung, was auf Ihrem Bildschirm so spannend ist, aber ich wette, es hat keinen Pansen.“

Englisch gleichwertig eigenständig schreiben, nicht übersetzen.

## Anhang D – Mobile Touch-Spezifikation (Kurzfassung)

| Geste / Element | Zuhören | Laptop | Heft | Quiz |
|---|---|---|---|---|
| Ziehen (irgendwo) | Blick | Cursor | Blick (eingeschränkt) | – |
| Pinch | genau hinschauen (gehalten) | – | – | – |
| Tipp | – | Feld setzen / App bedienen | – | Antwort wählen |
| Taste „Laptop“ | → Laptop | → Zuhören | – | gesperrt |
| Taste „Mitschreiben“ (halten) | Heft | – | loslassen → Zuhören | – |
| Taste „Fenster“ | – | Alt-Tab | – | – |
| Taste „Hinschauen“ (halten) | Zoom | – | – | – |
| Zwei-Finger-Wischen nach unten | – | Deckel zu | – | – |
| Taste „Pause“ | überall | | | |

Tastengröße ≥ 48 px, Abstand ≥ 8 px, Safe-Area, Kontrast AA, Vibration 10 ms bei Halte-Start, Fortschrittsring bei Halte-Tasten.

---

Los geht’s. Phase 0, dann Phase 1 – und nach Phase 2 die erste Lieferung, damit der Auftraggeber die Schärfe sieht.
