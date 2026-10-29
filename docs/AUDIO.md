# Audio – Kanäle, Klangquellen, Prüfung (Version 3)

Jeder Ton im Hörsaal ist eine **echte Aufnahme** (Kreide, Tür, Stühle, Tippen, Gemurmel, Lüftung, Regen, Verkehr …), aufbereitet mit
`tools/audio/build_sfx.py`, ausgeliefert als Opus (`assets/build/sfx/`, im Desktop-Build eingebettet, im Mobil-Build als Dateien).
Der Hall kommt aus **echten Impulsantworten eines Hörsaals**. Synthetisch sind nur noch die fünf Signaltöne des Laptop-OS
(`src/audio/synth.js`: Benachrichtigung, Sieg, Niederlage, zwei Snake-Töne) – Anhang E erlaubt höchstens fünf.
Wiedergabe, Mischung und Raumklang macht `src/audio/engine.js` (Web Audio API), das Laden `src/audio/sfx.js`.

<!-- summary:start -->
**146 Dateien** (129 Einmal-Klänge, 14 Atmosphären-Schleifen + Menü-Musik, 2 Impulsantworten), 72 Klangnamen, 7,87 MB (Opus).
<!-- summary:end -->

## Mixer (Einstellungen › Ton, gespeichert in `localStorage`)

| Kanal (Bus) | Regler | Inhalt | Besonderheiten |
|---|---|---|---|
| **Master** | Gesamtlautstärke | alles | Kompressor (Schwelle −14 dB, 3:1) gegen Spitzen |
| **Stimme** (`voice`) | Stimme | vorgerenderte Stimmen (Prof, Nachbarin, Tutorin, Studierende), siehe unten | Tiefpass `voiceLP`: am Laptop 20 kHz → 2,4 kHz, mit Kopfhörern 700 Hz |
| **Effekte** (`sfx`) | Effekte | Raumklänge (über `roomBus`), eigene Geräusche (`player`), Hall | Raumklänge **und der Hallanteil** laufen durch `roomLP` (Dämpfung am Laptop/mit Kopfhörern) |
| **Raumklang** (`amb`) | Raumklang | alle Atmosphären-Schleifen (Lüftung, Raumton, Gemurmel, Tastaturen, Gang, Straße, Regen, Wind, Vögel, Beamerlüfter) | Schleifen hängen an `roomAmb` → `roomBus`: Raumklang-Regler (0,65 = Faktor 1) **und** Raumdämpfung wirken |
| **Musik** (`music`) | Musik (Menü) | „Almost Bliss“ (Kevin MacLeod, CC BY 4.0) als Schleife | nur in Menüs, im Hörsaal aus (Realismus); kein synthetischer Ersatz mehr |
| **UI** (`ui`) | folgt Effekte × 0,9 | Menü-Klicks, Quiz-/Erwischt-Signal, Richtig/Falsch (echte Klaviertöne/Klicks) | – |

Die **Sprachausgabe des Browsers** und das „Murmeln“ gibt es nur noch als ausdrücklich gewählte Notlösung in den Einstellungen
(siehe „Stimme“); Standard ist die vorgerenderte Aufnahme. Untertitel gibt es immer.

## Raum: Hall aus echten Impulsantworten

**Quelle:** H. Wierstorf, M. Geier: „Binaural room impulse responses recorded with KEMAR in a mid-size lecture hall“ –
Auditorium 3 im Telefunken-Hochhaus der TU Berlin, gemessen mit Kunstkopf KEMAR (45BA) und Genelec 8250A, sechs Lautsprecherpositionen,
Kopf in 1°-Schritten gedreht. Zenodo, [doi:10.5281/zenodo.160749](https://zenodo.org/records/160749), **CC BY 4.0** (Lizenz auch im
SOFA-Dateikopf). Datei `QU_KEMAR_Auditorium3.sofa` (343 MB, MD5 `f5d47d69287334cef1737d88f68f7ba0` wie bei Zenodo angegeben,
SHA-256 `a4229a19…`). Die Nennung steht in `docs/ASSETS.md` und im Spiel unter „Impressum, Quellen & Lizenzen“.
OpenAIR war aus der Umgebung nicht erreichbar; Wikimedia Commons antwortete überwiegend mit HTTP 429 (Rate-Limit, nicht umgangen).

**Auswahl** (`tools/audio/extract_ir.py`, braucht `h5py`: `python3 -m venv tools/.venv-ir && tools/.venv-ir/bin/pip install h5py numpy`):
je Position der Kopfwinkel, der zur Quelle schaut – **vorne** = Lautsprecher 4 in 1,50 m (wie ein Platz in den ersten Reihen),
**hinten** = Lautsprecher 2 in 5,49 m (mehr Nachhall, weniger Direktschall). Nachhallzeit des Saals T30 ≈ 0,6–0,75 s (nachgemessen
mit der Schroeder-Kurve; mittelgroßer Hörsaal – etwas trockener als die frühere synthetische Antwort mit 1,15 s).

**Aufbereitung** (`build_ir()` in `tools/audio/build_sfx.py`): 48 kHz, Stereo (linkes/rechtes Ohr), Start 0,5 ms vor dem Direktschall,
**Direktschall entfernt** (die ersten 2,5 ms stumm, 1 ms Rampe – der trockene Klang kommt im Spiel schon über den Panner),
Ende bei −60 dB der Energieabklingkurve (höchstens 0,95 s) mit 60 ms Ausblendung. **Pegel:** Der frühere `ConvolverNode` normalisierte
seine synthetische Antwort selbst (`normalize = true`); jetzt `normalize = false`, und die echte Antwort bekommt genau die Lautheit, die
der Hallanteil vorher hatte (rosa Rauschen durch beide Antworten gefaltet, BS.1770-Lautheit gleichgesetzt). Die Datei liegt mit
−3 dBFS Spitze vor, der Rest steckt im Pegelfaktor `gain` im Verzeichnis.

<!-- ir:start -->
| Impulsantwort | Position | Länge | T30 (aus der Datei) | Pegelfaktor | Datei |
|---|---|---|---|---|---|
| `irFront` | Lautsprecher 4, 1,50 m vor dem Kunstkopf (wie ein Platz vorne) | 0,95 s | 0,75 s | 0,0600 | `irFront_0.ogg` (14 KB) |
| `irBack` | Lautsprecher 2, 5,49 m vom Kunstkopf (wie ein Platz weiter hinten) | 0,95 s | 0,75 s | 0,0664 | `irBack_0.ogg` (14 KB) |
<!-- ir:end -->

