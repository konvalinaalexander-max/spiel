// Maße des Hörsaals, nach Vorbild MENH Hörsaal 31 (XV) im Gregor-Mendel-Haus (siehe docs/recherche/boku.md, Kap. 8.2).
// Blickrichtung der Studierenden: −z. Links (−x) die Fensterwand, rechts (+x) die Holzvertäfelung.
// 10 Reihen à 11 Plätze, Reihenabstand 0,80 m, Stufe 0,14 m, Pultbänke mit durchgehender Holzbank.

export const ROOM = { x0: -4.6, x1: 4.6, z0: -6.0, z1: 6.0, h: 4.0 };
export const PODIUM = { z1: -3.8, h: 0.15 };     // Podest vorne, 2,2 m tief, eine Stufe
export const FRONT_PASSAGE = { z0: -3.8, z1: -3.0 };
export const ROW0_Z = -3.0;
export const ROWS = 10;
export const ROW_DEPTH = 0.80;
export const ROW_RISE = 0.14;
export const SEAT_PITCH = 0.60;
export const SEATS = 11;
export const DESK_H = 0.76, DESK_D = 0.35, SEAT_H = 0.45, SEAT_D = 0.40;
export const BLOCK = { x0: -3.4, x1: 3.2 };
export const AISLES = [{ x0: ROOM.x0 + 0.2, x1: BLOCK.x0, side: 'L' }, { x0: BLOCK.x1, x1: ROOM.x1 - 0.2, side: 'R' }];
export const BACK_Z = ROW0_Z + ROWS * ROW_DEPTH;    // 5,0
export const rowFront = i => ROW0_Z + i * ROW_DEPTH;
export const rowFloor = i => i * ROW_RISE;
export const BACK_FLOOR = rowFloor(ROWS);           // 1,40
export const seatX = k => BLOCK.x0 + 0.3 + k * SEAT_PITCH;
export const seatZ = i => rowFront(i) + 0.58;       // Mitte der Sitzfläche
export const deskZ = i => rowFront(i) + DESK_D / 2;  // Mitte der Pultplatte

// Front
export const BOARD = { x: -2.2, w: 4.0, panelH: 1.2, lowY: PODIUM.h + 0.9, highY: PODIUM.h + 2.2, zFront: ROOM.z0 + 0.08, zBack: ROOM.z0 + 0.045 };
export const SCREEN = { x: 2.45, y: PODIUM.h + 2.42, w: 3.6, h: 2.25, z: ROOM.z0 + 0.14 };   // 16:10, motorisch
export const PROJECTOR = { x: 2.45, y: 3.78, z: ROOM.z0 + 4.0 };
export const LECTERN = { x: 3.65, z: -4.55, yaw: -0.42 };
export const TABLE = { x: -0.2, z: -4.85, w: 5.0, d: 0.8, h: 0.9 };
export const FRONT_DOOR = { x: ROOM.x1, z: -5.15, w: 1.0, h: 2.25 };
export const BACK_DOOR = { x: 3.75, z: ROOM.z1, w: 1.0, h: 2.2 };
export const WINDOWS = { x: ROOM.x0, y0: 1.15, y1: 3.72, list: [-4.45, -1.15, 2.15], w: 1.8 };
export const MONITOR = { x: ROOM.x0 + 0.06, y: 2.25, z: -2.8, w: 1.43, h: 0.81 };
export const CLOCK = { x: 0.22, y: 3.45, z: ROOM.z0 + 0.05 };
export const CAMERA = { x: 0.2, y: 3.35, z: ROOM.z1 - 0.12 };

// Prof-Standorte (Podest, y = PODIUM.h)
export const SPOTS = {
  lectern: { x: 3.5, z: -5.15, face: 'class' },
  boardL: { x: -3.3, z: -5.45, face: 'board' },
  boardC: { x: -2.2, z: -5.45, face: 'board' },
  boardR: { x: -1.1, z: -5.45, face: 'board' },
  screen: { x: 0.35, z: -5.35, face: 'screen' },
  table: { x: -0.2, z: -5.45, face: 'class' },
  front: { x: 0.2, z: -4.05, face: 'class' },
  frontL: { x: -2.9, z: -4.05, face: 'class' },
  frontR: { x: 2.6, z: -4.0, face: 'class' },
  window: { x: -3.7, z: -4.6, face: 'window' }
};
export const CLASS_CENTER = { x: -0.1, y: 1.6, z: 0.8 };

/** Bodenhöhe an (x,z) */
export function floorAt(x, z) {
  if (z < PODIUM.z1) return PODIUM.h;
  if (z < ROW0_Z) return 0;
  if (z >= BACK_Z) return BACK_FLOOR;
  const i = Math.floor((z - ROW0_Z) / ROW_DEPTH);
  return rowFloor(i);
}
/** Liegt (x,z) im Fußraum einer Reihe (zwischen Pult und Bank)? */
export const inAisle = x => AISLES.some(a => x >= a.x0 && x <= a.x1);

export function allSeats() {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let k = 0; k < SEATS; k++) out.push({ id: `${r}-${k}`, row: r, k, x: seatX(k), z: seatZ(r), floor: rowFloor(r), deskZ: deskZ(r) });
  return out;
}
export const nearestAisleX = x => (x < (BLOCK.x0 + BLOCK.x1) / 2 ? (AISLES[0].x0 + AISLES[0].x1) / 2 : (AISLES[1].x0 + AISLES[1].x1) / 2);
export const EYE_SEATED = 1.2;
/** Tischkante (Podest) als Hindernis für Wege des Profs */
export const OBSTACLES = [{ x0: TABLE.x - TABLE.w / 2 - 0.25, x1: TABLE.x + TABLE.w / 2 + 0.25, z0: TABLE.z - TABLE.d / 2 - 0.25, z1: TABLE.z + TABLE.d / 2 + 0.25 }, { x0: LECTERN.x - 0.6, x1: LECTERN.x + 0.6, z0: LECTERN.z - 0.45, z1: LECTERN.z + 0.45 }];
