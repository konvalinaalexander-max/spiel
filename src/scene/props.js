// Requisiten: alles, was auf Pulten, am Vortragstisch, auf Fensterbänken und an der Garderobe liegt.
// Statische Teile werden je Material gebatcht (Vertexfarben), bewegliche/texturierte Teile sind eigene Meshes.
// Liste aller Objekte: PROP_LIST (für docs/ITERATIONEN.md, Checkliste „Baukasten?“).
import * as THREE from 'three';
import { Batcher, rbox, box, cyl, mat } from '../gfx/geom.js';
import { layoutText } from './strokefont.js';
import * as LY from './layout.js';
import { makeRng } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const DESK_TILT = 0.2;
const TAN = Math.tan(DESK_TILT);

export const PROP_LIST = [
  'Laptop silber (Alu-Unibody)', 'Laptop Business schwarz (Gummi, roter Trackpoint)', 'Laptop spacegrau mit Stickern', 'Laptop-Netzteil mit Kabel', 'Funkmaus',
  'Collegeblock A4 kariert, offen mit Mitschrift', 'Ringmappe geschlossen', 'Federpenal', 'Kugelschreiber', 'Textmarker gelb', 'Textmarker grün', 'Bleistift', 'Radiergummi',
  'Geodreieck', 'Taschenrechner', 'Folienskript (gedruckt, geheftet)', 'Lehrbuch „Tierernährung“', 'Haftnotizblock', 'Tablet mit Eingabestift',
  'PET-Wasserflasche', 'Edelstahl-Trinkflasche', 'Mate-Glasflasche', 'Thermobecher', 'Mensa-Pappbecher mit Deckel', 'Apfel', 'Kornspitz im Papiersackerl', 'Kaugummi-Packung', 'Taschentücher-Packung',
  'Smartphone (Display nach unten)', 'Smartphone in der Hand', 'Kopfhörer-Ladecase', 'Over-Ear-Kopfhörer', 'Schlüsselbund', 'Studierendenausweis-Karte', 'USB-Stick',
  'Rucksack', 'Jacke über der Lehne', 'Fahrradhelm', 'Haube/Schal am Pult', 'Regenschirm (bei Regen)',
  'Futtermittel-Probenglas Heu', 'Probenglas Grassilage', 'Probenglas Maissilage', 'Probenglas Gerste', 'Probenglas Sojaextraktionsschrot', 'Probenglas Mineralfutter', 'Probenglas Pellets (Milchleistungsfutter)',
  'Pansen-Modell (vier Mägen, Kunststoff)', 'Kreideschachtel mit weißer und farbiger Kreide', 'Tafelschwamm', 'Wasserschüssel', 'Tafelwischer', 'Wasserkaraffe', 'Wasserglas',
  'Aktentasche (Leder)', 'Prof-Laptop mit HDMI-Kabel', 'Klemmbrett mit Exkursionsliste', 'Stapel Handouts', 'Ordner', 'Brillenetui', 'Taschensender (Funkmikrofon)', 'Kaffeetasse des Profs',
  'Grünlilie im Topf (Fensterbank)', 'vergessene Trinkflasche (Fensterbank)', 'leerer Becher (Fensterbank)', 'Jacken an der Garderobe', 'Schal an der Garderobe', 'Steckdosenleiste mit Kabeln', 'zerknülltes Papier am Boden'
];

/** Höhe der geneigten Schreibfläche einer Reihe an z (Weltkoordinate) */
export function deskSurfaceY(row, z) {
  const f = LY.rowFloor(row), zc = LY.rowFront(row) + 0.21;
  return f + LY.DESK_H + 0.016 / Math.cos(DESK_TILT) - (z - zc) * TAN;
}
/** Matrix für ein Objekt auf der Schreibfläche: lokales +y = Flächennormale, Drehung yaw um die Normale */
function onDesk(row, x, z, yaw = 0, lift = 0) {
  const y = deskSurfaceY(row, z);
  const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(DESK_TILT, 0, 0)), V(1, 1, 1));
  return m.multiply(mat(0, lift, 0, 0, yaw, 0));
}
/** auf der waagrechten Ablageleiste (vorne) */
function onLedge(row, x, yaw = 0) {
  const f = LY.rowFloor(row), z0 = LY.rowFront(row);
  return mat(x, f + LY.DESK_H + 0.0555, z0 + 0.045, 0, yaw, 0);
}
const M4 = (a, b) => new THREE.Matrix4().multiplyMatrices(a, b);