**Im Spiel** (`AudioEngine`): zwei `ConvolverNode`s hinter einem gemeinsamen Hall-Send mit **Vorverzögerung**; gemischt nach der
Hörposition (Abstand zum Pult 3,5 m → nur „vorne“, ab 10,5 m nur „hinten“, dazwischen Gleichleistungs-Überblendung), die
Vorverzögerung sinkt dabei von 12 auf 3 ms (weiter hinten kommen Direktschall und erste Reflexionen dichter hintereinander). Wird man
in die erste Reihe umgesetzt, wandert der Hall mit. Weil Geräte oft mit 44,1 kHz laufen, werden die Antworten vor dem Einsetzen mit dem
Resampler des Browsers auf die Kontextrate gebracht (`_resample`). Fehlen die Antworten, bleibt der Raum trocken – eine
synthetische Ersatz-Impulsantwort gibt es nicht mehr.

- **Positionierung:** `PannerNode` (equalpower, Stimmen HRTF), inverse Abstandsdämpfung, Hörer = Kamera (Position + Blickrichtung pro Bild).
- **Laptop-Fokus:** Beim Blick auf den Laptop wird der Raum dumpfer (`setMuffle`), mit Kopfhörern deutlich – jetzt einschließlich Hall.

## Atmosphären (nahtlose Schleifen)

15 Schleifen: **14 Atmosphären** + Menü-Musik. Stereo, Hochpass 40 Hz, **nahtlos** durch Gleichleistungs-Überblendung des Endes in
den Anfang (2 s), **−22 LUFS** (Anhang E: −22 ± 2), Spitzenbegrenzer mit 5 ms Vorausschau (ringförmig, damit die Naht unberührt
bleibt), True Peak ≤ −1 dBTP, 20–57 s lang.

**Nahtprüfung** an der fertigen, wieder dekodierten Datei (`measure_file()` in `build_sfx.py`, geprüft von `tools/audio-check.mjs`):
Effektivwert der Sample-Differenzen in 2 ms um die Nahtstelle (Ende → Anfang, so wie die Schleife abspielt) im Verhältnis zum
Effektivwert der Differenzen der ganzen Datei – ein Klick treibt den Wert weit über 1, eine saubere Naht liegt um 1.
**Kriterium: < 2** (Anhang E). Dazu der Pegelsprung zwischen den letzten und ersten 250 ms gegen die übliche Schwankung der Datei.
(Der einzelne Sprung „letztes → erstes Sample“ aus v2 steht als `seamStep` in `docs/audio/check.json`; als Einzelwert schwankt er
bei echten Aufnahmen zufällig zwischen 0 und 7 und taugt nicht als Kriterium.)

Wann welche Schleife läuft, steuert `AudioEngine.ambience({ phase, weather, raining, places })` – aufgerufen von `src/game/game.js`
beim Start, bei jedem Phasenwechsel und wenn Regen einsetzt. Gemurmel in **drei Dichten**: vor Beginn dicht (`murmur`), in der Pause
laut (`murmurBreak`), während der Vorlesung leise (`murmurQuiet`); Regen in **zwei Stärken** (`rain`, `rainHeavy` wechseln alle 20–50 s);
der **Gang** vor der hinteren Tür ist gedämpft (Tiefpass 1,3 kHz) und wird beim Öffnen der Tür für 3 s lauter und hell (`_doorSwell`).

