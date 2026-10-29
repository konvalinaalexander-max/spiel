# Assets, Herkunft und Lizenzen (Version 3)

Alle Inhalte des Spiels stammen aus freien Quellen (CC0) oder sind selbst erzeugt. Rohdaten werden mit
`npm run assets:fetch` geladen (Prüfsummen unten, Cache in `assets/src/`), verarbeitet mit den Skripten in `tools/pipeline/`.
Weitergegeben werden nur die verarbeiteten Fassungen in `assets/build/` bzw. eingebettet in der HTML-Datei.
Keine Logos oder Fotos der BOKU, keine realen Personen; Prof. Haferkorn und alle Studierenden sind frei erfunden.

## Werkzeuge

| Werkzeug | Zweck | Lizenz |
|---|---|---|
| Blender 4.5 LTS | Figuren erzeugen, posieren, exportieren (ohne Oberfläche, per Skript) | GPL-3.0 (Werkzeug; erzeugte Dateien sind frei) |
| MPFB 2 (MakeHuman-Erweiterung für Blender) | parametrische Menschen, Skelett, Gewichte | GPL-3.0 (Werkzeug); erzeugte Modelle CC0 |
| Basis Universal (über `ktx2-encoder`) | Texturkompression KTX2 | Apache-2.0 |
| Coqui XTTS v2 | Sprachsynthese Deutsch (vorgerendert) | Coqui Public Model License (CPML): nur nicht-kommerzielle Nutzung – dieses Fan-Projekt ist nicht kommerziell |
| Kokoro-82M (hexgrad) | Sprachsynthese Englisch (vorgerendert) | Apache-2.0 |
| meshoptimizer | Detailstufen der Figuren | MIT |
| ffmpeg / libopus | Mastering, Opus-Kodierung | LGPL / BSD |

## Heruntergeladene Quellen