// ------------------------------------------------------------------ Canvas-Atlanten
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function atlasUV(geo, cell, cols, rows) {
  const uv = geo.attributes.uv, u0 = (cell % cols) / cols, v0 = 1 - (Math.floor(cell / cols) + 1) / rows;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / cols, v0 + uv.getY(i) / rows);
  return geo;
}
const SCREEN_KINDS = ['notes', 'slides', 'pdf', 'feed', 'video', 'mail', 'sheet', 'ttt'];
function drawStudentScreens() {
  const cw = 320, ch = 200, cols = 4, rows = 2;
  const cv = canvas(cw * cols, ch * rows), c = cv.getContext('2d');
  const r = makeRng(31);
  SCREEN_KINDS.forEach((k, i) => {
    c.save(); c.translate((i % cols) * cw, Math.floor(i / cols) * ch);
    c.fillStyle = '#f3f4f6'; c.fillRect(0, 0, cw, ch);
    const bar = (y, h, col) => { c.fillStyle = col; c.fillRect(0, y, cw, h); };
    const lines = (x, y, w, n, col = '#9aa1ab', gap = 9) => { c.fillStyle = col; for (let j = 0; j < n; j++) c.fillRect(x, y + j * gap, w * (0.55 + r.next() * 0.45), 3); };
    if (k === 'notes') { bar(0, 18, '#2b579a'); c.fillStyle = '#fff'; c.fillRect(40, 26, cw - 80, ch - 30); lines(54, 40, cw - 110, 14, '#5c6470'); }
    if (k === 'slides') { bar(0, 14, '#3b3f46'); c.fillStyle = '#fff'; c.fillRect(30, 22, cw - 60, ch - 40); c.fillStyle = '#00aa5a'; c.fillRect(30, 22, cw - 60, 6); c.fillStyle = '#222'; c.fillRect(44, 40, 150, 9); lines(44, 62, 180, 6, '#666', 14); c.fillStyle = '#c9a86a'; c.fillRect(230, 60, 50, 70); }
    if (k === 'pdf') { bar(0, 16, '#525659'); c.fillStyle = '#6b6f73'; c.fillRect(0, 16, cw, ch); c.fillStyle = '#fff'; c.fillRect(80, 22, 160, ch - 22); lines(92, 34, 136, 16, '#7a7a7a', 9); c.fillStyle = 'rgba(255,230,0,0.55)'; c.fillRect(92, 70, 110, 6); }
    if (k === 'feed') { bar(0, 20, '#ffffff'); c.fillStyle = '#e9ebee'; c.fillRect(0, 20, cw, ch); for (let j = 0; j < 3; j++) { c.fillStyle = '#fff'; c.fillRect(70, 28 + j * 60, 180, 54); c.fillStyle = ['#d9a066', '#6fa7c9', '#7fb069'][j]; c.fillRect(76, 34 + j * 60, 60, 42); lines(144, 38 + j * 60, 100, 3, '#999', 10); } }
    if (k === 'video') { c.fillStyle = '#0d0d0d'; c.fillRect(0, 0, cw, ch); const g = c.createLinearGradient(0, 20, cw, ch - 30); g.addColorStop(0, '#3a6b8a'); g.addColorStop(1, '#c47a3a'); c.fillStyle = g; c.fillRect(10, 20, cw - 20, ch - 54); c.fillStyle = '#e50914'; c.fillRect(10, ch - 26, (cw - 20) * 0.37, 3); c.fillStyle = '#555'; c.fillRect(10 + (cw - 20) * 0.37, ch - 26, (cw - 20) * 0.63, 3); }
    if (k === 'mail') { bar(0, 18, '#0f6cbd'); c.fillStyle = '#fff'; c.fillRect(0, 18, 110, ch); for (let j = 0; j < 8; j++) { c.fillStyle = j === 1 ? '#dbe9f7' : '#fff'; c.fillRect(2, 22 + j * 22, 106, 20); lines(8, 26 + j * 22, 80, 2, '#7a8290', 7); } lines(124, 34, 170, 12, '#5c6470'); }
    if (k === 'sheet') { bar(0, 18, '#217346'); c.strokeStyle = '#d0d4d9'; c.lineWidth = 1; for (let x = 0; x < cw; x += 40) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, ch); c.stroke(); } for (let y = 30; y < ch; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(cw, y); c.stroke(); } c.fillStyle = '#333'; for (let y = 33; y < ch; y += 12) for (let x = 4; x < cw; x += 40) if (r.chance(0.7)) c.fillRect(x, y, 10 + r.next() * 22, 4); }
    if (k === 'ttt') { c.fillStyle = '#1b2230'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#f4f5f7'; c.fillRect(70, 18, 180, 170); c.strokeStyle = '#2b2f36'; c.lineWidth = 4; for (let j = 1; j < 3; j++) { c.beginPath(); c.moveTo(90 + j * 47, 34); c.lineTo(90 + j * 47, 174); c.stroke(); c.beginPath(); c.moveTo(90, 34 + j * 47); c.lineTo(231, 34 + j * 47); c.stroke(); } c.strokeStyle = '#1f9d5c'; c.lineWidth = 6; c.beginPath(); c.moveTo(102, 46); c.lineTo(126, 70); c.moveTo(126, 46); c.lineTo(102, 70); c.stroke(); c.strokeStyle = '#e07a2e'; c.beginPath(); c.arc(161, 105, 13, 0, 7); c.stroke(); }
    c.restore();
  });
  return { cv, cols, rows, index: k => Math.max(0, SCREEN_KINDS.indexOf(k)) };
}
const STICKERS = 12;
function drawStickers() {
  const s = 128, cols = 4, rows = 3, cv = canvas(s * cols, s * rows), c = cv.getContext('2d');
  const F = 'bold 22px Arial, sans-serif';
  const draw = [
    () => { c.fillStyle = '#00aa5a'; c.beginPath(); c.arc(64, 64, 56, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 30px Arial'; c.textAlign = 'center'; c.fillText('AGRAR', 64, 74); },
    () => { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(64, 66, 52, 44, 0, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.ellipse(44, 56, 14, 18, 0.4, 0, 7); c.fill(); c.beginPath(); c.ellipse(86, 74, 12, 10, 0, 0, 7); c.fill(); c.fillStyle = '#f0a8b0'; c.beginPath(); c.ellipse(64, 96, 26, 14, 0, 0, 7); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(54, 96, 3, 0, 7); c.arc(74, 96, 3, 0, 7); c.fill(); },
    () => { c.fillStyle = '#e6641e'; c.fillRect(8, 30, 112, 68); c.fillStyle = '#fff'; c.font = F; c.textAlign = 'center'; c.fillText('Ich ♥', 64, 60); c.fillText('Pansen', 64, 86); },
    () => { c.fillStyle = '#2b579a'; c.beginPath(); c.roundRect(10, 20, 108, 88, 14); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 20px Arial'; c.textAlign = 'center'; c.fillText('XP · XL · XF', 64, 58); c.fillText('XA · NfE', 64, 84); },
    () => { c.fillStyle = '#c0392b'; c.fillRect(20, 70, 70, 26); c.fillRect(40, 46, 36, 26); c.fillStyle = '#222'; c.beginPath(); c.arc(36, 98, 16, 0, 7); c.arc(92, 100, 11, 0, 7); c.fill(); c.fillStyle = '#9fd1ef'; c.fillRect(46, 50, 24, 16); },
    () => { c.fillStyle = '#f4d03f'; c.beginPath(); c.moveTo(64, 10); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 26 : 56; c.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } c.fill(); c.fillStyle = '#333'; c.font = 'bold 18px Arial'; c.textAlign = 'center'; c.fillText('bio', 64, 70); },
    () => { c.fillStyle = '#4b288c'; c.beginPath(); c.arc(64, 64, 54, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 16px Arial'; c.textAlign = 'center'; c.fillText('KEINE', 64, 52); c.fillText('PANIK', 64, 72); c.fillText('vor der Prüfung', 64, 92); },
    () => { c.fillStyle = '#7fb069'; c.beginPath(); c.ellipse(64, 64, 24, 54, 0.6, 0, 7); c.fill(); c.strokeStyle = '#3c6e2f'; c.lineWidth = 4; c.beginPath(); c.moveTo(34, 104); c.lineTo(94, 24); c.stroke(); },
    () => { c.fillStyle = '#fff'; c.fillRect(6, 34, 116, 60); c.strokeStyle = '#222'; c.lineWidth = 3; c.strokeRect(6, 34, 116, 60); c.fillStyle = '#222'; c.font = 'bold 19px Arial'; c.textAlign = 'center'; c.fillText('Wiederkäuer', 64, 60); c.fillText('aus Leidenschaft', 64, 84); },
    () => { c.fillStyle = '#e74c3c'; c.beginPath(); c.arc(64, 70, 44, 0, 7); c.fill(); c.fillStyle = '#5d3a1a'; c.fillRect(60, 14, 8, 22); c.fillStyle = '#27ae60'; c.beginPath(); c.ellipse(80, 22, 16, 7, -0.5, 0, 7); c.fill(); },
    () => { c.fillStyle = '#1b2230'; c.beginPath(); c.roundRect(8, 26, 112, 76, 12); c.fill(); c.fillStyle = '#00aa5a'; c.font = 'bold 26px monospace'; c.textAlign = 'center'; c.fillText('X O X', 64, 74); },
    () => { c.fillStyle = '#f5e6c8'; c.beginPath(); c.arc(64, 64, 54, 0, 7); c.fill(); c.fillStyle = '#8a5a2b'; c.font = 'bold 18px Arial'; c.textAlign = 'center'; c.fillText('Wien', 64, 56); c.fillText('18. Bezirk', 64, 80); }
  ];
  draw.forEach((d, i) => { c.save(); c.translate((i % cols) * s, Math.floor(i / cols) * s); c.textAlign = 'center'; d(); c.restore(); });
  return { cv, cols, rows };
}
/** Handgeschriebene Mitschriften (Kugelschreiber, Script-Font) auf kariertem Papier */
function drawPage(c, w, h, text, seed, opts = {}) {
  const r = makeRng(seed);
  c.fillStyle = opts.paper || '#fbfbf7'; c.fillRect(0, 0, w, h);
  const g = w / 34;
  c.strokeStyle = 'rgba(120,150,190,0.35)'; c.lineWidth = 1;
  for (let x = g * 0.6; x < w; x += g) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = g * 1.4; y < h; y += g) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.strokeStyle = 'rgba(200,70,70,0.5)'; c.beginPath(); c.moveTo(w - g * 3, 0); c.lineTo(w - g * 3, h); c.stroke();
  if (!text) return;
  const ink = opts.ink || '#1f3d8a';
  c.strokeStyle = ink; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = Math.max(1.2, g * 0.09);
  let y = g * 2.4;
  for (const line of text) {
    const lay = layoutText(line, { size: g * 0.78, x: g * 1.2, y, font: 'script', rng: r.next, jitter: 0.06, slant: 0.12 });
    for (const s of lay.strokes) { c.beginPath(); s.forEach(([x, yy], i) => (i ? c.lineTo(x, yy) : c.moveTo(x, yy))); c.stroke(); }
    y += g * (1.9 + (r.next() < 0.15 ? 1 : 0));
    if (y > h - g) break;
  }
  if (opts.highlight) { c.fillStyle = 'rgba(255,235,0,0.35)'; c.fillRect(g * 1.1, g * 1.7, g * 9, g * 0.9); }
}
const NOTE_SAMPLES = [
  ['Weender Analyse', 'TM = 100 − Wasser', 'XP = N × 6,25', 'NfE = TM − (XA+XP+XL+XF)', 'Gerüstsubst. → XF ungenau!', '→ van Soest: NDF, ADF, ADL'],
  ['Pansen: pH 6–7', 'Zellulolyten ↓ bei pH < 6', 'Acetat : Propionat', 'Kraftfutter ↑ → Propionat ↑', 'SARA!! (subakut)', 'Strukturwirksame Rohfaser'],
  ['Energiebewertung', 'GE → DE → ME → NEL', 'NEL in MJ/kg TM', 'Milchkuh: 3,3 MJ NEL/kg Milch', 'Erhaltung: 0,293 · LM^{0,75}'],
  ['Protein Wdk.', 'nXP, RNB', 'RNB = (XP − nXP)/6,25', 'Ziel RNB ≈ 0', 'Mikrobenprotein!', 'Schwein: pcv Lysin']
];
function drawNotebooks() {
  const pw = 512, ph = 362, cols = 2, rows = 2, cv = canvas(pw * cols, ph * rows), c = cv.getContext('2d');
  NOTE_SAMPLES.forEach((t, i) => { c.save(); c.translate((i % cols) * pw, Math.floor(i / cols) * ph); drawPage(c, pw, ph, t, 50 + i, { highlight: i % 2 === 0, ink: i === 2 ? '#222' : '#1f3d8a' }); c.restore(); });
  return { cv, cols, rows };
}
/** Etiketten für Probengläser + Lehrbuch + Folienskript + Handouts */
const JAR_LABELS = [['Heu', '1. Schnitt 2026'], ['Grassilage', '35 % TM'], ['Maissilage', 'Ernte 09/26'], ['Gerste', 'geschrotet'], ['SES 44', 'Sojaextr.schrot'], ['Mineralfutter', 'Rind, 20/5'], ['MLF 18/4', 'Pellets']];
function drawLabels() {
  const cw = 256, ch = 128, cols = 4, rows = 3, cv = canvas(cw * cols, ch * rows), c = cv.getContext('2d');
  JAR_LABELS.forEach(([a, b], i) => {
    c.save(); c.translate((i % cols) * cw, Math.floor(i / cols) * ch);
    c.fillStyle = '#fbfaf3'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#00aa5a'; c.lineWidth = 6; c.strokeRect(6, 6, cw - 12, ch - 12);
    c.fillStyle = '#222'; c.font = 'bold 36px Arial'; c.textAlign = 'center'; c.fillText(a, cw / 2, 60);
    c.font = '22px Arial'; c.fillStyle = '#555'; c.fillText(b, cw / 2, 96); c.restore();
  });
  // Lehrbuch-Cover (Zelle 7), Folienskript (8), Handout (9), Exkursionsliste (10), Studi-Karte (11)
  const cell = (i, fn) => { c.save(); c.translate((i % cols) * cw, Math.floor(i / cols) * ch); fn(); c.restore(); };
  cell(7, () => { c.fillStyle = '#2e5e3a'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#f1e9c8'; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.fillText('Tierernährung', cw / 2, 52); c.font = '18px Georgia, serif'; c.fillText('Leitfaden für Studium & Praxis', cw / 2, 84); });
  cell(8, () => { c.fillStyle = '#fff'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#00aa5a'; c.fillRect(0, 0, cw, 14); c.fillStyle = '#222'; c.font = 'bold 20px Arial'; c.textAlign = 'left'; c.fillText('Tierernährung VO', 14, 44); c.font = '15px Arial'; c.fillStyle = '#666'; c.fillText('Folien Teil 1 · WS 2026/27', 14, 68); c.fillStyle = '#ccc'; for (let k = 0; k < 4; k++) c.fillRect(14, 82 + k * 10, 160 + (k * 37) % 60, 4); });
  cell(9, () => { c.fillStyle = '#fff'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#222'; c.font = 'bold 18px Arial'; c.textAlign = 'left'; c.fillText('Handout: Rationsberechnung', 12, 30); c.fillStyle = '#999'; for (let k = 0; k < 8; k++) c.fillRect(12, 44 + k * 10, 200 - (k * 23) % 70, 4); });
  cell(10, () => { c.fillStyle = '#fff'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#222'; c.font = 'bold 16px Arial'; c.textAlign = 'left'; c.fillText('Exkursion Lehr- und Forschungsbetrieb', 10, 22); c.strokeStyle = '#aaa'; c.lineWidth = 1; for (let k = 0; k < 9; k++) { c.beginPath(); c.moveTo(10, 34 + k * 10); c.lineTo(cw - 10, 34 + k * 10); c.stroke(); } c.strokeStyle = '#1f3d8a'; c.lineWidth = 1.6; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(14, 31 + k * 10); for (let x = 0; x < 70; x += 6) c.lineTo(14 + x, 31 + k * 10 - ((x * 7 + k * 13) % 5)); c.stroke(); } });
  cell(11, () => { c.fillStyle = '#e8f3ec'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#00aa5a'; c.fillRect(0, 0, cw, 26); c.fillStyle = '#fff'; c.font = 'bold 16px Arial'; c.textAlign = 'left'; c.fillText('Studierendenausweis', 10, 19); c.fillStyle = '#b9c4cc'; c.fillRect(12, 38, 56, 70); c.fillStyle = '#333'; c.fillRect(80, 46, 120, 8); c.fillRect(80, 64, 90, 6); c.fillRect(80, 80, 140, 6); });
  return { cv, cols, rows };
}
/** Futtermittel-Füllungen (Atlas, je Zelle eine Textur) */
const FEEDS = ['hay', 'grassSilage', 'maizeSilage', 'barley', 'soy', 'mineral', 'pellets'];
function drawFeeds() {
  const s = 256, cols = 4, rows = 2, cv = canvas(s * cols, s * rows), c = cv.getContext('2d');
  const r = makeRng(77);
  FEEDS.forEach((f, i) => {
    c.save(); c.translate((i % cols) * s, Math.floor(i / cols) * s);
    const base = { hay: '#b8a35a', grassSilage: '#6f7a33', maizeSilage: '#b49a3c', barley: '#d4b97a', soy: '#d9c28f', mineral: '#c9c3b5', pellets: '#8c6b45' }[f];
    c.fillStyle = base; c.fillRect(0, 0, s, s);
    if (f === 'hay' || f === 'grassSilage') for (let k = 0; k < 500; k++) { c.strokeStyle = `hsla(${f === 'hay' ? 48 + r.range(-8, 8) : 72 + r.range(-10, 10)},${40 + r.range(0, 25)}%,${(f === 'hay' ? 48 : 30) + r.range(-12, 14)}%,0.9)`; c.lineWidth = 1 + r.next() * 2; c.beginPath(); const x = r.next() * s, y = r.next() * s, a = r.range(-0.6, 0.6) + (r.chance(0.5) ? 0 : Math.PI / 2); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20 + r.range(-6, 6), x + Math.cos(a) * 45, y + Math.sin(a) * 45); c.stroke(); }
    if (f === 'maizeSilage') for (let k = 0; k < 1400; k++) { c.fillStyle = r.chance(0.2) ? '#e2c341' : `hsl(${50 + r.range(-6, 6)},${45 + r.range(0, 20)}%,${36 + r.range(-10, 12)}%)`; c.fillRect(r.next() * s, r.next() * s, 2 + r.next() * 6, 2 + r.next() * 4); }
    if (f === 'barley' || f === 'soy') for (let k = 0; k < 1800; k++) { c.fillStyle = `hsl(${f === 'barley' ? 40 : 38},${35 + r.range(0, 20)}%,${(f === 'barley' ? 58 : 66) + r.range(-14, 10)}%)`; c.beginPath(); c.ellipse(r.next() * s, r.next() * s, f === 'barley' ? 4 : 2.5, f === 'barley' ? 2 : 2, r.next() * 3, 0, 7); c.fill(); }
    if (f === 'mineral') for (let k = 0; k < 3000; k++) { c.fillStyle = `hsl(${30 + r.range(-20, 20)},${8 + r.range(0, 10)}%,${70 + r.range(-20, 20)}%)`; c.fillRect(r.next() * s, r.next() * s, 1.5, 1.5); }
    if (f === 'pellets') for (let k = 0; k < 420; k++) { const x = r.next() * s, y = r.next() * s; c.fillStyle = `hsl(28,${35 + r.range(0, 15)}%,${30 + r.range(-6, 10)}%)`; c.beginPath(); c.ellipse(x, y, 7, 4, r.next() * 3, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x - 3, y - 2, 4, 1.5); }
    c.restore();
  });
  return { cv, cols, rows, index: f => FEEDS.indexOf(f) };
}
/** Tastatur (DE-Layout, QWERTZ) */
function drawKeyboard(dark) {
  const cv = canvas(1024, 400), c = cv.getContext('2d');
  c.fillStyle = dark ? '#1a1b1e' : '#c4c7cc'; c.fillRect(0, 0, 1024, 400);
  const rows = ['^1234567890ß´', 'QWERTZUIOPÜ+', 'ASDFGHJKLÖÄ#', '<YXCVBNM,.-'];
  const kw = 64, gap = 8, x0 = 40;
  c.font = 'bold 20px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const key = (x, y, w, label) => { c.fillStyle = dark ? '#0c0c0e' : '#202226'; c.beginPath(); c.roundRect(x, y, w, kw, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x + 2, y + 2, w - 4, 3); c.fillStyle = '#e6e8eb'; if (label) c.fillText(label, x + w / 2, y + kw / 2); };
  rows.forEach((r, i) => { const y = 24 + i * (kw + gap); let x = x0 + [0, 40, 56, 24][i]; for (const ch of r) { key(x, y, kw, ch); x += kw + gap; } if (i === 0) key(x, y, 1024 - x - 40, '⌫'); if (i === 1) key(x, y, 1024 - x - 40, '↵'); if (i === 2) key(x, y, 1024 - x - 40, ''); if (i === 3) key(x, y, 1024 - x - 40, '⇧'); });
  const y = 24 + 4 * (kw + gap);
  key(40, y, 80, 'Strg'); key(128, y, 64, 'Fn'); key(200, y, 64, '⊞'); key(272, y, 72, 'Alt'); key(352, y, 360, ''); key(720, y, 72, 'AltGr'); key(800, y, 64, '◂'); key(872, y, 64, '▾'); key(944, y, 40, '▸');
  if (dark) { c.fillStyle = '#d0201a'; c.beginPath(); c.arc(492, 24 + 3 * (kw + gap) - 4, 8, 0, 7); c.fill(); }
  return cv;
}

// ------------------------------------------------------------------ Hauptaufbau
export function buildProps(gfx, hall, plan, opts = {}) {
  const scene = gfx.scene, rng = makeRng(opts.seed || 2026);
  const B = new Batcher();
  const PM = {};
  PM.matte = gfx.pbr({ name: 'propMatte', recipe: 'plastic', texOpts: { c1: '#ffffff', size: 256, seed: 21 }, noMap: true, vertexColors: true });
  PM.gloss = gfx.pbr({ name: 'propGloss', color: 0xffffff, roughness: 0.3, vertexColors: true });
  PM.metal = gfx.pbr({ name: 'propMetal', recipe: 'metalBrushed', texOpts: { c1: '#ffffff', size: 256, seed: 5 }, noMap: true, metalness: 1, roughness: 1, vertexColors: true });
  PM.fabric = gfx.pbr({ name: 'propFabric', recipe: 'fabric', texOpts: { c1: '#ffffff', size: 512, seed: 6 }, noMap: true, vertexColors: true, normalScale: 0.8 });
  PM.paper = gfx.pbr({ name: 'propPaper', recipe: 'paper', texOpts: { c1: '#ffffff', size: 256 }, noMap: true, vertexColors: true });
  PM.glass = new THREE.MeshPhysicalMaterial({ color: 0xeef6f8, transparent: true, opacity: 0.28, roughness: 0.06, metalness: 0, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
  gfx.register(PM.glass);
  const texOf = cv => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const scr = drawStudentScreens(), stk = drawStickers(), nb = drawNotebooks(), lab = drawLabels(), feed = drawFeeds();
  PM.screens = new THREE.MeshBasicMaterial({ map: texOf(scr.cv), color: 0x8c8c8c });
  PM.stickers = new THREE.MeshStandardMaterial({ map: texOf(stk.cv), roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); gfx.register(PM.stickers);
  PM.pages = gfx.pbr({ name: 'notePages', recipe: 'paper', texOpts: { c1: '#ffffff', size: 256 }, noMap: true, roughness: 1 }); PM.pages.map = texOf(nb.cv);
  PM.labels = gfx.pbr({ name: 'labels', color: 0xffffff, roughness: 0.85 }); PM.labels.map = texOf(lab.cv);
  PM.feed = gfx.pbr({ name: 'feed', color: 0xffffff, roughness: 0.95 }); PM.feed.map = texOf(feed.cv);
  const C = (hex) => ({ color: hex });

  // ----------------------------------------------------- Bausteine
  const laptopParts = (m, style, open = 1.88, screenCell = 0, stickers = [], bb = B) => {
    // style: 'silver' | 'black' | 'grey'; m: Matrix der Laptop-Mitte auf der Fläche (lokal +z zum Nutzer)
    const body = { silver: 0xc9ccd1, black: 0x1d1e21, grey: 0x6d7076 }[style];
    const metalMat = style === 'black' ? PM.matte : PM.metal;
    const w = style === 'black' ? 0.33 : 0.31, d = style === 'black' ? 0.225 : 0.215;
    bb.add(rbox(w, 0.016, d, 0.006), metalMat, M4(m, mat(0, 0.008, 0)), { ...C(body), keepUV: true, cast: true });
    bb.add(box(w - 0.03, 0.001, d * 0.42), PM.matte, M4(m, mat(0, 0.0165, -0.025)), { ...C(style === 'silver' ? 0x2a2c30 : 0x121214), keepUV: true, cast: false });
    bb.add(box(0.1, 0.001, 0.06), PM.gloss, M4(m, mat(0, 0.0165, 0.065)), { ...C(style === 'black' ? 0x232427 : 0xb5b8bd), keepUV: true, cast: false });
    // Deckel (um Scharnier hinten gedreht)
    const hinge = M4(m, mat(0, 0.016, -d / 2, -open, 0, 0)); // 0 = zu
    bb.add(rbox(w, 0.006, d, 0.004), metalMat, M4(hinge, mat(0, 0.003, d / 2)), { ...C(body), keepUV: true });
    bb.add(box(w - 0.012, 0.001, d - 0.016), PM.matte, M4(hinge, mat(0, -0.0005, d / 2)), { ...C(0x08090a), keepUV: true, cast: false });
    const sg = new THREE.PlaneGeometry(w - 0.03, (w - 0.03) * 0.625); sg.rotateX(Math.PI / 2); atlasUV(sg, screenCell, scr.cols, scr.rows);
    bb.add(sg, PM.screens, M4(hinge, mat(0, -0.0012, d / 2 + 0.002)), { keepUV: true, cast: false });
    stickers.forEach(([cell, x, z, s, rot]) => { const g = new THREE.PlaneGeometry(s, s); g.rotateX(-Math.PI / 2); atlasUV(g, cell, stk.cols, stk.rows); bb.add(g, PM.stickers, M4(hinge, mat(x, 0.0062, d / 2 + z, 0, rot, 0)), { keepUV: true, cast: false }); });
  };
  const notebookOpen = (m, cell) => {
    B.add(box(0.297, 0.006, 0.21), PM.paper, M4(m, mat(0, 0.003, 0)), { ...C(0xe9e6dc), keepUV: true });
    const g = new THREE.PlaneGeometry(0.29, 0.205); g.rotateX(-Math.PI / 2); atlasUV(g, cell, nb.cols, nb.rows);
    B.add(g, PM.pages, M4(m, mat(0, 0.0063, 0)), { keepUV: true, cast: false });
    for (let k = 0; k < 14; k++) B.add(new THREE.TorusGeometry(0.004, 0.0009, 4, 8), PM.metal, M4(m, mat(-0.13 + k * 0.02, 0.006, -0.105, 0, Math.PI / 2, 0)), { ...C(0x9a9da2), keepUV: true, cast: false });
  };
  const pen = (m, color = 0x1f3d8a, len = 0.14) => { B.add(cyl(0.0045, 0.0045, len, 8), PM.gloss, M4(m, mat(0, 0.0045, 0, 0, 0, Math.PI / 2)), { ...C(0xf2f2f2), keepUV: true, cast: false }); B.add(cyl(0.0048, 0.0048, 0.03, 8), PM.gloss, M4(m, mat(len / 2 - 0.012, 0.0046, 0, 0, 0, Math.PI / 2)), { ...C(color), keepUV: true, cast: false }); };
  const highlighter = (m, color) => { B.add(rbox(0.12, 0.016, 0.02, 0.006), PM.gloss, M4(m, mat(0, 0.009, 0)), { ...C(color), keepUV: true, cast: false }); B.add(rbox(0.035, 0.018, 0.022, 0.006), PM.gloss, M4(m, mat(0.05, 0.009, 0)), { ...C(0x222222), keepUV: true, cast: false }); };
  const bottlePET = m => { B.add(cyl(0.032, 0.032, 0.2, 14), PM.glass, M4(m, mat(0, 0.1, 0)), { ...C(0xd8eef5), keepUV: true }); B.add(cyl(0.031, 0.031, 0.06, 14), PM.paper, M4(m, mat(0, 0.11, 0)), { ...C(0x2e86c1), keepUV: true }); B.add(cyl(0.013, 0.013, 0.018, 10), PM.gloss, M4(m, mat(0, 0.235, 0)), { ...C(0x2e86c1), keepUV: true }); B.add(cyl(0.013, 0.031, 0.03, 14, true), PM.glass, M4(m, mat(0, 0.214, 0)), { ...C(0xd8eef5), keepUV: true }); };
  const bottleSteel = (m, col) => { B.add(cyl(0.035, 0.035, 0.23, 16), PM.matte, M4(m, mat(0, 0.115, 0)), { ...C(col), keepUV: true }); B.add(cyl(0.022, 0.03, 0.035, 14), PM.metal, M4(m, mat(0, 0.245, 0)), { ...C(0xb8bcc2), keepUV: true }); };
  const mateBottle = m => { B.add(cyl(0.031, 0.031, 0.17, 14), PM.glass, M4(m, mat(0, 0.085, 0)), { ...C(0x9a7a3a), keepUV: true }); B.add(cyl(0.012, 0.03, 0.06, 14, true), PM.glass, M4(m, mat(0, 0.2, 0)), { ...C(0x9a7a3a), keepUV: true }); B.add(cyl(0.03, 0.03, 0.07, 14, true), PM.paper, M4(m, mat(0, 0.1, 0)), { ...C(0x7dc4e4), keepUV: true }); B.add(cyl(0.0125, 0.0125, 0.008, 10), PM.metal, M4(m, mat(0, 0.234, 0)), { ...C(0xc9a227), keepUV: true }); };
  const mensaCup = m => { B.add(cyl(0.042, 0.03, 0.12, 16), PM.paper, M4(m, mat(0, 0.06, 0)), { ...C(0xf3efe6), keepUV: true }); B.add(cyl(0.0425, 0.0425, 0.03, 16, true), PM.paper, M4(m, mat(0, 0.08, 0)), { ...C(0x00aa5a), keepUV: true }); B.add(cyl(0.044, 0.044, 0.01, 16), PM.gloss, M4(m, mat(0, 0.124, 0)), { ...C(0xfafafa), keepUV: true }); };
  const thermo = (m, col) => { if (RP && (col & 1) && real(((col >> 1) & 1) ? 'modified_thermos' : 'plastic_thermos', m, { scale: 0.75 })) return; thermoProc(m, col); };
  const thermoProc = (m, col) => { B.add(cyl(0.038, 0.034, 0.17, 16), PM.matte, M4(m, mat(0, 0.085, 0)), { ...C(col), keepUV: true }); B.add(cyl(0.039, 0.039, 0.025, 16), PM.gloss, M4(m, mat(0, 0.18, 0)), { ...C(0x222222), keepUV: true }); };
  const phoneDown = (m, col) => { B.add(rbox(0.074, 0.009, 0.155, 0.008), PM.gloss, M4(m, mat(0, 0.0045, 0)), { ...C(col), keepUV: true, cast: false }); B.add(cyl(0.008, 0.008, 0.002, 10), PM.gloss, M4(m, mat(-0.02, 0.0095, -0.055)), { ...C(0x111111), keepUV: true, cast: false }); };
  const RP = opts.models || null;
  const real = (id, m, o) => !!(RP && RP.place(B, id, m, o));
  const appleProc = m => { B.add(new THREE.SphereGeometry(0.036, 14, 10), PM.gloss, M4(m, mat(0, 0.034, 0, 0, 0, 0, 1, 0.9, 1)), { ...C(0xb8282a), keepUV: true }); B.add(cyl(0.002, 0.002, 0.018, 5), PM.matte, M4(m, mat(0, 0.07, 0)), { ...C(0x5d3a1a), keepUV: true, cast: false }); };
  const apple = m => { if (!real('food_apple_01', M4(m, mat(0, 0, 0, 0, rng.range(0, 6), 0)))) appleProc(m); };
  const fruit = (m, r) => { const id = r.pick(['croissant', 'lemon', 'food_apple_01', 'food_pears_asian_01', 'food_kiwi_01', 'lemon']); if (!real(id, M4(m, mat(0, 0, 0, 0, r.range(0, 6), 0)))) appleProc(m); };
  const kornspitz = m => { if (real('hamburger_buns', M4(m, mat(0, 0, 0, 0, rng.range(0, 6), 0)), { node: rng.int(0, 2) })) return; B.add(rbox(0.18, 0.05, 0.09, 0.02), PM.paper, M4(m, mat(0, 0.025, 0, 0, 0, 0.05)), { ...C(0xd8c3a0), keepUV: true }); };
  const pencilCase = (m, col) => { B.add(cyl(0.03, 0.03, 0.2, 12), PM.fabric, M4(m, mat(0, 0.028, 0, 0, 0, Math.PI / 2, 1, 0.9, 1)), { ...C(col), keepUV: true }); B.add(box(0.19, 0.003, 0.006), PM.metal, M4(m, mat(0, 0.055, 0)), { ...C(0x999999), keepUV: true, cast: false }); };
  const calculator = m => { B.add(rbox(0.08, 0.014, 0.16, 0.006), PM.matte, M4(m, mat(0, 0.007, 0)), { ...C(0x2b2d31), keepUV: true, cast: false }); B.add(box(0.06, 0.001, 0.025), PM.gloss, M4(m, mat(0, 0.0145, -0.055)), { ...C(0x8fa38a), keepUV: true, cast: false }); for (let k = 0; k < 20; k++) B.add(box(0.011, 0.002, 0.008), PM.matte, M4(m, mat(-0.024 + (k % 4) * 0.016, 0.015, -0.02 + Math.floor(k / 4) * 0.016)), { ...C(k % 4 === 3 ? 0x4a6a8a : 0x5a5d63), keepUV: true, cast: false }); };
  const stackPaper = (m, cell, n = 1) => { B.add(box(0.21, 0.002 * n + 0.002, 0.297), PM.paper, M4(m, mat(0, 0.001 * n + 0.001, 0)), { ...C(0xf7f7f2), keepUV: true, cast: false }); const g = new THREE.PlaneGeometry(0.2, 0.1); g.rotateX(-Math.PI / 2); atlasUV(g, cell, lab.cols, lab.rows); B.add(g, PM.labels, M4(m, mat(0, 0.0022 * n + 0.0025, -0.09)), { keepUV: true, cast: false }); };
  const book = (m) => { B.add(rbox(0.17, 0.035, 0.24, 0.003), PM.matte, M4(m, mat(0, 0.0175, 0)), { ...C(0x2e5e3a), keepUV: true }); B.add(box(0.162, 0.03, 0.234), PM.paper, M4(m, mat(0.006, 0.0175, 0)), { ...C(0xf1ebdc), keepUV: true, cast: false }); const g = new THREE.PlaneGeometry(0.16, 0.08); g.rotateX(-Math.PI / 2); atlasUV(g, 7, lab.cols, lab.rows); B.add(g, PM.labels, M4(m, mat(0, 0.0355, -0.05)), { keepUV: true, cast: false }); };
  const tablet = m => { B.add(rbox(0.25, 0.007, 0.175, 0.008), PM.metal, M4(m, mat(0, 0.0035, 0)), { ...C(0x8d9096), keepUV: true, cast: false }); const g = new THREE.PlaneGeometry(0.235, 0.16); g.rotateX(-Math.PI / 2); atlasUV(g, 2, scr.cols, scr.rows); B.add(g, PM.screens, M4(m, mat(0, 0.0072, 0)), { keepUV: true, cast: false }); B.add(cyl(0.0045, 0.0045, 0.16, 8), PM.gloss, M4(m, mat(0.14, 0.005, 0, Math.PI / 2, 0, 0)), { ...C(0xf2f2f2), keepUV: true, cast: false }); };
  const earbuds = m => { B.add(rbox(0.05, 0.022, 0.06, 0.01), PM.gloss, M4(m, mat(0, 0.011, 0)), { ...C(0xf5f5f5), keepUV: true, cast: false }); };
  const headphonesDesk = (m, col) => { const g = new THREE.TorusGeometry(0.085, 0.012, 6, 20, Math.PI); B.add(g, PM.matte, M4(m, mat(0, 0.012, 0, -Math.PI / 2, 0, 0)), { ...C(col), keepUV: true }); for (const sx of [-1, 1]) B.add(cyl(0.04, 0.04, 0.035, 16), PM.matte, M4(m, mat(sx * 0.085, 0.02, 0)), { ...C(col), keepUV: true }); };
  const keys = m => { B.add(new THREE.TorusGeometry(0.014, 0.0018, 5, 14), PM.metal, M4(m, mat(0, 0.002, 0, Math.PI / 2, 0, 0)), { ...C(0xa8acb2), keepUV: true, cast: false }); for (let k = 0; k < 3; k++) B.add(box(0.045, 0.002, 0.012), PM.metal, M4(m, mat(0.03, 0.002, -0.01 + k * 0.012, 0, 0.3 * k - 0.3, 0)), { ...C(k === 1 ? 0xc9a227 : 0xb0b4ba), keepUV: true, cast: false }); };
  const card = m => { const g = new THREE.PlaneGeometry(0.0856, 0.054); g.rotateX(-Math.PI / 2); atlasUV(g, 11, lab.cols, lab.rows); B.add(box(0.0856, 0.0008, 0.054), PM.gloss, M4(m, mat(0, 0.0004, 0)), { ...C(0xffffff), keepUV: true, cast: false }); B.add(g, PM.labels, M4(m, mat(0, 0.0009, 0)), { keepUV: true, cast: false }); };
  const gum = m => B.add(rbox(0.07, 0.012, 0.025, 0.003), PM.gloss, M4(m, mat(0, 0.006, 0)), { ...C(0x2ecc71), keepUV: true, cast: false });
  const tissues = m => B.add(rbox(0.1, 0.022, 0.055, 0.01), PM.fabric, M4(m, mat(0, 0.011, 0)), { ...C(0xf2f5f8), keepUV: true, cast: false });
  const usb = m => B.add(rbox(0.045, 0.008, 0.016, 0.003), PM.gloss, M4(m, mat(0, 0.004, 0)), { ...C(0xd35400), keepUV: true, cast: false });
  const sticky = m => B.add(box(0.076, 0.012, 0.076), PM.paper, M4(m, mat(0, 0.006, 0)), { ...C(0xf7e463), keepUV: true, cast: false });
  const ruler = m => B.add(box(0.2, 0.002, 0.1), PM.glass, M4(m, mat(0, 0.001, 0, 0, 0, 0, 1, 1, 1)), { ...C(0xe8f0f0), keepUV: true, cast: false });
  const mouse = m => B.add(rbox(0.06, 0.03, 0.1, 0.015), PM.gloss, M4(m, mat(0, 0.015, 0)), { ...C(0x2b2d31), keepUV: true, cast: false });
  const charger = (m, len) => { B.add(rbox(0.06, 0.028, 0.06, 0.006), PM.matte, M4(m, mat(0, 0.014, 0)), { ...C(0xf0f0f0), keepUV: true }); B.add(cyl(0.002, 0.002, len, 5), PM.matte, M4(m, mat(len / 2, 0.003, 0.02, 0, 0, Math.PI / 2)), { ...C(0xf0f0f0), keepUV: true, cast: false }); };
  const beanie = (m, col) => B.add(new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), PM.fabric, M4(m, mat(0, 0, 0, 0, 0, 0, 1, 0.45, 1.2)), { ...C(col), keepUV: true });
  // Rucksack auf der Bank / am Boden
  const backpack = (m, col, col2) => {
    B.add(rbox(0.3, 0.42, 0.17, 0.06, 2), PM.fabric, M4(m, mat(0, 0.21, 0)), { ...C(col), tile: 0.3 });
    B.add(rbox(0.24, 0.18, 0.06, 0.04, 2), PM.fabric, M4(m, mat(0, 0.14, 0.1)), { ...C(col2), tile: 0.3 });
    B.add(rbox(0.26, 0.012, 0.012, 0.004), PM.matte, M4(m, mat(0, 0.235, 0.13)), { ...C(0x222222), keepUV: true, cast: false });
    for (const sx of [-1, 1]) B.add(rbox(0.05, 0.36, 0.02, 0.01), PM.fabric, M4(m, mat(sx * 0.08, 0.22, -0.095, 0.1, 0, 0)), { ...C(col2), tile: 0.3, cast: false });
    B.add(new THREE.TorusGeometry(0.03, 0.008, 5, 10, Math.PI), PM.fabric, M4(m, mat(0, 0.42, -0.02)), { ...C(col2), keepUV: true, cast: false });
  };
  // Jacke über die Rückenlehne gehängt
  const jacket = (x, row, col) => {
    const f = LY.rowFloor(row), bz = LY.rowFront(row) + LY.ROW_DEPTH - 0.035;
    B.add(rbox(0.42, 0.34, 0.05, 0.02, 2), PM.fabric, mat(x, f + LY.SEAT_H + 0.3, bz - 0.04, -0.12), { ...C(col), tile: 0.3 });
    B.add(rbox(0.42, 0.22, 0.04, 0.02, 2), PM.fabric, mat(x, f + LY.SEAT_H + 0.33, bz + 0.03, -0.1), { ...C(col), tile: 0.3 });
    for (const sx of [-1, 1]) B.add(rbox(0.1, 0.4, 0.07, 0.03, 2), PM.fabric, mat(x + sx * 0.22, f + LY.SEAT_H + 0.2, bz - 0.06, -0.1, 0, sx * 0.08), { ...C(col), tile: 0.3 });
  };
  const helmet = m => { B.add(new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), PM.gloss, M4(m, mat(0, 0, 0, 0, 0, 0, 1, 0.8, 1.25)), { ...C(0x1f6f8b), keepUV: true }); for (let k = -2; k <= 2; k++) B.add(box(0.012, 0.012, 0.2), PM.matte, M4(m, mat(k * 0.04, 0.1 - Math.abs(k) * 0.012, 0)), { ...C(0x111111), keepUV: true, cast: false }); };
  const umbrella = m => { B.add(cyl(0.035, 0.012, 0.75, 8), PM.fabric, M4(m, mat(0, 0.375, 0)), { ...C(0x1c2833), keepUV: true }); B.add(new THREE.TorusGeometry(0.035, 0.007, 5, 10, Math.PI), PM.matte, M4(m, mat(0.035, 0.78, 0)), { ...C(0x3b2a1e), keepUV: true }); };

  // ----------------------------------------------------- Pulte der Studierenden
  const SCARF = [0x8a3a2e, 0x2c3e50, 0x7d6608, 0x5b2c6f, 0x1e8449];
  const BAGS = [[0x2c3e50, 0x1b2631], [0x7b241c, 0x4a1a14], [0x1e8449, 0x145a32], [0x5d6d7e, 0x34495e], [0x283747, 0xd35400], [0x6c3483, 0x4a235a], [0x1a1a1a, 0x444444], [0xb9770e, 0x7e5109]];
  const PHONE = [0x1a1a1a, 0xf2f2f2, 0x34495e, 0x8e44ad, 0xc0392b];
  const studentDesk = (s) => {
    const r = makeRng(s.seed), row = s.seat.row, x = s.seat.x, zc = LY.rowFront(row) + 0.21;
    const items = [];
    if (s.hasLaptop) {
      const style = r.pick(['silver', 'silver', 'grey', 'black']);
      const st = r.chance(0.55) ? Array.from({ length: r.int(1, 4) }, () => [r.int(0, STICKERS - 1), r.range(-0.11, 0.11), r.range(-0.08, 0.08), r.range(0.04, 0.065), r.range(-0.5, 0.5)]) : [];
      laptopParts(onDesk(row, x + r.range(-0.03, 0.03), zc + 0.01, r.range(-0.08, 0.08)), style, r.range(1.75, 1.95), scr.index(s.screen), st);
      if (r.chance(0.35)) charger(onDesk(row, x + 0.2, zc - 0.07, r.range(-1, 1)), 0.25);
      if (r.chance(0.2)) mouse(onDesk(row, x + 0.23, zc + 0.04, r.range(-0.3, 0.3)));
    } else if (s.notebook) {
      notebookOpen(onDesk(row, x, zc + 0.02, r.range(-0.12, 0.12)), r.int(0, 3));
      pen(onDesk(row, x + 0.08, zc + 0.05, r.range(-0.6, 0.6)), r.pick([0x1f3d8a, 0x111111, 0xc0392b]));
    }
    if (s.notebook && s.hasLaptop && r.chance(0.4)) stackPaper(onDesk(row, x - 0.25, zc, r.range(-0.2, 0.2)), 8, 3);
    // Kleinkram
    const extras = [() => highlighter(onDesk(row, x + r.range(-0.25, 0.25), zc + 0.09, r.range(-1, 1)), r.pick([0xf7dc1f, 0x58d68d, 0xf1948a])),
      () => pencilCase(onDesk(row, x - 0.22, zc + 0.05, r.range(-0.3, 0.3)), r.pick([0x34495e, 0x7d3c98, 0x1e8449, 0x922b21])),
      () => phoneDown(onDesk(row, x + 0.22, zc + 0.06, r.range(-0.4, 0.4)), r.pick(PHONE)),
      () => calculator(onDesk(row, x - 0.24, zc + 0.02, r.range(-0.3, 0.3))),
      () => apple(onDesk(row, x + 0.25, zc - 0.05)), () => fruit(onDesk(row, x + 0.24, zc - 0.04), r), () => kornspitz(onDesk(row, x - 0.25, zc - 0.04, r.range(-0.4, 0.4))),
      () => earbuds(onDesk(row, x + 0.2, zc + 0.08)), () => keys(onDesk(row, x + 0.24, zc + 0.08, r.range(0, 3))),
      () => card(onDesk(row, x - 0.2, zc + 0.08, r.range(-0.3, 0.3))), () => gum(onDesk(row, x + 0.18, zc - 0.08, r.range(0, 2))),
      () => tissues(onDesk(row, x - 0.18, zc - 0.07, r.range(-0.3, 0.3))), () => sticky(onDesk(row, x - 0.2, zc + 0.06, r.range(-0.3, 0.3))),
      () => book(onDesk(row, x - 0.26, zc, r.range(-0.15, 0.15))), () => tablet(onDesk(row, x - 0.05, zc, r.range(-0.1, 0.1))),
      () => usb(onDesk(row, x + 0.15, zc + 0.08, r.range(0, 3))), () => ruler(onDesk(row, x - 0.15, zc + 0.03, r.range(-0.3, 0.3))),
      () => headphonesDesk(onDesk(row, x + 0.24, zc, r.range(-0.5, 0.5)), r.pick([0x1a1a1a, 0xf0f0f0, 0x34495e])),
      () => real('digital_wrist_watch', onDesk(row, x + 0.22, zc + 0.07, r.range(0, 6))),
      () => { if (r.chance(0.3)) real('gamepad', onDesk(row, x - 0.22, zc + 0.03, r.range(-0.5, 0.5)), { scale: 0.38 }); },
      () => beanie(onDesk(row, x - 0.24, zc + 0.02, r.range(0, 3)), r.pick(SCARF))];
    const n = opts.lite ? r.int(0, 1) : r.int(0, 3);   // mobil (lite) weniger Kleinkram je Platz – Dreiecksbudget Handy
    for (let i = 0; i < n; i++) r.pick(extras)();
    // Getränke auf der Ablageleiste
    if (s.bottle) { const k = r.int(0, 2); const m = onLedge(row, x + r.range(-0.25, 0.25), r.range(0, 6)); if (k === 0) bottlePET(m); else if (k === 1) bottleSteel(m, r.pick([0x2e86c1, 0xa93226, 0x1e8449, 0xd0d3d4, 0x17202a])); else mateBottle(m); }
    if (s.cup) { if (r.chance(0.6)) mensaCup(onLedge(row, x + r.range(-0.2, 0.2))); else thermo(onLedge(row, x + r.range(-0.2, 0.2)), r.pick([0x7b241c, 0x1b4f72, 0x0e6251, 0x4d5656])); }
    // Rucksack: am Boden vor den Füßen (Fußraum unter dem Pult)
    if (s.backpack && (!opts.lite || r.chance(0.5))) { const [c1, c2] = r.pick(BAGS); const side = r.chance(0.5) ? 1 : -1; backpack(mat(x + side * 0.27, LY.rowFloor(row), LY.rowFront(row) + 0.14, -0.1, side * Math.PI / 2 + r.range(-0.25, 0.25), 0), c1, c2); }
    if (s.jacketOnBench && (!opts.lite || r.chance(0.5))) jacket(x, row, r.pick([0x1b2631, 0x5d4037, 0x2e4053, 0x7d6608, 0x641e16, 0x283747]));
    if (r.chance(0.08) && !occupied.has(`${row}-${s.seat.k + 1}`)) helmet(mat(x + 0.32, LY.rowFloor(row) + LY.SEAT_H + 0.02, LY.seatZ(row) - 0.02, 0, r.range(0, 6), 0));
    if (opts.weather === 'rain' && r.chance(0.25)) umbrella(mat(x + 0.25, LY.rowFloor(row), LY.rowFront(row) + 0.5, 0.25, 0, 0.1));
    return items;
  };
  const occupied = new Set(plan.students.map(s => `${s.seat.row}-${s.seat.k}`)); occupied.add(`${plan.player.row}-${plan.player.k}`);
  const all = [...plan.students];
  for (const s of all) studentDesk(s);
  // Spätkommer:in: Pult bleibt zunächst leer; Laptop erscheint mit dem Hinsetzen → eigenes Mesh
  // Leere Plätze: hier und da vergessener Kram
  for (const e of plan.emptySeats) {
    if (rng.chance(0.06)) { const zc = LY.rowFront(e.row) + 0.21; stackPaper(onDesk(e.row, e.x, zc, rng.range(-0.4, 0.4)), 9, 1); }
    else if (rng.chance(0.03)) B.add(new THREE.IcosahedronGeometry(0.03, 1), PM.paper, mat(e.x + rng.range(-0.2, 0.2), LY.rowFloor(e.row) + 0.028, LY.rowFront(e.row) + 0.45), { ...C(0xf2f2ee), keepUV: true }); // zerknülltes Papier
  }

  // ----------------------------------------------------- Platz des Spielers
  const ps = LY.allSeats().find(s => s.row === plan.player.row && s.k === plan.player.k);
  const prow = ps.row, pzc = LY.rowFront(prow) + 0.21;
  const player = {};
  {
    // Laptop (eigenes Mesh mit Deckelgelenk und Bildschirmtextur)
    const g = new THREE.Group();
    g.matrixAutoUpdate = false; g.matrix.copy(onDesk(prow, ps.x - 0.06, pzc + 0.015, 0.04)); g.matrixWorldNeedsUpdate = true;
    scene.add(g);
    const alu = gfx.pbr({ name: 'playerLaptop', recipe: 'metalBrushed', texOpts: { c1: '#4f5359', size: 512, seed: 9 }, metalness: 1, roughness: 1 });
    const w = 0.314, d = 0.218;
    const base = new THREE.Mesh(rbox(w, 0.015, d, 0.006, 2), alu); base.position.y = 0.0075; base.castShadow = base.receiveShadow = true; g.add(base);
    const kbTex = texOf(drawKeyboard(false));
    const kbMat = gfx.pbr({ name: 'keyboard', color: 0xffffff, roughness: 0.6 }); kbMat.map = kbTex;
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.03, (w - 0.03) * 400 / 1024), kbMat); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.0152, -0.035); kb.receiveShadow = true; g.add(kb);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.068), gfx.pbr({ name: 'trackpad', color: 0x3a3d42, roughness: 0.25, metalness: 0.2 })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.0153, 0.06); g.add(pad);
    const hinge = new THREE.Group(); hinge.position.set(0, 0.015, -d / 2); g.add(hinge);
    const lid = new THREE.Mesh(rbox(w, 0.0055, d, 0.004, 2), alu); lid.position.set(0, 0.00275, d / 2); lid.castShadow = lid.receiveShadow = true; hinge.add(lid);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.006, d - 0.006), gfx.pbr({ name: 'bezel', color: 0x0b0c0d, roughness: 0.4 })); bezel.rotation.x = Math.PI / 2; bezel.position.set(0, -0.0003, d / 2); hinge.add(bezel);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // selbstleuchtend, Helligkeit über color
    const sw = w - 0.026, sh = sw * 0.625;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat); screen.rotation.set(Math.PI / 2, 0, 0); screen.position.set(0, -0.0006, d / 2 + 0.004); hinge.add(screen);
    // Sticker am Deckel (außen) – sieht man beim Zuklappen
    for (const [cell, x, z, s, rot] of [[1, -0.08, 0.04, 0.06, 0.3], [2, 0.07, -0.03, 0.065, -0.2], [10, 0.02, 0.07, 0.05, 0.1]]) { const sg = new THREE.Mesh(atlasUV(new THREE.PlaneGeometry(s, s), cell, stk.cols, stk.rows), PM.stickers); sg.rotation.set(-Math.PI / 2, 0, rot); sg.position.set(x, 0.0058, d / 2 + z); lid.add(sg); }
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.0015, 0.0015), new THREE.MeshBasicMaterial({ color: 0xffffff })); led.position.set(-w / 2 + 0.02, 0.008, d / 2 + 0.0005); g.add(led);
    player.laptop = { group: g, hinge, lid, screen, screenMat, base, kb, sw, sh, led, setLid(deg) { hinge.rotation.x = -(deg * Math.PI / 180); }, // 0° = zu, 110° = offen
      screenWorld(u, v, out = V()) { screen.updateWorldMatrix(true, false); return out.set((u - 0.5) * sw, (0.5 - v) * sh, 0).applyMatrix4(screen.matrixWorld); },
      screenNormal(out = V()) { screen.updateWorldMatrix(true, false); return out.set(0, 0, 1).transformDirection(screen.matrixWorld); } };
    player.laptop.setLid(108);
    // Collegeblock (eigene Textur, wird beim Mitschreiben beschrieben)
    const nbCv = canvas(1024, 724);
    const nbTex = texOf(nbCv);
    drawPage(nbCv.getContext('2d'), 1024, 724, null, 1);
    const nbMat = gfx.pbr({ name: 'playerNotes', recipe: 'paper', texOpts: { c1: '#ffffff', size: 256, seed: 7 }, noMap: true, roughness: 1 }); nbMat.map = nbTex;
    const nm = onDesk(prow, ps.x + 0.27, pzc + 0.02, -0.12);
    const ng = new THREE.Group(); ng.matrixAutoUpdate = false; ng.matrix.copy(nm); scene.add(ng);
    const block = new THREE.Mesh(box(0.297, 0.007, 0.21), gfx.pbr({ name: 'blockEdge', color: 0xe8e4d8, roughness: 1 })); block.position.y = 0.0035; block.castShadow = block.receiveShadow = true; ng.add(block);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.292, 0.206), nbMat); page.rotation.x = -Math.PI / 2; page.position.y = 0.0072; page.receiveShadow = true; ng.add(page);
    const pen0 = new THREE.Group(); ng.add(pen0);
    const penBody = new THREE.Mesh(cyl(0.0045, 0.0045, 0.14, 10), gfx.pbr({ name: 'penBody', color: 0xf2f2f2, roughness: 0.35 })); penBody.rotation.z = Math.PI / 2; pen0.add(penBody);
    const penCap = new THREE.Mesh(cyl(0.0048, 0.0048, 0.03, 10), gfx.pbr({ name: 'penCap', color: 0x1f3d8a, roughness: 0.3 })); penCap.rotation.z = Math.PI / 2; penCap.position.x = 0.058; pen0.add(penCap);
    pen0.position.set(0.1, 0.012, 0.05); pen0.rotation.y = 0.5;
    player.notebook = new InkPage(nbCv, nbTex, ng, pen0);
    player.notebook.writeInstant([opts.notesHeader || 'Tierernährung VO – 27.10.']);
    // Getränk + Handy + Rucksack am Platz rechts
    mensaCup(onLedge(prow, ps.x + 0.12));
    const phoneMesh = new THREE.Mesh(rbox(0.074, 0.009, 0.155, 0.008), gfx.pbr({ name: 'playerPhone', color: 0x22262b, roughness: 0.3 }));
    phoneMesh.matrixAutoUpdate = false; phoneMesh.matrix.copy(M4(onDesk(prow, ps.x - 0.27, pzc + 0.04, 0.25), mat(0, 0.0045, 0))); phoneMesh.castShadow = false; scene.add(phoneMesh);   // flach: Schatten kaum sichtbar
    player.phone = phoneMesh;
    if (plan.player.k < LY.SEATS - 1) { const rs = LY.seatX(plan.player.k + 1); backpack(mat(rs, LY.rowFloor(prow) + LY.SEAT_H + 0.02, LY.seatZ(prow) - 0.02, -0.15, Math.PI + 0.2, 0), 0x1b4f72, 0x154360); }
    pencilCase(onDesk(prow, ps.x + 0.5, pzc + 0.06, 0.2), 0x7d3c98);
    stackPaper(onDesk(prow, ps.x + 0.62, pzc - 0.02, -0.25), 8, 6); // Folienskript (Ausdruck)
    B.add(new THREE.ConeGeometry(0.03, 0.002, 3), PM.paper, M4(onDesk(prow, ps.x + 0.69, pzc - 0.14, -0.25), mat(0, 0.016, 0, 0, 0.5, 0)), { ...C(0xf2f0e8), keepUV: true, cast: false }); // Eselsohr
    highlighter(onDesk(prow, ps.x - 0.45, pzc + 0.12, 1.3), 0xf7dc1f);   // links neben Laptop und Handy (dort, wo vorher die linke Hand das Heft hielt, sah es aus, als hielte sie ihn)
    apple(onDesk(prow, ps.x - 0.33, pzc - 0.06));
    bottlePET(onLedge(prow, ps.x - 0.36));
  }

  // ----------------------------------------------------- Vortragstisch
  const T = LY.TABLE, ty = LY.PODIUM.h + T.h;
  const onTable = (x, z, yaw = 0) => mat(T.x + x, ty, T.z + z, 0, yaw, 0);
  const table = {};
  // Probengläser mit Futtermitteln + Etikett
  FEEDS.forEach((f, i) => {
    const m = onTable(-2.0 + i * 0.17, -0.12 + (i % 2) * 0.06, rng.range(-0.3, 0.3));
    const fill = new THREE.CylinderGeometry(0.043, 0.043, 0.1, 18, 1); atlasUV(fill, feed.index(f), feed.cols, feed.rows);
    B.add(fill, PM.feed, M4(m, mat(0, 0.052, 0)), { keepUV: true });
    B.add(cyl(0.047, 0.047, 0.15, 20, true), PM.glass, M4(m, mat(0, 0.075, 0)), { ...C(0xf4f8f8), keepUV: true, cast: false });
    B.add(cyl(0.049, 0.049, 0.02, 20), PM.metal, M4(m, mat(0, 0.158, 0)), { ...C(0xc9ccd0), keepUV: true });
    const lg = new THREE.CylinderGeometry(0.0475, 0.0475, 0.045, 20, 1, true, -0.7, 1.4); atlasUV(lg, i, lab.cols, lab.rows);
    B.add(lg, PM.labels, M4(m, mat(0, 0.1, 0, 0, 0, 0)), { keepUV: true, cast: false });
  });
  // Heubüschel in Papiertüte daneben
  B.add(rbox(0.16, 0.2, 0.1, 0.01), PM.paper, M4(onTable(-2.3, 0.05, 0.3), mat(0, 0.1, 0)), { ...C(0xc8a878), keepUV: true });
  for (let k = 0; k < 18; k++) B.add(cyl(0.0015, 0.0015, 0.12, 3), PM.matte, M4(onTable(-2.3, 0.05, 0.3), mat(rng.range(-0.06, 0.06), 0.22, rng.range(-0.035, 0.035), rng.range(-0.4, 0.4), 0, rng.range(-0.5, 0.5))), { ...C(0xb8a35a), keepUV: true, cast: false });
  // Pansen-Modell (vier Mägen) auf Sockel
  {
    const m = onTable(-0.9, -0.05, 0.4);
    B.add(rbox(0.32, 0.03, 0.2, 0.01), PM.matte, M4(m, mat(0, 0.015, 0)), { ...C(0x2b2d31), keepUV: true });
    B.add(new THREE.SphereGeometry(0.1, 16, 12), PM.gloss, M4(m, mat(-0.05, 0.13, 0, 0, 0, 0, 1.2, 0.9, 0.85)), { ...C(0xc9837a), keepUV: true }); // Pansen
    B.add(new THREE.SphereGeometry(0.045, 12, 10), PM.gloss, M4(m, mat(0.08, 0.11, 0.05)), { ...C(0xb56a62), keepUV: true }); // Netzmagen
    B.add(new THREE.SphereGeometry(0.04, 12, 10), PM.gloss, M4(m, mat(0.1, 0.07, -0.03)), { ...C(0xa35a52), keepUV: true }); // Blättermagen
    B.add(new THREE.CapsuleGeometry(0.025, 0.09, 4, 10), PM.gloss, M4(m, mat(0.12, 0.05, 0.05, 0, 0, 1.2)), { ...C(0xd59a8a), keepUV: true }); // Labmagen
    B.add(cyl(0.012, 0.012, 0.12, 8), PM.gloss, M4(m, mat(-0.02, 0.24, 0.02, 0.5, 0, 0.3)), { ...C(0xe0a59a), keepUV: true }); // Schlund
  }
  // Kreideschachtel, Schwamm + Schüssel, Wischer
  {
    const m = onTable(1.6, -0.15, 0.1);
    B.add(box(0.12, 0.05, 0.08), PM.paper, M4(m, mat(0, 0.025, 0)), { ...C(0xf3f1e8), keepUV: true });
    for (let k = 0; k < 6; k++) B.add(cyl(0.005, 0.005, 0.07, 6), PM.matte, M4(m, mat(-0.04 + k * 0.016, 0.054, 0.0, 0, 0, Math.PI / 2 + 0.03 * k)), { ...C([0xf5f5f0, 0xf5f5f0, 0xf5f5f0, 0xf4d03f, 0xec7063, 0x5dade2][k]), keepUV: true, cast: false });
    const b2 = onTable(1.95, -0.12);
    B.add(cyl(0.11, 0.08, 0.09, 20, true), PM.matte, M4(b2, mat(0, 0.045, 0)), { ...C(0xd5d8dc), keepUV: true });
    B.add(cyl(0.08, 0.08, 0.005, 20), PM.matte, M4(b2, mat(0, 0.0025, 0)), { ...C(0xd5d8dc), keepUV: true });
    B.add(cyl(0.095, 0.095, 0.003, 20), PM.glass, M4(b2, mat(0, 0.06, 0)), { ...C(0xd6e4ea), keepUV: true, cast: false });
    B.add(rbox(0.14, 0.05, 0.09, 0.015), PM.fabric, M4(onTable(2.2, -0.05, 0.4), mat(0, 0.025, 0)), { ...C(0xe8c547), tile: 0.2 });
    B.add(rbox(0.14, 0.04, 0.06, 0.008), PM.matte, M4(onTable(1.3, -0.25, -0.2), mat(0, 0.02, 0)), { ...C(0x5d4037), keepUV: true });
    B.add(rbox(0.13, 0.012, 0.055, 0.006), PM.fabric, M4(onTable(1.3, -0.25, -0.2), mat(0, 0.046, 0)), { ...C(0x2c2c2c), tile: 0.2, cast: false });
  }
  // Karaffe + Glas (Glas wird beim Trinken ausgeblendet)
  B.add(cyl(0.045, 0.06, 0.24, 20, true), PM.glass, M4(onTable(0.7, -0.2), mat(0, 0.12, 0)), { ...C(0xeef6f8), keepUV: true, cast: false });
  B.add(cyl(0.055, 0.055, 0.14, 20), PM.glass, M4(onTable(0.7, -0.2), mat(0, 0.07, 0)), { ...C(0xcde3ec), keepUV: true, cast: false });
  const tg = new THREE.Mesh(cyl(0.035, 0.03, 0.11, 16, true), PM.glass.clone()); tg.material.vertexColors = false; gfx.register(tg.material);
  tg.position.set(T.x + 0.85, ty + 0.055, T.z - 0.12); scene.add(tg); table.glass = tg;
  // Aktentasche am Boden neben dem Tisch, Ordner, Brillenetui, Taschensender, Tasse, Handouts, Prof-Laptop
  {
    const m = mat(T.x + 1.9, LY.PODIUM.h, T.z - 0.6, 0, 0.3, 0);
    B.add(rbox(0.42, 0.3, 0.12, 0.03, 2), PM.matte, M4(m, mat(0, 0.15, 0)), { ...C(0x5b3a24), keepUV: true });
    B.add(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), PM.matte, M4(m, mat(0, 0.3, 0)), { ...C(0x4a2f1d), keepUV: true });
    for (const sx of [-1, 1]) B.add(box(0.03, 0.02, 0.005), PM.metal, M4(m, mat(sx * 0.12, 0.24, 0.062)), { ...C(0xc9a227), keepUV: true, cast: false });
    B.add(rbox(0.06, 0.29, 0.32, 0.006), PM.matte, M4(onTable(-1.4, 0.1, 0.05), mat(0, 0.03, 0, 0, 0, Math.PI / 2)), { ...C(0x00aa5a), keepUV: true }); // Ordner liegend
    B.add(rbox(0.16, 0.035, 0.06, 0.016), PM.matte, M4(onTable(0.35, 0.15, 0.6), mat(0, 0.0175, 0)), { ...C(0x2c3e50), keepUV: true });
    B.add(rbox(0.065, 0.09, 0.022, 0.008), PM.matte, M4(onTable(0.1, 0.25, -0.4), mat(0, 0.011, 0, -Math.PI / 2, 0, 0)), { ...C(0x1c1c1c), keepUV: true }); // Taschensender
    B.add(cyl(0.04, 0.036, 0.095, 16), PM.gloss, M4(onTable(0.5, 0.05), mat(0, 0.0475, 0)), { ...C(0xf4f1ea), keepUV: true }); // Tasse
    B.add(new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), PM.gloss, M4(onTable(0.5, 0.05), mat(0.04, 0.05, 0, 0, 0, -Math.PI / 2)), { ...C(0xf4f1ea), keepUV: true, cast: false });
    stackPaper(onTable(-0.3, 0.05, 0.15), 9, 12); stackPaper(onTable(-0.05, 0.02, -0.1), 8, 4);
    laptopParts(onTable(0.2, -0.05, Math.PI + 0.1), 'black', 1.9, 1);
    B.add(cyl(0.003, 0.003, 0.9, 5), PM.matte, M4(onTable(0.65, 0.1), mat(0, 0.003, 0, 0, 0.3, Math.PI / 2)), { ...C(0x111111), keepUV: true, cast: false }); // HDMI-Kabel
    tissues(onTable(-1.7, 0.25, 0.2));
  }
  // Klemmbrett mit Exkursionsliste (beweglich)
  {
    const g = new THREE.Group();
    const boardM = gfx.pbr({ name: 'clipboard', recipe: 'woodDesk', texOpts: { c1: '#a07a4e', c2: '#87643c', size: 256 } });
    const bd = new THREE.Mesh(rbox(0.23, 0.004, 0.32, 0.004), boardM); bd.position.y = 0.002; bd.castShadow = false; g.add(bd);
    const sheetM = gfx.pbr({ name: 'listSheet', color: 0xffffff, roughness: 0.9 }); sheetM.map = PM.labels.map;
    const sheetG = atlasUV(new THREE.PlaneGeometry(0.21, 0.29), 10, lab.cols, lab.rows); const sheet = new THREE.Mesh(sheetG, sheetM); sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 0.0045, 0.01); g.add(sheet);
    const clip = new THREE.Mesh(rbox(0.1, 0.012, 0.03, 0.004), PM.metal.clone()); clip.material.vertexColors = false; clip.material.color.set(0xb0b4ba); gfx.register(clip.material); clip.position.set(0, 0.008, -0.145); g.add(clip);
    const p2 = new THREE.Mesh(cyl(0.004, 0.004, 0.13, 8), gfx.pbr({ name: 'listPen', color: 0x1f3d8a, roughness: 0.4 })); p2.rotation.z = Math.PI / 2; p2.position.set(0.04, 0.01, 0.06); g.add(p2);
    g.position.set(T.x - 1.0, ty, T.z + 0.2); scene.add(g);
    table.list = g;
  }
  // ----------------------------------------------------- Fensterbänke, Garderobe, Boden
  {
    const sillY = LY.WINDOWS.y0 - 0.02, sx = LY.ROOM.x0 + 0.2;
    const plant = (z) => { const m = mat(sx, sillY, z); B.add(cyl(0.07, 0.055, 0.12, 16), PM.matte, M4(m, mat(0, 0.06, 0)), { ...C(0xb5651d), keepUV: true }); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; B.add(box(0.012, 0.002, 0.22), PM.matte, M4(m, mat(Math.cos(a) * 0.05, 0.16, Math.sin(a) * 0.05, -0.6, -a + Math.PI / 2, 0)), { ...C(k % 2 ? 0x58a845 : 0xa9d18e), keepUV: true }); } };
    if (!real('calathea_orbifolia_01', mat(sx + 0.02, sillY, LY.WINDOWS.list[1] - 0.5, 0, 0.4, 0), { node: 'calathea_orbifolia_01_b' })) plant(LY.WINDOWS.list[1] - 0.5);
    bottlePET(mat(sx, sillY, LY.WINDOWS.list[2] + 0.4)); mensaCup(mat(sx + 0.04, sillY, LY.WINDOWS.list[0] + 0.6));
    // Jacken an der Garderobe
    const hy = LY.BACK_FLOOR + 1.72, hz = LY.ROOM.z1 - 0.12;
    [-4.3 + 0.42, -4.3 + 0.84 * 2, -4.3 + 0.42 * 7, -4.3 + 0.42 * 9, -4.3 + 0.42 * 12].forEach((x, i) => {
      const col = [0x1b2631, 0x7b241c, 0x34495e, 0x5d4037, 0x145a32][i];
      B.add(rbox(0.42, 0.8, 0.12, 0.05, 2), PM.fabric, mat(x, hy - 0.42, hz, 0.04, 0, 0), { ...C(col), tile: 0.3 });
      B.add(rbox(0.2, 0.12, 0.1, 0.04, 2), PM.fabric, mat(x, hy + 0.0, hz + 0.01), { ...C(col), tile: 0.3 });
      if (i === 2) B.add(rbox(0.12, 0.7, 0.03, 0.01, 1), PM.fabric, mat(x + 0.18, hy - 0.35, hz + 0.06), { ...C(0xc0392b), tile: 0.3 }); // Schal
    });
    // Steckdosenleiste + Kabel im Fußraum vor dem Spieler
    const f = LY.rowFloor(prow);
    B.add(rbox(0.3, 0.04, 0.06, 0.01), PM.matte, mat(ps.x + 0.4, f + 0.02, LY.rowFront(prow) + 0.12), { ...C(0xf0f0f0), keepUV: true });
    B.add(box(0.012, 0.012, 0.4), PM.matte, mat(ps.x + 0.53, f + 0.006, LY.rowFront(prow) + 0.32, 0, 0.2, 0), { ...C(0x1a1a1a), keepUV: true, cast: false });
    B.add(new THREE.IcosahedronGeometry(0.03, 1), PM.paper, mat(ps.x - 0.9, f + 0.028, LY.rowFront(prow) + 0.5), { ...C(0xf2f2ee), keepUV: true });
  }
  // ----------------------------------------------------- Studi-Handys (in der Hand) & bewegliche Kleinteile
  const handPhones = new Map();
  const phoneMat = gfx.pbr({ name: 'handPhone', color: 0x1b1c1f, roughness: 0.3 });
  const phoneScreen = new THREE.MeshBasicMaterial({ map: PM.screens.map, color: 0x9a9a9a });
  table.handPhone = (bone, seed) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(rbox(0.072, 0.15, 0.009, 0.008), phoneMat); g.add(b);
    const sg = atlasUV(new THREE.PlaneGeometry(0.064, 0.135), 3, scr.cols, scr.rows); const s = new THREE.Mesh(sg, phoneScreen); s.position.z = 0.0048; g.add(s);
    g.position.set(0, -0.06, 0.03); g.rotation.set(-1.2, 0, 0); bone.add(g); handPhones.set(seed, g); return g;
  };
  // Spätkommer:in-Laptop (erscheint beim Hinsetzen)
  let lateLaptop = null;
  if (plan.latecomer) {
    const s = plan.latecomer, B2 = new Batcher();
    laptopParts(onDesk(s.seat.row, s.seat.x, LY.rowFront(s.seat.row) + 0.22, 0.05), 'silver', 1.85, scr.index('notes'), [[0, 0.05, 0.02, 0.06, 0.2]], B2);
    const grp = new THREE.Group(); B2.build(grp, 'lateLaptop'); grp.visible = false; scene.add(grp); lateLaptop = grp;
  }
  // ----------------------------------------------------- echte Modelle (Poly Haven, CC0) im Raum
  if (RP) {
    const T2 = LY.TABLE, ty2 = LY.PODIUM.h + T2.h, P = (x, y, z, yaw = 0) => mat(x, y, z, 0, yaw, 0);
    // Vortragstisch: Mikroskop, Fachbücher, Krug, Lupe, Heftmaschine, Maßband, Gummiente
    real('vintage_microscope', P(T2.x + 1.05, ty2, T2.z - 0.18, 0.6));
    if (!opts.lite) real('book_encyclopedia_set_01', P(T2.x - 0.62, ty2, T2.z + 0.22, 0.1), { scale: 0.8 });   // mobil: 20 k bzw. 10 k Dreiecke, lassen sich nicht vereinfachen
    real('jug_01', P(T2.x + 0.92, ty2, T2.z - 0.28, 1.2), { scale: 0.9 });
    real('magnifying_glass_01', P(T2.x - 1.6, ty2, T2.z + 0.12, 2.2));
    real('vintage_stapler', P(T2.x - 0.18, ty2, T2.z + 0.27, -0.4));
    real('measuring_tape_01', P(T2.x + 1.35, ty2, T2.z + 0.2, 0.8));
    real('rubber_duck_toy', P(T2.x + 1.12, ty2, T2.z + 0.24, -2.6), { scale: 0.35 });
    // vor dem Tisch am Boden: Korb mit Heuproben, Futterkiste, Stuhl
    real('wicker_basket_01', P(T2.x - 2.15, LY.PODIUM.h, T2.z + 0.62, 0.3), { scale: 0.8 });
    real('wooden_crate_01', P(T2.x - 1.55, LY.PODIUM.h, T2.z + 0.68, -0.2), { scale: 0.75 });
    // Stuhl in der linken vorderen Ecke (stand vorher auf dem Weg Pult → Saal, der Prof lief hindurch)
    real('SchoolChair_01', P(LY.ROOM.x0 + 0.4, LY.PODIUM.h, LY.ROOM.z0 + 1.1, 1.35));
    // Gelenkleuchte am rechten Tischende, zum Tisch geneigt
    real('desk_lamp_arm_01', P(T2.x + 2.3, ty2, T2.z - 0.28, -2.2), { scale: 0.5 });
    // Pflanzen: vorne links neben der Tafel, hinten in der Ecke, auf der Fensterbank
    real('potted_plant_02', P(LY.ROOM.x0 + 0.45, LY.PODIUM.h, LY.ROOM.z0 + 0.5, 0.4));
    real('potted_plant_01', P(LY.ROOM.x1 - 0.5, LY.BACK_FLOOR, LY.ROOM.z1 - 0.55, 2.0), { scale: 0.95 });
    real('potted_plant_04', P(LY.ROOM.x0 + 0.24, LY.WINDOWS.y0 - 0.02, LY.WINDOWS.list[2] - 0.45, 1.0));
    real('ceramic_vase_01', P(LY.ROOM.x0 + 0.22, LY.WINDOWS.y0 - 0.02, LY.WINDOWS.list[1] + 0.6, 0.3), { scale: 0.6 });
    // hinten: Regale, Kartons, Kisten, Büste auf dem Bücherregal
    real('cardboard_box_01', P(LY.ROOM.x0 + 1.9, LY.BACK_FLOOR, LY.ROOM.z1 - 0.35, 0.2));
    real('cardboard_box_01', P(LY.ROOM.x0 + 1.95, LY.BACK_FLOOR + 0.3, LY.ROOM.z1 - 0.35, -0.3), { scale: 0.8 });
    if (!opts.lite) real('plastic_crate_01', P(LY.ROOM.x0 + 2.5, LY.BACK_FLOOR, LY.ROOM.z1 - 0.4, 0.1));
    real('wooden_bookshelf_worn', P(LY.ROOM.x1 - 0.3, LY.PODIUM.h, LY.ROOM.z0 + 2.0, -Math.PI / 2), { scale: 0.9 });
    real('marble_bust_01', P(LY.ROOM.x1 - 0.3, LY.PODIUM.h + 2.063 * 0.9, LY.ROOM.z0 + 2.0, -Math.PI / 2), { scale: 0.8 });
    // Tür vorne: Mülleimer, Besen, Kehrschaufel, Erste-Hilfe-Kasten an der Wand, Bilderrahmen
    real('plastic_broom', mat(LY.ROOM.x1 - 0.12, LY.PODIUM.h, LY.ROOM.z0 + 0.25, 0, 0.3, -0.18));
    real('dustpan', P(LY.ROOM.x1 - 0.3, LY.PODIUM.h, LY.ROOM.z0 + 0.45, 1.2));
    real('medical_box', P(LY.ROOM.x1 - 0.3, LY.PODIUM.h + 2.063 * 0.9, LY.ROOM.z0 + 2.45, -Math.PI / 2), { scale: 0.6 });
    real('hanging_picture_frame_02', mat(LY.ROOM.x1 - 0.03, 1.9, -0.8, 0, -Math.PI / 2, 0), { scale: 1.2, cast: false });
    // Vortragstisch: Ringbuch, Notizblöcke, Ersatzbrille, Holzschale mit Futterprobe, Wecker, Bunsenbrenner, Ersatzlampe
    real('binder_notebook', P(T2.x + 1.78, ty2, T2.z + 0.22, 0.25), { node: 'closed' });
    real('office_notepads', P(T2.x - 0.48, ty2, T2.z - 0.3, -0.2), { node: 'yellow_pad' });
    real('office_notepads', P(T2.x + 0.02, ty2, T2.z + 0.3, 0.4), { node: 'sticky_stack' });
    real('round_spectacles', P(T2.x + 0.62, ty2, T2.z + 0.3, 2.6));
    real('wooden_bowl_01', P(T2.x - 2.3, ty2, T2.z - 0.22, 0.4), { scale: 0.85 });
    real('alarm_clock_01', P(T2.x + 1.55, ty2, T2.z + 0.06, Math.PI + 0.3));
    real('bunsen_burner', P(T2.x - 0.62, ty2, T2.z - 0.3, 0.7));
    real('lightbulb_led', mat(T2.x + 2.05, ty2 + 0.03, T2.z + 0.25, 0, 0.8, Math.PI / 2));
    // Fensterbänke (BOKU): Anzuchtschalen, Tontopf, Gießkanne, Fernglas, Vase
    const sill = (k, dz) => [LY.ROOM.x0 + 0.22, LY.WINDOWS.y0 - 0.02, LY.WINDOWS.list[k] + dz];
    { const [x, y, z] = sill(0, -0.65); real('seeding_tray_01', P(x, y, z, 0.1)); }
    { const [x, y, z] = sill(0, -0.4); real('seeding_tray_01', P(x, y, z, 1.7)); }
    { const [x, y, z] = sill(0, -0.12); real('planter_pot_clay', P(x, y, z, 0.6), { scale: 0.75 }); }
    { const [x, y, z] = sill(0, 0.18); real('watering_can_metal_01', P(x, y, z, 0.2)); }
    { const [x, y, z] = sill(1, 0.1); real('binoculars', P(x, y, z, 2.3)); }
    { const [x, y, z] = sill(2, -0.05); real('ceramic_vase_03', P(x, y, z, 0.4), { scale: 0.8 }); }
    // Saalausstattung: Brandschutz, Haustechnik, Hausapparat
    real('korean_fire_extinguisher_01', P(LY.ROOM.x1 - 0.2, 0, LY.FRONT_PASSAGE.z0 + 0.42, -Math.PI / 2), { scale: 0.95 });
    real('vintage_telephone_wall_clock', mat(LY.ROOM.x1 - 0.02, 1.45, LY.FRONT_PASSAGE.z0 + 0.5, 0, -Math.PI / 2, 0), { scale: 0.8, cast: false });
    real('fire_alarm', mat(LY.ROOM.x1 - 0.02, LY.PODIUM.h + 1.45, LY.FRONT_DOOR.z + 0.75, 0, -Math.PI / 2, 0), { cast: false });
    real('fire_alarm', mat(LY.BACK_DOOR.x - 0.85, LY.BACK_FLOOR + 1.45, LY.ROOM.z1 - 0.02, 0, Math.PI, 0), { cast: false });
    real('power_box_01', mat(0.95, LY.BACK_FLOOR + 1.25, LY.ROOM.z1 - 0.02, 0, Math.PI, 0), { scale: 0.85 });
    real('utility_box_01', P(LY.ROOM.x0 + 0.4, LY.BACK_FLOOR, LY.ROOM.z1 - 0.24, Math.PI));
    if (opts.weather === 'rain') real('WetFloorSign_01', P(LY.BACK_DOOR.x - 0.45, LY.BACK_FLOOR, LY.ROOM.z1 - 0.55, 2.6));
    // Rückwand: Schubladenschrank mit Fernseher und Büchern, Wandregal mit Kisten, Hocker
    real('drawer_cabinet', P(1.55, LY.BACK_FLOOR, LY.ROOM.z1 - 0.25, Math.PI));
    real('television_02', P(1.55, LY.BACK_FLOOR + 1.12, LY.ROOM.z1 - 0.3, Math.PI + 0.15), { scale: 0.8 });
    if (!opts.lite) real('book_encyclopedia_set_01', P(1.55, LY.BACK_FLOOR + 1.46, LY.ROOM.z1 - 0.27, Math.PI), { scale: 0.7 });
    real('Shelf_01', P(2.72, LY.BACK_FLOOR, LY.ROOM.z1 - 0.14, Math.PI));
    real('plastic_crate_02', P(2.72, LY.BACK_FLOOR + 0.14, LY.ROOM.z1 - 0.16, Math.PI), { scale: 0.5 });
    real('wicker_basket_02', P(2.72, LY.BACK_FLOOR + 0.66, LY.ROOM.z1 - 0.15, Math.PI + 0.2), { scale: 0.7 });
    real('binder_notebook', P(2.72, LY.BACK_FLOOR + 1.22, LY.ROOM.z1 - 0.14, Math.PI / 2), { node: 'closed', scale: 1 });
    real('metal_stool_02', P(0.4, LY.BACK_FLOOR, LY.ROOM.z1 - 0.5, 0.5));
    real('wooden_crate_02', P(-3.05, LY.BACK_FLOOR, LY.ROOM.z1 - 0.32, Math.PI / 2), { scale: 0.85 });
    // vorne links (Fensterseite): Beistelltisch mit Pflanze, Gästestuhl; Mausefalle in der Ecke; Reiniger beim Besen
    real('side_table_01', P(LY.ROOM.x0 + 0.42, LY.PODIUM.h, LY.PODIUM.z1 - 0.32, 0.1));
    real('anthurium_botany_01', P(LY.ROOM.x0 + 0.42, LY.PODIUM.h + 0.555, LY.PODIUM.z1 - 0.32, 0.6), { node: 'anthurium_botany_01_c', scale: 0.8 });
    real('plastic_monobloc_chair_01', P(LY.ROOM.x0 + 1.05, LY.PODIUM.h, LY.PODIUM.z1 - 0.35, 0.35));
    real('mousetrap', P(LY.ROOM.x0 + 0.16, LY.PODIUM.h, LY.ROOM.z0 + 0.15, 0.6));
    real('all_purpose_cleaner', P(LY.ROOM.x1 - 0.22, LY.PODIUM.h, LY.ROOM.z0 + 0.7, 0.4));
    // Bilder an der Vertäfelung (rechts)
    real('hanging_picture_frame_01', mat(LY.ROOM.x1 - 0.02, LY.floorAt(4.0, 1.4) + 1.75, 1.4, 0, -Math.PI / 2, 0), { scale: 0.9, cast: false });
    real('hanging_picture_frame_03', mat(LY.ROOM.x1 - 0.02, LY.floorAt(4.0, 3.3) + 1.8, 3.3, 0, -Math.PI / 2, 0), { cast: false });
    real('fancy_picture_frame_01', mat(LY.ROOM.x1 - 0.02, 2.15, -2.3, 0, -Math.PI / 2, 0), { cast: false });
  }
  const meshes = B.build(scene, 'props');
  // Studi-Bildschirme: dezentes Flimmern der Emission (Videos, Scrollen)
  return {
    PM, meshes, player, table, lateLaptop, count: PROP_LIST.length,
    update(dt, t) { PM.screens.color.setScalar(0.55 + Math.sin(t * 0.7) * 0.015); },
    listTo(where) { // where: Vector3 (+ yaw) oder 'table'
      const g = table.list;
      if (where === 'table') { g.position.set(T.x - 1.0, ty, T.z + 0.2); g.rotation.set(0, 0, 0); g.visible = true; return; }
      if (!where) { g.visible = false; return; }
      g.visible = true; g.position.copy(where.pos); g.rotation.set(DESK_TILT, where.yaw || 0, 0, 'YXZ');
    },
    deskSpot(row, x, dz = 0) { const z = LY.rowFront(row) + 0.21 + dz; return V(x, deskSurfaceY(row, z) + 0.002, z); }
  };
}

