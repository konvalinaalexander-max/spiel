// Echte Requisiten (Auftrag V3, Phase 5): Poly-Haven-Modelle (CC0), aufbereitet von tools/pipeline/props.mjs (vereinfacht,
// KTX2-Texturen, Meshopt-Kompression). Desktop: eingebettet im Block <script id="assets-props">; Mobil: per fetch.
// Die Modelle werden nicht einzeln gezeichnet: place() gibt ihre Teile an den Batcher, der alles mit gleichem Material zu wenigen
// Draw Calls verschmilzt (Apfel auf 12 Pulten = ein Draw Call je Material).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { b64, embedded, remote, fetchBytes, fetchJSON } from '../core/assets.js';

/** quantisierte Attribute (Int16/Int8, normalisiert) in Float32 umwandeln – der Batcher transformiert die Geometrie */
function toFloat(geo, matrix) {
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = geo.attributes[name]; if (!a) continue;
    const n = a.count, s = a.itemSize, out = new Float32Array(n * s);
    for (let i = 0; i < n; i++) { out[i * s] = a.getX(i); if (s > 1) out[i * s + 1] = a.getY(i); if (s > 2) out[i * s + 2] = a.getZ(i); }
    g.setAttribute(name, new THREE.BufferAttribute(out, s));
  }
  if (geo.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(geo.index.array), 1));
  g.applyMatrix4(matrix);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

export async function loadPropModels(gfx, onProgress = () => {}) {
  let index = null, get = null;
  const t = embedded('assets-props');
  if (t) { const d = JSON.parse(t); index = d.index; get = async n => (d.files[n] ? b64(d.files[n]) : null); }
  else if (remote && remote.props) { index = await fetchJSON(remote.props + 'index.json').catch(() => null); get = n => fetchBytes(remote.props + n).catch(() => null); }
  if (!index || !Object.keys(index).length) return null;
  // KTX2-Transkodierer aus dem Figurenblock bzw. gehostet
  let basis;
  if (remote && remote.basis && !t) basis = { js: remote.basis + 'basis_transcoder.js', wasm: remote.basis + 'basis_transcoder.wasm' };
  else { const h = embedded('assets-humans'); if (!h) return null; const d = JSON.parse(h); const blob = (x, type) => URL.createObjectURL(new Blob([b64(x)], { type })); basis = { js: blob(d.basis.js, 'text/javascript'), wasm: blob(d.basis.wasm, 'application/wasm') }; }
  const manager = new THREE.LoadingManager();
  const urls = { 'basis/basis_transcoder.js': basis.js, 'basis/basis_transcoder.wasm': basis.wasm };
  manager.setURLModifier(u => urls[u] || u);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('basis/').detectSupport(gfx.renderer);
  const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const aniso = gfx.renderer.capabilities.getMaxAnisotropy();
  const models = {}; const ids = Object.keys(index); let k = 0;
  for (const id of ids) {
    try {
      const bytes = await get(id + '.glb'); if (!bytes) continue;
      const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      const parts = [], nodes = new Map();
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) if (m[key]) m[key].anisotropy = aniso;
          if (!m.userData.registered) { m.userData.registered = true; gfx.register(m); }
        }
        // Teilmodell: Mesh-Knoten (Poly-Haven-Dateien mit mehreren Varianten nebeneinander, z. B. drei Pflanzen); mehrere
        // Primitive eines Knotens lädt three.js als Gruppe mit Mesh-Kindern → Name des Elternknotens
        const key = o.parent && o.parent.type === 'Group' && o.parent !== gltf.scene ? o.parent.name : o.name;
        const part = { geometry: toFloat(o.geometry, o.matrixWorld), material: mats[0] };
        parts.push(part);
        if (!nodes.has(key)) nodes.set(key, []);
        nodes.get(key).push(part);
      });
      const boxOf = list => { const b = new THREE.Box3(); for (const p of list) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox); } return b; };
      const box = boxOf(parts);
      models[id] = { parts, box, info: index[id], nodes: [...nodes.entries()].map(([name, list]) => ({ name, parts: list, box: boxOf(list) })) };
    } catch (e) { console.warn('Requisite', id, e); }
    onProgress(++k / ids.length);
  }
  ktx2.dispose();
  const R = { models, index };
  /** Modell an Matrix m in den Batcher legen; Ursprung = Mitte der Grundfläche (auf den Boden/Tisch gestellt).
   *  opts: { scale, cast, node } – node wählt einen einzelnen Mesh-Knoten (Variante) einer Datei mit mehreren Objekten */
  R.place = (B, id, m, opts = {}) => {
    let md = models[id]; if (!md) return false;
    if (opts.node != null) { md = typeof opts.node === 'string' ? md.nodes.find(n => n.name.includes(opts.node)) : md.nodes[opts.node % md.nodes.length]; if (!md) return false; }
    const b = md.box, base = new THREE.Matrix4().makeTranslation(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    const s = opts.scale ?? 1, full = new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeScale(s, s, s)).multiply(base);
    // Schatten nur für größere Teile: Kontaktschatten kleiner Dinge (Becher, Obst, Stifte) stecken schon im gebackenen Licht,
    // jede schattenwerfende Materialgruppe kostet sonst je Kaskade einen Draw Call
    const cast = opts.cast ?? (b.max.y - b.min.y) * s > 0.3;
    for (const p of md.parts) B.add(p.geometry, p.material, full, { keepUV: true, cast, receive: true });
    return true;
  };
  R.has = id => !!models[id];
  /** Höhe (m) des Modells */
  R.height = (id, node = null) => { let md = models[id]; if (!md) return 0; if (node != null) md = typeof node === 'string' ? md.nodes.find(n => n.name.includes(node)) : md.nodes[node % md.nodes.length]; return md ? md.box.max.y - md.box.min.y : 0; };
  R.nodeCount = id => (models[id] ? models[id].nodes.length : 0);
  return R;
}
