# Performance

## Messumgebung – ehrlich vorweg

Die Entwicklungsumgebung hat **keine GPU**. Gerendert und gemessen wurde in Chromium (headless) mit **SwiftShader**
(WebGL 2 auf der CPU, 4 Kerne). Bildzeiten dort sind um Größenordnungen langsamer als auf echter Grafikhardware und eignen
sich nur für **relative** Vergleiche zwischen den Stufen. Hardwareunabhängig und daher aussagekräftig sind **Draw Calls,
Dreiecke, Texturen, Geometrien und Shader-Programme** pro Bild. Das Ziel „60 fps auf Iris Xe bei ‚Mittel‘“ konnte hier
nicht direkt verifiziert werden; die Budgets unten sind so gewählt, dass es nach Erfahrungswerten erreichbar ist.

Messung: `node tools/phaseshots.mjs --only presets` → `docs/perf_presets.json` (identische Kamera am Sitzplatz Reihe 5/Platz 8,
Prof schreibt an die Tafel, 1280 × 720; zusätzlich Laptop-Blick). „Calls“ zählt **alle** Passes eines Bildes: Schattenkaskaden,
Hauptbild und Post-Stack.

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
