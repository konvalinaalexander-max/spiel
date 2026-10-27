// Humanoides Rig: Geometrie (Vertexfarben, eine Draw-Call-Mesh je Figur), Skelett, Posen, IK.
// Koordinaten: Figur blickt nach +z, oben = +y, linke Körperseite = +x.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp } from '../core/util.js';

// ---------------------------------------------------------------------------
// Skelett-Definition (Bind-Pose = aufrecht stehend, Arme leicht abgespreizt hängend)
// ---------------------------------------------------------------------------
export function skeletonDef(h = 1.0, build = 1.0) {
  // h skaliert die Körpergröße (1 = 1,76 m), build die Breite
  const s = h, w = build;
  return [
    ['root', null, [0, 0, 0]],
    ['hips', 'root', [0, 0.95 * s, 0]],
    ['spine', 'hips', [0, 0.10 * s, -0.01]],
    ['chest', 'spine', [0, 0.20 * s, 0.0]],
    ['neck', 'chest', [0, 0.195 * s, -0.005]],
    ['head', 'neck', [0, 0.085 * s, 0.01]],
    ['jaw', 'head', [0, -0.02 * s, 0.02]],
    ['eyeL', 'head', [0.032, 0.075 * s, 0.075]],
    ['eyeR', 'head', [-0.032, 0.075 * s, 0.075]],
    ['lidL', 'head', [0.032, 0.075 * s, 0.075]],
    ['lidR', 'head', [-0.032, 0.075 * s, 0.075]],
    ['browL', 'head', [0.034, 0.104 * s, 0.087]],
    ['browR', 'head', [-0.034, 0.104 * s, 0.087]],
    ['clavL', 'chest', [0.03 * w, 0.165 * s, 0.0]],
    ['upperArmL', 'clavL', [0.165 * w, -0.01, -0.005]],
    ['foreArmL', 'upperArmL', [0.0, -0.285 * s, 0.0]],
    ['handL', 'foreArmL', [0.0, -0.255 * s, 0.0]],
    ['fingersL', 'handL', [0.0, -0.085 * s, 0.005]],
    ['thumbL', 'handL', [-0.012, -0.03 * s, 0.03]],
    ['clavR', 'chest', [-0.03 * w, 0.165 * s, 0.0]],
    ['upperArmR', 'clavR', [-0.165 * w, -0.01, -0.005]],
    ['foreArmR', 'upperArmR', [0.0, -0.285 * s, 0.0]],
    ['handR', 'foreArmR', [0.0, -0.255 * s, 0.0]],
    ['fingersR', 'handR', [0.0, -0.085 * s, 0.005]],
    ['thumbR', 'handR', [0.012, -0.03 * s, 0.03]],
    ['thighL', 'hips', [0.092 * w, -0.035 * s, 0.0]],
    ['shinL', 'thighL', [0.0, -0.43 * s, 0.0]],
    ['footL', 'shinL', [0.0, -0.43 * s, -0.01]],
    ['thighR', 'hips', [-0.092 * w, -0.035 * s, 0.0]],
    ['shinR', 'thighR', [0.0, -0.43 * s, 0.0]],
    ['footR', 'shinR', [0.0, -0.43 * s, -0.01]]
  ];
}

// ---------------------------------------------------------------------------
// Geometrie-Bausteine (im Bind-Raum, Weltkoordinaten der Figur)
// ---------------------------------------------------------------------------
const ni = g => (g.index ? g.toNonIndexed() : g);
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

