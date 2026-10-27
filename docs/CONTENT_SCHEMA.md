# Inhaltsschema (verbindlich für alle Inhaltsdateien)

Alle Inhalte liegen als **UTF-8-JSON** unter `src/content/`. Die Engine lädt sie beim Build ein. Jede Datei muss mit
`node -e "JSON.parse(require('fs').readFileSync('<datei>','utf8'))"` fehlerfrei parsebar sein.

Grundsätze:
- **Fachlich korrekt** (Bachelor-Niveau, deutschsprachige Lehrbücher: Kirchgeßner „Tierernährung“, Jeroch/Drochner/Simon „Ernährung landwirtschaftlicher Nutztiere“, GfE-Empfehlungen, DLG-Futterwerttabellen, Gruber-Tabelle (Österreich), LK Österreich / HBLFA Raumberg-Gumpenstein). Zahlen nur, wenn plausibel und belegbar. Lieber eine Größenordnung („rund 6,5 MJ NEL“) als eine falsche Kommastelle.
- **Gesprochene Sprache**, österreichisch gefärbt, aber nicht übertrieben: „Grüß Gott“, „eh“, „schauen wir uns an“, „gell“ höchstens selten. Der Prof liest **nie** die Folie vor, er erklärt, gibt Beispiele aus der Praxis (Milchviehbetrieb im Mostviertel, Almweide, Schweinemast in der Steiermark, Versuchswirtschaft), stellt rhetorische Fragen, verweist zurück („wie wir vorhin bei der Weender Analyse gesehen haben“). Einzelne natürliche Füllwörter („also“, „sozusagen“, „äh“) sparsam.
- **Kein Klamauk**, keine Witze über Studierende, keine Übertreibung. Trockener Humor höchstens einmal pro Abschnitt.
- **Keine realen Personen** (keine echten Lehrenden/Mitarbeiter:innen der BOKU). Der Prof heißt „Prof. Haferkorn“ (fiktiv). Institutionen dürfen genannt werden.
- **Englisch (`en`) ist eine vollständige, idiomatische Übersetzung**, Beat für Beat, Variante für Variante, gleiche Reihenfolge, gleiche Anzahl Elemente. Fachbegriffe englisch korrekt (net energy for lactation, NEL; utilisable crude protein at the duodenum, uCP/nXP; ruminal nitrogen balance, RNB …). Der Prof spricht im englischen Modus wie ein österreichischer Professor, der eine englische Lehrveranstaltung hält (natürlich, nicht übertrieben).

---

## 1. Vorlesungsabschnitte: `src/content/sections/NN_id.json`

```json
{
  "id": "analytik",
  "order": 2,
  "core": true,
  "plannedMinutes": 7,
  "de": {
    "title": "Futtermittelanalytik",
    "subtitle": "Weender Analyse und Gerüstsubstanzen nach Van Soest",
    "learningGoals": ["…", "…", "…"],
    "slides": [
      {
        "title": "Die Weender Futtermittelanalyse",
        "bullets": ["…", "…", "…", "…"],
        "diagram": { "type": "stack", "parts": [{ "label": "Wasser", "value": 12 }], "unit": "%" },
        "source": "nach Kirchgeßner et al. (2014)"
      }
    ],
    "board": [
      { "id": "b1", "lines": ["XP = N × 6,25", "NfE = TM − (XA + XP + XL + XF)"] }
    ],
    "beats": [
      {
        "variants": ["Satz A (Variante 1)", "Satz A (Variante 2)", "Satz A (Variante 3)"],
        "slide": 0,
        "board": null,
        "look": "class",
        "gesture": "explain",
        "pause": 0.6
      }
    ],
    "quiz": [
      { "q": "…?", "correct": "…", "wrong": ["…", "…", "…"], "explain": "Ein Satz Begründung.", "calc": false }
    ],
    "calc": {
      "title": "Rohprotein aus Stickstoff",
      "given": "Heuprobe: 2,1 % N in der TM",
      "steps": ["XP = 2,1 % × 6,25", "XP = 13,1 % der TM"],
      "result": "≈ 131 g XP/kg TM"
    },
    "notes": ["Weender: TM, XA, XP, XL, XF, NfE", "XP = N × 6,25 (16 % N)", "…"],
    "script": "Ein zusammenhängender Skriptum-Absatz (150–250 Wörter) im Stil eines Vorlesungsskriptums, sachlich, für den PDF-Reader am Laptop."
  },
  "en": { "…": "identische Struktur, vollständig übersetzt" }
}
```

