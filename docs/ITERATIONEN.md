# Optik-Iterationen

Jede Iteration: Screenshot → kritische Bewertung („Was sieht nach Baukasten aus? Was ist zu sauber, zu grell, zu leer?“)
→ Verbesserung → neuer Screenshot. Screenshots liegen in `docs/screenshots/`.

## Phase 2 – Render-Pipeline

**Iteration 0** (`phase2_pipeline_smoke.png`): Testszene mit Kaskadenschatten (CSM), N8AO, AgX-Tonemapping und
prozeduralen PBR-Texturen (Holz, Lamellen, Sichtbeton, Teppich). Ergebnis: Pipeline funktioniert, Normal-/ORM-Maps
greifen. Kritik: `PCFSoftShadowMap` ist in r183 veraltet → auf `PCFShadowMap` umgestellt.

**Iteration 1 – Stufe „Hoch“ im Spiel** (`phase2_iter1_high_beamer_before.jpg`): Mit Beamer-Spot (Projektionstextur + Schatten)
und Bloom ist die Leinwand **massiv überbelichtet**: weißer Schleier, Folientext unlesbar, Lichtkegel strahlt die Wand an.
Ursache: Spot-Intensität 55 zusätzlich zur Emission der Leinwand. → Spot auf 14, Emission 0,34; Bloom-Schwelle 0,82 bleibt.
Ergebnis in `phase2_preset_high.jpg`: Folie lesbar, leichter Hotspot, Prof wirft einen Schatten auf die Leinwand, wenn er davorsteht.

**Iteration 1b – Beamer-Projektion deckungsgleich** (`phase2_iter1b_beamer_doppelbild_before.jpg`): Bei der Endkontrolle waren „Hoch“ und
„Ultra“ wieder milchig. Diagnose mit getrennten Bildern (nur Spot / nur Leinwand-Emission): Die Folie in der Spot-Textur war **zu groß,
nach links verschoben und nicht trapezentzerrt** – der Beamer hängt über der Leinwand, die Texturgröße war nur geschätzt. Spot-Bild und
Leinwandbild lagen versetzt übereinander → heller Doppelschleier. → Leinwandpunkte werden mit einer Kamera, die exakt der
Spot-Schattenkamera entspricht (fov = 2·Winkel, quadratisch), in Texturkoordinaten projiziert; die Folie wird als Gitter aus 6 × 6
affin verzerrten Dreiecken gezeichnet; der Öffnungswinkel ergibt sich aus den vier Leinwandecken. Ergebnis
`phase2_iter1b_beamer_spot_only_after.jpg` (nur Spot): Projektion sitzt genau auf der Leinwand, kein Licht daneben; im Gesamtbild
(`phase2_preset_high.jpg`) ist die Folie scharf.

**Iteration 2 – Laptop-Kamera** (`phase2_iter2_laptop_camera_before.png`): Erster Versuch, die Kamera für den Laptop-Blick auf eine
ruhige Leseposition 43 cm vor dem Bildschirm zu führen. Kritik: Die Kamera landet **in der Kapuze des eigenen Hoodies** (grüne Flächen),
weil die Augen der Figur näher am Bildschirm sind. Außerdem spiegelte sich das eigene Laptop-Licht (Punktlicht) als heller Fleck im Display.
→ Abstand 33 cm entlang der Bildschirmnormalen, Sichtfeld 40° (Zoom statt Annäherung), Display als selbstleuchtendes unbeleuchtetes Material,
Laptop-Licht 35 cm vor dem Bildschirm Richtung Gesicht.

**Iteration 3** (`phase2_iter3_laptop_camera_after.jpg`): Bildschirm senkrecht im Blick, gut lesbar, Tastatur und Hände unten im Bild,
oben über dem Deckelrand bleiben Tafel und Prof sichtbar (wichtig für die Mechanik). Tiefenschärfe ab „Mittel“: Raum weich, Display scharf.

**Qualitätsstufen im Vergleich** (identische Kamera, Sitzplatz Reihe 5/Platz 8, Prof schreibt an die Tafel):
`phase2_preset_low.jpg`, `phase2_preset_medium.jpg`, `phase2_preset_high.jpg`, `phase2_preset_ultra.jpg`.
Niedrig: 1 Schattenkaskade, FXAA, kein AO/Bloom, 80 % Auflösung; Mittel: 2 Kaskaden, N8AO (halbe Auflösung), Bloom, SMAA, Tiefenschärfe;
Hoch: 3 Kaskaden (2048²), Flächenlichter, Beamer-Spot mit Schatten, Staub im Licht; Ultra: 4096²-Schatten, AO in voller Auflösung, Texturen 2048².
Geprüft: keine Z-Fighting-Artefakte an Tafeln/Plakaten (Plakate 2,5 cm vor der Wand, Decals mit Polygon-Offset), keine Schatten-Akne
(siehe Phase 4, Iteration 3 – die vermeintliche Akne war ein Shader-Fehler).

