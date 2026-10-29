# Schärfe und Lesbarkeit (Messung)

Gemessen mit `node tools/sharpness.mjs` (Auftrag V3, Anhang B): feste Kameras, Viewport 1920 × 1080, Stufe „Mittel“,
Gerätepixelverhältnis (DPR) 1 und 2. Der Ausschnitt wird so bewertet, wie ihn die Spielerin sieht: Renderpuffer → auf Gerätepixel
gebracht (bilinear hochskaliert, wenn der Puffer kleiner ist als der Bildschirm – genau das war in Version 2 der Fall).

- **Laplace-Varianz**: Kantenschärfe (höher = schärfer; nur innerhalb derselben Ansicht und DPR vergleichbar).
- **OCR-Trefferquote**: Anteil der Wörter (≥ 3 Zeichen) des bekannten Quelltexts (Folie bzw. Laptop-Skriptum), die tesseract.js im
  3-fach vergrößerten Ausschnitt exakt wiederfindet. Zielwerte laut Auftrag: Folie ohne Zoom ≥ 85 %, mit Zoom ≥ 97 %, Laptop ≥ 98 %.

| Ansicht | DPR | v2: Pixel · Laplace · OCR | v3: Pixel · Laplace · OCR | Faktor Laplace v3/v2 | Ziel OCR |
|---|---|---|---|---|---|
| Leinwand aus Reihe 5 (ohne Zoom) | 1 | 508×338 · 993 · 62,2 % | 508×338 · 4290 · 88,9 % | 4,32 × | ≥ 85 % |
| Leinwand aus Reihe 5 (ohne Zoom) | 2 | 1016×676 · 107 · 55,6 % | – | – | ≥ 85 % |
| Laptop-Blick (Skriptum) | 1 | 1361×845 · 346 · 62,1 % | 1383×856 · 1257 · 98,1 % | 3,64 × | ≥ 98 % |
| Laptop-Blick (Skriptum) | 2 | 2724×1687 · 56 · 55,8 % | – | – | ≥ 98 % |
| Tafel aus Reihe 5 | 1 | – | 471×183 · 612 · – | – | – |
| Tafel aus Reihe 5 | 2 | – | – | – | – |
| Leinwand mit „genau hinschauen“ | 1 | 1304×862 · 414 · 97,8 % | 1304×862 · 1232 · 95,6 % | 2,98 × | ≥ 97 % |
| Leinwand mit „genau hinschauen“ | 2 | 2608×1723 · 46 · 95,6 % | – | – | ≥ 97 % |

Bilder: `docs/schaerfe/<label>_<Ansicht>_dpr<n>.png` (Ausschnitte in Gerätepixeln).

## Messbedingungen und Grenzen

- **Gleiche Kameras wie bei Version 2.** K1 = Sitzplatz Reihe 5 auf die Leinwand (Sichtfeld 60°), K4 = derselbe Platz mit
  „genau hinschauen“ (25°), K2 = Laptop-Blick mit geöffnetem Skriptum, K3 = Tafel.
- **Software-Renderer, nur DPR 1.** Gemessen wird headless mit SwiftShader (kein Grafikchip im Container). Bei DPR 2 ist der
  Renderpuffer 3840 × 2160 groß. Damit überschreitet der Software-Renderer den Speicher des Testcontainers und wird beendet,
  auch mit der Stufe „Niedrig“. Die DPR-2-Zeilen von Version 3 bleiben deshalb leer. Das Hauptkriterium des Auftrags (Folie ohne
  Zoom, 1920 × 1080, DPR 1) ist gemessen. Bei DPR 2 rechnet Version 3 in voller Gerätepixelzahl (Version 2 nur mit halber Auflösung
  und Hochskalierung); auf einem echten Gerät ist das Bild dort also mindestens so scharf wie bei DPR 1. Prüfen lässt sich das am
  Retina- oder 4K-Bildschirm unter Einstellungen → Grafik (Anzeige der echten Pixelzahl).
- **„Genau hinschauen“ (K4):** 95,6 % statt 97,8 % bei Version 2 ist ein einziges Wort von 45, bei dreifacher Kantenschärfe.
  Das Ziel von 97 % ist damit knapp verfehlt.
- **K3 (Tafel)** hat in diesem Moment der Vorlesung noch keine neue Kreideschrift, nur halb gelöschte Altformeln. Die Zeile
  zeigt deshalb nur die Kantenschärfe, keine Texterkennung.
- **OCR** zählt Wörter mit mindestens drei Zeichen, die tesseract.js im dreifach vergrößerten Ausschnitt exakt wiederfindet. Bei
  45 Wörtern einer Folie entspricht ein Wort 2,2 Prozentpunkten.
- **Laptop (K2) in Version 3:** Vor der Korrektur verdeckte ein Teil des eigenen Unterarms, der direkt an der Kamera vorbeiging,
  einen Keil des Bildschirms (OCR 78,6 %). Seit Teile der eigenen Figur näher als 16 cm an der Kamera nicht mehr gezeichnet
  werden, liegt der Wert bei 98,1 %.