/** Kapsel zwischen zwei Punkten */
function capsuleBetween(a, b, r1, r2 = r1, radial = 10) {
  const dir = _v.subVectors(b, a); const len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r1, len, radial, 3, true);
  // Kappen
  const c1 = new THREE.SphereGeometry(r1, radial, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); c1.translate(0, -len / 2, 0);
  const c2 = new THREE.SphereGeometry(r2, radial, 6, 0, Math.PI * 2, 0, Math.PI / 2); c2.translate(0, len / 2, 0);
  const merged = mergeGeometries([ni(g), ni(c1), ni(c2)]);
  _q.setFromUnitVectors(_up, dir.clone().normalize());
  merged.applyMatrix4(_m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1)));
  return merged;
}
function ellipsoid(cx, cy, cz, rx, ry, rz, seg = 14, phiStart = 0, phiLen = Math.PI * 2, thStart = 0, thLen = Math.PI) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.7)), phiStart, phiLen, thStart, thLen);
  g.scale(rx, ry, rz); g.translate(cx, cy, cz); return ni(g);
}
function rbox(cx, cy, cz, w, h, d, r = 0.01, rx = 0, ry = 0, rz = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(cx, cy, cz); return ni(g);
}
/** Rumpf aus Lathe-Profil mit elliptischem Querschnitt. prof: [[y, rx, rz], ...] */
function torsoLathe(prof, cz = 0, seg = 18) {
  const pts = prof.map(([y, r]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, seg);
  const pos = g.attributes.position;
  // elliptische Tiefe je Höhe interpolieren
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let k = 0; while (k < prof.length - 2 && prof[k + 1][0] < y) k++;
    const [y0, r0, d0] = prof[k], [y1, r1, d1] = prof[k + 1];
    const t = clamp((y - y0) / ((y1 - y0) || 1), 0, 1);
    const rr = lerp(r0, r1, t) || 1e-4, dd = lerp(d0, d1, t);
    pos.setZ(i, pos.getZ(i) * (dd / rr) + cz);
  }
  g.computeVertexNormals();
  return ni(g);
}

// ---------------------------------------------------------------------------
// Figur zusammenbauen
// ---------------------------------------------------------------------------
/**
 * spec: {
 *   height, build, skin, hair, hairStyle, top: {type, color, color2}, legs: {color}, shoes: {color},
 *   glasses, beard, headphones, beanie, cap, scarf, watch, female
 * }
 */
