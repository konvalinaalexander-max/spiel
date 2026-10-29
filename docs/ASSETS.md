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

## Figuren und Bewegungen (Microsoft Rocketbox, MIT)

Alle Menschen im Spiel stammen aus der **Microsoft Rocketbox Avatar Library** (github.com/microsoft/Microsoft-Rocketbox,
MIT-Lizenz, „Copyright (c) 2020 Microsoft“; Lizenztext: `docs/licenses/Microsoft-Rocketbox-LICENSE.md`, im Spiel unter
„Impressum, Quellen & Lizenzen“). Die Bewegungen sind die Motion-Capture-Animationen derselben Bibliothek (Sitzen am Tisch,
Stehen, Gehen, Sprechgesten). Geladen mit `python3 -I tools/pipeline/people-fetch.py`, verpackt mit
`node tools/pipeline/people.mjs` (Skelett in Ruhepose, Atlanten KTX2, Gesichtsformen für Prof/Nachbarin/Tutorin, Animationen
als Int16-Differenzen). Haarkarten: Normalen nach außen gekämmt, Deckung beim Verkleinern erhalten (`tools/pipeline/hair.mjs`).

| Rolle | Figur | Gesichtsformen |
|---|---|---|
| prof (prof) | Male_Adult_03 | ja (Visemes, Blinzeln, Brauen) |
| neighbor (neighbor) | Female_Adult_08 | ja (Visemes, Blinzeln, Brauen) |
| tutor (tutor) | Female_Adult_05 | ja (Visemes, Blinzeln, Brauen) |
| player_a (player) | Male_Adult_06 | – |
| player_b (player) | Female_Adult_12 | – |
| player_c (player) | Male_Adult_09 | – |
| Studierende (weiblich) | Female_Adult_01, Female_Adult_02, Female_Adult_03, Female_Adult_04, Female_Adult_06, Female_Adult_07, Female_Adult_09, Female_Adult_11, Female_Adult_12, Female_Adult_13, Female_Adult_14, Female_Adult_15, Female_Adult_17 | – |
| Studierende (männlich) | Male_Adult_01, Male_Adult_02, Male_Adult_04, Male_Adult_06, Male_Adult_07, Male_Adult_08, Male_Adult_09, Male_Adult_10, Male_Adult_11, Male_Adult_12, Male_Adult_13, Male_Adult_14, Male_Adult_16, Male_Adult_17, Male_Adult_18, Male_Adult_20 | – |

Animationen (Rocketbox, je männlich/weiblich): sit_idle_1 (`sit_table_idle_neutral_01`), sit_idle_2 (`sit_table_idle_neutral_02`), sit_relaxed (`sit_table_idle_relaxed_01`), sit_breathe (`sit_table_breathe_01`), sit_look (`sit_table_idle_look_around`), sit_yawn (`sit_table_idle_yawn`), sit_scratch (`sit_table_idle_scratch_head`), sit_face (`sit_table_idle_touch_face`), sit_hair (`sit_table_idle_touch_hair`), sit_roll_head (`sit_table_idle_roll_head`), sit_cough (`sit_table_idle_cough`), sit_waiting (`sit_table_idle_waiting_01`), sit_thoughtful (`sit_table_gestic_thoughtful`), sit_shrug (`sit_table_gestic_shrug_01`), sit_down (`sit_down_table_left`), stand_up (`sit_stand_up_table_left`), idle_1 (`idle_neutral_01`), idle_2 (`idle_neutral_02`), idle_look (`idle_look_around_01`), walk (`walk_neutral_01`), walk_slow (`walk_slow_01`), laugh (`gestic_laugh_low`), clap (`claphands_01`), phone (`cell_phone_textmessage`), sit_nervous (`sit_table_idle_nervous_01`), sit_dust (`sit_table_idle_dust`), wave (`wave_01`).
Prof zusätzlich: talk_1 (`gestic_talk_neutral_01`), talk_2 (`gestic_talk_neutral_02`), talk_3 (`gestic_talk_neutral_03`), talk_4 (`gestic_talk_relaxed_01`), talk_5 (`gestic_talk_relaxed_02`), present_left (`gestic_presentation_left_01`), present_right (`gestic_presentation_right_01`), moderate_1 (`moderate_01`), moderate_2 (`moderate_02`), thoughtful (`gestic_thoughtful_01`), shrug (`gestic_shrug_01`), drink (`drink_drinking`), documents (`documents_note`), listen (`gestic_listen_neutral_01`), idle_3 (`idle_neutral_03`), idle_scratch (`idle_scratch_head_01`), idle_breathe (`idle_breathe_01`), talk_excited (`gestic_talk_excited_01`), talk_left (`gestic_talk_left_01`), talk_right (`gestic_talk_right_01`).

