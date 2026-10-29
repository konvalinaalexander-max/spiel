// Figur mit Motion-Capture-Animationen (Rocketbox, MIT): Grundbewegung kommt aus aufgenommenen Clips (Sitzen am Tisch, Stehen,
// Gehen, Gesten, kleine Eigenheiten wie Gähnen, Kopfkratzen, Haare richten), darüber liegen nur die Dinge, die das Spiel
// steuern muss – Blick, Arm-IK (Hand am Laptop, Kreide, Glas), Vorbeugen, Nicken, Lachen, Blinzeln, Mund.
//
// Schnittstelle wie Character (character.js): placeAt, sitOn, standUp, setLook, setArm, setGesture, local, headWorld, forward,
// update, Felder pos/yaw/mode/walkSpeed/lean/lean2/talkTarget/talkEnvValue/talkVis/browTarget/headTiltTarget/sleepy …
// Zusätzlich: activity (Clip-Auswahl beim Sitzen), standPool (Clips beim Stehen), playOnce(name).
//
// Das Rocketbox-Skelett (3ds-Max-Biped) hat Knochen mit Eigendrehung; alle Überlagerungen rechnen deshalb in Weltachsen
// (rotateWorld) statt in lokalen Achsen. Kopf: lokale +Y = vorne, +X = oben. Lider werden wie in den Clips verschoben.
import * as THREE from 'three';
import { clamp, damp, lerp, angleDamp, makeRng } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _v1 = V(), _v2 = V(), _v3 = V(), _v4 = V(), _v5 = V(), _f = V(), _l = V(), _r = V(), _hf = V();

/** Weltdrehung eines Objekts (Eltern-Quaternionen multipliziert; Maßstab wird ignoriert) */
function worldQ(o, out) { out.copy(o.quaternion); for (let p = o.parent; p; p = p.parent) out.premultiply(p.quaternion); return out; }
/** Knochen um eine Weltdrehung Δ drehen (Drehpunkt = Gelenk): lokal' = Qp⁻¹ · Δ · Qp · lokal */
function rotateWorld(bone, delta) {
  worldQ(bone.parent, _qp);
  _q.copy(_qp).invert().multiply(delta).multiply(_qp);
  bone.quaternion.premultiply(_q);
}
const axisAngle = (axis, a) => _qa.setFromAxisAngle(axis, a);
const wpos = (o, out) => out.setFromMatrixPosition(o.matrixWorld);

// Lidverschiebung „geschlossen“ im Kopfraum (Meter; aus den Rocketbox-Clips: oberes Lid 11,3 mm nach unten)
const LID_TOP = V(-0.0113, -0.0029, 0), LID_BOT = V(0.0035, 0.0009, 0);
// Lautklassen (visemes.js) → Rocketbox-Visemes (Oculus-Reihenfolge AA_VI_00 … 14)
const VIS_MORPH = { rest: 'AA_VI_00_sil', M: 'AA_VI_01_PP', F: 'AA_VI_02_FF', S: 'AA_VI_07_SS', L: 'AA_VI_08_nn', A: 'AA_VI_10_aa', E: 'AA_VI_11_E', I: 'AA_VI_12_ih', O: 'AA_VI_13_oh', U: 'AA_VI_14_ou' };

