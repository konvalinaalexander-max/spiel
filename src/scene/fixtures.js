// Dynamische Einbauten: Schiebetafeln, Leinwand + Beamer, Wanduhr, Plakate (Atlas), Pinnwand, Fluchtweg-Schilder.
import * as THREE from 'three';
import * as LY from './layout.js';
import { ChalkPanel } from './chalkboard.js';
import { SlideRenderer, drawBokuLogo } from './slides.js';
import { rbox } from '../gfx/geom.js';
import { damp, clamp } from '../core/util.js';

const { ROOM } = LY;

export function buildFixtures(gfx, hall, opts = {}) {
  const scene = gfx.scene, q = gfx.preset;
  const out = {};
  // ------------------------------------------------------------------ Schiebetafeln
  const BD = LY.BOARD;
  const base = gfx.tex.make('chalkboardBase', { c1: '#2b3a31', size: 1024 });
  const px = q.texSize >= 2048 ? 2048 : q.texSize >= 1024 ? 1536 : 1024;
  const ghosts = [
    [{ text: 'ΔG = ΔH − T·ΔS', x: 0.3, y: 0.35, size: 0.1 }, { text: 'k = A·e^{−Ea/RT}', x: 2.3, y: 0.75, size: 0.09 }, { text: 'Bodenart: sL', x: 0.6, y: 0.95, size: 0.08, alpha: 0.05 }],
    [{ text: 'pH = pK_{s} + log([A]/[HA])', x: 0.4, y: 0.4, size: 0.09 }, { text: 'NPK 15-15-15', x: 2.6, y: 0.9, size: 0.09, alpha: 0.05 }]
  ];
  out.panels = [];
  for (let k = 0; k < 2; k++) {
    const cp = new ChalkPanel(gfx, { width: BD.w, height: BD.panelH, px, seed: 40 + k, ghost: ghosts[k], color: '#2a4a3a' });
    const m = gfx.pbr({ name: 'chalkboard' + k, roughness: 1 });
    m.map = cp.tex; m.normalMap = base.normalMap; m.roughnessMap = base.ormMap; m.normalScale = new THREE.Vector2(0.6, 0.6);
    const g = new THREE.Group();
    const surf = new THREE.Mesh(new THREE.PlaneGeometry(BD.w, BD.panelH), m); surf.receiveShadow = true;
    g.add(surf);
    const frame = new THREE.Mesh(rbox(BD.w + 0.06, BD.panelH + 0.06, 0.03, 0.008), hall.M.alu); frame.position.z = -0.018; frame.castShadow = true; frame.receiveShadow = true;
    g.add(frame);
    const y = k === 0 ? BD.lowY + BD.panelH / 2 : BD.highY + BD.panelH / 2;
    g.position.set(BD.x, y, k === 0 ? BD.zFront : BD.zBack);
    scene.add(g);
    out.panels.push({ chalk: cp, group: g, surf, y, targetY: y, slot: k === 0 ? 'low' : 'high', index: k });
  }
  /** Tafel schieben: der untere Flügel geht hoch, der obere herunter (Gegengewicht) */
  out.slideBoards = () => {
    for (const p of out.panels) { p.slot = p.slot === 'low' ? 'high' : 'low'; p.targetY = (p.slot === 'low' ? BD.lowY : BD.highY) + BD.panelH / 2; }
  };
  out.lowPanel = () => out.panels.find(p => p.slot === 'low');
  out.highPanel = () => out.panels.find(p => p.slot === 'high');
  /** Weltposition der Kreide (für Hand-IK) */
  out.penWorld = (panel, pen, target = new THREE.Vector3()) => {
    panel.chalk.pxToLocal(pen, target); target.z = 0.015; return panel.group.localToWorld(target);
  };

  // ------------------------------------------------------------------ Leinwand + Beamer
  const SC = LY.SCREEN;
  // Folien in 3840 × 2160 (Desktop): auch mit „genau hinschauen“ und bei Gerätepixelverhältnis 2 wird die Textur nur
  // verkleinert, nie vergrößert – Schrift ist das Wichtigste am Bild. Mobil (opts.slidePx) kleiner.
  const slideW = opts.slidePx || 3840;
  const sr = new SlideRenderer(slideW, Math.round(slideW * 9 / 16));
  const slideTex = new THREE.CanvasTexture(sr.canvas); slideTex.colorSpace = THREE.SRGBColorSpace; slideTex.anisotropy = gfx.renderer.capabilities.getMaxAnisotropy();
  const weave = gfx.tex.make('screenWeave', { size: 512 });
  // Folie leicht geschärft abtasten (Mip-Bias −0,7): aus 6–9 m Entfernung wird die Textur 4–6-fach verkleinert,
  // trilineare Filterung allein lässt die Schrift verschwimmen
  const sharpSlide = s => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#ifdef USE_EMISSIVEMAP\n\ttotalEmissiveRadiance *= texture2D( emissiveMap, vEmissiveMapUv, -0.7 ).rgb;\n#endif'); };
  const screenMat = gfx.pbr({ name: 'screen', color: 0xd8d8d6, roughness: 1, patches: [sharpSlide], patchKey: 'screenSharp' });
  const screenCol = screenMat.color.clone();
  screenMat.roughnessMap = weave.ormMap; screenMat.normalMap = weave.normalMap; screenMat.normalScale = new THREE.Vector2(0.3, 0.3);
  screenMat.emissive = new THREE.Color(0xffffff); screenMat.emissiveMap = slideTex; screenMat.emissiveIntensity = 0.0;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SC.w, SC.h), screenMat);
  screen.position.set(SC.x, SC.y, SC.z); screen.receiveShadow = true;
  scene.add(screen);
  out.screen = screen; out.slides = sr; out.slideTex = slideTex;
  // Beamer-Spot mit Projektionstextur – ab "hoch" mit Schatten (Prof wirft Schatten auf die Leinwand)
  const sq = document.createElement('canvas'); sq.width = sq.height = q.texSize >= 2048 ? 2048 : 1024;
  const sqTex = new THREE.CanvasTexture(sq); sqTex.colorSpace = THREE.SRGBColorSpace; sqTex.anisotropy = slideTex.anisotropy;
  const PJ = LY.PROJECTOR;
  const useSpot = q.spotShadow;
  let toMap = null;
  if (useSpot) {
    const spot = new THREE.SpotLight(0xffffff, 0, 30, 0.5, 0.02, 1.6);
    spot.position.set(PJ.x, PJ.y - 0.02, PJ.z - 0.22);
    spot.target.position.set(SC.x, SC.y, SC.z);
    // Öffnungswinkel: alle vier Leinwandecken liegen knapp innerhalb des (runden) Kegels
    const axis = spot.target.position.clone().sub(spot.position).normalize();
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => new THREE.Vector3(SC.x + sx * SC.w / 2, SC.y + sy * SC.h / 2, SC.z));
    spot.angle = Math.max(...corners.map(c => c.clone().sub(spot.position).angleTo(axis))) * 1.04;
    spot.map = sqTex; spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004; spot.shadow.camera.near = 1; spot.shadow.camera.far = 12;
    scene.add(spot, spot.target);
    out.spot = spot;
    // Projektionskamera wie in SpotLightShadow (fov = 2·angle, quadratisch): Leinwandpunkt → Pixel in der Spot-Textur
    const pcam = new THREE.PerspectiveCamera(THREE.MathUtils.RAD2DEG * 2 * spot.angle, 1, 0.5, 30);
    pcam.position.copy(spot.position); pcam.lookAt(spot.target.position); pcam.updateMatrixWorld(); pcam.updateProjectionMatrix();
    const pt = new THREE.Vector3();
    toMap = (u, v) => { pt.set(SC.x + (u - 0.5) * SC.w, SC.y + (0.5 - v) * SC.h, SC.z).project(pcam); return [(pt.x * 0.5 + 0.5) * sq.width, (0.5 - pt.y * 0.5) * sq.height]; };
  }
  // Leinwand strahlt leicht in den Raum zurück (Podest, Prof, vordere Reihen)
  const spill = new THREE.PointLight(0xdfe6ee, 0, 5.5, 2); spill.position.set(SC.x, SC.y - 0.2, SC.z + 0.9); scene.add(spill); out.screenSpill = spill;
  out.beamer = { on: false, level: 0, target: 0 };
  out.updateSlideTextures = () => {
    slideTex.needsUpdate = true;
    if (useSpot) {
      // Folie perspektivisch korrekt in die Spot-Textur zeichnen (Gitter aus affinen Dreiecken), damit das
      // projizierte Bild deckungsgleich mit dem Leinwandbild liegt – sonst entsteht ein heller Doppelschleier
      const c = sq.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, sq.width, sq.height);
      const img = sr.canvas, W = img.width, H = img.height, n = 6;
      const G = []; for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) G.push({ s: [i / n * W, j / n * H], d: toMap(i / n, j / n) });
      const at = (i, j) => G[j * (n + 1) + i];
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        warpTri(c, img, at(i, j), at(i + 1, j), at(i + 1, j + 1));
        warpTri(c, img, at(i, j), at(i + 1, j + 1), at(i, j + 1));
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      sqTex.needsUpdate = true;
    }
  };
  out.setBeamer = on => { out.beamer.target = on ? 1 : 0; };
  out.updateBeamer = dt => {
    const b = out.beamer; b.level = damp(b.level, b.target, 3, dt);
    // Läuft der Beamer, kommt das Bild vom Projektor: die Leinwand reagiert dann kaum noch auf das Raumlicht,
    // sonst legt die Deckenbeleuchtung einen Grauschleier über die Schrift (unten stärker als oben)
    screenMat.color.copy(screenCol).multiplyScalar(1 - b.level * (useSpot ? 0.7 : 0.78));
    screenMat.emissiveIntensity = b.level * (useSpot ? 0.55 : 0.9);
    if (out.spot) out.spot.intensity = b.level * 30;
    spill.intensity = b.level * 0.9;
  };

  // ------------------------------------------------------------------ Wanduhr (läuft mit Spielzeit)
  const CK = LY.CLOCK;
  const clockCv = document.createElement('canvas'); clockCv.width = clockCv.height = 256;
  const clockTex = new THREE.CanvasTexture(clockCv); clockTex.colorSpace = THREE.SRGBColorSpace;
  const clockMat = gfx.pbr({ name: 'clock', roughness: 0.35 }); clockMat.map = clockTex;
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.17, 48), clockMat); clock.position.set(CK.x, CK.y, CK.z + 0.03);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.015, 10, 48), hall.M.alu); rim.position.copy(clock.position);
  clock.castShadow = rim.castShadow = true;
  scene.add(clock, rim);
  let lastMin = -1;
  out.setClock = minutes => {
    const m = Math.floor(minutes); if (m === lastMin) return; lastMin = m;
    const c = clockCv.getContext('2d');
    c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, 256, 256);
    c.translate(128, 128);
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; c.strokeStyle = '#222'; c.lineWidth = i % 5 ? 2 : 6; const r0 = i % 5 ? 112 : 98; c.beginPath(); c.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); c.lineTo(Math.sin(a) * 118, -Math.cos(a) * 118); c.stroke(); }
    const hand = (a, len, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt'; c.beginPath(); c.moveTo(-Math.sin(a) * len * 0.18, Math.cos(a) * len * 0.18); c.lineTo(Math.sin(a) * len, -Math.cos(a) * len); c.stroke(); };
    hand(((m / 60) % 12) / 12 * Math.PI * 2, 66, 10, '#111');
    hand((m % 60) / 60 * Math.PI * 2, 100, 7, '#111');
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(0, 0, 6, 0, 7); c.fill();
    c.setTransform(1, 0, 0, 1, 0, 0);
    clockTex.needsUpdate = true;
  };

  // ------------------------------------------------------------------ Plakate & Pinnwand (ein Atlas)
  const posters = opts.posters || [];
  const cols = 4, rows = 3, cw = 448, ch = 634;
  const atlas = document.createElement('canvas'); atlas.width = cols * cw; atlas.height = rows * ch;
  const ac = atlas.getContext('2d');
  posters.forEach((p, i) => { ac.save(); ac.translate((i % cols) * cw, Math.floor(i / cols) * ch); p.draw(ac, cw, ch); ac.restore(); });
  const atlasTex = new THREE.CanvasTexture(atlas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 8;
  const posterMat = gfx.pbr({ name: 'posters', recipe: 'paper', texOpts: { c1: '#ffffff', size: 256 }, noMap: true, roughness: 1 });
  posterMat.map = atlasTex;
  const pg = [];
  posters.forEach((p, i) => {
    const g = new THREE.PlaneGeometry(p.w, p.w * ch / cw);
    const u0 = (i % cols) / cols, v0 = 1 - (Math.floor(i / cols) + 1) / rows;
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / cols, v0 + uv.getY(k) / rows);
    g.rotateZ(p.tilt || 0); g.rotateY(p.rotY); g.translate(p.x, p.y, p.z);
    pg.push(g);
  });
  if (pg.length) {
    const merged = mergeGeos(pg);
    const pm = new THREE.Mesh(merged, posterMat); pm.receiveShadow = true; scene.add(pm);
  }
  // Fluchtweg-Leuchten
  const exCv = document.createElement('canvas'); exCv.width = 512; exCv.height = 256;
  drawExitSign(exCv.getContext('2d'), 512, 256);
  const exTex = new THREE.CanvasTexture(exCv); exTex.colorSpace = THREE.SRGBColorSpace;
  const exMat = new THREE.MeshStandardMaterial({ map: exTex, emissive: 0xffffff, emissiveMap: exTex, emissiveIntensity: 0.9, roughness: 0.5 }); gfx.register(exMat);
  for (const [x, y, z, ry] of hall.exitSigns) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), exMat); s.position.set(x, y, z); s.rotation.y = ry;
    const bx = new THREE.Mesh(rbox(0.44, 0.24, 0.05, 0.01), hall.M.whitePlastic); bx.position.copy(s.position); bx.rotation.y = ry; bx.translateZ(-0.026);
    scene.add(s, bx);
  }
  return out;
}

