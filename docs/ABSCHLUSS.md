# Abschlussbericht – Tic Tac Tierernährung 2.0

Ergebnis: **`dist/BOKU_TicTacTierernaehrung_v2.html`** (eine Datei, offline lauffähig, ≈ 2,1 MB) + `dist/SHA256.txt`.
Quellcode modular in `src/`, Build mit `npm run build`, Tests mit `npm test`.

Legende: ✅ umgesetzt · ◐ teilweise / mit dokumentierter Abweichung · ✗ nicht umgesetzt

## 0. Arbeitsregeln

| Nr. | Regel | Status | Nachweis |
|---|---|---|---|
| 0.1–0.2 | Recherche vor dem Code, dokumentiert | ✅ | `docs/RECHERCHE.md` (2 280 Wörter) + `docs/recherche/*.md` |
| 0.3 | herunterladbar, offline | ✅ | eine HTML-Datei, keine Netzzugriffe, keine ES-Module über `file://` (Test „Build“) |
| 0.4 | keine echten Logos/Fotos | ✅ | Schriftzug „BOKU“ und Farbbalken nachgebaut, keine Bilddateien im Build |
| 0.5 | keine echten Personen | ✅ | Prof. Haferkorn fiktiv; LV-Seite nennt „N. N.“; Namen der Studierenden generisch |
| 0.6 | Hinweis „Fan-Projekt“ sichtbar | ✅ | Vorlader, Ladebildschirm, Startseite (Info-Box, Fußzeile), Zeugnis, Impressum |
| 0.7 | fachliche Korrektheit | ✅ | Inhalte nach Lehrbuchstand (Kirchgeßner, Jeroch/Drochner/Simon, GfE, DLG), Rechenbeispiele nachgerechnet (`docs/RECHERCHE.md`) |
| 0.8 | österreichisches Deutsch + Englisch | ✅ | „Grüß Gott“, „ein bisserl“, „eh“, „heuer“, „Jänner“, „Kaspressknödel“ (Mensa); Englisch vollständig (Test „Übersetzungen“) |
| 0.9 | Screenshots je Phase, Iterationen | ✅ | `docs/ITERATIONEN.md`, `docs/screenshots/` |

## 1. Recherche-Phase

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 1.1 | BOKU – Ort und Identität (Türkenschanze, Gregor-Mendel-Haus, HS 31, Website-Design) | ✅ | `docs/recherche/boku.md`, Design-Tokens `src/ui/tokens.css` |
| 1.2 | Studium Agrarwissenschaften | ✅ | Curriculum, Semesterlage der LV, Exkursionen |
| 1.3 | Fachinhalt Tierernährung | ✅ | 15 Abschnitte, 45 Quizfragen, 15 Rechenbeispiele (DE/EN), Validierung `tools/validate-content.mjs` |
| 1.4 | Vorlesungsatmosphäre | ✅ | Verhaltensprofile, Belegung hinten dichter, Ablauf mit c. t., Pause, Liste, Hybridtechnik |
| Abnahme | ≥ 2 000 Wörter, ≥ 14 Abschnitte, ≥ 40 Fragen, ≥ 8 Rechnungen, Tokens dokumentiert | ✅ | Test „≥14 Abschnitte, ≥40 Quizfragen, ≥8 Rechenbeispiele“ |

## 2. Technische Basis & Rendering

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 2.1 | Modulare Struktur, Build in eine HTML-Datei | ✅ | `src/*`, `tools/build.mjs` |
| 2.1 | Qualitätsstufen + automatische Erkennung | ✅ | GPU-Erkennung beim ersten Start, Bildzeitmessung im Menü (Empfehlung für den nächsten Start), manuelle Wahl |
| 2.1 | 60 fps Iris Xe „Mittel“, Draw Calls ≤ 250 | ◐ | Draw Calls „Mittel“ 249 (Sitzplatz) / 244 (Laptop), alle Passes inkl. Schatten und Post (`docs/PERFORMANCE.md`); fps auf echter GPU in dieser Umgebung nicht messbar (nur CPU-Rasterizer) |
| 2.1 | Pointer Lock (Standard an, Fallback), Gamepad | ✅ | `src/core/input.js`, Einstellung „Mauszeiger einfangen“ |
| 2.2 | Tageslicht + God Rays, Deckenlicht als Flächen, Beamer als Spot mit Projektion | ✅ | `lighting.js`, `fixtures.js` (Spot mit Folie ab „Hoch“) |
| 2.2 | Indirektes Licht (PMREM aus der Raumszene), AO ab „Mittel“ | ✅ | `bakeEnvironment`, N8AO |
| 2.2 | CSM, PCF, Kontaktschatten unter Tischen | ✅ | 1–3 Kaskaden, AO-Streifen unter allen Bänken (`buildDetails`) |
| 2.2 | AgX, Vignette, Farbkorrektur, SMAA, Bloom, Tiefenschärfe am Laptop, CA + Linsenstaub bei Stress | ✅ | `graphics.js`, `hud.js` |
| 2.2 | Kamera: FOV 55–65°, Augenhöhe, Atmen, Nicken beim Schreiben, Easing, Mikro-Sakkaden, Deckelrand im Bild | ✅ | `playerView.js` |
| 2.3 | Holz mit Maserung/Kratzern/Kaffeerändern, Stoff, Metall, Tafel mit alten Formeln, Kreide als Pfad, Leinwandgewebe, BOKU-Folien | ✅ | `textures.js`, `chalkboard.js`, `slides.js` |
| 2.3 | Linoleum/Teppich | ◐ | Recherche: HS 31 hat Eichenparkett → Parkett statt Linoleum |
| 2.3 | Fensterglas mit Reflexion/Schlieren, Außenwelt mit Bäumen + Wind-Shader | ✅ | `outside.js` |
| 2.3 | Staubpartikel im Licht | ✅ | ab „Hoch“ |
| Abnahme | alt/neu-Vergleich, Performance-Tabelle, kein Z-Fighting, keine Akne, alle Presets getestet | ✅ | `compare_v1_seat.jpg`/`compare_v2_seat.jpg`, `phase2_preset_*.jpg`, `docs/PERFORMANCE.md` |