// Clip-Sammlungen je Tätigkeit beim Sitzen (gewichtet über Mehrfachnennung)
export const SIT_POOLS = {
  listen: ['sit_idle_1', 'sit_idle_2', 'sit_idle_1', 'sit_breathe', 'sit_relaxed', 'sit_thoughtful', 'sit_waiting'],
  calm: ['sit_breathe', 'sit_idle_1', 'sit_idle_2'],
  // Tippen/Schreiben: ruhige Sitz-Clips, die Hände legt die IK an Tastatur bzw. Stift (Rocketbox hat keinen Tipp-Clip im Sitzen)
  work: ['sit_breathe', 'sit_idle_1', 'sit_idle_2'],
  type: ['sit_breathe', 'sit_idle_2'],
  relaxed: ['sit_relaxed', 'sit_waiting', 'sit_idle_2'],
  sleep: ['sit_relaxed'],
  player: ['sit_breathe']   // eigene Figur (Ich-Perspektive): ruhig, die Kamera hängt an den Augen
};
// Griffe: [Daumen, Zeige-, Mittel-, Ring-, kleiner Finger] × [Grund-, Mittel-, Endglied] (zusätzliche Beugung zur Clip-Haltung)
const GRIPS = {
  type: [[0, 0, 0], [-0.15, -0.1, 0], [-0.12, -0.1, 0], [-0.08, -0.05, 0], [-0.05, 0, 0]],   // Clip-Hände sind schon locker gebeugt → etwas strecken
  pen: [[0.3, 0.25, 0.15], [0.05, 0.2, 0.15], [0.3, 0.45, 0.3], [0.7, 0.8, 0.55], [0.8, 0.85, 0.6]],
  hold: [[0.25, 0.2, 0.1], [0.3, 0.35, 0.25], [0.35, 0.4, 0.25], [0.4, 0.45, 0.3], [0.45, 0.45, 0.3]],
  fist: [[0.5, 0.4, 0.25], [0.9, 1.0, 0.7], [0.95, 1.05, 0.75], [1.0, 1.05, 0.75], [1.0, 1.05, 0.75]],
  flat: [[0, 0, 0], [-0.2, -0.15, -0.05], [-0.2, -0.15, -0.05], [-0.2, -0.15, -0.05], [-0.2, -0.15, -0.05]]
};
const SIT_FIDGETS = ['sit_look', 'sit_yawn', 'sit_scratch', 'sit_face', 'sit_hair', 'sit_roll_head', 'sit_cough', 'sit_shrug', 'sit_dust', 'sit_thoughtful'];
const STAND_POOL = ['idle_1', 'idle_2', 'idle_look'];

export class ClipCharacter {
  /** rig: aus rigFromHPK (Rocketbox), clips: Map Name → AnimationClip, opts: { floorAt, seed, fidgets } */
  constructor(rig, clips, opts = {}) {
    this.isClip = true;
    this.rig = rig; this.mesh = rig.mesh; this.bones = rig.bones; this.L = rig.lengths;
    this.clips = clips;
    this.floorAt = opts.floorAt || (() => 0);
    this.rng = makeRng(opts.seed || 1);
    this.mixer = new THREE.AnimationMixer(this.mesh);
    this.pos = V(); this.yaw = 0; this.vel = V();
    this.mode = 'stand'; this.sitBlend = 0; this.seat = null;
    this.gesture = {}; this.gestureTarget = {}; this.gestureSpeed = 6;
    this.arms = { L: { w: 0, tw: 0, target: V(), pole: V(), hand: null }, R: { w: 0, tw: 0, target: V(), pole: V(), hand: null } };
    this.lookTarget = null; this.lookW = 0; this.lookTW = 1; this.lookYaw = 0; this.lookPitch = 0; this.eyeYaw = 0; this.eyePitch = 0;
    this.saccade = V(); this.saccadeT = 0; this.lookLimits = { yaw: 1.25, up: 0.55, down: 0.85 }; this.lookShare = 0.85;
    this.blinkT = this.rng.range(1, 4); this.blink = 0; this.talk = 0; this.talkTarget = 0; this.talkPhase = 0; this.brow = 0; this.browTarget = 0;
    this.walkSpeed = 0; this.lean = 0; this.lean2 = 0; this.headTilt = 0; this.headTiltTarget = 0;
    this.visible = true; this.sleepy = false;
    this.activity = 'listen'; this.standPool = STAND_POOL; this.fidgets = opts.fidgets !== false;
    this.grip = { L: { kind: null, w: 0, tw: 0 }, R: { kind: null, w: 0, tw: 0 } };
    this.fidgetT = this.rng.range(5, 20);
    this.base = null; this.baseKey = ''; this.baseT = 0; this.shot = null;
    this.groundOff = 0; this.sitOff = null;
    // Ruhedrehung aller Knochen: Clips enthalten nur Spuren, die sich bewegen (konstante wurden beim Packen entfernt). Alles,
    // was hier per rotateWorld überlagert wird (Blick, Haltung, IK, Finger), muss deshalb jedes Bild von der Ruhe ausgehen,
    // sonst summiert sich die Überlagerung auf Knochen ohne Spur Bild für Bild auf.
    this.restQ = (rig.skeleton ? rig.skeleton.bones : []).map(bn => [bn, bn.quaternion.clone()]);
    // Ruhewerte der Knochen, die nur hier (nicht von Clips) bewegt werden
    const b = this.bones;
    this.faceRest = ['jaw', 'eyeL', 'eyeR'].filter(n => b[n]).map(n => [b[n], b[n].quaternion.clone()]);
    this.lids = [];
    for (const s of ['L', 'R']) {
      const top = findBone(rig, `Bip01_${s}EyeBlinkTop`), bot = findBone(rig, `Bip01_${s}EyeBlinkBottom`);
      if (top) this.lids.push([top, top.position.clone(), LID_TOP]);
      if (bot) this.lids.push([bot, bot.position.clone(), LID_BOT]);
    }
    this.browBones = ['L', 'R'].map(s => findBone(rig, `Bip01_${s}InnerEyebrow`)).filter(Boolean).map(o => [o, o.position.clone()]);
    // Hand: Fingerrichtung, Daumenseite, Handfläche im Handraum (für Handausrichtung und Griffpunkte)
    this.handFrame = {};
    for (const s of ['L', 'R']) {
      const S = s === 'L' ? 'L' : 'R', hd = b['hand' + s];
      const f2 = findBone(rig, `Bip01_${S}_Finger2`), f1 = findBone(rig, `Bip01_${S}_Finger1`), f4 = findBone(rig, `Bip01_${S}_Finger4`);
      if (!hd || !f2 || !f1 || !f4) continue;
      const fing = f2.position.clone().normalize(), side = f1.position.clone().sub(f4.position).normalize();
      const palm = s === 'R' ? side.clone().cross(fing).normalize() : fing.clone().cross(side).normalize();
      this.handFrame[s] = { fing, palm, knuckle: f2.position.clone() };
    }
    // Fingerketten (Biped: Finger0 = Daumen, 1 Zeige-, 2 Mittel-, 3 Ring-, 4 kleiner Finger; je drei Glieder)
    this.fingers = {};
    for (const s of ['L', 'R']) {
      const ch = [0, 1, 2, 3, 4].map(k => [`Bip01_${s}_Finger${k}`, `Bip01_${s}_Finger${k}1`, `Bip01_${s}_Finger${k}2`].map(n => findBone(rig, n)).filter(Boolean));
      if (ch.every(c => c.length)) this.fingers[s] = ch;
    }
    // Morphs (Hauptfiguren mit Gesichtsformen)
    const dict = this.mesh.isSkinnedMesh ? this.mesh.morphTargetDictionary : (rig.skinned && rig.skinned.morphTargetDictionary);
    this.morph = dict ? { dict, inf: (this.mesh.isSkinnedMesh ? this.mesh : rig.skinned).morphTargetInfluences } : null;
    if (this.morph) {
      const find = re => { const k = Object.keys(dict).find(n => re.test(n)); return k != null ? dict[k] : -1; };
      this.morph.blinkL = find(/^AK_09/); this.morph.blinkR = find(/^AK_10/); this.morph.jaw = find(/^AK_25/);
      this.morph.brow = find(/^AK_03/); this.morph.browOL = find(/^AK_04/); this.morph.browOR = find(/^AK_05/);
      this.morph.vis = {}; for (const [k, n] of Object.entries(VIS_MORPH)) this.morph.vis[k] = find(new RegExp('^' + n.slice(0, 8)));
    }
    this.mesh.matrixAutoUpdate = true;
  }

