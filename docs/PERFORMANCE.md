# Performance

## Version 3 – Endfassung (gemessen am 30.10.2026)

Messung: `node tools/perf-table.mjs` (Desktop-Datei) bzw. `--url http://…/index.html` (Mobil-Fassung über HTTP wie auf Pages),
1280 × 720, Sitzplatz Reihe 5, Software-Renderer (siehe „Messumgebung“). Draw Calls und Dreiecke zählen **ein ganzes Bild**:
Schattenkaskaden, Hauptbild und Nachbearbeitung. Rohdaten: `docs/perf_v3.json`, `docs/perf_mobile.json`.

**Desktop** (`dist/BOKU_TicTacTierernaehrung_v3.html`)

| Stufe | Draw Calls Zuhören / Laptop | Dreiecke je Bild | Geometrien | Texturen | Shader-Programme | JS-Heap | Ladezeit* | Bildzeit* |
|---|---|---|---|---|---|---|---|---|
| Niedrig | 154 / 144 | 0,77 Mio. | 166 | 238 | 183 | 711 MB | 40 s | 57 ms |
| **Mittel** | **246 / 242** | **1,13 Mio.** | 170 | 276 | 206 | 714 MB | 42 s | 44 ms |
| Hoch | 326 / 323 | 1,72 Mio. | 171 | 283 | 209 | 713 MB | 78 s | 65 ms |
| Ultra | 323 / 320 | 2,11 Mio. | 169 | 279 | 208 | 710 MB | 78 s | 88 ms |

**Mobil** (`dist/mobile/`, Automatik höchstens „Niedrig“)

| Stufe | Draw Calls Zuhören / Laptop | Dreiecke je Bild | Geometrien | Texturen | Shader-Programme | JS-Heap | Ladezeit* | Bildzeit* |
|---|---|---|---|---|---|---|---|---|
| **Niedrig** | **116 / 109** | **0,36 Mio.** | 148 | 198 | 166 | 357 MB | 32 s | 22 ms |
| Mittel (nur von Hand) | 166 / 169 | 0,49 Mio. | 152 | 236 | 189 | 383 MB | 35 s | 39 ms |

\* Software-Renderer auf 4 CPU-Kernen: nur relativ vergleichbar, auf echter Grafikhardware um ein Vielfaches schneller.

| Budget (Auftrag V3) | Ziel | Stand |
|---|---|---|
| „Mittel“ Desktop | ≤ 250 Draw Calls, ≤ 1,5 Mio. Dreiecke | **246**, **1,13 Mio.** ✓ |
| Mobil | ≤ 120 Draw Calls, ≤ 400 k Dreiecke | **116**, **357 k** ✓ |
| Figuren | ≤ 12 Draw Calls Desktop / ≤ 6 Mobil | **7** / **5** ✓ |
| Desktop-Datei | ≤ 80 MB | **73,0 MB** + Stimmen als Begleitdateien (Deutsch 64,0 MB, Englisch 36,8 MB, Base64) ✓ |
| Mobil-Kern (vorab gespeichert) | ≤ 30 MB | **28,5 MB** ✓ (Stimmen werden beim Abspielen geladen: Deutsch 45,4 MB, Englisch 26,2 MB) |

**Speicher:** Der JS-Heap der Desktop-Datei liegt bei rund 0,7 GB, weil alle Daten (Figuren, Texturen, Requisiten, Licht, Klänge)
eingebettet in der HTML-Datei stecken und beim Start dekodiert werden; über die Vorlesung bleibt er flach (gemessen über 4 Minuten
Vorlesungszeit: 706 → 725 MB). Die Mobil-Fassung lädt Dateien einzeln und braucht die Hälfte. Seit der Endfassung hält die
Stimme höchstens 48 dekodierte Aufnahmen im Speicher (vorher wuchs der Puffer über die ganze Vorlesung).

**Shader-Programme:** Mit Lightmaps, Atlas-Materialien und den Figuren sind es rund 200 Programme (Version 2: ≈ 110). Sie werden
beim Laden vorkompiliert – parallel, wo der Treiber `KHR_parallel_shader_compile` anbietet –, damit es beim ersten Umschauen nicht
ruckelt.