**Alt ↔ Neu** (`compare_v1_seat.jpg` ↔ `compare_v2_seat.jpg`): Blick vom Sitzplatz in Version 1 (flache Farben, keine Schatten, Box-Figuren)
und Version 2.

## Phase 3 – Hörsaal

**Iteration 0 – moderner Holzsaal** (`phase3_iter0_modern_*.png`): Erster Entwurf vor Eingang der Recherche: großer
Saal mit 180 grün gepolsterten Klappsitzen, Holzlamellen, Lamellendecke mit Lichtlinien.
Kritik: wirkt wie ein generischer Neubau-Hörsaal, nicht wie die Türkenschanze; Desk-Maserung zu wild (Sperrholz-Look),
Lichtschächte als harte Keile sichtbar, Leinwand ausgebrannt, Außenbäume als scharfkantige Ikosaeder („Scherben“),
eine Baumkrone ragte durch die Wand. **Verworfen** zugunsten des recherchierten Vorbilds HS 31 (Mendel-Haus).

**Iteration 1 – HS 31** (`phase3_iter1_hs31_*.png`): Umbau nach Bauliste: 10 × 11 Plätze, dunkel gebeizte Pultbänke,
Eichenparkett, drei hohe Sprossenfenster, Vertäfelung rechts, Podest mit 5-m-Vortragstisch, Pult mit Touchscreen,
Monitor zwischen den Fenstern, Ziegelfassade außen, Rollos statt Jalousien, Blick aus dem 3. OG.
Kritik: Putz und Decke zu körnig (sieht nach Rauputz/Stuck aus statt glatt gestrichen), Decke bräunlich,
Punktlichter erzeugen grelle Flecken an der Decke, Holzmaserung zu großflächig geschwungen, Stiftrille als schwarzer
Balken, Lichtschacht als heller Keil über der Tafel, Leinwand ausgewaschen.

**Iteration 2** (`phase3_iter2_seat.png`): eigene Rezeptur „woodStained“ (gerade, feine Eichenmaserung mit Markstrahlen,
abgegriffene Stellen, Kratzer), Putz-Normalen auf 25 %, Deckenputz fast glatt, Deckenstrahler nach unten statt
Punktlichter, Stiftrille holzfarben, Lichtschacht mit Kanten- und Blickwinkel-Ausblendung, Leinwand weniger
selbstleuchtend. Kritik: Himmel draußen schwarz (Kugel außerhalb der Kamera-Far-Plane), Decke noch warmstichig
(Hemisphären-Bodenfarbe zu braun).

**Iteration 3** (`phase3_iter3_window.png`): Far-Plane 520 m, Himmel mit Wolken und Wienerwald-Silhouette,
Hemisphären-Bodenfarbe neutral-warm. Ergebnis: Blick auf den herbstlichen Türkenschanzpark mit Paulinenwarte,
Sonnenflecken auf den Bänken. Offene Punkte für spätere Iterationen: Wangen der Bänke wirken noch kantig;
Requisiten auf den Tischen fehlen; Leinwand-Kontrast im Spiel mit Figuren prüfen.

**Iteration 4 – Requisiten** (`phase3_iter4_back_right.jpg`): Laptops mit Stickern, Collegeblöcke, Mensa-Becher, Trinkflaschen, Lehrbuch,
Rucksäcke, Jacken; Blick nach hinten rechts mit Handlauf und Plakaten. Kritik: obere Wandhälfte wirkt leer – passt aber zum Vorbild
(Altbau, hohe glatte Putzwände); bleibt so.

**Iteration 5 – erstes Bild im laufenden Spiel** (`phase3_iter5_first_ingame.png`): Kritik: die eigene Edelstahlflasche stand direkt vor der
Kamera und verdeckte den rechten Bildteil; der Beamer zeigte nach dem Hochfahren dauerhaft „Bitte warten“. → Flasche entfernt
(stattdessen PET-Flasche links), Beamer zeigt nach dem Hochfahren die zuletzt angeforderte Folie. Zusätzlich: Kontaktschatten-Streifen unter
allen Bänken (wirken auch in „Niedrig“ ohne AO), Kaffeeränder, LED-Stufenlicht, Thermostat, Türglas mit Gang-Silhouetten,
Hybrid-Monitor mit Online-Teilnehmenden und „REC“.