<!-- atmo:start -->
| Schleife | Inhalt | Länge | Lautheit | True Peak | Nahtverhältnis | Naht-Pegelsprung | Größe | Pegel im Spiel | Quelle |
|---|---|---|---|---|---|---|---|---|---|
| `birds` | Herbstvögel (Freising, November) | 32 s | −22,0 LUFS | −1,2 dBTP | 0,96 ✓ | −0,7 dB (Streuung 2,1) | 269 KB | Sonne 0,26, bewölkt 0,12, nicht bei Regen | Jan Krtička (radio aporee ::: maps) – [archive.org/details/aporee_70348_82012](https://archive.org/details/aporee_70348_82012) (Public Domain Mark) |
| `corridor` | Stiegenhaus/Gang, KHM Wien | 32 s | −22,0 LUFS | −8,4 dBTP | 0,85 ✓ | 0,3 dB (Streuung 1,4) | 217 KB | hinter der Tür 0,14 (Pause/Ankommen 0,32), Tür auf: ×3 und hell | raphaelr (radio aporee ::: maps) – [archive.org/details/aporee_26981_72131](https://archive.org/details/aporee_26981_72131) (Public Domain Mark) |
| `keyboards` | Tastaturen aus 6 „Reihen“ (6 Aufnahmen geschichtet) | 30 s | −22,9 LUFS | −1,1 dBTP | 1,08 ✓ | −2,3 dB (Streuung 3,9) | 372 KB | Vorlesung 0,15, Pause 0,05 | Teto Yasha (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); russiandoll (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); unicaegames (Unicae Games) – [opengameart.org/content/keyboard-soundpack-1-typing-and-sing](https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes) (CC0) |
| `murmur` | Publikum vor Beginn (dicht) | 30 s | −22,0 LUFS | −9,7 dBTP | 1,04 ✓ | 0,8 dB (Streuung 1,1) | 237 KB | vor Beginn 0,55, Einleitung 0,15, Ende 0,45 | Spanac / Free Sounds Library – [www.freesoundslibrary.com/audience-murmur-sound-effect](https://www.freesoundslibrary.com/audience-murmur-sound-effect/) (CC BY 4.0) |
| `murmurBreak` | Uni-Cafeteria, laut und dicht | 32 s | −22,0 LUFS | −5,8 dBTP | 1,27 ✓ | −0,9 dB (Streuung 3,4) | 303 KB | Pause 0,9 | p15221004 (De Montfort University) (radio aporee ::: maps) – [archive.org/details/aporee_31068_35712](https://archive.org/details/aporee_31068_35712) (Public Domain Mark) |
| `murmurQuiet` | gedämpftes Ankommen in einer Kirche: Flüstern, Schritte, Kleidung | 32 s | −22,0 LUFS | −1,4 dBTP | 1,13 ✓ | 0,6 dB (Streuung 1,6) | 266 KB | Vorlesung 0,24–0,26 | Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `projectorFan` | Lüfter eines Kinoprojektors | 25 s | −22,0 LUFS | −9,6 dBTP | 1,28 ✓ | −0,4 dB (Streuung 0,5) | 266 KB | sobald der Beamer läuft (0,25, am Projektor) | La Fonderie / Work With Sounds – [soundsofchanges.eu/sound/fan-cinema-projector](http://soundsofchanges.eu/sound/fan-cinema-projector/) (CC BY 4.0) |
| `rain` | leichter Regen am Fenster | 40 s | −22,0 LUFS | −1,0 dBTP | 0,60 ✓ | 1,1 dB (Streuung 2,6) | 472 KB | Regenwetter / Regen setzt ein (0,42) | Fredrik Johansson / Work With Sounds – [soundsofchanges.eu/sound/rain-on-a-window-a-soundscape](http://soundsofchanges.eu/sound/rain-on-a-window-a-soundscape/) (CC BY 4.0) |
| `rainHeavy` | kräftiger Regen am Fenster | 32 s | −22,1 LUFS | −1,4 dBTP | 0,96 ✓ | 1,3 dB (Streuung 1,1) | 272 KB | bei Regen alle 20–50 s neu: 0 … 0,45 | theo.albaric (radio aporee ::: maps) – [archive.org/details/aporee_60048_68965](https://archive.org/details/aporee_60048_68965) (Public Domain Mark) |
| `roomTone` | Bibliothek, Ruheraum: Lüftung + leise Aktivität | 25 s | −22,1 LUFS | −4,5 dBTP | 1,49 ✓ | −0,8 dB (Streuung 1,8) | 255 KB | immer (0,1) | susanfedynak (radio aporee ::: maps) – [archive.org/details/aporee_35419_40679](https://archive.org/details/aporee_35419_40679) (Public Domain Mark) |
| `streetFar` | Straße mit Bim von innen gehört, Wien 7 | 57 s | −22,0 LUFS | −3,8 dBTP | 0,69 ✓ | 0,2 dB (Streuung 5,2) | 307 KB | fern 0,24 (Regen 0,16) | chr_friess (radio aporee ::: maps) – [archive.org/details/aporee_60629_69672](https://archive.org/details/aporee_60629_69672) (Public Domain Mark) |
| `traffic` | Straße, Wien Landstraße | 40 s | −22,0 LUFS | −5,0 dBTP | 0,96 ✓ | 0,0 dB (Streuung 1,0) | 421 KB | Fenster 0,3 (Regen 0,2) | damir.kustic (radio aporee ::: maps) – [archive.org/details/aporee_34806_40011](https://archive.org/details/aporee_34806_40011) (Public Domain Mark) |
| `ventilation` | Lüfter (Innenraum) | 40 s | −22,0 LUFS | −4,1 dBTP | 1,36 ✓ | 0,0 dB (Streuung 0,7) | 427 KB | immer (0,05) | Erik Pålsson / Work With Sounds – [soundsofchanges.eu/sound/bathroom-fan](http://soundsofchanges.eu/sound/bathroom-fan/) (CC BY 4.0) |
| `wind` | Wind im Park | 40 s | −22,0 LUFS | −1,7 dBTP | 0,71 ✓ | 0,5 dB (Streuung 1,3) | 415 KB | nicht bei Sonne (0,12) | Thimras – [opengameart.org/content/park-ambiences](https://opengameart.org/content/park-ambiences) (CC0) |
| `music` | „Almost Bliss“ (Kevin MacLeod) | 160 s | −22,0 LUFS | −8,4 dBTP | 0,26 ✓ | −2,1 dB (Streuung 1,7) | 2376 KB | nur Menüs | Kevin MacLeod – [incompetech.com/music/royalty-free/index.html?isrc=USUAN1900](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900015) (CC BY 4.0) |
<!-- atmo:end -->

**Pegel im Spiel:** Lüftung und Raumton sind gegenüber v2 deutlich leiser (0,05 / 0,1 statt 0,25 / 0,35), Gemurmel und Tastaturen während
der Vorlesung 0,25 / 0,15: Als echte Aufnahmen tragen sie den Raum schon leise, und so liegen die Hinweisgeräusche darüber.
Gemessen mit der Offline-Mischung (Platz Reihe 5, siehe Hörprobe): Raumbett ≈ −38 dB (breitbandig, Effektivwert), im Band 2–8 kHz
liegen die Spitzen von Kreide, Husten, Tür und Schritten 5–9 dB über dem Bett. Die Kreide (Spielmechanik: endet das Kratzen, dreht
sich der Prof um), Schritte und Schwamm stehen dafür 3–4 dB über dem Pegel des früheren synthetischen Klangs (`LEVEL_TRIM_DB`).

## Einmal-Klänge (Foley)

Mono, Hochpass 60 Hz, bei hörbarem Grundrauschen (> −58 dBFS) FFT-Entrauschen, Ereignis automatisch eingegrenzt (wenn kein Schnittfenster
angegeben ist), Expander und Pausen-Gate (bei Atem-/Stimmgeräuschen wie Gähnen, Niesen, Husten ein zweites, strengeres Gate),
Stille an Anfang/Ende auf ≤ 80 ms gekürzt, kurze Ein-/Ausblendung, Spitze −2 dBFS (Reserve für den Kodierer; danach wird nachgemessen:
True Peak ≤ −1 dBTP, sonst leiser und neu kodiert). Opus 64 kbit/s, 48 kHz. Varianten werden im Spiel zufällig gewählt, mit ±3 %
Tonhöhe (`vary`). **Pegel:** Jeder Klang bekommt einen Faktor (`gain`), der ihn auf den Spitzenpegel des früheren synthetischen
Klangs bringt; neue Klänge ohne Vorgänger orientieren sich an einem vergleichbaren (Niesen wie Husten, Besteck wie Glas …, `LEVEL_LIKE`).

**Geschichtet (alles echte Aufnahmen, nur gemischt):**
- `laughSmall` / `laughMid` / `laughBig` – Gruppen-Lachen in drei Stärken aus 3 / 6 / 10 einzelnen echten Lachern (15 Ausschnitte von
  8 Aufnahmen, je ±7 % Abspielrate, Einsatz bis 0,35/0,6/0,9 s gestreut, Panorama, ein Teil dumpfer wie aus hinteren Reihen), je
  3 Varianten. Im Spiel: `AudioEngine.laughCrowd()` bei jeder Pointe (Ereignis `laugh`), Stärke zufällig gewichtet (45/41/14 %),
  dazu 1–3 einzelne Lacher an Plätzen. Ein frei lizenziertes Saalpublikum, das lacht, gab es nicht.
- `keyboards` – Tastaturen aus mehreren Reihen: sechs Tipp-Aufnahmen, je eine „Reihe“ mit eigenem Pegel, Panorama und Tiefpass
  (nah 9 kHz … ganz hinten 2 kHz), mit Tipp-Phasen und Pausen.

**Raumgeräusche einzelner Studierender** wählt `AudioEngine.crowdFoley(phase)` gewichtet nach Phase (Vorlesung: Husten, Räuspern, Niesen,
Gähnen, Knarzen, Blättern, Kuli, Textmarker, Zettel, Reißverschluss, Becher, selten Handy und „Pscht“; Pause: Apfel, Besteck, Becher,
Rucksack, Laptop zu, Lachen; Ankommen/Ende: Rucksack, Reißverschluss, Klappsitz, Laptop), mit passender Höhe (Pult, Sitz, Kopf).

<!-- clips:start -->
| Klang | Dateien | Verwendung im Spiel | Herkunft (Urheber:in – Seite, Lizenz) |
|---|---|---|---|
| `appleBite` | 4 | Apfel/Knabbern (Pause) | AntumDeluge (nach Freesound #333825, CC0) – [opengameart.org/content/apple-bite](https://opengameart.org/content/apple-bite) (CC0); StarNinjas (aufgenommen von Tito) – [opengameart.org/content/7-eating-crunches](https://opengameart.org/content/7-eating-crunches) (CC0) |
| `bag` | 3 | Rucksack/Tasche: Ankommen, Pause, Gehen | spookymodem – [opengameart.org/content/inventory-bag](https://opengameart.org/content/inventory-bag) (CC BY 3.0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); OwlishMedia – [opengameart.org/content/202-more-sound-effects](https://opengameart.org/content/202-more-sound-effects) (CC0) |
| `bird` | 4 | Vögel bei Sonne (einzeln), Menü | isaiah658 – [opengameart.org/content/ambient-bird-sounds](https://opengameart.org/content/ambient-bird-sounds) (CC0); IgnasD – [opengameart.org/content/crows-singing](https://opengameart.org/content/crows-singing) (CC0); chr_friess (radio aporee ::: maps) – [archive.org/details/aporee_60623_69666](https://archive.org/details/aporee_60623_69666) (Public Domain Mark); Spanac / Free Sounds Library – [www.freesoundslibrary.com/birds-singing-in-a-peaceful-park-s](https://www.freesoundslibrary.com/birds-singing-in-a-peaceful-park-sound-effect/) (CC BY 4.0) |
| `boardSlide` | 2 | Tafel schieben; Jalousie | Spanac / Free Sounds Library – [www.freesoundslibrary.com/sliding-door-sounds](https://www.freesoundslibrary.com/sliding-door-sounds/) (CC BY 4.0); Varkalandar – [opengameart.org/content/rockmetal-slide](https://opengameart.org/content/rockmetal-slide) (CC BY 4.0) |
| `bottleDrop` | 1 | Ereignis Flasche fällt | Stilgar (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `breath` | 2 | Atem bei Stress ≥ 0,7 | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `chairCreak` | 3 | Saal; eigener Sitz bei schnellem Umdrehen | earthcalling (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); Museum of Municipal Engineering / Work With Sounds – [soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-](http://soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-bench/) (CC BY 4.0); laleksic – [opengameart.org/content/various-sound-effects](https://opengameart.org/content/various-sound-effects) (CC0) |
| `chalkScratch` | 2 | Prof: Kreidestrich an der Tafel (Ende = Prof dreht sich um) | La Fonderie / Work With Sounds – [soundsofchanges.eu/sound/chalk](http://soundsofchanges.eu/sound/chalk/) (CC BY 4.0) |
| `chalkTap` | 2 | Prof: Kreide-Tupfer synchron zum Strich (auch Klopfen an der Vordertür) | La Fonderie / Work With Sounds – [soundsofchanges.eu/sound/chalk](http://soundsofchanges.eu/sound/chalk/) (CC BY 4.0) |
| `clicker` | 2 | Folienwechsel, Beamer ein/aus | 1j01 (Isaiah Odhner) – [opengameart.org/content/middle-mouse-click](https://opengameart.org/content/middle-mouse-click) (CC0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `cloth` | 3 | Saal; eigene Bewegung, Kopfhörer | OwlishMedia – [opengameart.org/content/202-more-sound-effects](https://opengameart.org/content/202-more-sound-effects) (CC0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `cough` | 4 | Saal (zufällig), Hustenanfall | AntumDeluge (Jordan Irwin) – [opengameart.org/content/old-man-cough](https://opengameart.org/content/old-man-cough) (CC0); Stilgar (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); frosty ham – [opengameart.org/content/sick-noises](https://opengameart.org/content/sick-noises) (CC0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `coughHigh` | 3 | Hustenanfall (helle Stimme) | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); Spanac / Free Sounds Library – [www.freesoundslibrary.com/coughing-sound-effect](https://www.freesoundslibrary.com/coughing-sound-effect/) (CC BY 4.0) |
| `cupDown` | 3 | Becher abstellen (Saal, Pause) | TinyWorlds – [opengameart.org/content/cutlery-sounds](https://opengameart.org/content/cutlery-sounds) (CC0); Nicole Marie T (OGA: Dogoso) – [opengameart.org/content/cup-on-table-sfx-sound-effect](https://opengameart.org/content/cup-on-table-sfx-sound-effect) (CC BY 4.0); rubberduck – [opengameart.org/content/100-cc0-sfx](https://opengameart.org/content/100-cc0-sfx) (CC0) |
| `cutlery` | 4 | Besteck (Pause, Jause am Platz) | TinyWorlds – [opengameart.org/content/cutlery-sounds](https://opengameart.org/content/cutlery-sounds) (CC0); Thore (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `doorBang` | 2 | Ereignis Tür knallt | qubodup (Iwan Gabovitch) – [opengameart.org/content/door-open-door-close-set](https://opengameart.org/content/door-open-door-close-set) (CC0) |
| `doorClose` | 3 | Spätkommer:in | qubodup (Iwan Gabovitch) – [opengameart.org/content/door-open-door-close-set](https://opengameart.org/content/door-open-door-close-set) (CC0); Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `doorOpen` | 2 | Spätkommer:in, Tutorin (öffnet kurz den Gang); Klopfen (schneller abgespielt) | qubodup (Iwan Gabovitch) – [opengameart.org/content/door-open-door-close-set](https://opengameart.org/content/door-open-door-close-set) (CC0); Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `glass` | 3 | Prof trinkt | rubberduck – [opengameart.org/content/100-cc0-sfx](https://opengameart.org/content/100-cc0-sfx) (CC0); Nicole Marie T (OGA: Dogoso) – [opengameart.org/content/cup-on-table-sfx-sound-effect](https://opengameart.org/content/cup-on-table-sfx-sound-effect) (CC BY 4.0) |
| `good` | 1 | richtige Quizantwort | abgeleitet: Kevin MacLeod – [incompetech.com/music/royalty-free/index.html?isrc=USUAN1100](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100241) (CC BY 4.0) |
| `heart` | 1 | Herzschlag bei Stress ≥ 0,45 | abgeleitet: ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `highlighter` | 3 | Saal (Textmarker) | Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `hinge` | 1 | Laptopdeckel bewegen; Saal (Ankommen) | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `keyClick` | 3 | eigenes Tippen am Laptop, Alt-Tab, Helligkeit | unicaegames (Unicae Games) – [opengameart.org/content/keyboard-soundpack-1-typing-and-sing](https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes) (CC0); Erik Pålsson / Work With Sounds – [soundsofchanges.eu/sound/computer-work-at-home](http://soundsofchanges.eu/sound/computer-work-at-home/) (CC BY 4.0) |
| `laughBig` | 3 | Gruppen-Lacher laut | geschichtet aus ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); AntumDeluge (Jordan Irwin) – [opengameart.org/content/old-man-cough](https://opengameart.org/content/old-man-cough) (CC0); Supergeek – [opengameart.org/content/do-you-remember-laughter](https://opengameart.org/content/do-you-remember-laughter) (CC0); Nocturnal_Vanguard (AuraVoice) – [opengameart.org/content/group-giggling](https://opengameart.org/content/group-giggling) (CC0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `laughMid` | 3 | Gruppen-Lacher mittel | geschichtet aus ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); Nocturnal_Vanguard (AuraVoice) – [opengameart.org/content/group-giggling](https://opengameart.org/content/group-giggling) (CC0); AntumDeluge (Jordan Irwin) – [opengameart.org/content/old-man-cough](https://opengameart.org/content/old-man-cough) (CC0); Supergeek – [opengameart.org/content/do-you-remember-laughter](https://opengameart.org/content/do-you-remember-laughter) (CC0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `laughSmall` | 3 | Gruppen-Lacher leise (Pointe des Profs) | geschichtet aus ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); Supergeek – [opengameart.org/content/do-you-remember-laughter](https://opengameart.org/content/do-you-remember-laughter) (CC0); Nocturnal_Vanguard (AuraVoice) – [opengameart.org/content/group-giggling](https://opengameart.org/content/group-giggling) (CC0) |
| `laughSoft` | 3 | einzelne Lacher (Pointe, Pause) | Nocturnal_Vanguard (AuraVoice) – [opengameart.org/content/group-giggling](https://opengameart.org/content/group-giggling) (CC0); ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `lidClose` | 1 | Laptop zuklappen (Saal: Ankommen/Pause) | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `micFeedback` | 1 | Ereignis Rückkopplung | abgeleitet: Museum of Municipal Engineering / Work With Sounds – [soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-](http://soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-bell-recorded-from-the-outside/) (CC BY 4.0) |
| `micThump` | 2 | Mikrofon beim Start | ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `murmurBurst` | 2 | (Vorrat) | Spanac / Free Sounds Library – [www.freesoundslibrary.com/audience-murmur-sound-effect](https://www.freesoundslibrary.com/audience-murmur-sound-effect/) (CC BY 4.0); jerrypadfield (radio aporee ::: maps) – [archive.org/details/aporee_36189_41517](https://archive.org/details/aporee_36189_41517) (Public Domain Mark) |
| `pageTurn` | 3 | Saal; Anwesenheitsliste; Spickzettel im Quiz | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); Nicole Marie T (OGA: Dogoso) – [opengameart.org/content/page-turning-sfx-sound-effect](https://opengameart.org/content/page-turning-sfx-sound-effect) (CC BY 4.0); laleksic – [opengameart.org/content/various-sound-effects](https://opengameart.org/content/various-sound-effects) (CC0) |
| `paperTear` | 4 | Saal (Zettel abreißen) | Luckius – [opengameart.org/content/various-paper-sound-effects](https://opengameart.org/content/various-paper-sound-effects) (CC0); Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `penClick` | 2 | Saal | Nicole Marie T (OGA: Dogoso) – [opengameart.org/content/pen-click-sfx-sound-effect](https://opengameart.org/content/pen-click-sfx-sound-effect) (CC BY 4.0); Stilgar (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `penWrite` | 3 | Mitschreiben (Heft), Unterschrift; Saal | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `phoneRing` | 2 | Ereignis Handy klingelt | Spanac / Free Sounds Library – [www.freesoundslibrary.com/phone-ring-sound-effect](https://www.freesoundslibrary.com/phone-ring-sound-effect/) (CC BY 4.0); Spanac / Free Sounds Library – [www.freesoundslibrary.com/old-cell-phone-ringing-sound-effec](https://www.freesoundslibrary.com/old-cell-phone-ringing-sound-effect/) (CC BY 4.0) |
| `phoneVibrate` | 3 | eigenes Handy vibriert; Saal (selten) | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); Spanac / Free Sounds Library – [www.freesoundslibrary.com/vibrating-sound](https://www.freesoundslibrary.com/vibrating-sound/) (CC BY 4.0) |
| `pour` | 1 | (Vorrat, derzeit ohne Ereignis) | Spanac / Free Sounds Library – [www.freesoundslibrary.com/pouring-water](https://www.freesoundslibrary.com/pouring-water/) (CC BY 4.0) |
| `quizSting` | 1 | Quiz kündigt sich an | abgeleitet: Kevin MacLeod – [incompetech.com/music/royalty-free/index.html?isrc=USUAN1100](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100241) (CC BY 4.0) |
| `seatFlip` | 2 | Saal (Klappsitz), Ankommen | La Fonderie / Work With Sounds – [soundsofchanges.eu/sound/cinema-seat](http://soundsofchanges.eu/sound/cinema-seat/) (CC BY 4.0) |
| `shush` | 3 | „Pscht“ im Saal (selten) | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); jdagenet (Jason Dagenet) – [opengameart.org/content/no-talking-in-the-library](https://opengameart.org/content/no-talking-in-the-library) (CC BY 3.0) |
| `sneeze` | 5 | Saal (zufällig, Vorlesung/Pause) | qubodup (Iwan Gabovitch) – [opengameart.org/content/genuine-sneeze-sound](https://opengameart.org/content/genuine-sneeze-sound) (CC0); Jc (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); zarokima – [opengameart.org/content/sneeze](https://opengameart.org/content/sneeze) (CC0); ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `sponge` | 2 | Prof wischt die Tafel | La Fonderie / Work With Sounds – [soundsofchanges.eu/sound/wet-sponge-2](http://soundsofchanges.eu/sound/wet-sponge-2/) (CC BY 4.0) |
| `stepCarpet` | 2 | (Vorrat, derzeit ohne Ereignis) | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); Stephan (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `stepParquet` | 3 | Schritte des Profs auf Podest/Parkett | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); Torsten Nilsson / Work With Sounds – [soundsofchanges.eu/sound/creaking-floors](http://soundsofchanges.eu/sound/creaking-floors/) (CC BY 4.0); Kenney (kenney.nl) – [opengameart.org/content/50-rpg-sound-effects](https://opengameart.org/content/50-rpg-sound-effects) (CC0) |
| `stepStair` | 2 | Schritte auf den Stufen (Prof, Spätkommer:in) | Torsten Nilsson / Work With Sounds – [soundsofchanges.eu/sound/stairwell](http://soundsofchanges.eu/sound/stairwell/) (CC BY 4.0); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `sting` | 1 | Erwischt; falsche Quizantwort | abgeleitet: Kevin MacLeod – [incompetech.com/music/royalty-free/index.html?isrc=USUAN1100](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100241) (CC BY 4.0) |
| `throatClear` | 1 | Prof bei Abschnittswechsel; Saal | ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain) |
| `touchpad` | 2 | Touchpad/Laptop-Klicks | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0); 1j01 (Isaiah Odhner) – [opengameart.org/content/middle-mouse-click](https://opengameart.org/content/middle-mouse-click) (CC0) |
| `tramBell` | 3 | Straßenbahn hält am Linnéplatz | Museum of Municipal Engineering / Work With Sounds – [soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-](http://soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-bell-recorded-from-the-outside/) (CC BY 4.0); Museum of Municipal Engineering / Work With Sounds – [soundsofchanges.eu/sound/the-sn4-type-tram-the-bell-recorded](http://soundsofchanges.eu/sound/the-sn4-type-tram-the-bell-recorded-from-the-outside/) (CC BY 4.0); Museum of Municipal Engineering / Work With Sounds – [soundsofchanges.eu/sound/the-n-tram-the-bell-recorded-from-t](http://soundsofchanges.eu/sound/the-n-tram-the-bell-recorded-from-the-outside/) (CC BY 4.0) |
| `ttPlace` | – | Tic-Tac-Toe-Feld setzen (= Tastenanschlag) | = Aufnahmen von `keyClick` |
| `uiClick` | – | Menü-Klicks (= Touchpad-Aufnahme) | = Aufnahmen von `touchpad` |
| `yawn` | 4 | Saal (Vorlesung) | ezwa (pdsounds.org) – [pdsounds.tuxfamily.org/list.html](https://pdsounds.tuxfamily.org/list.html) (Public Domain); OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
| `zipper` | 1 | Saal; Studierende verlassen den Saal | OwlishMedia – [opengameart.org/content/sound-effects-pack](https://opengameart.org/content/sound-effects-pack) (CC0) |
<!-- clips:end -->

**Nicht gefunden (frei lizenziert, ohne Schlüssel):** unverständliches **Flüstern** in zwei Sprachen als Einzelaufnahme – Flüstern ist
nur in der Atmosphäre `murmurQuiet` enthalten (gedämpftes Ankommen in einer Kirche), dazu „Pscht“ (`shush`). **Vögel aus Wien im Herbst**
gab es nicht mit freier Lizenz: verwendet sind Herbstvögel aus Freising (Bayern, November 2025); die Wiener Aufnahmen (Josef-Strauß-Park,
Schweizergarten) sind aus dem Frühjahr. Flasche und Kaffeebecher: `bottleDrop` (Ereignis) und `cupDown`; ein eigener „Flasche öffnen“-Klang
hätte kein Ereignis im Spiel.

## Pipeline

1. **Quellen** – `tools/pipeline/audio_sources.json` (alle Kandidaten mit Seite, Lizenz, Urheber:in, Schnittfenster, Qualität, SHA-256),
   Recherche der ersten Runde in `docs/AUDIO_QUELLEN.md`. Laden und Prüfen: `tools/.venv/bin/python -I tools/audio/fetch_sfx.py`
   (jede Datei in einem eigenen Ordner unter `assets/src/audio/`, Prüfsumme festgehalten, aus Archiven nur das genannte Mitglied nach
   Pfadprüfung entpackt; neue Kandidaten mit `--add neu.json`). Nur CC0, Public Domain (auch Public Domain Mark) und CC BY.
   Neu in dieser Runde: OpenGameArt (Niesen, Apfel, Knuspern, Besteck, Papier reißen, Tasche, „Pscht“), pdsounds (Niesen, Gähnen,
   Besteck, Papier, Filzstift, Tippen, Kirche vor der Messe, Lacher), archive.org/radio aporee (Herbstvögel Freising, KHM Wien,
   St. Laurenz Wien 7 mit Straßenbahn, Cafeteria Leicester, Toulon-Regen), Zenodo (Impulsantworten).
2. **Hall** – `tools/.venv-ir/bin/python -I tools/audio/extract_ir.py` (SOFA → zwei WAV-Dateien).
3. **Aufbereitung** – `nice -n 10 tools/.venv/bin/python -I tools/audio/build_sfx.py [--only name,…]` → `assets/build/sfx/*.ogg`,
   `manifest.json` (Dateien, Schleife, Pegelfaktor, Herkunft je Datei), `docs/audio/check.json` (Messwerte der fertigen, dekodierten Dateien;
   `--measure` misst nur neu).
4. **Prüfung** – `node tools/audio-check.mjs` (läuft in `npm test`): True Peak ≤ −1 dBTP, 0 übersteuerte Samples, 48 kHz,
   Atmosphären −24 … −20 LUFS und ≥ 20 s, Nahtverhältnis < 2, ≥ 12 Atmosphären-Schleifen, ≥ 120 Clips, echte Impulsantwort vorhanden,
   ≤ 5 synthetische UI-Töne; Hinweise bei Rauschen in Pausen > −60 dBFS und Stille > 80 ms.
5. **Dokumentation** – `node tools/audio/audio-doc.mjs` (Tabellen dieser Datei), `node tools/pipeline/assets-doc.mjs` (`docs/ASSETS.md`,
   Credits im Spiel – jede CC-BY-Aufnahme, auch die Impulsantworten).
6. **Hörproben** – `nice -n 10 tools/.venv/bin/python -I tools/audio/mix_demo.py --reels`.

**Messergebnis** (Stand dieser Datei): alle Dateien True Peak ≤ −1 dBTP, 0 übersteuert, 48 kHz; alle 14 Atmosphären −22 … −23 LUFS,
Nahtverhältnis 0,6–1,5; Stille an Anfang/Ende ≤ 80 ms bei allen Einmal-Klängen (höchstens 24 / 58 ms). Rauschen in Pausen: 26 Einmal-Klänge
haben Pausen (≥ 30 dB unter dem lautesten 50-ms-Fenster), davon 18 ≤ −60 dBFS; 8 liegen zwischen −48 und −59 dBFS – bei Gähnen, Lachen
und Atem sind das Atem-/Stimmanteile der Geste (Ausklingen des Lachens, Atem zwischen zwei Gähn-Phasen), bei der Straßenbahnglocke der
Straßenraum der Aufnahme, bei Husten/Tasche Raumklang. Die Prüfung meldet sie als Hinweis, nicht als Fehler. (Eine Gähn-Aufnahme mit
langem, lautem Einatmen – Pausenpegel −41 dBFS – wurde deshalb aussortiert.)

## Hörproben (`docs/audio/`)

- **`hoersaal_mix.m4a` – 60 Sekunden Hörsaal** als **Offline-Mischung aus den ausgelieferten Dateien** (`tools/audio/mix_demo.py`):
  nachgebaut ist, was die Engine im Spiel macht – Hörer in Reihe 5 mit Blick zur Tafel, Entfernungsdämpfung wie Web Audio
  („inverse“, refDistance 1,2 m, rolloff 1,1), Gleichleistungs-Panorama nach Richtung, Hall-Send über die echten Impulsantworten (nach
  Abstand zum Pult gemischt, mit Vorverzögerung), Schleifen mit den Pegeln aus `ambience()` (Phase „Vorlesung“, bewölkt), Pegelfaktoren
  aus dem Verzeichnis, Kanalregler wie voreingestellt. Ablauf: Raumton, Lüftung, Beamer, leises Gemurmel, Tastaturen, Straße/Bim fern,
  Gang hinter der Tür; der Prof geht zur Tafel, schreibt, wischt, schaltet die Folie weiter; Husten, Niesen, Knarzen, Blättern, Kuli,
  Textmarker, Räuspern; eine Spätkommerin öffnet hinten die Tür (der Gang wird hörbar), Schritte die Stufen hinunter, Tür fällt zu,
  Klappsitz, Rucksack; Gähnen, Zettel, Reißverschluss; ein Lacher im Saal; eigenes Tippen, Mitschreiben, Handy vibriert.
  **Keine Stimmen.** Am Ende −20 LUFS, True Peak ≤ −1 dBTP, AAC 160 kbit/s. Ein Headless-Mitschnitt des Spiels war nicht möglich
  (Chromium headless hat keine Tonausgabe); die Offline-Mischung verwendet dieselben Dateien, Pegel und Raumdaten.
- **`foley_beispiele.m4a`** – 20 Foley-Clips und ein Gruppen-Lacher hintereinander (je auf gleiche Spitze gebracht, trocken).
- **`atmo_beispiele.m4a`** – 8 Atmosphären je 7 s (Raumton, leises Gemurmel, Pause, Tastaturen, Starkregen, Herbstvögel, Gang, ferne Straße).
- Stimme: `docs/audio/beispiele/` (siehe unten).

## Grenzen

- **Nicht angehört.** Im Container gibt es keine Tonausgabe: Schnitte, Pegel, Nähte und Rauschen sind gemessen, nicht gehört.
  Die Schnittfenster neuer Quellen sind aus Pegel-/Spektralverläufen gewählt. Vor der Auslieferung einmal die Hörproben anhören.
- Die Impulsantworten stammen aus einem realen, aber anderen Hörsaal (TU Berlin, mittelgroß); HS 31 ist kleiner. Der Hallanteil ist
  auf die frühere Lautheit kalibriert.
- Flüstern als Einzelklang und Wiener Herbstvögel fehlen (siehe oben). Einige Quellen sind nur als MP3 verfügbar (pdsounds, Work With Sounds).
- Browser-Sprachausgabe und die frühere Notlösung „Murmeln“ sind entfernt (Auftraggeber: keine Computerstimme). Fehlt eine
  Aufnahme, erscheint nur der Untertitel.

## Stimme in Version 3 (vorgerendert, keine Computerstimme mehr)

**Stufe laut Auftrag (Anhang E):** Ohne API-Schlüssel gilt Stufe 2 – ein offenes Modell mit menschlicher Qualität, im Batch auf
der CPU vorgerendert. Es gibt keine Browser-Sprachausgabe und kein synthetisches Murmeln mehr; die Einstellung kennt nur
„Echte Stimme“ und „Aus“. Fehlt eine Aufnahme, bleibt es beim Untertitel.

**Sprache:** Laut Auftraggeber reicht Deutsch – Deutsch wird vollständig vertont, Englisch bleibt als Textfassung mit den
vorhandenen Kokoro-Aufnahmen (der Großteil der Prof-Sätze, Rest als Untertitel).

**Modell:** Coqui XTTS v2 (CPML, nicht-kommerziell) mit eingebauten, synthetischen Studiosprechern – keine geklonte reale Person.

**Auswahl** (Prüfsätze aus `tools/voice/eval_tts.py`, objektiv bewertet, weil im Container nicht gehört werden kann):
Rückerkennung mit faster-whisper (Wortfehlerrate, WER), Signalqualität ohne Referenz mit torchaudio SQUIM (PESQ/STOI/SI-SDR),
Grundfrequenz (Stimmlage).

| Sprecher | Sprache | WER | PESQ (geschätzt) | STOI | SI-SDR | Grundfrequenz | Echtzeitfaktor (CPU) |
|---|---|---|---|---|---|---|---|
| **Damien Black** (gewählt: Prof) | de | **0,083** | 4,02 | 0,995 | 25,3 dB | **≈ 90 Hz** (tief, reif) | 1,76 |
| Baldur Sanjin | de | 0,161 | 3,65 | 0,994 | 24,5 dB | ≈ 94 Hz | 1,88 |
| Ludvig Milivoj | de | 0,165 | 3,96 | 0,995 | 24,4 dB | ≈ 111 Hz | 1,80 |
| Viktor Menelaos | de | 0,292 | 3,91 | 0,997 | 25,7 dB | ≈ 117 Hz | – |
| Damien Black | en | 0,088 | 3,82 | 0,996 | 24,6 dB | – | 1,78 |

**Englisch: Kokoro-82M** (Apache-2.0, eingebaute synthetische Stimmen). Gleiche Prüfsätze, gleiche Bewertung. Kokoro klingt im
Englischen natürlicher und rechnet rund zehnmal schneller als XTTS (Echtzeitfaktor ≈ 0,2 ohne Last, ≈ 0,9 bei voll belasteter CPU).
Deutsch kann Kokoro nicht; dafür bleibt XTTS.

| Stimme (Kokoro) | WER | PESQ (geschätzt) | STOI | SI-SDR |
|---|---|---|---|---|
| **bm_daniel** (gewählt: Prof, britisch) | **0,042** | **3,97** | 0,997 | 27,7 dB |
| am_michael (gewählt: Student, amerikanisch) | 0,054 | 3,87 | 0,996 | 26,1 dB |
| bm_lewis | 0,054 | 3,61 | 0,996 | 23,4 dB |
| bm_george | 0,042 | 3,42 | 0,993 | 26,4 dB |
| am_onyx | 0,042 | 2,90 | 0,963 | 15,5 dB |
| bm_fable | 0,042 | 2,79 | 0,962 | 13,6 dB |

Nebenstimmen Deutsch (XTTS): Nachbarin „Daisy Studious“, Studierende „Sofia Hellen“ / „Andrew Chipper“ (je nach Figur).
Nebenstimmen Englisch (Kokoro): Nachbarin „bf_emma“, Studentin „af_heart“, Student „am_michael“.
Grenze: XTTS spricht Standarddeutsch, keine österreichische Färbung. Mit `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`
(Umgebungsvariablen der Cloud-Umgebung) kann `tools/voice/render.py` auf Azure „de-AT-JonasNeural“ umgestellt werden.

**Ablauf:** `node tools/voice/corpus.mjs` (alle gesprochenen Sätze, Platzhalter-Sätze in Stücke geteilt) →
`tools/.venv/bin/python tools/voice/render.py --lang de` bzw. `tools/.venv-kokoro/bin/python tools/voice/render_kokoro.py` (Sprechfassung über `tools/voice/normalize.py`: Zahlen, Einheiten und
Fachabkürzungen ausgeschrieben, z. B. „6,2 MJ NEL je kg TM“ → „sechs Komma zwei Megajoule en-e-el je Kilogramm Trockenmasse“) →
Mastering je Clip mit ffmpeg (`tools/voice/master.py`, für beide Modelle gleich): Hochpass 80 Hz, De-Esser-Absenkung, Stille ≤ 80 ms, Lautheit −16 LUFS (zweistufig), True Peak
−1,5 dBTP, 48 kHz, Opus 28 kbit/s mono; Lautstärkekurve 20 Hz für die Mundbewegung → `assets/build/voice/<sprache>/`.
Im Spiel (`src/audio/voice.js`): Aufnahme über ihre Kennung finden, Stücke mit 60 ms Abstand aneinanderreihen, räumlich am Kopf
der Figur abspielen, Hall aus dem Raum. Mund: Aus dem gesprochenen Text entsteht eine Lautfolge (`src/chars/visemes.js`), über die
Lautstärkekurve zeitlich verteilt; Prof, Nachbarin und Tutorin zeigen sie mit den Rocketbox-Visemes (15 Mundformen als
Gesichtsformen), Studierende über den Kieferknochen. Der Ablauf schätzt Sprechdauern mit dem gemessenen Tempo der Aufnahmen
(Deutsch 0,081 s/Zeichen, Englisch 0,048) und wartet zusätzlich auf das Ende jeder Aufnahme.

**Arbeitsweise bei langen Läufen:** `VOICE_OUT=tools/.cache/voice/out` lässt `render.py` außerhalb des Repositorys schreiben;
`python3 -I tools/voice/sync.py` übernimmt die fertigen Aufnahmen gebündelt nach `assets/build/voice/de/`.
Hörproben: `python3 -I tools/voice/samples.py` → `docs/audio/beispiele/` (30 Prof-Sätze je Sprache als AAC + `TRANSKRIPT.md`).
