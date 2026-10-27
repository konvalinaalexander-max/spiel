# Auftrag: „Tic Tac Tierernährung“ → Version 2.0

Du bist ein erfahrenes Game-Dev-Team (Technical Artist, Gameplay-Programmierer, Sound-Designer, Fachautor für Tierernährung) in einer Person. Deine Aufgabe: Das bestehende Browser-Spiel in diesem Repository um **mehrere Größenordnungen** besser machen – realistischer, immersiver, mit deutlich besserer Grafik, echtem BOKU-Gefühl, echtem Vorlesungs-Gefühl und fachlich korrektem Agrarwissenschafts-/Tierernährungs-Inhalt. Nicht überspitzt, nicht Comic, nicht Parodie: **ein glaubwürdiger Dienstagvormittag im Hörsaal**, in dem man heimlich Tic Tac Toe spielt.

Dieses Dokument ist dein vollständiger Arbeitsplan. Du arbeitest ihn **komplett** ab. Jede Phase hat Abnahmekriterien. Du bist erst fertig, wenn **alle** erfüllt sind und du sie mit Screenshots und Messwerten belegt hast.

---

## 0. Arbeitsregeln (lies das zuerst, gilt für alles)

1. **Keine Faulheit.** Keine Platzhalter, keine `// TODO`, keine „kann später ergänzt werden“, keine „vereinfachte Version“. Wenn ein Punkt im Plan steht, wird er umgesetzt. Wenn etwas technisch wirklich unmöglich ist, dokumentierst du **warum** und lieferst die **beste mögliche Alternative** – nicht nichts.
2. **Ausgangsbasis:** `src/index.html` (Spiel-Logik, Szene, UI), `vendor/three.min.js` (three.js r128), `build.py` (bettet three.js ein → `dist/BOKU_TicTacTierernaehrung.html`). Lies den gesamten Code, bevor du ihn umbaust. Was funktioniert (Spielschleife, Verdachts-System, Prof-Zustandsautomat, Quiz, Tic-Tac-Toe-Minimax, BOKU-Startseite/Endseite im Website-Stil), behältst du als Grundidee bei und baust es aus – du schreibst es nicht blind neu.
3. **Ergebnis muss weiterhin herunterladbar und offline lauffähig sein.** Entscheide selbst zwischen:
   - **(a) eine einzige HTML-Datei** (alle Assets als Base64/Data-URLs eingebettet, alle Texturen prozedural erzeugt). Zielgröße ≤ 25 MB.
   - **(b) ein ZIP** mit `index.html` + `assets/`-Ordner, das nach dem Entpacken per Doppelklick läuft (`file://`-tauglich, also **keine** `fetch()`-Aufrufe auf lokale Dateien, keine ES-Module über `file://`, keine Service-Worker).
   Bevorzugt ist (a). Wählst du (b), begründest du es (z. B. Dateigröße durch Audio) und lieferst zusätzlich ein Build-Skript, das das ZIP reproduzierbar erzeugt.
4. **Technik frei wählbar**, aber begründet: three.js aktuelle Version (r16x+) mit Postprocessing ist erlaubt und empfohlen; Babylon.js ebenso. Build-Tooling (esbuild/Vite/Rollup) darf verwendet werden, **solange das Endprodukt ohne Server läuft**. Die Quellen liegen im Repo, der Build ist mit einem Befehl reproduzierbar (`npm run build` oder `python3 build.py`), dokumentiert in der README.
5. **Rechtliches / Respekt:** Keine echten Logodateien, Fotos oder Markenzeichen von boku.ac.at kopieren – **Stil nachbauen** (Farben, Typografie, Layout, Bildsprache), nicht Assets klauen. Keine realen Personen (kein echter Professor, keine echten Namen von Mitarbeiter:innen). Der Prof bleibt fiktiv. Im Spiel steht sichtbar „Fan-Projekt, kein offizielles Angebot der BOKU“.
6. **Sprache:** Spiel auf Deutsch (österreichisches Deutsch im Dialog: „Grüß Gott“, „Servus“, „eh“, „Jänner“, „Semester“, „Prüfung“, „Skriptum“, „Hörsaal“, „Vorlesung“ = „VO“, „Übung“ = „UE“). Zusätzlich ein vollständiger **englischer Sprachmodus** (DE/EN-Umschalter wie auf boku.ac.at). Alle Texte in einer Übersetzungstabelle, kein hartkodierter UI-Text.
7. **Fachliche Korrektheit hat Vorrang vor Witz.** Alles, was der Prof sagt oder an die Tafel schreibt, muss stimmen (Lehrbuchniveau Bachelor, deutschsprachiger Raum: Kirchgeßner „Tierernährung“, Jeroch/Drochner/Simon, GfE-Empfehlungen, DLG-Futterwerttabellen). Du recherchierst, du rätst nicht.
8. **Du testest selbst.** Playwright/Chromium headless ist verfügbar (`require('playwright')`, `chromium.launch()` ohne Optionen; bei WebGL-Problemen `--use-gl=swiftshader --enable-unsafe-swiftshader`). Nach **jeder** Phase: Screenshots aus mindestens 4 Perspektiven, Konsolenfehler = 0, und ein automatisierter Durchlauf des Spielablaufs (Start → spielen → erwischt → Quiz → Ende). Screenshots speicherst du in `docs/screenshots/phaseN_*.png` und schaust sie dir **tatsächlich an** (Bild lesen), um Fehler zu finden. Du lieferst keine Phase ab, deren Screenshots du nicht gesehen hast.
9. **Iteration auf Optik:** Für Phase 2–4 machst du mindestens **drei** Optik-Iterationen: Screenshot → kritisch bewerten (Was sieht nach Baukasten aus? Was ist zu sauber, zu grell, zu leer?) → verbessern → Screenshot. Dokumentiere jede Iteration kurz in `docs/ITERATIONEN.md`.
10. **Commits:** Pro Phase mindestens ein Commit mit aussagekräftiger Nachricht. Am Ende Push auf den dir zugewiesenen Branch.

