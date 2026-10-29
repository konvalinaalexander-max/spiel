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

const TYPES = { Float32Array, Int8Array, Uint16Array, Uint8Array, Uint32Array };

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

/** Geometrie (mit Gruppen 0 = deckend, 1 = Alpha) aus HPK-Daten */
export function hpkGeometry({ head, arr }) {
  const n = head.vertices, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr.position, 3));
  const nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) nor[i * 3 + k] = arr.normal[i * 4 + k] / 127;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(arr.uv, 2, true));
  // Knochenindizes als u16: beim Zusammenführen vieler Figuren (Menge) werden sie verschoben
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Uint16Array.from(arr.joints), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(arr.weights, 4, true));
  g.setAttribute('aSurf', new THREE.BufferAttribute(arr.surf, 4, false));
  g.setIndex(new THREE.BufferAttribute(arr.index, 1));
  head.groups.forEach((gr, i) => g.addGroup(gr.start, gr.count, gr.alpha ? 1 : 0));
  g.computeBoundingSphere();
  return g;
}

/** Figur wie buildCharacter: { mesh, bones, skeleton, bindPos, lengths, spec, H, human, face, fingerBones } */
export function rigFromHPK(data, materials) {
  const { head } = data;
  const geo = hpkGeometry(data);
  const names = Object.keys(head.parents);
  const bindPos = {}, bones = {}, list = [];
  for (const nm of names) bindPos[nm] = new THREE.Vector3(...head.joints[nm]);
  for (const nm of names) {
    const b = new THREE.Bone(); b.name = nm;
    const p = head.parents[nm];
    b.position.copy(bindPos[nm]); if (p) b.position.sub(bindPos[p]);
    bones[nm] = b; list.push(b); if (p) bones[p].add(b);
  }
  const skeleton = new THREE.Skeleton(list);
  const mesh = new THREE.SkinnedMesh(geo, materials);
  mesh.add(bones.root); bones.root.updateMatrixWorld(true); mesh.bind(skeleton);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.name = 'human-' + head.id;
  const lengths = {
    upperArm: bindPos.foreArmL.distanceTo(bindPos.upperArmL), foreArm: bindPos.handL.distanceTo(bindPos.foreArmL),
    thigh: bindPos.shinL.distanceTo(bindPos.thighL), shin: bindPos.footL.distanceTo(bindPos.shinL), hipHeight: bindPos.hips.y, ankle: bindPos.footL.y
  };
  const fingerSet = s => ({ fingers: [2, 3, 4, 5].map(f => ['a', 'b', 'c'].map(k => bones[`f${f}${k}${s}`])), thumb: [bones[`thumbB${s}`], bones[`thumbC${s}`]] });
  const fingerBones = head.fingers === 'full' ? { L: fingerSet('L'), R: fingerSet('R') } : null;
  return { mesh, skinned: mesh, bones, skeleton, bindPos, lengths, spec: { female: head.female }, H: head.height / 1.76, human: true, face: FACE, fingerBones, design: head };
}

/**
 * Material für echte Figuren: Farbatlas (+ Normalenatlas), Rauheit und Normalenstärke je Vertex (aSurf), Einfärbung des
 * Oberteils je Person (aTint, nur Teilart 2). alpha = Haar/Brauen/Wimpern mit Alphatest (bei MSAA mit Alpha-to-Coverage).
 */
export function humanMaterial(gfx, { map, normalMap = null, alpha = false, tint = false, name = 'human' }) {
  const patch = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec4 aSurf;\nvarying vec2 vSurf;${tint ? '\nattribute vec3 aTint;\nvarying vec3 vTint;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvSurf = aSurf.xy / 255.0;${tint ? '\nvTint = abs(aSurf.z - 2.0) < 0.5 ? aTint : vec3(1.0);' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vSurf;${tint ? '\nvarying vec3 vTint;' : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${tint ? '\ndiffuseColor.rgb *= vTint;' : ''}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.x;')
      .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * vSurf.y;'));
  };
  const m = new THREE.MeshStandardMaterial({ map, normalMap, roughness: 0.8, metalness: 0, name });
  if (normalMap) m.normalScale.set(1, -1); // Atlas aus glTF-Normalen (OpenGL-Konvention, UV-Ursprung oben links)
  if (alpha) { m.alphaTest = 0.5; m.alphaToCoverage = !!gfx.msaaSamples; m.side = THREE.DoubleSide; }
  m.userData.patches = [patch]; m.userData.patchKey = name + (tint ? 'T' : '') + (alpha ? 'A' : '') + (normalMap ? 'N' : '');
  return gfx.register ? gfx.register(m) : (m.onBeforeCompile = patch, m);
}

/**
 * Ich-Perspektive: Kopf, Haare, Augen der eigenen Figur weglassen (Dreiecke, deren drei Vertices überwiegend an Kopfknochen
 * hängen). Den Kopfknochen zu schrumpfen wie bei den prozeduralen Figuren zieht sonst Kragen- und Halsvertices mit
 * gemischten Gewichten zum Kopf hin – lange Dreiecke direkt vor der Kamera.
 */
export function stripHead(rig) {
  const g = rig.mesh.geometry, names = rig.skeleton.bones.map(b => b.name);
  const HEAD = new Set(['head', 'neck', 'jaw', 'eyeL', 'eyeR', 'lidL', 'lidR', 'browL', 'browR'].map(n => names.indexOf(n)).filter(i => i >= 0));
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
  const headW = new Float32Array(n);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) if (HEAD.has(si.getComponent(i, k))) headW[i] += sw.getComponent(i, k);
  const idx = g.index.array, keep = [], groups = [];
  for (const gr of g.groups) {
    const start = keep.length;
    for (let t = gr.start; t < gr.start + gr.count; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (headW[a] > 0.5 && headW[b] > 0.5 && headW[c] > 0.5) continue;
      keep.push(a, b, c);
    }
    groups.push({ start, count: keep.length - start, materialIndex: gr.materialIndex });
  }
  g.setIndex(new THREE.BufferAttribute(new (idx.constructor)(keep), 1));
  g.clearGroups(); for (const gr of groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return rig;
}