**Speicher im Test-Container:** Bei 3840 × 2160 Pixeln (DPR 2) und im Laptop-Blick bei 1920 × 1080 wird der Software-Renderer wegen
Speichermangel beendet. Auf echten Grafikchips gilt das nicht; die Grenze betrifft nur die Messung (`docs/SCHAERFE.md`).

**Tafel:** Teil-Uploads der Kreideschrift und das Nachziehen der Mipmaps laufen nur noch direkt vor einem gezeichneten Bild
(vorher in jedem Simulationsschritt). Das spart im Spiel GPU-Arbeit und verhinderte im Headless-Test ein Speicherleck.

**Weg zu den Budgets:** Requisiten in einem gemeinsamen Texturatlas (73 Materialien → 1 Atlasseite), Glas ohne
Transmissionsdurchgang, Echtzeitschatten nur für Möbelgroßes, Wände und Figuren, Figuren mit einem Material je Atlas:
„Mittel“ 706 → 246 Draw Calls. Mobil zusätzlich: Echtzeitschatten nur von Wänden, Rollos und Menschen, weniger Kleinkram auf den
Pulten, Außenwelt ohne Modelle, engere Detailstufen der Menge (154 → 116 Draw Calls, 0,77 → 0,36 Mio. Dreiecke).

## Messumgebung – ehrlich vorweg

Die Entwicklungsumgebung hat **keine GPU**. Gerendert und gemessen wurde in Chromium (headless) mit **SwiftShader**
(WebGL 2 auf der CPU, 4 Kerne). Bildzeiten dort sind um Größenordnungen langsamer als auf echter Grafikhardware und eignen
sich nur für **relative** Vergleiche zwischen den Stufen. Hardwareunabhängig und daher aussagekräftig sind **Draw Calls,
Dreiecke, Texturen, Geometrien und Shader-Programme** pro Bild. Das Ziel „60 fps auf Iris Xe bei ‚Mittel‘“ konnte hier
nicht direkt verifiziert werden; die Budgets unten sind so gewählt, dass es nach Erfahrungswerten erreichbar ist.

Messung: `node tools/phaseshots.mjs --only presets` → `docs/perf_presets.json` (identische Kamera am Sitzplatz Reihe 5/Platz 8,
Prof schreibt an die Tafel, 1280 × 720; zusätzlich Laptop-Blick). „Calls“ zählt **alle** Passes eines Bildes: Schattenkaskaden,
Hauptbild und Post-Stack.

**Zwischenstand vom 28.10.2026** (vor Rocketbox-Figuren, Requisiten-Atlas und Lightmaps; Werkzeug `tools/phaseshots.mjs --only presets`):

<!--PERF-TABLE-->
| Stufe | Blick | Draw Calls | Dreiecke | Geometrien | Texturen | Shader-Programme | Bildzeit SwiftShader* |
|---|---|---|---|---|---|---|---|
| Niedrig | Sitzplatz | 160 | 1 151 110 | 146 | 166 | 93 | 5,5 ms |
| Niedrig | Laptop | 146 | 1 145 682 | 146 | 166 | 93 | 11,7 ms |
| Mittel | Sitzplatz | 244 | 1 852 603 | 144 | 199 | 109 | 15,8 ms |
| Mittel | Laptop | 241 | 1 847 599 | 144 | 207 | 118 | 60,7 ms |
| Hoch | Sitzplatz | 321 | 2 721 311 | 146 | 206 | 111 | 15,9 ms |
| Hoch | Laptop | 315 | 2 715 887 | 146 | 214 | 120 | 66,8 ms |
| Ultra | Sitzplatz | 320 | 4 775 250 | 145 | 203 | 110 | 17,4 ms |
| Ultra | Laptop | 316 | 4 769 946 | 145 | 211 | 119 | 53,2 ms |

\* CPU-Rasterizer, nur relativ vergleichbar. Gemessen am 2026-10-28.
<!--/PERF-TABLE-->

Verlauf auf „Mittel“ in der Messszene der Tabelle: **278 → 244** Draw Calls (Laptop-Blick 273 → 241), Budget ≤ 250 eingehalten.
Maßnahmen: Außenwelt und Fahrzeuge werfen keine Schatten, Rollokästen gebatcht, Bloom mit 6 statt 8 Mip-Stufen, Paulinenwarte und
Mülltrennung mit je einem Material. Zusammensetzung (Messung in Ruhe): 2 Schattenkaskaden ≈ 96, Hauptbild ≈ 110, Post-Stack 40.
Vorher hatte das Zusammenführen der Figuren (53 → 2 SkinnedMeshes) auf „Niedrig“ schon 213 → 165 gebracht (jetzt 151).