---

## 1. Recherche-Phase (vor dem ersten Code)

Lege `docs/RECHERCHE.md` an und fülle es mit belegten Ergebnissen (Quelle + was du daraus für das Spiel ableitest):

### 1.1 BOKU – Ort und Identität
- Standorte: Türkenschanze (Gregor-Mendel-Straße 33, 1180 Wien, Gregor-Mendel-Haus = historisches Hauptgebäude), Peter-Jordan-Straße, Muthgasse, Tulln (IFA). Welche Gebäude gibt es an der Türkenschanze (Schwackhöfer-Haus, Exner-Haus, Guttenberg-Haus, Simony-Haus, Oskar-Simony-Haus, Adolf-von-Guttenberg-Haus, Mendel-Haus, TÜWI-Gebäude …)? Wie sehen deren Hörsäle aus (Materialien, Bestuhlung, Farbe, Tafelsystem, Fenster)? Suche nach Fotos/Beschreibungen und **beschreibe** sie in Worten – daraus baust du den Hörsaal.
- Was sieht man aus dem Fenster an der Türkenschanze? (Türkenschanzpark, Bäume, Villen in Währing, Fassade des Gregor-Mendel-Hauses, ggf. Straßenbahn/Bus-Linien in der Nähe → korrekt benennen oder generisch lassen).
- Campus-Leben: TÜWI (studentisches Kulturzentrum/Lokal), Mensa, ÖH BOKU, BOKUonline, BOKUlearn (Moodle), BOKU-Ball, Erntedankfest, der Slogan „Universität des Lebens“, BOKU-Shop-Artikel, Fahrräder am Campus.
- Design-System von boku.ac.at: Primärgrün `#00aa5a`, Textgrau `#474747`, Hellgrau `#efefef`, Schrift Arial/Helvetica, Linien `#dadada`, Bildsprache (Natur, Labor, Feld, Menschen), Rasterlayout, Breadcrumbs, Kacheln, grüne Unterstreichung bei aktiven Navigationspunkten. Lies das CSS von boku.ac.at erneut und notiere Abstände, Schriftgrößen, Button-Stile, Fokus-Stile, Hover-Verhalten. Daraus wird ein **Design-Token-Set** (`src/ui/tokens.css`), das jede UI-Fläche im Spiel verwendet.

### 1.2 Studium Agrarwissenschaften an der BOKU
- Aufbau des Bachelors (Semester, ECTS, Pflichtfächer, wo „Tierernährung“ im Curriculum liegt, welches Institut/Department zuständig ist – **Institutsnamen korrekt übernehmen**, Personen **nicht**).
- Typische Nachbar-Lehrveranstaltungen (Tierhaltung, Pflanzenbau, Bodenkunde, Agrarökonomie, Grünlandwirtschaft) → für Plakate, Nebengespräche, Stundenplan-Anzeige auf dem Laptop.
- Lehr- und Forschungsbetriebe (z. B. Groß-Enzersdorf) → für Exkursionsplakate.

### 1.3 Tierernährung – Fachinhalt (Bachelor-Niveau, deutschsprachig)
Erstelle eine **Stoffsammlung mit mindestens 14 Vorlesungsabschnitten**, jeder mit: Lernziele, 4–6 Folienpunkte, 1 Diagramm-Beschreibung, 2–3 Tafelanschriebe (Formeln/Skizzen), 5–8 Sätze Vortragstext in natürlicher gesprochener Sprache (keine Folien vorlesen!), 3 Quizfragen (davon 1 Rechenaufgabe). Themen mindestens:
1. Einführung, Bedeutung der Tierernährung, Futter → Tier → Lebensmittel, Nährstoffkreislauf
2. Weender Analyse (TM, XA, XP, XL, XF, NfE; Kjeldahl, Faktor 6,25) **und** erweiterte Analyse nach Van Soest (NDF, ADF, ADL)
3. Verdauungsphysiologie Monogastrier (Schwein, Geflügel: Kropf, Muskelmagen)
4. Verdauungsphysiologie Wiederkäuer (Vormägen, Pansenmikrobiom, flüchtige Fettsäuren, Pansen-pH, Azidose, Strukturwirksamkeit/peNDF, Wiederkauen)
5. Energiebewertung (GE → DE → ME → NE; NEL für Milchkühe, ME für Schweine, AMEn für Geflügel; MJ-Rechnungen mit realistischen Zahlen)
6. Proteinbewertung Wiederkäuer (nXP, RNB, UDP/RDP, Mikrobenprotein, Harnstoff in der Milch als Indikator)
7. Proteinbewertung Monogastrier (Aminosäuren, ideales Protein, Lysin beim Schwein, Methionin beim Geflügel, Phasenfütterung, N-reduzierte Fütterung)
8. Futtermittelkunde: Grundfutter (Heu, Grassilage, Maissilage, Weide), Kraftfutter (Getreide, Soja-/Rapsextraktionsschrot), Nebenprodukte (Biertreber, Trockenschnitzel), Mineralfutter
9. Konservierung: Silierung (Milchsäuregärung, Anwelken, Siliermittel), Heuwerbung, Gärqualität (DLG-Schlüssel)
10. Rationsberechnung Milchkuh (TM-Aufnahme, NEL-Bedarf nach Milchleistung, Beispielration mit Zahlen – der Prof rechnet an der Tafel!)
11. Fütterung in der Laktation: Transitphase, Ketose, Milchfieber (Hypokalzämie, DCAB), Pansenazidose, Weidetetanie
12. Mineralstoffe & Spurenelemente & Vitamine (Ca:P, Mg, Se/Vit. E – Österreichs selenarme Böden, Cu bei Schafen, Jod)
13. Fütterung und Umwelt (Methan, N- und P-Ausscheidung, Fütterungsstrategien zur Emissionsminderung, Futtereffizienz)
14. Futtermittelrecht & Qualitätssicherung (Futtermittelgesetz, Kennzeichnung, unerwünschte Stoffe, Mykotoxine)
15. optional: Pferd, Schaf/Ziege, Fisch, Heimtiere (als Ausblick)

