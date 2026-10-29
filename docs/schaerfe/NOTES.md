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