Die älteren MakeHuman/MPFB-Figuren (unten) bleiben als Rückfallebene im Werkzeug (`node tools/build.mjs --old-humans`), werden aber nicht mehr eingebettet.

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

Urheber:innen der verwendeten Assets (laut Paket): MakeHuman-Team, bogdan666, cortu, culturalibre, cutoff3d, darthfurby, frankyaye, joepal, kwnet, mindfront, namuhekam, o4saken, rehmanpolanski, toigo.

## Stimme

Stufe 2 laut Auftrag (offenes Modell, kein API-Schlüssel vorhanden): **Coqui XTTS v2** mit eingebauten, synthetischen
Studiosprechern – keine geklonte reale Person. Auswahl nach Prüfsätzen (Rückerkennung mit Whisper, Signalqualität mit SQUIM),
Details in `docs/AUDIO.md`. Deutsch (XTTS): Prof. Haferkorn „Damien Black“, Nachbarin „Daisy Studious“,
Studierende „Sofia Hellen“ / „Andrew Chipper“; Lizenz der Modellausgabe CPML, nicht-kommerziell. Englisch (Kokoro-82M, Apache-2.0):
Prof „bm_daniel“, Nachbarin „bf_emma“, Studierende „af_heart“ / „am_michael“.
Mit einem Azure-Schlüssel (`AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`) kann die Stimme gegen „de-AT-JonasNeural“
(österreichisches Deutsch) ausgetauscht werden.

## Materialien (ambientCG, CC0)

Verarbeitet mit `tools/pipeline/textures.mjs` (KTX2: Farbe ETC1S, Normalen UASTC, ORM).

| Material | Verwendung | Quelle |
|---|---|---|
| WoodFloor052 | Fischgrätparkett | https://ambientcg.com/view?id=WoodFloor052 |
| Wood066 | Pultbänke, Tische | https://ambientcg.com/view?id=Wood066 |
| Wood060 | Vertäfelung | https://ambientcg.com/view?id=Wood060 |
| Plaster001 | Wände | https://ambientcg.com/view?id=Plaster001 |
| Plaster002 | Decke | https://ambientcg.com/view?id=Plaster002 |
| Fabric030 | Rollos | https://ambientcg.com/view?id=Fabric030 |
| Fabric066 | Stoffe | https://ambientcg.com/view?id=Fabric066 |
| Metal032 | Aluminium | https://ambientcg.com/view?id=Metal032 |
| Metal048A | Messing | https://ambientcg.com/view?id=Metal048A |
| Metal055A | Stahl | https://ambientcg.com/view?id=Metal055A |
| Leather030 | Leder braun | https://ambientcg.com/view?id=Leather030 |
| Leather026 | Leder schwarz | https://ambientcg.com/view?id=Leather026 |
| Marble021 | Fensterbank | https://ambientcg.com/view?id=Marble021 |
| Asphalt031 | Straße | https://ambientcg.com/view?id=Asphalt031 |
| PavingStones128 | Gehsteig | https://ambientcg.com/view?id=PavingStones128 |
| PavingStones150 | Kopfsteinpflaster | https://ambientcg.com/view?id=PavingStones150 |
| Grass001 | Wiese | https://ambientcg.com/view?id=Grass001 |

## Requisiten (Poly Haven, CC0)

Verarbeitet mit `tools/pipeline/props.mjs` (vereinfacht, KTX2, Meshopt).

