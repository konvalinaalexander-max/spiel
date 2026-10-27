// Logischer Körper und Blick des Profs (ohne Rendering). Bewegung mit Wegplanung um Tisch/Pult,
// Körperausrichtung, Kopf-/Blicksteuerung, Blickmuster (Scannen, Fixationen, Schulterblick an der Tafel, Bluff).
import * as THREE from 'three';
import * as LY from '../scene/layout.js';
import { clamp, damp, angleDamp, wrapAngle, makeRng } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const EYE_H = 1.72;

/** Tuning (kann je Schwierigkeit überschrieben werden) */
export const PROF_TUNING = {
  walkSpeed: 1.05, stairSpeed: 0.7, turnRate: 3.2, headRate: 5.5,
  fixation: [0.7, 2.2], playerFixChance: 0.12, motionAttraction: 0.55,
  shoulderEvery: [10, 25], shoulderDur: [0.8, 1.5], telegraph: 0.45, bluffChance: 0.22,
  lecternGlanceEvery: [4, 9], screenGlanceEvery: [3, 7]
};

function segHitsRect(a, b, r) {
  // Liang–Barsky gegen achsparalleles Rechteck (x0,x1,z0,z1)
  let t0 = 0, t1 = 1; const dx = b.x - a.x, dz = b.z - a.z;
  const p = [-dx, dx, -dz, dz], q = [a.x - r.x0, r.x1 - a.x, a.z - r.z0, r.z1 - a.z];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
  }
  return t0 < t1;
}