**Abnahme-Bilder:** Orbit aus sechs Winkeln `phase3_orbit1_front_left.jpg` … `phase3_orbit6_podium.jpg`,
Spielerperspektiven `phase3_player1_listen.jpg`, `phase3_player2_laptop.jpg`, `phase3_player3_notes.jpg`.

### Requisiten-Checkliste „sieht aus wie Baukasten?“

Bewertet in der Ansicht, in der man das Objekt im Spiel sieht (Entfernung ≥ 0,5 m; nur der eigene Platz ist näher).

| Objekt | Baukasten? | Begründung / Maßnahme |
|---|---|---|
| Laptop (silber, spacegrau, Business schwarz) | nein | gerundete Kanten, Scharnier, Tastaturfeld, Display mit echtem Inhalt, Sticker |
| eigener Laptop | nein | DE-Tastaturtextur (QWERTZ, AltGr), Trackpad, Deckel stufenlos, Bildschirm = laufendes Betriebssystem |
| Laptop-Netzteil, Funkmaus | leicht | klein und fern; Kabel als dünner Zylinder genügt |
| Collegeblock offen | nein | kariertes Papier, Randlinie, Spirale aus 14 Ringen, Handschrift (Hershey-Script) |
| eigener Collegeblock | nein | wird Strich für Strich mit dem Kuli beschrieben, blättert um |
| Ringmappe, Folienskript, Handouts, Lehrbuch | nein | Etiketten/Cover mit Text, Papierkante, Eselsohr am eigenen Skript |
| Federpenal, Kugelschreiber, Textmarker, Bleistift, Radiergummi, Geodreieck | leicht | sehr klein; Farben und Kappen differenzieren |
| Taschenrechner | nein | Display + 20 Tasten |
| Haftnotizen, Tablet mit Stift, USB-Stick, Schlüssel, Karte, Kaugummi, Taschentücher | leicht | Größe ≤ 10 cm, aus der Entfernung glaubwürdig |
| PET-Flasche, Edelstahlflasche, Mate-Flasche | nein | Glasmaterial mit Etikett, Deckel, Schulter |
| Mensa-Becher, Thermobecher | nein | Banderole, Deckel |
| Apfel, Kornspitz-Sackerl | leicht | einfache Formen, Farben stimmen |
| Smartphone (liegend, in der Hand) | nein | Kamerabuckel bzw. leuchtendes Display |
| Kopfhörer, Ladecase | leicht | – |
| Rucksack | nein | Fronttasche, Reißverschluss, Träger, Griff; Stoff-Normalmap |
| Jacke über der Lehne | leicht | gefaltete Volumen mit Ärmeln; aus der Ferne glaubwürdig |
| Fahrradhelm | nein | Lüftungsrippen |
| Haube, Regenschirm | leicht | – |
| 7 Futtermittel-Probengläser | nein | jedes mit eigener Füllung (Heu, Grassilage, Maissilage, Gerste, SES, Mineralfutter, Pellets) und Etikett |
| Heu im Papiersackerl | nein | einzelne Halme |
| Pansen-Modell | nein | vier Magenabschnitte + Schlund auf Sockel |
| Kreideschachtel, Schwamm, Wasserschüssel, Tafelwischer | nein | farbige Kreiden, Wasserfläche |
| Karaffe, Wasserglas | nein | Glas, Wasserstand; Glas verschwindet, wenn der Prof trinkt |
| Aktentasche, Ordner, Brillenetui, Taschensender, Tasse | leicht | – |
| Prof-Laptop + HDMI-Kabel | nein | zeigt zum Prof |
| Klemmbrett mit Exkursionsliste | nein | Liste mit Unterschriften, wandert durch die Reihen |
| Grünlilie, vergessene Flasche/Becher am Fenster | leicht | – |
| Jacken & Schal an der Garderobe | leicht | – |
| Steckdosenleiste, zerknülltes Papier | leicht | – |
| Bänke, Pulte, Sitznummern | nein | Profilbretter, Ablageleiste mit Stiftrille, Wangen, Messing-Nummernschilder, Steckdosen |
| Schiebetafeln | nein | zwei Flügel, Kreidestaub, alte halb gelöschte Formeln, Wischspuren |
| Leinwand, Beamer, Pult, Hybrid-Monitor, Kamera | nein | Gewebe-Normalmap, Projektion, Touchscreen, Live-Bild, REC-LED |

## Phase 4 – Figuren

**Iteration 0** (`phase4_iter0_rig.png`): Skinned-Mesh-Rig mit Vertexfarben, Sitzpose, Arm-IK, Blick. Kritik: Glieder
zu dünn, Rumpf zu schmal, Pullunder deckt den Bauch nicht (weißes Hemd sichtbar), Hals zu lang.

