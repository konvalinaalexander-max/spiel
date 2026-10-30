# Spielen am Handy und Tablet (Version 3)

Das Spiel läuft am Handy als eigene, gehostete Fassung (Progressive Web App). Sie lädt die Dateien einzeln, statt alles in eine
HTML-Datei zu packen, und funktioniert nach dem ersten Start auch offline.

## Zwei Builds aus einer Quelle

| Build | Befehl | Ergebnis | Assets |
|---|---|---|---|
| Desktop | `npm run build:desktop` | `dist/BOKU_TicTacTierernaehrung_v3.html` (eine Datei, offline per Doppelklick) | Profil `desktop`, eingebettet |
| Mobil | `npm run build:mobile` | Ordner `dist/mobile/` + `dist/BOKU_TicTacTierernaehrung_v3_mobile.zip` | Profil `mobile` (Atlanten ≤ 1K), per `fetch` |

`npm run build` baut beide. Der Mobil-Build bricht ab, wenn die vorab gespeicherten Kerndateien größer als 30 MB sind.

Aufbau von `dist/mobile/`:

```
index.html              Spiel (JS und CSS eingebettet), nennt die Dateien in #assets-remote
manifest.webmanifest    Name, Symbole 192/512, display standalone, Querformat
sw.js                   Service Worker: Kerndateien beim Installieren vorhalten, Stimmen beim Abspielen
icons/                  App-Symbole (aus SVG erzeugt)
assets/humans/          Figuren (Rocketbox: HPK-Geometrie, KTX2-Atlanten ≤ 1K, Animationen CLP2 mit 12/15 Bildern/s)
assets/props/           Requisiten (GLB) + gemeinsamer Texturatlas 2048 × 1152
assets/lightmap/        gebackenes Licht 4 × 1024² je Wetter + UV-Daten
assets/basis/           KTX2-Transkodierer
assets/voice/de|en/     Verzeichnis der Aufnahmen + Opus-Dateien
```

## Hosting

- **GitHub Pages:** Der Workflow `.github/workflows/pages.yml` baut bei jedem Push auf den Standard-Branch und veröffentlicht
  `dist/mobile/` samt Desktop-Fassung (`…/BOKU_TicTacTierernaehrung_v3.html` mit Stimmdateien). Einmalig im Repository
  einschalten: *Settings → Pages → Source: GitHub Actions*; ohne diese Einstellung meldet der Lauf nur einen Hinweis.
  Adresse danach: `https://konvalinaalexander-max.github.io/spiel/`.
- **Eigener Server:** `dist/BOKU_TicTacTierernaehrung_v3_mobile.zip` (aus `npm run build:mobile` oder von der Pages-Seite) entpacken und den Ordner per HTTPS ausliefern
  (Service Worker und Wake Lock brauchen HTTPS; `localhost` geht zum Testen).
- Direkt als Datei geöffnet (`file://`) läuft der Mobil-Build nicht. Dafür gibt es die Desktop-Datei.

## Offline und Updates

- Beim ersten Start speichert der Service Worker alle Kerndateien (Spiel, Figuren, Transkodierer, Symbole).
- Stimmen werden beim ersten Abspielen gespeichert. 20 Sekunden nach dem Start lädt der Service Worker zusätzlich alle Aufnahmen
  der gewählten Sprache nach, außer der Datensparmodus des Browsers ist an.
- Gibt es eine neue Version, erscheint unten der Hinweis „Neue Version verfügbar“ mit der Taste „Neu laden“.

## Touch-Steuerung