### Feldregeln

| Feld | Regel |
|---|---|
| `order` | Reihenfolge im Lehrplan (1–15). |
| `core` | `true` = wird nie übersprungen. Höchstens 8 Abschnitte `core: true`. |
| `plannedMinutes` | geplante Vorlesungsminuten (Spielzeit), Summe aller Abschnitte ≈ 100–120 (Director kürzt). |
| `learningGoals` | 2–4 Lernziele, je ≤ 100 Zeichen. |
| `slides` | 1–2 Folien. `bullets`: 3–6 Punkte, je **≤ 70 Zeichen**. `diagram` siehe unten (Pflicht). `source`: kurze Quellenangabe. |
| `board` | 2–3 Tafelblöcke. `lines`: 2–5 Zeilen, je **≤ 30 Zeichen**. Erlaubte Zeichen siehe unten. |
| `beats` | **8–10 Beats** pro Abschnitt, jeder mit **genau 3 Varianten** (gleicher Inhalt, andere Formulierung, je 1–2 Sätze, **≤ 220 Zeichen**). |
| `beats[].slide` | Index der Folie (0/1), die ab diesem Beat gezeigt wird, sonst `null`. Der erste Beat hat `"slide": 0`. |
| `beats[].board` | ID eines Tafelblocks, den der Prof **während** dieses Beats anschreibt, sonst `null`. Jeder Tafelblock wird genau einmal referenziert. |
| `beats[].look` | `class` · `board` · `screen` · `notes` · `window` · `student` (schaut eine:n Studierende:n an). |
| `beats[].gesture` | `explain` · `count` · `question` · `emphasis` · `open` · `point` · `shrug` · `pocket` · `glasses`. |
| `beats[].pause` | Pause danach in Sekunden (0.3–1.5). |
| `quiz` | **genau 3** Fragen, genau eine mit `"calc": true` (Rechenaufgabe mit Zahlen aus der Vorlesung). `correct` + **3** `wrong`, je ≤ 60 Zeichen. Falsche Antworten plausibel, nicht albern. Antworten müssen aus Beats/Folien/Tafel ableitbar sein. |
| `calc` | Ein Rechenbeispiel, das an die Tafel kann (`steps` ≤ 30 Zeichen je Zeile, max. 5 Schritte). |
| `notes` | 4–6 Stichwörter für die Mitschrift (je ≤ 45 Zeichen). |
| `script` | 150–250 Wörter. |

### Erlaubte Zeichen auf der Tafel (`board.lines`, `calc.steps`)
Buchstaben A–Z, a–z, ä ö ü Ä Ö Ü ß, Ziffern, Leerzeichen und `. , : ; ! ? ( ) [ ] / + - = % ' " < > * _ ^ { }`
sowie: `→ ← ↑ ↓ × · − ≈ ≤ ≥ ° µ Σ Δ ~`.
Hochgestellt: `^{0,75}` · Tiefgestellt: `_{2}` (z. B. `CH_{4}`, `LM^{0,75}`). Keine anderen Unicode-Zeichen, keine Emojis.

