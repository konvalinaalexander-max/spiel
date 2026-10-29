# Balancing

Automatisierter Test: `node tools/sim.mjs --runs 80 --difficulty all --md docs/BALANCING.md` (läuft ohne Rendering, 381 s).
Der Bot (`src/game/bot.js`, Geschick 0.5) spielt **nur mit Hinweisen, die auch ein Mensch hat**: grobe, verzögerte und verrauschte
Blickrichtung des Profs, das Ende des Kreidekratzens, Warnungen der Nachbarin, Reaktionszeit 0,40 s ± 0,1 s; er sieht
keine internen Werte (Verdacht/Beweis). Er schaltet über dieselbe API wie die Eingabe (`setMode`, `tttPlay`, `answerQuiz`, `signList`),
schreibt in ruhigen Momenten mit und beantwortet Prüfungsfragen umso besser, je länger er im jeweiligen Abschnitt zugehört hat.
Vorlesungslänge „normal“ (720 s ≙ 90 Spielminuten), Sitzplatz Reihe 5 / Platz 8, Gegner:in im Hörsaal,
80 Durchläufe je Stufe mit unterschiedlichen Seeds (Vorlesungsablauf, Besetzung, Prof-Verhalten).

## Ergebnis (Version 3)

| Stufe | Ziel (Siege) | Erfolgsquote | Erwischt pro Lauf | Rauswurf | Siege / Niederl. / Unentsch. | Quiz richtig / gestellt | Ø Note | Ø Dauer | Ø Zeit am Spiel |
|---|---|---|---|---|---|---|---|---|---|
| erstsemester | 5 | 86 % | 0,11 | 3 % | 6,90 / 2,93 / 6,64 | 2,15 / 2,59 | 1,6 | 12:28 | 230 s |
| bachelor | 6 | 54 % | 0,31 | 6 % | 5,64 / 2,98 / 6,18 | 2,51 / 3,13 | 2,8 | 12:19 | 206 s |
| pruefungswoche | 6 | 28 % | 0,64 | 10 % | 4,44 / 2,85 / 6,13 | 3,16 / 3,75 | 3,7 | 12:06 | 194 s |
| diplom | 6 | 16 % | 1,16 | 20 % | 3,66 / 2,69 / 5,15 | 2,88 / 3,83 | 4,2 | 11:27 | 168 s |

Gemessen nach der Umstellung auf das **echte Sprechtempo** der Aufnahmen (Deutsch 0,081 s/Zeichen statt geschätzt 0,064; der
Prof spricht länger, es passen weniger Takte in die Vorlesung, Pausen fallen anders). Vorher (Schätzung): 92 / 50 / 31 / 15 %.
Rohdaten: `docs/balancing_v3.json`. Version 2 zum Vergleich: Erstsemester 95 %, Bachelor 54 %, Prüfungswoche 35 %, Diplom 11 %
(`docs/balancing_final.json`).

**Warum neu abgestimmt:** Mit den neuen Prof-Texten (Anekdoten, Running Gags, Zwischenfragen) schaut Prof. Haferkorn beim Erzählen
öfter in den Saal. Der Bot hatte dadurch rund 25 % weniger Zeit am Laptop (Bachelor 226 s statt 293 s) und kam auf 34 % statt
54 %. Statt den Prof wieder stummer zu machen, sind die Siegziele kleiner (Erstsemester 6 → 5, Bachelor/Prüfungswoche 7 → 6,
Diplom 8 → 6) und die Gegner:in in Bachelor (0,48 → 0,40), Prüfungswoche (0,56 → 0,50) und Diplom (0,56 → 0,52) etwas schwächer.
Zwischenstand mit 40 Läufen: 90 / 43 / 30 / 13 %; danach Bachelor-Gegner:in 0,44 → 0,40.

