// Echte Figuren laden (Auftrag V3, Phase 4): HPK-Dateien aus tools/pipeline/humans-pack.mjs → Figur im Format von buildCharacter.
//
// HPK: gzip("HPK1" · u32 Länge JSON · JSON · Binärdaten). Das JSON beschreibt Gelenke, Eltern, Gruppen (deckend/Alpha) und die
// Puffer: position f32×3, normal i8×4, uv u16×2 (Atlas, Ursprung oben links), joints u8×4, weights u8×4,
// surf u8×4 (Rauheit, Normalenstärke, Teilart, frei). Teilart: 0 Haut, 1 Kleidung, 2 einfärbbares Oberteil, 3 Haar, 4 Augen, 5 Zähne.
//
// Das Skelett wird ohne Eigendrehung aufgebaut (nur Gelenkpositionen), genau wie das prozedurale Skelett in rig.js – damit
// gelten alle Posen, IK-Achsen und Blickwinkel der Figurensteuerung unverändert.
import * as THREE from 'three';
import { FACE } from './humanAsset.js';

const TYPES = { Float32Array, Int8Array, Int16Array, Uint16Array, Uint8Array, Uint32Array };

/** gzip-komprimierte HPK-Bytes → { head, arr } */
export async function decodeHPK(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const ab = await new Response(stream).arrayBuffer();
  const dv = new DataView(ab);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'HPK1') throw new Error('HPK: falsches Format');
  const jl = dv.getUint32(4, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, jl)));
  const arr = {};
  for (const b of head.buffers) arr[b.name] = new TYPES[b.type](ab, 8 + jl + b.offset, b.length);
  return { head, arr };
}

/** Geometrie aus HPK-Daten; groups = true: Gruppen 0 = deckend, 1 = Alpha (ältere Figuren mit zwei Materialien) */
export function hpkGeometry({ head, arr }, groups = true) {
  const n = head.vertices, g = new THREE.BufferGeometry();
  // Rocketbox-Figuren: Positionen als Int16 (head.posScale), ältere Figuren als Float32
  const pos = head.posScale ? Float32Array.from(arr.position, v => v * head.posScale) : arr.position;
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) nor[i * 3 + k] = arr.normal[i * 4 + k] / 127;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(arr.uv, 2, true));
  // Knochenindizes als u16: beim Zusammenführen vieler Figuren (Menge) werden sie verschoben
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(arr.joints), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(arr.weights, 4, true));
  g.setAttribute('aSurf', new THREE.BufferAttribute(arr.surf, 4, false));
  g.setIndex(new THREE.BufferAttribute(arr.index, 1));
  if (groups) head.groups.forEach((gr, i) => g.addGroup(gr.start, gr.count, gr.alpha ? 1 : 0));
  // Detailstufe 1 (nur Menge): anderes Indexfeld auf denselben Vertices – crowd.js wählt je Figur nach Abstand
  if (arr.index1 && head.groups1) g.userData.lod1 = { index: arr.index1, groups: groups ? head.groups1.map(gr => ({ start: gr.start, count: gr.count, materialIndex: gr.alpha ? 1 : 0 })) : [] };
  // Gesichtsformen (Rocketbox-Hauptfiguren): dünn besetzt gespeichert (Vertexindex + Versatz in 0,1 mm) → dichte Differenzen
  if (head.morphs && head.morphs.length) {
    g.morphAttributes.position = head.morphs.map(m => {
      const out = new Float32Array(n * 3), vi = arr[m.i], d = arr[m.d];
      for (let j = 0; j < vi.length; j++) { out[vi[j] * 3] = d[j * 3] * m.scale; out[vi[j] * 3 + 1] = d[j * 3 + 1] * m.scale; out[vi[j] * 3 + 2] = d[j * 3 + 2] * m.scale; }
      return new THREE.BufferAttribute(out, 3);
    });
    g.morphTargetsRelative = true;
    g.userData.morphNames = head.morphs.map(m => m.name);
  }
  g.computeBoundingSphere();
  return g;
}