const _ax = new THREE.Vector3(), _tip = new THREE.Vector3(), _goal = new THREE.Vector3();
/** Mitschrift des Spielers: Zeilen werden Strich für Strich mit Kuli geschrieben */
export class InkPage {
  constructor(cv, tex, group, pen) {
    this.cv = cv; this.c = cv.getContext('2d'); this.tex = tex; this.group = group; this.pen = pen;
    this.queue = []; this.job = null; this.y = 0; this.page = 0; this.lines = 0;
    this.rng = makeRng(808); this.g = cv.width / 34; this.y = this.g * 2.4; this.penPx = [cv.width * 0.6, cv.height * 0.6];
    this.dirty = false; this.uploadT = 0;
  }
  /** sofort geschriebene Zeilen (z. B. Datum/Überschrift, schon vor der Vorlesung notiert) */
  writeInstant(lines, ink = '#1f3d8a') {
    const c = this.c, g = this.g; c.strokeStyle = ink; c.lineWidth = Math.max(1.6, g * 0.09); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const line of lines) {
      const lay = layoutText(line, { size: g * 0.8, x: g * 1.2, y: this.y, font: 'script', rng: this.rng.next, jitter: 0.07, slant: 0.14 });
      for (const st of lay.strokes) { c.beginPath(); st.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
      this.y += g * 1.9;
    }
    // Unterstreichung der Überschrift
    c.beginPath(); c.moveTo(g * 1.1, this.y - g * 1.2); c.lineTo(g * 12, this.y - g * 1.25); c.stroke();
    this.tex.needsUpdate = true;
  }
  /** neue Zeile(n) einreihen */
  add(lines) { for (const l of lines) this.queue.push(l); }
  _next() {
    const line = this.queue.shift(); if (!line) return null;
    const g = this.g;
    if (this.y > this.cv.height - g * 1.5) { drawPage(this.c, this.cv.width, this.cv.height, null, 1); this.y = g * 2.4; this.page++; } // umblättern
    const lay = layoutText(line, { size: g * 0.8, x: g * 1.2, y: this.y, font: 'script', rng: this.rng.next, jitter: 0.07, slant: 0.14 });
    this.y += g * 1.9;
    this.lines++;
    return { strokes: lay.strokes, si: 0, pi: 1 };
  }
  /** schreibt mit speed px/s, solange active; gibt true zurück, wenn gerade geschrieben wird */
  update(dt, active, speed = 260) {
    let writing = false;
    if (active) {
      if (!this.job) this.job = this._next();
      let budget = speed * dt;
      const c = this.c; c.strokeStyle = '#1f3d8a'; c.lineWidth = Math.max(1.6, this.g * 0.09); c.lineCap = 'round'; c.lineJoin = 'round';
      while (this.job && budget > 0) {
        const j = this.job, s = j.strokes[j.si];
        if (!s) { this.job = this._next(); continue; }
        if (j.pi >= s.length) { j.si++; j.pi = 1; budget -= 6; continue; }
        const a = s[j.pi - 1], b = s[j.pi];
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        budget -= Math.hypot(b[0] - a[0], b[1] - a[1]); j.pi++;
        this.penPx = b; writing = true; this.dirty = true;
      }
    }
    // Stift folgt der Schreibposition (Seitenkoordinaten → lokal am Block); Spitze = lokales −x des Stifts
    const px = this.penPx, u = px[0] / this.cv.width - 0.5, v = px[1] / this.cv.height - 0.5;
    const e = this.pen.rotation; e.set(0, active ? -0.5 : 0.5, active ? 0.9 : 0);
    const axis = _ax.set(1, 0, 0).applyEuler(e);
    const tip = active ? _tip.set(u * 0.292, 0.0074 + (writing ? 0 : 0.005), v * 0.206) : _tip.set(0.04, 0.0119, 0.08);
    const goal = _goal.copy(tip).addScaledVector(axis, active ? 0.07 : 0.07);
    const k = 1 - Math.exp(-dt * (active ? 16 : 4));
    this.pen.position.lerp(goal, k);
    this.uploadT -= dt;
    if (this.dirty && this.uploadT <= 0) { this.tex.needsUpdate = true; this.dirty = false; this.uploadT = 1 / 15; }
    return writing;
  }
  /** Weltposition der Stiftspitze (für Hand-IK des Spielers) */
  tipWorld(out = V()) { this.pen.updateWorldMatrix(true, false); return out.set(-0.07, 0, 0).applyMatrix4(this.pen.matrixWorld); }
  topWorld(out = V()) { this.pen.updateWorldMatrix(true, false); return out.set(0.07, 0, 0).applyMatrix4(this.pen.matrixWorld); }
}