export function buildCharacter(spec, material) {
  const H = spec.height ?? 1.0, W = spec.build ?? 1.0, F = spec.female ? 1 : 0;
  const def = skeletonDef(H, W);
  // Bind-Positionen (Welt) berechnen
  const bindPos = {}; const parentOf = {};
  for (const [name, parent, off] of def) {
    parentOf[name] = parent;
    const p = parent ? bindPos[parent].clone() : new THREE.Vector3();
    bindPos[name] = p.add(new THREE.Vector3(...off));
  }
  const P = n => bindPos[n].clone();
  const parts = []; // { geo, bone, color, rough, cloth }
  const add = (geo, bone, color, rough = 0.85, cloth = 1) => parts.push({ geo, bone, color, rough, cloth });

  const skin = spec.skin, hair = spec.hair;
  const top = spec.top || { type: 'tshirt', color: 0x777777 };
  const topC = top.color, top2 = top.color2 ?? topC;
  const legC = spec.legs?.color ?? 0x2c3e58, shoeC = spec.shoes?.color ?? 0x222222;
  const longSleeve = top.type !== 'tshirt' && top.type !== 'vest';

  // --- Kopf -----------------------------------------------------------------
  const hc = P('head').add(new THREE.Vector3(0, 0.07 * H, 0.012));
  add(ellipsoid(hc.x, hc.y, hc.z, 0.083 * (F ? 0.95 : 1), 0.105, 0.095, 18), 'head', skin, 0.55, 0);
  // Kiefer/Kinn
  add(ellipsoid(hc.x, hc.y - 0.058, hc.z + 0.028, 0.058 * (F ? 0.9 : 1), 0.042, 0.056, 14), 'jaw', skin, 0.55, 0);
  // Nase
  add(rbox(0, hc.y - 0.005, hc.z + 0.093, 0.022, 0.04, 0.026, 0.009, -0.25), 'head', skin, 0.5, 0);
  // Ohren
  for (const sx of [1, -1]) add(ellipsoid(sx * 0.082, hc.y - 0.004, hc.z - 0.004, 0.012, 0.028, 0.018, 8), 'head', skin, 0.55, 0);
  // Augen (weiß + Iris), Lider, Brauen
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const e = P('eye' + side);
    add(ellipsoid(e.x, e.y, e.z, 0.0125, 0.0125, 0.0105, 10), 'eye' + side, 0xf2efe8, 0.12, 0);
    add(ellipsoid(e.x, e.y, e.z + 0.0092, 0.0062, 0.0062, 0.0022, 10), 'eye' + side, spec.eyeColor ?? 0x3d2b1f, 0.08, 0);
    add(ellipsoid(e.x, e.y, e.z + 0.0105, 0.0028, 0.0028, 0.0012, 8), 'eye' + side, 0x050505, 0.05, 0);
    // Oberlid als Kugelschale (Bone rotiert → Blinzeln)
    add(ellipsoid(e.x, e.y, e.z, 0.0142, 0.0142, 0.0125, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), 'lid' + side, skin, 0.5, 0);
    const b = P('brow' + side);
    add(rbox(b.x, b.y, b.z, 0.03, 0.0065, 0.008, 0.003, 0, 0, sx * -0.12), 'brow' + side, spec.browColor ?? hair, 0.8, 0);
  }
  // Mund (Lippen auf Kiefer)
  add(rbox(0, hc.y - 0.052, hc.z + 0.081, 0.034, 0.008, 0.012, 0.004), 'jaw', spec.lipColor ?? 0x9a5a52, 0.45, 0);
  add(rbox(0, hc.y - 0.044, hc.z + 0.078, 0.032, 0.006, 0.01, 0.003), 'head', spec.lipColor ?? 0x9a5a52, 0.45, 0);
  add(rbox(0, hc.y - 0.048, hc.z + 0.073, 0.03, 0.008, 0.01, 0.003), 'head', 0x2a1210, 0.6, 0);

  // Haare
  const hs = spec.hairStyle || 'short';
  const hairPart = (g, bone = 'head') => add(g, bone, hair, 0.75, 0);
  if (hs === 'bald') { /* nichts */ }
  else if (hs === 'receding') { // Prof: Haarkranz, oben licht
    hairPart(ellipsoid(hc.x, hc.y + 0.002, hc.z - 0.01, 0.088, 0.108, 0.099, 18, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.28));
    hairPart(ellipsoid(hc.x, hc.y + 0.03, hc.z - 0.018, 0.086, 0.09, 0.09, 16, Math.PI * 0.6, Math.PI * 0.8, 0.15, Math.PI * 0.45));
  } else {
    const thick = hs === 'buzz' ? 0.004 : hs === 'curly' ? 0.016 : 0.009;
    hairPart(ellipsoid(hc.x, hc.y + 0.008, hc.z - 0.006, 0.086 + thick, 0.108 + thick, 0.099 + thick, 18, 0, Math.PI * 2, 0, Math.PI * (hs === 'buzz' ? 0.46 : 0.5)));
    if (hs !== 'buzz') hairPart(ellipsoid(hc.x, hc.y + 0.06, hc.z + 0.06, 0.07, 0.035, 0.045, 12)); // Pony/Stirn
    if (hs === 'long' || hs === 'ponytail' || hs === 'bun') {
      hairPart(ellipsoid(hc.x, hc.y - 0.03, hc.z - 0.05, 0.09, 0.1, 0.06, 14)); // Hinterkopf voll
    }
    if (hs === 'long') { hairPart(rbox(0, hc.y - 0.12, hc.z - 0.065, 0.17, 0.2, 0.05, 0.022), 'neck'); for (const sx of [1, -1]) hairPart(rbox(sx * 0.082, hc.y - 0.07, hc.z - 0.005, 0.03, 0.15, 0.07, 0.014)); }
    if (hs === 'ponytail') hairPart(capsuleBetween(new THREE.Vector3(0, hc.y + 0.01, hc.z - 0.1), new THREE.Vector3(0, hc.y - 0.17, hc.z - 0.13), 0.025, 0.014, 8), 'neck');
    if (hs === 'bun') hairPart(ellipsoid(0, hc.y + 0.075, hc.z - 0.065, 0.042, 0.04, 0.042, 10));
    if (hs === 'curly') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; hairPart(ellipsoid(Math.cos(a) * 0.07, hc.y + 0.06 + Math.sin(i * 2.1) * 0.012, hc.z + Math.sin(a) * 0.07 - 0.01, 0.032, 0.03, 0.032, 8)); }
    if (hs === 'sidepart') hairPart(ellipsoid(hc.x + 0.03, hc.y + 0.08, hc.z + 0.02, 0.06, 0.03, 0.07, 12));
  }
  if (spec.beard) {
    const bc = spec.beardColor ?? hair;
    add(ellipsoid(hc.x, hc.y - 0.06, hc.z + 0.035, 0.063, 0.048, 0.06, 14, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), 'jaw', bc, 0.85, 0);
    add(rbox(0, hc.y - 0.036, hc.z + 0.086, 0.045, 0.01, 0.012, 0.004), 'head', bc, 0.85, 0); // Schnurrbart
  }
  if (spec.glasses) {
    const gc = spec.glassesColor ?? 0x1c1c1c;
    for (const sx of [1, -1]) {
      const ring = new THREE.TorusGeometry(0.019, 0.0022, 6, 18); ring.scale(1, 0.8, 1); ring.translate(sx * 0.033, P('eyeL').y, hc.z + 0.098);
      add(ni(ring), 'head', gc, 0.25, 0);
      add(rbox(sx * 0.07, P('eyeL').y + 0.004, hc.z + 0.045, 0.003, 0.004, 0.1, 0.0015), 'head', gc, 0.25, 0);
    }
    add(rbox(0, P('eyeL').y + 0.004, hc.z + 0.1, 0.016, 0.003, 0.003, 0.0012), 'head', gc, 0.25, 0);
  }
  if (spec.beanie) add(ellipsoid(hc.x, hc.y + 0.03, hc.z - 0.005, 0.097, 0.1, 0.106, 16, 0, Math.PI * 2, 0, Math.PI * 0.48), 'head', spec.beanie, 0.95, 1);
  if (spec.cap) {
    add(ellipsoid(hc.x, hc.y + 0.025, hc.z - 0.005, 0.094, 0.095, 0.103, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), 'head', spec.cap, 0.85, 1);
    add(rbox(0, hc.y + 0.055, hc.z + 0.115, 0.15, 0.008, 0.075, 0.004, 0.18), 'head', spec.cap, 0.85, 1);
  }
  if (spec.headphones) {
    const band = new THREE.TorusGeometry(0.098, 0.008, 6, 20, Math.PI); band.translate(0, hc.y + 0.005, hc.z - 0.005);
    add(ni(band), 'head', spec.headphones, 0.4, 0);
    for (const sx of [1, -1]) add(ellipsoid(sx * 0.092, hc.y - 0.005, hc.z - 0.005, 0.02, 0.035, 0.032, 10), 'head', spec.headphones, 0.4, 0);
  }

  // --- Hals & Rumpf -----------------------------------------------------------
  const n = P('neck'), ch = P('chest'), sp = P('spine'), hp = P('hips');
  add(capsuleBetween(n.clone().add(new THREE.Vector3(0, -0.03, 0)), P('head').add(new THREE.Vector3(0, 0.0, 0.005)), 0.05, 0.046, 10), 'neck', skin, 0.55, 0);
  const sh = 0.165 * W; // halbe Schulterbreite
  const chestProf = [
    [0.0, 0.148 * W, 0.112], [0.06, 0.162 * W, 0.122 + F * 0.012], [0.12, 0.176 * W, 0.128 + F * 0.02],
    [0.17, sh + 0.012, 0.115], [0.205, 0.13 * W, 0.09], [0.228, 0.06, 0.055]
  ];
  const chestGeo = torsoLathe(chestProf.map(([y, r, d]) => [y * H, r, d]), 0.0);
  chestGeo.translate(ch.x, ch.y - 0.01, ch.z);
  add(chestGeo, 'chest', topC, 0.9, 1);
  const bellyProf = [[0.0, 0.15 * W, 0.108], [0.08, 0.142 * W + (spec.belly || 0), 0.108 + (spec.belly || 0)], [0.2, 0.148 * W, 0.112]];
  const belly = torsoLathe(bellyProf.map(([y, r, d]) => [y * H, r, d]));
  belly.translate(sp.x, sp.y - 0.005, sp.z);
  add(belly, 'spine', topC, 0.9, 1);
  const pelvis = torsoLathe([[-0.09, 0.15 * W + F * 0.014, 0.108], [0.0, 0.156 * W + F * 0.016, 0.112], [0.11, 0.15 * W, 0.108]]);
  pelvis.translate(hp.x, hp.y, hp.z);
  add(pelvis, 'hips', legC, 0.9, 1);
  if (top.type === 'vest') { // Pullunder über Hemd: Hemdkragen + V-Ausschnitt
    const shirt = top.shirt ?? 0xdde6ee;
    add(rbox(0, ch.y + 0.2 * H, ch.z + 0.055, 0.1, 0.03, 0.04, 0.01, -0.3), 'chest', shirt, 0.85, 1);
    for (const sx of [1, -1]) add(rbox(sx * 0.03, ch.y + 0.205 * H, ch.z + 0.07, 0.05, 0.035, 0.012, 0.005, -0.3, 0, sx * 0.5), 'chest', shirt, 0.85, 1);
    add(rbox(0, ch.y + 0.13 * H, ch.z + 0.118, 0.05, 0.12, 0.01, 0.005), 'chest', shirt, 0.85, 1);
    add(rbox(0, sp.y + 0.05, sp.z + 0.106, 0.01, 0.16, 0.006, 0.002), 'spine', shirt, 0.85, 1);
  }
  if (top.type === 'hoodie') {
    const hood = new THREE.TorusGeometry(0.085, 0.032, 8, 16, Math.PI * 1.25); hood.rotateX(Math.PI / 2); hood.rotateZ(Math.PI * 0.12);
    hood.rotateY(Math.PI * 0.5 - 0.6); hood.translate(0, ch.y + 0.215 * H, ch.z - 0.02);
    add(ni(hood), 'chest', top2, 0.95, 1);
    add(rbox(0, sp.y + 0.09, sp.z + 0.11, 0.17, 0.08, 0.02, 0.01), 'spine', top2, 0.95, 1); // Bauchtasche
  }
  if (top.type === 'shirt' || top.type === 'flannel') {
    add(rbox(0, ch.y + 0.2 * H, ch.z + 0.06, 0.11, 0.03, 0.03, 0.01, -0.35), 'chest', top2, 0.9, 1);
    add(rbox(0, ch.y + 0.08 * H, ch.z + 0.122, 0.008, 0.2, 0.004, 0.002), 'chest', top2, 0.9, 1); // Knopfleiste
  }
  if (top.type === 'jacket') { // offene Jacke über Shirt
    for (const sx of [1, -1]) add(rbox(sx * 0.07, ch.y + 0.08, ch.z + 0.115, 0.08, 0.3, 0.012, 0.006), 'chest', top2, 0.8, 1);
    add(rbox(0, ch.y + 0.21 * H, ch.z - 0.005, 0.16, 0.05, 0.09, 0.02), 'chest', top2, 0.8, 1);
  }
  if (spec.scarf) {
    const sc = new THREE.TorusGeometry(0.065, 0.024, 8, 16); sc.rotateX(Math.PI / 2); sc.translate(0, n.y - 0.005, n.z + 0.005);
    add(ni(sc), 'neck', spec.scarf, 0.95, 1);
  }

  // --- Arme -------------------------------------------------------------------
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const ua = P('upperArm' + side), fa = P('foreArm' + side), ha = P('hand' + side), fi = P('fingers' + side), th = P('thumb' + side);
    const sleeve = top.type === 'vest' ? (top.shirt ?? 0xdde6ee) : topC;
    const bulk = ['sweater', 'hoodie', 'jacket', 'flannel'].includes(top.type) ? 0.007 : 0;
    add(ellipsoid(ua.x - sx * 0.01, ua.y + 0.005, ua.z, 0.064 * W + bulk, 0.058, 0.064 + bulk, 10), 'upperArm' + side, sleeve, 0.9, 1); // Schulterkappe
    add(capsuleBetween(ua, fa, 0.054 * W + bulk, 0.047 * W + bulk, 10), 'upperArm' + side, sleeve, 0.9, 1);
    if (longSleeve || top.type === 'vest') {
      add(capsuleBetween(fa, ha.clone().add(new THREE.Vector3(0, 0.03, 0)), 0.045 * W + bulk, 0.037 + bulk * 0.5, 10), 'foreArm' + side, sleeve, 0.9, 1);
      add(capsuleBetween(ha.clone().add(new THREE.Vector3(0, 0.035, 0)), ha.clone().add(new THREE.Vector3(0, -0.01, 0)), 0.026, 0.024, 8), 'foreArm' + side, skin, 0.55, 0);
    } else {
      add(capsuleBetween(fa.clone().add(new THREE.Vector3(0, 0.1, 0)), fa.clone().add(new THREE.Vector3(0, -0.02, 0)), 0.045 * W, 0.043, 10), 'upperArm' + side, sleeve, 0.9, 1);
      add(capsuleBetween(fa, ha, 0.04, 0.029, 10), 'foreArm' + side, skin, 0.55, 0);
    }
    if (spec.watch && side === 'L') add(rbox(ha.x, ha.y + 0.025, ha.z, 0.06, 0.02, 0.058, 0.008), 'foreArm' + side, spec.watch, 0.3, 0);
    // Hand: Handfläche, Finger, Daumen
    add(rbox(ha.x, ha.y - 0.047, ha.z + 0.002, 0.03, 0.09, 0.082, 0.013), 'hand' + side, skin, 0.55, 0);
    add(rbox(fi.x, fi.y - 0.034, fi.z, 0.025, 0.075, 0.076, 0.011), 'fingers' + side, skin, 0.55, 0);
    add(capsuleBetween(th, th.clone().add(new THREE.Vector3(0, -0.04, 0.012)), 0.011, 0.009, 6), 'thumb' + side, skin, 0.55, 0);
  }

  // --- Beine ------------------------------------------------------------------
  for (const [side] of [['L'], ['R']]) {
    const t = P('thigh' + side), s = P('shin' + side), f = P('foot' + side);
    add(capsuleBetween(t.clone().add(new THREE.Vector3(0, 0.03, 0)), s, 0.084 * W + F * 0.008, 0.064 * W, 12), 'thigh' + side, legC, 0.9, 1);
    add(capsuleBetween(s, f.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.06 * W, 0.047, 12), 'shin' + side, legC, 0.9, 1);
    add(rbox(f.x, f.y - 0.045, f.z + 0.05, 0.095, 0.075, 0.27, 0.03), 'foot' + side, shoeC, 0.6, 0);
    add(rbox(f.x, f.y - 0.078, f.z + 0.05, 0.1, 0.018, 0.275, 0.006), 'foot' + side, spec.soleColor ?? 0xe6e3dc, 0.7, 0);
  }

  // --- Zusammenführen + Skinning ---------------------------------------------
  const boneIndex = {}; def.forEach(([name], i) => { boneIndex[name] = i; });
  const geos = [];
  const col = new THREE.Color();
  for (const p of parts) {
    const g = p.geo.index ? p.ni(geo) : p.geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const nVert = g.attributes.position.count;
    col.set(p.color);
    const c = new Float32Array(nVert * 3), si = new Uint16Array(nVert * 4), sw = new Float32Array(nVert * 4), ex = new Float32Array(nVert * 2);
    const bi = boneIndex[p.bone];
    for (let i = 0; i < nVert; i++) {
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      si[i * 4] = bi; sw[i * 4] = 1;
      ex[i * 2] = p.rough; ex[i * 2 + 1] = p.cloth;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setAttribute('aSurf', new THREE.BufferAttribute(ex, 2));
    geos.push(g);
  }
  const geo = mergeGeometries(geos, false);
  // Kachelnde UVs für Stoff-Detailnormalen (Box-Projektion im Bind-Raum)
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ax > ay && ax > az) uv.setXY(i, z * 3, y * 3); else if (ay > az) uv.setXY(i, x * 3, z * 3); else uv.setXY(i, x * 3, y * 3);
  }
  geo.computeBoundingSphere();

  // Bones
  const bones = {}; const list = [];
  for (const [name, parent, off] of def) {
    const b = new THREE.Bone(); b.name = name;
    b.position.set(...off);
    bones[name] = b; list.push(b);
    if (parent) bones[parent].add(b);
  }
  const skeleton = new THREE.Skeleton(list);
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.add(bones.root);
  bones.root.updateMatrixWorld(true);
  mesh.bind(skeleton);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false; // Skinned-Bounds sind unzuverlässig; Figuren sind ohnehin im Saal
  const lengths = {
    upperArm: bindPos.foreArmL.distanceTo(bindPos.upperArmL), foreArm: bindPos.handL.distanceTo(bindPos.foreArmL),
    thigh: bindPos.shinL.distanceTo(bindPos.thighL), shin: bindPos.footL.distanceTo(bindPos.shinL), hipHeight: bindPos.hips.y,
    ankle: bindPos.footL.y
  };
  return { mesh, bones, skeleton, bindPos, lengths, spec, H };
}

