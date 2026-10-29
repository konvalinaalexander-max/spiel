// Testansicht für echte Figuren (tools/humanview.mjs): lädt ein GLB der Menschen-Pipeline, baut die Spielfigur und
// rendert feste Ansichten (stehend, seitlich, sitzend mit Händen auf der Tastatur, Hand gehoben, Gesicht, Hände).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { rigFromGLTF } from '../../src/chars/humanAsset.js';
import { Character } from '../../src/chars/character.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

window.run = async (b64, meta, W = 900, H = 1200) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a8f96);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a3a, 1.4));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(1.5, 3, 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  key.shadow.camera.left = key.shadow.camera.bottom = -1.5; key.shadow.camera.right = key.shadow.camera.top = 1.5; scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 1.1); rim.position.set(-2, 2.2, -2); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x7b6a58, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bin.buffer, '');
  const rig = rigFromGLTF(gltf.scene, meta, (kind, m) => {
    if (m.map) m.map.anisotropy = 8;
    m.transparent = false; m.depthWrite = true;
    if (kind === 'hair' || kind === 'eyebrow' || kind === 'eyelash') { m.alphaTest = 0.5; m.alphaToCoverage = true; m.side = THREE.DoubleSide; }
    if (kind === 'eyes') { m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; }
    return m;
  });
  scene.add(rig.mesh);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 50);
  const shots = {};
  const shot = (name, pos, look, fov = 30) => {
    cam.fov = fov; cam.aspect = W / H; cam.updateProjectionMatrix(); cam.position.copy(pos); cam.lookAt(look);
    renderer.render(scene, cam); shots[name] = renderer.domElement.toDataURL('image/png');
  };
  { const hh0 = rig.bindPos.head.y + 0.1; shot('bind_face', V(0.15, hh0, 0.75), V(0, hh0 - 0.02, 0), 22);
    const ms = Array.isArray(rig.mesh.material) ? rig.mesh.material : [rig.mesh.material];
    ms.forEach((m, i) => { m.userData.vis = m.visible; m.visible = rig.kinds[i] === 'eyes'; });
    shot('eyes_only', V(0.0, rig.bindPos.eyeL.y, 0.45), V(0, rig.bindPos.eyeL.y, 0), 12);
    ms.forEach(m => { m.visible = m.userData.vis; });
    if (window.HV_DEBUG) for (const k of ['teeth', 'eyes', 'eyelash', 'eyebrow', 'body']) {
      ms.forEach((m, i) => { m.visible = rig.kinds[i] !== k; });
      shot('hide_' + k, V(0.15, hh0, 0.75), V(0, hh0 - 0.02, 0), 22);
      ms.forEach(m => { m.visible = m.userData.vis; });
    } }
  const c = new Character(rig, { seed: 7 });
  const run = (sec, fn) => { for (let t = 0; t < sec; t += 1 / 30) { fn && fn(t); c.update(1 / 30, t); } };
  // Stehend (Ruhe), Blick in die Kamera
  c.placeAt(0, 0, 0); c.lookTarget = V(0, 1.6, 3); run(1.5);
  const hh = rig.bindPos.head.y + 0.1;
  shot('stand_front', V(0, 1.0, 4.6), V(0, 0.92, 0));
  shot('stand_side', V(4.6, 1.0, 0.2), V(0, 0.92, 0));
  shot('face', V(0.15, hh, 0.75), V(0, hh - 0.02, 0), 22);
  // Sitzen auf einem Hocker, Hände auf „Tastatur“ (IK), Finger leicht gekrümmt
  const stool = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.46, 0.42), new THREE.MeshStandardMaterial({ color: 0x5a4632 })); stool.position.set(0, 0.23, -0.06); scene.add(stool);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x8b6b4a })); desk.position.set(0, 0.74, 0.55); scene.add(desk);
  c.sitOn({ pos: V(0, 0, 0), yaw: 0, seatH: 0.46 }, true);
  c.lookTarget = V(0, 0.8, 0.5);
  c.setGesture({ fingersL: [0, 0, -0.45], fingersR: [0, 0, 0.45] }, 20);
  run(2, () => {
    c.setArm('L', 1, V(0.12, 0.79, 0.45), V(0.6, 0.2, -0.4), { dir: V(-0.1, -0.15, 1).normalize(), palm: V(0, -1, 0) });
    c.setArm('R', 1, V(-0.12, 0.79, 0.45), V(-0.6, 0.2, -0.4), { dir: V(0.1, -0.15, 1).normalize(), palm: V(0, -1, 0) });
  });
  shot('sit_type', V(1.8, 1.45, 2.6), V(0, 0.75, 0.2));
  shot('hands', V(0.0, 1.2, 1.15), V(0, 0.78, 0.42), 24);
  // Hand heben
  run(1.5, () => { c.setArm('R', 1, V(-0.25, 1.95, 0.25), V(-0.8, 1.0, -0.3), { dir: V(0, 1, 0.1).normalize(), palm: V(0, 0, 1) }); c.setArm('L', 0, null, null); });
  shot('sit_raise', V(0.4, 1.3, 3.2), V(0, 1.0, 0));
  const g = rig.mesh.geometry, pa = g.attributes.position; const cent = {};
  for (const gr of g.groups) { const k = rig.kinds[gr.materialIndex] + gr.materialIndex; const c = [0, 0, 0]; const idx = g.index; const seen = new Set();
    for (let i = gr.start; i < gr.start + gr.count; i++) { const vi = idx ? idx.getX(i) : i; if (seen.has(vi)) continue; seen.add(vi); c[0] += pa.getX(vi); c[1] += pa.getY(vi); c[2] += pa.getZ(vi); }
    cent[k] = c.map(x => +(x / seen.size).toFixed(3)).join(',') + ' n=' + seen.size; }
  const nodes = []; gltf.scene.traverse(o => { if (o.isSkinnedMesh) nodes.push(o.name + ' ' + o.matrixWorld.elements.map(x => +x.toFixed(2)).join(',')); });
  return { cent, nodes, shots, verts: rig.mesh.geometry.attributes.position.count, groups: rig.mesh.geometry.groups.length, kinds: rig.kinds };
};