/** Figur wie buildCharacter: { mesh, bones, skeleton, bindPos, lengths, spec, H, human, face, fingerBones } */
export function rigFromHPK(data, materials) {
  const { head } = data;
  // ein gemeinsames Material (Rocketbox, humanMaterial unified) → keine Gruppen, ein Draw Call je Figur
  const geo = hpkGeometry(data, Array.isArray(materials));
  const names = Object.keys(head.parents);
  const bindPos = {}, bones = {}, list = [];
  for (const nm of names) bindPos[nm] = new THREE.Vector3(...head.joints[nm]);
  for (const nm of names) {
    const b = new THREE.Bone(); b.name = nm;
    const p = head.parents[nm];
    if (head.rest) { const r = head.rest[nm]; b.position.set(r[0], r[1], r[2]); b.quaternion.set(r[3], r[4], r[5], r[6]); }   // Rocketbox: Knochen mit Eigendrehung
    else { b.position.copy(bindPos[nm]); if (p) b.position.sub(bindPos[p]); }
    bones[nm] = b; list.push(b); if (p) bones[p].add(b);
  }
  // Spielnamen (hips, handL …) zusätzlich auf die Rocketbox-Knochen zeigen lassen
  if (head.alias) for (const [k, v] of Object.entries(head.alias)) if (bones[v]) { bones[k] = bones[v]; bindPos[k] = bindPos[v]; }
  const skeleton = new THREE.Skeleton(list);
  const mesh = new THREE.SkinnedMesh(geo, materials);
  if (geo.userData.morphNames) { mesh.morphTargetDictionary = Object.fromEntries(geo.userData.morphNames.map((n, i) => [n, i])); mesh.morphTargetInfluences = geo.userData.morphNames.map(() => 0); }
  mesh.add(bones.root); bones.root.updateMatrixWorld(true); mesh.bind(skeleton);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'human-' + head.id;
  const lengths = {
    upperArm: bindPos.foreArmL.distanceTo(bindPos.upperArmL), foreArm: bindPos.handL.distanceTo(bindPos.foreArmL),
    thigh: bindPos.shinL.distanceTo(bindPos.thighL), shin: bindPos.footL.distanceTo(bindPos.shinL), hipHeight: bindPos.hips.y, ankle: bindPos.footL.y
  };
  const fingerSet = s => ({ fingers: [2, 3, 4, 5].map(f => ['a', 'b', 'c'].map(k => bones[`f${f}${k}${s}`])), thumb: [bones[`thumbB${s}`], bones[`thumbC${s}`]] });
  const fingerBones = head.fingers === 'full' && !head.rocketbox ? { L: fingerSet('L'), R: fingerSet('R') } : null;
  return { mesh, skinned: mesh, bones, skeleton, bindPos, lengths, spec: { female: head.female }, H: head.height / 1.76, human: true, face: FACE, fingerBones, design: head, rocketbox: !!head.rocketbox };
}

/**
 * Material für echte Figuren: Farbatlas (+ Normalenatlas), Rauheit und Normalenstärke je Vertex (aSurf), Einfärbung des
 * Oberteils je Person (aTint, nur Teilart 2). alpha = Haar/Brauen/Wimpern mit Alphatest (bei MSAA mit Alpha-to-Coverage).
 * unified = Haut, Kleidung und Haar in einem Material (ein Draw Call je Figur bzw. je zusammengeführter Menge): Alphatest und
 * beidseitig für alles; Haar (Teilart 3) behält die nach außen gekämmten Normalen und den schwächeren Glanz, alles andere
 * dreht die Normale auf Rückseiten wie üblich um.
 */
