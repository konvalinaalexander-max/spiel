// Folien-Renderer im BOKU-Folienmaster-Stil (1920×1080) inkl. 10 Diagrammtypen und Sonderfolien.
import { clamp } from '../core/util.js';

const G = '#00aa5a', T = '#474747', D = '#222222', L = '#dadada', GREY = '#efefef', MID = '#929191';
const PAL = ['#00aa5a', '#2d6e9e', '#e0a21b', '#8a5a9c', '#c8553d', '#5b8c3a', '#7a8a96', '#b07a4a'];
const FONT = 'Arial, Helvetica, sans-serif';

export function drawBokuLogo(c, x, y, h, inverted = false) {
  // Nachbau: grüne Fläche mit weißem Schriftzug (kein Original-Logo)
  const w = h * 2.25;
  c.fillStyle = inverted ? '#ffffff' : G; c.fillRect(x, y, w, h);
  c.fillStyle = inverted ? G : '#ffffff';
  c.font = `bold ${Math.round(h * 0.62)}px ${FONT}`; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.fillText('BOKU', x + w / 2, y + h * 0.54);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  return w;
}
function wrap(c, text, maxW) {
  const words = String(text).split(/\s+/); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function fitFont(c, text, maxW, size, weight = '') {
  let s = size; c.font = `${weight} ${s}px ${FONT}`;
  while (c.measureText(text).width > maxW && s > 18) { s -= 2; c.font = `${weight} ${s}px ${FONT}`; }
  return s;
}
const fmt = (v, lang) => (typeof v === 'number' ? (Math.round(v * 10) / 10).toString().replace('.', lang === 'en' ? '.' : ',') : v);

// --------------------------------------------------------------------------- Diagramme
function diagram(c, d, x, y, w, h, lang) {
  c.save(); c.translate(x, y);
  c.font = `26px ${FONT}`; c.textBaseline = 'alphabetic';
  const label = (t, lx, ly, align = 'center', col = T, size = 26, weight = '') => { c.fillStyle = col; c.font = `${weight} ${size}px ${FONT}`; c.textAlign = align; c.fillText(t, lx, ly); c.textAlign = 'left'; };
  switch (d.type) {
    case 'flow': {
      const items = d.items || []; const n = items.length; const right = d.direction === 'right';
      if (right) {
        const bw = (w - (n - 1) * 46) / n, bh = Math.min(140, h * 0.4);
        items.forEach((it, i) => {
          const bx = i * (bw + 46), by = h / 2 - bh / 2, hl = i === d.highlight;
          c.fillStyle = hl ? G : GREY; c.fillRect(bx, by, bw, bh);
          const ls = wrap(c, it, bw - 20); c.font = `bold 26px ${FONT}`;
          ls.forEach((l, k) => label(l, bx + bw / 2, by + bh / 2 + 9 + (k - (ls.length - 1) / 2) * 30, 'center', hl ? '#fff' : D, 26, 'bold'));
          if (i < n - 1) { c.fillStyle = G; c.beginPath(); c.moveTo(bx + bw + 10, h / 2 - 16); c.lineTo(bx + bw + 36, h / 2); c.lineTo(bx + bw + 10, h / 2 + 16); c.fill(); }
        });
      } else {
        const bh = Math.min(110, (h - (n - 1) * 44) / n), bw = w * 0.8;
        items.forEach((it, i) => {
          const by = i * (bh + 44), bx = (w - bw) / 2, hl = i === d.highlight;
          c.fillStyle = hl ? G : GREY; c.fillRect(bx, by, bw, bh);
          label(it, w / 2, by + bh / 2 + 10, 'center', hl ? '#fff' : D, 30, 'bold');
          if (i < n - 1) { c.fillStyle = G; c.beginPath(); c.moveTo(w / 2 - 18, by + bh + 8); c.lineTo(w / 2 + 18, by + bh + 8); c.lineTo(w / 2, by + bh + 36); c.fill(); }
        });
      }
      break;
    }
    case 'cycle': {
      const items = d.items || []; const n = items.length; const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
      c.strokeStyle = G; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      items.forEach((it, i) => {
        const a = -Math.PI / 2 + i / n * Math.PI * 2, px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
        // Pfeilspitze zwischen den Knoten
        const am = a + Math.PI / n, ax = cx + Math.cos(am) * R, ay = cy + Math.sin(am) * R;
        c.save(); c.translate(ax, ay); c.rotate(am + Math.PI / 2); c.fillStyle = G; c.beginPath(); c.moveTo(-14, -12); c.lineTo(14, 0); c.lineTo(-14, 12); c.fill(); c.restore();
        c.font = `bold 26px ${FONT}`; const tw = Math.max(150, c.measureText(it).width + 36);
        c.fillStyle = '#fff'; c.fillRect(px - tw / 2, py - 32, tw, 64); c.strokeStyle = G; c.lineWidth = 3; c.strokeRect(px - tw / 2, py - 32, tw, 64);
        label(it, px, py + 9, 'center', D, 26, 'bold');
      });
      break;
    }
    case 'stack': {
      const parts = d.parts || []; const sum = parts.reduce((a, p) => a + p.value, 0) || 1;
      const bw = w * 0.34; let yy = 0; const bx = 30;
      parts.forEach((p, i) => {
        const ph = p.value / sum * (h - 20);
        c.fillStyle = PAL[i % PAL.length]; c.fillRect(bx, yy, bw, Math.max(2, ph - 3));
        c.strokeStyle = MID; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx + bw + 8, yy + ph / 2); c.lineTo(bx + bw + 40, yy + ph / 2); c.stroke();
        label(`${p.label}`, bx + bw + 50, yy + ph / 2 + 9, 'left', D, 26, 'bold');
        label(`${fmt(p.value, lang)}${d.unit ? ' ' + d.unit : ''}`, w - 10, yy + ph / 2 + 9, 'right', T, 24);
        yy += ph;
      });
      break;
    }
    case 'pie': {
      const parts = d.parts || []; const sum = parts.reduce((a, p) => a + p.value, 0) || 1;
      const cx = w * 0.32, cy = h / 2, R = Math.min(w * 0.3, h * 0.45); let a0 = -Math.PI / 2;
      parts.forEach((p, i) => {
        const a1 = a0 + p.value / sum * Math.PI * 2;
        c.fillStyle = PAL[i % PAL.length]; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R, a0, a1); c.closePath(); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
        a0 = a1;
      });
      parts.forEach((p, i) => {
        const ly = cy - (parts.length - 1) * 26 + i * 52;
        c.fillStyle = PAL[i % PAL.length]; c.fillRect(w * 0.66, ly - 20, 26, 26);
        label(`${p.label} ${fmt(p.value, lang)}${d.unit ? ' ' + d.unit : ''}`, w * 0.66 + 38, ly, 'left', D, 24);
      });
      break;
    }
    case 'bars': {
      const items = d.items || []; const max = d.max || Math.max(...items.map(i => i.value)) * 1.15 || 1;
      const lw = w * 0.36, bw = w - lw - 90; const rowH = Math.min(70, h / Math.max(1, items.length));
      items.forEach((it, i) => {
        const yy = i * rowH + 10;
        label(it.label, lw - 14, yy + rowH * 0.55, 'right', D, 25);
        c.fillStyle = GREY; c.fillRect(lw, yy + 6, bw, rowH - 18);
        c.fillStyle = i === d.highlight ? '#2d6e9e' : G; c.fillRect(lw, yy + 6, bw * clamp(it.value / max, 0, 1), rowH - 18);
        label(fmt(it.value, lang), lw + bw * clamp(it.value / max, 0, 1) + 10, yy + rowH * 0.55, 'left', T, 24, 'bold');
      });
      if (d.unit) label(d.unit, w, h - 4, 'right', MID, 22);
      break;
    }
    case 'cascade': {
      const lv = d.levels || []; const max = Math.max(...lv.map(l => l.value)) || 1;
      const rowH = Math.min(105, h / Math.max(1, lv.length)); const lw = 110;
      lv.forEach((l, i) => {
        const yy = i * rowH; const bw = (w - lw - 40) * l.value / max;
        c.fillStyle = i === lv.length - 1 ? G : `rgba(0,170,90,${0.25 + 0.15 * i})`; c.fillRect(lw, yy + 8, bw, rowH - 34);
        label(l.label, lw - 14, yy + rowH * 0.45 + 4, 'right', D, 30, 'bold');
        label(`${fmt(l.value, lang)}`, lw + bw + 10, yy + rowH * 0.45 + 4, 'left', T, 24);
        if (d.losses && d.losses[i] && i < lv.length - 1) label('− ' + d.losses[i], lw + (w - lw - 40) * lv[i + 1].value / max + 18, yy + rowH - 6, 'left', '#c8553d', 21);
      });
      break;
    }
    case 'line': {
      const xs = d.x || [], ys = d.y || []; if (!xs.length) break;
      const pl = 80, pb = 60, pw = w - pl - 20, ph = h - pb - 20;
      let ymin = Math.min(...ys, d.threshold ? d.threshold.value : Infinity), ymax = Math.max(...ys, d.threshold ? d.threshold.value : -Infinity);
      const pad = (ymax - ymin) * 0.15 || 1; ymin -= pad; ymax += pad;
      const xmin = Math.min(...xs), xmax = Math.max(...xs);
      const X = v => pl + (v - xmin) / ((xmax - xmin) || 1) * pw, Y = v => 20 + ph - (v - ymin) / ((ymax - ymin) || 1) * ph;
      c.strokeStyle = L; c.lineWidth = 1.5;
      for (let i = 0; i <= 4; i++) { const yy = 20 + ph * i / 4; c.beginPath(); c.moveTo(pl, yy); c.lineTo(pl + pw, yy); c.stroke(); label(fmt(ymax - (ymax - ymin) * i / 4, lang), pl - 10, yy + 8, 'right', MID, 20); }
      xs.forEach(v => label(fmt(v, lang), X(v), 20 + ph + 30, 'center', MID, 20));
      if (d.threshold) {
        c.strokeStyle = '#c8553d'; c.setLineDash([12, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(pl, Y(d.threshold.value)); c.lineTo(pl + pw, Y(d.threshold.value)); c.stroke(); c.setLineDash([]);
        label(d.threshold.label || '', pl + pw, Y(d.threshold.value) - 10, 'right', '#c8553d', 22, 'bold');
      }
      c.strokeStyle = G; c.lineWidth = 6; c.lineJoin = 'round'; c.beginPath(); xs.forEach((v, i) => (i ? c.lineTo(X(v), Y(ys[i])) : c.moveTo(X(v), Y(ys[i])))); c.stroke();
      c.fillStyle = G; xs.forEach((v, i) => { c.beginPath(); c.arc(X(v), Y(ys[i]), 7, 0, 7); c.fill(); });
      if (d.xLabel) label(d.xLabel, pl + pw / 2, h - 2, 'center', T, 22);
      if (d.yLabel) { c.save(); c.translate(18, 20 + ph / 2); c.rotate(-Math.PI / 2); label(d.yLabel, 0, 0, 'center', T, 22); c.restore(); }
      break;
    }
    case 'table': {
      const head = d.head || [], rows = d.rows || []; const cols = head.length || 1;
      const cw = w / cols, rh = Math.min(72, h / (rows.length + 1));
      c.fillStyle = G; c.fillRect(0, 0, w, rh);
      head.forEach((t, i) => { const s = fitFont(c, t, cw - 20, 24, 'bold'); label(t, i * cw + (i ? cw - 14 : 14), rh * 0.62, i ? 'right' : 'left', '#fff', s, 'bold'); });
      rows.forEach((r, j) => {
        const yy = (j + 1) * rh;
        if (j % 2) { c.fillStyle = GREY; c.fillRect(0, yy, w, rh); }
        r.forEach((t, i) => { const s = fitFont(c, String(t), cw - 20, 25); label(String(t), i * cw + (i ? cw - 14 : 14), yy + rh * 0.62, i ? 'right' : 'left', D, s, i ? '' : 'bold'); });
      });
      c.strokeStyle = L; c.lineWidth = 2; c.strokeRect(0, 0, w, rh * (rows.length + 1));
      break;
    }
    case 'stomach': {
      // Schema Vormagensystem (Seitenansicht, vereinfacht)
      const hl = d.highlight;
      const lab = lang === 'en' ? { pansen: 'Rumen', netzmagen: 'Reticulum', blaettermagen: 'Omasum', labmagen: 'Abomasum', oes: 'Oesophagus', duo: 'to duodenum' }
        : { pansen: 'Pansen', netzmagen: 'Netzmagen', blaettermagen: 'Blättermagen', labmagen: 'Labmagen', oes: 'Speiseröhre', duo: 'zum Dünndarm' };
      const blob = (key, cx, cy, rx, ry, rot = 0) => {
        c.save(); c.translate(cx, cy); c.rotate(rot);
        c.fillStyle = key === hl ? G : '#cfe9db'; c.strokeStyle = key === hl ? '#008a49' : '#8fc7a8'; c.lineWidth = 4;
        c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
        label(lab[key], cx, cy + 10, 'center', key === hl ? '#fff' : D, 27, 'bold');
      };
      c.strokeStyle = MID; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * 0.15, 10); c.quadraticCurveTo(w * 0.3, h * 0.12, w * 0.5, h * 0.2); c.stroke();
      label(lab.oes, w * 0.12, 40, 'left', MID, 20);
      blob('pansen', w * 0.36, h * 0.55, w * 0.32, h * 0.33);
      blob('netzmagen', w * 0.73, h * 0.3, w * 0.14, h * 0.14);
      blob('blaettermagen', w * 0.8, h * 0.62, w * 0.13, h * 0.13);
      blob('labmagen', w * 0.6, h * 0.9, w * 0.2, h * 0.09, -0.15);
      c.strokeStyle = MID; c.lineWidth = 10; c.beginPath(); c.moveTo(w * 0.8, h * 0.92); c.lineTo(w * 0.98, h * 0.98); c.stroke();
      label(lab.duo, w, h - 8, 'right', MID, 20);
      break;
    }
    case 'barrel': {
      const st = d.staves || []; const n = st.length || 1; const bw = Math.min(70, (w - 80) / n - 8); const base = h - 40;
      const minV = Math.min(...st.map(s => s.value));
      st.forEach((s, i) => {
        const bx = 40 + i * (bw + 8), sh = s.value * (h - 90);
        c.fillStyle = s.value === minV ? '#c8553d' : '#b38a5a'; c.fillRect(bx, base - sh, bw, sh);
        c.strokeStyle = '#7a5a34'; c.lineWidth = 2; c.strokeRect(bx, base - sh, bw, sh);
        c.save(); c.translate(bx + bw / 2 + 8, base - 14); c.rotate(-Math.PI / 2); label(s.label, 0, 0, 'left', '#fff', 22, 'bold'); c.restore();
      });
      const level = minV * (h - 90);
      c.fillStyle = 'rgba(45,110,158,0.35)'; c.fillRect(40, base - level, n * (bw + 8) - 8, level);
      c.strokeStyle = '#2d6e9e'; c.lineWidth = 3; c.setLineDash([10, 6]); c.beginPath(); c.moveTo(20, base - level); c.lineTo(60 + n * (bw + 8), base - level); c.stroke(); c.setLineDash([]);
      for (const yy of [base - (h - 90) * 0.2, base - (h - 90) * 0.75]) { c.strokeStyle = '#555'; c.lineWidth = 6; c.beginPath(); c.moveTo(34, yy); c.lineTo(46 + n * (bw + 8), yy); c.stroke(); }
      break;
    }
    default: label('—', w / 2, h / 2);
  }
  c.restore();
}

