# Changelog

## 3.0.0 (in Arbeit) – Version 3: scharf, echt, mobil

**Schärfe und Lesbarkeit**
- Render- = Bildschirmpixel bis DPR 2 auf allen Stufen, MSAA statt FXAA, Nachschärfung (CAS), entgiftete Nachbearbeitung.
- Folie aus Reihe 5: Texterkennung 88,9 % statt 62,2 %, Kantenschärfe 4,3-fach; Laptop 98,1 % statt 62,1 % (`docs/SCHAERFE.md`).
- Laptop-Blick: Teile der eigenen Figur direkt vor der Kamera werden ausgeblendet (vorher verdeckte der Unterarm Text).

**Menschen (überarbeitet: Microsoft Rocketbox + Motion Capture)**
- Rückmeldung „Figuren wirken steif, seltsam, keine echten Animationen, komische Hände“: Alle Menschen stammen jetzt aus der
  Microsoft Rocketbox Avatar Library (MIT) – 29 Figuren für die Menge, Prof, Nachbarin, Tutorin, drei Spielfiguren – und
  bewegen sich mit den Motion-Capture-Aufnahmen derselben Bibliothek: Sitzen am Tisch (Atmen, Umschauen, Gähnen, Kopf
  kratzen, Haare richten, Husten, Achselzucken …), Stehen, Gehen, Sprechgesten und Präsentieren für den Prof.
  Finger, Handgelenke und Schultern kommen aus echten Aufnahmen statt aus gerechneten Posen.
- Darüber nur, was das Spiel steuern muss: Blick mit Sakkaden, Hand-IK (Tastatur, Stift, Hand heben, Kreide, Pult),
  Vorbeugen, Nicken, Lachen; Gesichter von Prof, Nachbarin und Tutorin mit echten Gesichtsformen (Visemes, Blinzeln,
  Brauen), Studierende blinzeln und sprechen über Lid- und Kieferknochen.
- Haar: Die Haarkarten einiger Figuren hatten nach innen zeigende Normalen – im Bild ein metallisch glänzender „Schädel“
  durch die Frisur. Normalen jetzt nach außen gekämmt, Strähnenfarbe in transparente Bereiche ausgeblutet, Deckung beim
  Verkleinern erhalten, Haar ohne Spiegelglanz an den Kartenkanten.
- Ältere Fassung: MakeHuman/MPFB (CC0), weiterhin als Rückfallebene im Werkzeug (`--old-humans`).
- Mundformen beim Sprechen: Prof und Nachbarin haben Lippenknochen (Ober-/Unterlippe, Mundwinkel); acht Mundformen
  (Ruhe, A, E, I, O, U, F/V, M/B/P) werden aus dem gesprochenen Text gebildet und über die Lautstärke der Aufnahme verteilt.
  Auch Nachbarin, Studierende und Tutorin bewegen jetzt beim Sprechen den Mund.
- Skin-Gewichte werden so gerundet, dass sie je Vertex genau 255 ergeben. Vorher zog eine Summe von 254 einzelne Vertices
  um rund 4 mm zum Ursprung (Zacken an den Mundwinkeln, feines Flimmern an Gelenken).

**Hörsaal und Requisiten**
- Echte PBR-Materialien (ambientCG, CC0): Parkett, Pultholz, Vertäfelung, Putz, Metall, Stein.
- 30 echte Modelle (Poly Haven, CC0): Obst, Thermosflaschen, Mikroskop, Bücher, Krug, Pflanzen, Regal mit Büste u. a.

**Prof. Haferkorn, Stimme, Klang**
- Neue Texte: Anekdoten, Running Gags, Zwischenfragen, akademisches Viertel; Wiederholungen innerhalb einer Vorlesung vermieden.
- Echte Stimmen statt Browser-Sprachausgabe: Deutsch mit Coqui XTTS v2, Englisch mit Kokoro-82M, gemastert (−16 LUFS),
  räumlich am Kopf der Figur, Kiefer folgt der Lautstärke. Desktop: Stimmen als Begleitdatei je Sprache.
- Echte Geräusche (51 Klänge, CC0/CC BY/PD) statt Synthese; synthetisch bleiben nur fünf Laptop-Signaltöne. Menü-Musik von Kevin MacLeod.

**Licht**
- Gebackenes Licht aus Blender/Cycles: indirektes Licht der Deckenleuchten, des Himmels und der Sonne plus
  Umgebungsverdeckung auf allen Saalflächen (vier Atlanten à 2048², entrauscht, Wettervarianten sonnig/bewölkt).

**Stimme (Entscheidung des Auftraggebers: Deutsch reicht)**
- Vertont wird vollständig auf Deutsch; Englisch bleibt als Textfassung, nur teilweise vertont.
- Keine Sprachausgabe des Browsers und kein synthetisches Murmeln mehr: ohne Aufnahme bleibt der Untertitel.