Alle Zahlen plausibel und belegt (z. B. NEL-Bedarf Erhaltung ≈ 0,293 MJ × LM^0,75; ≈ 3,2 MJ NEL/kg Milch bei 4 % Fett; Pansen-pH optimal ~6,2–6,8; Maissilage ~6,5–6,9 MJ NEL/kg TM; Grassilage 5,8–6,4 …). Lege die Werte in `src/content/lecture.de.json` und `.en.json` ab.

### 1.4 Vorlesungs-Atmosphäre (echtes Verhalten, keine Klischees)
Notiere beobachtbare, realistische Details eines 90-Minuten-Vortrags: verspäteter Beginn (akademisches Viertel), Beamer-Warmlaufen, Mikro-Test, Anwesenheitsliste geht durch die Reihen, Spätkommer, Handy vibriert, jemand stellt eine Frage, Prof wiederholt die Frage fürs Mikro, Prof schaut auf die Uhr, Prof wechselt zwischen Pult/Folie/Tafel, kündigt Pause an („fünf Minuten“), Studierende tippen/zeichnen/schlafen/scrollen, Stuhlknarzen, Husten, Rascheln, Türen, Kaffeebecher, Wasserflaschen, Tram-/Vogelgeräusche draußen. Daraus wird ein **Ereignis-Skript** (siehe Phase 5).

**Abnahme Phase 1:** `docs/RECHERCHE.md` ≥ 2 000 Wörter, Stoffsammlung vollständig (≥ 14 Abschnitte, ≥ 40 Quizfragen, ≥ 8 Rechenbeispiele), Design-Tokens dokumentiert.

---

## 2. Technische Basis & Rendering

### 2.1 Architektur
- Modulare Quellstruktur: `src/main.js`, `src/scene/*` (Raum, Möbel, Charaktere, Licht), `src/game/*` (Zustände, Prof-KI, Verdacht, Quiz, TicTacToe), `src/ui/*` (Menüs, HUD, Design-Tokens), `src/audio/*`, `src/content/*` (Vorlesungsinhalte, Dialoge, Übersetzungen), `src/gfx/*` (Texturgeneratoren, Shader, Postprocessing).
- Build bündelt alles in **eine** HTML-Datei (oder ZIP, siehe Regel 3). Quality-Presets „Niedrig / Mittel / Hoch / Ultra“ mit automatischer Erkennung (GPU-Tier via Render-Zeit der ersten 60 Frames) und manueller Wahl in den Einstellungen.
- Ziel: **60 fps auf integrierter Grafik (z. B. Intel Iris Xe) bei „Mittel“**, 60 fps auf dedizierter GPU bei „Ultra“. Draw-Calls ≤ 250 (Instancing für Sitze, Tische, Studierende). Du misst und dokumentierst fps/draw calls/triangles in `docs/PERFORMANCE.md`.
- Pointer-Lock-Option für Mausblick (Standard: an, Fallback: Maus-Hover wie jetzt). Gamepad-Unterstützung (Stick zum Umschauen, A/Kreuz = Laptop, D-Pad = Feld).

