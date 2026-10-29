// Laufzeit-Figur: Basis-Pose (Stehen/Sitzen), additive Gesten, Schrittsteuerung mit festen Füßen,
// Zwei-Knochen-IK für Arme/Beine, Kopf-/Augenblick mit Sakkaden, Blinzeln, Mundbewegung.
import * as THREE from 'three';
import { applyPose, aimBone, twoBoneIK } from './rig.js';
import { applyFingerCurl } from './humanAsset.js';
import { clamp, damp, lerp, angleDamp, wrapAngle, makeRng } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
const _tmp = V(), _tmp2 = V(), _q = new THREE.Quaternion();

// Grundposen (Euler YXZ in Radiant, lokal)
export const POSE_STAND = {
  hips: [0, 0, 0], spine: [0.02, 0, 0], chest: [0.02, 0, 0], neck: [0.04, 0, 0], head: [-0.03, 0, 0],
  clavL: [0, 0, 0], clavR: [0, 0, 0],
  upperArmL: [0.06, 0, 0.09], upperArmR: [0.06, 0, -0.09], foreArmL: [-0.22, 0, 0], foreArmR: [-0.22, 0, 0],
  handL: [0, 0.1, 0], handR: [0, -0.1, 0], fingersL: [0, 0, -0.12], fingersR: [0, 0, 0.12], thumbL: [0, 0, -0.2], thumbR: [0, 0, 0.2],
  thighL: [0, 0, 0], thighR: [0, 0, 0], shinL: [0, 0, 0], shinR: [0, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0]
};
export const POSE_SIT = {
  ...POSE_STAND,
  spine: [0.1, 0, 0], chest: [0.06, 0, 0], neck: [0.08, 0, 0], head: [0.02, 0, 0],
  thighL: [-1.42, 0.08, 0.05], thighR: [-1.42, -0.08, -0.05], shinL: [1.38, 0, 0], shinR: [1.38, 0, 0], footL: [0.06, 0, 0], footR: [0.06, 0, 0],
  upperArmL: [-0.5, 0, 0.18], upperArmR: [-0.5, 0, -0.18], foreArmL: [-1.0, 0, 0], foreArmR: [-1.0, 0, 0]
};

export class Character {
  /**
   * rig: Ergebnis von buildCharacter. opts: { floorAt(x,z) → y, seed }
   */
  constructor(rig, opts = {}) {
    this.rig = rig; this.mesh = rig.mesh; this.bones = rig.bones; this.L = rig.lengths;
    this.floorAt = opts.floorAt || (() => 0);
    this.rng = makeRng(opts.seed || 1);
    this.pos = V(); this.yaw = 0; this.vel = V();
    this.mode = 'stand';            // 'stand' | 'sit'
    this.sitBlend = 0;              // 0 = steht, 1 = sitzt
    this.seat = null;               // { pos: Vector3 (Sitzvorderkante, Boden), yaw, seatH }
    this.gesture = {};              // additive Pose (wird jedes Frame gedämpft auf this.gestureTarget)
    this.gestureTarget = {};
    this.gestureSpeed = 6;
    this.arms = { L: { w: 0, tw: 0, target: V(), pole: V(), hand: null }, R: { w: 0, tw: 0, target: V(), pole: V(), hand: null } };
    // Blick
    this.lookTarget = null; this.lookW = 0; this.lookTW = 1;
    this.lookYaw = 0; this.lookPitch = 0; this.eyeYaw = 0; this.eyePitch = 0;
    this.saccade = V(); this.saccadeT = 0;
    this.lookLimits = { yaw: 1.25, up: 0.55, down: 0.85 };
    // Gesicht
    this.blinkT = this.rng.range(1, 4); this.blink = 0; this.talk = 0; this.talkTarget = 0; this.talkPhase = 0; this.brow = 0; this.browTarget = 0;
    this.breath = this.rng.range(0, 6);
    // Füße
    this.feet = null;
    this.stepDur = 0.42;
    this.walkSpeed = 0;
    this.lean = 0; this.lean2 = 0;
    this.headTilt = 0; this.headTiltTarget = 0;
    this.extraHipsY = 0;
    this.visible = true;
    this.lod = 0; this._acc = 0;
    this.mesh.matrixAutoUpdate = true;
  }