/** Material für Figuren: Vertexfarben, Rauheit je Vertex, Stoff-Detailnormalen nur auf Kleidung. */
export function characterMaterial(gfx) {
  const t = gfx.tex.make('clothDetail', { size: 512 });
  const patch = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aSurf;\nvarying vec2 vSurf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = aSurf;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSurf;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.x;')
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vSurf.y;');
  };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.9, 0.9) });
  m.name = 'character';
  m.userData.patches = [patch]; m.userData.patchKey = 'char';
  return gfx.register(m);
}

// ---------------------------------------------------------------------------
// Posen & IK
// ---------------------------------------------------------------------------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _e = new THREE.Euler();

/** Setzt lokale Rotationen aus einer Pose {bone: [x,y,z]} (Euler YXZ, Radiant). */
export function applyPose(rig, pose) {
  for (const name in pose) {
    const b = rig.bones[name]; if (!b) continue;
    const r = pose[name];
    b.quaternion.setFromEuler(_e.set(r[0], r[1], r[2], 'YXZ'));
  }
}
/** Mischt zwei Posen (a,b) mit t in out */
export function blendPose(out, a, b, t) {
  for (const k in a) { const x = a[k], y = b[k] || [0, 0, 0]; out[k] = [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]; }
  for (const k in b) if (!(k in a)) { const y = b[k]; out[k] = [y[0] * t, y[1] * t, y[2] * t]; }
  return out;
}