  // ------------------------------------------------------------------ Steuerung (wie Character)
  placeAt(x, z, yaw) { this.pos.set(x, this.floorAt(x, z), z); this.yaw = yaw; }
  sitOn(seat, instant = false) { this.seat = seat; this.mode = 'sit'; if (instant) { this.sitBlend = 1; this.pos.copy(seat.pos); this.yaw = seat.yaw; } }
  standUp() { this.mode = 'stand'; }
  setLook(target, w = 1) { this.lookTarget = target; this.lookTW = target ? w : 0; }
  setArm(side, w, target, pole, hand = null) { const a = this.arms[side]; a.tw = w; if (target) a.target.copy(target); if (pole) a.pole.copy(pole); a.hand = hand; }
  setGesture(pose, speed = 6) { this.gestureTarget = pose || {}; this.gestureSpeed = speed; }
  /** Handhaltung über der Clip-Bewegung: 'type' (Tastatur), 'pen' (Stift), 'hold' (Handy/Becher), 'fist' (Zeigestab); null = Clip */
  setGrip(side, kind, w = 1) { const g = this.grip[side]; if (kind) g.kind = kind; g.tw = kind ? w : 0; }
  local(x, y, z, out = V()) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return out.set(this.pos.x + x * c + z * s, this.pos.y + y, this.pos.z - x * s + z * c); }
  headWorld(out = V()) { this.bones.head.updateWorldMatrix(true, false); return out.setFromMatrixPosition(this.bones.head.matrixWorld).add(_v5.set(0, 0.075, 0)); }
  forward(out = V()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  /** einmaliger Clip über der Grundbewegung (Geste, Eigenheit); kehrt danach weich zurück */
  playOnce(name, fade = 0.45, speed = 1) {
    const clip = this.clips.get(name); if (!clip || (this.shot && this.shot.name === name)) return false;
    const a = this.mixer.clipAction(clip);
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = speed; a.setEffectiveWeight(1); a.fadeIn(fade); a.play();
    if (this.shot) this.shot.action.fadeOut(fade);
    if (this.base) this.base.fadeOut(fade);
    this.shot = { name, action: a, fade, dur: clip.duration / speed };
    return true;
  }
  get busy() { return !!this.shot; }

  // ------------------------------------------------------------------ Grundbewegung (Clip-Auswahl)
  _baseWanted() {
    if (this.mode === 'sit' || this.sitBlend > 0.5) return { key: 'sit:' + this.activity, pool: SIT_POOLS[this.activity] || SIT_POOLS.listen };
    if (this.walkSpeed > 0.05) return { key: 'walk', pool: [this.walkSpeed < 0.75 && this.clips.has('walk_slow') ? 'walk_slow' : 'walk'] };
    return { key: 'stand:' + this.standPool.join(','), pool: this.standPool };
  }
  _setBase(name, fade) {
    const clip = this.clips.get(name) || this.clips.get('sit_idle_1') || this.clips.get('idle_1'); if (!clip) return;
    const a = this.mixer.clipAction(clip);
    if (this.base === a) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveWeight(1);
    a.time = this.rng.range(0, clip.duration * 0.9);
    if (this.shot) { a.setEffectiveWeight(0); a.play(); } else { a.fadeIn(fade); a.play(); }   // während eines Einzelclips vorbereitet, eingeblendet danach
    if (this.base) this.base.fadeOut(fade);
    this.base = a; this.baseName = clip.name; this.baseT = clip.duration * this.rng.range(1, 2.2);
  }
  _updateClips(dt) {
    const want = this._baseWanted();
    const keyChanged = want.key !== this.baseKey;
    this.baseT -= dt;
    if (keyChanged || !this.base || (this.baseT <= 0 && want.pool.length > 1)) {
      const fade = keyChanged ? (want.key === 'walk' || this.baseKey === 'walk' ? 0.35 : 0.8) : 1.2;
      let name = this.rng.pick(want.pool);
      if (want.pool.length > 1) for (let i = 0; i < 3 && name === this.baseName; i++) name = this.rng.pick(want.pool);
      this.baseKey = want.key; this._setBase(name, fade);
    }
    // Gehtempo ≈ Schrittfrequenz anpassen
    if (want.key === 'walk' && this.base) this.base.timeScale = clamp(this.walkSpeed / (this.baseName === 'walk_slow' ? 0.8 : 1.25), 0.6, 1.4);
    // Eigenheiten beim Sitzen (Gähnen, Haare, Kopf kratzen …)
    if (this.fidgets && this.mode === 'sit' && this.sitBlend > 0.95 && !this.shot && this.activity !== 'type' && this.activity !== 'sleep') {
      this.fidgetT -= dt;
      if (this.fidgetT <= 0) { this.fidgetT = this.rng.range(14, 40); const n = this.rng.pick(SIT_FIDGETS); if (this.clips.has(n)) this.playOnce(n, 0.6); }
    }
    if (this.shot) {
      const a = this.shot.action;
      if (a.time >= a.getClip().duration - this.shot.fade * a.timeScale || !a.isRunning()) {
        a.fadeOut(this.shot.fade); if (this.base) { this.base.enabled = true; this.base.setEffectiveWeight(1); this.base.fadeIn(this.shot.fade); this.base.play(); }
        this.shot = null;
      }
    }
    this.mixer.update(dt);
  }

  // ------------------------------------------------------------------ Update
  update(dt, time) {
    if (!this.visible) return;
    const b = this.bones;
    this.sitBlend = damp(this.sitBlend, this.mode === 'sit' ? 1 : 0, 2.6, dt);
    if (this.seat && this.sitBlend > 0.02 && this.mode === 'sit') {
      const k = 1 - Math.exp(-4 * dt);
      this.pos.lerp(this.seat.pos, k); this.yaw = angleDamp(this.yaw, this.seat.yaw, 5, dt);
    }
    // alle Knochen auf Ruhe zurücksetzen, danach schreibt der Mixer die animierten (Gesicht: keine Spuren in den Clips)
    for (const [o, q] of this.restQ) o.quaternion.copy(q);
    for (const [o, q] of this.faceRest) o.quaternion.copy(q);
    for (const [o, p] of this.lids) o.position.copy(p);
    for (const [o, p] of this.browBones) o.position.copy(p);
    // 1) Clips
    this._updateClips(dt);
    // 2) Wurzel: Stand → Füße auf den Boden; Sitz → Becken auf die Sitzfläche
    this.mesh.position.copy(this.pos); this.mesh.rotation.set(0, this.yaw, 0);
    if (this.sitBlend > 0.001 && this.seat) {
      if (!this.sitOff) this.sitOff = this._sitOffset();
      const so = this.sitOff, c = Math.cos(this.yaw), s = Math.sin(this.yaw), k = this.sitBlend;
      this.mesh.position.x += (so.x * c + so.z * s) * k; this.mesh.position.z += (-so.x * s + so.z * c) * k;
      this.mesh.position.y += lerp(this.groundOff, so.y, k);
    } else this.mesh.position.y += this.groundOff;
    this.mesh.updateMatrixWorld(true);
    if (this.sitBlend < 0.5) this._ground(dt);
    // 3) Haltung: Vorbeugen, Seitneigung, Nicken/Lachen (additiv, Weltachsen)
    this._posture(dt);
    // 4) Blick
    this._updateLook(dt);
    // 5) Arme
    for (const side of ['L', 'R']) {
      const a = this.arms[side];
      a.w = damp(a.w, a.tw, 7, dt);
      if (a.w > 0.01 && this.handFrame[side]) this._armIK(side, a);
    }
    // 6) Finger (Griff) – nach der Arm-IK, damit die Achsen zur endgültigen Handlage passen
    for (const side of ['L', 'R']) { const g = this.grip[side]; g.w = damp(g.w, g.tw, 9, dt); if (g.w > 0.01 && g.kind && this.fingers[side]) this._applyGrip(side, g); }
    // 7) Gesicht
    this._updateFace(dt, time);
  }
  /**
   * Finger beugen: jede Fingerkette um die Achse Fingerrichtung × Handflächennormale (Welt) drehen – so wandern die Finger zur
   * Handfläche, unabhängig von den lokalen Achsen des Biped-Skeletts. Werte je Glied (Grund-, Mittel-, Endglied) in Radiant.
   */
  _applyGrip(side, g) {
    const P = GRIPS[g.kind]; if (!P) return;
    const hf = this.handFrame[side], hd = this.bones['hand' + side];
    worldQ(hd, _q3);
    const f = _u1.copy(hf.fing).applyQuaternion(_q3), n = _u2.copy(hf.palm).applyQuaternion(_q3);
    const axis = _u3.copy(f).cross(n).normalize(), thumbAxis = _u4.copy(f).normalize();
    const fs = this.fingers[side];
    for (let k = 1; k <= 4; k++) {
      const a = P[k], chain = fs[k];
      for (let j = 0; j < chain.length; j++) rotateWorld(chain[j], axisAngle(axis, a[j] * g.w));
    }
    const t = P[0], th = fs[0];
    for (let j = 0; j < th.length; j++) rotateWorld(th[j], axisAngle(thumbAxis, (side === 'R' ? -1 : 1) * t[j] * g.w));
  }
  /** Versatz, der das Becken des Sitz-Clips auf unseren Sitz bringt (aus der Bip01-Spur des ersten Sitz-Clips) */
  _sitOffset() {
    const clip = this.clips.get('sit_idle_1') || this.clips.get('sit_breathe');
    const tr = clip && clip.tracks.find(t => t.name === 'Bip01.position');
    const p0 = tr ? V(tr.values[0], tr.values[1], tr.values[2]) : this.bones.root.position.clone();
    const seatH = (this.seat && this.seat.seatH) ?? 0.47;
    // Hüftgelenk ≈ 9 cm über der Sitzfläche, 10 cm hinter der Vorderkante (Sitzposition = Vorderkante − 4 cm)
    return V(-p0.x, seatH + 0.09 - p0.y, -0.1 - p0.z);
  }
  /** Füße auf den Boden: tiefster Fußknochen auf Knöchelhöhe der Ruhepose */
  _ground(dt) {
    const b = this.bones; if (!b.footL || !b.footR) return;
    b.footL.updateWorldMatrix(true, false); b.footR.updateWorldMatrix(true, false);
    const lo = Math.min(wpos(b.footL, _v1).y, wpos(b.footR, _v2).y);
    const err = (this.pos.y + this.rig.bindPos.footL.y) - lo;
    const before = this.groundOff;
    this.groundOff = clamp(damp(this.groundOff, this.groundOff + err, 12, dt), -0.4, 0.4);
    if (this.sitBlend < 0.02) { this.mesh.position.y += this.groundOff - before; this.mesh.updateMatrixWorld(true); }
  }
  _posture(dt) {
    const b = this.bones, f = this.forward(_f), right = _r.set(-f.z, 0, f.x);
    // Gesten dämpfen (wie Character): head/chest/spine [Nicken, –, Neigung]
    const gs = this.gestureSpeed;
    for (const k in this.gestureTarget) { const t = this.gestureTarget[k], g = this.gesture[k] || (this.gesture[k] = [0, 0, 0]); for (let i = 0; i < 3; i++) g[i] = damp(g[i], t[i], gs, dt); }
    for (const k in this.gesture) if (!(k in this.gestureTarget)) { const g = this.gesture[k]; for (let i = 0; i < 3; i++) g[i] = damp(g[i], 0, gs, dt); }
    this.headTilt = damp(this.headTilt, this.headTiltTarget, 3, dt);
    // [Nicken (vor +), Drehung (links +), Seitneigung]
    const tilt = (bone, p, y, r) => { if (Math.abs(p) + Math.abs(y) + Math.abs(r) < 1e-4) return; _qb.setFromAxisAngle(right, -p); axisAngle(f, r); _qb.premultiply(_qa); axisAngle(UP, y); _qb.premultiply(_qa); rotateWorld(bone, _qb); };
    const sp = this.gesture.spine || _zero, ch = this.gesture.chest || _zero;
    tilt(b.spine, this.lean + sp[0], sp[1], this.lean2 + sp[2]);
    tilt(b.chest, ch[0], ch[1], ch[2]);
    const hd = this.gesture.head || _zero;
    tilt(b.head, hd[0], hd[1], hd[2] + this.headTilt);
  }
  _updateLook(dt) {
    const b = this.bones;
    this.lookW = damp(this.lookW, this.lookTW, 4, dt);
    const f = this.forward(_f), left = _l.set(f.z, 0, -f.x);
    b.head.updateWorldMatrix(true, false);
    const e = b.head.matrixWorld.elements;
    _hf.set(e[4], e[5], e[6]).normalize();      // Kopf-Vorwärtsachse (lokal +Y) aus dem Clip
    const clipYaw = Math.atan2(_hf.dot(left), _hf.dot(f)), clipPitch = Math.asin(clamp(_hf.y, -1, 1));
    let dy = 0, dp = 0;
    if (this.lookTarget && this.lookW > 0.001) {
      this.saccadeT -= dt;
      if (this.saccadeT <= 0) { this.saccadeT = this.rng.range(0.25, 1.4); this.saccade.set(this.rng.range(-1, 1), this.rng.range(-0.6, 0.6), this.rng.range(-1, 1)).multiplyScalar(0.06); }
      const hc = wpos(b.head, _v1).addScaledVector(UP, 0.08).addScaledVector(_hf, 0.04);
      const d = _v2.copy(this.lookTarget).add(this.saccade).sub(hc);
      const fx = d.dot(f), lx = d.dot(left);
      let yaw = clamp(Math.atan2(lx, fx), -this.lookLimits.yaw, this.lookLimits.yaw);
      const pitch = clamp(Math.atan2(d.y, Math.hypot(fx, lx)), -this.lookLimits.down, this.lookLimits.up);
      if (fx < -0.1 && Math.abs(Math.atan2(lx, fx)) > 2.4) yaw = clipYaw + this.lookYaw;
      dy = (yaw - clipYaw) * this.lookW * this.lookShare; dp = (pitch - clipPitch) * this.lookW * this.lookShare;
    }
    this.lookYaw = damp(this.lookYaw, dy, 6.5, dt); this.lookPitch = damp(this.lookPitch, dp, 6.5, dt);
    const y = this.lookYaw, p = this.lookPitch;
    if (Math.abs(y) + Math.abs(p) > 1e-4) {
      const right = _r.set(-f.z, 0, f.x).applyAxisAngle(UP, y * 0.5);
      for (const [bone, ky, kp] of [[b.chest, 0.15, 0], [b.neck, 0.35, 0.4], [b.head, 0.5, 0.6]]) {
        _qb.setFromAxisAngle(UP, y * ky); axisAngle(right, p * kp); _qb.premultiply(_qa); rotateWorld(bone, _qb);
      }
    }
    // Augen: Rest bis ±0,35 rad, schnell, mit Sakkaden
    const ey = clamp((dy - this.lookYaw) + this.saccade.x * 0.6, -0.35, 0.35), ep = clamp((dp - this.lookPitch) + this.saccade.y * 0.5, -0.3, 0.3);
    this.eyeYaw = damp(this.eyeYaw, ey * Math.min(1, this.lookW * 1.5), 25, dt); this.eyePitch = damp(this.eyePitch, ep * Math.min(1, this.lookW * 1.5), 25, dt);
    if (b.eyeL && (Math.abs(this.eyeYaw) + Math.abs(this.eyePitch) > 1e-4)) {
      const right = _r.set(-f.z, 0, f.x).applyAxisAngle(UP, this.lookYaw);
      _qb.setFromAxisAngle(UP, this.eyeYaw); axisAngle(right, this.eyePitch); _qb.premultiply(_qa);
      rotateWorld(b.eyeL, _qb); rotateWorld(b.eyeR, _qb);
    }
  }
  /** Zwei-Knochen-IK in Weltkoordinaten (achsenunabhängig), Hand optional ausgerichtet ({ dir: Fingerrichtung, palm }) */
  _armIK(side, a) {
    const b = this.bones, ua = b['upperArm' + side], fa = b['foreArm' + side], hd = b['hand' + side];
    const fk0 = _fk[0].copy(ua.quaternion), fk1 = _fk[1].copy(fa.quaternion), fk2 = _fk[2].copy(hd.quaternion);
    hd.updateWorldMatrix(true, false);
    const S = wpos(ua, _v1), E = wpos(fa, _v2), W = wpos(hd, _v3);
    const la = this.L.upperArm, lb = this.L.foreArm;
    const dir = _v4.copy(a.target).sub(S); const dist = clamp(dir.length(), Math.abs(la - lb) + 0.02, (la + lb) * 0.999); dir.normalize();
    const pole = _v5.copy(a.pole).sub(S); pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 1e-8) pole.copy(E).sub(S).addScaledVector(dir, -E.clone().sub(S).dot(dir));
    pole.normalize();
    const cosA = clamp((la * la + dist * dist - lb * lb) / (2 * la * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const E2 = _e2.copy(S).addScaledVector(dir, la * cosA).addScaledVector(pole, la * sinA);
    const T2 = _t2.copy(S).addScaledVector(dir, dist);
    // Oberarm: Richtung Schulter→Ellbogen drehen
    const q1 = _q1.setFromUnitVectors(_u1.copy(E).sub(S).normalize(), _u2.copy(E2).sub(S).normalize());
    rotateWorld(ua, q1);
    // Unterarm: gedrehte Richtung Ellbogen→Handgelenk auf Ellbogen→Ziel
    const cur = _u1.copy(W).sub(E).normalize().applyQuaternion(q1);
    rotateWorld(fa, _q2.setFromUnitVectors(cur, _u2.copy(T2).sub(E2).normalize()));
    if (a.hand) {
      const hf = this.handFrame[side];
      worldQ(hd, _q3);
      const d1 = _u1.copy(hf.fing).applyQuaternion(_q3), n1 = _u2.copy(hf.palm).applyQuaternion(_q3);
      const d2 = _u3.copy(a.hand.dir).normalize();
      const r1 = _q4.setFromUnitVectors(d1, d2);
      n1.applyQuaternion(r1);
      const n2 = _u4.copy(a.hand.palm).addScaledVector(d2, -a.hand.palm.dot(d2));
      n1.addScaledVector(d2, -n1.dot(d2));
      if (n2.lengthSq() > 1e-8 && n1.lengthSq() > 1e-8) {
        n2.normalize(); n1.normalize();
        const ang = Math.atan2(_u5.copy(n1).cross(n2).dot(d2), n1.dot(n2));
        r1.premultiply(axisAngle(d2, ang));
      }
      rotateWorld(hd, r1);
    }
    if (a.w < 0.999) { ua.quaternion.slerpQuaternions(fk0, ua.quaternion.clone(), a.w); fa.quaternion.slerpQuaternions(fk1, fa.quaternion.clone(), a.w); hd.quaternion.slerpQuaternions(fk2, hd.quaternion.clone(), a.w); }
  }
  _updateFace(dt, time) {
    const M = this.morph;
    // Blinzeln
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = this.rng.range(2.0, 6.0) * (this.rng.chance(0.15) ? 0.15 : 1); }
    this.blink = Math.max(0, this.blink - dt / 0.14);
    const closed = Math.max(Math.sin(this.blink * Math.PI), this.sleepy ? 0.85 : 0, clamp(-this.eyePitch * 0.8, 0, 0.3));
    if (M && M.blinkL >= 0) { M.inf[M.blinkL] = closed; if (M.blinkR >= 0) M.inf[M.blinkR] = closed; }
    else for (const [o, p, d] of this.lids) o.position.copy(p).addScaledVector(d, closed);
    // Mund: Lautstärke/Visem-Spur; ohne Spur Silbenrhythmus
    this.talk = damp(this.talk, this.talkTarget, 10, dt);
    this.talkPhase += dt * (9 + Math.sin(time * 1.3) * 2);
    let syll = Math.max(0, Math.sin(this.talkPhase) * 0.7 + Math.sin(this.talkPhase * 2.3 + 1) * 0.3);
    if (this.talkEnvValue != null) { this.envSmooth = damp(this.envSmooth || 0, Math.min(1, this.talkEnvValue * 1.8), 18, dt); syll = this.envSmooth; }
    const vis = this.talkVis;
    if (M && M.vis.A >= 0) {
      for (const k in M.vis) if (M.vis[k] >= 0) M.inf[M.vis[k]] = 0;
      if (this.talk > 0.02) {
        if (vis && vis.v0) {
          const amp = this.talk * clamp(0.35 + (vis.e || 0), 0, 1);
          const i0 = M.vis[vis.v0], i1 = M.vis[vis.v1];
          if (i0 >= 0) M.inf[i0] += (1 - vis.f) * amp;
          if (i1 >= 0) M.inf[i1] += vis.f * amp;
        } else { M.inf[M.vis.A] = this.talk * syll * 0.7; if (M.vis.E >= 0) M.inf[M.vis.E] = this.talk * (1 - syll) * 0.25; }
      }
      if (M.jaw >= 0) M.inf[M.jaw] = this.talk * (vis ? vis.jaw * 0.25 : syll * 0.15);
    } else if (this.bones.jaw) {
      const open = this.talk * (vis ? vis.jaw : syll) * 0.22;
      this.bones.jaw.quaternion.multiply(_qb.setFromAxisAngle(_zAxis, open));
    }
    // Brauen
    this.brow = damp(this.brow, this.browTarget, 5, dt);
    if (M && M.brow >= 0) { M.inf[M.brow] = this.brow * 0.8; if (M.browOL >= 0) M.inf[M.browOL] = this.brow * 0.4; if (M.browOR >= 0) M.inf[M.browOR] = this.brow * 0.4; }
    else for (const [o, p] of this.browBones) o.position.copy(p).addScaledVector(_xAxis, this.brow * 0.004);
  }
}
const _fk = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
const _u1 = V(), _u2 = V(), _u3 = V(), _u4 = V(), _u5 = V(), _e2 = V(), _t2 = V();
const _zAxis = V(0, 0, 1), _xAxis = V(1, 0, 0), _zero = [0, 0, 0];

