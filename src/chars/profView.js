// Darstellung des Profs: überträgt die Logik (Position, Blick, Tätigkeit) auf das Rig und erzeugt
// glaubwürdige Animation: Gehen, Gesten, Schreiben mit Hand-IK am Kreidestrich, Laserpointer, Pult, Trinken.
import * as THREE from 'three';
import { buildCharacter } from './rig.js';
import { Character } from './character.js';
import { PROF_SPEC } from '../game/population.js';
import * as LY from '../scene/layout.js';
import { damp, clamp, makeRng } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Additive Gesten (Euler XYZ, Radiant); osz = optionale Oszillation (Bone, Achse, Amplitude, Frequenz)
const GESTURES = {
  none: { pose: {}, osz: [] },
  explain: { pose: { upperArmR: [-0.75, 0.1, -0.22], foreArmR: [-1.0, 0, 0], handR: [0.1, -0.5, 0], upperArmL: [-0.2, 0, 0.12], foreArmL: [-0.45, 0, 0] }, osz: [['foreArmR', 0, 0.16, 2.1], ['upperArmR', 1, 0.1, 1.3]] },
  count: { pose: { upperArmL: [-0.85, -0.25, 0.25], foreArmL: [-1.2, 0, 0], upperArmR: [-0.65, 0.2, -0.2], foreArmR: [-1.25, 0, 0], fingersL: [0, 0, 0.6] }, osz: [['foreArmR', 0, 0.12, 2.6]] },
  question: { pose: { upperArmR: [-0.55, 0, -0.38], foreArmR: [-0.95, 0, 0], upperArmL: [-0.55, 0, 0.38], foreArmL: [-0.95, 0, 0], handR: [0, 0, 0.9], handL: [0, 0, -0.9], browL: [0, 0, 0] }, osz: [] },
  emphasis: { pose: { upperArmR: [-0.9, 0.05, -0.18], foreArmR: [-1.35, 0, 0], fingersR: [0, 0, 1.2] }, osz: [['foreArmR', 0, 0.22, 3.0]] },
  open: { pose: { upperArmR: [-0.35, 0, -0.62], foreArmR: [-0.55, 0, 0], upperArmL: [-0.35, 0, 0.62], foreArmL: [-0.55, 0, 0], handR: [0, 0, 0.5], handL: [0, 0, -0.5] }, osz: [['upperArmR', 2, 0.06, 1.2], ['upperArmL', 2, 0.06, 1.2]] },
  shrug: { pose: { clavR: [0, 0, -0.14], clavL: [0, 0, 0.14], upperArmR: [-0.2, 0, -0.35], upperArmL: [-0.2, 0, 0.35], foreArmR: [-0.7, 0, 0], foreArmL: [-0.7, 0, 0] }, osz: [] },
  pocket: { pose: { upperArmR: [0.28, 0, -0.16], upperArmL: [0.28, 0, 0.16], foreArmR: [-0.75, 0, 0], foreArmL: [-0.75, 0, 0], handR: [0, 0.6, 0], handL: [0, -0.6, 0] }, osz: [] },
  glasses: { pose: {}, osz: [] },
  point: { pose: {}, osz: [] },
  drink: { pose: {}, osz: [] }
};