// ------------------------------------------------------------------ Details: Kontaktschatten, Kaffeeränder, Stufenlicht, Türglas mit Gang
/** Weiche, gebackene Kontaktschatten (AO-Streifen) unter Pulten und Bänken – wirkt in allen Qualitätsstufen */
export function buildDetails(gfx, hall, plan) {
  const scene = gfx.scene, B = new Batcher();
  // Verlaufstextur (dunkel → transparent)
  const ao = document.createElement('canvas'); ao.width = 16; ao.height = 128;
  const ac = ao.getContext('2d'); const g = ac.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.35, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ac.fillStyle = g; ac.fillRect(0, 0, 16, 128);
  const aoTex = new THREE.CanvasTexture(ao);
  // Shader: schwarze Fläche, Deckkraft aus dem Verlauf (abdunkelnd, ohne Beleuchtung)
  const aoShader = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { map: { value: aoTex }, strength: { value: 0.8 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float strength; varying vec2 vUv; void main(){ float a = texture2D(map, vUv).a * strength; gl_FragColor = vec4(0.0,0.0,0.0,a); }'
  });
  const W = LY.BLOCK.x1 - LY.BLOCK.x0, cx = (LY.BLOCK.x0 + LY.BLOCK.x1) / 2;
  const strip = (w, d, x, y, z, flip) => { const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); if (flip) p.rotateY(Math.PI); p.translate(x, y, z); return p; };
  const geos = [];
  for (let i = 0; i < LY.ROWS; i++) {
    const f = LY.rowFloor(i) + 0.003, z0 = LY.rowFront(i);
    geos.push(strip(W, 0.34, cx, f, z0 + 0.17, false));                         // unter der Pultfront (Fußraum)
    geos.push(strip(W, 0.3, cx, f, z0 + LY.ROW_DEPTH - 0.15, true));            // unter der Sitzbank
  }
  const merged = mergeAll(geos);
  const aoMesh = new THREE.Mesh(merged, aoShader); aoMesh.renderOrder = 1; scene.add(aoMesh);
  // Kaffeeränder auf einzelnen Pulten (dezente Decals)
  const ring = document.createElement('canvas'); ring.width = ring.height = 128;
  const rc = ring.getContext('2d'); rc.strokeStyle = 'rgba(70,40,15,0.5)'; rc.lineWidth = 5; rc.beginPath(); rc.arc(64, 64, 44, 0.3, Math.PI * 1.85); rc.stroke();
  rc.lineWidth = 2; rc.strokeStyle = 'rgba(70,40,15,0.3)'; rc.beginPath(); rc.arc(66, 63, 40, 0, Math.PI * 2); rc.stroke();
  const ringMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ring), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rng = makeRng(77);
  const ringGeos = [];
  for (const s of LY.allSeats()) if (rng.chance(0.07)) {
    const zc = LY.rowFront(s.row) + 0.21 + rng.range(-0.06, 0.06), x = s.x + rng.range(-0.22, 0.22);
    const p = new THREE.PlaneGeometry(0.09, 0.09); p.rotateX(-Math.PI / 2); p.rotateY(rng.range(0, 6)); p.applyMatrix4(onDesk(s.row, x, zc, 0, 0.0015)); ringGeos.push(p);
  }
  if (ringGeos.length) scene.add(new THREE.Mesh(mergeAll(ringGeos), ringMat));
  // LED-Stufenlicht im Seitengang (rechts, wo der Handlauf ist) und links an den Stufenkanten
  const led = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2dd, emissiveIntensity: 1.4 }); gfx.register(led);
  for (const a of LY.AISLES) for (let i = 1; i < LY.ROWS + 1; i++) {
    const f = LY.rowFloor(Math.min(i, LY.ROWS)), z = (i < LY.ROWS ? LY.rowFront(i) : LY.BACK_Z) + 0.03, ax = (a.x0 + a.x1) / 2;
    B.add(box(0.12, 0.012, 0.012), led, mat(ax, f - 0.035, z - 0.01), { cast: false, receive: false, keepUV: true });
  }
  // Thermostat an der Rückwand, Hörsaalschild mit Belegungsplan neben der Hintertür
  const plastic = hall.M.whitePlastic;
  B.add(rbox(0.09, 0.12, 0.025, 0.01), plastic, mat(LY.BACK_DOOR.x - 1.0, LY.BACK_FLOOR + 1.45, LY.ROOM.z1 - 0.02), { cast: false });
  B.add(box(0.05, 0.025, 0.004), hall.M.screenBlack, mat(LY.BACK_DOOR.x - 1.0, LY.BACK_FLOOR + 1.47, LY.ROOM.z1 - 0.034), { cast: false });
  // Kaugummi unter dem eigenen Pult (Realismus durch Imperfektion)
  const ps = LY.allSeats().find(x => x.row === plan.player.row && x.k === plan.player.k);
  const gum = gfx.pbr({ name: 'gum', color: 0xe58fb0, roughness: 0.5 });
  B.add(new THREE.SphereGeometry(0.012, 8, 6), gum, mat(ps.x + 0.18, LY.rowFloor(ps.row) + LY.DESK_H - 0.155, LY.rowFront(ps.row) + 0.14, 0, 0, 0, 1, 0.4, 1), { cast: false, keepUV: true });
  B.build(scene, 'details');
  // Glasausschnitt in der Hintertür + beleuchteter Gang mit vorbeigehenden Silhouetten
  const door = hall.backDoor; door.updateMatrixWorld(true);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.55), new THREE.MeshPhysicalMaterial({ color: 0xe6edf0, roughness: 0.55, transmission: 0, transparent: true, opacity: 0.55, depthWrite: false }));
  glass.position.set(0.12, 1.55, 0.068); door.add(glass);
  gfx.register(glass.material);
  const corrCv = document.createElement('canvas'); corrCv.width = 128; corrCv.height = 256;
  const corrTex = new THREE.CanvasTexture(corrCv); corrTex.colorSpace = THREE.SRGBColorSpace;
  const corr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.58), new THREE.MeshBasicMaterial({ map: corrTex }));
  corr.position.set(0.12, 1.55, 0.03); door.add(corr);
  const walkers = [];
  const drawCorr = () => {
    const c = corrCv.getContext('2d'); const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#f3efe4'); gr.addColorStop(1, '#d9d2c2'); c.fillStyle = gr; c.fillRect(0, 0, 128, 256);
    for (const w of walkers) { c.fillStyle = `rgba(60,55,50,${w.a})`; const x = w.x * 128; c.beginPath(); c.ellipse(x, 70, 14, 17, 0, 0, 7); c.fill(); c.beginPath(); c.roundRect(x - 26, 88, 52, 170, 14); c.fill(); }
    corrTex.needsUpdate = true;
  };
  drawCorr();
  let wt = 4;
  return {
    update(dt) {
      wt -= dt;
      if (wt <= 0) { wt = 6 + Math.random() * 18; const fromLeft = Math.random() < 0.5; walkers.push({ x: fromLeft ? -0.3 : 1.3, v: (fromLeft ? 1 : -1) * (0.35 + Math.random() * 0.2), a: 0.45 + Math.random() * 0.25 }); }
      if (!walkers.length) return;
      for (const w of walkers) w.x += w.v * dt;
      for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].x < -0.5 || walkers[i].x > 1.5) walkers.splice(i, 1);
      drawCorr();
    }
  };
}
function mergeAll(geos) {
  let n = 0, ni = 0; for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni); let o = 0, io = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); uv.set(g.attributes.uv.array, o * 2); for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + o; o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}
