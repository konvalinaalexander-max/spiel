// Spieler:in in der Ich-Perspektive: eigener Körper (Kopf ausgeblendet), Hände am Laptop / Kuli / Deckel,
// Kamera an den Augen, Übergänge Zuhören ↔ Laptop ↔ Mitschreiben, Kopfbewegung, Atmen, Erschrecken.
import * as THREE from 'three';
import { buildCharacter } from './rig.js';
import { Character } from './character.js';
import { stripHead } from './humanPack.js';
import * as LY from '../scene/layout.js';
import { clamp, damp, lerp, smoothstep } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ONE = new THREE.Vector3(1, 1, 1);

export const AVATARS = {
  a: { female: false, height: 1.0, build: 1.0, skin: 0xefc7a8, hair: 0x4a3524, hairStyle: 'short', top: { type: 'hoodie', color: 0x4d5257, color2: 0x00aa5a }, legs: { color: 0x2c3e58 }, shoes: { color: 0xe9e7e2 }, watch: 0x222222 },
  b: { female: true, height: 0.96, build: 0.94, skin: 0xc99a74, hair: 0x2a1d14, hairStyle: 'long', top: { type: 'sweater', color: 0x7a2e2e }, legs: { color: 0x22242a }, shoes: { color: 0x3b2a1e } },
  c: { female: false, height: 1.02, build: 1.04, skin: 0x7a5236, hair: 0x15100c, hairStyle: 'buzz', top: { type: 'flannel', color: 0x2f5f8a, color2: 0x1d3c5a, shirt: 0x222222 }, legs: { color: 0x3a3d42 }, shoes: { color: 0x1a1a1a } }
};