## Budgets und Maßnahmen

| Bereich | Maßnahme |
|---|---|
| Statische Geometrie | `Batcher` verschmilzt Bänke, Pulte, Wände, Requisiten **je Material** zu wenigen Meshes (Blöcke ≤ 65 k Vertices, damit Frustum-Culling greift). Ein ganzer Hörsaal mit 110 Plätzen und ≈ 1 000 Requisiten-Teilen kostet so nur einige Dutzend Draw Calls. |
| Figuren | Alle Studierenden werden zu **zwei** SkinnedMeshes zusammengeführt (eines wirft Schatten – die Umgebung des eigenen Platzes –, eines nicht). Jede Figur behält ihr eigenes Skelett (Knochen-Offset im `skinIndex`, gemeinsame Knochentextur mit ≈ 1 550 Knochen); unsichtbare Figuren werden auf einen Punkt zusammengezogen. Ein Material für alle 53 Figuren (49 Studierende, Spätkommer:in, Tutorin, Prof, eigener Körper) → ein Shader-Programm. Vorher: 51 Draw Calls im Hauptbild + je Kaskade bis zu 51 weitere. Weit entfernte Figuren werden nur mit 20 Hz animiert. |
| Texturen | GPU-erzeugt (keine Downloads), Größe je Stufe 512–2048 px, gemeinsame Atlanten für Bildschirme, Sticker, Notizen, Etiketten, Futter, Plakate. |
| Schatten | Nur was man im Saal sieht, wirft Schatten: Außenwelt (Gebäude, Straße, Fahrzeuge) nicht (−27 Draw Calls auf „Mittel“, kein sichtbarer Unterschied), Studierende nur rund um den eigenen Platz (Ultra: alle), Rollokästen zu einem Mesh zusammengefasst. |
| Licht | Deckenlicht: Flächenlichter erst ab „Hoch“, sonst wenige Spots; Beamer-Spot mit Schatten erst ab „Hoch“; CSM-Kaskaden 1/2/3/3. |
| Post | Bloom mit 6 statt 8 Mip-Stufen, N8AO in halber Auflösung bis „Hoch“, Tiefenschärfe nur im Laptop-/Heft-Blick aktiv, chromatische Aberration nur bei Stress (eigener Pass, sonst abgeschaltet). |
| Canvas-Texturen | Tafel ≤ 20 Uploads/s, Laptop nur bei Änderung, Hybrid-Monitor 1/s, Mitschrift ≤ 15/s. |
| Laden | Startseite erscheint sofort (Vorlader im HTML, Bundle startet nach dem ersten Bild); Hörsaal wird schrittweise aufgebaut, Shader werden – wo der Treiber `KHR_parallel_shader_compile` kann – parallel kompiliert. |

## Lighthouse (Startseite)

`npx lighthouse http://localhost:8765/BOKU_TicTacTierernaehrung_v2.html?q=low` (Chromium + SwiftShader):

| Kategorie | mit Standard-Drosselung (Slow 4G, 4× CPU) | ohne Netzwerkdrosselung (`--throttling-method=provided`) |
|---|---|---|
| Barrierefreiheit | **100** | **100** |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| Performance | 25 | 61 |
| First Contentful Paint | 11,3 s (2,1-MB-Datei über simuliertes Slow 4G) | **0,2 s** |
| Largest Contentful Paint | 12,1 s | **0,6 s** |
| Total Blocking Time | 59 s | 29 s |

Die Datei wird lokal geöffnet (kein Netzwerk) – realistisch ist die rechte Spalte. Die Blockierzeit entsteht beim Aufbau des
Hörsaals (Texturerzeugung, Geometrie, Shader) auf dem CPU-Rasterizer; auf echter Hardware ist dieser Teil um ein Vielfaches schneller.
Barrierefreiheit wurde von 95 auf 100 gebracht (Kontraste: Text-Grün `#007a41` statt `#00aa5a` auf Weiß, Grau `#666` statt `#929191`).