/**
 * Richtet einen Knochen so aus, dass seine lokale Achse `axis` (Bind) in Weltrichtung `dir` zeigt;
 * `poleAxis` (lokal) wird möglichst Richtung `pole` (Welt) gedreht.
 */
export function aimBone(bone, axis, dir, poleAxis, pole) {
  bone.parent.updateWorldMatrix(true, false);
  bone.parent.getWorldQuaternion(_qp);
  // aktuelle Weltausrichtung ohne lokale Rotation = Eltern-Rotation
  const qw = _qa.copy(_qp);
  const curAxis = _a.copy(axis).applyQuaternion(qw).normalize();
  const want = _b.copy(dir).normalize();
  const swing = _qb.setFromUnitVectors(curAxis, want);
  qw.premultiply(swing);
  if (poleAxis && pole) {
    // Drall um die Zielachse, damit poleAxis Richtung pole zeigt
    const curPole = _c.copy(poleAxis).applyQuaternion(qw);
    const pp = _d.copy(pole).sub(_c.copy(want).multiplyScalar(pole.dot(want))).normalize();
    const cp = curPole.sub(_c.copy(want).multiplyScalar(curPole.dot(want))).normalize();
    if (pp.lengthSq() > 1e-6 && cp.lengthSq() > 1e-6) {
      let ang = Math.acos(clamp(cp.dot(pp), -1, 1));
      if (_c.crossVectors(cp, pp).dot(want) < 0) ang = -ang;
      qw.premultiply(new THREE.Quaternion().setFromAxisAngle(want, ang));
    }
  }
  bone.quaternion.copy(_qp.invert()).multiply(qw);
  bone.updateMatrixWorld(true);
}