function drawExitSign(c, w, h) {
  c.fillStyle = '#12924a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#ffffff';
  // Tür (rechts)
  c.fillRect(w * 0.66, h * 0.16, w * 0.24, h * 0.68); c.fillStyle = '#12924a'; c.fillRect(w * 0.7, h * 0.22, w * 0.16, h * 0.62);
  c.fillStyle = '#ffffff';
  // laufende Person (stilisiert)
  c.beginPath(); c.arc(w * 0.47, h * 0.24, h * 0.07, 0, 7); c.fill();
  c.lineCap = 'round'; c.strokeStyle = '#fff'; c.lineWidth = h * 0.075;
  const L = (a, b, cc, d) => { c.beginPath(); c.moveTo(w * a, h * b); c.lineTo(w * cc, h * d); c.stroke(); };
  L(0.45, 0.36, 0.41, 0.58); L(0.41, 0.58, 0.48, 0.7); L(0.48, 0.7, 0.46, 0.84); L(0.41, 0.58, 0.34, 0.68); L(0.34, 0.68, 0.27, 0.66);
  L(0.45, 0.38, 0.53, 0.48); L(0.53, 0.48, 0.58, 0.42); L(0.45, 0.38, 0.37, 0.44); L(0.37, 0.44, 0.33, 0.52);
  // Pfeil
  c.lineWidth = h * 0.06; L(0.06, 0.5, 0.22, 0.5); c.beginPath(); c.moveTo(w * 0.17, h * 0.38); c.lineTo(w * 0.24, h * 0.5); c.lineTo(w * 0.17, h * 0.62); c.stroke();
}
function mergeGeos(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); for (const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(idx);
  return out;
}