Querformat ist die Hauptlage. Im Laptop-Blick geht auch Hochformat: dann füllt der Laptop das Bild. In allen anderen Lagen
erscheint im Hochformat der Hinweis zum Drehen.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Uhr · Verdacht                                                Untertitel │
│                                                                          │
│              Ziehen irgendwo = Blick (Laptop: Cursor)                    │
│              Zwei Finger auseinander = genau hinschauen                  │
│              Zwei Finger nach unten wischen = Laptopdeckel zu/auf        │
│                                                                          │
│   ┌────────┐ ┌─────────────┐ ┌─────────┐ ┌─────────────┐ ┌────────┐      │
│   │ Laptop │ │Mitschreiben◔│ │ Fenster │ │ Hinschauen ◔│ │ Pause  │      │
│   └────────┘ └─────────────┘ └─────────┘ └─────────────┘ └────────┘      │
└──────────────────── Abstand zur Safe-Area (Notch, Home-Leiste) ──────────┘
```

| Geste / Taste | Zuhören | Laptop | Heft | Quiz |
|---|---|---|---|---|
| Ziehen | Blick | Cursor | Blick (eingeschränkt) | – |
| Zwei Finger auseinander | genau hinschauen, solange gehalten | – | – | – |
| Tippen | – | Feld setzen, App bedienen | – | Antwort wählen |
| Taste „Laptop“ | zum Laptop | zurück zum Zuhören | – | gesperrt |
| Taste „Mitschreiben“ (halten) | Heft | ausgeblendet | loslassen = Zuhören | – |
| Taste „Fenster“ | ausgeblendet | Alt-Tab | – | – |
| Taste „Hinschauen“ (halten) | Zoom | ausgeblendet | – | – |
| Zwei Finger nach unten wischen | – | Deckel zu bzw. auf | – | – |
| Taste „Pause“ | überall | | | |

Umsetzung:

- Tasten sind mindestens 52 px hoch, mit 8 px Abstand, und halten Abstand zur Safe-Area (`env(safe-area-inset-*)`).
- Halte-Tasten zeigen einen Fortschrittsring und vibrieren 10 ms beim Drücken (Android; iOS kennt keine Vibration im Browser).
- Es gibt keine Hover-Effekte. Die Tasten lösen bei `pointerdown` aus und folgen dem Finger per Pointer Capture.
- Beim ersten Tipp wird der Ton freigeschaltet (nötig auf iOS). Auf Android geht das Spiel beim Start in den Vollbildmodus.
- Während der Vorlesung bleibt der Bildschirm an (Screen Wake Lock). Nach dem Zurückkehren in den Tab wird die Sperre neu angefordert.

Code: `src/core/input.js` (Gesten, virtuelle Tasten), `src/ui/hud.js` (Leiste, Modus je Spielzustand), `src/ui/styles.css` (Layout),
`src/main.js` (Wake Lock, Vollbild).

## Automatischer Touch-Durchlauf

`node tools/touch-e2e.mjs` startet den Mobil-Build über einen lokalen HTTP-Server, emuliert ein Pixel 7 im Querformat und spielt
mit echten Touch-Ereignissen (Chrome DevTools Protocol): Startseite → „Zur Lehrveranstaltung“ → „Vorlesung betreten“ → Taste
„Laptop“ → Tipp auf ein Spielfeld (Bildschirmposition aus dem Laptop-Bildschirm berechnet) → „Mitschreiben“ halten →
Prüfungsfrage antippen → Vorlesung bis zum Zeugnis. Bericht: `docs/touch-e2e.json`.

## Checkliste für echte Geräte (5 Minuten)

Auf einem iPhone (Safari) und einem Android-Handy (Chrome) jeweils:

1. Seite öffnen. Die Startseite erscheint sofort, der Ladebalken zählt hoch.
2. Handy quer halten, Vorlesung starten. Ton ist hörbar, der Prof spricht.
3. Mit einem Finger umsehen. Zwei Finger auseinanderziehen: die Folie wird groß und ist lesbar.
4. „Laptop“ tippen, ein Feld setzen, „Fenster“ tippen. Den Laptop hochkant halten: er füllt das Bild.
5. „Mitschreiben“ halten: der Ring läuft, Android vibriert kurz.
6. 2 Minuten nichts tun: der Bildschirm bleibt an.
7. Über „Teilen → Zum Home-Bildschirm“ (iOS) bzw. „App installieren“ (Android) installieren und im Flugmodus starten.