export class PlayerView {
  constructor(gfx, mat, session, props, avatarId = 'a', humans = null) {
    this.gfx = gfx; this.session = session; this.props = props;
    this.rig = (humans && humans.hero('player_' + (AVATARS[avatarId] ? avatarId : 'a'))) || buildCharacter(AVATARS[avatarId] || AVATARS.a, mat);
    this.char = new Character(this.rig, { floorAt: LY.floorAt, seed: 3 });
    this.rig.mesh.castShadow = true;
    this.rig.mesh.receiveShadow = false; // keine Eigenschatten-Akne an Händen/Ärmeln direkt vor der Kamera
    gfx.scene.add(this.rig.mesh);
    // Augenposition relativ zum Kopf-Bone (vor dem Ausblenden des Kopfes)
    const b = this.rig.bones;
    this.eyeLocal = b.eyeL.position.clone().add(b.eyeR.position).multiplyScalar(0.5).add(V(0, 0.005, 0.02));
    if (this.rig.human) stripHead(this.rig); else b.head.scale.setScalar(0.001);
    // Nahbereich ausblenden: Am Laptop rückt die Kamera vor den Kopf; der eigene Unterarm streift dann knapp an ihr vorbei und
    // füllt als riesiger Keil das Bild. Alles der eigenen Figur, was näher als 16 cm an der Kamera liegt, wird nicht gezeichnet
    // (Hände am Touchpad liegen bei ≥ 25 cm). Der Schatten bleibt vollständig.
    const mats = Array.isArray(this.rig.mesh.material) ? this.rig.mesh.material : [this.rig.mesh.material];
    for (const m of this.rig.human ? mats : []) {
      const near = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif (length(vViewPosition) < 0.16) discard;'); };
      if (m.userData.patches) { m.userData.patches.push(near); m.userData.patchKey = (m.userData.patchKey || 'p') + 'Near'; }
      else { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); near(sh); }; m.customProgramCacheKey = () => 'playerNear'; }
      m.needsUpdate = true;
    }
    this.yaw = 0; this.pitch = -0.09; // Kopf relativ zur Blickrichtung nach vorne (−z)
    this.camYaw = 0; this.camPitch = 0;
    this.lookOff = V(); this.shake = 0; this.startle = 0; this.t = 0;
    this.cursorHand = V(); this.click = 0; this.lidReach = 0; this.typing = 0;
    this.fovBase = 60; this.fov = 60;
    this.seat(session.seatInfo);
  }
  seat(s) {
    this.seatInfo = s;
    this.char.sitOn({ pos: V(s.x, s.floor, s.z - 0.04), yaw: Math.PI, seatH: LY.SEAT_H + 0.02 }, true);
    this.char.placeAt(s.x, s.z - 0.04, Math.PI); this.char.sitOn({ pos: V(s.x, s.floor, s.z - 0.04), yaw: Math.PI, seatH: LY.SEAT_H + 0.02 }, true);
  }
  /** Blick für eine Weile auf einen Punkt ziehen (Erwischt, Frage an dich) */
  lookAtPoint(p, dur = 2) { this.forceLook = { p: p.clone(), t: dur }; }
  /** Weltpunkt relativ zum Sitz (Blick −z, rechts = +x) */
  L(x, y, z, out = V()) { const s = this.seatInfo; return out.set(s.x + x, s.floor + y, s.z + z); }
  eyeWorld(out = V()) {
    const b = this.rig.bones;
    b.neck.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().compose(b.head.position, b.head.quaternion, ONE).premultiply(b.neck.matrixWorld);
    return out.copy(this.eyeLocal).applyMatrix4(m);
  }
  /**
   * inp: { dx, dy } Mausbewegung (px) im Zuhör-Modus; laptop: { cursor (0..1), clicking, typing }
   */
  update(dt, t, inp) {
    this.t += dt;
    const S = this.session, p = S.player, c = this.char, lap = this.props.player.laptop, nb = this.props.player.notebook;
    const blend = smoothstep(0, 1, p.blend), notes = p.mode === 'notes' ? 1 : 0;
    this.notesBlend = damp(this.notesBlend || 0, notes, 6, dt);
    const nbB = this.notesBlend;
    this.zoom = damp(this.zoom || 0, inp?.zoom || 0, 7, dt);
    // Kopf: freie Blicksteuerung im Zuhör-Modus, eingeschränkt am Laptop/Heft
    if (inp && !inp.frozen) {
      const k = 0.0022 * lerp(1, 0.42, this.zoom); // eingezoomt feiner zielen
      if (blend < 0.5 && nbB < 0.5) { this.yaw = clamp(this.yaw - inp.dx * k, -1.45, 1.45); this.pitch = clamp(this.pitch - inp.dy * k, -0.95, 0.55); }
      else { this.lookOff.x = clamp(this.lookOff.x - inp.dx * k * 0.25, -0.25, 0.25); this.lookOff.y = clamp(this.lookOff.y - inp.dy * k * 0.25, -0.15, 0.2); }
    }
    if (this.forceLook && (this.forceLook.t -= dt) > 0) {
      const e = this.eyeWorld(V()), d = this.forceLook.p.clone().sub(e);
      const ty = Math.atan2(-d.x, -d.z), tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      const k = 1 - Math.exp(-dt * 5);
      this.yaw += (clamp(ty, -1.45, 1.45) - this.yaw) * k; this.pitch += (clamp(tp, -0.95, 0.55) - this.pitch) * k;
    } else this.forceLook = null;
    this.lookOff.multiplyScalar(Math.exp(-dt * 1.2));
    if (blend < 0.05 && nbB < 0.05) this.lookOff.set(0, 0, 0);
    // Körperhaltung: am Laptop nach vorne gebeugt, beim Schreiben tiefer
    c.lean = damp(c.lean, 0.06 + 0.2 * blend + 0.3 * nbB, 7, dt);
    c.lean2 = damp(c.lean2, 0.05 * nbB, 5, dt);
    // Blickziel für Nacken/Brust (die Kamera übernimmt die Feinsteuerung)
    const eye = this.eyeWorld(V());
    const fwdListen = V(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const scr = lap.screenWorld(0.5, 0.55, V());
    const page = this.props.player.notebook.group.localToWorld(V(-0.02, 0, 0.0));
    const toScr = scr.clone().sub(eye).normalize(), toPage = page.clone().sub(eye).normalize();
    const dir = fwdListen.clone().lerp(toScr, blend).lerp(toPage, nbB).normalize();
    if (blend > 0.05 || nbB > 0.05) { dir.x += this.lookOff.x * (1 - Math.abs(dir.x)); dir.y += this.lookOff.y; dir.normalize(); }
    // Erschrecken (Quiz, Erwischt): kurzer Ruck nach oben
    this.startle = Math.max(0, this.startle - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt);
    c.setLook(eye.clone().addScaledVector(dir, 3), 0.75);
    // ------------------------------------------------- Arme
    const rest = (side) => this.L(side * 0.17, LY.DESK_H + 0.04, -0.4 + 0.02);
    const poleR = this.L(0.45, 0.6, 0.1), poleL = this.L(-0.45, 0.6, 0.1);
    const handDown = { dir: V(0, -0.5, -1).normalize(), palm: V(0, -1, 0) };
    // Laptop: Hände auf Tastatur/Trackpad; rechte Hand folgt dem Cursor auf dem Trackpad
    lap.base.updateWorldMatrix(true, false);
    const kbL = lap.base.localToWorld(V(-0.07, 0.03, 0.0)), kbR = lap.base.localToWorld(V(0.07, 0.03, 0.0));
    const cur = inp?.cursor || { x: 0.5, y: 0.5 };
    const padPt = lap.base.localToWorld(V((cur.x - 0.5) * 0.08, 0.026 - this.click * 0.008, 0.045 + (cur.y - 0.5) * 0.05));
    this.click = Math.max(0, this.click - dt * 7);
    if (inp?.clicked) this.click = 1;
    this.typing = damp(this.typing, inp?.typing ? 1 : 0, 10, dt);
    const useTrackpad = inp?.mouseMoving ? 1 : 0;
    this._pad = damp(this._pad || 0, useTrackpad, 5, dt);
    const tw = Math.sin(t * 22) * 0.006 * this.typing;
    // Deckel anfassen
    this.lidReach = damp(this.lidReach, inp?.lidMoving ? 1 : 0, 8, dt);
    const lidTop = lap.lid.localToWorld(V(0.06, 0.004, 0.2));
    // Notizen: rechte Hand an der Stiftspitze, linke hält den Block
    // Griff: Handgelenk liegt entlang des Stifts hinter der Griffstelle, Finger zeigen zur Spitze
    const tipW = nb.tipWorld(V()), topW = nb.topWorld(V()), axis = topW.clone().sub(tipW).normalize();
    const tip = tipW.clone().addScaledVector(axis, 0.1).add(V(0.012, 0.012, 0));
    const nbHold = nb.group.localToWorld(V(-0.1, 0.03, 0.06));
    // Mischung
    const R = rest(1).lerp(kbR.clone().add(V(0, tw, 0)).lerp(padPt, this._pad * 0.85), blend).lerp(tip, nbB).lerp(lidTop, this.lidReach);
    const Lh = rest(-1).lerp(kbL.clone().add(V(0, -tw, 0)), blend).lerp(nbHold, nbB);
    // Zittern bei hohem Stress
    const tr = Math.max(0, (inp?.stress || 0) - 0.55) * 0.012;
    if (tr > 0) { R.x += Math.sin(t * 37) * tr; R.y += Math.sin(t * 41 + 1) * tr; Lh.x += Math.sin(t * 33 + 2) * tr; Lh.y += Math.sin(t * 39) * tr; }
    const dirR = V(-0.15, -0.6, -1).normalize().lerp(axis.clone().negate(), nbB * 0.9).normalize();
    const palmR = V(0, -1, 0.1).normalize().lerp(V(-1, -0.35, 0).normalize(), nbB).normalize();
    c.setArm('R', 1, R, poleR, { dir: dirR, palm: palmR });
    c.setArm('L', 1, Lh, poleL, { dir: V(0.15, -0.6, -1).normalize(), palm: handDown.palm });
    c.update(dt, t);
    // ------------------------------------------------- Kamera
    // Zuhören: an den Augen der Figur. Laptop/Heft: Blick senkrecht auf Bildschirm bzw. Seite
    // (Kopf beugt sich vor; die Kamera wird dafür auf eine ruhige Leseposition geführt).
    const cam = this.gfx.camera;
    const e2 = this.eyeWorld(V());
    e2.y += Math.sin(t * 1.5) * 0.002 + this.startle * 0.03 - (this.notesBlend || 0) * Math.max(0, Math.sin(t * 2.1)) * 0.012;
    const scrC = lap.screenWorld(0.5, 0.5, V()), scrN = lap.screenNormal(V());
    const lapEye = scrC.clone().addScaledVector(scrN, 0.33).add(V(0, 0.015, 0));
    const pageC = nb.group.localToWorld(V(0.0, 0.007, 0.01));
    const pageEye = pageC.clone().add(V(-0.04, 0.4, 0.2));
    const camPos = e2.clone().lerp(lapEye, blend * 0.92).lerp(pageEye, nbB * 0.9);
    // Fokus der Tiefenschärfe: tatsächlicher Abstand zu Bildschirm bzw. Heftseite
    this.focusDist = nbB > blend ? camPos.distanceTo(pageC) : camPos.distanceTo(scrC);
    if (this.shake > 0) { camPos.x += (Math.random() - 0.5) * 0.01 * this.shake; camPos.y += (Math.random() - 0.5) * 0.01 * this.shake; }
    // Mikro-Sakkaden beim Umschauen (abschaltbar über „Weniger Bewegung“)
    this._sacT = (this._sacT || 0) - dt;
    if (this._sacT <= 0) { this._sacT = 0.6 + Math.random() * 1.8; this._sac = this.reducedMotion ? V() : V((Math.random() - 0.5) * 0.006, (Math.random() - 0.5) * 0.004, 0); }
    let camDirT = fwdListen.clone().add(this._sac || V()).normalize();
    if (blend > 0.001) camDirT.lerp(scrC.clone().sub(camPos).normalize(), blend);
    if (nbB > 0.001) camDirT.lerp(pageC.clone().sub(camPos).normalize(), nbB);
    camDirT.normalize();
    if (blend > 0.05 || nbB > 0.05) { camDirT.x += this.lookOff.x * 0.6; camDirT.y += this.lookOff.y * 0.6; camDirT.normalize(); }
    cam.position.copy(camPos);
    this.camDir = (this.camDir || camDirT.clone()).lerp(camDirT, 1 - Math.exp(-dt * 18)).normalize();
    cam.up.set(0, 1, 0);
    cam.lookAt(camPos.clone().add(this.camDir));
    // FOV: am Laptop eingezoomt (Lesbarkeit), beim Heft etwas enger
    // „Genau hinschauen“ zoomt beim Zuhören auf etwa das 2,4-Fache (Tafel und Folien lesbar auch aus den hinteren Reihen)
    const fovT = lerp(lerp(this.fovBase * lerp(1, 0.42, this.zoom), 40, blend), 46, nbB);
    this.fov = damp(this.fov, fovT, 8, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    // für die Spiellogik: tatsächliche Kopfrotation relativ zur Sitzrichtung
    this.headYaw = Math.atan2(-this.camDir.x, -this.camDir.z); this.headPitch = Math.asin(clamp(this.camDir.y, -1, 1));
    return { eye: camPos, dir: this.camDir };
  }
}