### 2.2 Beleuchtung & Postprocessing (das ist der größte Grafik-Hebel)
- **Physikalisch basiertes Licht:** Tageslicht durch Fenster (DirectionalLight + sichtbare Lichtkegel/„God Rays“ bei Staub), Deckenleuchten als echte emissive Flächen mit RectAreaLight (oder Fake-Area-Lights), Beamer als SpotLight mit Projektions-Textur (die Folie wird tatsächlich projiziert, Leinwand leuchtet leicht nach außen in den Raum).
- **Indirektes Licht:** Umgebungsmap per PMREM aus einer prozedural gerenderten Raumkugel (RoomEnvironment) oder gebackene Lightprobes; weiche Verschattung im Fenster-Gegenlicht. Ambient Occlusion (GTAO/SSAO oder N8AO) in allen Presets ab „Mittel“.
- **Schatten:** Cascaded Shadow Maps oder mindestens 2 Schattenkaskaden; PCF-Soft; Kontaktschatten unter Tischen und Sitzen (gebackene AO-Streifen als Decal).
- **Post-Stack:** Tone-Mapping (ACES/AgX), subtile Vignette, Farbkorrektur („leicht entsättigt, warm, etwas Grünstich vom Holz“ – Beispiel, du bestimmst den Look), SMAA/TAA, Bloom nur auf Leinwand/Laptop/Deckenlicht, **Tiefenschärfe beim Laptop-Blick** (Hintergrund weich, Bildschirm scharf), leichte chromatische Aberration und Linsenstaub nur bei Herzklopfen/hohem Verdacht.
- **Kamera:** 55–65° FOV, realistische Augenhöhe im Sitzen, Atembewegung, Kopfnicken beim Mitschreiben, Blickwechsel mit Easing + kurzem Fokus-Pull, Mikro-Sakkaden beim Umschauen. Beim Laptop-Blick senkt sich der Kopf, Rand des Laptopdeckels im Bild, Prof bleibt über dem Deckelrand sichtbar (Mechanik!).

### 2.3 Materialien & Texturen (alle prozedural oder eingebettet, ≤ 2048², Normal- und Roughness-Maps!)
- Holz (Tischplatten, Lamellenwand) mit Maserung, Kantenabnutzung, matter Lack, Kratzern, Kaffee-Rändern an einzelnen Plätzen.
- Linoleum/Teppich der Stufen mit Abnutzungsspuren in der Mitte der Gänge.
- Sitzpolster Stoff (Noise + Faser-Normalmap), Metallgestelle mit Roughness-Variation, Kunststoffteile.
- Tafel mit Kreidestaub, Wischspuren, alten halb gelöschten Formeln; Kreide-Schrift als handschriftliche Pfade (Stroke-Animation beim Schreiben, nicht Buchstaben-Pop-In).
- Leinwand mit Gewebe-Struktur und leichtem Hotspot des Beamers; Folien sauber, 1920×1080, BOKU-Corporate-Design (Logo-Nachbau, Fußzeile, Foliennummer, Institut).
- Fensterglas mit Reflexion (Environment), Schlieren; Außenwelt als **mehrschichtiges Parallax-Panorama** (Himmel, Wolken-Drift, Baumreihen Türkenschanzpark, gelbe Fassade im Stil des Gregor-Mendel-Hauses, Dächer von Währing) **oder** echte Low-Poly-Außengeometrie mit Bäumen (Wind-Shader auf Blättern).
- Staubpartikel in Lichtstrahlen, langsame Drift, nur in Fensternähe.

**Abnahme Phase 2:** Screenshot-Vergleich alt/neu aus identischer Kameraposition in `docs/screenshots/`; Performance-Tabelle; keine Z-Fighting-Artefakte; keine Schatten-Acne; Postprocessing in allen Presets getestet.

---

## 3. Der Hörsaal (Level-Art)

Baue einen Hörsaal, der nach **BOKU Türkenschanze** aussieht (nicht nach generischem US-Auditorium), auf Basis deiner Recherche. Mindestanforderungen:

- 8–10 ansteigende Reihen, ergonomisch korrekte Maße (Tischtiefe ~45 cm, Reihenabstand ~90 cm, Stufenhöhe ~17 cm), **durchgehende Tischreihen mit Klappsitzen**, Nummern an den Plätzen, Steckdosenleisten/USB-Ports an der Tischunterkante mit Kabeln zu einzelnen Laptops.
- Seitengänge mit Handlauf, Stufenbeleuchtung (LED-Streifen), Notausgangsschilder nach ÖNORM (grün/weiß Piktogramm nachgebaut), Feuerlöscher, Rauchmelder, Lautsprecher, Deckenlüftungsgitter, Kabelkanäle, Lichtschalter-Panel am Eingang, Mülltrennung (Restmüll/Papier/Plastik – typisch Wien).
- Vorne: Pult mit Mediensteuerung (Touchpanel, Mikrofon, Dozentenmonitor, Dokumentenkamera), Tafelsystem (Schiebetafeln, mind. 2 Flügel, hoch-/runterschiebbar, der Prof nutzt beide), Leinwand elektrisch, Beamer an der Decke mit sichtbarem Lüfter-Lichtschein, Whiteboard-Marker-Ablage, Kreideschale, Schwamm, Laserpointer.
- Wände: Holzlamellen-Akustikverkleidung (BOKU-typisch warm) **oder** Sichtbeton/Putz je Recherche; BOKU-Plakate (Exkursion Groß-Enzersdorf, ÖH-Wahl, BOKU-Ball, Erntedankfest, Mensa-Wochenplan, Stellenanzeige Diplomarbeit „Methanminderung bei Milchkühen“), Schwarzes Brett mit Zetteln, Uhr (läuft synchron mit Spielzeit), Thermostat, Hörsaalschild mit Nummer und Belegungsplan.
- Fenster: Großflächig, mit Jalousien (halb geschlossen auf Beamer-Seite), Fensterbänke mit Pflanze/vergessenem Kaffeebecher.
- Hinten: Eingangstüren mit Türschließer, Glasausschnitt, Gang dahinter (Licht, Personen, die vorbeigehen = Silhouetten), Garderobenhaken, Rucksäcke am Boden, Jacken über Sitzlehnen, Fahrradhelm.
- **Tisch des Spielers:** Laptop (realistisches Modell mit Tastatur, Touchpad, Scharnier, Kamera-LED, BOKU-/ÖH-/Umwelt-Sticker auf dem Deckel), Block mit halb geschriebener Mitschrift (lesbar: Stichwörter zur aktuellen Folie, wächst beim „Mitschreiben“), Kugelschreiber, Textmarker, Wasserflasche, Mensa-Kaffeebecher (Pappe), Handy (Displaysperre, vibriert gelegentlich), Skriptum-Ausdruck mit Eselsohren, Apfel.
- Sitznachbar:innen: links jemand, der mitschreibt und gelegentlich zu dir rüberschaut (siehe Mechanik „Nachbar“), rechts frei mit Rucksack.
- Leichte Unordnung und Alter: Kratzer, ein wackelnder Sitz, ein defektes Deckenlicht (flackert dezent), ein Kaugummi unter dem Tisch – Realismus durch Imperfektion, aber dezent.