## 3. Hörsaal

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 3 | 8–10 ansteigende Reihen, ergonomische Maße | ✅ | 10 Reihen à 11 Plätze, Reihenabstand 0,80 m, Stufe 14 cm (Altbau) |
| 3 | durchgehende Reihen mit Klappsitzen, Nummern, Steckdosen | ◐ | HS 31 hat historische feste Pultbänke (Recherche) → Bänke statt Klappsitze; Nummern + Steckdosen + Kabel vorhanden |
| 3 | Seitengänge mit Handlauf, Stufenlicht, Notausgang, Feuerlöscher, Rauchmelder, Lautsprecher, Lüftung, Kabelkanäle, Lichtschalter, Mülltrennung | ✅ | `hall.js`, `buildDetails` |
| 3 | Pult mit Mediensteuerung, Schiebetafeln (2 Flügel, beide genutzt), elektrische Leinwand, Beamer, Kreide, Schwamm, Laserpointer | ✅ | `hall.js`, `fixtures.js`, `profView.js` |
| 3 | Wände, Plakate, Schwarzes Brett, Uhr synchron, Thermostat, Hörsaalschild | ✅ | 12 Plakate (nachempfunden), Wanduhr läuft mit Spielzeit |
| 3 | Fenster mit Rollos, Fensterbänke mit Pflanze/Becher | ✅ | |
| 3 | Türen mit Schließer, Glasausschnitt, Gang mit Silhouetten, Garderobe, Rucksäcke, Jacken, Helm | ✅ | |
| 3 | Spieler-Tisch (Laptop mit Stickern, Block mit wachsender Mitschrift, Kuli, Textmarker, Flasche, Mensa-Becher, Handy, Skriptum mit Eselsohr, Apfel) | ✅ | `props.js` |
| 3 | Nachbarin links schreibt mit, rechts frei mit Rucksack | ✅ | `population.js` |
| 3 | Imperfektion: Kratzer, wackelnder Sitz, flackerndes Licht, Kaugummi | ✅ | Sitz knarzt bei schnellen Bewegungen; Licht flackert (abschaltbar) |
| Abnahme | 6 Orbit-Winkel + 3 Spielerperspektiven, ≥ 60 Props, Baukasten-Checkliste | ✅ | `phase3_orbit*.jpg`, `phase3_player*.jpg`, 70 Requisitentypen (`PROP_LIST`), Checkliste in `docs/ITERATIONEN.md` |

## 4. Charaktere & Animation

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 4.1 | Prof: Skelett mit Fingern, Kleidung (Hemd, Pullunder, Cordhose, Brille, graue Haare, Bart) | ✅ | `rig.js`, `PROF_SPEC` |
| 4.1 | Idle, Gehen ohne Rutschen, Drehen, Schreiben (Hand folgt Schrift, Körper folgt Zeile), Wischen, Tafel schieben, Laserpointer, Clicker, Pult, Brille, Uhr, Trinken, Hände in Taschen, Gesten, Frage-Pose, Erwischt-Blick, Fensterblick | ✅ | `profView.js`, `profLogic.js` |
| 4.1 | Gesicht: Blinzeln, Sakkaden, Mund, Augenbrauen | ✅ | `character.js` |
| 4.1 | Blickverhalten mit Mustern, Bewegung, Schulterblick mit Vorwarnung + Bluff, Tuning-Datei | ✅ | `profLogic.js`, `config.js` |
| 4.2 | ≥ 40 Studierende, ≥ 12 Varianten (Körper 3+, Frisuren 8+, Oberteile 10, Hosen, Hauttöne 6, Brillen, Rucksäcke) | ✅ | 49 Studierende im Standard-Saal, alle individuell zusammengesetzt |
| 4.2 | Verhaltensprofile inkl. Spätkommer:in, Fragesteller:in, Nachbarin | ✅ | `crowd.js` |
| 4.2 | Köpfe reagieren auf Ereignisse, einige lachen bei der Pointe | ✅ | `lookAll`, `laugh` |
| 4.3 | Tutorin, Silhouetten auf dem Gang | ✅ | |
| Abnahme | 10-Bild-Sequenz, kein Fußrutschen, kein Clipping, Kopfgrenzen | ✅ | `phase4_seq_01…10.jpg`, `phase4_shoulder_check.jpg` |