// ------------------------------------------------------------------ Plakate (nach realen Aushang-Typen, docs/recherche/boku.md Kap. 8.5)
export function makePosters() {
  const FONT = 'Arial, Helvetica, sans-serif';
  const W = (c, text, x, y, maxW, lh) => { const words = text.split(' '); let line = ''; for (const w of words) { const t2 = line ? line + ' ' + w : w; if (c.measureText(t2).width > maxW && line) { c.fillText(line, x, y); line = w; y += lh; } else line = t2; } if (line) c.fillText(line, x, y); return y + lh; };
  const list = [];
  const P = (draw, place) => list.push({ draw, ...place });
  const RX = ROOM.x1 - 0.025, LX = ROOM.x0 + 0.025, rotR = -Math.PI / 2, rotL = Math.PI / 2;
  const fy = z => LY.floorAt(0, z);
  // 1 Exkursion zur VO (Liste geht in der VO herum)
  P((c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); drawBokuLogo(c, 26, 26, 44);
    c.fillStyle = '#929191'; c.font = `14px ${FONT}`; c.fillText('Institut für Tierernährung, Tierische', 138, 44); c.fillText('Lebensmittel und Ernährungsphysiologie', 138, 62);
    c.fillStyle = '#00aa5a'; c.fillRect(0, 100, w, 170);
    c.fillStyle = '#fff'; c.font = `bold 38px ${FONT}`; c.fillText('Exkursion', 26, 152); c.font = `bold 26px ${FONT}`; c.fillText('zur VO Tierernährung', 26, 192); c.font = `22px ${FONT}`; c.fillText('Versuchswirtschaft Groß-Enzersdorf', 26, 236);
    c.fillStyle = '#474747'; c.font = `bold 22px ${FONT}`; c.fillText('Freitag, 8:00 Uhr', 26, 320); c.font = `20px ${FONT}`; c.fillText('Abfahrt: Dänenstraße', 26, 350);
    let y = W(c, 'Max. 40 Plätze – die Anmeldeliste geht in der Vorlesung herum. Festes Schuhwerk!', 26, 396, w - 52, 28);
    c.fillStyle = '#efefef'; c.fillRect(26, y + 6, w - 52, 2);
    c.fillStyle = '#929191'; c.font = `16px ${FONT}`; c.fillText('Teilnahme verpflichtend für volle Anwesenheit', 26, h - 30);
  }, { x: RX, y: fy(-2.4) + 2.25, z: -2.4, w: 0.46, rotY: rotR, tilt: 0.004 });
  // 2 ÖH-Beitrag
  P((c, w, h) => {
    c.fillStyle = '#00aa5a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = `bold 84px ${FONT}`; c.fillText('ÖH', 26, 110); c.font = `bold 34px ${FONT}`; c.fillText('BOKU', 26, 152);
    c.fillStyle = '#ffffff'; c.fillRect(26, 180, w - 52, 4);
    c.font = `bold 40px ${FONT}`; let y = W(c, 'Reminder: ÖH-Beitrag einzahlen bis 31.10.!', 26, 250, w - 52, 46);
    c.font = `22px ${FONT}`; y = W(c, 'Sonst keine Fortsetzung des Studiums im Wintersemester.', 26, y + 10, w - 52, 28);
    c.font = `bold 22px ${FONT}`; c.fillText('Infos: oehboku.at', 26, h - 34);
  }, { x: RX, y: fy(0.1) + 2.3, z: 0.1, w: 0.42, rotY: rotR, tilt: -0.01 });
  // 3 Masterarbeit
  P((c, w, h) => {
    c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, w, h); drawBokuLogo(c, 26, 26, 40);
    c.fillStyle = '#222'; c.font = `bold 30px ${FONT}`; let y = W(c, 'Masterarbeit zu vergeben', 26, 130, w - 52, 36);
    c.fillStyle = '#00aa5a'; c.font = `bold 24px ${FONT}`; y = W(c, 'Heimische Eiweißfuttermittel in der Legehennenfütterung', 26, y + 6, w - 52, 30);
    c.fillStyle = '#474747'; c.font = `19px ${FONT}`; y = W(c, 'Fütterungsversuch, Leistungsdaten, Analytik (Weender, Aminosäuren). Interesse? Bitte im Institutssekretariat (Muthgasse) melden.', 26, y + 12, w - 52, 26);
    for (let k = 0; k < 7; k++) { const x = 18 + k * 59; c.strokeStyle = '#bbb'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(x, h - 120); c.lineTo(x, h); c.stroke(); c.setLineDash([]); c.save(); c.translate(x + 34, h - 10); c.rotate(-Math.PI / 2); c.fillStyle = '#474747'; c.font = `13px ${FONT}`; c.fillText('Tierernährung TTE', 0, 0); c.restore(); }
  }, { x: RX, y: fy(2.2) + 2.25, z: 2.2, w: 0.4, rotY: rotR, tilt: 0.008 });
  // 4 Mensa im TÜWI
  P((c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#474747'; c.fillRect(0, 0, w, 120); c.fillStyle = '#fff'; c.font = `bold 34px ${FONT}`; c.fillText('BOKU Mensa', 26, 58); c.font = `24px ${FONT}`; c.fillText('im TÜWI', 26, 94);
    c.fillStyle = '#474747'; c.font = `22px ${FONT}`; let y = W(c, 'Tagesmenü, Frühstück, Bio-Kaffee.', 26, 170, w - 52, 30);
    c.fillStyle = '#00aa5a'; c.font = `bold 34px ${FONT}`; y = W(c, 'Mit BOKUcard −50 % auf jedes Menü', 26, y + 20, w - 52, 40);
    const days = [['Mo', 'Linsen-Dal'], ['Di', 'Kaspressknödel'], ['Mi', 'Gemüsestrudel'], ['Do', 'Grießnockerlsuppe'], ['Fr', 'Gebackener Karpfen']];
    days.forEach(([d, t2], i) => { const yy = y + 30 + i * 40; c.fillStyle = '#00aa5a'; c.font = `bold 20px ${FONT}`; c.fillText(d, 26, yy); c.fillStyle = '#474747'; c.font = `20px ${FONT}`; c.fillText(t2, 76, yy); });
  }, { x: RX, y: fy(4.3) + 2.2, z: 4.3, w: 0.38, rotY: rotR, tilt: -0.006 });
  // 5 Hybridhörsaal-Schild (laminiert, neben der Vordertür)
  P((c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#00aa5a'; c.fillRect(0, 0, 16, h);
    c.fillStyle = '#222'; c.font = `bold 50px ${FONT}`; c.fillText('HS 31', 44, 90); c.font = `22px ${FONT}`; c.fillStyle = '#474747'; c.fillText('Gregor-Mendel-Haus · 3. OG', 44, 126);
    c.fillStyle = '#efefef'; c.fillRect(44, 160, w - 80, 220);
    c.fillStyle = '#222'; c.font = `bold 30px ${FONT}`; c.fillText('Hybridhörsaal', 64, 212);
    c.font = `20px ${FONT}`; W(c, 'Diese Lehrveranstaltung kann aufgezeichnet werden. Kamera mit Speakertracking.', 64, 252, w - 120, 28);
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(w - 70, h - 120, 22, 0, 7); c.fill(); c.fillStyle = '#474747'; c.font = `18px ${FONT}`; c.fillText('REC', w - 140, h - 114);
    c.fillStyle = '#929191'; c.font = `16px ${FONT}`; c.fillText('Raumbuchung über BOKUonline', 44, h - 36);
  }, { x: RX, y: LY.PODIUM.h + 1.55, z: LY.FRONT_DOOR.z + 0.95, w: 0.25, rotY: rotR });
  // 6 USI-Sport (Fensterpfeiler)
  P((c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e6641e'); g.addColorStop(1, '#b8461a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = `bold 48px ${FONT}`; c.fillText('USI-Sport', 26, 90); c.font = `26px ${FONT}`; c.fillText('WS 2026/27', 26, 128);
    c.font = `bold 26px ${FONT}`; let y = W(c, 'Bewegung fürs ganze Semester.', 26, 200, w - 52, 32);
    c.font = `20px ${FONT}`; y = W(c, 'Schnuppern in der 1. Woche bei nicht ausgebuchten Kursen.', 26, y + 10, w - 52, 26);
    ['Klettern', 'Volleyball', 'Langlauf', 'Rudern', 'Yoga'].forEach((s2, i) => { c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(26, y + 16 + i * 48, w - 52, 38); c.fillStyle = '#fff'; c.fillText(s2, 40, y + 42 + i * 48); });
    c.font = `bold 20px ${FONT}`; c.fillText('Alle Kurse: www.usi.at', 26, h - 30);
  }, { x: LX + 0.002, y: fy(0.5) + 2.1, z: 0.5, w: 0.4, rotY: rotL, tilt: 0.01 });
  // 7 BOKU Ball
  P((c, w, h) => {
    c.fillStyle = '#1e1d22'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#c9a85a'; c.lineWidth = 3; c.strokeRect(16, 16, w - 32, h - 32);
    c.fillStyle = '#c9a85a'; c.font = `bold 52px Georgia, serif`; c.textAlign = 'center'; c.fillText('BOKU Ball', w / 2, 140); c.font = `bold 64px Georgia, serif`; c.fillText('2027', w / 2, 220);
    c.font = `26px Georgia, serif`; c.fillText('Wiener Rathaus', w / 2, 290);
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(w / 2 + Math.cos(i / 9 * 6.28) * 80, 420 + Math.sin(i / 9 * 6.28) * 80, 6, 0, 7); c.fill(); }
    c.font = `20px ${FONT}`; c.fillText('Tickets bald auf bokuball.at – sei schnell!', w / 2, h - 50); c.textAlign = 'left';
  }, { x: ROOM.x1 - 1.4, y: LY.BACK_FLOOR + 2.0, z: ROOM.z1 - 0.025, w: 0.42, rotY: Math.PI });
  // 8 TÜWI-Beisl Karaoke (handgemacht)
  P((c, w, h) => {
    c.fillStyle = '#f4e9c8'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7a2e1a'; c.font = `bold 46px 'Comic Sans MS', 'Segoe Print', cursive`; c.fillText('Karaoke-', 26, 100); c.fillText('Abend', 26, 156);
    c.fillStyle = '#333'; c.font = `bold 26px ${FONT}`; c.fillText('Mi., 4. November', 26, 236);
    c.font = `22px ${FONT}`; c.fillText('TÜWI Beisl', 26, 276); c.fillText('Peter-Jordan-Straße 76', 26, 306);
    c.fillStyle = '#00aa5a'; c.fillText('KultRef + UIW', 26, 360);
    c.strokeStyle = '#7a2e1a'; c.lineWidth = 6; c.beginPath(); c.arc(w - 110, h - 160, 60, 0, 7); c.stroke(); c.beginPath(); c.moveTo(w - 110, h - 100); c.lineTo(w - 110, h - 40); c.stroke();
  }, { x: -2.3, y: LY.BACK_FLOOR + 1.95, z: ROOM.z1 - 0.025, w: 0.36, rotY: Math.PI, tilt: 0.02 });
  // 9 PLANET SHAPERS Podcast
  P((c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#00aa5a'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, h - 18);
    c.fillStyle = '#4b288c'; c.font = `bold 40px ${FONT}`; c.fillText('PLANET', 40, 110); c.fillText('SHAPERS', 40, 156);
    c.fillStyle = '#00aa5a'; c.font = `bold 30px ${FONT}`; c.fillText('#20', 40, 210);
    c.fillStyle = '#474747'; c.font = `22px ${FONT}`; let y = W(c, 'Wie der Klimawandel die Reblaus wieder stark macht.', 40, 262, w - 80, 30);
    c.font = `18px ${FONT}`; W(c, 'Jetzt hören auf Spotify, Apple Podcasts und YouTube.', 40, y + 14, w - 80, 24);
    c.fillStyle = '#4b288c'; for (let i = 0; i < 18; i++) c.fillRect(40 + i * 20, h - 120 - Math.abs(Math.sin(i * 1.7)) * 60, 12, Math.abs(Math.sin(i * 1.7)) * 60 + 8);
  }, { x: RX, y: fy(1.15) + 2.95, z: 1.15, w: 0.34, rotY: rotR, tilt: 0.004 });
  // 10 Insekten im Fokus
  P((c, w, h) => {
    c.fillStyle = '#eef6e9'; c.fillRect(0, 0, w, h); drawBokuLogo(c, 26, 26, 36);
    c.fillStyle = '#222'; c.font = `bold 38px ${FONT}`; c.fillText('Insekten', 26, 150); c.fillText('im Fokus', 26, 196);
    c.fillStyle = '#474747'; c.font = `22px ${FONT}`; let y = W(c, 'Keynote und Paneldiskussion des Biodiversitätsclusters', 26, 246, w - 52, 30);
    c.fillStyle = '#00aa5a'; c.font = `bold 26px ${FONT}`; c.fillText('04.11.2026', 26, y + 20);
    c.strokeStyle = '#3b271a'; c.lineWidth = 3; c.fillStyle = '#e6641e';
    c.beginPath(); c.ellipse(w / 2, h - 140, 26, 44, 0, 0, 7); c.fill(); c.stroke();
    for (const s2 of [-1, 1]) { c.beginPath(); c.ellipse(w / 2 + s2 * 52, h - 160, 44, 26, s2 * 0.4, 0, 7); c.stroke(); }
  }, { x: RX, y: fy(3.2) + 2.95, z: 3.2, w: 0.34, rotY: rotR, tilt: -0.008 });
  // 11 BOKU-Bikes
  P((c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#00aa5a'; c.lineWidth = 8; c.beginPath(); c.arc(130, 260, 70, 0, 7); c.stroke(); c.beginPath(); c.arc(320, 260, 70, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(130, 260); c.lineTo(200, 170); c.lineTo(290, 170); c.lineTo(320, 260); c.moveTo(200, 170); c.lineTo(230, 260); c.lineTo(290, 170); c.stroke();
    c.fillStyle = '#222'; c.font = `bold 34px ${FONT}`; c.fillText('BOKU-Bikes', 26, 410); c.fillStyle = '#00aa5a'; c.font = `bold 24px ${FONT}`; c.fillText('Cool planet shaper.', 26, 446);
    c.fillStyle = '#474747'; c.font = `19px ${FONT}`; W(c, 'Jetzt auf die Interessent*innenliste! Nächste Bestellung Anfang Dezember 2026.', 26, 492, w - 52, 26);
  }, { x: ROOM.x0 + 1.4, y: LY.BACK_FLOOR + 1.95, z: ROOM.z1 - 0.025, w: 0.36, rotY: Math.PI, tilt: -0.01 });
  // 12 Pinnwand-Collage (Kork mit Zetteln)
  P((c, w, h) => {
    c.fillStyle = '#b98a58'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,0.25)`; c.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    const notes = [['Lerngruppe Tierernährung', 'Mi 18:00, Bibliothek', '#fff6a8'], ['WG-Zimmer nahe Türkenschanzpark', '450 € warm', '#ffffff'], ['Suche Mitfahrgelegenheit', 'nach Tulln, Mo früh', '#d8f0ff'], ['Verkaufe Skriptum', 'Bodenkunde, 5 €', '#ffffff'], ['Mykologie-Stammtisch', 'Fungi Forum, 27.10.', '#ffe0e0'], ['Awareness Days', '04.11.–10.12., ÖH', '#e8dcf5']];
    notes.forEach(([a, b, col], i) => {
      const x = 14 + (i % 2) * 216, y = 24 + Math.floor(i / 2) * 200; c.save(); c.translate(x + 96, y + 80); c.rotate((Math.random() - 0.5) * 0.14); c.translate(-96, -80);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(5, 6, 192, 160); c.fillStyle = col; c.fillRect(0, 0, 192, 160);
      c.fillStyle = '#c0392b'; c.beginPath(); c.arc(96, 12, 7, 0, 7); c.fill();
      c.fillStyle = '#333'; c.font = `bold 18px ${FONT}`; W(c, a, 12, 48, 170, 22); c.font = `16px ${FONT}`; c.fillText(b, 12, 128);
      if (i === 1) for (let k = 0; k < 6; k++) { c.fillStyle = '#fff'; c.fillRect(8 + k * 30, 136, 24, 24); c.strokeStyle = '#ccc'; c.strokeRect(8 + k * 30, 136, 24, 24); }
      c.restore();
    });
  }, { x: 0.6, y: LY.BACK_FLOOR + 1.85, z: ROOM.z1 - 0.025, w: 0.8, rotY: Math.PI });
  return list;
}

// ------------------------------------------------------------------ Hybrid-Monitor (Online-Teilnehmende, Aufzeichnung)
const REMOTE = ['Anna W.', 'Tobias K.', 'Selin A.', 'Markus H.', 'Leonie P.', 'Jonas G.', 'Mira S.', 'Felix B.'];
/**
 * Hybrid-Monitor an der Wand (Videokonferenz). share: { canvas, active() } – läuft der Beamer, zeigt das Hauptbild
 * die geteilte Folie (wie in echten Hybridvorlesungen), die Hörsaalkamera rückt ins kleine Fenster.
 */
export function buildHybridMonitor(gfx, lang = 'de', share = null) {
  const MO = LY.MONITOR;
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 544;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = gfx.renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xcfcfcf });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(MO.w - 0.03, MO.h - 0.03), mat);
  m.position.set(MO.x + 0.037, MO.y, MO.z); m.rotation.y = Math.PI / 2;
  gfx.scene.add(m);
  const c = cv.getContext('2d');
  const tileCol = ['#5a7d9a', '#8a6a4a', '#4a8a6a', '#7a5a8a', '#9a7a4a', '#4a6a8a', '#8a4a5a', '#5a8a8a'];
  let speaking = -1, t = 0, blink = 0;
  const drawCam = () => {
    c.fillStyle = '#3a3e44'; c.fillRect(16, 54, 600, 338);
    c.fillStyle = '#2a4a3a'; c.fillRect(40, 110, 250, 120); c.fillStyle = '#d8d8d6'; c.fillRect(320, 96, 260, 150);
    c.fillStyle = '#6b4a31'; c.fillRect(30, 290, 560, 40); c.fillStyle = '#4b5a48'; c.fillRect(200 + Math.sin(t * 0.3) * 120, 220, 26, 70); c.fillStyle = '#e6b897'; c.beginPath(); c.arc(213 + Math.sin(t * 0.3) * 120, 210, 12, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(16, 362, 230, 30); c.fillStyle = '#fff'; c.font = '16px Arial'; c.fillText(lang === 'en' ? 'Lecture hall camera' : 'Hörsaalkamera', 26, 383);
  };
  let wasSharing = false;
  const draw = () => {
    c.fillStyle = '#1e2126'; c.fillRect(0, 0, 960, 544);
    c.fillStyle = '#2b2f36'; c.fillRect(0, 0, 960, 40);
    c.fillStyle = '#e8eaed'; c.font = 'bold 20px Arial'; c.fillText(lang === 'en' ? 'Hybrid lecture hall HS 31 · Animal Nutrition' : 'Hybridhörsaal HS 31 · Tierernährung VO', 16, 27);
    c.fillStyle = blink ? '#e0453a' : '#6b2a26'; c.beginPath(); c.arc(860, 20, 8, 0, 7); c.fill();
    c.fillStyle = '#e8eaed'; c.font = 'bold 18px Arial'; c.fillText('REC', 875, 27);
    // Hauptbild: geteilte Folie, sonst Hörsaalkamera (stilisiert: Podium, Tafel, Leinwand)
    const sharing = share && share.active();
    if (sharing) {
      c.fillStyle = '#ffffff'; c.fillRect(16, 54, 600, 338);
      c.imageSmoothingQuality = 'high'; c.drawImage(share.canvas, 16, 54, 600, 338);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(16, 368, 250, 24); c.fillStyle = '#fff'; c.font = '14px Arial';
      c.fillText(lang === 'en' ? 'Prof. Haferkorn is sharing the screen' : 'Prof. Haferkorn teilt den Bildschirm', 24, 385);
      // Kamera klein unten rechts im Hauptbild
      c.save(); c.translate(456, 292); c.scale(160 / 600, 100 / 338); c.translate(-16, -54); drawCam(); c.restore();
      c.strokeStyle = '#1e2126'; c.lineWidth = 2; c.strokeRect(456, 292, 160, 100);
    } else drawCam();
    // Galerie
    REMOTE.forEach((n, i) => {
      const x = 632 + (i % 2) * 160, y = 54 + Math.floor(i / 2) * 84;
      c.fillStyle = '#2b2f36'; c.fillRect(x, y, 152, 78);
      c.fillStyle = tileCol[i]; c.beginPath(); c.arc(x + 76, y + 34, 22, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 18px Arial'; c.textAlign = 'center'; c.fillText(n.split(' ').map(w => w[0]).join(''), x + 76, y + 41); c.textAlign = 'left';
      c.fillStyle = '#c9cdd3'; c.font = '13px Arial'; c.fillText(n, x + 8, y + 72);
      if (i === speaking) { c.strokeStyle = '#00aa5a'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, 149, 75); }
    });
    c.fillStyle = '#c9cdd3'; c.font = '15px Arial'; c.fillText(lang === 'en' ? `${REMOTE.length + 3} participants online · chat: 2 new` : `${REMOTE.length + 3} Teilnehmende online · Chat: 2 neue Nachrichten`, 16, 420);
    c.fillStyle = '#2b2f36'; c.fillRect(16, 436, 928, 92);
    c.fillStyle = '#9aa1ab'; c.font = '14px Arial';
    c.fillText(lang === 'en' ? 'Leonie P.: Is the audio okay in the room?' : 'Leonie P.: Hört man im Saal alles gut?', 28, 466);
    c.fillText(lang === 'en' ? 'Jonas G.: Slides are on BOKUlearn 👍' : 'Jonas G.: Folien sind auf BOKUlearn 👍', 28, 492);
    tex.needsUpdate = true;
  };
  draw();
  return {
    mesh: m,
    update(dt) {
      t += dt; const b = Math.floor(t) % 2;
      const sh = !!(share && share.active()); if (sh !== wasSharing) { wasSharing = sh; draw(); }
      if (b !== blink || Math.random() < dt * 0.05) { blink = b; if (Math.random() < 0.25) speaking = Math.random() < 0.5 ? -1 : Math.floor(Math.random() * REMOTE.length); draw(); }
    }
  };;
}

/** Dreieck aus `img` (Quellpixel p.s) affin auf Zielpixel p.d zeichnen; Clip leicht aufgeweitet gegen Haarrisse */
function warpTri(c, img, p0, p1, p2) {
  const [x0, y0] = p0.s, [x1, y1] = p1.s, [x2, y2] = p2.s, [u0, v0] = p0.d, [u1, v1] = p1.d, [u2, v2] = p2.d;
  const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (!den) return;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den, b = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den;
  const cc = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den, d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
  const mx = (u0 + u1 + u2) / 3, my = (v0 + v1 + v2) / 3;
  const grow = ([u, v]) => { const l = Math.hypot(u - mx, v - my) || 1; return [u + (u - mx) / l * 0.8, v + (v - my) / l * 0.8]; };
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.beginPath(); c.moveTo(...grow(p0.d)); c.lineTo(...grow(p1.d)); c.lineTo(...grow(p2.d)); c.closePath(); c.clip();
  c.setTransform(a, cc, b, d, u0 - a * x0 - b * y0, v0 - cc * x0 - d * y0);
  c.drawImage(img, 0, 0);
  c.restore();
}
