// Prüfansicht für Figuren-GLBs mit Animationen: window.run({ views: [{ clip, t, cam: [x,y,z,tx,ty,tz,fov] }] }) → PNG-Daten
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
window.run = async (opts) => {
  const W = opts.w || 900, H = opts.h || 900;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9aa3ab);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.6;
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2); sun.position.set(2, 4, 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -0.5, near: 0.1, far: 12 }); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x8a7a66, 0.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  if (opts.chair) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0x4a3322 })); ch.position.set(0, 0.225, -0.05); ch.castShadow = ch.receiveShadow = true; scene.add(ch);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.45), new THREE.MeshStandardMaterial({ color: 0x5a3d29 })); desk.position.set(0, 0.74, 0.45); desk.castShadow = desk.receiveShadow = true; scene.add(desk); }
  const ktx2 = new KTX2Loader().setTranscoderPath(opts.basis || '').detectSupport(renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(b64(document.getElementById('glb').textContent).buffer, '');
  const root = gltf.scene; scene.add(root);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  if (opts.scale) root.scale.setScalar(opts.scale);
  const mixer = new THREE.AnimationMixer(root);
  const extra = opts.clipsGlb ? (await loader.parseAsync(b64(document.getElementById('clips').textContent).buffer, '')).animations : [];
  const clips = [...gltf.animations, ...extra];
  const out = { clips: clips.map(c => c.name + ' ' + c.duration.toFixed(2)), shots: {} };
  const cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 50);
  for (const v of opts.views || []) {
    mixer.stopAllAction();
    const clip = clips.find(c => c.name === v.clip) || (v.clip == null ? null : clips[v.clip]);
    if (clip) { const a = mixer.clipAction(clip); a.reset().play(); mixer.setTime(v.t || 0); }
    root.updateMatrixWorld(true);
    const c = v.cam || [0, 1.4, 3, 0, 1, 0, 35]; cam.position.set(c[0], c[1], c[2]); cam.lookAt(c[3], c[4], c[5]); cam.fov = c[6] || 35; cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    out.shots[v.name || (v.clip + '_' + v.t)] = renderer.domElement.toDataURL('image/png');
  }
  return out;
};