export function humanMaterial(gfx, { map, normalMap = null, alpha = false, tint = false, unified = false, name = 'human' }) {
  const hairOnly = unified ? 'vPart > 2.5' : 'true';
  const patch = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aSurf;\nvarying vec2 vSurf;${unified ? '\nvarying float vPart;' : ''}${tint ? '\nattribute vec3 aTint;\nvarying vec3 vTint;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvSurf = aSurf.xy / 255.0;${unified ? '\nvPart = aSurf.z;' : ''}${tint ? '\nvTint = abs(aSurf.z - 2.0) < 0.5 ? aTint : vec3(1.0);' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vSurf;${unified ? '\nvarying float vPart;' : ''}${tint ? '\nvarying vec3 vTint;' : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${tint ? '\ndiffuseColor.rgb *= vTint;' : ''}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.x;')
      // Haarkarten: Normalen sind nach außen gekämmt (tools/pipeline/hair.mjs) – Rückseiten nicht umdrehen, sonst N·V < 0 → Spiegelglanz
      .replace('#include <normal_fragment_begin>', alpha || unified ? THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', `( ${hairOnly} ? 1.0 : ( gl_FrontFacing ? 1.0 : - 1.0 ) )`) : '#include <normal_fragment_begin>')
      // Haar: schwächerer Glanz, kaum Streiflicht-Fresnel (sonst helle Linien an den Kartenkanten)
      .replace('#include <lights_physical_fragment>', alpha || unified ? `#include <lights_physical_fragment>\nif ( ${hairOnly} ) { material.specularColorBlended *= 0.5; material.specularF90 = 0.3; }` : '#include <lights_physical_fragment>')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vSurf.y;'));
  };
  const m = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.8, metalness: 0, name });
  if (normalMap) m.normalScale.set(1, -1); // Atlas aus glTF-Normalen (OpenGL-Konvention, UV-Ursprung oben links)
  if (alpha || unified) { m.alphaTest = 0.5; m.alphaToCoverage = !!gfx.msaaSamples; m.side = THREE.DoubleSide; }
  m.userData.patches = [patch]; m.userData.patchKey = name + (tint ? 'T' : '') + (alpha ? 'A' : '') + (unified ? 'U' : '') + (normalMap ? 'N' : '');
  return gfx.register ? gfx.register(m) : (m.onBeforeCompile = patch, m);
}

/**
 * Ich-Perspektive: Kopf, Haare, Augen der eigenen Figur weglassen (Dreiecke, deren drei Vertices überwiegend an Kopfknochen
 * hängen). Den Kopfknochen zu schrumpfen wie bei den prozeduralen Figuren zieht sonst Kragen- und Halsvertices mit
 * gemischten Gewichten zum Kopf hin – lange Dreiecke direkt vor der Kamera.
 */
export function stripHead(rig) {
  const g = rig.mesh.geometry, list = rig.skeleton.bones;
  // Kopf, Hals und Schlüsselbeinbereich liegen direkt an der Kamera; schon ein Vertex mit überwiegendem Gewicht dort genügt.
  // Knochen über die Spielnamen (bei Rocketbox Verweise auf Bip01-Knochen) samt allen Gesichtsknochen unter dem Kopf
  const HEAD = new Set();
  for (const n of ['head', 'neck', 'jaw', 'eyeL', 'eyeR', 'lidL', 'lidR', 'browL', 'browR', 'clavL', 'clavR']) if (rig.bones[n]) HEAD.add(list.indexOf(rig.bones[n]));
  if (rig.bones.head) rig.bones.head.traverse(o => { if (o.isBone) HEAD.add(list.indexOf(o)); });
  HEAD.delete(-1);
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
  const headW = new Float32Array(n);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) if (HEAD.has(si.getComponent(i, k))) headW[i] += sw.getComponent(i, k);
  const idx = g.index.array, keep = [], groups = [];
  for (const gr of g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: null }]) {
    const start = keep.length;
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (headW[a] > 0.5 || headW[b] > 0.5 || headW[c] > 0.5) continue;
      keep.push(a, b, c);
    }
    groups.push({ start, count: keep.length - start, materialIndex: gr.materialIndex });
  }
  g.setIndex(new THREE.BufferAttribute(new (idx.constructor)(keep), 1));
  g.clearGroups(); for (const gr of groups) if (gr.materialIndex != null) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return rig;
}
