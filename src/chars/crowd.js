// Studierende im Saal: Figuren aus dem Besetzungsplan, Verhaltensprofile, Reaktionen auf Ereignisse,
// Spätkommer:in, Pause (Aufstehen/Hinausgehen), Tutorin.
import * as THREE from 'three';
import { buildCharacter } from './rig.js';
import { Character } from './character.js';
import { TUTOR_SPEC } from '../game/population.js';
import * as LY from '../scene/layout.js';
import { makeRng, damp, clamp } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DOWN_FWD = yaw => V(-Math.sin(yaw) * 0, -0.35, 0).add(V(Math.sin(yaw), 0, Math.cos(yaw))).normalize();

export class Crowd {
  constructor(gfx, mat, plan, opts = {}) {
    this.gfx = gfx; this.plan = plan; this.opts = opts;
    this.rng = makeRng(99);
    this.list = [];
    this.byId = new Map();
    this.t = 0;
    this.sfx = opts.sfx || (() => {});
    for (const s of plan.students) this._add(s, mat);
    // Spätkommer:in (zunächst draußen)
    this.late = this._add(plan.latecomer, mat, true);
    // Tutorin
    const tr = buildCharacter(TUTOR_SPEC, mat);
    this.tutor = new Character(tr, { floorAt: LY.floorAt, seed: 314 });
    gfx.scene.add(tr.mesh); tr.mesh.visible = false; this.tutor.visible = false;
    this.tutor.placeAt(LY.BACK_DOOR.x, LY.BACK_DOOR.z - 0.4, Math.PI);
    this.focus = { prof: V(0, 1.8, -5), screen: V(LY.SCREEN.x, LY.SCREEN.y, LY.SCREEN.z), board: V(LY.BOARD.x, LY.BOARD.lowY + 0.6, LY.ROOM.z0), player: V() };
  }
  _add(s, mat, outside = false) {
    const rig = buildCharacter(s.spec, mat);
    const c = new Character(rig, { floorAt: LY.floorAt, seed: s.seed });
    this.gfx.scene.add(rig.mesh);
    rig.mesh.castShadow = !!this.opts.shadows;
    const st = { s, c, rig, state: 'idle', t: this.rng.range(0, 6), look: 'prof', lookT: this.rng.range(1, 5), react: null, handUp: false, leaving: null, phase: s.phase || 0, writeT: 0, drinkT: this.rng.range(8, 30), whisperT: this.rng.range(15, 40), present: !outside, lod: 0 };
    if (!outside) this._sit(st);
    else { rig.mesh.visible = false; c.visible = false; }
    this.list.push(st); this.byId.set(s.id, st);
    return st;
  }
  _seatPose(seat) { return { pos: V(seat.x, seat.floor, seat.z - 0.04), yaw: Math.PI, seatH: LY.SEAT_H + 0.02 }; }
  _sit(st, instant = true) { st.c.sitOn(this._seatPose(st.s.seat), instant); }
  // ------------------------------------------------------------------ Ereignisse
  /** Alle (oder ein Anteil) schauen kurz zu einem Punkt, mit individueller Verzögerung */
  lookAll(point, dur = 2.5, share = 0.85, exclude = null) {
    for (const st of this.list) {
      if (!st.present || st === exclude || st.s.profile === 'sleeper' && this.rng.chance(0.7)) continue;
      if (!this.rng.chance(share)) continue;
      st.react = { point: point.clone(), t: -this.rng.range(0.1, 0.7), dur: dur * this.rng.range(0.7, 1.2) };
    }
  }
  handRaise(id, on) { const st = this.byId.get(id); if (st) st.handUp = on; }
  /** Pause: einige stehen auf / gehen hinaus */
  breakStart(leavers) {
    for (const st of this.list) {
      if (!st.present) continue;
      if (leavers.includes(st.s.id)) { st.leaving = { stage: 'stand', t: this.rng.range(0, 4) }; }
      else if (this.rng.chance(0.28)) { st.stretch = this.rng.range(2, 6); }
    }
  }
  breakEnd() { for (const st of this.list) if (st.leaving) st.leaving.returning = true; }
  latecomerEnter() { const st = this.late; st.present = true; st.rig.mesh.visible = true; st.c.visible = true; st.c.mode = 'stand'; st.c.sitBlend = 0; st.c.placeAt(LY.BACK_DOOR.x, LY.BACK_DOOR.z - 0.35, Math.PI); st.walk = this._pathToSeat(st.s.seat); st.c.standUp(); }
  studentLeave(id) { const st = this.byId.get(id); if (st && st.present) st.leaving = { stage: 'stand', t: 0, forever: true }; }
  tutorShow(on) { this.tutor.visible = on; this.tutor.rig.mesh.visible = on; }
  _pathToSeat(seat) {
    const ax = LY.nearestAisleX(seat.x);
    const pts = [V(LY.BACK_DOOR.x, 0, LY.ROOM.z1 - 0.5), V(ax, 0, LY.ROOM.z1 - 0.5), V(ax, 0, LY.rowFront(seat.row) + 0.6), V(seat.x, 0, LY.rowFront(seat.row) + 0.6)];
    return { pts, i: 0 };
  }
  _pathOut(seat) {
    const ax = LY.nearestAisleX(seat.x);
    return { pts: [V(ax, 0, LY.rowFront(seat.row) + 0.6), V(ax, 0, LY.ROOM.z1 - 0.5), V(LY.BACK_DOOR.x, 0, LY.ROOM.z1 - 0.3)], i: 0 };
  }
  // ------------------------------------------------------------------ Update
  /**
   * ctx: { profHead, playerHead, playerPos, oppTyping, oppWaiting, laptopAt(id) → Vector3 }
   */
  update(dt, t, ctx) {
    this.t += dt;
    this.focus.prof.copy(ctx.profHead); this.focus.player.copy(ctx.playerHead);
    const camPos = ctx.camPos;
    for (const st of this.list) {
      if (!st.c.visible) continue;
      // LOD: weit entfernte/verdeckte Figuren seltener aktualisieren
      st.lod += dt;
      const far = camPos && st.c.pos.distanceToSquared(camPos) > 49;
      const interval = far ? 1 / 20 : 0;
      if (st.lod < interval) continue;
      const ddt = st.lod; st.lod = 0;
      this._behave(st, ddt, t, ctx);
      st.c.update(ddt, t);
    }
    if (this.tutor.visible) { this._tutor(dt, t, ctx); this.tutor.update(dt, t); }
  }
  _behave(st, dt, t, ctx) {
    const c = st.c, s = st.s, p = s.profile;
    // gehend (Spätkommer:in, Pause)
    if (st.walk) { this._walk(st, dt); return; }
    if (st.leaving) { this._leaving(st, dt); return; }
    const deskY = s.seat.floor + LY.DESK_H + 0.03;
    const deskZ = LY.rowFront(s.seat.row) + 0.2;
    const fwd = V(0, 0, -1);
    const L = (x, y, z) => V(s.seat.x + x, s.seat.floor + y, s.seat.z + z); // Weltpunkt relativ zum Sitz (−z = nach vorne)
    // Blickziel wählen
    st.lookT -= dt;
    if (st.lookT <= 0) {
      st.lookT = this.rng.range(2, 7);
      const r = this.rng.next();
      const desk = p === 'writer' ? 0.55 : p === 'typer' ? 0.6 : p === 'phone' ? 0.85 : p === 'listener' ? 0.12 : 0.3;
      st.look = r < desk ? 'desk' : r < desk + 0.12 ? 'screen' : r < desk + 0.17 ? 'board' : r < desk + 0.2 ? 'window' : 'prof';
      if (s.role === 'neighbor' && this.rng.chance(0.12)) st.look = 'player';
      if (s.role === 'opponent') st.look = ctx.oppTyping ? 'desk' : ctx.oppWaiting ? 'prof' : (this.rng.chance(0.5) ? 'desk' : 'prof');
    }
    let tgt;
    if (st.react && (st.react.t += dt) > 0) { tgt = st.react.point; if (st.react.t > st.react.dur) st.react = null; }
    else if (st.glance > 0) { st.glance -= dt; tgt = ctx.playerLaptop || this.focus.player; }
    else {
      switch (st.look) {
        case 'desk': tgt = p === 'phone' ? L(0, 0.55, -0.25) : L(0, LY.DESK_H + 0.02, LY.rowFront(s.seat.row) + 0.2 - s.seat.z); break;
        case 'screen': tgt = this.focus.screen; break;
        case 'board': tgt = this.focus.board; break;
        case 'window': tgt = V(LY.ROOM.x0 - 5, 2.4, s.seat.z - 2); break;
        case 'player': tgt = this.focus.player; break;
        default: tgt = this.focus.prof;
      }
    }
    c.setLook(tgt, 1);
    c.sleepy = p === 'sleeper';
    // Arme je Profil
    c.setArm('L', 0); c.setArm('R', 0);
    const handDir = V(0, -0.45, -1).normalize(), palm = V(0, -1, 0);
    const poleR = L(0.4, 0.55, 0.15), poleL = L(-0.4, 0.55, 0.15); // rechts = +x (Blick −z)
    const deskPt = (x, dz = 0) => V(s.seat.x + x, deskY, deskZ + dz);
    const typing = (p === 'typer' || s.role === 'opponent' || s.role === 'latecomer') && (s.role !== 'opponent' || ctx.oppTyping || this.rng.chance(0.02));
    if (st.handUp) {
      c.setArm('R', 1, L(0.18, 1.62, -0.05), L(0.5, 1.1, 0.1), { dir: V(0, 1, 0), palm: V(0, 0, -1) });
    } else if (p === 'sleeper') {
      c.lean = damp(c.lean, 0.55, 2, dt);
      c.setArm('R', 1, deskPt(-0.06, 0.05), poleR, { dir: V(-1, 0, -0.2).normalize(), palm: V(0, -1, 0) });
      c.setArm('L', 1, deskPt(0.06, 0.02), poleL, { dir: V(1, 0, -0.2).normalize(), palm: V(0, -1, 0) });
    } else if (typing || (p === 'typer' && st.look === 'desk')) {
      const k = typing ? 1 : 0.25;
      const jR = Math.sin(t * 13 + st.phase) * 0.008 * k, jL = Math.sin(t * 11.3 + st.phase * 2) * 0.008 * k;
      c.setArm('R', 1, deskPt(0.08 + jR, 0.06), poleR, { dir: handDir, palm });
      c.setArm('L', 1, deskPt(-0.08 + jL, 0.06), poleL, { dir: handDir, palm });
      if (typing && this.rng.chance(dt * 6)) this.sfx('keyClick', L(0, LY.DESK_H, -0.3), 0.18);
    } else if (p === 'writer' || s.role === 'neighbor') {
      const writing = st.look === 'desk';
      const wx = writing ? Math.sin(t * 2.3 + st.phase) * 0.035 : 0, wz = writing ? Math.sin(t * 7.1 + st.phase) * 0.006 : 0;
      c.setArm('R', 1, deskPt(0.09 + wx, 0.08 + wz), poleR, { dir: handDir, palm: V(-0.4, -1, 0).normalize() });
      c.setArm('L', 0.9, deskPt(-0.14, 0.06), poleL, { dir: V(0.5, -0.3, -1).normalize(), palm });
      if (writing && this.rng.chance(dt * 0.6)) this.sfx('penWrite', L(0, LY.DESK_H, -0.3), 0.12);
    } else if (p === 'phone') {
      const scroll = Math.sin(t * 1.7 + st.phase) * 0.01;
      c.setArm('R', 1, L(0.05, 0.62 + scroll, -0.2), poleR, { dir: V(0, 0.4, -1).normalize(), palm: V(0, 0.5, 1).normalize() });
      c.setArm('L', 1, L(-0.05, 0.6, -0.2), poleL, { dir: V(0, 0.4, -1).normalize(), palm: V(0, 0.5, 1).normalize() });
    } else if (p === 'coffee') {
      st.drinkT -= dt;
      const drinking = st.drinkT < 0 && st.drinkT > -2.4;
      if (st.drinkT < -2.4) st.drinkT = this.rng.range(10, 28);
      const mouth = c.headWorld(V()).add(V(0, -0.08, -0.08));
      const rest = deskPt(0.12, 0.1);
      const k = drinking ? Math.sin(clamp(-st.drinkT / 2.4, 0, 1) * Math.PI) : 0;
      c.setArm('R', 1, rest.clone().lerp(mouth, k), poleR, { dir: V(0, 0.2, -1).normalize(), palm: V(-1, 0, 0) });
      c.setArm('L', 0.8, deskPt(-0.12, 0.05), poleL, { dir: handDir, palm });
    } else {
      // Zuhörer:in: Hände auf dem Pult oder Kinn auf die Hand gestützt
      const chin = Math.sin(t * 0.05 + st.phase) > 0.3;
      if (chin) c.setArm('R', 1, c.headWorld(V()).add(V(0.02, -0.12, -0.06)), poleR, { dir: V(0, 1, -0.3).normalize(), palm: V(-1, 0, 0) });
      else c.setArm('R', 1, deskPt(0.06, 0.04), poleR, { dir: V(-0.6, -0.2, -1).normalize(), palm });
      c.setArm('L', 1, deskPt(-0.07, 0.03), poleL, { dir: V(0.6, -0.2, -1).normalize(), palm });
    }
    if (p !== 'sleeper') c.lean = damp(c.lean, st.look === 'desk' ? 0.12 : 0.03, 2, dt);
    // Flüstern: zur Partnerin lehnen
    if (p === 'whisper') {
      st.whisperT -= dt;
      const on = st.whisperT < 0 && st.whisperT > -2.2;
      if (st.whisperT < -2.2) st.whisperT = this.rng.range(18, 45);
      c.lean2 = damp(c.lean2, on ? (s.pair === 'L' ? -0.15 : 0.15) : 0, 3, dt);
      if (on) { const partner = this.byId.get(s.partner); if (partner) c.setLook(partner.c.headWorld(V()), 1); }
    }
    if (s.role === 'neighbor' && st.lean2Target !== undefined) { c.lean2 = damp(c.lean2, st.lean2Target, 4, dt); st.lean2T -= dt; if (st.lean2T <= 0) st.lean2Target = 0; }
    if (st.stretch > 0) { st.stretch -= dt; c.setArm('R', 1, L(0.3, 1.7, 0.05), L(0.6, 1.1, 0.2), { dir: V(0, 1, 0), palm: V(0, 0, -1) }); c.setArm('L', 1, L(-0.3, 1.7, 0.05), L(-0.6, 1.1, 0.2), { dir: V(0, 1, 0), palm: V(0, 0, -1) }); }
  }
  neighborWhisper() { const st = this.byId.get(this.plan.neighbor.id); if (!st) return; st.lean2Target = (this.plan.neighbor.seat.x < this.plan.player.x ? 1 : -1) * 0.18; st.lean2T = 1.6; st.react = { point: this.focus.player.clone(), t: 0, dur: 1.5 }; }
  neighborGlance() { const st = this.byId.get(this.plan.neighbor.id); if (st) st.glance = 1.3; }
  _walk(st, dt) {
    const c = st.c, w = st.walk;
    const tgt = w.pts[w.i];
    if (!tgt) { st.walk = null; this._sit(st, false); this.sfx('benchCreak', st.s.seat ? V(st.s.seat.x, st.s.seat.floor + 0.5, st.s.seat.z) : c.pos, 0.6); return; }
    const d = Math.hypot(tgt.x - c.pos.x, tgt.z - c.pos.z);
    if (d < 0.08) { w.i++; return; }
    const sp = Math.min(d, 0.95 * dt);
    c.pos.x += (tgt.x - c.pos.x) / d * sp; c.pos.z += (tgt.z - c.pos.z) / d * sp;
    c.yaw = Math.atan2(tgt.x - c.pos.x, tgt.z - c.pos.z); c.walkSpeed = 0.95;
    c.setLook(null, 0); c.setArm('L', 0); c.setArm('R', 0);
  }
  _leaving(st, dt) {
    const L = st.leaving, c = st.c;
    L.t += dt;
    if (L.stage === 'stand') { if (L.t > 0) { c.standUp(); L.stage = 'standing'; L.t = 0; } return; }
    if (L.stage === 'standing') { if (L.t > 1.2) { L.stage = 'out'; L.path = this._pathOut(st.s.seat); } return; }
    if (L.stage === 'out') {
      const tgt = L.path.pts[L.path.i];
      if (!tgt) { L.stage = 'gone'; c.visible = false; st.rig.mesh.visible = false; st.present = false; if (L.forever) st.leaving = null; return; }
      const d = Math.hypot(tgt.x - c.pos.x, tgt.z - c.pos.z);
      if (d < 0.1) { L.path.i++; return; }
      const sp = Math.min(d, 0.9 * dt); c.pos.x += (tgt.x - c.pos.x) / d * sp; c.pos.z += (tgt.z - c.pos.z) / d * sp;
      c.yaw = Math.atan2(tgt.x - c.pos.x, tgt.z - c.pos.z); c.walkSpeed = 0.9; c.setArm('L', 0); c.setArm('R', 0); c.setLook(null, 0);
      return;
    }
    if (L.stage === 'gone' && L.returning) { st.leaving = null; st.present = true; c.visible = true; st.rig.mesh.visible = true; c.mode = 'stand'; c.sitBlend = 0; c.placeAt(LY.BACK_DOOR.x, LY.BACK_DOOR.z - 0.35, Math.PI); st.walk = this._pathToSeat(st.s.seat); }
  }
  _tutor(dt, t, ctx) {
    const tp = ctx.tutorPos; const c = this.tutor;
    if (!tp) return;
    const d = Math.hypot(tp.x - c.pos.x, tp.z - c.pos.z);
    c.walkSpeed = d > 0.02 ? 0.8 : 0;
    c.pos.x = tp.x; c.pos.z = tp.z; c.yaw = tp.yaw;
    c.setLook(ctx.playerLaptop || this.focus.prof, 0.8);
    c.setArm('L', 0.8, c.local(0.15, 1.05, 0.25), c.local(0.5, 0.8, -0.2), { dir: V(Math.sin(c.yaw), 0.2, Math.cos(c.yaw)).normalize(), palm: V(0, 1, 0) });
  }
  /** Weltposition des Laptops / Notizbuchs eines Studis (für Requisiten, Klänge) */
  deskPoint(s) { return V(s.seat.x, s.seat.floor + LY.DESK_H + 0.05, LY.rowFront(s.seat.row) + 0.2); }
}