| Kennung | Datei | Lizenz | Urheber:in | SHA-256 (Anfang) | Größe |
|---|---|---|---|---|---|
| mpfb | `tools/mpfb-2.0.18.zip` | GPL-3.0-or-later (Werkzeug; erzeugte Modelle CC0) | MakeHuman Community (Joel Palmius) | `c075b3e9b94b8e55` | 43.8 MB |
| mh_makehuman_system_assets | `makehuman/makehuman_system_assets_cc0.zip` | CC0-1.0 | MakeHuman Community | `b542127a8e25547c` | 267.7 MB |
| mh_hair01 | `makehuman/hair01_cc0.zip` | CC0-1.0 | MakeHuman Community | `49445d69848a313e` | 217.2 MB |
| mh_shirts01 | `makehuman/shirts01_cc0.zip` | CC0-1.0 | MakeHuman Community | `a5a723b0e84a109b` | 23.3 MB |
| mh_pants01 | `makehuman/pants01_cc0.zip` | CC0-1.0 | MakeHuman Community | `e4e0ec60db34f279` | 20.9 MB |
| mh_shoes01 | `makehuman/shoes01_cc0.zip` | CC0-1.0 | MakeHuman Community | `ded3f70428505eab` | 79.1 MB |
| mh_suits01 | `makehuman/suits01_cc0.zip` | CC0-1.0 | MakeHuman Community | `2b1d8676f3863b18` | 40.6 MB |
| mh_suits02 | `makehuman/suits02_cc0.zip` | CC0-1.0 | MakeHuman Community | `437f4d7ab92b698c` | 183.6 MB |
| mh_suits05 | `makehuman/suits05_cc0.zip` | CC0-1.0 | MakeHuman Community | `4c377179b108a860` | 1.2 MB |
| mh_skins01 | `makehuman/skins01_cc0.zip` | CC0-1.0 | MakeHuman Community | `7495ab99287053bd` | 99.4 MB |
| mh_skins02 | `makehuman/skins02_cc0.zip` | CC0-1.0 | MakeHuman Community | `1613f1ef3afca530` | 72.6 MB |
| mh_skins03 | `makehuman/skins03_cc0.zip` | CC0-1.0 | MakeHuman Community | `be159362000e008d` | 130.5 MB |
| mh_eyebrows01 | `makehuman/eyebrows01_cc0.zip` | CC0-1.0 | MakeHuman Community | `5425891dce613bef` | 10.9 MB |
| mh_eyelashes01 | `makehuman/eyelashes01_cc0.zip` | CC0-1.0 | MakeHuman Community | `b7b5eb97cfb930d9` | 3.3 MB |
| mh_glasses01 | `makehuman/glasses01_cc0.zip` | CC0-1.0 | MakeHuman Community | `f215c58e09e31b7e` | 5.5 MB |
| mh_dress01 | `makehuman/dress01_cc0.zip` | CC0-1.0 | MakeHuman Community | `f49ba54a3c93acd3` | 44.4 MB |
| mh_skirts01 | `makehuman/skirts01_cc0.zip` | CC0-1.0 | MakeHuman Community | `293fa0c15e28e8dc` | 28.2 MB |
| mh_system_clothes_materials01 | `makehuman/system_clothes_materials01_cc0.zip` | CC0-1.0 | MakeHuman Community | `d99fdd8d393b46c5` | 45.9 MB |
| mh_system_hair_materials01 | `makehuman/system_hair_materials01_cc0.zip` | CC0-1.0 | MakeHuman Community | `bfdbbf3407a7877e` | 82.8 MB |
| mh_system_eye_materials01 | `makehuman/system_eye_materials01_cc0.zip` | CC0-1.0 | MakeHuman Community | `acad4636c08ff96a` | 13.6 MB |
| mh_clothes_materials01 | `makehuman/clothes_materials01_cc0.zip` | CC0-1.0 | MakeHuman Community | `7d3287390af01e44` | 93.6 MB |
| acg_WoodFloor052 | `ambientcg/WoodFloor052_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Wood066 | `ambientcg/Wood066_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Wood060 | `ambientcg/Wood060_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Plaster001 | `ambientcg/Plaster001_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Plaster002 | `ambientcg/Plaster002_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Fabric030 | `ambientcg/Fabric030_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Fabric066 | `ambientcg/Fabric066_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Metal032 | `ambientcg/Metal032_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Metal048A | `ambientcg/Metal048A_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Metal055A | `ambientcg/Metal055A_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Leather030 | `ambientcg/Leather030_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Leather026 | `ambientcg/Leather026_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Marble021 | `ambientcg/Marble021_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Asphalt031 | `ambientcg/Asphalt031_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_PavingStones128 | `ambientcg/PavingStones128_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_PavingStones150 | `ambientcg/PavingStones150_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |
| acg_Grass001 | `ambientcg/Grass001_2K-JPG.zip` | CC0-1.0 | ambientCG (Lennart Demes) | noch nicht geladen | – |

## Figuren (MakeHuman-Assetpakete, CC0)

Alle Figuren werden mit `node tools/pipeline/humans.mjs` aus `tools/pipeline/humans.json` erzeugt (Blender + MPFB) und mit
`node tools/pipeline/humans-pack.mjs` verpackt. Die Assetpakete der MakeHuman Community sind ausdrücklich CC0
(Dateinamen `*_cc0.zip`); die Urheber:innen sind am Präfix der Asset-Namen erkennbar und werden hier trotzdem genannt.