| Modell | Verwendung | Urheber:in | Dreiecke | Quelle |
|---|---|---|---|---|
| Wall Clock | Wanduhr über der Tafel | PierreB3D | 2504 | https://polyhaven.com/a/wall_clock |
| Potted Plant 01 | Pflanze Fensterbank | Rico Cilliers | 9764 | https://polyhaven.com/a/potted_plant_01 |
| Food Apple 01 | Apfel am Platz | Oliver Harries | 800 | https://polyhaven.com/a/food_apple_01 |
| Potted Plant 02 | Pflanze neben dem Pult | Rico Cilliers | 8948 | https://polyhaven.com/a/potted_plant_02 |
| Potted Plant 04 | Pflanze hinten | James Ray Cock | 8929 | https://polyhaven.com/a/potted_plant_04 |
| Book Encyclopedia Set 01 | Fachbücher am Vortragstisch | John Malcolm | 21765 | https://polyhaven.com/a/book_encyclopedia_set_01 |
| Croissant | Croissant am Platz | Greg Zaal, Dario Barresi | 1198 | https://polyhaven.com/a/croissant |
| Modified Thermos | Thermosflasche | Alex Weber | 2388 | https://polyhaven.com/a/modified_thermos |
| Plastic Thermos | Thermosflasche | PierreB3D | 1500 | https://polyhaven.com/a/plastic_thermos |
| Jug 01 | Krug am Vortragstisch | Kuutti Siitonen | 1500 | https://polyhaven.com/a/jug_01 |
| Cardboard Box 01 | Karton hinten | Rahul Chaudhary | 300 | https://polyhaven.com/a/cardboard_box_01 |
| Vintage Microscope | Mikroskop am Vortragstisch | Luis José Fernández Rodríguez | 5057 | https://polyhaven.com/a/vintage_microscope |
| Chemistry Set | Glasgeräte am Vortragstisch | Jiří Ptáček | 7031 | https://polyhaven.com/a/chemistry_set |
| Magnifying Glass 01 | Lupe | Nazar Borodavka | 997 | https://polyhaven.com/a/magnifying_glass_01 |
| Desk Lamp Arm 01 | Pultlampe | Yann Kervran, Kuutti Siitonen | 3148 | https://polyhaven.com/a/desk_lamp_arm_01 |
| School Chair 01 | Stuhl vorne | Ethan Place | 3000 | https://polyhaven.com/a/SchoolChair_01 |
| Hanging Picture Frame 02 | Bilderrahmen | James Ray Cock | 601 | https://polyhaven.com/a/hanging_picture_frame_02 |
| Marble Bust 01 | Büste in der Ecke | Rico Cilliers | 6000 | https://polyhaven.com/a/marble_bust_01 |
| Wicker Basket 01 | Korb mit Heuproben | Kuutti Siitonen | 2468 | https://polyhaven.com/a/wicker_basket_01 |
| Wooden Crate 01 | Kiste mit Futterproben | James Ray Cock | 850 | https://polyhaven.com/a/wooden_crate_01 |
| Plastic Crate 01 | Kiste | PierreB3D | 10350 | https://polyhaven.com/a/plastic_crate_01 |
| Rubber Duck Toy | Gummiente am Pult | Plat251 | 800 | https://polyhaven.com/a/rubber_duck_toy |
| Medical Box | Erste-Hilfe-Kasten | Ulan Cabanilla | 676 | https://polyhaven.com/a/medical_box |
| Dustpan | Kehrschaufel | Balen | 600 | https://polyhaven.com/a/dustpan |
| Plastic Broom | Besen | L | 3915 | https://polyhaven.com/a/plastic_broom |
| Measuring Tape 01 | Maßband | Kuutti Siitonen | 800 | https://polyhaven.com/a/measuring_tape_01 |
| Vintage Stapler | Heftmaschine | Mateusz Sadek | 1146 | https://polyhaven.com/a/vintage_stapler |
| Ceramic Vase 01 | Vase | James Ray Cock | 1222 | https://polyhaven.com/a/ceramic_vase_01 |
| Lemon | Zitrone | Kuutti Siitonen | 600 | https://polyhaven.com/a/lemon |
| Wooden Bookshelf Worn | Bücherregal | Ulan Cabanilla | 3000 | https://polyhaven.com/a/wooden_bookshelf_worn |
| Seedling Tray 01 | Anzuchtschale auf der Fensterbank (BOKU) | Satyaki Mandal | 2000 | https://polyhaven.com/a/seeding_tray_01 |
| Planter Pot Clay | Tontopf auf der Fensterbank | Amal Kumar | 1200 | https://polyhaven.com/a/planter_pot_clay |
| Watering Can Metal 01 | Gießkanne auf der Fensterbank | Charles Nderitu | 2499 | https://polyhaven.com/a/watering_can_metal_01 |
| Binoculars | Fernglas auf der Fensterbank (Vogelbeobachtung) | Derek Wight | 3855 | https://polyhaven.com/a/binoculars |
| Anthurium Botany 01 | Topfpflanze hinten | Rob Tuytel, Rico Cilliers | 3993 | https://polyhaven.com/a/anthurium_botany_01 |
| Calathea Orbifolia 01 | Topfpflanze vorne rechts | Rob Tuytel, Rico Cilliers | 6996 | https://polyhaven.com/a/calathea_orbifolia_01 |
| Ceramic Vase 03 | Vase auf der Fensterbank | James Ray Cock | 1500 | https://polyhaven.com/a/ceramic_vase_03 |
| Office Notepads | Notizblöcke am Vortragstisch | Ulan Cabanilla | 666 | https://polyhaven.com/a/office_notepads |
| Binder Notebook | Ringbuch am Vortragstisch | DaDrood | 2998 | https://polyhaven.com/a/binder_notebook |
| Round Spectacles | Ersatzbrille des Profs | Sean Buckley | 2498 | https://polyhaven.com/a/round_spectacles |
| Wooden Bowl 01 | Holzschale mit Futterprobe | Oliver Harries | 2000 | https://polyhaven.com/a/wooden_bowl_01 |
| Alarm Clock 01 | Wecker am Vortragstisch (Zeitansage) | Yann Kervran, James Ray Cock | 2517 | https://polyhaven.com/a/alarm_clock_01 |
| Bunsen Burner | Bunsenbrenner (Vorführung) | BKS | 2498 | https://polyhaven.com/a/bunsen_burner |
| Digital Wrist Watch | Armbanduhr auf einem Pult | Adrian C | 2997 | https://polyhaven.com/a/digital_wrist_watch |
| Hamburger Buns | Weckerl am Pult | Alexander Shulha | 1996 | https://polyhaven.com/a/hamburger_buns |
| Pears Asian 01 | Birne am Pult | Amal Kumar | 1198 | https://polyhaven.com/a/food_pears_asian_01 |
| Food Kiwi 01 | Kiwi am Pult | Oliver Harries | 800 | https://polyhaven.com/a/food_kiwi_01 |
| Gamepad | Controller auf einem Pult | Josh Dean | 2500 | https://polyhaven.com/a/gamepad |
| Fire Alarm | Rauchmelder an der Decke | Slinc | 1275 | https://polyhaven.com/a/fire_alarm |
| Korean Fire Extinguisher 01 | Feuerlöscher an der Wand | UM JOORIN | 3079 | https://polyhaven.com/a/korean_fire_extinguisher_01 |
| Power Box 01 | Verteilerkasten an der Rückwand | Rico Cilliers, Yann Kervran | 3993 | https://polyhaven.com/a/power_box_01 |
| Utility Box 01 | Wandkasten neben der Tür | James Ray Cock | 1500 | https://polyhaven.com/a/utility_box_01 |
| Wet Floor Sign 01 | Warnschild Rutschgefahr (Regentag) | Fran Calvente | 228 | https://polyhaven.com/a/WetFloorSign_01 |
| Drawer Cabinet | Schubladenschrank auf dem Podium | Ulan Cabanilla | 4590 | https://polyhaven.com/a/drawer_cabinet |
| Shelf 01 | Wandregal hinten | Gabriel Radić | 182 | https://polyhaven.com/a/Shelf_01 |
| Hanging Picture Frame 01 | Bild an der Wand | James Ray Cock | 1501 | https://polyhaven.com/a/hanging_picture_frame_01 |
| Hanging Picture Frame 03 | Bild an der Wand | James Ray Cock | 2993 | https://polyhaven.com/a/hanging_picture_frame_03 |
| Fancy Picture Frame 01 | Bild an der Wand | Rob Tuytel, Rico Cilliers | 938 | https://polyhaven.com/a/fancy_picture_frame_01 |
| Side Table 01 | Beistelltisch neben dem Pult | James Ray Cock | 1500 | https://polyhaven.com/a/side_table_01 |
| Plastic Monobloc Chair 01 | Stuhl für Gäste vorne | Kuutti Siitonen | 2000 | https://polyhaven.com/a/plastic_monobloc_chair_01 |
| Metal Stool 02 | Hocker am Podium | Ulan Cabanilla | 1999 | https://polyhaven.com/a/metal_stool_02 |
| Wicker Basket 02 | Korb mit Proben | Kuutti Siitonen | 3998 | https://polyhaven.com/a/wicker_basket_02 |
| Plastic Crate 02 | Kunststoffkiste hinten | Fabi_G | 2500 | https://polyhaven.com/a/plastic_crate_02 |
| Wooden Crate 02 | Holzkiste hinten | James Ray Cock, Jurita Burger | 2499 | https://polyhaven.com/a/wooden_crate_02 |
| All Purpose Cleaner | Reiniger beim Besen | Kuutti Siitonen | 1500 | https://polyhaven.com/a/all_purpose_cleaner |
| Mousetrap | Mausefalle in der Ecke | GreenPixel | 1499 | https://polyhaven.com/a/mousetrap |
| Street Lamp 01 | Straßenlaterne (Außenwelt) | Josh Dean | 5185 | https://polyhaven.com/a/street_lamp_01 |
| Planter Box 02 | Pflanztrog am Gehsteig | James Ray Cock | 3000 | https://polyhaven.com/a/planter_box_02 |
| Painted Wooden Bench | Bank im Park | Kirill Sannikov | 630 | https://polyhaven.com/a/painted_wooden_bench |
| Lightbulb Led | Ersatzlampe am Vortragstisch | Josh Dean | 799 | https://polyhaven.com/a/lightbulb_led |
| Television 02 | Alter Fernseher auf dem Regal hinten | Benny Weimer | 2000 | https://polyhaven.com/a/television_02 |
| Vintage Telephone Wall Clock | Wandtelefon (Hausapparat) neben der Tür | Adrian C | 3999 | https://polyhaven.com/a/vintage_telephone_wall_clock |

