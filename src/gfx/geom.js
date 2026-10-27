// Geometrie-Helfer: abgerundete Quader, Weltraum-UVs (gleichmäßige Texeldichte), statisches Batching.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

/** Abgerundeter Quader (Kantenradius r in m). */
export function rbox(w, h, d, r = 0.01, seg = 1) {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  if (rr <= 0.0005) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, seg = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

/** Matrix aus Position / Rotation (Euler XYZ) / Skalierung */
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return _m.clone().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/**
 * Ersetzt UVs durch Box-Projektion in Weltkoordinaten (nach Transformation):
 * uv = Fläche / tile → überall gleiche Texeldichte, auch bei gebatchter Geometrie.
 * grainAxis: 'x' | 'z' | 'y' bestimmt, wohin die u-Achse auf Deck-/Bodenflächen zeigt.
 */
export function worldUV(geo, tile = 1, offset = [0, 0], grainAxis = 'x') {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { if (grainAxis === 'z') { u = z; v = x; } else { u = x; v = z; } }
    else if (nx >= nz) { u = grainAxis === 'y' ? y : z; v = grainAxis === 'y' ? z : y; }
    else { u = grainAxis === 'y' ? y : x; v = grainAxis === 'y' ? x : y; }
    uv[i * 2] = u / tile + offset[0];
    uv[i * 2 + 1] = v / tile + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** Sammelt statische Geometrie je Material und verschmilzt sie (wenige Draw Calls). */
export class Batcher {
  constructor() { this.groups = new Map(); }
  /**
   * add(geo, material, matrix, opts) – opts: { tile, grain, offset, cast, receive, color, keepUV, layer }
   * color: Vertexfarbe (für Materialien mit vertexColors)
   */
  add(geo, material, matrix, opts = {}) {
    const g = geo.index ? geo.clone() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!opts.keepUV) worldUV(g, opts.tile ?? 1, opts.offset || [0, 0], opts.grain || 'x');
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (material.vertexColors) {
      const c = new THREE.Color(opts.color ?? 0xffffff);
      if (!g.attributes.color) {
        const arr = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      }
    } else if (g.attributes.color) g.deleteAttribute('color');
    if (!g.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    const key = material.uuid + '|' + (opts.cast !== false) + '|' + (opts.receive !== false) + '|' + (opts.layer || 0);
    if (!this.groups.has(key)) this.groups.set(key, { material, list: [], cast: opts.cast !== false, receive: opts.receive !== false, layer: opts.layer || 0 });
    this.groups.get(key).list.push(g);
    return g;
  }
  build(parent, name = 'static') {
    const meshes = [];
    for (const { material, list, cast, receive, layer } of this.groups.values()) {
      // in Blöcken verschmelzen, damit Frustum-Culling noch greift (max. ~60k Vertices)
      let chunk = [], verts = 0;
      const flush = () => {
        if (!chunk.length) return;
        const merged = mergeGeometries(chunk, false);
        merged.computeBoundingSphere(); merged.computeBoundingBox();
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.name = name;
        mesh.matrixAutoUpdate = false; mesh.updateMatrix();
        if (layer) mesh.layers.set(layer);
        parent.add(mesh); meshes.push(mesh);
        chunk.forEach(c => c.dispose()); chunk = []; verts = 0;
      };
      for (const g of list) { if (verts + g.attributes.position.count > 65000) flush(); chunk.push(g); verts += g.attributes.position.count; }
      flush();
    }
    this.groups.clear();
    return meshes;
  }
}

/** Fügt Vertex-Farbe ein (für Charaktere). */
export function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
export { mergeGeometries, mergeVertices };