export class ProfLogic {
  constructor(seed = 7, tuning = {}) {
    this.T = { ...PROF_TUNING, ...tuning };
    this.rng = makeRng(seed);
    const s = LY.SPOTS.lectern;
    this.pos = V(LY.FRONT_DOOR.x - 0.6, LY.PODIUM.h, LY.FRONT_DOOR.z); // betritt den Saal durch die Vordertür
    this.yaw = -Math.PI / 2; this.headYaw = 0; this.headPitch = 0;
    this.targetYaw = this.yaw;
    this.path = []; this.speed = 0; this.walking = false;
    this.activity = 'idle'; this.face = { mode: 'class', point: null };
    this.gaze = { mode: 'scan', point: V(LY.CLASS_CENTER.x, LY.CLASS_CENTER.y, LY.CLASS_CENTER.z), fixT: 0, override: null, overrideT: 0 };
    this.shoulder = { next: this._r(this.T.shoulderEvery), phase: 0, t: 0, bluff: false, side: 1 };
    this.glanceT = 2; this.glancing = false;
    this.talking = false; this.gesture = 'none';
    this.focusPlayer = 0;     // >0: auffällig aufmerksam (nach 2. Verwarnung)
    this.tolerance = 0;       // Sympathie nach richtigen Antworten
    this.player = null;       // { head: Vector3, motion: 0–1 } – wird von der Session gesetzt
    this.scanTargets = [];    // Weltpunkte (Köpfe der Studierenden)
    this.writePen = null;     // Weltpunkt des Kreidestrichs (oder null)
    this.penOverride = null;  // echte Stiftposition aus der Darstellung (falls vorhanden)
    this.events = [];         // ausgehende Ereignisse ('chalkStop', 'shoulder', 'turned', 'arrive')
    this._tmp = V();
  }
  _r([a, b]) { return a + this.rng.next() * (b - a); }
  emit(type, data) { this.events.push({ type, data }); }
  eye(out = V()) { return out.set(this.pos.x + Math.sin(this.yaw) * 0.08, this.pos.y + EYE_H, this.pos.z + Math.cos(this.yaw) * 0.08); }
  /** Blickrichtung (Weltvektor) aus Körper + Kopf */
  gazeDir(out = V()) {
    const y = this.yaw + this.headYaw, p = this.headPitch;
    return out.set(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
  }
  // ------------------------------------------------------------------ Befehle
  /** Gehe zu Spot-Name oder {x,z}. Danach Blick-/Körpermodus `then` ('class'|'board'|'screen'|'window'|'lectern'). */
  goTo(target, then = 'class') {
    const t = typeof target === 'string' ? LY.SPOTS[target] : target;
    const goal = V(t.x, 0, t.z);
    goal.y = LY.floorAt(goal.x, goal.z);
    this.path = this._plan(this.pos, goal);
    this.walking = this.path.length > 0;
    this.after = then;
    if (!this.walking) this.setFace(then);
    this.activity = this.walking ? 'walk' : this.activity;
    return this.path.reduce((s, p, i) => s + (i ? p.distanceTo(this.path[i - 1]) : p.distanceTo(this.pos)), 0) / this.T.walkSpeed;
  }
  distanceTo(spot) { const t = typeof spot === 'string' ? LY.SPOTS[spot] : spot; return Math.hypot(t.x - this.pos.x, t.z - this.pos.z); }
  setFace(mode, point = null) {
    this.face = { mode, point };
    if (mode === 'board') this.activity = this.activity === 'write' ? 'write' : 'board';
    else if (mode === 'screen') this.activity = 'point';
    else if (mode === 'lectern') this.activity = 'lectern';
    else if (mode === 'class') this.activity = this.activity === 'aisle' ? 'aisle' : 'explain';
    this.emit('face', mode);
  }
  /** Blick kurzzeitig fixieren (z. B. auf Fragesteller:in oder den Spieler) */
  lookAt(point, dur = 2.0, tag = 'target') { this.gaze.override = point.clone(); this.gaze.overrideT = dur; this.gaze.overrideTag = tag; }
  lookPlayer(dur = 2.0) { if (this.player) this.lookAt(this.player.head, dur, 'player'); }
  setWriting(on) {
    if (on) { this.activity = 'write'; this.face = { mode: 'board', point: null }; this.shoulder.next = this._r(this.T.shoulderEvery) * 0.6; }
    else if (this.activity === 'write') { this.activity = 'board'; }
  }
  // ------------------------------------------------------------------ Wegplanung (Sichtgraph über Hindernis-Ecken)
  _plan(from, to) {
    const obs = LY.OBSTACLES;
    const nodes = [V(from.x, 0, from.z), V(to.x, 0, to.z)];
    for (const r of obs) for (const [x, z] of [[r.x0 - 0.05, r.z0 - 0.05], [r.x1 + 0.05, r.z0 - 0.05], [r.x0 - 0.05, r.z1 + 0.05], [r.x1 + 0.05, r.z1 + 0.05]]) {
      if (z > LY.ROOM.z0 + 0.3 && x > LY.ROOM.x0 + 0.3 && x < LY.ROOM.x1 - 0.3) nodes.push(V(x, 0, z));
    }
    const free = (a, b) => !obs.some(r => segHitsRect(a, b, r));
    // Dijkstra
    const n = nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    dist[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1; for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || dist[u] === Infinity) break; done[u] = true; if (u === 1) break;
      for (let v = 0; v < n; v++) if (!done[v] && v !== u && free(nodes[u], nodes[v])) { const d = dist[u] + nodes[u].distanceTo(nodes[v]); if (d < dist[v]) { dist[v] = d; prev[v] = u; } }
    }
    const out = []; let c = 1;
    if (prev[1] < 0 && !free(nodes[0], nodes[1])) return [V(to.x, LY.floorAt(to.x, to.z), to.z)];
    while (c > 0) { out.unshift(nodes[c]); c = prev[c]; if (c < 0) break; }
    for (const p of out) p.y = LY.floorAt(p.x, p.z);
    if (out.length && out[out.length - 1].distanceTo(from) < 0.05) return [];
    return out;
  }
  /** Weg durch den rechten Stufengang bis Reihe `row` (Ereignis "Prof geht in die Reihen") */
  planAisle(row) {
    const ax = (LY.AISLES[1].x0 + LY.AISLES[1].x1) / 2;
    const p = [V(2.9, 0, -4.05), V(ax, 0, LY.ROW0_Z - 0.35), V(ax, 0, LY.rowFront(row) + 0.45)];
    const head = this._plan(this.pos, p[0]);
    this.path = [...head, ...p.slice(0)].map(v => { v.y = LY.floorAt(v.x, v.z); return v; });
    this.walking = true; this.activity = 'aisle'; this.after = 'class';
  }
  // ------------------------------------------------------------------ Update
  update(dt) {
    const T = this.T;
    // Gehen
    if (this.walking && this.path.length) {
      const tgt = this.path[0];
      const d = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z);
      const onStairs = this.pos.z > LY.FRONT_PASSAGE.z0 && this.pos.z < LY.BACK_Z && Math.abs(this.pos.x) > 3;
      const sp = onStairs ? T.stairSpeed : T.walkSpeed;
      this.speed = damp(this.speed, sp, 4, dt);
      if (d < 0.08) { this.path.shift(); if (!this.path.length) { this.walking = false; this.speed = 0; this.setFace(this.after || 'class'); this.emit('arrive', this.after); } }
      else {
        const step = Math.min(d, this.speed * dt);
        this.pos.x += (tgt.x - this.pos.x) / d * step; this.pos.z += (tgt.z - this.pos.z) / d * step;
        this.targetYaw = Math.atan2(tgt.x - this.pos.x, tgt.z - this.pos.z);
      }
      this.pos.y = damp(this.pos.y, LY.floorAt(this.pos.x, this.pos.z), 12, dt);
    } else {
      this.speed = damp(this.speed, 0, 6, dt);
      this.targetYaw = this._faceYaw();
    }
    // beim Schreiben wandert der Körper mit dem Kreidestrich die Tafel entlang
    const pen = this.penOverride || this.writePen;
    if (this.activity === 'write' && pen && !this.walking) {
      const tx = clamp(pen.x + 0.38, LY.BOARD.x - LY.BOARD.w / 2 + 0.25, LY.BOARD.x + LY.BOARD.w / 2 + 0.3);
      this.pos.x = damp(this.pos.x, tx, 1.4, dt);
    }
    // Körperdrehung (beim Schulterblick dreht der Oberkörper mit)
    const twist = this.shoulder.phase >= 1 && this.shoulder.phase <= 2 ? this.shoulder.side * (this.shoulder.phase === 2 ? 0.55 : 0.25) : 0;
    const dy = wrapAngle(this.targetYaw + twist - this.yaw);
    this.yaw += clamp(dy, -T.turnRate * dt, T.turnRate * dt) * (Math.abs(dy) > 0.02 ? 1 : 0.5);
    this.yaw = wrapAngle(this.yaw);
    // Schulterblick beim Schreiben
    this._updateShoulder(dt);
    // Blickziel bestimmen
    const target = this._gazeTarget(dt);
    const e = this.eye(this._tmp);
    const dx = target.x - e.x, dz = target.z - e.z, dyv = target.y - e.y;
    let wantYaw = wrapAngle(Math.atan2(dx, dz) - this.yaw);
    const wantPitch = Math.atan2(dyv, Math.hypot(dx, dz));
    const lim = this.activity === 'write' && this.shoulder.phase === 2 ? 1.45 : 1.25;
    wantYaw = clamp(wantYaw, -lim, lim);
    this.headYaw = angleDamp(this.headYaw, wantYaw, T.headRate, dt);
    this.headPitch = damp(this.headPitch, clamp(wantPitch, -0.8, 0.55), T.headRate, dt);
    // Körper folgt dem Kopf, wenn er stehend lange stark verdreht schaut (Scannen der Klasse)
    if (!this.walking && this.face.mode === 'class' && Math.abs(this.headYaw) > 0.7) this.targetYawBias = (this.targetYawBias || 0) + Math.sign(this.headYaw) * dt * 0.4;
    else this.targetYawBias = damp(this.targetYawBias || 0, 0, 1.5, dt);
    if (this.focusPlayer > 0) this.focusPlayer -= dt;
  }
  _faceYaw() {
    const p = this.pos; const f = this.face;
    switch (f.mode) {
      case 'board': return Math.PI;
      case 'screen': return Math.atan2(LY.SCREEN.x - p.x, LY.SCREEN.z - p.z);
      case 'window': return -Math.PI / 2 - 0.3;
      case 'lectern': return LY.LECTERN.yaw + Math.PI * 0 + 0;
      case 'point': return f.point ? Math.atan2(f.point.x - p.x, f.point.z - p.z) : 0;
      default: { const c = LY.CLASS_CENTER; return Math.atan2(c.x - p.x, c.z - p.z) + clamp(this.targetYawBias || 0, -0.6, 0.6); }
    }
  }
  _updateShoulder(dt) {
    const s = this.shoulder;
    if (this.activity !== 'write') { s.phase = 0; return; }
    s.t += dt;
    if (s.phase === 0) {
      s.next -= dt;
      if (s.next <= 0) { s.phase = 1; s.t = 0; s.bluff = this.rng.chance(this.T.bluffChance); s.side = this.rng.chance(0.5) ? 1 : -1; this.emit('chalkStop', { bluff: s.bluff }); }
    } else if (s.phase === 1 && s.t > this.T.telegraph) {
      if (s.bluff) { s.phase = 3; s.t = 0; this.emit('bluff'); }
      else { s.phase = 2; s.t = 0; s.dur = this._r(this.T.shoulderDur); this.emit('shoulder', { side: s.side }); }
    } else if (s.phase === 2 && s.t > s.dur) { s.phase = 3; s.t = 0; }
    else if (s.phase === 3 && s.t > 0.35) { s.phase = 0; s.next = this._r(this.T.shoulderEvery) * (this.focusPlayer > 0 ? 0.55 : 1); this.emit('chalkResume'); }
  }
  _gazeTarget(dt) {
    const g = this.gaze, e = this.eye(V());
    if (g.overrideT > 0) { g.overrideT -= dt; if (g.overrideTag === 'player' && this.player) g.override.copy(this.player.head); return g.override; }
    // Schreiben: auf den Kreidestrich, beim Schulterblick über die Schulter in die Klasse
    if (this.activity === 'write' || this.face.mode === 'board') {
      if (this.shoulder.phase === 2) {
        // über die Schulter: Richtung Klasse auf der gewählten Seite
        if (!g.shoulderPt || g.shoulderSide !== this.shoulder.side) { g.shoulderSide = this.shoulder.side; g.shoulderPt = this._pickScan(this.shoulder.side); }
        return g.shoulderPt;
      }
      g.shoulderPt = null;
      return this.penOverride || this.writePen || V(LY.BOARD.x, LY.BOARD.lowY + 0.6, LY.ROOM.z0);
    }
    if (this.face.mode === 'lectern') {
      this.glanceT -= dt;
      if (this.glanceT <= 0) { this.glancing = !this.glancing; this.glanceT = this.glancing ? this._r([1.0, 2.2]) : this._r(this.T.lecternGlanceEvery); if (this.glancing) g.point = this._pickScan(); }
      return this.glancing ? g.point : V(LY.LECTERN.x - 0.05, LY.PODIUM.h + 1.05, LY.LECTERN.z - 0.1);
    }
    if (this.face.mode === 'screen') {
      this.glanceT -= dt;
      if (this.glanceT <= 0) { this.glancing = !this.glancing; this.glanceT = this.glancing ? this._r([0.8, 1.8]) : this._r(this.T.screenGlanceEvery); if (this.glancing) g.point = this._pickScan(); }
      return this.glancing ? g.point : V(LY.SCREEN.x + (this.rng.next() - 0.5) * 0.02, LY.SCREEN.y, LY.SCREEN.z);
    }
    if (this.face.mode === 'window') return V(LY.ROOM.x0 - 6, 2.4, -2);
    // Scannen der Klasse: Fixationen auf Studierende/Zonen, Bewegung zieht Blicke an
    g.fixT -= dt;
    const pl = this.player;
    if (pl && pl.motion > 0.35 && this.walking === false && this.rng.chance(dt * this.T.motionAttraction * pl.motion * 2)) {
      const ang = this._angleTo(pl.head);
      if (ang < 1.05) { g.point = pl.head.clone(); g.fixT = this._r([0.9, 1.8]); g.onPlayer = true; }
    }
    if (g.fixT <= 0) {
      g.fixT = this._r(this.T.fixation);
      const stick = pl ? pl.stick || 0 : 0;
      const pFix = this.T.playerFixChance * (this.focusPlayer > 0 ? 3.5 : 1) * (1 - Math.min(0.6, this.tolerance * 0.15)) + (pl ? pl.suspicionPull || 0 : 0) + stick * 0.35;
      // bleibt hängen, wenn ihm etwas aufgefallen ist
      if (pl && g.onPlayer && this.rng.chance(stick)) { g.fixT *= 0.8; }
      else if (pl && this.rng.chance(pFix)) { g.point = pl.head.clone(); g.onPlayer = true; }
      else { g.point = this._pickScan(); g.onPlayer = false; }
    }
    if (g.onPlayer && pl) g.point.copy(pl.head);
    return g.point;
  }
  _angleTo(p) { const e = this.eye(V()); const d = V().subVectors(p, e).normalize(); return Math.acos(clamp(d.dot(this.gazeDir(V())), -1, 1)); }
  /** zufälliges Scan-Ziel (Kopf eines Studis bzw. Zone), optional nur eine Seite */
  _pickScan(side = 0) {
    const list = this.scanTargets;
    if (!list.length) return V(this.rng.range(-3, 3), 1.6, this.rng.range(-2, 4));
    for (let i = 0; i < 6; i++) {
      const p = this.rng.pick(list);
      if (!side || Math.sign(p.x - this.pos.x) === side || i === 5) return p.clone().add(V(this.rng.range(-0.3, 0.3), 0, 0));
    }
    return this.rng.pick(list).clone();
  }
  /** Blick dreht sich gerade / ist auf die Klasse gerichtet? (für Gegner, Nachbarin, Bot) */
  lookingAtClass() { return Math.cos(this.yaw + this.headYaw) > 0.2; }
  drainEvents() { const e = this.events; this.events = []; return e; }
}
