// Hörsaal-Geometrie nach Vorbild MENH HS 31 (Gregor-Mendel-Haus): historische, dunkel gebeizte Pultbänke,
// Eichen-Stabparkett, hohe weiße Sprossenfenster mit tiefen Laibungen, dunkle Holzvertäfelung, Podest mit
// langem Vortragstisch, Hybrid-Technik (Pult mit Touchscreen, Beamer, Kamera, Monitor). Statische Teile gebatcht.
import * as THREE from 'three';
import { Batcher, rbox, box, cyl, mat } from '../gfx/geom.js';
import * as LY from './layout.js';
import { makeRng } from '../core/util.js';

const { ROOM } = LY;

export function buildHall(gfx) {
  const scene = gfx.scene;
  const rng = makeRng(1872);
  const B = new Batcher();
  const M = {};
  // ------------------------------------------------------------------ Materialien
  M.plaster = gfx.pbr({ name: 'plaster', recipe: 'plaster', texOpts: { c1: '#f1eee6', size: 512 }, normalScale: 0.25 });
  M.ceiling = gfx.pbr({ name: 'ceilingPlaster', recipe: 'plaster', texOpts: { c1: '#f8f7f3', size: 512, seed: 4 }, normalScale: 0.12, aoIntensity: 0.3 });
  M.bench = gfx.pbr({ name: 'benchWood', recipe: 'woodStained', texOpts: { c1: '#5a3d29', c2: '#432d1d', seed: 2 }, envMapIntensity: 0.8 });
  M.benchTop = gfx.pbr({ name: 'benchTop', recipe: 'woodStained', texOpts: { c1: '#654630', c2: '#4b3322', seed: 3 }, envMapIntensity: 0.9, normalScale: 0.35 });
  M.beadboard = gfx.pbr({ name: 'beadboard', recipe: 'woodSlats', texOpts: { p: [10, 0.05, 0, 0], c1: '#5a3c28', c2: '#3f2a1b', seed: 5 } });
  M.panel = gfx.pbr({ name: 'paneling', recipe: 'woodStained', texOpts: { c1: '#5f402a', c2: '#48321f', seed: 7 }, envMapIntensity: 0.7 });
  M.parquet = gfx.pbr({ name: 'parquet', recipe: 'parquet', texOpts: { c1: '#cfa970', c2: '#ad8650' } });
  M.tableWood = gfx.pbr({ name: 'tableWood', recipe: 'woodDesk', texOpts: { c1: '#8a6142', c2: '#6b4a31', seed: 9 } });
  M.whitePaint = gfx.pbr({ name: 'whitePaint', recipe: 'plastic', texOpts: { c1: '#f7f6f1', size: 256 }, roughness: 1 });
  M.darkGrey = gfx.pbr({ name: 'darkGrey', recipe: 'plastic', texOpts: { c1: '#36393d', size: 256 } });
  M.whitePlastic = gfx.pbr({ name: 'whitePlastic', recipe: 'plastic', texOpts: { c1: '#ecebe6', size: 256, seed: 2 } });
  M.black = gfx.pbr({ name: 'blackMatte', color: 0x101113, roughness: 0.75 });
  M.alu = gfx.pbr({ name: 'alu', recipe: 'metalBrushed', texOpts: { c1: '#b9bec4', size: 512 }, metalness: 1, roughness: 1 });
  M.brass = gfx.pbr({ name: 'brass', recipe: 'metalBrushed', texOpts: { c1: '#b8955a', size: 256, seed: 3 }, metalness: 1, roughness: 1 });
  M.iron = gfx.pbr({ name: 'radiator', recipe: 'powderCoat', texOpts: { c1: '#e9e6de', c2: '#b9b4aa', size: 256 } });
  M.stone = gfx.pbr({ name: 'sillStone', recipe: 'concrete', texOpts: { c1: '#d9d4c9', seed: 8, size: 512 } });
  M.led = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6ea, emissiveIntensity: 2.0, roughness: 0.4 }); gfx.register(M.led);
  M.ledRed = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2010, emissiveIntensity: 2.5 }); gfx.register(M.ledRed);
  M.exit = new THREE.MeshStandardMaterial({ color: 0x1a9b48, emissive: 0x15a34a, emissiveIntensity: 1.1, roughness: 0.6 }); gfx.register(M.exit);
  M.glass = new THREE.MeshStandardMaterial({ color: 0xe2ecf0, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, envMapIntensity: 1.5, depthWrite: false });
  M.glass.roughnessMap = gfx.tex.make('glassDirt', { size: 512 }).ormMap; gfx.register(M.glass);
  M.red = gfx.pbr({ name: 'red', color: 0xb5241c, roughness: 0.4 });
  M.green = gfx.pbr({ name: 'bokuGreen', color: 0x00aa5a, roughness: 0.55 });
  M.screenBlack = gfx.pbr({ name: 'screenBlack', color: 0x0a0b0d, roughness: 0.25 });

  const add = (geo, m, mtx, o) => B.add(geo, m, mtx, o);
  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, cx = (ROOM.x0 + ROOM.x1) / 2;
  const H = ROOM.h;

  // ------------------------------------------------------------------ Böden
  const P = LY.PODIUM;
  add(box(W, P.h, P.z1 - ROOM.z0), M.parquet, mat(cx, P.h / 2, (ROOM.z0 + P.z1) / 2), { tile: 1.2, grain: 'z' });
  add(rbox(W, 0.03, 0.05, 0.008), M.bench, mat(cx, P.h - 0.015, P.z1 - 0.02), { tile: 1, cast: false }); // Podestkante
  add(box(W, 0.05, LY.ROW0_Z - P.z1), M.parquet, mat(cx, -0.025, (P.z1 + LY.ROW0_Z) / 2), { tile: 1.2, grain: 'z' });
  for (let i = 0; i < LY.ROWS; i++) {
    const f = LY.rowFloor(i), z0 = LY.rowFront(i), d = LY.ROW_DEPTH;
    add(box(W, Math.max(0.05, f), d), M.parquet, mat(cx, Math.max(0.05, f) / 2 - (f < 0.05 ? 0.025 : 0), z0 + d / 2), { tile: 1.2, grain: 'z' });
    if (i > 0) add(rbox(W, 0.025, 0.04, 0.006), M.bench, mat(cx, f - 0.0125, z0 + 0.02), { tile: 1, cast: false }); // Stufenkante
  }
  add(box(W, LY.BACK_FLOOR, ROOM.z1 - LY.BACK_Z), M.parquet, mat(cx, LY.BACK_FLOOR / 2, (LY.BACK_Z + ROOM.z1) / 2), { tile: 1.2, grain: 'z' });
  add(rbox(W, 0.025, 0.04, 0.006), M.bench, mat(cx, LY.BACK_FLOOR - 0.0125, LY.BACK_Z + 0.02), { tile: 1, cast: false });

  // ------------------------------------------------------------------ Wände
  const T = 0.3; // Wandstärke innen sichtbar (Altbau: dicke Wände → tiefe Fensterlaibungen)
  // Vorderwand
  add(box(W, H, T), M.plaster, mat(cx, H / 2, ROOM.z0 - T / 2), { tile: 2.5 });
  // Rückwand (ab hinterem Gang)
  add(box(W, H - LY.BACK_FLOOR, T), M.plaster, mat(cx, LY.BACK_FLOOR + (H - LY.BACK_FLOOR) / 2, ROOM.z1 + T / 2), { tile: 2.5 });
  // rechte Wand
  add(box(T, H, D), M.plaster, mat(ROOM.x1 + T / 2, H / 2, ROOM.z0 + D / 2), { tile: 2.5 });
  // linke Wand mit drei Fensteröffnungen (Laibungstiefe 0,42 m)
  const WN = LY.WINDOWS, wy0 = WN.y0, wy1 = WN.y1, ww = WN.w, LT = 0.42;
  add(box(LT, wy0, D), M.plaster, mat(ROOM.x0 - LT / 2, wy0 / 2, ROOM.z0 + D / 2), { tile: 2.5 });
  add(box(LT, H - wy1, D), M.plaster, mat(ROOM.x0 - LT / 2, (wy1 + H) / 2, ROOM.z0 + D / 2), { tile: 2.5 });
  {
    let z = ROOM.z0; const piers = [];
    for (const c of WN.list) { piers.push([z, c - ww / 2]); z = c + ww / 2; }
    piers.push([z, ROOM.z1]);
    for (const [a, b] of piers) add(box(LT, wy1 - wy0, b - a), M.plaster, mat(ROOM.x0 - LT / 2, (wy0 + wy1) / 2, (a + b) / 2), { tile: 2.5 });
  }
  // Stuckleiste / Hohlkehle an der Decke (umlaufend)
  for (const [x, z, w, d] of [[cx, ROOM.z0 + 0.05, W, 0.1], [cx, ROOM.z1 - 0.05, W, 0.1], [ROOM.x0 + 0.05, ROOM.z0 + D / 2, 0.1, D], [ROOM.x1 - 0.05, ROOM.z0 + D / 2, 0.1, D]]) {
    add(rbox(w, 0.12, d, 0.04), M.ceiling, mat(x, H - 0.06, z), { tile: 1, cast: false });
    add(rbox(w + (d < 0.2 ? 0 : 0.04), 0.04, d + (d < 0.2 ? 0.04 : 0), 0.01), M.ceiling, mat(x, H - 0.15, z), { tile: 1, cast: false });
  }
  // Decke + eingelassene LED-Panels
  add(box(W + 0.6, 0.15, D + 0.6), M.ceiling, mat(cx, H + 0.075, ROOM.z0 + D / 2), { tile: 2.5 });
  const ledPanels = [];
  for (const z of [-4.3, -1.6, 1.1, 3.8]) for (const x of [-3.0, -1.0, 1.0, 3.0]) {
    add(box(0.64, 0.02, 0.64), M.whitePaint, mat(x, H - 0.008, z), { tile: 1, cast: false });
    add(box(0.58, 0.012, 0.58), M.led, mat(x, H - 0.02, z), { cast: false, receive: false });
    ledPanels.push([x, z]);
  }
  // Rauchmelder, Lautsprecher, Lüftung
  for (const [x, z] of [[-2, -3], [2, -3], [-2, 2.5], [2, 2.5]]) { add(cyl(0.055, 0.06, 0.035, 20), M.whitePlastic, mat(x, H - 0.02, z), { cast: false }); add(cyl(0.008, 0.008, 0.004, 6), M.ledRed, mat(x + 0.03, H - 0.04, z), { cast: false }); }
  for (const [x, z] of [[-3.6, -5.2], [3.9, -5.2], [-3.6, 0.2], [3.9, 0.2]]) add(cyl(0.11, 0.11, 0.025, 24), M.whitePlastic, mat(x, H - 0.015, z), { cast: false });
  for (const z of [-0.2, 3.4]) { add(box(0.9, 0.02, 0.25), M.darkGrey, mat(0, H - 0.012, z), { cast: false }); for (let k = 0; k < 8; k++) add(box(0.86, 0.02, 0.012), M.whitePlastic, mat(0, H - 0.024, z - 0.105 + k * 0.03), { cast: false }); }

  // ------------------------------------------------------------------ Holzvertäfelung (rechts, folgt den Reihen; vorne; hinten)
  const PANEL_H = 1.4;
  const panelRun = (x, z0, z1, floorY, h, axis = 'z', side = 1) => {
    const len = z1 - z0, mid = (z0 + z1) / 2;
    if (axis === 'z') {
      add(box(0.035, h, len), M.panel, mat(x, floorY + h / 2, mid), { tile: 1.2, grain: 'y' });
      add(rbox(0.07, 0.05, len, 0.012), M.bench, mat(x - side * 0.02, floorY + h + 0.02, mid), { tile: 1 }); // Abschlussleiste
      add(rbox(0.05, 0.12, len, 0.01), M.bench, mat(x - side * 0.012, floorY + 0.06, mid), { tile: 1, cast: false }); // Sockel
      // Kassetten (Füllungen mit Rahmen)
      const nCass = Math.max(1, Math.round(len / 0.7));
      for (let k = 0; k < nCass; k++) {
        const cz = z0 + (k + 0.5) * len / nCass;
        add(rbox(0.02, h * 0.62, len / nCass - 0.16, 0.006), M.bench, mat(x - side * 0.025, floorY + h * 0.52, cz), { tile: 0.8, grain: 'y', cast: false });
      }
    } else {
      add(box(len, h, 0.035), M.panel, mat(mid, floorY + h / 2, x), { tile: 1.2, grain: 'y' });
      add(rbox(len, 0.05, 0.07, 0.012), M.bench, mat(mid, floorY + h + 0.02, x - side * 0.02), { tile: 1 });
      add(rbox(len, 0.12, 0.05, 0.01), M.bench, mat(mid, floorY + 0.06, x - side * 0.012), { tile: 1, cast: false });
      const nCass = Math.max(1, Math.round(len / 0.7));
      for (let k = 0; k < nCass; k++) { const cxk = z0 + (k + 0.5) * len / nCass; add(rbox(len / nCass - 0.16, h * 0.62, 0.02, 0.006), M.bench, mat(cxk, floorY + h * 0.52, x - side * 0.025), { tile: 0.8, grain: 'y', cast: false }); }
    }
  };
  const RX = ROOM.x1 - 0.018;
  panelRun(RX, LY.FRONT_DOOR.z + LY.FRONT_DOOR.w / 2 + 0.15, LY.PODIUM.z1, P.h, PANEL_H, 'z', 1);
  panelRun(RX, LY.PODIUM.z1, LY.ROW0_Z, 0, PANEL_H, 'z', 1);
  for (let i = 0; i < LY.ROWS; i++) panelRun(RX, LY.rowFront(i), LY.rowFront(i) + LY.ROW_DEPTH, LY.rowFloor(i), PANEL_H, 'z', 1);
  panelRun(RX, LY.BACK_Z, ROOM.z1, LY.BACK_FLOOR, PANEL_H, 'z', 1);
  // Handlauf am rechten Stufengang (Messing auf Holzkonsolen), steigt mit den Reihen
  for (let i = -1; i < LY.ROWS; i++) {
    const z0 = i < 0 ? LY.ROW0_Z - 0.4 : LY.rowFront(i), z1 = z0 + LY.ROW_DEPTH, y0 = (i < 0 ? 0 : LY.rowFloor(i)) + 0.95, y1 = y0 + LY.ROW_RISE;
    const len = Math.hypot(z1 - z0, y1 - y0), ang = Math.atan2(y1 - y0, z1 - z0);
    add(cyl(0.022, 0.022, len, 12), M.brass, mat(RX - 0.09, (y0 + y1) / 2, (z0 + z1) / 2, Math.PI / 2 - ang, 0, 0), { cast: false });
    add(rbox(0.09, 0.03, 0.05, 0.008), M.brass, mat(RX - 0.05, y0 - 0.03, z0 + 0.1), { cast: false });
  }
  // Vorderwand: Vertäfelung links und rechts der Tafel/Leinwand bis Brüstungshöhe
  panelRun(ROOM.z0 + 0.018, ROOM.x0 + 0.05, LY.BOARD.x - LY.BOARD.w / 2 - 0.15, P.h, 1.0, 'x', -1);
  panelRun(ROOM.z0 + 0.018, LY.BOARD.x + LY.BOARD.w / 2 + 0.15, ROOM.x1 - 0.05, P.h, 1.0, 'x', -1);
  // Rückwand: Vertäfelung am hinteren Gang
  panelRun(ROOM.z1 - 0.018, ROOM.x0 + 0.05, LY.BACK_DOOR.x - LY.BACK_DOOR.w / 2 - 0.12, LY.BACK_FLOOR, 1.2, 'x', 1);
  // linke Wand unten: Brüstung mit Sockelleiste
  for (let i = -1; i <= LY.ROWS; i++) {
    const z0 = i < 0 ? LY.PODIUM.z1 : i === LY.ROWS ? LY.BACK_Z : LY.rowFront(i), z1 = i < 0 ? LY.ROW0_Z : i === LY.ROWS ? ROOM.z1 : z0 + LY.ROW_DEPTH;
    const f = i < 0 ? 0 : i === LY.ROWS ? LY.BACK_FLOOR : LY.rowFloor(i);
    add(rbox(0.03, 0.11, z1 - z0, 0.008), M.bench, mat(ROOM.x0 + 0.015, f + 0.055, (z0 + z1) / 2), { tile: 1, cast: false });
  }

  // ------------------------------------------------------------------ Fenster (weiße Holz-Sprossenfenster, Steinsimse, Heizkörper)
  const windowGlass = [];
  for (const c of WN.list) {
    const yc = (wy0 + wy1) / 2, h = wy1 - wy0, fx = ROOM.x0 - LT + 0.08;
    // Blendrahmen + Flügel + Kämpfer + Sprossen
    const fr = (y, hh, z, wz) => add(rbox(0.09, hh, wz, 0.01), M.whitePaint, mat(fx, y, z), { tile: 0.6 });
    fr(wy0 + 0.04, 0.08, c, ww); fr(wy1 - 0.04, 0.08, c, ww);
    const transom = wy1 - 0.62;
    fr(transom, 0.07, c, ww);
    for (const zz of [c - ww / 2 + 0.04, c + ww / 2 - 0.04, c]) fr(yc, h, zz, zz === c ? 0.07 : 0.08);
    for (const s of [-1, 1]) {
      const zc = c + s * ww / 4;
      for (const yy of [wy0 + (transom - wy0) / 3, wy0 + 2 * (transom - wy0) / 3]) add(rbox(0.05, 0.03, ww / 2 - 0.12, 0.006), M.whitePaint, mat(fx + 0.01, yy, zc), { cast: false });
      add(rbox(0.05, transom - wy0 - 0.1, 0.03, 0.006), M.whitePaint, mat(fx + 0.01, (wy0 + transom) / 2, zc), { cast: false });
      add(rbox(0.04, 0.03, ww / 2 - 0.12, 0.006), M.whitePaint, mat(fx + 0.01, (transom + wy1) / 2, zc), { cast: false });
      // Fenstergriff (Olive)
      add(rbox(0.03, 0.12, 0.025, 0.008), M.brass, mat(fx + 0.07, yc - 0.15, c + s * 0.06), { cast: false });
    }
    // Innensims aus Stein + Laibungsverputz-Kante
    add(rbox(LT + 0.06, 0.04, ww + 0.14, 0.01), M.stone, mat(ROOM.x0 - LT / 2 + 0.03, wy0 - 0.02, c), { tile: 0.6 });
    // Heizkörper (Gussglieder) unter dem Fenster
    const rY = Math.max(0.12, LY.floorAt(ROOM.x0 + 0.3, c) + 0.12);
    if (wy0 - rY > 0.55) {
      for (let k = 0; k < 18; k++) add(rbox(0.13, 0.55, 0.05, 0.02), M.iron, mat(ROOM.x0 + 0.1, rY + 0.29, c - 0.72 + k * 0.085), { tile: 0.4 });
      add(cyl(0.015, 0.015, 1.6, 8), M.iron, mat(ROOM.x0 + 0.1, rY + 0.04, c, Math.PI / 2, 0, 0), { cast: false });
      add(cyl(0.02, 0.02, 0.08, 10), M.brass, mat(ROOM.x0 + 0.12, rY + 0.62, c + 0.78), { cast: false }); // Thermostatkopf
    }
    const g = new THREE.Mesh(new THREE.PlaneGeometry(ww - 0.12, h - 0.12), M.glass);
    g.position.set(fx - 0.01, yc, c); g.rotation.y = Math.PI / 2; g.renderOrder = 2;
    scene.add(g); windowGlass.push(g);
  }

  // ------------------------------------------------------------------ Pultbänke
  const BL = LY.BLOCK, bw = BL.x1 - BL.x0, bx = (BL.x0 + BL.x1) / 2;
  const deskTilt = 0.2; // ≈ 12°
  const seatNumbers = [];
  for (let i = 0; i < LY.ROWS; i++) {
    const f = LY.rowFloor(i), z0 = LY.rowFront(i), prevF = i === 0 ? 0 : LY.rowFloor(i - 1);
    // Frontwand des Pults (Rückenlehne der Vorreihe): Profilbretter
    const top = f + LY.DESK_H + 0.05;
    add(box(bw, top - prevF, 0.03), M.beadboard, mat(bx, prevF + (top - prevF) / 2, z0 + 0.015), { tile: 0.9 });
    // geneigte Schreibplatte (vorne hoch), Ablageleiste mit Stiftrille
    add(rbox(bw, 0.032, LY.DESK_D - 0.07, 0.006), M.benchTop, mat(bx, f + LY.DESK_H, z0 + 0.07 + (LY.DESK_D - 0.07) / 2, deskTilt), { tile: 1.1 });
    add(rbox(bw, 0.035, 0.08, 0.008), M.bench, mat(bx, top - 0.012, z0 + 0.045), { tile: 1.1 });
    add(box(bw - 0.02, 0.004, 0.016), M.bench, mat(bx, top + 0.004, z0 + 0.06), { cast: false, receive: true, tile: 1 });
    // Ablagefach
    add(box(bw - 0.04, 0.018, 0.12), M.bench, mat(bx, f + LY.DESK_H - 0.14, z0 + 0.1), { tile: 1.1, cast: false });
    // Bank: Sitzbrett + Vorderkante, Konsolen
    const sz0 = z0 + LY.ROW_DEPTH - LY.SEAT_D - 0.02;
    add(rbox(bw, 0.04, LY.SEAT_D, 0.012), M.benchTop, mat(bx, f + LY.SEAT_H, sz0 + LY.SEAT_D / 2), { tile: 1.1 });
    for (let k = 0; k <= 5; k++) {
      const x = BL.x0 + 0.08 + k * (bw - 0.16) / 5;
      add(rbox(0.04, LY.SEAT_H - 0.02, 0.32, 0.008), M.bench, mat(x, f + (LY.SEAT_H - 0.02) / 2, sz0 + 0.2), { tile: 0.6, cast: true });
      add(rbox(0.035, LY.DESK_H - 0.2, 0.05, 0.008), M.bench, mat(x, f + (LY.DESK_H - 0.2) / 2, z0 + 0.05), { tile: 0.6, cast: false });
    }
    // Rückenlehne: schräges Brett an der Front der nächsten Reihe (bzw. Rückwand bei der letzten)
    const bz = z0 + LY.ROW_DEPTH - 0.035;
    add(rbox(bw, 0.24, 0.03, 0.01), M.benchTop, mat(bx, f + LY.SEAT_H + 0.33, bz, -0.12), { tile: 1.1 });
    // Wangen an beiden Reihenenden (geschwungenes Profil)
    for (const [ex, sgn] of [[BL.x0 - 0.025, -1], [BL.x1 + 0.025, 1]]) {
      const g = sideProfile(f, prevF, z0);
      g.translate(ex + 0.025, 0, 0);
      add(g, M.bench, null, { tile: 0.7, grain: 'y' });
    }
    // Nachgerüstete Steckdosen unter der Ablageleiste (je zwei Plätze) + Kabelkanal
    add(box(bw - 0.1, 0.03, 0.02), M.whitePlastic, mat(bx, f + 0.09, z0 + 0.045), { tile: 1, cast: false });
    for (let k = 0; k < LY.SEATS; k += 2) {
      const sx = LY.seatX(k) + LY.SEAT_PITCH / 2;
      add(rbox(0.09, 0.08, 0.045, 0.008), M.whitePlastic, mat(sx, f + LY.DESK_H - 0.12, z0 + 0.055), { tile: 0.3, cast: false });
      add(cyl(0.017, 0.017, 0.006, 12), M.darkGrey, mat(sx, f + LY.DESK_H - 0.12, z0 + 0.079, Math.PI / 2, 0, 0), { cast: false });
    }
    for (let k = 0; k < LY.SEATS; k++) seatNumbers.push({ x: LY.seatX(k), y: top + 0.0045, z: z0 + 0.03, row: i, n: k + 1 });
  }
  // letzte Reihe: Rückwand der Bank
  add(box(bw, 0.95, 0.03), M.beadboard, mat(bx, LY.rowFloor(LY.ROWS - 1) + 0.475, LY.BACK_Z + 0.015), { tile: 0.9 });

  // Platznummern (kleine Messingschilder auf der Ablageleiste) – ein Atlas
  {
    const cols = LY.SEATS, rows = LY.ROWS, cw = 96, ch = 48;
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch;
    const c = cv.getContext('2d');
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const g = c.createLinearGradient(0, r * ch, 0, r * ch + ch); g.addColorStop(0, '#d8bd85'); g.addColorStop(1, '#a8874c');
      c.fillStyle = g; c.fillRect(k * cw, r * ch, cw, ch);
      c.fillStyle = '#3a2a14'; c.font = 'bold 30px Arial'; c.textAlign = 'center'; c.fillText(`${r + 1}·${k + 1}`, k * cw + cw / 2, r * ch + 35);
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const nm = gfx.pbr({ name: 'seatNumbers', roughness: 0.35, metalness: 0.6 }); nm.map = tex;
    const geos = seatNumbers.map(s => {
      const g = new THREE.PlaneGeometry(0.055, 0.028); g.rotateX(-Math.PI / 2); g.translate(s.x, s.y, s.z);
      const u0 = (s.n - 1) / cols, v0 = 1 - (s.row + 1) / rows, uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / cols, v0 + uv.getY(i) / rows);
      return g;
    });
    B.add(mergeAll(geos), nm, null, { keepUV: true, cast: false });
  }

  // ------------------------------------------------------------------ Front: Tafelanlage, Leinwand, Beamer, Pult, Vortragstisch
  const BD = LY.BOARD;
  for (const sx of [BD.x - BD.w / 2 - 0.07, BD.x + BD.w / 2 + 0.07]) add(rbox(0.09, 3.25, 0.09, 0.012), M.alu, mat(sx, P.h + 0.6 + 1.625, ROOM.z0 + 0.06), { tile: 0.6 });
  add(rbox(BD.w + 0.24, 0.07, 0.12, 0.012), M.alu, mat(BD.x, P.h + 3.88, ROOM.z0 + 0.07), { tile: 0.6 });
  add(rbox(BD.w, 0.035, 0.12, 0.008), M.alu, mat(BD.x, BD.lowY - 0.035, ROOM.z0 + 0.17), { tile: 0.6 }); // Kreideablage
  const SC = LY.SCREEN;
  add(rbox(SC.w + 0.3, 0.15, 0.15, 0.02), M.whitePlastic, mat(SC.x, SC.y + SC.h / 2 + 0.2, ROOM.z0 + 0.1), { tile: 0.8 });
  add(box(SC.w + 0.04, 0.12, 0.004), M.black, mat(SC.x, SC.y + SC.h / 2 + 0.06, SC.z - 0.002), { cast: false });
  add(cyl(0.018, 0.018, SC.w + 0.06, 12), M.darkGrey, mat(SC.x, SC.y - SC.h / 2 - 0.025, SC.z + 0.004, 0, 0, Math.PI / 2), { tile: 0.3 });
  const PJ = LY.PROJECTOR;
  add(rbox(0.46, 0.16, 0.4, 0.03), M.whitePlastic, mat(PJ.x, PJ.y - 0.1, PJ.z), { tile: 0.5 });
  add(cyl(0.05, 0.055, 0.04, 20), M.black, mat(PJ.x, PJ.y - 0.1, PJ.z - 0.21, Math.PI / 2, 0, 0), { cast: false });
  add(cyl(0.022, 0.022, ROOM.h - PJ.y + 0.02, 10), M.alu, mat(PJ.x, (ROOM.h + PJ.y) / 2, PJ.z), { cast: false });
  add(box(0.02, 0.01, 0.01), M.exit, mat(PJ.x + 0.17, PJ.y - 0.06, PJ.z - 0.201), { cast: false, receive: false });

  // Rednerpult (fix, SMART-Podium-Touchscreen, Schwanenhals-Mikro, Headset)
  const LE = LY.LECTERN;
  const lectern = new THREE.Group(); lectern.position.set(LE.x, P.h, LE.z); lectern.rotation.y = LE.yaw; scene.add(lectern); lectern.updateMatrixWorld();
  const lm = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().multiplyMatrices(lectern.matrixWorld, mat(x, y, z, rx, ry, rz));
  add(rbox(0.9, 1.0, 0.6, 0.02), M.panel, lm(0, 0.5, 0), { tile: 1, grain: 'y' });
  add(rbox(0.96, 0.03, 0.66, 0.008), M.tableWood, lm(0, 1.02, -0.02, -0.1), { tile: 1 });
  add(rbox(0.8, 0.06, 0.012, 0.004), M.green, lm(0, 0.88, 0.302), { cast: false });
  add(rbox(0.56, 0.36, 0.04, 0.01), M.screenBlack, lm(0.0, 1.17, -0.12, -0.55), { cast: false }); // Touchscreen
  add(rbox(0.3, 0.16, 0.012, 0.004), M.screenBlack, lm(-0.32, 1.08, 0.18, -1.0), { cast: false }); // Mediensteuerung
  add(cyl(0.006, 0.006, 0.36, 6), M.darkGrey, lm(0.36, 1.2, 0.12, -0.45, 0, 0), { cast: false });
  add(cyl(0.012, 0.009, 0.045, 8), M.black, lm(0.36, 1.36, 0.2, -0.45, 0, 0), { cast: false });
  add(rbox(0.06, 0.08, 0.03, 0.01), M.darkGrey, lm(0.44, 0.92, 0.31), { cast: false }); // Headset-Halter
  // Vortragstisch (lang, mittelbraun) mit Blende
  const TB = LY.TABLE;
  add(rbox(TB.w, 0.04, TB.d, 0.01), M.tableWood, mat(TB.x, P.h + TB.h - 0.02, TB.z), { tile: 1.2 });
  add(box(TB.w - 0.08, TB.h - 0.12, 0.025), M.tableWood, mat(TB.x, P.h + (TB.h - 0.12) / 2 + 0.06, TB.z + TB.d / 2 - 0.03), { tile: 1.2, grain: 'y' });
  for (const sx of [-1, 1]) add(rbox(0.05, TB.h - 0.04, TB.d - 0.06, 0.01), M.tableWood, mat(TB.x + sx * (TB.w / 2 - 0.05), P.h + (TB.h - 0.04) / 2, TB.z), { tile: 0.8, grain: 'y' });
  add(box(TB.w - 0.1, 0.02, TB.d - 0.1), M.tableWood, mat(TB.x, P.h + 0.18, TB.z), { tile: 1.2, cast: false });

  // Hybrid-Monitor zwischen den Fenstern
  const MO = LY.MONITOR;
  add(rbox(0.05, MO.h + 0.03, MO.w + 0.03, 0.01), M.black, mat(MO.x + 0.01, MO.y, MO.z), { cast: false });
  // Kamera mit Speakertracking (Rückwand)
  const CA = LY.CAMERA;
  add(rbox(0.14, 0.12, 0.18, 0.03), M.darkGrey, mat(CA.x, CA.y, CA.z - 0.05), { cast: false });
  add(cyl(0.035, 0.04, 0.06, 16), M.black, mat(CA.x, CA.y, CA.z - 0.16, Math.PI / 2, 0, 0), { cast: false });
  add(rbox(0.16, 0.03, 0.12, 0.01), M.darkGrey, mat(CA.x, CA.y + 0.08, CA.z + 0.02), { cast: false });
  const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), M.ledRed); camLed.position.set(CA.x + 0.05, CA.y + 0.035, CA.z - 0.142); scene.add(camLed);

  // ------------------------------------------------------------------ Türen (dunkles Holz, Kassetten, Zarge), Schilder
  const door = (x, z, rotY, floorY, w) => {
    const g = new THREE.Group(); g.position.set(x, floorY, z); g.rotation.y = rotY; scene.add(g); g.updateMatrixWorld();
    const dm = (a, b, cc, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().multiplyMatrices(g.matrixWorld, mat(a, b, cc, rx, ry, rz));
    add(rbox(w + 0.24, 2.42, 0.06, 0.01), M.bench, dm(0, 1.21, 0.0), { tile: 0.8, grain: 'y' }); // Verkleidung
    add(rbox(w, 2.25, 0.05, 0.008), M.panel, dm(0, 1.125, 0.035), { tile: 1, grain: 'y' });
    for (const yy of [0.6, 1.6]) add(rbox(w - 0.24, 0.7, 0.015, 0.006), M.bench, dm(0, yy, 0.062), { tile: 0.8, grain: 'y', cast: false });
    add(rbox(0.13, 0.025, 0.05, 0.01), M.brass, dm(-w / 2 + 0.12, 1.05, 0.09), { cast: false });
    add(rbox(0.05, 0.18, 0.012, 0.004), M.brass, dm(-w / 2 + 0.12, 1.0, 0.065), { cast: false });
    add(rbox(0.4, 0.06, 0.06, 0.01), M.darkGrey, dm(0, 2.16, 0.09), { cast: false }); // Türschließer
    add(cyl(0.008, 0.008, 0.34, 6), M.alu, dm(0.05, 2.13, 0.13, 0, 0, Math.PI / 2 - 0.25), { cast: false });
    return g;
  };
  const FD = LY.FRONT_DOOR, BKD = LY.BACK_DOOR;
  const frontDoor = door(FD.x - 0.03, FD.z, -Math.PI / 2, P.h, FD.w);
  const backDoor = door(BKD.x, BKD.z - 0.03, Math.PI, LY.BACK_FLOOR, BKD.w);
  const exitSigns = [[FD.x - 0.03, P.h + 2.62, FD.z, -Math.PI / 2], [BKD.x, LY.BACK_FLOOR + 2.4, BKD.z - 0.03, Math.PI]];
  // Lichtschalter, Feuerlöscher, Mülltrennung (Wien: Restmüll grau, Altpapier rot, Plastik gelb)
  add(rbox(0.012, 0.16, 0.24, 0.004), M.whitePlastic, mat(ROOM.x1 - 0.01, P.h + 1.1, FD.z + 0.8), { cast: false });
  for (let k = 0; k < 4; k++) add(box(0.008, 0.05, 0.04), M.whitePlastic, mat(ROOM.x1 - 0.018, P.h + 1.13 - (k % 2) * 0.06, FD.z + 0.74 + Math.floor(k / 2) * 0.12), { cast: false });
  add(cyl(0.07, 0.07, 0.5, 16), M.red, mat(ROOM.x0 + 0.12, P.h + 0.25, ROOM.z0 + 0.35), { tile: 0.4 });
  add(cyl(0.028, 0.035, 0.06, 10), M.black, mat(ROOM.x0 + 0.12, P.h + 0.53, ROOM.z0 + 0.35), { cast: false });
  // ein Material mit Vertexfarben für alle drei Behälter (ein Draw Call statt drei, auch in jeder Schattenkaskade)
  const binMat = gfx.pbr({ name: 'bins', recipe: 'plastic', color: 0xffffff, vertexColors: true, texOpts: { c1: '#ffffff', size: 256, seed: 1 } });
  [[0x6a6d70, 0], [0xc0392b, 0.4], [0xe2b400, 0.8]].forEach(([col, off]) => {
    add(rbox(0.34, 0.6, 0.34, 0.04), binMat, mat(ROOM.x1 - 0.3, P.h + 0.3, -4.3 + off), { tile: 0.4, color: col });
    add(rbox(0.36, 0.03, 0.36, 0.015), M.darkGrey, mat(ROOM.x1 - 0.3, P.h + 0.615, -4.3 + off), { cast: false });
  });
  // Garderobe hinten
  for (let x = -4.3; x < 2.9; x += 0.42) add(cyl(0.011, 0.011, 0.09, 8), M.brass, mat(x, LY.BACK_FLOOR + 1.72, ROOM.z1 - 0.06, Math.PI / 2 - 0.4, 0, 0), { cast: false });
  add(rbox(7.3, 0.07, 0.03, 0.01), M.bench, mat(-0.7, LY.BACK_FLOOR + 1.72, ROOM.z1 - 0.025), { tile: 1 });

  const meshes = B.build(scene, 'hall');
  return { M, meshes, windowGlass, ledPanels, exitSigns, frontDoor, backDoor, lectern, camLed, seatList: LY.allSeats() };
}

