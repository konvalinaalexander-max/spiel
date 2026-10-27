# Tic Tac Tierernährung 🐄❌⭕

Ein 3D-Ego-Spiel im Browser: Du sitzt an der BOKU (Universität für Bodenkultur Wien) in der Vorlesung
**Tierernährung** (Bachelor Agrarwissenschaften) – und spielst heimlich Tic Tac Toe am Laptop.
Prof. Haferkorn darf dich dabei nicht erwischen.

## Spielen

Lade **`dist/BOKU_TicTacTierernaehrung.html`** herunter und öffne die Datei per Doppelklick in Chrome, Edge oder Firefox.
Alles ist in dieser einen Datei (three.js ist eingebettet), sie läuft also auch offline.

| Taste | Aktion |
|---|---|
| `Leertaste` / Rechtsklick | zwischen **Zuhören** und **Laptop** wechseln |
| `1`–`9` oder Klick | X setzen (am Laptop) |
| Maus | im Hörsaal umschauen |
| `V` / `M` | Stimme des Profs / Geräusche an/aus |
| `Esc` | Pause |

**Regeln:** Wenn der Prof in deine Richtung schaut, während du auf den Laptop schaust, steigt der Verdacht.
Bei 100 % wirst du erwischt; nach 3 Verwarnungen fliegst du raus. Hört das Kreidekratzen auf, dreht er sich gleich um
(manchmal blufft er). Zwischendurch stellt er Fragen zum Stoff – die Antworten stehen auf den Folien und an der Tafel.
Gewinne genug Runden, bevor die Vorlesung um 11:45 endet.

## Entwickeln

- Quellcode: `src/index.html` (HTML, CSS, JavaScript mit [three.js](https://threejs.org) r128 aus `vendor/`)
- Bauen: `python3 build.py` → erzeugt `dist/BOKU_TicTacTierernaehrung.html`

Fan-Projekt, kein offizielles Angebot der BOKU. Farben und Schrift sind an boku.ac.at angelehnt.