## 5. Vorlesung als System

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 5 | Zeitleiste 90 Spielminuten ≈ 12 min (7/12/20/90 wählbar) | ✅ | `LENGTHS` |
| 5 | Phasen inkl. Pause mit freiem Spiel, Schluss mit Prüfungshinweis + Liste | ✅ | `director.js` |
| 5 | Ereignispool mit Wahrscheinlichkeiten/Abklingzeiten (alle im Auftrag genannten) | ✅ | 28 Ereignistypen |
| 5 | Dialog-Engine mit Varianten, natürliche Sprache, Rückbezüge | ✅ | 3 Varianten je Satz |
| 5 | Sprachausgabe (de-AT bevorzugt), Untertitel immer, Murmeln als Ersatz, räumlich, am Laptop gedämpft | ◐ | Browser-TTS ist technisch nicht räumlich (API-Grenze) – Lautstärke wird nachgeführt; Murmeln ist räumlich |
| 5 | Folien per Clicker mit Blend, Tafel Strich für Strich, Herleitungen, Wischen, Hochschieben | ✅ | Folien auch aus hinteren Reihen lesbar: kontrastreiche Leinwand, „Genau hinschauen“ (`F`), Folie auf dem Hybrid-Monitor (`docs/ITERATIONEN.md`, Nachbesserung) |
| 5 | Mitschrift-Mechanik mit Quiz-Hilfe | ✅ | `N`, „Blick in die Mitschrift“ (`R`) |
| Abnahme | RUN_LOG, ≥ 25 Ereignistypen, ≥ 400 Sätze DE + EN | ✅ | `docs/RUN_LOG.txt` (26 Typen in einem Durchlauf), 1 079 Sätze DE / 1 083 EN in den Abschnitten + 553 Dialogsätze |

## 6. Gameplay-Tiefe

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 6 | Sichtkegel (fovea ~10°, peripher ~60°), Sichtlinie mit Verdeckung, Entfernung, Sitzplatzwahl mit Vor-/Nachteilen | ✅ | `vision.js`, Platzfaktor, hinten weniger Quiz-Zeit und undeutlichere Untertitel |
| 6 | Verdacht dreistufig, Körpergefühl (Herz, Rand pulsiert, Hände zittern), Anzeige optional | ✅ | `suspicion.js`, Einstellung „Bauchgefühl-Anzeige“ |
| 6 | Deckelwinkel, Alt-Tab (0,3 s), Helligkeit, Kopfhörer, Prof-Sicht `F3` | ✅ | |
| 6 | Gegner:in im Saal (sichtbar, wird selbst beobachtet, Chat) + Online-KI mit 3 Stärken; Best-of, Blitz, Turnier | ✅ | `opponent.js`, `tictactoe.js` |
| 6 | weitere Mini-App + glaubwürdiger Desktop | ✅ | Snake, Skriptum mit Vorlesungstext, BOKUlearn, Mail, Taskleiste, eduroam, Akku |
| 6 | Konsequenzen 3-stufig, Quiz beeinflusst Toleranz | ✅ | |
| 6 | Note 1–5, Zeugnis, Rangliste, Erfolge | ✅ | 14 Erfolge |
| 6 | Tutorial in den ersten 90 s, abschaltbar | ✅ | |
| 6 | 4 Stufen + Custom | ✅ | |
| Abnahme | Bot 20 Läufe je Stufe, Bachelor ~50 % | ✅ | `docs/BALANCING.md` (80 Läufe je Stufe: Bachelor 54 %, monoton 95 → 54 → 35 → 11 %) |