**Abnahme Phase 3:** Orbit-Screenshots aus 6 Winkeln + 3 Spieler-Perspektiven; Liste aller Props (≥ 60 unterschiedliche Objekte); Checkliste „sieht aus wie Baukasten?“ für jedes Prop beantwortet.

---

## 4. Charaktere & Animation

### 4.1 Prof. Haferkorn (fiktiv)
- Vollständiger Körper mit Skelett (eigenes Rig im Code reicht: Hüfte, Wirbelsäule, Hals, Kopf, Schultern, Ober-/Unterarme, Hände mit Fingern vereinfacht, Ober-/Unterschenkel, Füße). Kleidung: Hemd, Pullunder oder Sakko, Jeans/Cordhose, Brille, kurze graue Haare, Bart optional – „BOKU-Prof“, nicht „Oxford-Don“.
- Animationen (prozedural/IK, mit Blending): Idle mit Gewichtsverlagerung, Gehen (Fußkontakt ohne Rutschen, Schritte auf verschiedenen Böden), Drehen auf der Stelle, Schreiben an der Tafel (Handgelenk folgt der Schrift, Körper verschiebt sich mit der Zeile), Tafel wischen, Tafel hochschieben, Zeigen mit Laserpointer (roter Punkt auf Leinwand sichtbar, zittert leicht), Clicker drücken, Blättern im Skript am Pult, Brille richten, Blick zur Uhr, Trinken aus Wasserglas, Hände in Hosentaschen, Gestikulieren in 4–5 Varianten, „Frage in die Runde“-Pose, „Erwischt“-Blick (Kopf schräg, Augenbraue), kurzer Blick aus dem Fenster.
- **Gesicht:** Augenlider blinzeln, Augen fixieren Blickziel (Saccaden), Mund bewegt sich beim Sprechen (Amplituden-Animation synchron zur Sprachdauer; bei TTS: Sprechanfang/-ende aus Events), Augenbrauen bei Fragen.
- **Blickverhalten (Kern der Mechanik):** sichtbares, nachvollziehbares Verhalten: Er scannt den Saal in Mustern (links → Mitte → rechts), bleibt bei Bewegung länger hängen, schaut nach jeder Frage in die Runde, schaut bei Tafelarbeit alle 10–25 s kurz über die Schulter (Vorwarnung: Oberkörper dreht leicht, Kreide stoppt), blufft gelegentlich. Alle Parameter in einer Tuning-Datei.

### 4.2 Studierende (≥ 40 im Saal, ≥ 12 Varianten)
- Modulares Charaktersystem: Körpertypen (3), Frisuren (8), Kleidung (10 Oberteile, 5 Hosen, Jacken, Mützen, Kopfhörer), Hauttöne (6), Brillen, Rucksäcke. Zufällige, aber deterministische Zusammensetzung (Seed).
- Verhaltensprofile: Mitschreiber:in (Hand/Stift-Animation), Tipper:in (Finger auf Tastatur, Bildschirm zeigt Notizen/Skript/Social-Feed/Netflix-ähnlich – **nicht** markenrechtlich geschützt), Zuhörer:in (nickt), Handy-Scroller:in (Display leuchtet unter Tisch), Schläfer:in (Kopf auf Arm, Atmung), Kaffeetrinker:in, Flüsterpaar (lehnen sich zueinander), Spätkommer:in (kommt nach 7 Minuten durch die Hintertür, sucht Platz, entschuldigt sich leise), Fragesteller:in (hebt Hand, Prof reagiert), Nachbar:in (siehe Mechanik).
- Alle Köpfe reagieren auf Ereignisse: Tür, Erwischt-Szene (alle schauen zu dir), Pointe des Profs (einige lächeln), Handyklingeln (Köpfe drehen zur Quelle).

### 4.3 Weitere Figuren
- Tutor:in/Studienassistent:in, die/der die Anwesenheitsliste verteilt und zwischendurch an der Seite steht (zweite Blickquelle, schwächer).
- Silhouetten auf dem Gang hinter den Glastüren.

**Abnahme Phase 4:** Video-ähnliche Screenshot-Sequenz (10 Frames) von Gehen, Schreiben, Umdrehen; kein Fußrutschen; kein Clipping von Armen durch Körper; Kopfdrehungen innerhalb anatomischer Grenzen.