**Iteration 1 – Hände** (`phase4_iter1_hands_blocky.jpg`): In der Mitschreib-Ansicht sind die Hände groß im Bild – und wirken wie
Fäustlinge (ein Block für alle Finger). Der Kuli liegt neben der Hand. → vier einzelne Finger mit Mittelgelenk, zweigliedriger Daumen,
Handballen; Griff: Handgelenk liegt entlang des Stifts, Finger zeigen zur Spitze.

**Iteration 2** (`phase4_iter2_fingers_stripes.jpg`): Finger sichtbar, aber: Haut zeigt **diagonale Streifen**. Zuerst als Schattenakne
vermutet (Eigenschatten abgeschaltet, Normal-Bias erhöht) – ohne Wirkung. Tatsächliche Ursache: Die Stoff-Detailnormalen sollten per
Vertex-Maske nur auf Kleidung wirken, aber die Shader-Ersetzung zielte auf eine Zeile, die im noch nicht aufgelösten `#include` steckt.
→ Chunk vor der Ersetzung auflösen. Außerdem Finger weniger vorgekrümmt (Grundpose), Knöchel modelliert, Finger leicht gefächert.
Prof an der Tafel (`phase4_iter2_prof_writing.jpg`): Hand folgt dem Kreidestrich, Text erscheint Strich für Strich.

**Iteration 3** (`phase4_iter3_skin_fixed_pen_grip.jpg`, `phase4_iter3_students_side.jpg`): Haut glatt, Stift in der Hand, Kopf nickt beim
Schreiben leicht mit. Studierende aus dem Seitengang: Profile sind erkennbar (Tippen, Mitschreiben, Handy, Schlafen), Frisuren/Oberteile variieren.
Offen (bewusst stilisiert): Gesichter ohne Texturdetails – aus Spielerposition sieht man ohnehin vor allem Hinterköpfe.

**Sequenz Gehen → Tafel → Schreiben** (`phase4_seq_01.jpg` … `phase4_seq_10.jpg`, alle 0,45 s, feste Kamera) und Schulterblick
(`phase4_shoulder_check.jpg`). Geprüft: Füße bleiben beim Gehen auf dem Boden stehen (Schrittplaner setzt Füße fest, Hüfte folgt),
Arme durchdringen den Körper nicht (Ellbogen-Pol nach außen-hinten), Kopfdrehung auf ±1,45 rad (Prof) bzw. ±1,25 rad (Studierende) begrenzt.

## Phase 9 – Endkontrolle

Vor der Auslieferung wurden alle Dokumentationsbilder mit dem fertigen Build neu erzeugt (`node tools/phaseshots.mjs`) und kritisch
durchgesehen. Gefunden und behoben:

| Befund | Ursache | Maßnahme |
|---|---|---|
| Leinwand auf „Hoch“/„Ultra“ milchig, Doppelbild (`phase2_iter1b_beamer_doppelbild_before.jpg`) | Folie in der Beamer-Spot-Textur zu groß, verschoben, nicht trapezentzerrt | Projektion über die Spot-Schattenkamera berechnet, Gitter-Warp (siehe Iteration 1b) |
| Laptop-Bildschirm im Laptop-Blick unscharf (`phase9_dof_laptop_before.jpg`) | Tiefenschärfe fest auf 0,48 m, die Kamera sitzt seit Iteration 2 aber 0,33 m vor dem Bildschirm | Fokus = gemessener Abstand Kamera → Bildschirm bzw. Heftseite, Fokusbereich 0,45 m (`phase3_player2_laptop.jpg`) |
| 16 Draw Calls für die Balken der Paulinenwarte | `gfx.pbr()` in der Schleife → 16 Materialien, 16 Batch-Gruppen | ein Material |
| „Mittel“ 273 Draw Calls (Budget 250) | Außenwelt und Fahrzeuge warfen Schatten in beide Kaskaden | Außenwelt/Fahrzeuge ohne Schatten, Rollokästen gebatcht, Bloom 6 Stufen (`docs/PERFORMANCE.md`) |
| 53 Figuren = 53 Draw Calls (+ je Kaskade) | ein SkinnedMesh pro Figur | zwei gemeinsame SkinnedMeshes mit Knochen-Offset; Sichtprüfung aus allen Orbit-Winkeln |
| Balancing „Prüfungswoche“ zu nah an „Bachelor“ | nur 40 Läufe, Parameter nicht monoton | 80 Läufe, Gegner-Stärke 0,56 (`docs/BALANCING.md`, Schritt 6) |

Geprüft ohne Befund: Nachbarin sitzt links (Platz 6), rechts daneben frei (Platz 8, Rucksack); Figuren aus allen sechs Orbit-Winkeln
vollständig, keine fehlenden Körperteile nach dem Zusammenführen; Folien in allen Stufen lesbar.