- Achter Running Gag „Kreide“: seine eigene Kreide quietscht „nur bei Wichtigem“ (je 6 Varianten DE/EN, echtes Kreidegeräusch).
- Sprechdauern mit dem gemessenen Tempo der Aufnahmen (Deutsch 0,081 s/Zeichen statt geschätzt 0,064); der Ablauf wartet auf
  das Ende jeder Aufnahme.

**Handy**
- Mobil-Build als PWA (offline nach erstem Start), Touch-Steuerung mit Tastenleiste, Pinch-Zoom, Wake Lock.
- GitHub Pages: der Workflow veröffentlicht vom Standard-Branch – Handy-Fassung und Desktop-Fassung im Browser spielbar,
  ohne Download (einmalig Pages einschalten).

**Leistung**
- Requisiten in einem gemeinsamen Texturatlas (73 Materialien → 1 Atlasseite), Glas ohne Transmissionsdurchgang, Echtzeitschatten
  nur für Möbelgroßes, Wände und Figuren; Figuren ein Material je Atlas. „Mittel“: 706 → 245 Draw Calls je Bild (Budget 250).
- Desktop-Datei 71 MB (Ziel ≤ 80), Mobil-Kern < 30 MB (Positionen der Figuren als Int16, Lightmap-UVs kompakt, Animationen als
  Int16-Differenzen).

**Balance**
- Neu abgestimmt auf die gesprächigeren Prof-Texte, danach nachgemessen mit dem echten Sprechtempo: **86 / 54 / 28 / 16 %**
  Erfolg (80 Läufe je Stufe; Bachelor im Zielband 45–60 %).

**Tests**
- Neu: Rocketbox-Figuren (Gewichte, Animationsformat, Lizenzhinweis), Dialogumfang (≥ 1 500 Sätze je Sprache, ≥ 60 Anekdoten,
  ≥ 8 Running Gags, ≥ 6 Varianten), keine Wiederholung eines Prof-Satzes in 10 simulierten Vorlesungen; Werkzeuge für Dauerlauf
  (`tools/soak.mjs`), Touch-Durchlauf (`tools/touch-e2e.mjs`) und Leistungstabelle (`tools/perf-table.mjs`).

## 2.0.0 – Tic Tac Tierernährung v2 (2026-10-28)

Komplette Neuentwicklung nach `AUFTRAG_V2.md`. Version 1 liegt unverändert in `legacy/v1/` bzw. `dist/BOKU_TicTacTierernaehrung_v1.html`.

### Recherche & Inhalte
- `docs/RECHERCHE.md` (+ Detailnotizen `docs/recherche/`): BOKU-Standort Türkenschanze, Gregor-Mendel-Haus, Hörsaal HS 31
  (Hybridhörsaal, 110 Plätze, ansteigend, Tafel, Leinwand 3,6 m), Webdesign von boku.ac.at (Farben, Typografie, Raster) als Design-Tokens,
  Studienplan Agrarwissenschaften, Fachstoff Tierernährung auf Bachelor-Niveau.
- 15 Vorlesungsabschnitte (Einführung, Futtermittelanalytik, Verdauung Schwein/Geflügel, Verdauung Wiederkäuer, Energiebewertung,
  Proteinbewertung Wiederkäuer, Proteinbewertung Schwein/Geflügel, Futtermittelkunde, Futterkonservierung, Rationsberechnung Milchkuh,
  Stoffwechselstörungen, Mineralstoffe und Vitamine, Fütterung und Umwelt, Futtermittelrecht, Ausblick) mit Folien, Tafelanschrieben,
  je 3 Formulierungen pro Satz, 45 Quizfragen, 15 Rechenbeispielen – alles auf Deutsch und Englisch (über 1 000 Sätze je Sprache).
- Dialoge für Ereignisse, Nachbarin, Tutorin, Gegner-Chat (über 550 Sätze).

### Technik & Grafik
- Modularer Quellcode (`src/core|gfx|scene|chars|game|laptop|ui|audio|content`), esbuild-Build in **eine** offline-fähige HTML-Datei (≈ 2,1 MB).
- three.js r183, Kaskadenschatten (CSM), N8AO, AgX-Tonemapping, Bloom, SMAA/FXAA, Tiefenschärfe am Laptop, Vignette, Filmkorn,
  chromatische Aberration und Linsenstaub nur bei Stress; vier Qualitätsstufen + Automatik (GPU-Erkennung, Bildzeitmessung).