---

## 5. Die Vorlesung als lebendiges System (Immersion)

Ersetze die lineare Satzliste durch einen **Vorlesungs-Director**:

- **Zeitleiste 90 Spielminuten ≈ 10–12 Echtminuten** (konfigurierbar; „Kurze Vorlesung“ 6 min, „Echtzeit“ optional 90 min für Hardcore).
- **Phasen:** Ankommen (Beamer fährt hoch, Prof richtet Mikro, Smalltalk „Wer war am Wochenende beim Erntedankfest?“), Einstieg mit Wiederholung der letzten Einheit, Hauptteil mit 14+ Abschnitten (Director wählt Reihenfolge nach Lehrplan, lässt Abschnitte je nach Zeit weg), 5-Minuten-Pause nach ~45 min (Studierende stehen auf, gehen raus, Kaffee – **du kannst in der Pause frei spielen, aber der Prof bleibt am Pult und schaut gelegentlich hoch**), Schluss mit Ausblick, Prüfungshinweis, Anwesenheitsliste einsammeln.
- **Ereignisse** (zufällig aus Pool, mit Wahrscheinlichkeiten und Abklingzeiten): Frage aus dem Publikum (Prof wiederholt sie, antwortet fachlich korrekt), Spätkommer:in, Handy klingelt (Prof: „Das ist nicht meins, oder?“), Beamer verliert Signal (Prof fummelt am Kabel – **perfekte Spielgelegenheit**), Prof schreibt lange Rechnung an die Tafel (Rationsberechnung Schritt für Schritt, 60–90 s Rücken zum Saal, aber mit Schulterblicken), Prof geht die Treppe hoch in den Mittelgang und redet von dort (**Gefahr von der Seite**), Anwesenheitsliste erreicht dich (du musst sie unterschreiben – Minispiel: kurze Mausgeste – und weiterreichen, während der Laptop offen ist), Prof stellt eine Frage **direkt an dich** (Quiz; Antwort kennst du nur, wenn du mitgehört hast – Untertitel sind am Laptop „verwaschen“), Nachbar:in warnt dich („Psst, er schaut“), Nachbar:in verrät dich (nur auf höchster Stufe, sichtbar an Verhalten), Prof macht einen trockenen Witz („Die Kuh ist eine Gärkammer auf vier Beinen – das klingt nach TÜWI am Freitag“), Prof trinkt, Prof schaut auf die Uhr und beschleunigt.
- **Dialog-Engine:** Vortragstext als Sätze mit Markierungen für Betonung, Pausen, Blickziel, Geste, Tafel/Folie-Aktion. Prof spricht **natürlich** (Umformulierungen, „äh“, Rückbezüge: „wie wir vorhin bei der Weender Analyse gesehen haben“), nie Folien vorlesen. Jeder Abschnitt hat ≥ 3 alternative Formulierungen, damit zwei Durchläufe nicht gleich klingen.
- **Sprachausgabe:** Web Speech API mit Stimmwahl (de-AT bevorzugt, de-DE Fallback, en-GB/en-US im englischen Modus), Tonhöhe/Tempo einstellbar; zusätzlich **immer** Untertitel in BOKU-Typografie. Wenn keine TTS verfügbar: Untertitel + leises „Murmel-Audio“ (gefilterte Sprach-ähnliche Synthese), damit die Stimme nie „stumm“ ist. Räumlich: Stimme kommt vom Prof (PannerNode), am Laptop gedämpfter (Lowpass), bei Pause/Menü aus.
- **Tafel & Folien** werden tatsächlich bespielt: Folien wechseln per Clicker (Klick-Geräusch, kurzer Beamer-Blend), Tafelanschrieb wächst Zeichen für Zeichen als Kreide-Pfad, Formeln werden hergeleitet (z. B. NEL-Bedarf einer 650-kg-Kuh mit 30 kg Milch), Tafel wird gewischt, wenn voll, Prof schiebt Tafel hoch.
- **Mitschrift-Mechanik:** Im Zuhören-Modus kannst du mit `N` „mitschreiben“ (Block füllt sich, Fleiß-Anzeige steigt, senkt Grundverdacht und liefert im Quiz eine Hilfe „Blick in die Mitschrift“ mit Zeitstrafe).

**Abnahme Phase 5:** Ablauf-Log eines kompletten Durchlaufs (`docs/RUN_LOG.txt`) mit Zeitstempeln aller Ereignisse; mind. 25 verschiedene Ereignistypen; Vortragstext ≥ 400 Sätze gesamt (DE), vollständig ins Englische übersetzt.

---

## 6. Gameplay-Tiefe (Schleichen, Risiko, Entscheidungen)

