// Einstrich-Vektorschrift (Hershey Sans / Script) + Zusatzglyphen für Deutsch und Formeln.
// Liefert Polylinien, damit Kreide und Kugelschreiber Strich für Strich animiert werden können.
import HERSHEY from '../vendor-data/hershey.json';

function parsePath(d) {
  const strokes = []; let cur = null;
  const re = /([ML])?\s*(-?\d+),(-?\d+)/g; let m;
  while ((m = re.exec(d))) {
    if (m[1] === 'M') { cur = []; strokes.push(cur); }
    else if (!cur) { cur = []; strokes.push(cur); }
    cur.push([+m[2], +m[3]]);
  }
  return strokes;
}
function buildFont(src) {
  const glyphs = new Map();
  src.chars.forEach((c, i) => {
    const ch = String.fromCharCode(33 + i);
    glyphs.set(ch, { strokes: parsePath(c.d || ''), adv: (c.o || 8) * 2 });
  });
  glyphs.set(' ', { strokes: [], adv: 12 });
  return glyphs;
}
const FONTS = { sans: buildFont(HERSHEY.futural), script: buildFont(HERSHEY.cursive) };

// Zusatzglyphen (Koordinaten im Hershey-Raster: Versalhöhe y=1..22, Grundlinie 22)
function addExtras(g, script) {
  const base = ch => g.get(ch);
  const dots = (ch, y, dx = 0) => { const b = base(ch); const minX = Math.min(...b.strokes.flat().map(p => p[0])), maxX = Math.max(...b.strokes.flat().map(p => p[0])); const cx = (minX + maxX) / 2 + dx; return { strokes: [...b.strokes, [[cx - 3, y], [cx - 2.4, y + 0.8]], [[cx + 3, y], [cx + 3.6, y + 0.8]]], adv: b.adv }; };
  g.set('ä', dots('a', script ? 4 : 4)); g.set('ö', dots('o', 4)); g.set('ü', dots('u', 4));
  g.set('Ä', dots('A', -2.5)); g.set('Ö', dots('O', -2.5)); g.set('Ü', dots('U', -2.5));
  g.set('ß', { strokes: [[[4, 22], [4, 6], [5, 3], [7, 1.5], [10, 1.5], [12, 3], [12.5, 6], [11, 9], [8, 10.5], [12, 12], [14, 15], [14, 18], [12, 21], [9, 22], [7, 21.5]]], adv: 18 });
  g.set('→', { strokes: [[[2, 13], [20, 13]], [[14, 8], [20, 13], [14, 18]]], adv: 24 });
  g.set('←', { strokes: [[[4, 13], [22, 13]], [[10, 8], [4, 13], [10, 18]]], adv: 24 });
  g.set('↑', { strokes: [[[9, 22], [9, 4]], [[4, 9], [9, 4], [14, 9]]], adv: 18 });
  g.set('↓', { strokes: [[[9, 4], [9, 22]], [[4, 17], [9, 22], [14, 17]]], adv: 18 });
  g.set('×', { strokes: [[[4, 9], [14, 19]], [[14, 9], [4, 19]]], adv: 18 });
  g.set('·', { strokes: [[[5, 13], [5.6, 13.6], [5, 14.2], [4.4, 13.6], [5, 13]]], adv: 10 });
  g.set('−', { strokes: [[[3, 14], [17, 14]]], adv: 20 });
  g.set('≈', { strokes: [[[3, 11], [6, 9.5], [10, 11], [14, 12.5], [17, 11]], [[3, 16], [6, 14.5], [10, 16], [14, 17.5], [17, 16]]], adv: 20 });
  g.set('≤', { strokes: [[[16, 6], [4, 12], [16, 18]], [[4, 21], [16, 21]]], adv: 20 });
  g.set('≥', { strokes: [[[4, 6], [16, 12], [4, 18]], [[4, 21], [16, 21]]], adv: 20 });
  g.set('°', { strokes: [[[6, 2], [4, 3], [3.5, 5], [5, 7], [7, 7], [8.5, 5], [8, 3], [6, 2]]], adv: 12 });
  g.set('µ', { strokes: [[[4, 8], [4, 27]], [[4, 18], [6, 21], [9, 22], [12, 21], [14, 18]], [[14, 8], [14, 22]]], adv: 19 });
  g.set('Σ', { strokes: [[[16, 1], [3, 1], [11, 11.5], [3, 22], [16, 22]]], adv: 19 });
  g.set('Δ', { strokes: [[[10, 1], [2, 22], [18, 22], [10, 1]]], adv: 20 });
  g.set('~', { strokes: [[[3, 14], [6, 12], [10, 14], [14, 16], [17, 14]]], adv: 20 });
  g.set('–', g.get('−'));
  g.set('„', { strokes: [[[4, 21], [3, 25]], [[8, 21], [7, 25]]], adv: 12 });
  g.set('“', { strokes: [[[5, 1], [4, 5]], [[9, 1], [8, 5]]], adv: 12 });
  g.set('’', { strokes: [[[5, 1], [4, 5]]], adv: 8 });
  g.set('…', { strokes: [[[4, 21], [4.5, 21.5]], [[10, 21], [10.5, 21.5]], [[16, 21], [16.5, 21.5]]], adv: 22 });
  g.set('é', { strokes: [...base('e').strokes, [[8, 5], [12, 2]]], adv: base('e').adv });
}
addExtras(FONTS.sans, false);
addExtras(FONTS.script, true);
const FALLBACK = '?';

