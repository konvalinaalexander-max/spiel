# Audio – Kanäle, Klangquellen, Prüfung

Alle Klänge werden beim Laden **prozedural synthetisiert** (`src/audio/synth.js`, `OfflineAudioContext`) –
es gibt keine Audiodateien im Build. Wiedergabe, Mischung und Raumklang macht `src/audio/engine.js` (Web Audio API).

## Mixer (Einstellungen › Ton, gespeichert in `localStorage`)

| Kanal (Bus) | Regler | Inhalt | Besonderheiten |
|---|---|---|---|
| **Master** | Gesamtlautstärke | alles | Kompressor (Schwelle −14 dB, 3:1) gegen Spitzen |
| **Stimme** (`voice`) | Stimme | Prof (Murmel-Synthese), Nebenstimmen (Nachbarin, Tutorin, Studierende) | Tiefpass `voiceLP`: am Laptop 20 kHz → 2,4 kHz, mit Kopfhörern 700 Hz |
| **Effekte** (`sfx`) | Effekte | Raumklänge (über `roomBus`), eigene Geräusche (`player`) | Raumklänge laufen durch `roomLP` (Dämpfung am Laptop/mit Kopfhörern) und den Hall-Send |
| **Raumklang** (`amb`) | Raumklang | Lüftung, Raumton, Gemurmel, Verkehr, Regen, Wind, Beamerlüfter | nahtlose Loops (siehe unten) |
| **Musik** (`music`) | Musik (Menü) | generatives Menü-Thema „Campus am Morgen“ (Am7–Fmaj7–Dm7–G7sus, Dreiecks-Pads, Arpeggien, Vögel) | nur in Menüs, im Hörsaal aus (Realismus) |
| **UI** (`ui`) | folgt Effekte × 0,9 | Klicks, Quiz-/Erwischt-Stich, Richtig/Falsch | – |

Die **Sprachausgabe des Browsers** (Web Speech API) lässt sich technisch nicht in den Web-Audio-Graph routen.
Ihre Lautstärke wird deshalb pro Satz gesetzt: `Master × Stimme × (1 − 0,45 × Laptop-Dämpfung)`, mit Kopfhörern × 0,35.
Stimmwahl: de-AT bevorzugt, dann de-DE, de-CH, de; im englischen Modus en-GB, en-IE/AU, en-US. Tempo einstellbar (×0,7–1,4).
Ohne Sprachausgabe (oder auf Wunsch) spricht der Prof mit einer **formantgefilterten Murmel-Synthese**, räumlich
(HRTF-Panner am Kopf des Profs) und mit Hall. Untertitel gibt es immer.

## Raum

- **Nachhall:** `ConvolverNode` mit generierter Stereo-Impulsantwort (`makeImpulse`): RT60 1,15 s (HS 31: ca. 110 m², 4 m Raumhöhe, Holz und Parkett),
  18 ms Vorverzögerung, sechs frühe Reflexionen (11–57 ms, Wände/Decke), Höhendämpfung mit der Zeit.
- **Positionierung:** `PannerNode` (equalpower, Stimmen HRTF), inverse Abstandsdämpfung, Hörer = Kamera (Position + Blickrichtung pro Bild).
- **Laptop-Fokus:** Beim Blick auf den Laptop wird der Raum dumpfer (`setMuffle`), mit Kopfhörern deutlich (Prof-Hinweise wie das Ende des Kreidekratzens sind dann schlechter hörbar – bewusst).

## Klangquellen (55 synthetisierte Klänge, 7 Loops)

| Gruppe | Klänge | Wo im Spiel |
|---|---|---|
| Prof | `stepParquet` (4 Varianten), `stepStair` (2), `chalkTap` (4), `chalkScratch`, `sponge`, `boardSlide`, `clicker`, `micThump`, `micFeedback`, `glass`, `pour`, `throatClear` | Schritte je Untergrund (Podest/Parkett vs. Stufen), Kreide synchron zum Strich, Wischen, Tafel schieben, Folienwechsel, Mikrofon beim Start, Trinken, Räuspern bei Abschnittswechsel |
| Saal | `cough` (3), `coughHigh` (2), `chairCreak` (3), `seatFlip`, `pageTurn`, `penClick`, `zipper`, `cloth`, `keyClick` (5), `penWrite`, `laughSoft`, `phoneRing`, `bottleDrop`, `doorOpen`, `doorClose`, `doorBang` | zufälliger Raumklang-Planer (alle 1–5 s eine Quelle an einer zufälligen Person), Tippen der Laptop-Studierenden, Ereignisse (Handy, Tür, Flasche, Hustenanfall, Lachen) |
| Draußen | `bird` (4), `tramBell`; Loops `traffic`, `rain`, `wind` | Vögel bei Sonne, Klingel wenn ein Bus am Linnéplatz hält, Regen/Wind je Wetter |
| Spieler | `keyClick`, `touchpad`, `hinge`, `lidClose`, `penWrite`, `heart`, `breath`, `cloth`, `phoneVibrate`, `notify` | Laptop-Bedienung, Deckelwinkel, Mitschreiben, Herzschlag ab Stress 0,45 (Tempo steigt mit Stress), Atem ab 0,7, Stoffrascheln/Sitzknarzen bei schnellem Umdrehen |
| Spiele/UI | `ttPlace`, `ttWin`, `ttLose`, `snakeEat`, `snakeDie`, `sting`, `quizSting`, `good`, `uiClick` | Tic Tac Toe, Snake, Quiz, Erwischt |
| Loops | `ventilation` (8 s), `projectorFan` (6 s), `roomTone` (10 s), `murmur` (9 s), `rain` (8 s), `wind` (10 s), `traffic` (12 s) | Grundgeräusch; Gemurmel lauter in der Pause; Beamerlüfter positioniert am Projektor |