- **Sichtmodell statt Winkel-Hack:** Echter Sichtkegel des Profs (fovealer Kegel ~10°, peripher ~60°, Sensitivität nimmt nach außen ab), **Line-of-Sight mit Verdeckung** (Studierende vor dir, Laptopdeckel, Pult, Säulen blocken teilweise) per Raycasts auf mehrere Punkte deines Oberkörpers/Laptops. Entfernung zählt (Reihe 4 ist riskanter als Reihe 8 – Sitzplatzwahl im Menü mit Vor-/Nachteilen: hinten sicherer, aber Untertitel undeutlicher und Quiz schwerer; vorne gefährlich, aber mehr Punkte).
- **Verdacht** wird mehrstufig: Aufmerksamkeit (kurz, sinkt schnell) → Verdacht (mittel, sinkt langsam) → Beweis (steigt nur bei direktem Blickkontakt auf den Spielbildschirm, löst „Erwischt“ aus). Visuelles Feedback: statt Balken ein dezentes Herz-/Atem-System (Rand pulsiert, Audio-Herzschlag, Hände zittern leicht) plus optionaler Balken in den Einstellungen.
- **Laptop-Aktionen:** Deckel-Winkel stufenlos (`Mausrad`): flacher Deckel = weniger sichtbar, aber Bildschirm schwerer lesbar; **Alt-Tab-Reflex** (`Tab`): sofort auf Skriptum/Mitschrift wechseln (0,3 s Verzögerung, der Prof kann das Umschalten „sehen“, wenn er gerade hinschaut); Bildschirmhelligkeit runter (`-`): weniger Leuchten im Gesicht (sichtbar als Lichtreflex auf deiner Brille/Gesicht aus Prof-Sicht – implementiere die Prof-Sicht als Debug-Ansicht `F3`); Kopfhörer rein (Nachbar:in hört nichts, aber du hörst Prof-Hinweise schlechter).
- **Tic Tac Toe** bleibt das Herz, aber: Gegner ist ein:e **andere:r Studierende:r im Saal** (Reihe 2 oder 6, sichtbar!), der/die ebenfalls nur ziehen kann, wenn der Prof *ihn/sie* nicht ansieht → Chat-Fenster mit Nachrichten („warte, er schaut zu mir“), Tempo-Spannung auf beiden Seiten. Zusätzlich „Online-Gegner“ (KI mit 3 Stärken, Minimax mit Fehlerquote) als Alternative. Serie-Modus (Best-of mit Punktetabelle), Blitz-Modus (Zugtimer), Turniermodus über die ganze Vorlesung.
- **Weitere Mini-Apps auf dem Laptop** (optional, aber mindestens eine zusätzlich): Snake, Solitär oder „BOKU-Quiz-Duell“. Alles im gleichen Fenster-/Desktop-Design (ein glaubwürdiger Studierenden-Desktop: BOKUlearn-Tab, Mail, PDF-Reader mit echtem Skriptum-Text, Taskleiste, Uhr, Akku, WLAN „eduroam“).
- **Konsequenzen:** 1. Verwarnung: Ermahnung; 2.: Prof bleibt 2 Minuten auffällig aufmerksam (Blickmuster ändert sich sichtbar); 3.: Hörsaalverweis **oder** (bei hohem Fleiß/Quiz-Erfolg) nur Platzwechsel nach vorne (härterer Modus statt Game Over). Quiz richtig: Verdacht sinkt, Prof „mag“ dich (Toleranz steigt). Quiz falsch: Prof hat dich im Fokus.
- **Bewertung am Ende:** Note 1–5 nach österreichischem System, aufgeschlüsselt (Siege, Fleiß, Quiz, Verwarnungen, Risiko), „Zeugnis“ im BOKUonline-Stil, Rangliste lokal, Erfolge (z. B. „Pansen-Profi: alle Quizfragen richtig“, „Unsichtbar: null Verdacht über 60 Spielminuten“, „Ehrlich: ganze Vorlesung ohne Laptop – Note 1“).
- **Tutorial** in den ersten 90 Sekunden (Prof richtet noch Technik ein): kontextuelle Hinweise, abschaltbar.
- **Schwierigkeit:** 4 Stufen + Custom (Prof-Wachsamkeit, Nachbar-Verhalten, Gegnerstärke, Vorlesungslänge, Sitzplatz).

**Abnahme Phase 6:** Automatisierter Bot-Test spielt 20 Durchläufe pro Schwierigkeit (Skript steuert Umschalten/Zug per API) und protokolliert Siegquote, Erwischt-Quote, Dauer → Balancing-Tabelle in `docs/BALANCING.md`; Zielband: „Bachelor“ ~50 % Erfolgsquote eines mittelguten Bots.

---

## 7. UI/UX im BOKU-Stil

- **Design-System** aus Phase 1 (`tokens.css`) überall: Startseite als BOKU-Website-Nachbau (Header, Navigation mit Unterstreichung, Breadcrumb, Hero-Bild = Live-Kamerafahrt durch den Hörsaal, Kachel-Layout, Footer mit Adresse Türkenschanze), Lehrveranstaltungs-Seite im BOKUonline-Stil (LV-Nummer, ECTS, Semesterwochenstunden, Vortragende:r „N.N.“, Hörsaal, Termin), Einstellungen als Formular im BOKU-Stil, Pausenmenü als „Mensa-Pause“-Karte, Zeugnis als BOKUonline-Prüfungsergebnis, Erfolge als „Badges“.
- **Responsiv** (Desktop zuerst; auf Tablet spielbar mit Touch: Tippen = Laptop/Zuhören, Wischen = Umschauen, Felder antippen).
- **Barrierefreiheit:** Tastatur-komplett, Fokusringe in BOKU-Grün, Untertitelgröße, Farbfehlsicht-Modus (X/O zusätzlich mit Formen), Fotosensitivitäts-Schalter (kein Flackern), Bewegungsreduktion (Kopfwackeln aus).
- **HUD** minimalistisch, dezent, auf Wunsch ausblendbar; alles Wichtige diegetisch (Uhr an der Wand, Verdacht als Körpergefühl, Folien auf der Leinwand, Mitschrift auf dem Block).
- **Ladezeit:** Ladebildschirm im BOKU-Stil mit Fortschritt (Texturen werden erzeugt), < 5 s auf Mittelklasse-Laptop.