/**
 * Text → Liste von Strichen in Pixelkoordinaten.
 * Unterstützt ^{…} (hochgestellt) und _{…} (tiefgestellt).
 * opts: { size (Versalhöhe px), x, y (Grundlinie), font: 'sans'|'script', slant, jitter(rng), spacing }
 */
export function layoutText(text, opts) {
  const font = FONTS[opts.font || 'sans'];
  const size = opts.size || 40, unit = size / 21;
  const rng = opts.rng || Math.random;
  const jitter = opts.jitter ?? 0.04;
  const slant = opts.slant ?? 0.06;
  const strokes = [];
  let pen = 0;
  const tokens = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ((c === '^' || c === '_') && text[i + 1] === '{') {
      const end = text.indexOf('}', i + 2);
      const inner = end > 0 ? text.slice(i + 2, end) : '';
      for (const ch of inner) tokens.push({ ch, mode: c === '^' ? 'sup' : 'sub' });
      i = end > 0 ? end : i + 1;
    } else tokens.push({ ch: c, mode: 'n' });
  }
  for (const t of tokens) {
    const g = font.get(t.ch) || font.get(FALLBACK);
    const sc = t.mode === 'n' ? 1 : 0.62;
    const dy = t.mode === 'sup' ? -9 : t.mode === 'sub' ? 6 : 0;
    // leichte Handschrift-Variation je Zeichen
    const cj = (rng() - 0.5) * jitter * 21, rot = (rng() - 0.5) * jitter * 0.6, cs = 1 + (rng() - 0.5) * jitter;
    for (const s of g.strokes) {
      const pts = s.map(([x, y]) => {
        const lx = x * sc * cs, ly = (y * sc + dy + (t.mode === 'n' ? 0 : 22 * (1 - sc))) * cs;
        const rx = lx * Math.cos(rot) - (ly - 22) * Math.sin(rot);
        const ry = lx * Math.sin(rot) + (ly - 22) * Math.cos(rot) + 22;
        const px = opts.x + (pen + rx + (22 - ry) * slant) * unit + (rng() - 0.5) * jitter * unit * 1.5;
        const py = opts.y + (ry - 22 + cj * 0.15) * unit + (rng() - 0.5) * jitter * unit * 1.5;
        return [px, py];
      });
      if (pts.length) strokes.push(pts);
    }
    pen += g.adv * sc * (opts.spacing ?? 1) * cs;
  }
  // Länge je Strich (für Animation)
  let total = 0;
  for (const s of strokes) { let L = 0; for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); s.len = Math.max(L, 0.5); total += s.len; }
  return { strokes, width: pen * unit, total };
}
export function measureText(text, size, font = 'sans') {
  return layoutText(text, { size, x: 0, y: 0, font, jitter: 0, rng: () => 0.5 }).width;
}
