"""Sprechfassung der Untertitel (Auftrag V3, Phase 6; DIALOG.md §9): Zahlen, Einheiten und Fachabkürzungen so ausschreiben,
wie Prof. Haferkorn sie sagen würde. Der Untertitel bleibt unverändert; nur die Sprachsynthese bekommt diese Fassung.

    from normalize import speech
    speech('rund 160 l Speichel und 6,2 MJ NEL', 'de')  ->  'rund hundertsechzig Liter Speichel und sechs Komma zwei Megajoule en-e-el'
"""
import re
from num2words import num2words

# Fachabkürzungen: so, wie man sie im Hörsaal ausspricht (Buchstaben mit Bindestrich liest das Modell einzeln)
ABBR = {
    'de': {
        'NEL': 'en-e-el', 'ME': 'em-e', 'NDF': 'en-de-ef', 'ADF': 'a-de-ef', 'ADL': 'a-de-el', 'peNDF': 'physikalisch effektive en-de-ef',
        'nXP': 'nutzbares Rohprotein', 'XP': 'Rohprotein', 'XF': 'Rohfaser', 'XL': 'Rohfett', 'XA': 'Rohasche', 'XX': 'stickstofffreie Extraktstoffe',
        'NfE': 'stickstofffreie Extraktstoffe', 'TM': 'Trockenmasse', 'RNB': 'er-en-be', 'GfE': 'ge-ef-e', 'DLG': 'de-el-ge', 'EU': 'e-u',
        'DON': 'de-o-en', 'ZEA': 'Zearalenon', 'UDP': 'u-de-pe', 'RDP': 'er-de-pe', 'DCAB': 'de-ce-a-be', 'BHB': 'Beta-Hydroxybutyrat',
        'NOP': 'en-o-pe', 'SARA': 'Sara', 'ECM': 'energiekorrigierte Milch', 'AMEn': 'a-em-e-en', 'PUL': 'pe-u-el', 'LM': 'Lebendmasse',
        'BSE': 'be-es-e', 'CO': 'ce-o', 'VO': 'Verordnung', 'BOKUlearn': 'Boku-Learn', 'BOKUonline': 'Boku-Online', 'BOKU': 'Boku',
        'DL': 'de-el', 'DE': 'de-e', 'CH4': 'Methan', 'CO2': 'ce-o-zwei', 'NH3': 'Ammoniak', 'pH': 'pe-ha', 'Ca': 'Kalzium', 'P': 'Phosphor',
        'Mg': 'Magnesium', 'Na': 'Natrium', 'K': 'Kalium', 'Se': 'Selen', 'VFA': 'flüchtige Fettsäuren', 'TMR': 'te-em-er', 'AT': 'Österreich',
    },
    'en': {
        'NEL': 'N-E-L', 'ME': 'M-E', 'NDF': 'N-D-F', 'ADF': 'A-D-F', 'ADL': 'A-D-L', 'peNDF': 'physically effective N-D-F',
        'uCP': 'utilisable crude protein', 'CP': 'crude protein', 'DM': 'dry matter', 'NFE': 'nitrogen-free extract', 'RNB': 'R-N-B',
        'GfE': 'G-F-E', 'DLG': 'D-L-G', 'EU': 'E-U', 'DON': 'D-O-N', 'ZEA': 'zearalenone', 'UDP': 'U-D-P', 'RDP': 'R-D-P', 'DCAB': 'D-C-A-B',
        'BHB': 'beta-hydroxybutyrate', 'NOP': 'N-O-P', 'SARA': 'Sara', 'ECM': 'energy-corrected milk', 'AMEn': 'A-M-E-N', 'PUL': 'P-U-L',
        'BW': 'body weight', 'GM': 'G-M', 'BSE': 'B-S-E', 'CO': 'C-O', 'BOKUlearn': 'Boku Learn', 'BOKUonline': 'Boku Online', 'BOKU': 'Boku',
        'DL': 'D-L', 'DE': 'D-E', 'CH4': 'methane', 'CO2': 'C-O-two', 'NH3': 'ammonia', 'pH': 'P-H', 'TMR': 'T-M-R',
    },
}
UNITS = {
    'de': {'MJ': 'Megajoule', 'kg': 'Kilogramm', 'g': 'Gramm', 'mg': 'Milligramm', 'l': 'Liter', 'ml': 'Milliliter', 'm': 'Meter', 'cm': 'Zentimeter',
           'mm': 'Millimeter', 'km': 'Kilometer', 'h': 'Stunden', 'd': 'Tage', 'min': 'Minuten', '%': 'Prozent', '°C': 'Grad Celsius', '°': 'Grad', 't': 'Tonnen', 'ha': 'Hektar'},
    'en': {'MJ': 'megajoules', 'kg': 'kilograms', 'g': 'grams', 'mg': 'milligrams', 'l': 'litres', 'ml': 'millilitres', 'm': 'metres', 'cm': 'centimetres',
           'mm': 'millimetres', 'km': 'kilometres', 'h': 'hours', 'd': 'days', 'min': 'minutes', '%': 'per cent', '°C': 'degrees Celsius', '°': 'degrees', 't': 'tonnes', 'ha': 'hectares'},
}
PHRASES = {
    'de': [(r'\bz\. ?B\.', 'zum Beispiel'), (r'\bd\. ?h\.', 'das heißt'), (r'\bu\. ?a\.', 'unter anderem'), (r'\bbzw\.', 'beziehungsweise'), (r'\bca\.', 'circa'),
           (r'\bvs\.', 'gegenüber'), (r'\bNr\.', 'Nummer'), (r'\bProf\.', 'Professor'), (r'\bDr\.', 'Doktor'), (r'\bc\. ?t\.', 'cum tempore'), (r'\bs\. ?t\.', 'sine tempore'),
           (r'\betc\.', 'et cetera'), (r'\bevtl\.', 'eventuell'), (r'\bggf\.', 'gegebenenfalls'), (r'\binkl\.', 'inklusive'), (r'\bmind\.', 'mindestens'), (r'\bmax\.', 'maximal')],
    'en': [(r'\be\. ?g\.', 'for example'), (r'\bi\. ?e\.', 'that is'), (r'\bvs\.', 'versus'), (r'\bapprox\.', 'approximately'), (r'\bProf\.', 'Professor'), (r'\bDr\.', 'Doctor'),
           (r'\betc\.', 'et cetera'), (r'\bNo\.', 'number')],
}
SYM = {'de': {'≈': 'ungefähr ', '~': 'etwa ', '→': ', daraus folgt, ', '×': ' mal ', '+': ' plus ', '=': ' gleich ', ':': ':', '/': ' pro '},
       'en': {'≈': 'about ', '~': 'about ', '→': ', which gives ', '×': ' times ', '+': ' plus ', '=': ' equals ', ':': ':', '/': ' per '}}