// --------------------------------------------------------------------------- Folien
export class SlideRenderer {
  constructor(width = 1920, height = 1080) {
    this.W = width; this.H = height;
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.scale = width / 1920;
  }
  _frame(meta, num, total) {
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 1920, 1080);
    drawBokuLogo(c, 90, 56, 74);
    c.fillStyle = T; c.font = `24px ${FONT}`; c.fillText(meta.university, 290, 84);
    c.fillStyle = MID; c.font = `22px ${FONT}`; c.fillText(meta.institute, 290, 118);
    c.textAlign = 'right'; c.fillText(meta.courseShort, 1830, 84); c.textAlign = 'left';
    c.fillStyle = G; c.fillRect(90, 160, 1740, 5);
    c.fillStyle = GREY; c.fillRect(0, 1020, 1920, 60);
    c.fillStyle = '#6f6f6f'; c.font = `22px ${FONT}`; c.fillText(meta.footer, 90, 1058);
    if (num) { c.textAlign = 'right'; c.fillText(`${num} / ${total}`, 1830, 1058); c.textAlign = 'left'; }
  }
  /** Inhaltsfolie aus einem Abschnitt */
  content(meta, slide, num, total, lang) {
    this._frame(meta, num, total);
    const c = this.ctx;
    const ts = fitFont(c, slide.title, 1740, 62, 'bold');
    c.fillStyle = D; c.font = `bold ${ts}px ${FONT}`; c.fillText(slide.title, 90, 250);
    if (slide.subtitle) { c.fillStyle = G; c.font = `32px ${FONT}`; c.fillText(slide.subtitle, 90, 302); }
    let y = 400; c.font = `40px ${FONT}`;
    for (const b of slide.bullets || []) {
      const lines = wrap(c, b, 900);
      c.fillStyle = G; c.fillRect(96, y - 26, 18, 18);
      c.fillStyle = T; lines.forEach((l, i) => c.fillText(l, 140, y + i * 50));
      y += lines.length * 50 + 26;
    }
    if (slide.diagram) diagram(c, slide.diagram, 1090, 360, 740, 560, lang);
    if (slide.source) { c.fillStyle = MID; c.font = `italic 20px ${FONT}`; c.fillText(slide.source, 90, 995); }
    return this.canvas;
  }
  title(meta, lines) {
    this._frame(meta, 0, 0);
    const c = this.ctx;
    c.fillStyle = G; c.fillRect(90, 330, 14, 300);
    c.fillStyle = D; c.font = `bold 92px ${FONT}`; c.fillText(lines.title, 140, 430);
    c.fillStyle = G; c.font = `44px ${FONT}`; c.fillText(lines.sub, 140, 510);
    c.fillStyle = T; c.font = `34px ${FONT}`; c.fillText(lines.who, 140, 590);
    c.fillStyle = MID; c.font = `28px ${FONT}`; c.fillText(lines.when, 140, 640);
    // dezente Landschaftslinie (Bildsprache: Natur)
    c.strokeStyle = '#cfe9db'; c.lineWidth = 6; c.beginPath(); c.moveTo(1000, 900);
    for (let x = 1000; x <= 1830; x += 10) c.lineTo(x, 860 - Math.sin((x - 1000) / 140) * 40 - Math.sin((x - 1000) / 47) * 12);
    c.stroke();
    return this.canvas;
  }
  agenda(meta, heading, items, current, num, total) {
    this._frame(meta, num, total);
    const c = this.ctx;
    c.fillStyle = D; c.font = `bold 62px ${FONT}`; c.fillText(heading, 90, 250);
    items.slice(0, 10).forEach((it, i) => {
      const y = 360 + i * 62; const on = i === current;
      c.fillStyle = on ? G : GREY; c.fillRect(90, y - 40, 54, 54);
      c.fillStyle = on ? '#fff' : T; c.font = `bold 28px ${FONT}`; c.textAlign = 'center'; c.fillText(String(i + 1), 117, y - 3); c.textAlign = 'left';
      c.fillStyle = on ? D : T; c.font = `${on ? 'bold ' : ''}36px ${FONT}`; c.fillText(it, 170, y);
    });
    return this.canvas;
  }
  message(meta, big, small, accent = G) {
    this._frame(meta, 0, 0);
    const c = this.ctx;
    c.fillStyle = accent; c.fillRect(90, 420, 14, 200);
    c.fillStyle = D; c.font = `bold 96px ${FONT}`; c.fillText(big, 140, 520);
    c.fillStyle = T; c.font = `40px ${FONT}`; wrap(c, small, 1500).forEach((l, i) => c.fillText(l, 140, 600 + i * 52));
    return this.canvas;
  }
  /** Beamer ohne Signal */
  noSignal(text) {
    const c = this.ctx; c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.fillStyle = '#0b1f6b'; c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `bold 54px ${FONT}`; c.textAlign = 'center'; c.fillText(text, 960, 520);
    c.font = `30px ${FONT}`; c.fillText('HDMI 1', 960, 590); c.textAlign = 'left';
    return this.canvas;
  }
  /** Startbildschirm des Beamers */
  boot(text, t) {
    const c = this.ctx; c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = `rgba(255,255,255,${clamp(t, 0, 1) * 0.85})`; c.font = `bold 64px ${FONT}`; c.textAlign = 'center'; c.fillText('PROJECTOR', 960, 520);
    c.font = `28px ${FONT}`; c.fillText(text, 960, 580); c.textAlign = 'left';
    return this.canvas;
  }
  /** Desktop des Prof-Laptops (vor der ersten Folie) */
  desktop(meta, t) {
    const c = this.ctx; c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, '#3f6b8a'); g.addColorStop(1, '#a9c5a0'); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
    c.fillStyle = '#2b2b2b'; c.fillRect(0, 1030, 1920, 50);
    c.fillStyle = '#fff'; c.font = `22px ${FONT}`; c.fillText(t, 1790, 1062);
    for (let i = 0; i < 4; i++) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(40, 40 + i * 130, 80, 80); c.fillStyle = '#fff'; c.font = `18px ${FONT}`; c.fillText(['Folien_VO.pdf', 'Skriptum', 'Prüfung', 'Fotos'][i], 30, 145 + i * 130); }
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.fillRect(560, 300, 800, 420);
    c.fillStyle = G; c.fillRect(560, 300, 800, 56); c.fillStyle = '#fff'; c.font = `bold 26px ${FONT}`; c.fillText('Tierernaehrung_VO_Einheit.pdf', 584, 338);
    c.fillStyle = T; c.font = `28px ${FONT}`; c.fillText(meta.courseShort, 600, 430);
    return this.canvas;
  }
}