  // ------------------------------------------------------------------ Steuerung
  placeAt(x, z, yaw) { this.pos.set(x, this.floorAt(x, z), z); this.yaw = yaw; this._initFeet(); }
  sitOn(seat, instant = false) { this.seat = seat; this.mode = 'sit'; if (instant) { this.sitBlend = 1; this.pos.copy(seat.pos); this.yaw = seat.yaw; } }
  standUp() { this.mode = 'stand'; }
  setLook(target, w = 1) { this.lookTarget = target; this.lookTW = target ? w : 0; }
  setArm(side, w, target, pole, hand = null) { const a = this.arms[side]; a.tw = w; if (target) a.target.copy(target); if (pole) a.pole.copy(pole); a.hand = hand; }
  setGesture(pose, speed = 6) { this.gestureTarget = pose || {}; this.gestureSpeed = speed; }
  /** Weltpunkt aus lokaler Figur-Koordinate (vorne = +z der Figur) */
  local(x, y, z, out = V()) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return out.set(this.pos.x + x * c + z * s, this.pos.y + y, this.pos.z - x * s + z * c);
  }
  headWorld(out = V()) { this.bones.head.updateWorldMatrix(true, false); return out.setFromMatrixPosition(this.bones.head.matrixWorld).add(_tmp.set(0, 0.075, 0)); }
  forward(out = V()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  _initFeet() {
    const mk = sx => ({ side: sx > 0 ? 'L' : 'R', sx, planted: this.local(sx * 0.1, 0, 0.03), from: V(), to: V(), t: 1, yaw: this.yaw });
    this.feet = [mk(1), mk(-1)];
    for (const f of this.feet) f.planted.y = this.floorAt(f.planted.x, f.planted.z);
  }

  // ------------------------------------------------------------------ Update
  update(dt, time) {
    if (!this.visible) return;
    const b = this.bones;
    // Sitzen/Stehen überblenden
    this.sitBlend = damp(this.sitBlend, this.mode === 'sit' ? 1 : 0, 3.2, dt);
    if (this.seat && this.sitBlend > 0.02) {
      const k = this.mode === 'sit' ? 1 - Math.exp(-4 * dt) : 0;
      if (k) { this.pos.lerp(this.seat.pos, k); this.yaw = angleDamp(this.yaw, this.seat.yaw, 5, dt); }
    }
    // 1) Basis-Pose + Gesten
    const pose = {};
    const sb = this.sitBlend;
    for (const k in POSE_STAND) {
      const a = POSE_STAND[k], c = POSE_SIT[k];
      pose[k] = [lerp(a[0], c[0], sb), lerp(a[1], c[1], sb), lerp(a[2], c[2], sb)];
    }
    // Gesten dämpfen und addieren
    const gs = this.gestureSpeed;
    for (const k in this.gestureTarget) {
      const t = this.gestureTarget[k], g = this.gesture[k] || (this.gesture[k] = [0, 0, 0]);
      g[0] = damp(g[0], t[0], gs, dt); g[1] = damp(g[1], t[1], gs, dt); g[2] = damp(g[2], t[2], gs, dt);
    }
    for (const k in this.gesture) {
      if (!(k in this.gestureTarget)) { const g = this.gesture[k]; g[0] = damp(g[0], 0, gs, dt); g[1] = damp(g[1], 0, gs, dt); g[2] = damp(g[2], 0, gs, dt); }
      const g = this.gesture[k]; const p = pose[k] || (pose[k] = [0, 0, 0]);
      p[0] += g[0]; p[1] += g[1]; p[2] += g[2];
    }
    // Atmung & Gewichtsverlagerung
    this.breath += dt * (0.9 + 0.2 * Math.sin(time * 0.1));
    const br = Math.sin(this.breath * 1.6);
    pose.chest[0] += br * 0.012; pose.clavL[2] += br * 0.01; pose.clavR[2] -= br * 0.01;
    const sway = Math.sin(time * 0.37 + this.rng.next() * 0.0001 + this.breath * 0.2) * (1 - sb);
    pose.hips[2] += sway * 0.025; pose.spine[2] -= sway * 0.02;
    pose.spine[0] += this.lean; pose.spine[2] += this.lean2;
    pose.head[2] += this.headTilt = damp(this.headTilt, this.headTiltTarget, 3, dt);
    applyPose(this.rig, pose);

    // 2) Wurzel-Transformation
    const hipBind = this.rig.bindPos.hips.y;
    if (sb > 0.001 && this.seat) {
      const seatH = this.seat.seatH ?? 0.46;
      // echte Figuren: Hüftgelenk sitzt eine Gesäßdicke über der Sitzfläche
      const lift = this.rig.human ? (hipBind - this.rig.bindPos.thighL.y) + 0.085 : 0.06;
      const hy = lerp(hipBind, seatH + lift, sb);
      b.hips.position.set(0, hy + this.extraHipsY, lerp(0, -0.08, sb));
    } else b.hips.position.set(0, hipBind + this.extraHipsY, 0);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.yaw, 0);
    this.mesh.updateMatrixWorld(true);

    // 3) Beine (Stehen/Gehen) mit Fuß-IK
    if (sb < 0.5) this._updateLegs(dt, 1 - sb * 2);

    // 4) Blick
    this._updateLook(dt, time);

    // 5) Arme
    for (const side of ['L', 'R']) {
      const a = this.arms[side];
      a.w = damp(a.w, a.tw, 7, dt);
      if (a.w > 0.01) this._armIK(side, a);
    }
    // 6) Gesicht
    this._updateFace(dt, time);
    // 7) echte Hände: Krümmung auf drei Fingerglieder verteilen
    if (this.rig.fingerBones) applyFingerCurl(this.rig);
  }

  _updateLegs(dt, weight) {
    if (!this.feet) this._initFeet();
    const b = this.bones;
    const speed = this.walkSpeed;
    const fwd = this.forward(_tmp2);
    const lead = clamp(speed, 0, 1.6) * 0.18;
    let stepping = this.feet.some(f => f.t < 1);
    for (const f of this.feet) {
      const want = this.local(f.sx * 0.1, 0, 0.02 + lead);
      want.y = this.floorAt(want.x, want.z);
      if (f.t < 1) {
        f.t = Math.min(1, f.t + dt / this.stepDur);
        const e = f.t * f.t * (3 - 2 * f.t);
        f.planted.lerpVectors(f.from, f.to, e);
        f.planted.y += Math.sin(Math.PI * f.t) * (0.07 + speed * 0.02);
        if (f.t >= 1) { f.planted.copy(f.to); f.yaw = this.yaw; }
      } else if (!stepping) {
        const dist = Math.hypot(want.x - f.planted.x, want.z - f.planted.z);
        const dyaw = Math.abs(wrapAngle(this.yaw - f.yaw));
        if (dist > 0.16 || dyaw > 0.45 || (speed < 0.05 && dist > 0.06 && this.rng.chance(dt * 1.5))) {
          // den Fuß mit dem größeren Abstand zuerst
          const other = this.feet.find(o => o !== f);
          const od = Math.hypot(this.local(other.sx * 0.1, 0, 0.02 + lead).x - other.planted.x, this.local(other.sx * 0.1, 0, 0.02 + lead).z - other.planted.z);
          if (od > dist + 0.05 && other.t >= 1) continue;
          f.from.copy(f.planted); f.to.copy(want).addScaledVector(fwd, lead * 0.8); f.to.y = this.floorAt(f.to.x, f.to.z);
          f.t = 0; stepping = true;
          this.stepDur = clamp(0.5 - speed * 0.12, 0.3, 0.5);
          if (this.onStep) this.onStep(f);
        }
      }
    }
    // Hüfthöhe: abhängig vom Fußabstand + Bodenhöhe
    const [fl, fr] = this.feet;
    const spread = Math.hypot(fl.planted.x - fr.planted.x, fl.planted.z - fr.planted.z);
    const floorY = Math.min(fl.planted.y, fr.planted.y);
    const baseY = this.floorAt(this.pos.x, this.pos.z);
    this.pos.y = damp(this.pos.y, Math.min(baseY, floorY + 0.02), 10, dt);
    this.extraHipsY = damp(this.extraHipsY, -clamp(spread - 0.2, 0, 0.4) * 0.12 - speed * 0.015, 8, dt);
    b.hips.position.y = this.rig.bindPos.hips.y + this.extraHipsY;
    // Becken-/Schulterrotation beim Gehen
    const phase = (fl.t < 1 ? fl.t : fr.t < 1 ? -fr.t : 0);
    b.hips.rotation.y += phase * 0.08 * Math.min(1, speed * 2);
    b.chest.rotation.y -= phase * 0.1 * Math.min(1, speed * 2);
    this.mesh.position.copy(this.pos);
    this.mesh.updateMatrixWorld(true);
    // Arm-Schwung (FK) gegengleich zu den Füßen
    const swing = phase * Math.min(1, speed * 1.5) * 0.35;
    if (this.arms.L.w < 0.5) b.upperArmL.rotateX(swing);
    if (this.arms.R.w < 0.5) b.upperArmR.rotateX(-swing);
    // Bein-IK
    const L = this.L;
    for (const f of this.feet) {
      const s = f.side;
      const ankle = _tmp.copy(f.planted); ankle.y += L.ankle + 0.005;
      const pole = this.local(f.sx * 0.12, 0.5, 0.8);
      const fk = [b['thigh' + s].quaternion.clone(), b['shin' + s].quaternion.clone()];
      twoBoneIK(b['thigh' + s], b['shin' + s], b['foot' + s], L.thigh, L.shin, ankle, pole, V(0, 0, 1));
      if (weight < 1) { b['thigh' + s].quaternion.slerp(fk[0], 1 - weight); b['shin' + s].quaternion.slerp(fk[1], 1 - weight); }
      // Fuß flach auf dem Boden, in Gehrichtung
      const fyaw = f.t < 1 ? this.yaw : f.yaw;
      const footFwd = V(Math.sin(fyaw), 0, Math.cos(fyaw));
      b['foot' + s].updateWorldMatrix(true, false);
      aimBone(b['foot' + s], V(0, 0, 1), footFwd, V(0, 1, 0), V(0, 1, 0));
    }
  }

  _armIK(side, a) {
    const b = this.bones;
    const ua = b['upperArm' + side], fa = b['foreArm' + side], hd = b['hand' + side];
    const fk = [ua.quaternion.clone(), fa.quaternion.clone(), hd.quaternion.clone()];
    twoBoneIK(ua, fa, hd, this.L.upperArm, this.L.foreArm, a.target, a.pole, V(0, 0, -1));
    if (a.hand) {
      // a.hand = { dir: Weltrichtung der Finger, palm: Weltrichtung der Handfläche }
      const palmLocal = side === 'L' ? V(-1, 0, 0) : V(1, 0, 0);
      aimBone(hd, DOWN, a.hand.dir, palmLocal, a.hand.palm);
    }
    if (a.w < 0.999) { ua.quaternion.slerp(fk[0], 1 - a.w); fa.quaternion.slerp(fk[1], 1 - a.w); hd.quaternion.slerp(fk[2], 1 - a.w); }
    ua.updateMatrixWorld(true);
  }

  _updateLook(dt, time) {
    const b = this.bones;
    this.lookW = damp(this.lookW, this.lookTW, 4, dt);
    let yaw = 0, pitch = 0;
    if (this.lookTarget) {
      // Sakkaden: kleiner Versatz des Blickziels
      this.saccadeT -= dt;
      if (this.saccadeT <= 0) { this.saccadeT = this.rng.range(0.25, 1.4); this.saccade.set(this.rng.range(-1, 1), this.rng.range(-0.6, 0.6), this.rng.range(-1, 1)).multiplyScalar(0.06); }
      b.chest.updateWorldMatrix(true, false);
      const inv = _m4.copy(b.chest.matrixWorld).invert();
      const t = _tmp.copy(this.lookTarget).add(this.saccade).applyMatrix4(inv);
      const h = this.rig.human ? _tmp2.copy(this.rig.bindPos.head).sub(this.rig.bindPos.chest).add(_hOff) : _tmp2.set(0, 0.32, 0.03); // Kopfmitte relativ zur Brust
      const d = t.sub(h);
      yaw = clamp(Math.atan2(d.x, d.z), -this.lookLimits.yaw, this.lookLimits.yaw);
      pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -this.lookLimits.down, this.lookLimits.up);
      // hinter dem Rücken: nicht einrasten
      if (d.z < -0.1 && Math.abs(Math.atan2(d.x, d.z)) > 2.4) yaw = this.lookYaw;
    }
    this.lookYaw = damp(this.lookYaw, yaw * this.lookW, 6.5, dt);
    this.lookPitch = damp(this.lookPitch, pitch * this.lookW, 6.5, dt);
    // Verteilung: Brust 15 %, Hals 35 %, Kopf 50 %
    const y = this.lookYaw, p = -this.lookPitch;
    b.chest.rotateY(y * 0.15);
    b.neck.rotateY(y * 0.35); b.neck.rotateX(p * 0.4);
    b.head.rotateY(y * 0.5); b.head.rotateX(p * 0.6);
    // Augen folgen schneller (Rest bis ±0,35 rad)
    const ey = clamp((yaw * this.lookW - this.lookYaw) * 1.0 + this.saccade.x * 0.6, -0.35, 0.35);
    const ep = clamp((-(pitch * this.lookW) + this.lookPitch) * 1.0 + this.saccade.y * 0.5, -0.3, 0.3);
    this.eyeYaw = damp(this.eyeYaw, ey, 25, dt); this.eyePitch = damp(this.eyePitch, ep, 25, dt);
    for (const s of ['L', 'R']) b['eye' + s].rotation.set(this.eyePitch, this.eyeYaw, 0, 'YXZ');
  }

  _updateFace(dt, time) {
    const b = this.bones;
    // Blinzeln
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = this.rng.range(2.0, 6.0) * (this.rng.chance(0.15) ? 0.15 : 1); }
    this.blink = Math.max(0, this.blink - dt / 0.14);
    const closed = Math.sin(this.blink * Math.PI);
    const lidBase = -0.95 + this.eyePitch * 0.6 + (this.sleepy ? 0.75 : 0);
    const lid = lerp(lidBase, 0.12, Math.max(closed, this.sleepy ? 0.85 : 0));
    const F = this.rig.face, lidA = F ? (lid - F.lidOpen) * F.lidScale : lid;
    b.lidL.rotation.set(lidA, this.eyeYaw * 0.3, 0); b.lidR.rotation.set(lidA, this.eyeYaw * 0.3, 0);
    // Sprechen: Kiefer folgt einer silbenartigen Hüllkurve
    this.talk = damp(this.talk, this.talkTarget, 10, dt);
    this.talkPhase += dt * (9 + Math.sin(time * 1.3) * 2);
    let syll = Math.max(0, Math.sin(this.talkPhase) * 0.7 + Math.sin(this.talkPhase * 2.3 + 1) * 0.3);
    if (this.talkEnvValue != null) { this.envSmooth = damp(this.envSmooth || 0, Math.min(1, this.talkEnvValue * 1.8), 18, dt); syll = this.envSmooth; }
    // Mundformen (Rig mit Lippenknochen + Visem-Spur): Kieferöffnung je Laut, Lippen breit/rund/vor, Unterlippe bei F/V
    const vis = this.talkVis;
    if (vis && b.lipUp && this.talk > 0.05) {
      b.jaw.rotation.x = (0.03 + this.talk * vis.jaw * 0.2) * (F ? F.jawScale : 1);
      const bp = this.rig.bindPos, k = this.talk;
      b.lipUp.position.set(bp.lipUp.x - bp.head.x, bp.lipUp.y - bp.head.y + vis.up * 0.0025 * k, bp.lipUp.z - bp.head.z + vis.fwd * 0.003 * k);
      b.lipLow.position.set(bp.lipLow.x - bp.jaw.x, bp.lipLow.y - bp.jaw.y - vis.low * 0.0025 * k, bp.lipLow.z - bp.jaw.z + (vis.fwd * 0.003 + Math.min(0, vis.low) * 0.002) * k);
      for (const [n, sx] of [['lipCL', 1], ['lipCR', -1]]) b[n].position.set(bp[n].x - bp.head.x + sx * vis.wide * 0.0035 * k, bp[n].y - bp.head.y + Math.max(0, vis.wide) * 0.0012 * k, bp[n].z - bp.head.z + vis.fwd * 0.002 * k);
    } else {
      b.jaw.rotation.x = (0.03 + this.talk * syll * 0.16) * (F ? F.jawScale : 1);
      if (b.lipUp) { const bp = this.rig.bindPos; for (const [n, p] of [['lipUp', 'head'], ['lipLow', 'jaw'], ['lipCL', 'head'], ['lipCR', 'head']]) b[n].position.set(bp[n].x - bp[p].x, bp[n].y - bp[p].y, bp[n].z - bp[p].z); }
    }
    // Brauen
    this.brow = damp(this.brow, this.browTarget, 5, dt);
    for (const s of ['L', 'R']) b['brow' + s].position.y = this.rig.bones['brow' + s].position.y * 0 + (this.rig.bindPos['brow' + s].y - this.rig.bindPos.head.y) + this.brow * 0.006;
  }
}
const _m4 = new THREE.Matrix4(), _hOff = new THREE.Vector3(0, 0.08, 0.03);