## 7. UI/UX

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 7 | Startseite als Website-Nachbau mit Live-Hero, LV-Seite BOKUonline, Einstellungen, Mensa-Pause, Zeugnis, Badges | ✅ | `docs/screenshots/ui/` |
| 7 | Responsiv, Touch | ✅ | Layouts bis 1024 px getestet, Touch-Steuerung |
| 7 | Barrierefreiheit (Tastatur, Fokusringe, Untertitelgröße, Farbfehlsicht, Fotosensibilität, Bewegungsreduktion) | ✅ | + hoher Kontrast, minimales HUD |
| 7 | HUD minimal/ausblendbar, diegetische Infos | ✅ | |
| 7 | Ladebildschirm < 5 s | ◐ | Startseite erscheint sofort (Vorlader im HTML), Hörsaal lädt im Hintergrund; Ladezeit auf echter Hardware hier nicht messbar |
| Abnahme | Screenshots DE/EN × 1920×1080, 1366×768, 1024×768; Lighthouse-Accessibility ≥ 90 | ✅ | 66 Screenshots; Lighthouse: Barrierefreiheit **100**, Best Practices 100, SEO 100 |

## 8. Audio

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 8 | Ambiente (Lüftung, Beamer, Tippen, Knarzen, Husten, Blättern, Kuli, Tür, Schritte, Vögel/Wind/Verkehr, Regen mit Wetter) | ✅ | `docs/AUDIO.md` |
| 8 | Prof: Schritte je Boden, Kreide, Wischen, Clicker, Mikro-Rückkopplung, Glas, Räuspern; Hall per Convolver | ✅ | |
| 8 | Spieler: Tastatur, Touchpad, Scharnier, Herz/Atem, Stift, Stoff | ✅ | |
| 8 | Menü-Thema, keine Musik im Spiel | ✅ | |
| 8 | Mixer, persistiert | ✅ | |
| Abnahme | Kanalliste, Loop-Test, Normalisierung | ✅ | `docs/AUDIO.md` (Nahtverhältnis aller Loops < 3) |

## 9. Qualitätssicherung

| Nr. | Punkt | Status | Nachweis |
|---|---|---|---|
| 9 | README | ✅ | `README.md` |
| 9 | Doku | ✅ | `docs/` |
| 9 | Tests: Headless ohne Konsolenfehler, Minimax, Sichtmodell, Übersetzungen, Build-Größe | ✅ | `npm test` (+ `--e2e`) |
| 9 | Browser-Matrix Chrome/Edge/Firefox/Safari | ◐ | getestet: Chromium (Headless, SwiftShader). Keine browserspezifischen APIs (WebGL 2, Web Audio, Speech optional); kein `OES_texture_float`-Zwang (Half-Float), keine WebGPU-Pflicht. Firefox/Safari/Edge konnten hier nicht ausgeführt werden. |
| 9 | Endprodukt + SHA256 | ✅ | `dist/`; Endkontrolle aller Dokumentationsbilder mit dem fertigen Build (Befunde und Korrekturen in `docs/ITERATIONEN.md`, Phase 9) |

## Messwerte

Siehe `docs/PERFORMANCE.md` (Draw Calls, Dreiecke, Bildzeiten je Stufe), `docs/BALANCING.md` (Erfolgsquoten), `docs/AUDIO.md` (Loop-Nähte),
Lighthouse (Startseite, ohne Netzwerkdrosselung): Barrierefreiheit 100, Best Practices 100, SEO 100, Performance 61
(FCP 0,2 s, LCP 0,6 s; die Gesamtbewertung leidet unter der Blockierzeit beim Aufbau des Hörsaals auf dem CPU-Rasterizer).

## Bekannte Grenzen

- **Echte GPU-Leistung nicht messbar:** Die Arbeitsumgebung hat keine GPU; alle Bilder wurden mit SwiftShader (CPU) gerendert.
  Bildzeiten dort sind 20–100× langsamer als auf echter Hardware und taugen nur für relative Vergleiche.
- **Headless-Screenshots:** Totalen des ganzen Saals brauchen im CPU-Rasterizer 30–45 s pro Bild; dabei stürzt Chromium gelegentlich ab
  (GPU-Watchdog). `tools/phaseshots.mjs` öffnet die Seite dann neu und wiederholt das Bild. Auf echter Hardware tritt das nicht auf.
- **Browser-Sprachausgabe** nicht räumlich; Stimmenauswahl hängt vom Betriebssystem ab.
- **Gesichter** stilisiert ohne Texturdetails (aus Spielerposition sieht man vor allem Hinterköpfe).
- **Neue Vorlesung mit anderem Platz/Wetter** lädt die Seite neu (sauberer GPU-Speicher statt Teil-Neuaufbau).
- **Hörsaal-Details**, die die Recherche nicht belegt (Fensterseite, genaue Möblierung), sind plausibel ergänzt und in `docs/recherche/boku.md` als Annahme markiert.

## Vorher / Nachher

`docs/screenshots/compare_v1_seat.jpg` (Version 1) ↔ `docs/screenshots/compare_v2_seat.jpg` (Version 2) sowie die Iterationsbilder in `docs/ITERATIONEN.md`.