## Loop-Nahtprüfung (kein Klick/Knacken)

Loops werden mit Überlänge gerendert und das Ende per **Gleichleistungs-Crossfade** in den Anfang geblendet (`renderLoop(len, xf, fn)`).
Geprüft wird im echten Build (Headless-Browser, `node tools/e2e.mjs --steps audiotest`, Funktion `window.__loopTest()`):
Sprung an der Nahtstelle `|x[N−1] − x[0]|` im Verhältnis zur mittleren Sample-Differenz der ganzen Datei.
Ein Verhältnis um 1 heißt: die Naht ist nicht von einem normalen Sample-Schritt zu unterscheiden. Kriterium: < 4.

| Loop | Länge | RMS | mittl. Schritt | Nahtsprung | Verhältnis | Ergebnis |
|---|---|---|---|---|---|---|
| ventilation | 8 s | 0,156 | 0,00410 | 0,00131 | 0,32 | ✓ |
| projectorFan | 6 s | 0,058 | 0,02629 | 0,00425 | 0,16 | ✓ |
| roomTone | 10 s | 0,091 | 0,00126 | 0,00119 | 0,95 | ✓ |
| murmur | 9 s | 0,030 | 0,00522 | 0,01032 | 1,98 | ✓ |
| rain | 8 s | 0,144 | 0,05937 | 0,04622 | 0,78 | ✓ |
| wind | 10 s | 0,074 | 0,00812 | 0,00726 | 0,89 | ✓ |
| traffic | 12 s | 0,117 | 0,00278 | 0,00720 | 2,59 | ✓ |

## Lautstärken (Normalisierung)

Alle Einmal-Klänge werden beim Synthetisieren in ein Spitzenpegel-Fenster von −12 … −1 dBFS normalisiert (`normalize()` in `synth.js`: zu laute werden auf −1 dBFS begrenzt, zu leise auf −12 dBFS angehoben, das Laut-leise-Design dazwischen bleibt erhalten), Loops auf ihren Zielpegel
im Mix gebracht (Lüftung 0,25, Raumton 0,35, Gemurmel 0,5 bzw. 0,95 in der Pause, Verkehr 0,2–0,3, Regen 0,4–0,45, Wind 0,12, Beamer 0,25).
Die Wiedergabelautstärke hängt zusätzlich von der Entfernung (Panner) und dem Kanalregler ab; der Master-Kompressor fängt Spitzen
(z. B. Türknall + Erwischt-Stich gleichzeitig) ab.

## Grenzen

- Die Browser-Sprachausgabe ist nicht räumlich und nicht verhallt (API-Grenze); die Murmel-Alternative ist es.
- Stimmenqualität hängt von den im Betriebssystem installierten Stimmen ab (Windows: „Microsoft Michael/Stefan“, macOS: „Yannick“/„Anna“, Android: Google-Stimmen).
- Im Headless-Test gibt es keine Audioausgabe; geprüft werden Erzeugung, Nahtstellen und die Abspiel-Aufrufe (keine Fehler in der Konsole).

## Stimme in Version 3 (vorgerendert, keine Computerstimme mehr)

**Stufe laut Auftrag (Anhang E):** Ohne API-Schlüssel gilt Stufe 2 – ein offenes Modell mit menschlicher Qualität, im Batch auf
der CPU vorgerendert. Browser-Sprachausgabe und Murmeln sind nur noch als ausdrücklich gewählte Notlösung in den Einstellungen
vorhanden; Standard ist „Echte Stimme (vorgerendert)“. Fehlt eine Aufnahme, bleibt es beim Untertitel.

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
der Figur abspielen, Hall aus dem Raum; der Kiefer des Profs folgt der Lautstärkekurve.
