# Balancing

Automatisierter Test: `node tools/sim.mjs --runs 40 --difficulty all --md docs/BALANCING.md` (läuft ohne Rendering, 227 s).
Der Bot (`src/game/bot.js`, Geschick 0.5) spielt **nur mit Hinweisen, die auch ein Mensch hat**: grobe, verzögerte und verrauschte
Blickrichtung des Profs, das Ende des Kreidekratzens, Warnungen der Nachbarin, Reaktionszeit 0.40 s ± 0,1 s; er sieht
keine internen Werte (Verdacht/Beweis). Er schaltet über dieselbe API wie die Eingabe (`setMode`, `tttPlay`, `answerQuiz`, `signList`),
schreibt in ruhigen Momenten mit und beantwortet Prüfungsfragen umso besser, je länger er im jeweiligen Abschnitt zugehört hat.
Vorlesungslänge „normal“ (720 s ≙ 90 Spielminuten), Sitzplatz Reihe 5 / Platz 8, Gegner:in im Hörsaal,
40 Durchläufe je Stufe mit unterschiedlichen Seeds (Vorlesungsablauf, Besetzung, Prof-Verhalten).

## Ergebnis

| Stufe | Ziel (Siege) | Erfolgsquote | Erwischt pro Lauf | Rauswurf | Siege / Niederl. / Unentsch. | Quiz richtig / gestellt | Ø Note | Ø Dauer | Ø Zeit am Spiel |
|---|---|---|---|---|---|---|---|---|---|
| erstsemester | 6 | 95 % | 0,13 | 3 % | 10,1 / 4,05 / 8,82 | 2,23 / 2,55 | 1,3 | 12:04 | 317 s |
| bachelor | 7 | 57 % | 0,45 | 8 % | 7,1 / 3,78 / 9,75 | 2,23 / 2,9 | 2,65 | 11:42 | 291 s |
| pruefungswoche | 7 | 40 % | 0,73 | 8 % | 6,1 / 3,95 / 9,75 | 3,03 / 3,88 | 3,35 | 12:01 | 286 s |
| diplom | 7 | 35 % | 1,25 | 13 % | 5,38 / 3,8 / 8,73 | 3,33 / 4,13 | 3,58 | 11:29 | 251 s |

Zielband laut Auftrag: **„Bachelor“ ≈ 50 %** Erfolgsquote eines mittelguten Bots. Die Stufen sind monoton gestaffelt
(leicht → sehr schwer), „Erstsemester“ ist für den Einstieg bewusst gutmütig, „Diplomand:in“ eine echte Herausforderung.
„Erfolg“ = Siegziel erreicht und nicht rausgeworfen. Kürzere Durchläufe als 12:00 entstehen durch Rauswurf.

## Parameter (Tuning-Datei `src/game/config.js`)

| Stufe | Verdachts-Multiplikator | Schulterblick alle | Vorwarnung (Kreide stoppt) | Bluff | Blick auf Spieler:in | Fixationsdauer | Drehrate | Gegner-Stärke | Nachbarin |
|---|---|---|---|---|---|---|---|---|---|
| erstsemester | 0.7 | 14–30 s | 0.65 s | 12 % | 6 % | 0.9–2.4 s | 2.6 | 0.28 | helpful |
| bachelor | 1.65 | 8–18 s | 0.31 s | 28 % | 22 % | 0.7–2.3 s | 3.8 | 0.48 | helpful |
| pruefungswoche | 1.8 | 6–15 s | 0.26 s | 33 % | 19 % | 0.5–1.7 s | 4.4 | 0.5 | neutral |
| diplom | 2.1 | 5–12 s | 0.2 s | 38 % | 22 % | 0.45–1.5 s | 5 | 0.6 | betrayer |

Weitere Größen (alle Stufen): Verdachtsmodell `src/game/suspicion.js` (Aufmerksamkeit steigt 70/s × Sichtbarkeit × Auffälligkeit, fällt 28/s;
Verdacht ab Aufmerksamkeit 20; Beweis nur foveal und ab Verdacht 12), Sichtkegel `src/game/vision.js` (Fovea ±5°, Peripherie bis 60°,
Verdeckung durch Köpfe/Oberkörper der Vorderleute, Pultfronten, Pult und Tisch).

## Verlauf der Abstimmung

1. Erste Messung (20 Läufe): Erstsemester 100 %, Bachelor 85 %, Prüfungswoche 60 %, Diplom 20 % – Bachelor deutlich zu leicht.
2. Strengerer Prof (Multiplikator 1,15 → 1,5, Schulterblick alle 8–19 s, kürzere Vorwarnung): Bachelor 65 %. Auffällig: Mehr Wachsamkeit
   senkt die Erwischt-Quote teils sogar, weil der Bot auf frühe „Hm?“-Reaktionen vorsichtiger reagiert – der Prof wirkt also fair.
3. Mit 40 Läufen gemessen (20 streuen um ±11 Prozentpunkte): Bachelor 75 % → Siegziel 6 → 7: 60 %.
4. Stärkere Gegner:in im Hörsaal (0,42 → 0,48): **Bachelor 55 %**, Prüfungswoche 35 %, Diplom 23 %, Erstsemester 90 %.
