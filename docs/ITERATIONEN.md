# Optik-Iterationen

Jede Iteration: Screenshot → kritische Bewertung („Was sieht nach Baukasten aus? Was ist zu sauber, zu grell, zu leer?“)
→ Verbesserung → neuer Screenshot. Screenshots liegen in `docs/screenshots/`.

## Phase 2 – Render-Pipeline

**Iteration 0** (`phase2_pipeline_smoke.png`): Testszene mit Kaskadenschatten (CSM), N8AO, AgX-Tonemapping und
prozeduralen PBR-Texturen (Holz, Lamellen, Sichtbeton, Teppich). Ergebnis: Pipeline funktioniert, Normal-/ORM-Maps
greifen. Kritik: `PCFSoftShadowMap` ist in r183 veraltet → auf `PCFShadowMap` umgestellt.

## Phase 3 – Hörsaal

**Iteration 0 – moderner Holzsaal** (`phase3_iter0_modern_*.png`): Erster Entwurf vor Eingang der Recherche: großer
Saal mit 180 grün gepolsterten Klappsitzen, Holzlamellen, Lamellendecke mit Lichtlinien.
Kritik: wirkt wie ein generischer Neubau-Hörsaal, nicht wie die Türkenschanze; Desk-Maserung zu wild (Sperrholz-Look),
Lichtschächte als harte Keile sichtbar, Leinwand ausgebrannt, Außenbäume als scharfkantige Ikosaeder („Scherben“),
eine Baumkrone ragte durch die Wand. **Verworfen** zugunsten des recherchierten Vorbilds HS 31 (Mendel-Haus).

**Iteration 1 – HS 31** (`phase3_iter1_hs31_*.png`): Umbau nach Bauliste: 10 × 11 Plätze, dunkel gebeizte Pultbänke,
Eichenparkett, drei hohe Sprossenfenster, Vertäfelung rechts, Podest mit 5-m-Vortragstisch, Pult mit Touchscreen,
Monitor zwischen den Fenstern, Ziegelfassade außen, Rollos statt Jalousien, Blick aus dem 3. OG.
Kritik: Putz und Decke zu körnig (sieht nach Rauputz/Stuck aus statt glatt gestrichen), Decke bräunlich,
Punktlichter erzeugen grelle Flecken an der Decke, Holzmaserung zu großflächig geschwungen, Stiftrille als schwarzer
Balken, Lichtschacht als heller Keil über der Tafel, Leinwand ausgewaschen.

**Iteration 2** (`phase3_iter2_seat.png`): eigene Rezeptur „woodStained“ (gerade, feine Eichenmaserung mit Markstrahlen,
abgegriffene Stellen, Kratzer), Putz-Normalen auf 25 %, Deckenputz fast glatt, Deckenstrahler nach unten statt
Punktlichter, Stiftrille holzfarben, Lichtschacht mit Kanten- und Blickwinkel-Ausblendung, Leinwand weniger
selbstleuchtend. Kritik: Himmel draußen schwarz (Kugel außerhalb der Kamera-Far-Plane), Decke noch warmstichig
(Hemisphären-Bodenfarbe zu braun).

**Iteration 3** (`phase3_iter3_window.png`): Far-Plane 520 m, Himmel mit Wolken und Wienerwald-Silhouette,
Hemisphären-Bodenfarbe neutral-warm. Ergebnis: Blick auf den herbstlichen Türkenschanzpark mit Paulinenwarte,
Sonnenflecken auf den Bänken. Offene Punkte für spätere Iterationen: Wangen der Bänke wirken noch kantig;
Requisiten auf den Tischen fehlen; Leinwand-Kontrast im Spiel mit Figuren prüfen.

## Phase 4 – Figuren

**Iteration 0** (`phase4_iter0_rig.png`): Skinned-Mesh-Rig mit Vertexfarben, Sitzpose, Arm-IK, Blick. Kritik: Glieder
zu dünn, Rumpf zu schmal, Pullunder deckt den Bauch nicht (weißes Hemd sichtbar), Hals zu lang.