def _num(s, lang):
    """'6,25' / '6.25' / '3.000' / '160' -> Wörter"""
    if lang == 'de':
        if re.fullmatch(r'\d{1,3}(\.\d{3})+', s): s = s.replace('.', '')
        if ',' in s:
            a, b = s.split(',', 1)
            return num2words(int(a), lang='de') + ' Komma ' + ' '.join(num2words(int(c), lang='de') for c in b)
        return num2words(int(s), lang='de')
    if re.fullmatch(r'\d{1,3}(,\d{3})+', s): s = s.replace(',', '')
    if '.' in s:
        a, b = s.split('.', 1)
        return num2words(int(a), lang='en') + ' point ' + ' '.join(num2words(int(c), lang='en') for c in b)
    return num2words(int(s), lang='en')


def speech(text, lang):
    t = text
    for pat, rep in PHRASES[lang]: t = re.sub(pat, rep, t)
    # Jahreszahlen
    t = re.sub(r'\b(1[89]\d\d|20\d\d)(er)?\b', lambda m: num2words(int(m.group(1)), lang=lang, to='year') + (m.group(2) or ''), t)
    # Bereiche „8 000–10 000“, „12–15“
    dash = ' bis ' if lang == 'de' else ' to '
    t = re.sub(r'(\d)\s?[–-]\s?(\d)', lambda m: m.group(1) + dash + m.group(2), t)
    # Tausender mit Leerzeichen „4 000“
    t = re.sub(r'\b(\d{1,3})[  ](\d{3})\b', r'\1\2', t)
    # Zahl + Einheit
    units = UNITS[lang]
    upat = '|'.join(sorted((re.escape(u) for u in units), key=len, reverse=True))
    t = re.sub(r'(\d[\d.,]*)\s?(' + upat + r')(?![A-Za-zÄÖÜäöüß])', lambda m: m.group(1) + ' ' + units[m.group(2)], t)
    # Einheiten ohne Zahl („je kg“, „pro MJ“)
    single = {'MJ': 'megajoule', 'kg': 'kilogram', 'mg': 'milligram', 'ml': 'millilitre', 'km': 'kilometre'} if lang == 'en' else {}
    for u in ('MJ', 'kg', 'mg', 'ml', 'km', '°C'):
        t = re.sub(r'(?<![\w°])' + re.escape(u) + r'(?![\w])', single.get(u, units[u]), t)
    # Abkürzungen (ganze Wörter)
    ab = ABBR[lang]
    t = re.sub(r'\b(' + '|'.join(sorted(map(re.escape, ab), key=len, reverse=True)) + r')\b', lambda m: ab[m.group(1)], t)
    # Zahlen
    t = re.sub(r'\d+(?:[.,]\d+)*', lambda m: _num(m.group(0).rstrip('.,'), lang) + (m.group(0)[len(m.group(0).rstrip('.,')):]), t)
    if lang == 'de': t = re.sub(r'\bein(hundert|tausend)', r'\1', t)  # „hundertsechzig“, nicht „einhundertsechzig“
    for k, v in SYM[lang].items():
        if k not in (':',): t = t.replace(k, v)
    # Typografie, die Modelle stolpern lässt
    t = t.replace('„', '').replace('“', '').replace('”', '').replace('"', '').replace('’', "'").replace('…', '...').replace(' – ', ', ').replace('–', ', ')
    t = re.sub(r'\s+', ' ', t).strip()
    return t


if __name__ == '__main__':
    import sys
    for s in ['Eine Kuh bildet rund 160 l Speichel am Tag – bei 6,2 MJ NEL je kg TM.', 'Rosi gab etwa 4 000 kg, heute sind 8 000–10 000 kg üblich (z. B. bei 30 % Kraftfutter).',
              'Die Weender Analyse stammt aus den 1860er-Jahren; nXP und RNB kamen später.']:
        print(speech(s, 'de'))
    print(speech('A cow produces about 160 l of saliva – at 6.2 MJ NEL per kg DM, e.g. with 30 % concentrate.', 'en'))