**Abnahme Phase 7:** Screenshots aller Screens in DE und EN bei 1920×1080, 1366×768 und 1024×768 (Tablet); Lighthouse-Accessibility-Check des Startbildschirms ≥ 90.

---

## 8. Audio

- **Ambiente** (prozedural oder eingebettet, nahtlos geloopt): Lüftung, Beamerlüfter (positioniert), Tippen aus verschiedenen Richtungen, Stuhlknarzen, Husten (zufällig, positioniert), Seitenrascheln, Kugelschreiber-Klicken, Tür mit Schließer, Schritte im Gang, draußen Vögel/Wind/entfernte Straßenbahn, Regen-Variante (Wetter zufällig: sonnig/bewölkt/Regen mit passender Lichtstimmung und Fenstertropfen).
- **Prof:** Schritte auf Parkett/Teppich/Stufen, Kreide (Druck- und Geschwindigkeitsabhängig), Tafel wischen, Clicker, Mikro-Rückkopplung beim Start, Wasserglas, Räuspern; Stimme räumlich mit Nachhall (ConvolverNode, Impulsantwort generiert für Hörsaal-Größe).
- **Spieler:** Laptop-Tastatur, Touchpad, Deckel-Scharnier, eigener Herzschlag/Atem bei Verdacht, Stift auf Papier beim Mitschreiben, Jacke/Stoff beim Umdrehen.
- **Musik:** keine im Spiel (Realismus), aber ein dezentes Menü-Thema (synthetisiert, ruhig, „Campus am Morgen“).
- Mixer mit Kanälen (Master, Stimme, Effekte, Ambiente), Einstellungen persistiert.

**Abnahme Phase 8:** Audio-Kanalliste in `docs/AUDIO.md`, Test, dass kein Klick/Knacken bei Loops entsteht (Nulldurchgänge/Crossfade), Lautstärken normalisiert.

---

## 9. Qualitätssicherung, Doku, Auslieferung

- `README.md`: Spielbeschreibung, Steuerung, Systemanforderungen, Build-Anleitung, Architekturübersicht, Lizenzhinweise (three.js MIT etc.), Haftungsausschluss „Fan-Projekt“.
- `docs/`: RECHERCHE.md, ITERATIONEN.md, PERFORMANCE.md, BALANCING.md, AUDIO.md, CHANGELOG.md, screenshots/.
- Automatisierte Tests (`npm test` oder `python3 test.py`): Headless-Durchlauf ohne Konsolenfehler, Tic-Tac-Toe-Minimax-Unit-Tests, Sichtmodell-Tests (bekannte Positionen → erwartete Sichtbarkeit), Übersetzungsvollständigkeit (jeder Schlüssel in DE und EN), Build-Größe unter Limit.
- Browser-Matrix: Chrome, Edge, Firefox, Safari (WebGL2-Fallbacks prüfen: keine `OES_texture_float`-Abhängigkeit ohne Fallback, keine WebGPU-Pflicht).
- Endprodukt: `dist/BOKU_TicTacTierernaehrung_v2.html` (oder `dist/BOKU_TicTacTierernaehrung_v2.zip`) + `dist/SHA256.txt`.

**Abnahme Phase 9:** Alle Tests grün, Build reproduzierbar, README vollständig, Abschlussbericht `docs/ABSCHLUSS.md` mit: Was wurde umgesetzt (jede Nummer dieses Plans abgehakt), Messwerte, bekannte Grenzen, Screenshots vorher/nachher.

---

## 10. Qualitätsmaßstab (daran wirst du gemessen)

Stell dir vor, ein:e BOKU-Studierende:r öffnet die Datei und sagt nach 10 Sekunden: **„Das ist ja unser Hörsaal.“** Und ein:e Tierernährungs-Lehrende:r hört 2 Minuten zu und sagt: **„Fachlich stimmt das.“** Und ein:e Spieler:in merkt nach 5 Minuten, dass Herzklopfen, Timing und Risiko echt Spaß machen.

Konkret:
- Kein Objekt im Raum darf nach „bunter Quader“ aussehen. Alles hat Kanten-Rundung, Materialvariation, Normalmap, Gebrauchsspuren.
- Kein Satz des Profs darf nach vorgelesener Folie klingen.
- Kein UI-Element darf vom BOKU-Design-System abweichen.
- Kein Ereignis darf sich innerhalb eines Durchlaufs wortgleich wiederholen.
- Kein Frame unter 30 fps auf „Mittel“ auf integrierter Grafik.
- Kein Konsolenfehler, keine Warnung von three.js.

Arbeite die Phasen **in Reihenfolge** ab, committe nach jeder Phase, lege Screenshots ab, und liefere am Ende die herunterladbare Datei plus Abschlussbericht. Wenn du an irgendeiner Stelle zwischen „schnell“ und „richtig“ wählen musst: **richtig**.
