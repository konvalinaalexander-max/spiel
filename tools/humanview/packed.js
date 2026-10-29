// Prüfansicht der verpackten Spielfiguren (HPK + KTX2): node tools/humanview-packed.mjs <id,id,...> [profil]
import * as THREE from 'three';
import { loadHumans } from '../../src/chars/humans.js';
import { Character } from '../../src/chars/character.js';
import { stripHead } from '../../src/chars/humanPack.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
window.run = async (ids, W = 900, H = 1200) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping; renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a8f96);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a3a, 1.4));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(1.5, 3, 2.5); key.castShadow = true; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
  const H2 = await loadHumans({ renderer, msaaSamples: 4, register: m => { m.onBeforeCompile = (s) => { for (const p of m.userData.patches || []) p(s); }; m.customProgramCacheKey = () => m.userData.patchKey; return m; } });
  const shots = {}; const cam = new THREE.PerspectiveCamera(30, W / H, 0.02, 50);
  const shot = (name, pos, look, fov = 30, near = 0.02) => { cam.fov = fov; cam.near = near; cam.updateProjectionMatrix(); cam.position.copy(pos); cam.lookAt(look); renderer.render(scene, cam); shots[name] = renderer.domElement.toDataURL('image/png'); };
  for (const id of ids) {
    const fp = id.startsWith('fp:'); const did = fp ? id.slice(3) : id;
    const rig = H2.design(did, 0x3a6ea5); scene.add(rig.mesh);
    if (fp) stripHead(rig);
    const c = new Character(rig, { seed: 3 });
    c.placeAt(0, 0, 0); c.sitOn({ pos: V(0, 0, 0), yaw: 0, seatH: 0.46 }, true); c.lookTarget = V(0, 0.75, 0.6);
    for (let t = 0; t < 2; t += 1 / 30) {
      c.setArm('L', 1, V(0.1, 0.8, 0.42), V(0.6, 0.2, -0.4), { dir: V(-0.1, -0.15, 1).normalize(), palm: V(0, -1, 0) });
      c.setArm('R', 1, V(-0.08, 0.85, 0.5), V(-0.6, 0.2, -0.4), { dir: V(0.1, 0.1, 1).normalize(), palm: V(0, -1, 0) });
      c.update(1 / 30, t);
    }
    const hh = rig.bindPos.head.y;
    if (fp) { const e = rig.bones.eyeL.getWorldPosition(V()).add(rig.bones.eyeR.getWorldPosition(V())).multiplyScalar(0.5); shot(id, e.clone().add(V(0, 0.0, 0.03)), V(0, 0.8, 0.45), 60, 0.05); }
    else { shot(id + '_full', V(1.4, 1.3, 2.6), V(0, 0.8, 0.1)); const nk = rig.bones.neck.getWorldPosition(V()); shot(id + '_face', nk.clone().add(V(0.12, 0.12, 0.55)), nk.clone().add(V(0, -0.05, 0)), 30); }
    scene.remove(rig.mesh);
  }
  return shots;
};