/** Knochen nach Rocketbox-Namen im Rig finden */
export function findBone(rig, name) {
  if (rig.bones[name]) return rig.bones[name];
  const list = rig.skeleton ? rig.skeleton.bones : [];
  return list.find(b => b.name === name) || null;
}

/**
 * Griffpunkte für Requisiten (Kreide, Glas, Laserpointer …): wie der Fingerknochen der bisherigen Figuren ausgerichtet
 * (−Y entlang der Finger, +Z zur Handfläche), Ursprung an den Fingerknöcheln. Wird als rig.bones.fingersL/R eingetragen.
 */
export function addGrips(rig) {
  for (const s of ['L', 'R']) {
    const hd = rig.bones['hand' + s], f2 = findBone(rig, `Bip01_${s}_Finger2`), f1 = findBone(rig, `Bip01_${s}_Finger1`), f4 = findBone(rig, `Bip01_${s}_Finger4`);
    if (!hd || !f2 || !f1 || !f4) continue;
    const fing = f2.position.clone().normalize(), side = f1.position.clone().sub(f4.position).normalize();
    const palm = s === 'R' ? side.clone().cross(fing).normalize() : fing.clone().cross(side).normalize();
    const y = fing.clone().negate(), z = palm.clone().addScaledVector(y, -palm.dot(y)).normalize(), x = y.clone().cross(z);
    const g = new THREE.Object3D(); g.name = 'grip' + s;
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    g.position.copy(f2.position);
    hd.add(g); rig.bones['fingers' + s] = g;
    // dieselbe Ausrichtung am Handgelenk (für Dinge, die in der Hand liegen, z. B. das Handy)
    const p = new THREE.Object3D(); p.name = 'palm' + s; p.quaternion.copy(g.quaternion); hd.add(p); rig.bones['palm' + s] = p;
  }
  return rig;
}