const DOWN = new THREE.Vector3(0, -1, 0), FWD = new THREE.Vector3(0, 0, 1);
/**
 * Zwei-Knochen-IK (Arm oder Bein). upper → mid → end. target/pole in Welt.
 * Achse der Knochen im Bind-Raum ist -y; die Beugerichtung (Ellbogen/Knie) ist bendAxis (lokal, z. B. -z beim Arm).
 */
export function twoBoneIK(upper, mid, end, lenA, lenB, target, pole, bendAxisLocal = FWD) {
  upper.updateWorldMatrix(true, false);
  const root = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
  const toT = new THREE.Vector3().subVectors(target, root);
  let d = toT.length();
  d = clamp(d, Math.abs(lenA - lenB) + 1e-3, lenA + lenB - 1e-3);
  const dir = toT.normalize();
  const x = (lenA * lenA - lenB * lenB + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, lenA * lenA - x * x));
  const pdir = new THREE.Vector3().subVectors(pole, root);
  pdir.sub(dir.clone().multiplyScalar(pdir.dot(dir))).normalize();
  if (pdir.lengthSq() < 1e-6) pdir.set(0, 0, 1);
  const elbow = root.clone().addScaledVector(dir, x).addScaledVector(pdir, hgt);
  aimBone(upper, DOWN, elbow.clone().sub(root), bendAxisLocal, pdir);
  const endPos = root.clone().addScaledVector(dir, d);
  aimBone(mid, DOWN, endPos.clone().sub(elbow), bendAxisLocal, pdir);
  return elbow;
}

/** Kopf/Hals-Blick auf Weltpunkt mit anatomischen Grenzen; gibt erreichte Gier/Neigung zurück. */
export function computeLook(rig, target, limits = { yaw: 1.3, pitchUp: 0.6, pitchDown: 0.8 }) {
  const chest = rig.bones.chest; chest.updateWorldMatrix(true, false);
  const head = rig.bones.head;
  head.updateWorldMatrix(true, false);
  const hp = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld).add(new THREE.Vector3(0, 0.07, 0));
  const inv = new THREE.Matrix4().copy(chest.matrixWorld).invert();
  const local = target.clone().applyMatrix4(inv).sub(hp.clone().applyMatrix4(inv));
  const yaw = clamp(Math.atan2(local.x, local.z), -limits.yaw, limits.yaw);
  const pitch = clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -limits.pitchDown, limits.pitchUp);
  return { yaw, pitch };
}
