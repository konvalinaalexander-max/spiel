# Recherche – Zusammenfassung und Ableitungen für das Spiel

Diese Datei fasst die Recherche zusammen und hält fest, **was daraus im Spiel umgesetzt wurde**. Die vollständigen,
quellenbelegten Rohfassungen liegen in:

| Datei | Inhalt | Umfang |
|---|---|---|
| [`recherche/boku.md`](recherche/boku.md) | BOKU-Standort Türkenschanze, Hörsäle, Fensterblick, Campus-Leben, Studienplan, Vorlesungs-Atmosphäre, Design-System boku.ac.at, Bauliste | ca. 7 200 Wörter, ~170 Quellen |
| [`recherche/tierernaehrung_teil1.md`](recherche/tierernaehrung_teil1.md) | Fachquellen zu den Abschnitten 01–07 | ca. 1 600 Wörter |
| [`recherche/tierernaehrung_teil2.md`](recherche/tierernaehrung_teil2.md) | Fachquellen zu den Abschnitten 08–15 | ca. 1 800 Wörter |
| [`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md) | verbindliches Schema für Vorlesungs- und Dialogtexte | – |

Jede Aussage in den Rohfassungen ist als **[Beleg]**, **[Foto]** (Beschreibung eines Fotos, kein Bild übernommen),
**[Abgeleitet]** oder **[Annahme]** markiert. Es wurden **keine** Bilder, Logos oder Grafiken der BOKU kopiert, und es
werden **keine realen Lehrenden** genannt. Der Vortragende ist der fiktive „Prof. Haferkorn“.

---

## 1. BOKU – Ort und Identität

### 1.1 Welcher Hörsaal ist das Vorbild?

Die Türkenschanze hat neun „Hybridhörsäle“. Belegt sind u. a. Exner-Haus EH01 (150 Plätze, eben), EH02–EH05 (je 119),
Mendel-Haus HS 11 (100 Plätze, steil, 7,5 m hoch), Mendel-Haus HS 31 (110 Plätze, ansteigend, 107,5 m², 4 m hoch),
Guttenberg-Haus HS 21 (168 Plätze) und TÜWI 01 (398 Plätze, Untergeschoß, fensterlos).

**Entscheidung:** Vorbild ist **MENH Hörsaal 31 (XV) im Gregor-Mendel-Haus**, 3. Obergeschoß, Gregor-Mendel-Straße 33.
Gründe: Er liegt im historischen Hauptgebäude an der Adresse aus dem Auftrag, hat echte Fenster mit Blick ins Grüne,
110 Plätze sind realistisch für eine Pflicht-VO im 3. Semester, und der Kontrast „historische Holzbänke + moderne
Hybridtechnik“ ist sofort als BOKU-Altbau lesbar. (Eine moderne Variante wäre TÜWI 01 – fensterlos und dadurch für den
Fensterblick ungeeignet.)

**Was das Foto von HS 31 zeigt** (Beschreibung): lange, durchgehende Pultreihen aus dunkelbraun gebeiztem Massivholz mit
integrierten Holzbänken ohne Polster; helles Eichen-Stabparkett auch auf den Stufen; links drei große, hohe
Sprossenfenster mit weiß lackierten Holzrahmen und Brüstungen; Wände altweiß verputzt; rechts eine hohe, dunkle
Holzvertäfelung mit Handlauf; vorne ein langer hölzerner Vortragstisch über fast die ganze Breite, dahinter eine grüne
Kreidetafel, darüber eine weiße Projektionsfläche; dunkle Holztüren; zwischen zwei Fenstern ein großer Flachbildmonitor;
Decke flach und weiß mit eingelassenen LED-Leuchten und einem Deckenbeamer.

**Belegter Technik-Standard (HS 31):** fixes Rednerpult mit Touchscreen-PC, Beamer, Leinwand 360 cm, Steuerung per
Touchpanel, elektrische Verdunkelung, Tafel, Hand-/Headset-/Freisprechmikrofon, steuerbare Kamera mit Speakertracking,
HDMI/USB-C, Lautsprecher.

### 1.2 Umsetzung im Spiel (Bauliste → `src/scene/layout.js`, `src/scene/hall.js`)

| Bauteil | Umsetzung | Status der Vorlage |
|---|---|---|
| Raum | 9,2 × 12,0 m (≈ 110 m²), lichte Höhe 4,0 m | Fläche/Höhe belegt, Proportion angenommen |
| Plätze | 10 Reihen × 11 Plätze = 110 | belegt (110), Aufteilung angenommen |
| Reihen | Reihenabstand 0,80 m, Stufe 0,14 m, Gesamtanstieg 1,40 m | angenommen (VStG-Mindestmaße eingehalten) |
| Pulte | durchgehend, 0,35 m tief, ≈ 12° geneigt, Ablageleiste mit Stiftrille, Ablagefach, dunkel gebeizte Eiche | Optik Foto, Maße angenommen |
| Bänke | durchgehende Holzbank, Sitzhöhe 0,45 m, Tiefe 0,40 m, Rückenlehne an der Front der nächsten Reihe, geschwungene Wangen | Optik Foto |
| Gänge | links 1,0 m (Fensterseite), rechts 1,2 m Stufengang an der Vertäfelung mit Messing-Handlauf | angenommen, max. 11 Sitze bis zum Gang (VStG § 13) |
| Boden | Eichen-Stabparkett, auch auf Stufen und Podest | Foto |
| Wände | altweiß verputzt, dicke Altbauwände (Fensterlaibung 42 cm), Stuck-Hohlkehle an der Decke | Foto / Annahme |
| Vertäfelung | rechts 1,4 m hoch, Kassetten, folgt den Stufen; vorne Brüstungsvertäfelung | Foto |
| Fenster | 3 hohe weiße Holz-Sprossenfenster (1,8 × 2,6 m) mit Kämpfer/Oberlicht, Steinsims innen, Ziegelfassade außen, Guss-Heizkörper darunter | Foto; Fassadenfarbe vom Hoffoto |
| Verdunkelung | elektrische graue Screen-Rollos mit Motorsummen | belegt („elektronisch“) |
| Podest | eine Stufe (0,15 m), 2,2 m tief | angenommen |
| Vortragstisch | 5,0 × 0,8 × 0,9 m, mittelbraun, mit Futtermittelproben, Wasserglas, Kreideschachtel | Foto; Requisiten erfunden |
| Rednerpult | fix, Touchscreen-PC, Mediensteuerung, Schwanenhals-Mikro, Headset-Halter | belegt |
| Tafel | grün, 4,0 × 1,2 m pro Flügel, **zwei Hub-Schiebeflügel** | Tafel belegt, Schiebefunktion siehe Abweichungen |
| Leinwand | 3,60 m (16:10), motorisch, weiß | belegt |
| Beamer | an der Decke, ca. 4 m vor der Leinwand | Position aus Foto/Annahme |
| Kamera | Speakertracking-Kamera an der Rückwand mit roter Aufnahme-LED | Kamera belegt, LED angenommen |
| Monitor | Flachbild zwischen erstem und zweitem Fenster (Hybrid-/Confidence-Monitor) | Foto |
| Steckdosen | nachgerüstete Aufputzdosen unter der Pultleiste, je zwei Plätze, Kabelkanal | **nicht belegt** – Spielentscheidung (Laptopkabel als Detail) |
| Türen | dunkle Kassettentüren vorne rechts und hinten, grüne Fluchtweg-Leuchten | Foto |

**Bewusste Abweichungen (Gameplay):**
1. *Tafel und Leinwand nebeneinander statt übereinander.* Auf dem Foto liegt die Leinwand über bzw. vor der Tafel. Im
   Spiel muss der Prof gleichzeitig an die Tafel schreiben können, während eine Folie läuft – das ist eine Kernmechanik
   (Rücken zur Klasse). Deshalb: Tafel links der Mitte, Leinwand rechts.
2. *Zwei Hub-Schiebeflügel.* Der Auftrag verlangt eine Schiebetafel mit zwei Flügeln. Bei 4 m Raumhöhe passt das
   (unten 1,05–2,25 m, oben 2,35–3,55 m über Boden).
3. *Steckdosen* sind als Nachrüstung eingebaut (in renovierten Altbausälen plausibel, aber für HS 31 nicht belegt).

### 1.3 Blick aus dem Fenster (`src/scene/outside.js`)

- Das Mendel-Haus liegt direkt am **Türkenschanzpark**, davor **Linnépark/Linnéplatz**. Der Park (~150 000 m²,
  englischer Landschaftsstil, 1888 eröffnet) hat etwa 2 200 Nadel- und 1 660 Laubbäume, viele seltene Zierbäume mit
  Namensschildern, Teiche und die **Paulinenwarte** (23 m, runder Turm mit Fachwerk-Obergeschoß).
- Umgebung: Währinger **Cottageviertel** mit gründerzeitlichen Villen und Gärten.
- **Öffis:** nur Busse **40A, 37A, 10A** (Haltestellen Linnéplatz, Dänenstraße, Borkowskigasse). Eine Straßenbahn direkt
  am Campus ist **nicht** belegt → im Spiel fahren rote Wiener-Linien-Busse 40A/37A, die am Linnéplatz halten; die
  Straßenbahn ist höchstens fern hörbar.
- **Umsetzung:** Blick aus dem 3. OG (Boden 12,6 m tiefer) auf Gregor-Mendel-Straße, Gehsteige, Haltestelle
  „Linnéplatz 40A 37A“, Allee- und Parkbäume in Herbstfärbung (Spieltag ist Dienstag, 27. Oktober 2026), Nadelbäume,
  Parkweg mit Bänken und Laternen, Cottage-Villen in Gelb/Weiß im Hintergrund, die Paulinenwarte über den Wipfeln und eine
  Wienerwald-Silhouette am Horizont. Außenfassade als Ziegelmauerwerk mit hellen Gesimsen (Hoffoto des Mendel-Hauses:
  Rotziegel mit hellen Gesimsen).

### 1.4 Campus-Leben

TÜWI (Kulturzentrum, Beisl, Mensa „BOKU Mensa im TÜWI“, mit BOKUcard −50 %), ÖH BOKU (u. a. Reminder ÖH-Beitrag bis
31.10.), BOKUonline (Prüfungsanmeldung, LV-Verwaltung), BOKUlearn (Moodle), BOKU Ball (2026 im Wiener Rathaus),
„Brot und Wein“, BOKU-Bikes, Podcast „PLANET SHAPERS“, USI-Sport. Ein „Erntedankfest“ der BOKU-Studierenden ist **nicht
belegt** – der Smalltalk des Profs spricht daher vom Erntedankfest in seinem Heimatort. Der Slogan „Universität des
Lebens“ ist nur historisch/informell belegt; die aktuelle Marke heißt **„BOKU University“** (neues Logo seit März 2024).

**Umsetzung:** Zwölf Plakate/Aushänge nach diesen realen Aushang-Typen (Exkursion zur VO mit „Liste geht in der VO
herum“, ÖH-Beitrag, Mensa im TÜWI, Masterarbeitsausschreibung am Institut, USI-Sport, BOKU Ball 2027 im Rathaus ohne
Datum, TÜWI-Beisl-Karaoke, PLANET SHAPERS, „Insekten im Fokus“, BOKU-Bikes, Pinnwand mit Abreißzetteln,
Hybridhörsaal-Schild „Diese Lehrveranstaltung kann aufgezeichnet werden“). Das BOKU-Logo wird **nicht kopiert**, sondern
als grüne Fläche mit Schriftzug nachgebaut.

---

## 2. Studium Agrarwissenschaften

- Bachelor Agrarwissenschaften (Curriculum 033 255, in Kraft seit 1.10.2025), 6 Semester.
- Die VO **Tierernährung** liegt im 3. Semester (Wintersemester), 2 Semesterstunden (= 90 min/Woche), Teil des Moduls
  „Ernährung der Nutztiere und der Kulturpflanzen“ (6 ECTS); die VO selbst entspricht etwa 3 ECTS.
- Zuständig: **Institut für Tierernährung, Tierische Lebensmittel und Ernährungsphysiologie (TTE)** im **Department für
  Agrarwissenschaften**, Sitz Muthgasse.
- Lehr- und Forschungsbetrieb: **Versuchswirtschaft Groß-Enzersdorf**.
- Nachbar-LVs für Stundenplan und Hörsaal-Belegung: Bodenkunde, Pflanzenbau, Tierhaltung, Grünlandwirtschaft,
  Agrarökonomie (realistische Titel siehe Rohfassung Kap. 5.4).
- Notenskala nach UG § 72: sehr gut (1) … nicht genügend (5) → Grundlage des „Zeugnisses“ am Spielende.

**Umsetzung:** LV-Seite im BOKUonline-Stil mit LV-Typ VO, 2 SSt, 3 ECTS, Wintersemester 2026/27, Institut und Department
wie oben, Vortragender „N.N. (Prof. Haferkorn, fiktiv)“, Raum „MENH HS 31“.

---

## 3. Tierernährung – Fachinhalt

15 Vorlesungsabschnitte (8 davon `core`, werden nie übersprungen), jeweils DE + EN:

| # | Abschnitt | Kernaussagen (Auszug) |
|---|---|---|
| 01 | Einführung | Futter → Tier → Lebensmittel, Nährstoffkreislauf, Futterkosten als größter Kostenblock, Grünland in Österreich |
| 02 | Futtermittelanalytik | Weender (TM, XA, XP = N × 6,25, XL, XF, NfE als Differenz) und Van Soest (NDF, ADF, ADL) |
| 03 | Verdauung Monogastrier | Schwein (Magen, Dünndarm als Hauptort, Dickdarm), Geflügel (Kropf, Drüsen-/Muskelmagen, Blinddärme), Passagezeiten |
| 04 | Verdauung Wiederkäuer | Vormägen, Mikrobiom, flüchtige Fettsäuren, Pansen-pH, SARA (pH < 5,8), peNDF, Speichel 100–200 l/Tag, Methan |
| 05 | Energiebewertung | GE → DE → ME → NE, NEL (Erhaltung ≈ 0,293 MJ × LM^0,75; ≈ 3,2–3,3 MJ NEL/kg Milch), ME Schwein, AMEn Geflügel; GfE-Umstellung 2023 erwähnt |
| 06 | Protein Wiederkäuer | RDP/UDP, Mikrobenprotein, nXP, RNB = (XP − nXP)/6,25, Milchharnstoff |
| 07 | Protein Monogastrier | essentielle AS, ideales Protein, Lysin/Methionin erstlimitierend, Minimumgesetz, Phasenfütterung |
| 08 | Futtermittelkunde | Heu, Gras-/Maissilage, Weide/Alm, Getreide, Soja-/Rapsextraktionsschrot, Nebenprodukte, Mineralfutter |
| 09 | Konservierung | Silierung (anaerob, Anwelken 30–40 % TM), Fehlgärungen, Nacherwärmung, Heuwerbung, Heumilch, DLG-Schlüssel |
| 10 | Rationsberechnung Milchkuh | 650 kg, 30 kg Milch: Erhaltung ≈ 37,7 + Leistung 99 ≈ 137 MJ NEL; nXP ≈ 3 000 g; Grundfutter 93 MJ, ≈ 6,6 kg MLF |
| 11 | Stoffwechsel/Laktation | Transitphase, Ketose (BHB ≈ 1,2 mmol/l), Milchfieber/DCAB, Azidose, Weidetetanie, BCS |
| 12 | Mineralstoffe & Vitamine | Ca:P, Mg, Se (selenarme Böden), Cu beim Schaf, Jod, Vitamine A/D/E |
| 13 | Fütterung und Umwelt | Methan 300–500 g/Kuh/Tag, N-/P-Ausscheidung, 3-NOP (EFSA prüft neu), Feed-Food-Competition |
| 14 | Futtermittelrecht | EU-Recht, AGES, Kennzeichnung, Mykotoxine (EU-Empfehlung 2026 überarbeitet) |
| 15 | Ausblick | Pferd, Schaf/Ziege, Fisch |

**Kennzahlen:** 45 Quizfragen (je Abschnitt 3, davon 1 Rechenaufgabe), 15 Rechenbeispiele für die Tafel, 151 Beats mit
je drei Formulierungsvarianten (911 Sätze DE), 490 Dialogzeilen (DE) für Ereignisse, 29 fachlich beantwortete
Publikumsfragen – alles vollständig auf Englisch übersetzt.

**Offene fachliche Punkte** (in den Rohfassungen dokumentiert): GfE 2023 empfiehlt ME statt NEL und dünndarmverdauliches
Protein statt nXP; das Spiel lehrt NEL/nXP als „vielerorts noch Standard“ und erwähnt die Umstellung. Werte, die
zwischen Quellen streuen (Speichelmenge, Methan je Kuh, Milchharnstoff-Zielbereich, Passagezeiten), sind als Bereiche
formuliert. 3-NOP: Zulassung 2022, Wirkung je nach Ration ~15–30 %, EFSA-Neubewertung läuft – vorsichtig formuliert.

---

## 4. Vorlesungs-Atmosphäre

- Eine VO mit 2 SSt dauert 90 Minuten. Das akademische Viertel ist in Österreich „früher üblich“, heute beginnen die
  meisten VOs pünktlich → im Spiel: Termin **Di 10:00–11:30**, der Prof startet nach ein paar Minuten Technik-Setup.
- Typischer Ablauf: Einströmen, Pult-PC/Beamer/Headset, ggf. Aufzeichnung starten; Organisatorisches (Prüfungstermine,
  Unterlagen auf BOKUlearn, Exkursion); erster Block; ggf. 5 Minuten Pause; zweiter Block; Zusammenfassung,
  Prüfungshinweis; am Ende **Klopfen auf die Tische** statt Applaus.
- **Anwesenheit:** Laut BOKU-Richtlinie keine Anwesenheitspflicht in einer VO. Die Liste, die im Spiel herumgeht, ist
  deshalb die **Anmeldeliste für die Exkursion** zur Versuchswirtschaft (max. 40 Plätze; bei Exkursionen ist volle
  Anwesenheit zulässig).
- Verhalten/Geräusche: hintere Reihen voller als vordere, Laptops mit Stickern, Thermosflaschen, Flüstern über die
  Mensa, Handyvibrieren, Tastaturklappern, leises Lachen bei Fachwitzen, knarzende Holzbänke, Headset-Rückkopplung,
  Beamerlüfter, Summen der Verdunkelung, Kreidequietschen, draußen Busse, Vögel, Laubbläser.

**Umsetzung (Ereignis-Skript, Phase 5):** Ankommen und Technik-Setup, Mikro-Test, Smalltalk, Organisatorisches,
Wiederholung, Abschnitte mit Folien/Tafel, Publikumsfragen, Spätkommer, Handy, Beamer ohne Signal, lange Rechnung an
der Tafel, Gang in die Reihen, Exkursionsliste, Direktfrage an den Spieler, Nachbar warnt/verrät, Witz, Trinken,
Blick auf die Uhr, Pause, Tafel wischen/schieben, Rückkopplung, Rollos runter (Sonne blendet), Regen, Tür, früher
Gehen, Hustenanfall, Lichtflackern, Flasche fällt, Prüfungshinweis, Folien auf BOKUlearn, Schluss mit Klopfen.

---

## 5. Design-System boku.ac.at → `src/ui/tokens.css`

| Token | Wert | Herkunft (app.css) |
|---|---|---|
| Primärgrün | `#00aa5a` | Links, aktive Navigation, h2-Kante, Buttons, Fokus-Glow, Logo-B |
| Purple / Orange | `#4b288c` / `#e6641e` | Key-Fact-Kacheln 2/3 |
| Fließtext / Überschriften | `#474747` / `#222` | body / h1–h6 |
| Seitengrund / Fläche / Footer | `#efefef` / `#fff` / `#d6d6d6` | |
| Breadcrumb | `#929191`, 0.857em, Trenner „ > “ | |
| Info-Box | `#eef6e9` | Tabellen-Panel |
| Schrift | Arial (Web), Work Sans (Marke, Plakate/Folien) | body / Corporate Design |
| h1 | 24 px mobil, 30 px ab 768 px, normal | `#header-main h1` |
| h2 | 18 px bold, `padding 17px 20px`, `border-left 3px solid #00aa5a`, grauer Verlauf | `.main h2` |
| Fließtext | 14 px, line-height 1.2em | `.main p` |
| Button | grün, weiß, bold 14 px, 34 px hoch, `padding 0 15px`, 3 px Radius, Rahmen `#a6a6a6` | Formular-Button |
| Fokus | `box-shadow: 0 0 3px 1px #00aa5a; outline: none` | `:focus` |
| Raster | Breakpoints 576/768/1020/1280/1440, Kachel-Grid 3-spaltig mit 30 px Abstand, Container 1440 px | |
| Teaser | weiß, 15 px Innenabstand, Schatten `.5px .866px 1px rgba(0,0,0,.06)` | `.teaser-panel` |
| Footer-Inhalt | „BOKU University / Universität für Bodenkultur Wien / Gregor-Mendel-Straße 33, 1180 Wien“ | Startseite |

**Umsetzung:** Alle UI-Flächen (Startseite als Website-Nachbau, LV-Seite, Einstellungen, Pause, Zeugnis, HUD,
Untertitel, Laptop-Browser „BOKUlearn“) verwenden nur diese Tokens. Work Sans (OFL) ist für Plakate und Folien
eingebettet; die Web-Oberfläche nutzt wie boku.ac.at Arial. Hinweis: boku.ac.at befindet sich im Relaunch (seit
Februar 2026); die Werte können sich ändern.

---

## 6. Konsequenzen für Gameplay und Erzählung (Kurzfassung)

1. **Kleiner, intimer Saal** (110 Plätze, 4 m hoch): Der Prof ist nah (6–9 m), sein Blick ist gefährlicher als in einem
   Großsaal – passend für eine Schleich-Mechanik. Hintere Reihen sind voller (Verdeckung), vordere leerer.
2. **Aufzeichnung:** Die Kamera mit roter LED und das Schild „kann aufgezeichnet werden“ sind reine Atmosphäre – das
   Spiel wertet die Kamera nicht als zweiten Beobachter (sonst wäre die Aufzeichnung unrealistisch strafend).
3. **Exkursionsliste statt Anwesenheitsliste** (Richtlinie): Wer unterschreibt, sichert sich einen Platz – im Spiel
   eine kleine Fleiß-Belohnung und ein Moment mit offenem Laptop, in dem der Nachbar herüberschaut.
4. **Dienstag, 27. Oktober 2026:** Herbstlaub, tiefe Vormittagssonne durch die linken Fenster (Lichtschächte, Staub),
   am Tag nach dem Nationalfeiertag; ÖH-Beitrags-Frist 31.10. auf dem Plakat.
5. **Busse statt Straßenbahn** vor dem Fenster (40A/37A am Linnéplatz), Vögel/Laubbläser aus dem Park.