| Figur | Rolle | Haut | Haar | Kleidung | Zubehör |
|---|---|---|---|---|---|
| prof | prof | middleage_caucasian_male | short02 (bogdan666_short_02_gray) | toigo_wool_pants, toigo_fisherman_sweater, shoes01 | kwnet_at_optical_glasses |
| player_a | player | young_caucasian_male | short02 (bogdan666_short_02_brown) | male_casualsuit01, shoes05 | – |
| player_b | player | cutoff3d_indian_female_skin | long01 (toigo_long_01_black) | toigo_wool_pants, toigo_fisherman_sweater, toigo_ankle_boots_female | – |
| player_c | player | young_african_male | short01 | male_casualsuit01, shoes04 | – |
| neighbor | neighbor | young_caucasian_female2 | ponytail01 | female_elegantsuit01, toigo_flats | – |
| tutor | tutor | young_caucasian_female | rehmanpolanski_hair_bun_brown | cortu_cargo_pants, joepal_crude_t-shirt_female, shoes05 | frankyaye_glasses_library_male |
| m01 | Studierende | young_caucasian_male | short02 (bogdan666_short_02_brown) | male_casualsuit01, shoes02 | – |
| m02 | Studierende | young_caucasian_male2 | short04 (toigo_short_04_blonde) | male_casualsuit03, shoes05 | – |
| m03 | Studierende | young_african_male | short01 | male_casualsuit05, shoes04 | – |
| m04 | Studierende | young_asian_male | culturalibre_hair_02 | male_casualsuit06, shoes06 | – |
| m05 | Studierende | toigo_light_skin_male_ginger | short04 (toigo_short_04_ginger) | cortu_cargo_pants, toigo_fisherman_sweater, shoes01 | – |
| m06 | Studierende | young_caucasian_male | cortu_short_messy_hair | toigo_wool_pants, namuhekam_male_polo_shirt, shoes03 | – |
| m07 | Studierende | mindfront_skin_male_african_middleage | culturalibre_hair_05 | cortu_cargo_pants, toigo_basic_tucked_t-shirt, shoes05 | – |
| m08 | Studierende | young_caucasian_male2 | short03 | male_casualsuit01, shoes02 | – |
| f01 | Studierende | young_caucasian_female | long01 | female_elegantsuit01, toigo_flats | – |
| f02 | Studierende | young_caucasian_female2 | ponytail01 | toigo_wool_pants, joepal_crude_t-shirt_female, shoes05 | – |
| f03 | Studierende | young_african_female | afro01 | cortu_cargo_pants, toigo_fisherman_sweater, toigo_ankle_boots_female | – |
| f04 | Studierende | young_asian_female | toigo_blunt_bob | cortu_cargo_pants, joepal_crude_t-shirt_female, shoes06 | – |
| f05 | Studierende | toigo_light_skin_female_ginger | long01 (toigo_long_01_ginger) | toigo_wool_pants, toigo_fisherman_sweater, toigo_ankle_boots_female | – |
| f06 | Studierende | young_caucasian_female | bob02 | toigo_long_full_skirt, joepal_crude_t-shirt_female, toigo_flats | – |
| f07 | Studierende | cutoff3d_indian_female_skin | rehmanpolanski_hair_bun_brown | toigo_wool_pants, toigo_fisherman_sweater, shoes06 | – |
| f08 | Studierende | darthfurby_caucasian_female | o4saken_long01 | cortu_cargo_pants, joepal_crude_t-shirt_female, shoes05 | – |

Urheber:innen der verwendeten Assets (laut Paket): MakeHuman-Team, cortu, culturalibre, cutoff3d, darthfurby, eyebrow002, eyebrow003, eyebrow004, eyebrow005, eyebrow006, eyebrow007, eyebrow009, eyebrow010, eyebrow011, eyebrow012, frankyaye, joepal, kwnet, mindfront, namuhekam, o4saken, rehmanpolanski, toigo.

## Stimme

Stufe 2 laut Auftrag (offenes Modell, kein API-Schlüssel vorhanden): **Coqui XTTS v2** mit eingebauten, synthetischen
Studiosprechern – keine geklonte reale Person. Auswahl nach Prüfsätzen (Rückerkennung mit Whisper, Signalqualität mit SQUIM),
Details in `docs/AUDIO.md`. Deutsch (XTTS): Prof. Haferkorn „Damien Black“, Nachbarin „Daisy Studious“,
Studierende „Sofia Hellen“ / „Andrew Chipper“; Lizenz der Modellausgabe CPML, nicht-kommerziell. Englisch (Kokoro-82M, Apache-2.0):
Prof „bm_daniel“, Nachbarin „bf_emma“, Studierende „af_heart“ / „am_michael“.
Mit einem Azure-Schlüssel (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`) kann die Stimme gegen „de-AT-JonasNeural“
(österreichisches Deutsch) ausgetauscht werden.