Zielband laut Auftrag: **„Bachelor“ ≈ 50 %** Erfolgsquote eines mittelguten Bots. Die Stufen sind monoton gestaffelt
(leicht → sehr schwer), „Erstsemester“ ist für den Einstieg bewusst gutmütig, „Diplomand:in“ eine echte Herausforderung.
„Erfolg“ = Siegziel erreicht und nicht rausgeworfen. Kürzere Durchläufe als 12:00 entstehen durch Rauswurf.

## Parameter (Tuning-Datei `src/game/config.js`)

| Stufe | Verdachts-Multiplikator | Schulterblick alle | Vorwarnung (Kreide stoppt) | Bluff | Blick auf Spieler:in | Fixationsdauer | Drehrate | Gegner-Stärke | Nachbarin |
|---|---|---|---|---|---|---|---|---|---|
| erstsemester | 0,7 | 14–30 s | 0,65 s | 12 % | 6 % | 0,9–2,4 s | 2,6 | 0,28 | helpful |
| bachelor | 1,65 | 8–18 s | 0,31 s | 28 % | 22 % | 0,7–2,3 s | 3,8 | 0,40 | helpful |
| pruefungswoche | 1,8 | 6–15 s | 0,26 s | 33 % | 24 % | 0,5–1,7 s | 4,4 | 0,50 | neutral |
| diplom | 2,2 | 5–12 s | 0,2 s | 38 % | 24 % | 0,45–1,5 s | 5 | 0,52 | betrayer |

Weitere Größen (alle Stufen): Verdachtsmodell `src/game/suspicion.js` (Aufmerksamkeit steigt 70/s × Sichtbarkeit × Auffälligkeit, fällt 28/s;
Verdacht ab Aufmerksamkeit 20; Beweis nur foveal und ab Verdacht 12), Sichtkegel `src/game/vision.js` (Fovea ±5°, Peripherie bis 60°,
Verdeckung durch Köpfe/Oberkörper der Vorderleute, Pultfronten, Pult und Tisch).

## Verlauf der Abstimmung

1. Erste Messung (20 Läufe): Erstsemester 100 %, Bachelor 85 %, Prüfungswoche 60 %, Diplom 20 % – Bachelor deutlich zu leicht.
2. Strengerer Prof (Multiplikator 1,15 → 1,5, Schulterblick alle 8–19 s, kürzere Vorwarnung): Bachelor 65 %. Auffällig: Mehr Wachsamkeit
   senkt die Erwischt-Quote teils sogar, weil der Bot auf frühe „Hm?“-Reaktionen vorsichtiger reagiert – der Prof wirkt also fair.
3. Mit 40 Läufen gemessen (20 streuen um ±11 Prozentpunkte): Bachelor 75 % → Siegziel 6 → 7: 60 %.
4. Stärkere Gegner:in im Hörsaal (0,42 → 0,48): **Bachelor 55 %**, Prüfungswoche 35 %, Diplom 23 %, Erstsemester 90 %.
5. Mehr Kleidungsvarianten (anderer Besetzungs-Zufall) verschoben „Diplom“ auf 35 % – zu nah an „Prüfungswoche“.
   → Siegziel 7 → 8, Multiplikator 2,1 → 2,2: Diplom 18 %.
6. Endkontrolle mit **80 Läufen** je Stufe (40 Läufe streuen bei den schweren Stufen noch um ±8 Prozentpunkte, kleine Parameteränderungen
   mischen die Zufallsfolge neu). „Blick auf Spieler:in“ ist jetzt monoton (Prüfungswoche 0,19 → 0,24, Diplom 0,22 → 0,24) – damit lag
   Prüfungswoche mit 46–51 % zu nah an Bachelor, und der Verdachts-Multiplikator wirkte kaum (1,95/2,05: 47 %/49 %, nur mehr Rauswürfe).
   Entscheidend ist, ob das Siegziel erreicht wird → Gegner:in in Prüfungswoche stärker (0,50 → 0,56): 35 %. Diplom mit gleicher Gegner-Stärke
   (0,60 → 0,56): 11 %. Endstand siehe Tabelle oben.
