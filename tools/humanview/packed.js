// Prüfansicht der verpackten Spielfiguren (HPK + KTX2): node tools/humanview-packed.mjs <id,id,...> [profil]
import * as THREE from 'three';
import { loadHumans } from '../../src/chars/humans.js';
import { Character } from '../../src/chars/character.js';
import { stripHead } from '../../src/chars/humanPack.js';
import { VISEMES } from '../../src/chars/visemes.js';
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
window.run = async (ids, W = 900, H = 1200) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.AgXToneMapping; renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a8f96);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x5a4a3a, 1.4));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(1.5, 3, 2.5); key.castShadow = !globalThis.NOSHADOW; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; scene.add(key);
  const H2 = await loadHumans({ renderer, msaaSamples: 4, register: m => { m.onBeforeCompile = (s) => { for (const p of m.userData.patches || []) p(s); }; m.customProgramCacheKey = () => m.userData.patchKey; return m; } });
  const shots = {}; const cam = new THREE.PerspectiveCamera(30, W / H, 0.02, 50);
  const shot = (name, pos, look, fov = 30, near = 0.02) => { cam.fov = fov; cam.near = near; cam.updateProjectionMatrix(); cam.position.copy(pos); cam.lookAt(look); renderer.render(scene, cam); shots[name] = renderer.domElement.toDataURL('image/png'); };
  for (let id of ids) {
    const remap = id.startsWith('mouthremap:'); if (remap) id = 'mouth:' + id.slice(11);
    const mouth = id.startsWith('mouth:'); const fp = id.startsWith('fp:'); const did = fp ? id.slice(3) : mouth ? id.slice(6) : id;
    const rig = H2.design(did, 0x3a6ea5); scene.add(rig.mesh);
    if (fp) stripHead(rig);
    if (remap) { // Prüfung: Lippen-Gewichte auf Kopf/Kiefer umhängen
      const names = rig.skeleton.bones.map(b => b.name), si = rig.mesh.geometry.attributes.skinIndex, to = { lipUp: 'head', lipCL: 'head', lipCR: 'head', lipLow: 'jaw' };
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { const n = names[si.getComponent(i, k)]; if (to[n]) si.setComponent(i, k, names.indexOf(to[n])); }
      si.needsUpdate = true;
    }
    const c = new Character(rig, { seed: 3 });
    c.placeAt(0, 0, 0); c.sitOn({ pos: V(0, 0, 0), yaw: 0, seatH: 0.46 }, true); c.lookTarget = V(0, 0.75, 0.6);
    for (let t = 0; t < 2; t += 1 / 30) {
      c.setArm('L', 1, V(0.1, 0.8, 0.42), V(0.6, 0.2, -0.4), { dir: V(-0.1, -0.15, 1).normalize(), palm: V(0, -1, 0) });
      c.setArm('R', 1, V(-0.08, 0.85, 0.5), V(-0.6, 0.2, -0.4), { dir: V(0.1, 0.1, 1).normalize(), palm: V(0, -1, 0) });
      c.update(1 / 30, t);
    }
    const hh = rig.bindPos.head.y;
    if (mouth) {
      // Mundformen nacheinander: Gesicht frontal, nah
      const hd0 = rig.bones.head.getWorldPosition(V());
      c.lookTarget = V(0, hd0.y, 3);
      for (let t = 0; t < 2; t += 1 / 30) c.update(1 / 30, t);
      for (const v of ['rest', 'A', 'E', 'I', 'O', 'U', 'F', 'M']) {
        c.talkTarget = 1; c.talk = 1; c.talkVis = globalThis.NOVIS ? null : VISEMES[v]; c.update(1 / 30, 3);
        if (v === 'rest') {
          rig.mesh.updateMatrixWorld(true); rig.skeleton.update();
          if (rig.bones.lipUp) { const sk = rig.skeleton, idx = n => sk.bones.findIndex(b => b.name === n);
          const skin = n => { const i = idx(n); return new THREE.Matrix4().multiplyMatrices(sk.bones[i].matrixWorld, sk.boneInverses[i]); };
          const dev = (a, b) => { const A = skin(a).elements, B = skin(b).elements; return Math.max(...A.map((x, k) => Math.abs(x - B[k]))).toFixed(5); };
          shots['__debug_' + did] = JSON.stringify({ lipUp_vs_head: dev('lipUp', 'head'), lipCL_vs_head: dev('lipCL', 'head'), lipLow_vs_jaw: dev('lipLow', 'jaw'),
            lipUpPos: rig.bones.lipUp.position.toArray().map(x => +x.toFixed(4)), lipUpBind: rig.bindPos.lipUp.clone().sub(rig.bindPos.head).toArray().map(x => +x.toFixed(4)),
            parent: rig.bones.lipUp.parent.name, headScale: rig.bones.head.scale.toArray(), headPos: rig.bones.head.position.toArray().map(x => +x.toFixed(4)), headBind: rig.bindPos.head.clone().sub(rig.bindPos.neck).toArray().map(x => +x.toFixed(4)) });
        } }
        const hd = rig.bones.head.getWorldPosition(V()); const mo = hd.clone().add(V(0, -0.035, 0.1));
        shot(did + (remap ? '_remap' : '') + '_mouth_' + v, mo.clone().add(V(0.04, 0.01, 0.34)), mo, 18);
        if (v === 'rest' && globalThis.CPUSKIN) {
          // Abweichung: echte Gewichte vs. Lippen auf Kopf/Kiefer umgehängt, und vs. Ruhelage (Bind)
          rig.mesh.updateMatrixWorld(true); rig.skeleton.update();
          const names = rig.skeleton.bones.map(b => b.name), si = rig.mesh.geometry.attributes.skinIndex, sw = rig.mesh.geometry.attributes.skinWeight, P = rig.mesh.geometry.attributes.position;
          const mUp = rig.bindPos.lipUp || rig.bindPos.head.clone().add(V(0, -0.0138, 0.1035)); let worst = [];
          const skinM = rig.skeleton.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, rig.skeleton.boneInverses[i]));
          for (let i = 0; i < P.count; i++) {
            const p0 = V(P.getX(i), P.getY(i), P.getZ(i)); if (p0.distanceTo(mUp) > 0.035) continue;
            const acc = V(); const desc = [];
            for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w <= 0) continue; const j = si.getComponent(i, k); acc.add(p0.clone().applyMatrix4(skinM[j]).multiplyScalar(w)); desc.push(names[j] + ':' + w.toFixed(2)); }
            const dh = acc.distanceTo(p0.clone().applyMatrix4(skinM[names.indexOf('head')]));
            worst.push([dh, i, desc.join(' ')]);
          }
          worst.sort((a, b) => b[0] - a[0]);
          shots['__debug2_' + did] = JSON.stringify(worst.slice(0, 8));
          { const out = {}; const t2 = V(); for (let i = 0; i < P.count; i++) { const p0 = V(P.getX(i), P.getY(i), P.getZ(i)); if (p0.distanceTo(mUp) > 0.035) continue; rig.mesh.getVertexPosition(i, t2); out[i] = [+t2.x.toFixed(5), +t2.y.toFixed(5), +t2.z.toFixed(5)]; } shots['__debug3_' + did] = JSON.stringify(out); }
          // dieselbe Pose auf der CPU berechnen und als starres Mesh zeigen
          rig.mesh.updateMatrixWorld(true); rig.skeleton.update();
          const g0 = rig.mesh.geometry, n = g0.attributes.position.count, pos = new Float32Array(n * 3), t = V();
          for (let i = 0; i < n; i++) { rig.mesh.getVertexPosition(i, t); pos.set([t.x, t.y, t.z], i * 3); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', g0.attributes.uv); g.setIndex(g0.index); g.computeVertexNormals();
          for (const gr of g0.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
          const mats = (Array.isArray(rig.mesh.material) ? rig.mesh.material : [rig.mesh.material]).map(m => new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.8, alphaTest: m.alphaTest, side: m.side }));
          const st = new THREE.Mesh(g, mats); st.matrixWorld.copy(rig.mesh.matrixWorld); st.matrixAutoUpdate = false; scene.add(st); rig.mesh.visible = false;
          shot(did + '_cpu_mouth_rest', mo.clone().add(V(0.04, 0.01, 0.34)), mo, 18);
          scene.remove(st); rig.mesh.visible = true;
        }
      }
      scene.remove(rig.mesh); continue;
    }
    if (fp) { const e = rig.bones.eyeL.getWorldPosition(V()).add(rig.bones.eyeR.getWorldPosition(V())).multiplyScalar(0.5); shot(id, e.clone().add(V(0, 0.0, 0.03)), V(0, 0.8, 0.45), 60, 0.05); }
    else { shot(id + '_full', V(1.4, 1.3, 2.6), V(0, 0.8, 0.1)); const nk = rig.bones.neck.getWorldPosition(V()); shot(id + '_face', nk.clone().add(V(0.12, 0.12, 0.55)), nk.clone().add(V(0, -0.05, 0)), 30); }
    scene.remove(rig.mesh);
  }
  return shots;
};