- Prozedurale PBR-Texturen auf der GPU (Albedo, Normal, Roughness/AO): gebeiztes Eichenholz, Parkett, Putz, Kreidetafel, Leinwandgewebe, Ziegel u. a.
- Hörsaal HS 31 nach Recherche: historische dunkle Pultbänke mit Sitznummern, Parkett, Sprossenfenster mit tiefen Laibungen, Vertäfelung,
  Schiebetafeln (zwei Flügel), elektrische Leinwand, Beamer mit Projektionslicht, Hybrid-Monitor, Kamera, Pult mit Touchscreen;
  Außenwelt mit Gregor-Mendel-Straße, Linnéplatz, Bussen 40A/37A, Türkenschanzpark mit Herbstbäumen, Paulinenwarte.
- 70 Requisitentypen (Laptops, Collegeblöcke mit Handschrift, Futtermittel-Probengläser, Pansen-Modell, Mensa-Becher, Rucksäcke, Jacken …).

### Figuren & Animation
- Eigenes Skelett-Rig für Prof. Haferkorn (fiktiv), 49 Studierende in 8 Verhaltensprofilen, Tutorin, Spätkommer:in; alle Figuren
  teilen sich ein Material und werden zu zwei SkinnedMeshes zusammengeführt (mit/ohne Schatten), jede mit eigenem Skelett.
- Gehen mit festen Füßen, Zwei-Knochen-IK, Schreiben an der Tafel mit der Hand am Kreidestrich, Laserpointer, Wischen, Tafel schieben,
  Trinken, Gesten, Blick mit Sakkaden, Blinzeln, Mundbewegung; Studierende tippen, schreiben, scrollen, schlafen, flüstern, nicken, lachen.
- Eigener Körper in der Ich-Perspektive (Hände am Laptop, am Kuli, am Deckel).

### Spiel
- Vorlesungs-Director mit Phasen (Ankommen, Einstieg, Teil 1, Pause, Teil 2, Abschluss) und 28 Ereignistypen.
- Sichtmodell mit fovealem und peripherem Kegel und Sichtlinien-Verdeckung; dreistufiges Verdachtsmodell (Aufmerksamkeit → Verdacht → Beweis).
- Laptop-Betriebssystem: Tic Tac Toe gegen eine:n Studierende:n im Saal (oder online), Snake, Skriptum, BOKUlearn, Mail;
  Deckelwinkel, Helligkeit, Kopfhörer, Alt-Tab, Stummschaltung.
- Mitschreiben, Prüfungsfragen mit Blick in die Mitschrift, Exkursionsliste (Unterschrift per Mausgeste), Konsequenzen über drei Stufen,
  Note 1–5, Zeugnis, 14 Erfolge, lokale Bestenliste, Tutorial-Hinweise, vier Schwierigkeiten + benutzerdefiniert.
- Headless-Bot und Balancing über 80 Durchläufe je Stufe.

### UI, Audio, Qualität
- Startseite im Stil von boku.ac.at mit Live-Hero, LV-Seite im BOKUonline-Stil mit Sitzplan, Einstellungen, Mensa-Pause, Zeugnis.
- Deutsch (Österreich) und Englisch vollständig, Barrierefreiheit (Fokusringe, Untertitelgröße, Farbfehlsicht, Fotosensibilität,
  weniger Bewegung, hoher Kontrast, minimales HUD), Gamepad und Touch.
- Prozedurales Audio (55 Klänge, 7 Loops), Mixer, Hall, räumliche Quellen, Sprachausgabe mit Murmel-Alternative, Menü-Musik.
- `npm test` (Minimax, Sichtmodell, Verdacht, Regie, Übersetzungen, Inhalte, Build), Headless-E2E, Lighthouse.

### Endkontrolle (vor Auslieferung)
- Beamer-Projektion ab „Hoch“ deckungsgleich mit der Leinwand (perspektivischer Gitter-Warp statt geschätzter Texturgröße).
- Tiefenschärfe im Laptop-/Heftblick auf den gemessenen Abstand fokussiert (Bildschirm war unscharf).
- Draw Calls „Mittel“ 278 → unter 250 (Außenwelt/Fahrzeuge ohne Schatten, Materialien zusammengelegt, Bloom 6 Stufen).
- Balancing mit 80 Läufen je Stufe: 95 / 54 / 35 / 11 % Erfolgsquote.
- Alle Dokumentationsbilder mit dem fertigen Build neu erzeugt; Screenshot-Werkzeug robust gegen Abstürze des CPU-Rasterizers.

### Nachbesserung: Lesbarkeit der Folien
- Leinwand ohne Grauschleier durch Raumlicht, kein Bloom-Glühen über der Schrift, geschärfte Texturabtastung, Folien immer in 1920 × 1080.
- Aufzählungen größer (36–52 px), dunkler und automatisch eingepasst (vorher liefen volle Folien in die Quellenzeile).
- Neu: „Genau hinschauen“ – `F` / linker Trigger halten zoomt auf Tafel und Folien (Hilfe, Tastenbelegung, HUD, Tutorial).
- Hybrid-Monitor zeigt die geteilte Folie.
