// Sichtmodell: echter Sichtkegel (fovea ~10°, Peripherie bis ~60°), Sichtlinie mit Verdeckung
// durch Studierende, Pultfronten, Vortragstisch und Pult (Raycasts auf vereinfachte Stellvertreter-Körper).
import * as THREE from 'three';
import * as LY from '../scene/layout.js';
import { clamp, smoothstep } from '../core/util.js';

export const VISION = {
  fovea: THREE.MathUtils.degToRad(5),      // halber Öffnungswinkel des fovealen Kegels (10° gesamt)
  periphery: THREE.MathUtils.degToRad(60),
  peripheryFloor: 0.08,                    // Restempfindlichkeit am Rand
  nearDist: 3, farDist: 14
};

export class Vision {
  constructor(population) {
    this.group = new THREE.Group();
    this.raycaster = new THREE.Raycaster();
    this.proxies = [];
    const mat = new THREE.MeshBasicMaterial();
    const addBox = (w, h, d, x, y, z, tag) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.userData.tag = tag;
      m.updateMatrixWorld(true); this.group.add(m); this.proxies.push(m); return m;
    };
    // Studierende (sitzend): Kopf + Oberkörper
    this.studentProxies = new Map();
    for (const s of population.students) {
      const f = s.seat.floor, x = s.seat.x, z = s.seat.z;
      const head = addBox(0.2, 0.26, 0.22, x, f + 1.22, z - 0.02, 'head:' + s.id);
      const torso = addBox(0.4, 0.55, 0.26, x, f + 0.78, z, 'torso:' + s.id);
      this.studentProxies.set(s.id, [head, torso]);
    }
    // Pultfronten (bis Oberkante Ablage) – verdecken Unterkörper, Hände, Laptop-Unterteil
    for (let i = 0; i < LY.ROWS; i++) {
      const prevF = i === 0 ? 0 : LY.rowFloor(i - 1), top = LY.rowFloor(i) + LY.DESK_H + 0.05;
      addBox(LY.BLOCK.x1 - LY.BLOCK.x0, top - prevF, 0.04, (LY.BLOCK.x0 + LY.BLOCK.x1) / 2, (top + prevF) / 2, LY.rowFront(i) + 0.015, 'panel:' + i);
    }
    const T = LY.TABLE; addBox(T.w, T.h, T.d, T.x, LY.PODIUM.h + T.h / 2, T.z, 'table');
    const L = LY.LECTERN; addBox(0.9, 1.1, 0.6, L.x, LY.PODIUM.h + 0.55, L.z, 'lectern');
    this.group.updateMatrixWorld(true);
    this._dir = new THREE.Vector3(); this._to = new THREE.Vector3();
  }
  /** Stellvertreter eines Studis aus-/einblenden (aufgestanden, gegangen) */
  setStudentPresent(id, present, pos) {
    const p = this.studentProxies.get(id); if (!p) return;
    for (const m of p) { m.visible = present; }
    if (pos) { p[0].position.set(pos.x, pos.y + 1.6, pos.z); p[1].position.set(pos.x, pos.y + 1.1, pos.z); p[0].updateMatrixWorld(); p[1].updateMatrixWorld(); }
  }
  /** Winkelgewichtung im Kegel: 1 in der Fovea, fällt bis zur Peripherie ab */
  coneWeight(angle) {
    if (angle <= VISION.fovea) return 1;
    if (angle >= VISION.periphery) return 0;
    const t = (angle - VISION.fovea) / (VISION.periphery - VISION.fovea);
    return Math.max(VISION.peripheryFloor * (1 - t), Math.pow(1 - t, 1.6));
  }
  /** Ist der Punkt p vom Auge e aus frei sichtbar (Bruchteil 0/1)? ignore = Set von Tags */
  lineOfSight(e, p, ignore) {
    const dir = this._dir.subVectors(p, e); const dist = dir.length(); dir.divideScalar(dist);
    this.raycaster.set(e, dir); this.raycaster.far = dist - 0.05; this.raycaster.near = 0.05;
    const hits = this.raycaster.intersectObjects(this.proxies, false);
    for (const h of hits) { if (!h.object.visible) continue; if (ignore && ignore.has(h.object.userData.tag)) continue; return false; }
    return true;
  }
  /**
   * Sichtbarkeit eines Ziels: points = [{p: Vector3, w: Gewicht}], ignore = eigene Stellvertreter-Tags.
   * Liefert { vis (0–1), fovea (0–1), angle (rad, zum Kopf), dist, los (Anteil) }
   */
  assess(eye, gaze, points, ignore) {
    let wsum = 0, losSum = 0, best = Math.PI;
    for (const pt of points) {
      const ok = this.lineOfSight(eye, pt.p, ignore);
      wsum += pt.w; if (ok) losSum += pt.w;
    }
    const head = points[0].p;
    const to = this._to.subVectors(head, eye); const dist = to.length(); to.divideScalar(dist);
    best = Math.acos(clamp(to.dot(gaze), -1, 1));
    const cone = this.coneWeight(best);
    const los = wsum ? losSum / wsum : 0;
    const distF = 1.15 - smoothstep(VISION.nearDist, VISION.farDist, dist) * 0.55;
    return { vis: cone * los * distF, fovea: best <= VISION.fovea * 2 ? los * distF : 0, angle: best, dist, los, cone };
  }
}