export class ProfView {
  constructor(gfx, mat, logic, fixtures, audio, humans = null) {
    this.logic = logic; this.fx = fixtures; this.audio = audio;
    this.rig = (humans && humans.hero('prof')) || buildCharacter(PROF_SPEC, mat);
    this.char = new Character(this.rig, { floorAt: LY.floorAt, seed: 77 });
    gfx.scene.add(this.rig.mesh);
    this.char.lookLimits = { yaw: 1.45, up: 0.6, down: 0.9 };
    this.char.placeAt(logic.pos.x, logic.pos.z, logic.yaw);
    this.rng = makeRng(5);
    this.talkT = 0; this.gestureName = 'none'; this.gW = 0; this.t = 0;
    this.lookPt = V();
    this.mood = { brow: 0, tilt: 0 };
    // Requisiten: Kreide, Laserpointer, Wasserglas, Clicker
    const chalkMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ea, roughness: 0.95 }); gfx.register(chalkMat);
    this.chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), chalkMat);
    this.chalk.rotation.x = Math.PI / 2; this.chalk.position.set(0.0, -0.1, 0.04);
    this.rig.bones.fingersR.add(this.chalk); this.chalk.visible = false;
    const lp = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.35, metalness: 0.6 }); gfx.register(lp);
    this.laser = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 10), lp);
    this.laser.position.set(0, -0.06, 0.03); this.rig.bones.fingersR.add(this.laser); this.laser.visible = false;
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false, transparent: true, opacity: 0.95 }));
    this.dot.visible = false; gfx.scene.add(this.dot);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xe6f2f6, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0 }); gfx.register(glassMat);
    this.glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.11, 16, 1, true), glassMat);
    this.glass.position.set(0.0, -0.09, 0.05); this.rig.bones.fingersR.add(this.glass); this.glass.visible = false;
    this.clicker = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.018), lp); this.clicker.position.set(0, -0.06, 0.02);
    this.rig.bones.fingersL.add(this.clicker); this.clicker.visible = true;
    this.laserPt = V(LY.SCREEN.x, LY.SCREEN.y, LY.SCREEN.z + 0.005); this.laserGoal = this.laserPt.clone(); this.laserT = 0;
    this.clickT = 0; this.glassesT = 0;
    this.char.onStep = f => this.onStep && this.onStep(f, this.char);
    this.caughtT = 0;
    // Tafelschwamm (beim Wischen statt Kreide)
    const spMat = new THREE.MeshStandardMaterial({ color: 0xe8c547, roughness: 1 }); gfx.register(spMat);
    this.sponge = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.07), spMat); this.sponge.position.set(0, -0.05, 0.03);
    this.rig.bones.fingersR.add(this.sponge); this.sponge.visible = false;
    this.pushT = 0; this.pushDur = 1; this.wipeT = 0;
  }
  /** Schiebetafel hochschieben: beide Hände an die Unterkante */
  boardPush(dur = 2) { this.pushT = dur; this.pushDur = dur; }
  /** Tafel wischen (Schwamm in der rechten Hand) */
  wipe(dur = 3) { this.wipeT = dur + 0.4; }
  say(dur) { this.talkT = Math.max(this.talkT, dur); }
  clickerPress() { this.clickT = 0.45; }
  caught(dur = 4) { this.caughtT = dur; }
  update(dt, t, pen, wipePen) {
    const L = this.logic, c = this.char, b = this.rig.bones;
    this.t += dt;
    // Position/Ausrichtung aus der Logik (Füße stellt die Schrittsteuerung)
    c.pos.x = L.pos.x; c.pos.z = L.pos.z; c.yaw = L.yaw; c.walkSpeed = L.speed;
    // Blick: Punkt in Blickrichtung (5 m)
    const e = L.eye(V()), g = L.gazeDir(V());
    this.lookPt.copy(e).addScaledVector(g, 5);
    c.setLook(this.lookPt, 1);
    // Sprechen
    this.talkT -= dt; c.talkTarget = (this.talkT > 0 || (this.audio && this.audio.speaking && L.talking)) ? 1 : 0;
    // Mimik
    const questioning = L.gesture === 'question' || this.caughtT > 0;
    c.browTarget = questioning ? 1 : 0;
    c.headTiltTarget = this.caughtT > 0 ? 0.12 : 0;
    this.caughtT -= dt;
    // Tätigkeiten → Arme
    const act = L.activity;
    this.wipeT = Math.max(0, this.wipeT - dt); this.pushT = Math.max(0, this.pushT - dt);
    this.sponge.visible = this.wipeT > 0;
    this.chalk.visible = !this.sponge.visible && (act === 'write' || (act === 'board' && L.face.mode === 'board'));
    this.laser.visible = L.face.mode === 'screen' && !L.walking;
    this.dot.visible = false;
    c.setArm('L', 0); c.setArm('R', 0);
    let gname = L.walking ? 'none' : (L.gesture || 'none');
    if (act === 'write' && pen) {
      // rechte Hand folgt dem Kreidestrich
      const tgt = pen.clone(); tgt.z += 0.05;
      const shoulder = c.local(-0.2, 1.45, 0);
      c.setArm('R', 1, tgt, shoulder.clone().add(V(-0.3, -0.6, 0.35)), { dir: V(0, 0.35, -1).normalize(), palm: V(-0.5, -0.4, -0.2).normalize() });
      gname = 'none';
      c.lean = damp(c.lean, 0.06, 4, dt);
    } else c.lean = damp(c.lean, 0, 4, dt);
    if (L.shoulder.phase === 1 || L.shoulder.phase === 2) c.setArm('R', act === 'write' ? 0.5 : 0, pen || undefined);
    if (this.laser.visible) {
      this.laserT -= dt;
      if (this.laserT <= 0) { this.laserT = this.rng.range(1.2, 2.8); this.laserGoal.set(LY.SCREEN.x + this.rng.range(-1.4, 1.2), LY.SCREEN.y + this.rng.range(-0.8, 0.7), LY.SCREEN.z + 0.006); }
      this.laserPt.lerp(this.laserGoal, 1 - Math.exp(-3 * dt));
      const jitter = V((Math.random() - 0.5) * 0.008, (Math.random() - 0.5) * 0.008, 0);
      this.dot.position.copy(this.laserPt).add(jitter); this.dot.visible = !L.glancing;
      const sh = c.local(-0.2, 1.42, 0);
      const dir = this.laserPt.clone().sub(sh).normalize();
      c.setArm('R', 1, sh.clone().addScaledVector(dir, 0.5), sh.clone().add(V(0, -0.5, 0)), { dir, palm: V(0, -1, 0) });
      gname = 'none';
    }
    if (act === 'lectern' && !L.walking) {
      // Hände auf dem Pult / Touchscreen
      const lx = LY.LECTERN.x, lz = LY.LECTERN.z;
      const fw = V(Math.sin(LY.LECTERN.yaw), 0, Math.cos(LY.LECTERN.yaw)), rt = V(Math.cos(LY.LECTERN.yaw), 0, -Math.sin(LY.LECTERN.yaw));
      const top = LY.PODIUM.h + 1.06;
      const tap = Math.max(0, Math.sin(this.t * 5.3)) * 0.015;
      const pr = V(lx, top + tap, lz).addScaledVector(fw, -0.12).addScaledVector(rt, -0.12);
      const plft = V(lx, top, lz).addScaledVector(fw, -0.15).addScaledVector(rt, 0.2);
      c.setArm('R', 0.9, pr, c.local(-0.5, 0.8, -0.2), { dir: fw.clone().multiplyScalar(-1).add(V(0, -0.3, 0)).normalize(), palm: V(0, -1, 0) });
      c.setArm('L', 0.9, plft, c.local(0.5, 0.8, -0.2), { dir: fw.clone().multiplyScalar(-1).add(V(0, -0.3, 0)).normalize(), palm: V(0, -1, 0) });
      gname = 'none';
    }
    if (this.wipeT > 0 && wipePen && !L.walking) {
      // Wischen: rechte Hand folgt dem Schwamm, Oberkörper leicht mitgedreht
      const tgt = wipePen.clone(); tgt.z += 0.06;
      c.setArm('R', 1, tgt, c.local(-0.5, 0.9, 0.3), { dir: V(0, 0.2, -1).normalize(), palm: V(0, 0, -1) });
      gname = 'none';
    }
    if (this.pushT > 0 && !L.walking) {
      // Hochschieben: beide Hände an der Unterkante des unteren Flügels, die Bewegung geht nach oben
      const k = 1 - this.pushT / this.pushDur, y = LY.BOARD.lowY + 0.12 + Math.min(1, k * 1.3) * 0.55, z = LY.BOARD.zFront + 0.06;
      const bx = clamp(c.pos.x, LY.BOARD.x - LY.BOARD.w / 2 + 0.3, LY.BOARD.x + LY.BOARD.w / 2 - 0.3);
      c.setArm('R', 1, V(bx - 0.22, y, z), c.local(-0.5, 0.9, 0.2), { dir: V(0, 1, -0.3).normalize(), palm: V(0, 0, -1) });
      c.setArm('L', 1, V(bx + 0.22, y, z), c.local(0.5, 0.9, 0.2), { dir: V(0, 1, -0.3).normalize(), palm: V(0, 0, -1) });
      this.chalk.visible = false; gname = 'none';
    }
    if (L.gesture === 'drink' && !L.walking) {
      this.glass.visible = true;
      const k = clamp((Math.sin(this.t * 0.9) + 1) / 2, 0, 1);
      const mouth = c.headWorld(V()).add(V(0, -0.08, 0)).addScaledVector(c.forward(V()), 0.1);
      const low = c.local(-0.22, 1.05, 0.3);
      c.setArm('R', 1, low.lerp(mouth, k), c.local(-0.5, 0.9, -0.2), { dir: V(0, 1, 0.2).normalize(), palm: V(-1, 0, 0) });
      gname = 'none';
    } else this.glass.visible = false;
    if (this.clickT > 0) { this.clickT -= dt; c.setArm('L', 0.8, c.local(0.25, 1.15, 0.38), c.local(0.6, 0.8, -0.2), { dir: V(0, 0, 1).applyAxisAngle(V(0, 1, 0), c.yaw), palm: V(0, -1, 0) }); }
    if (this.caughtT > 0 && !L.walking) {
      // offene Hand in Richtung des Spielers
      const target = L.player ? L.player.head.clone() : V(0, 1.6, 0);
      const sh = c.local(-0.2, 1.42, 0); const dir = target.sub(sh).normalize();
      c.setArm('R', 0.85, sh.clone().addScaledVector(dir, 0.48), sh.clone().add(V(0, -0.5, 0)), { dir, palm: V(0, 0.3, 0).add(dir).normalize() });
    }
    // zufällig: Brille richten
    this.glassesT -= dt;
    if (this.glassesT < 0 && !L.walking && act !== 'write' && gname === 'none' && this.rng.chance(dt * 0.03)) this.glassesT = 1.4;
    if (this.glassesT > 0) { const gl = c.headWorld(V()).add(V(0, 0.0, 0)).addScaledVector(c.forward(V()), 0.12); c.setArm('L', 0.9, gl, c.local(0.5, 0.9, 0), { dir: V(0, 1, 0), palm: c.forward(V()).negate() }); }
    // Gesten-Pose mit Oszillation
    const G = GESTURES[gname] || GESTURES.none;
    const pose = {};
    for (const k in G.pose) pose[k] = G.pose[k].slice();
    for (const [bone, ax, amp, f] of G.osz) { pose[bone] = pose[bone] || [0, 0, 0]; pose[bone][ax] += Math.sin(this.t * f * Math.PI * 2 / 2) * amp; }
    // Schulterblick: Oberkörper dreht mit
    if (L.shoulder.phase === 2 || L.shoulder.phase === 1) { pose.chest = [0, L.shoulder.side * (L.shoulder.phase === 2 ? 0.35 : 0.15), 0]; pose.spine = [0, L.shoulder.side * 0.15, 0]; }
    c.setGesture(pose, 5);
    c.update(dt, t);
  }
  get head() { return this.char.headWorld(V()); }
}