/** Seitenwange einer Pultbank (Profil in z/y, Stärke 5 cm in x) */
function sideProfile(f, prevF, z0) {
  const s = new THREE.Shape();
  const D = LY.ROW_DEPTH, top = f + LY.DESK_H + 0.06;
  s.moveTo(z0, prevF);
  s.lineTo(z0, top - 0.05);
  s.quadraticCurveTo(z0, top, z0 + 0.05, top);
  s.lineTo(z0 + 0.1, top);
  s.lineTo(z0 + LY.DESK_D + 0.02, f + LY.DESK_H - 0.06);
  s.quadraticCurveTo(z0 + LY.DESK_D + 0.08, f + LY.DESK_H - 0.25, z0 + LY.DESK_D + 0.03, f + LY.SEAT_H + 0.12);
  s.lineTo(z0 + LY.DESK_D + 0.03, f + LY.SEAT_H + 0.02);
  s.lineTo(z0 + D - 0.02, f + LY.SEAT_H + 0.02);
  s.quadraticCurveTo(z0 + D, f + LY.SEAT_H + 0.02, z0 + D, f + LY.SEAT_H - 0.06);
  s.lineTo(z0 + D, f);
  s.lineTo(z0 + 0.05, f);
  s.lineTo(z0 + 0.05, prevF);
  s.lineTo(z0, prevF);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 6 });
  // Shape-x → Welt-z, Extrusion (z) → Welt −x  (rotateY(−90°): x' = −z, z' = x)
  g.rotateY(-Math.PI / 2);
  return g;
}

function mergeAll(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); for (const i of g.index.array) idx.push(i + o); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setIndex(idx);
  return out;
}