### Diagrammtypen (`slides[].diagram`)
```jsonc
{ "type": "flow",    "items": ["Futter", "Tier", "Lebensmittel"], "direction": "right", "highlight": 1 }
{ "type": "stack",   "parts": [{ "label": "Wasser", "value": 12 }, …], "unit": "%" }
{ "type": "bars",    "items": [{ "label": "Heu", "value": 5.3 }, …], "unit": "MJ NEL/kg TM", "max": 8 }
{ "type": "cascade", "levels": [{ "label": "GE", "value": 100 }, { "label": "DE", "value": 68 }, …], "losses": ["Kot", "Harn + CH₄", "Wärme"] }
{ "type": "line",    "x": [0, 2, 4], "y": [6.6, 6.0, 5.8], "xLabel": "Stunden nach Fütterung", "yLabel": "Pansen-pH", "threshold": { "value": 5.8, "label": "Azidose-Risiko" } }
{ "type": "table",   "head": ["Futtermittel", "TM %", "MJ NEL/kg TM"], "rows": [["Heu", "86", "5,3"], …] }
{ "type": "stomach", "highlight": "pansen" }            // highlight: pansen | netzmagen | blaettermagen | labmagen
{ "type": "barrel",  "staves": [{ "label": "Lys", "value": 0.55 }, …] }   // value 0–1, kleinste Daube = limitierend
{ "type": "cycle",   "items": ["Boden", "Pflanze", "Tier", "Wirtschaftsdünger"] }
{ "type": "pie",     "parts": [{ "label": "Essigsäure", "value": 65 }, …], "unit": "%" }
```
Labels in Diagrammen ≤ 18 Zeichen, max. 8 Einträge, max. 6 Tabellenzeilen × 4 Spalten.

---

## 2. Dialoge & Ereignisse: `src/content/dialogue.json`

```json
{
  "de": {
    "<schlüssel>": ["Variante 1", "Variante 2", "…"]
  },
  "en": { "<schlüssel>": ["…"] }
}
```
Gleiche Schlüssel in `de` und `en`, gleiche Anzahl Varianten. Jeder Schlüssel hat **mindestens 3, besser 4–6 Varianten**
(damit sich innerhalb eines Durchlaufs nichts wörtlich wiederholt). `{name}`, `{row}`, `{minutes}`, `{section}` sind erlaubte Platzhalter.

Pflicht-Schlüssel (Sprecher:in in Klammern):