## Geräusche, Musik und Hall (echte Aufnahmen)

Aufbereitet mit `tools/audio/build_sfx.py` aus den Kandidaten in `tools/pipeline/audio_sources.json`
(geladen und geprüft mit `tools/audio/fetch_sfx.py`, Prüfsummen dort; Recherche: `docs/AUDIO_QUELLEN.md`, Übersicht und Clipliste: `docs/AUDIO.md`).
Der Hall (`irFront`, `irBack`) stammt aus echten Impulsantworten eines Hörsaals (TU Berlin, Auditorium 3; `tools/audio/extract_ir.py`).
CC-BY-Aufnahmen sind im Spiel unter „Impressum, Quellen & Lizenzen“ genannt.

| Klang | Lizenz | Herkunft |
|---|---|---|
| bird | CC0-1.0 | https://opengameart.org/content/ambient-bird-sounds (CC0-1.0) |
| bird | CC0-1.0 | https://opengameart.org/content/crows-singing (CC0-1.0) |
| bird | PDM-1.0 | https://archive.org/details/aporee_60623_69666 (PDM-1.0) |
| bird | CC-BY-4.0 | "Birds Singing In A Peaceful Park Sound Effect" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| boardSlide | CC-BY-4.0 | "Sliding Door Sounds" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| boardSlide | CC-BY-4.0 | "Rock/Metal Slide" by Varkalandar – https://opengameart.org/content/rockmetal-slide – CC BY 4.0 |
| bottleDrop, chairCreak, cough, doorClose, doorOpen, laughSoft, micThump, penClick, stepCarpet, throatClear, heart, keyboards, laughSmall, laughMid, laughBig, cutlery, highlighter, murmurQuiet, paperTear, sneeze, yawn | Public-Domain | https://pdsounds.tuxfamily.org/list.html (Public-Domain) |
| breath, clicker, cloth, cough, coughHigh, hinge, lidClose, micThump, pageTurn, penWrite, phoneVibrate, stepCarpet, stepParquet, stepStair, touchpad, zipper, uiClick, laughSmall, laughMid, laughBig, bag, shush, yawn | CC0-1.0 | https://opengameart.org/content/sound-effects-pack (CC0-1.0) |
| chairCreak | CC-BY-4.0 | "The Linke Hofman Standard tram – the bench" – recorded by Museum of Municipal Engineering, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-bench/) – CC BY 4.0 |
| chairCreak, pageTurn | CC0-1.0 | https://opengameart.org/content/various-sound-effects (CC0-1.0) |
| chalkScratch, chalkTap | CC-BY-4.0 | "Chalk" – recorded by La Fonderie, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/chalk/) – CC BY 4.0 |
| clicker, touchpad, uiClick | CC0-1.0 | https://opengameart.org/content/middle-mouse-click (CC0-1.0) |
| cloth, bag | CC0-1.0 | https://opengameart.org/content/202-more-sound-effects (CC0-1.0) |
| cough, laughMid, laughBig | CC0-1.0 | https://opengameart.org/content/old-man-cough (CC0-1.0) |
| cough | CC0-1.0 | https://opengameart.org/content/sick-noises (CC0-1.0) |
| coughHigh | CC-BY-4.0 | "Coughing Sound Effect" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| doorBang, doorClose, doorOpen | CC0-1.0 | https://opengameart.org/content/door-open-door-close-set (CC0-1.0) |
| glass, cupDown | CC0-1.0 | https://opengameart.org/content/100-cc0-sfx (CC0-1.0) |
| glass, cupDown | CC-BY-4.0 | "Cup On Table Sfx Sound Effect" – Sound Effect By Nicole Marie T – https://opengameart.org/content/cup-on-table-sfx-sound-effect – CC BY 4.0 |
| keyClick, ttPlace, keyboards | CC0-1.0 | https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes (CC0-1.0) |
| keyClick, ttPlace | CC-BY-4.0 | "Computer work at home" – recorded by Erik Pålsson, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/computer-work-at-home/) – CC BY 4.0 |
| laughSoft, laughSmall, laughMid, laughBig | CC0-1.0 | https://opengameart.org/content/group-giggling (CC0-1.0) |
| murmur, murmurBurst | CC-BY-4.0 | "Audience Murmur Sound Effect" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| murmurBurst | PDM-1.0 | https://archive.org/details/aporee_36189_41517 (PDM-1.0) |
| music | CC-BY-4.0 | "Almost Bliss" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/ |
| pageTurn | CC-BY-4.0 | "Page Turning Sfx Sound Effect" – Sound Effect By Nicole Marie T – https://opengameart.org/content/page-turning-sfx-sound-effect – CC BY 4.0 |
| penClick | CC-BY-4.0 | "Pen Click Sfx Sound Effect" – Sound Effect By Nicole Marie T – https://opengameart.org/content/pen-click-sfx-sound-effect – CC BY 4.0 |
| phoneRing | CC-BY-4.0 | "Phone Ring Sound Effect" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| phoneRing | CC-BY-4.0 | "Old Cell Phone Ringing Sound Effect" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| phoneVibrate | CC-BY-4.0 | "Vibrating Sound" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| pour | CC-BY-4.0 | "Pouring Water" – Downloaded from www.freesoundslibrary.com (Free Sounds Library, Spanac), CC BY 4.0 |
| projectorFan | CC-BY-4.0 | "Fan - Cinema projector" – recorded by La Fonderie, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/fan-cinema-projector/) – CC BY 4.0 |
| rain | CC-BY-4.0 | "Rain on a window: A soundscape" – recorded by Fredrik Johansson, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/rain-on-a-window-a-soundscape/) – CC BY 4.0 |
| roomTone | PDM-1.0 | https://archive.org/details/aporee_35419_40679 (PDM-1.0) |
| seatFlip | CC-BY-4.0 | "Cinema seat" – recorded by La Fonderie, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/cinema-seat/) – CC BY 4.0 |
| sponge | CC-BY-4.0 | "Wet sponge" – recorded by La Fonderie, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/wet-sponge-2/) – CC BY 4.0 |
| stepParquet | CC-BY-4.0 | "Creaking floors" – recorded by Torsten Nilsson, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/creaking-floors/) – CC BY 4.0 |
| stepParquet | CC0-1.0 | https://opengameart.org/content/50-rpg-sound-effects (CC0-1.0) |
| stepStair | CC-BY-4.0 | "Stairwell" – recorded by Torsten Nilsson, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/stairwell/) – CC BY 4.0 |
| traffic | PDM-1.0 | https://archive.org/details/aporee_34806_40011 (PDM-1.0) |
| tramBell | CC-BY-4.0 | "The Linke Hofman Standard tram – the bell (recorded from the outside)" – recorded by Museum of Municipal Engineering, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-bell-recorded-from-the-outside/) – CC BY 4.0 |
| tramBell | CC-BY-4.0 | "The SN4 type tram – the bell (recorded from the outside)" – recorded by Museum of Municipal Engineering, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/the-sn4-type-tram-the-bell-recorded-from-the-outside/) – CC BY 4.0 |
| tramBell | CC-BY-4.0 | "The N tram – the bell (recorded from the outside)" – recorded by Museum of Municipal Engineering, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/the-n-tram-the-bell-recorded-from-the-outside/) – CC BY 4.0 |
| ventilation | CC-BY-4.0 | "Bathroom fan" – recorded by Erik Pålsson, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/bathroom-fan/) – CC BY 4.0 |
| wind | CC0-1.0 | https://opengameart.org/content/park-ambiences (CC0-1.0) |
| good, quizSting, sting | CC-BY-4.0 | "Clear Waters" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 – einzelne Klaviertöne als Signal |
| micFeedback | CC-BY-4.0 | "The Linke Hofman Standard tram – the bell (recorded from the outside)" – recorded by Museum of Municipal Engineering, Work With Sounds (EU-Projekt, http://soundsofchanges.eu/sound/the-linke-hofman-standard-tram-the-bell-recorded-from-the-outside/) – CC BY 4.0 – bearbeitet (Rückkopplungston) |
| laughSmall, laughMid, laughBig | CC0-1.0 | https://opengameart.org/content/do-you-remember-laughter (CC0-1.0) |
| irBack, irFront | CC-BY-4.0 | "Binaural room impulse responses recorded with KEMAR in a mid-size lecture hall" (Auditorium 3, TU Berlin) – H. Wierstorf, M. Geier, Zenodo, doi:10.5281/zenodo.160749 – CC BY 4.0 |
| appleBite | CC0-1.0 | https://opengameart.org/content/apple-bite (CC0-1.0) |
| appleBite | CC0-1.0 | https://opengameart.org/content/7-eating-crunches (CC0-1.0) |
| bag | CC-BY-3.0 | "Inventory Bag" by spookymodem (opengameart.org/content/inventory-bag) – CC BY 3.0 |
| birds | PDM-1.0 | https://archive.org/details/aporee_70348_82012 (PDM-1.0) |
| corridor | PDM-1.0 | https://archive.org/details/aporee_26981_72131 (PDM-1.0) |
| cupDown, cutlery | CC0-1.0 | https://opengameart.org/content/cutlery-sounds (CC0-1.0) |
| murmurBreak | PDM-1.0 | https://archive.org/details/aporee_31068_35712 (PDM-1.0) |
| paperTear | CC0-1.0 | https://opengameart.org/content/various-paper-sound-effects (CC0-1.0) |
| rainHeavy | PDM-1.0 | https://archive.org/details/aporee_60048_68965 (PDM-1.0) |
| shush | CC-BY-3.0 | "No Talking in The Library!" by jdagenet (Jason Dagenet), opengameart.org – CC BY 3.0 |
| sneeze | CC0-1.0 | https://opengameart.org/content/genuine-sneeze-sound (CC0-1.0) |
| sneeze | CC0-1.0 | https://opengameart.org/content/sneeze (CC0-1.0) |
| streetFar | PDM-1.0 | https://archive.org/details/aporee_60629_69672 (PDM-1.0) |
