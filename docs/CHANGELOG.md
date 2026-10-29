# Changelog

## 3.0.0 (in Arbeit) – Version 3: scharf, echt, mobil

**Schärfe und Lesbarkeit**
- Render- = Bildschirmpixel bis DPR 2 auf allen Stufen, MSAA statt FXAA, Nachschärfung (CAS), entgiftete Nachbearbeitung.
- Folie aus Reihe 5: Texterkennung 88,9 % statt 62,2 %, Kantenschärfe 4,3-fach; Laptop 98,1 % statt 62,1 % (`docs/SCHAERFE.md`).
- Laptop-Blick: Teile der eigenen Figur direkt vor der Kamera werden ausgeblendet (vorher verdeckte der Unterarm Text).

**Menschen**
- Alle Figuren aus MakeHuman/MPFB (CC0): 16 Typen für die Menge, Prof, Nachbarin, Tutorin, drei Spielfiguren mit echten,
  voll gegliederten Händen. Verdeckte Haut per Strahltest entfernt, Detailstufen für die Menge, Atlanten als KTX2.

**Hörsaal und Requisiten**
- Echte PBR-Materialien (ambientCG, CC0): Parkett, Pultholz, Vertäfelung, Putz, Metall, Stein.
- 30 echte Modelle (Poly Haven, CC0): Obst, Thermosflaschen, Mikroskop, Bücher, Krug, Pflanzen, Regal mit Büste u. a.

**Prof. Haferkorn, Stimme, Klang**
- Neue Texte: Anekdoten, Running Gags, Zwischenfragen, akademisches Viertel; Wiederholungen innerhalb einer Vorlesung vermieden.
- Echte Stimmen statt Browser-Sprachausgabe: Deutsch mit Coqui XTTS v2, Englisch mit Kokoro-82M, gemastert (−16 LUFS),
  räumlich am Kopf der Figur, Kiefer folgt der Lautstärke. Desktop: Stimmen als Begleitdatei je Sprache.
- Echte Geräusche (51 Klänge, CC0/CC BY/PD) statt Synthese; synthetisch bleiben nur fünf Laptop-Signaltöne. Menü-Musik von Kevin MacLeod.

**Handy**
- Mobil-Build als PWA (offline nach erstem Start), Touch-Steuerung mit Tastenleiste, Pinch-Zoom, Wake Lock, Pages-Workflow.

**Balance**
- Neu abgestimmt auf die gesprächigeren Prof-Texte: 93 / 50 / 31 / 15 % Erfolg (80 Läufe je Stufe).

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
