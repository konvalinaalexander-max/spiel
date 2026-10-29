// Echte Menschenmodelle (Auftrag V3, Phase 4): GLB aus tools/pipeline/blender/human.py → Figur im Format von buildCharacter
// (mesh, bones, skeleton, bindPos, lengths), damit Character, Crowd, ProfView und PlayerView unverändert weiterlaufen.
//
// Das GLB trägt bereits die Knochennamen des Spiels. Beim Laden wird das Skelett neu aufgebaut: Knochen ohne Eigendrehung,
// nur mit Gelenkposition (wie das prozedurale Skelett in rig.js). So bedeuten alle Posen, IK-Achsen und Blickwinkel dasselbe
// wie bisher: Arme hängen in der Ruhepose senkrecht, Handflächen zum Körper, Figur blickt nach +z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FINGERS = [2, 3, 4, 5];
// Verteilung der Fingerkrümmung auf die drei Glieder (Grund-, Mittel-, Endglied) und je Finger (Zeige- bis kleiner Finger)
const CURL_SEG = [0.75, 1.0, 0.7], CURL_FINGER = { 2: 0.85, 3: 1.0, 4: 1.08, 5: 1.18 };

/**
 * scene: gltf.scene, meta: *.meta.json der Pipeline (joints, parents, fingers), materials: (kind, srcMaterial) → Material
 * Rückgabe wie buildCharacter, zusätzlich fingerBones (für drei Fingerglieder) und kinds (Materialart je Gruppe).
 */
export function rigFromGLTF(scene, meta, materials) {
  scene.updateMatrixWorld(true);
  const names = Object.keys(meta.parents);
  const index = Object.fromEntries(names.map((n, i) => [n, i]));
  const geos = [], mats = [], kinds = [];
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const g = new THREE.BufferGeometry();
    const src = o.geometry;
    for (const a of ['position', 'normal', 'uv', 'skinWeight']) if (src.attributes[a]) g.setAttribute(a, src.attributes[a].clone());
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (src.index) g.setIndex(src.index.clone());
    // in den Figurraum (Szene-Wurzel) bringen
    g.applyMatrix4(o.matrixWorld);
    // Knochenindizes auf das neue Skelett umschreiben
    const si = src.attributes.skinIndex, map = o.skeleton.bones.map(b => index[b.name] ?? 0);
    const arr = new Uint16Array(si.count * 4);
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) arr[i * 4 + k] = map[si.getComponent(i, k)];
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(arr, 4));
    const kind = (o.material.name.match(/_(body|clothes|hair|eyebrow|eyelash|eyes|teeth|tongue)_/) || [, 'clothes'])[1];
    geos.push(g); kinds.push(kind); mats.push(materials ? materials(kind, o.material) : o.material);
  });
  const geo = geos.length > 1 ? mergeGeometries(geos, true) : geos[0];
  geos.forEach(g => g !== geo && g.dispose());
  geo.computeBoundingSphere();

  // Skelett: Gelenkpositionen, keine Eigendrehung
  const bindPos = {}, bones = {}, list = [];
  for (const n of names) bindPos[n] = new THREE.Vector3(...meta.joints[n]);
  for (const n of names) {
    const b = new THREE.Bone(); b.name = n;
    const p = meta.parents[n];
    b.position.copy(bindPos[n]); if (p) b.position.sub(bindPos[p]);
    bones[n] = b; list.push(b);
    if (p) bones[p].add(b);
  }
  const skeleton = new THREE.Skeleton(list);
  const mesh = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]);
  mesh.add(bones.root);
  bones.root.updateMatrixWorld(true);
  mesh.bind(skeleton);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const lengths = {
    upperArm: bindPos.foreArmL.distanceTo(bindPos.upperArmL), foreArm: bindPos.handL.distanceTo(bindPos.foreArmL),
    thigh: bindPos.shinL.distanceTo(bindPos.thighL), shin: bindPos.footL.distanceTo(bindPos.shinL), hipHeight: bindPos.hips.y,
    ankle: bindPos.footL.y
  };
  const fingerBones = meta.fingers === 'full' ? { L: fingerSet(bones, 'L'), R: fingerSet(bones, 'R') } : null;
  return { mesh, bones, skeleton, bindPos, lengths, spec: meta.spec || {}, H: meta.height / 1.76, kinds, fingerBones, human: true, face: FACE };
}

function fingerSet(bones, s) {
  return { fingers: FINGERS.map(n => ['a', 'b', 'c'].map(k => bones[`f${n}${k}${s}`])), thumb: [bones[`thumbB${s}`], bones[`thumbC${s}`]] };
}

// Gesicht: Lid und Kiefer des MakeHuman-Skeletts drehen um die Augen- bzw. Kiefermitte. Ruhepose = Lid offen,
// daher wird der Lidwinkel der prozeduralen Figur (offen −0,95, zu +0,12) auf 0 … LID_CLOSED umgerechnet.
export const FACE = { lidOpen: -0.95, lidScale: 0.62, jawScale: 1.25, browScale: 1.0 };

/**
 * Fingerkrümmung auf die Glieder verteilen. Die Spielposen setzen nur „fingers“ und „thumb“ (eine Drehung je Hand);
 * bei echten Händen folgt jedes Glied mit eigenem Anteil – das ergibt eine natürlich gerundete Hand statt einer Platte.
 */
export function applyFingerCurl(rig) {
  const fb = rig.fingerBones; if (!fb) return;
  for (const s of ['L', 'R']) {
    const f = rig.bones['fingers' + s].rotation, set = fb[s];
    FINGERS.forEach((n, i) => {
      const c = CURL_FINGER[n];
      set.fingers[i].forEach((b, k) => { const w = CURL_SEG[k] * c; b.rotation.set(f.x * w, k === 0 ? f.y * (1 - i * 0.15) : 0, f.z * w); });
    });
    const t = rig.bones['thumb' + s].rotation;
    set.thumb[0].rotation.set(t.x * 0.6, t.y * 0.6, t.z * 0.8); set.thumb[1].rotation.set(t.x * 0.5, t.y * 0.4, t.z * 0.7);
  }
}