| Schlüssel | Situation |
|---|---|
| `mic_check` (Prof) | Mikro-Test zu Beginn („Hört man mich hinten?“) |
| `projector_wait` (Prof) | Beamer fährt hoch, Prof überbrückt |
| `greeting` (Prof) | Begrüßung, akademisches Viertel |
| `smalltalk` (Prof) | kurzer Smalltalk vor Beginn (Erntedankfest, Wetter, Exkursion, Semesterbeginn) |
| `recap` (Prof) | Wiederholung „letzte Woche“ (allgemein formuliert) |
| `agenda` (Prof) | „Heute schauen wir uns … an“ ({section} = erster Abschnitt) |
| `transition` (Prof) | Überleitung zum nächsten Abschnitt ({section}) |
| `latecomer_enter` (Studi) | Spätkommer:in murmelt Entschuldigung |
| `latecomer_prof` (Prof) | Prof-Reaktion auf Spätkommer:in (freundlich-trocken) |
| `phone_ring_prof` (Prof) | Handy klingelt im Saal |
| `phone_ring_student` (Studi) | Studi entschuldigt sich leise |
| `audience_question` | siehe unten (eigene Struktur) |
| `projector_lost` (Prof) | Beamer verliert Signal |
| `projector_fixing` (Prof) | murmelt beim Kabelwackeln |
| `projector_back` (Prof) | Bild ist wieder da |
| `long_calc_intro` (Prof) | „Rechnen wir das einmal durch …“ |
| `long_calc_step` (Prof) | Kommentar zwischen Rechenschritten |
| `long_calc_end` (Prof) | Ergebnis einordnen |
| `aisle_walk` (Prof) | Prof geht in den Mittelgang/die Reihen hoch |
| `aisle_return` (Prof) | Prof geht zurück nach vorne |
| `attendance_start` (Prof) | Anwesenheitsliste geht herum |
| `attendance_neighbor` (Nachbar:in) | reicht dir die Liste weiter |
| `attendance_collect` (Prof) | Liste am Ende einsammeln |
| `direct_question_intro` (Prof) | spricht dich direkt an ({row}) |
| `quiz_right` (Prof) | Lob nach richtiger Antwort |
| `quiz_wrong` (Prof) | Korrektur nach falscher Antwort (sachlich, ohne Bloßstellen) |
| `quiz_timeout` (Prof) | keine Antwort |
| `neighbor_warn` (Nachbar:in, Flüstern) | „Psst, er schaut“ |
| `neighbor_betray` (Nachbar:in) | verrät dich subtil (räuspert sich, schaut demonstrativ) – als Beschreibungstext in Klammern + Satz |
| `neighbor_smalltalk` (Nachbar:in, Flüstern) | kurze Flüster-Bemerkungen zum Stoff |
| `joke` (Prof) | trockener Fachwitz (≥ 8 Varianten, realistisch, z. B. „Die Kuh ist eine Gärkammer auf vier Beinen – kein Wunder, dass der Pansen mehr Mikroben hat als Wien Einwohner.“ – Fakten müssen stimmen!) |
| `drink` (Prof) | „Moment …“ trinkt Wasser |
| `clock_check` (Prof) | schaut auf die Uhr, beschleunigt |
| `break_announce` (Prof) | kündigt 5 Minuten Pause an |
| `break_end` (Prof) | Pause vorbei |
| `board_wipe` (Prof) | wischt die Tafel |
| `board_slide` (Prof) | schiebt die Tafel hoch |
| `mic_feedback` (Prof) | nach Rückkopplung |
| `blinds` (Prof) | Sonne blendet auf Leinwand → bittet, die Jalousie runterzulassen |
| `rain_start` (Prof) | bemerkt Regen |
| `door_bang` (Prof) | Tür fällt laut zu |
| `leaves_early` (Prof) | jemand geht früher |
| `cough_fit` (Prof) | wartet auf Hustenanfall, bietet Wasser an |
| `light_flicker` (Prof) | Deckenlicht flackert |
| `bottle_drop` (Prof) | Flasche fällt runter |
| `exam_hint` (Prof) | „Das kommt zur Prüfung“ (≥ 6 Varianten, mit {section}) |
| `slides_online` (Prof) | Folien sind auf BOKUlearn |
| `attention_hm` (Prof) | kurze Irritation, wenn er dich bemerkt („Hm.“, „Alles klar da hinten?“) |
| `attention_lock` (Prof) | schaut länger in deine Richtung, macht kurze Pause |
| `caught_1` (Prof) | 1. Verwarnung (ruhig, bestimmt) |
| `caught_2` (Prof) | 2. Verwarnung (deutlicher) |
| `caught_3_kick` (Prof) | 3. Verwarnung: Hörsaalverweis (sachlich) |
| `caught_3_move` (Prof) | 3. Verwarnung bei hohem Fleiß: „Setzen Sie sich bitte nach vorne.“ |
| `opponent_caught` (Prof) | erwischt deine:n Gegner:in ({row}) |
| `tutor_pass` (Tutor:in) | Tutor:in flüstert beim Vorbeigehen |
| `closing` (Prof) | Schluss, Ausblick nächste Woche |
| `exam_info` (Prof) | Prüfungsinfo am Ende (Anmeldung über BOKUonline) |
| `chat_opponent_wait` (Gegner:in, Chat, kurz, Kleinschreibung ok) | „warte, er schaut zu mir“ |
| `chat_opponent_move` (Chat) | nach eigenem Zug („du bist“, „dein zug“) |
| `chat_opponent_win` (Chat) | gewinnt Runde |
| `chat_opponent_lose` (Chat) | verliert Runde |
| `chat_opponent_draw` (Chat) | Remis |
| `chat_opponent_idle` (Chat) | Smalltalk im Chat (Mensa, Prüfung, TÜWI) |
| `chat_opponent_caught` (Chat) | nachdem er/sie erwischt wurde |
| `chat_you_caught` (Chat) | nachdem du erwischt wurdest |
| `tutorial_*` | NICHT hier – das macht die Engine. |

### `audience_question` (eigene Struktur, ≥ 12 Einträge, je einem Abschnitt zugeordnet)
```json
"audience_questions": [
  { "section": "analytik", "student": "Frage der/des Studierenden (kurz, natürlich)", "repeat": "Prof wiederholt die Frage fürs Mikro", "answer": ["Antwortsatz 1", "Antwortsatz 2"] }
]
```
Liegt in `de.audience_questions` bzw. `en.audience_questions` (gleiche Reihenfolge).
