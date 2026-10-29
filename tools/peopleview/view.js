// Seite der Prüfansicht (tools/peopleview.mjs): Figur an Pultbank bzw. stehend, Clip-Steuerung wie im Spiel
import * as THREE from 'three';
import { loadHumans } from '../../src/chars/humans.js';
import { VISEMES } from '../../src/chars/visemes.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DESK_H = 0.76, DESK_D = 0.35, SEAT_H = 0.45, SEAT_D = 0.40;
window.run = async (specs, W = 800, H = 800) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping; renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a8f96);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a3a, 1.3));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4); key.position.set(1.5, 3.5, -1.5); key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -0.5 }); key.shadow.mapSize.set(2048, 2048); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe0e8ff, 0.8); fill.position.set(-2, 2, 2); scene.add(fill);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 }), floorM = new THREE.MeshStandardMaterial({ color: 0x6d6258, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // Pult (vor der Figur, −z) und Bank wie im Hörsaal: Pult rowFront … +0,35, Sitzmitte rowFront + 0,58
  const rowFront = -0.58, furn = new THREE.Group(); scene.add(furn);
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; furn.add(m); return m; };
  box(1.4, 0.03, DESK_D, 0, DESK_H - 0.015, rowFront + DESK_D / 2); box(1.4, 0.5, 0.02, 0, DESK_H - 0.28, rowFront + 0.01);
  box(1.4, 0.03, SEAT_D, 0, SEAT_H - 0.015, rowFront + 0.58); box(1.4, 0.45, 0.03, 0, SEAT_H + 0.23, rowFront + 0.58 + SEAT_D / 2 + 0.02);
  const laptop = box(0.32, 0.015, 0.22, 0, DESK_H + 0.008, rowFront + 0.2);
  const reg = m => { m.onBeforeCompile = s => { for (const p of m.userData.patches || []) p(s); }; m.customProgramCacheKey = () => m.userData.patchKey; return m; };
  const H2 = await loadHumans({ renderer, msaaSamples: 4, register: reg });
  const shots = {}; const cam = new THREE.PerspectiveCamera(30, W / H, 0.02, 50);
  const shot = (name, pos, look, fov = 30) => { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.copy(pos); cam.lookAt(look); renderer.render(scene, cam); shots[name] = renderer.domElement.toDataURL('image/png'); };
  shots.__clips = JSON.stringify(Object.fromEntries(Object.entries(H2.clips).map(([k, m]) => [k, [...m.keys()].length])));
  for (const spec of specs) {
    const [id, mode0, secs] = spec.split(':'); const T = +(secs || 4); const [mode, arg] = mode0.split('=');
    const rig = H2.hero(id) || H2.design(id, 0x3a6ea5); if (!rig) { shots['__missing_' + id] = '1'; continue; }
    scene.add(rig.mesh);
    const c = H2.character(rig, { seed: 5, fidgets: false }, id === 'prof' ? 'prof' : null);
    const sitting = !['stand', 'talk', 'walk'].includes(mode);
    furn.visible = sitting;
    const seat = { pos: V(0, 0, rowFront + 0.58 - 0.04), yaw: Math.PI, seatH: SEAT_H + 0.02 };
    if (sitting) { c.placeAt(seat.pos.x, seat.pos.z, Math.PI); c.sitOn(seat, true); c.activity = ['listen', 'type', 'work', 'sleep', 'calm', 'relaxed'].includes(mode) ? mode : 'listen'; }
    else { c.placeAt(0, 0, Math.PI); c.mode = 'stand'; c.sitBlend = 0; }
    if (mode === 'talk') { c.standPool = ['talk_1', 'talk_2', 'present_left', 'moderate_1']; c.talkTarget = 1; }
    if (mode === 'walk') c.walkSpeed = 1.1;
    if (mode === 'sleep') { c.sleepy = true; c.lean = 0.32; }
    if (mode === 'type' || mode === 'work') c.lean = 0.16;
    const look = V(0, 1.7, -5);
    for (let t = 0; t < T; t += 1 / 30) {
      c.setLook(mode === 'sleep' ? V(0, 0.7, -0.4) : look, 1);
      c.setArm('L', 0); c.setArm('R', 0);
      // Koordinaten wie crowd.js (Sitzmitte im Ursprung, Blick −z, rechts = +x)
      const L = (x, y, z) => V(x, y, z), deskPt = (x, dz = 0) => V(x, DESK_H + 0.03, rowFront + 0.28 + dz), poleR = L(0.4, 0.55, 0.15), poleL = L(-0.4, 0.55, 0.15);
      const handDir = V(0, -0.45, -1).normalize(), palm = V(0, -1, 0);
      if (mode === 'handup') c.setArm('R', 1, L(0.18, 1.62, -0.05), L(0.5, 1.1, 0.1), { dir: V(0, 1, 0), palm: V(0, 0, -1) });
      if (mode === 'phone') { c.setArm('R', 0.9, L(0.05, DESK_H + 0.14, -0.17), poleR, { dir: V(0, 0.4, -1).normalize(), palm: V(0, 0.5, 1).normalize() }); c.setArm('L', 0.9, L(-0.05, DESK_H + 0.12, -0.17), poleL, { dir: V(0, 0.4, -1).normalize(), palm: V(0, 0.5, 1).normalize() }); }
      if (mode === 'type') { const jR = Math.sin(t * 13) * 0.008, jL = Math.sin(t * 11.3) * 0.008; c.setArm('R', 0.95, deskPt(0.08 + jR, 0.06), poleR, { dir: handDir, palm }); c.setArm('L', 0.95, deskPt(-0.08 + jL, 0.06), poleL, { dir: handDir, palm }); }
      if (mode === 'work') { const wx = Math.sin(t * 2.3) * 0.035, wz = Math.sin(t * 7.1) * 0.006; c.setArm('R', 0.95, deskPt(0.09 + wx, 0.08 + wz), poleR, { dir: handDir, palm: V(-0.4, -1, 0).normalize() }); c.setArm('L', 0.8, deskPt(-0.14, 0.06), poleL, { dir: V(0.5, -0.3, -1).normalize(), palm }); }
      c.setGrip('R', mode === 'type' ? 'type' : mode === 'work' ? 'pen' : mode === 'phone' ? 'hold' : mode === 'handup' ? 'flat' : null, 1);
      c.setGrip('L', mode === 'type' ? 'type' : mode === 'phone' ? 'hold' : null, 1);
      if (mode === 'once' && t < 1 / 29) c.playOnce(arg, 0.3);
      if (mode === 'face') { c.talkTarget = 1; c.talkVis = { ...VISEMES.A, v0: 'A', v1: 'O', f: (t * 2) % 1, e: 0.8 }; c.browTarget = Math.sin(t) > 0 ? 1 : 0; }
      c.update(1 / 30, t);
    }
    const name = id + '_' + mode0.replace('=', '-');
    const hdp = rig.bones.head.getWorldPosition(V());
    if (sitting) {
      shot(name + '_side', V(2.2, 1.0, seat.pos.z - 0.25), V(0, 0.75, seat.pos.z - 0.25), 32);
      shot(name + '_front', V(-0.9, 1.45, -1.9), V(0, 0.85, seat.pos.z - 0.1), 32);
    } else {
      shot(name + '_side', V(2.6, 1.1, 0), V(0, 0.95, 0), 38);
      shot(name + '_front', V(0.6, 1.4, -3.2), V(0, 0.95, 0), 36);
    }
    if (sitting) shot(name + '_hands', V(0.05, DESK_H + 0.5, rowFront - 0.2), V(0, DESK_H, rowFront + 0.32), 36);
    const f = V(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    shot(name + '_face', hdp.clone().addScaledVector(f, 0.55).add(V(0.12, 0.12, 0)), hdp.clone().add(V(0, 0.07, 0)), 28);
    scene.remove(rig.mesh);
  }
  return shots;
};
