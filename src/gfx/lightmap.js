// Gebackenes Licht (Auftrag V3, Phase 3): indirektes Licht (Deckenleuchten, Himmel, Sonne) und Umgebungsverdeckung aus Cycles,
// erzeugt von tools/pipeline/lightmap.mjs. Je Atlas eine KTX2-Textur: RGB = Bestrahlungsstärke / Skala (sRGB), Alpha = Verdeckung.
// Die Saal-Meshes werden zur Laufzeit um eine zweite UV-Spur (uv1) ergänzt; dafür liefert die Pipeline je Mesh die neue
// Vertexliste (Index ins Original, an UV-Nähten verdoppelt) und die Indexliste. Passt ein Mesh nicht zum Fingerabdruck
// (Vertexzahl), bleibt es unverändert. Die Verdeckung wirkt auf indirektes Licht (Himmel/Hemisphäre, Umgebung, Lightmap).
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { b64, embedded, remote, fetchBytes, fetchJSON } from '../core/assets.js';

/** lädt Verzeichnis, UV-Daten und die Atlanten eines Wetters (sunny | cloudy) */
export async function loadLightmaps(gfx, weather) {
  let index = null, get = null, basis = null;
  const t = embedded('assets-lightmap');
  if (t) { const d = JSON.parse(t); index = d.index; get = async n => (d.files[n] ? b64(d.files[n]) : null); }
  else if (remote && remote.lightmap) { index = await fetchJSON(remote.lightmap + 'index.json').catch(() => null); get = n => fetchBytes(remote.lightmap + n).catch(() => null); }
  if (!index) return null;
  if (remote && remote.basis && !t) basis = { js: remote.basis + 'basis_transcoder.js', wasm: remote.basis + 'basis_transcoder.wasm' };
  else { const h = embedded('assets-humans'); if (!h) return null; const d = JSON.parse(h); const blob = (x, type) => URL.createObjectURL(new Blob([b64(x)], { type })); basis = { js: blob(d.basis.js, 'text/javascript'), wasm: blob(d.basis.wasm, 'application/wasm') }; }
  const w = index.weather[weather] ? weather : Object.keys(index.weather)[0];
  const gz = await get('uv.bin.gz'); if (!gz) return null;
  const uv = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  const manager = new THREE.LoadingManager();
  const urls = { 'basis/basis_transcoder.js': basis.js, 'basis/basis_transcoder.wasm': basis.wasm };
  manager.setURLModifier(u => urls[u] || u);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('basis/').detectSupport(gfx.renderer);
  const maps = [];
  for (let k = 0; k < index.atlases; k++) {
    const bytes = await get(`lm_${w}_${k}.ktx2`); if (!bytes) { maps.push(null); continue; }
    const tx = await new Promise((res, rej) => ktx2.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), res, rej));
    tx.colorSpace = THREE.SRGBColorSpace; tx.channel = 1; tx.flipY = false; tx.needsUpdate = true;
    maps.push(tx);
  }
  ktx2.dispose();
  return { index, weather: w, scale: index.weather[w].scale, maps, uv: uv.buffer.slice(uv.byteOffset, uv.byteOffset + uv.byteLength) };
}

/**
 * Lightmaps an die Saal-Meshes hängen. hallMeshes: Reihenfolge wie beim Export (hall.meshes).
 * opts: { intensity (Faktor auf die Skala), ao (Stärke der gebackenen Verdeckung 0–1) }
 */
export function applyLightmaps(gfx, hallMeshes, lm, opts = {}) {
  if (!lm) return 0;
  const ao = opts.ao ?? 1, intensity = (opts.intensity ?? 1) * lm.scale;
  // Format 2 (tools/pipeline/lightmap.mjs): Zuordnung/Dreiecke als Uint16-Differenzen, UVs als Uint16; Format 1: Uint32/Float32
  const f2 = lm.index.uvFormat === 2;
  const undelta = a => { const out = new Uint32Array(a.length); let v = 0; for (let i = 0; i < a.length; i++) { v = (v + a[i]) & 0xffff; out[i] = v; } return out; };
  const view = (r, key, T) => {
    if (!f2) return new T(lm.uv, r[key][0], r[key][1] / T.BYTES_PER_ELEMENT);
    const a = new Uint16Array(lm.uv, r[key][0], r[key][1]);
    return key === 'uv' ? Float32Array.from(a, v => v / 65535) : undelta(a);
  };
  const mats = new Map(); let n = 0;
  for (const r of lm.index.receivers) {
    const mesh = hallMeshes[r.index], map = lm.maps[r.atlas];
    if (!mesh || !map || mesh.geometry.attributes.position.count !== r.verts) continue;
    const old = mesh.geometry, remap = view(r, 'map', Uint32Array), uv1 = view(r, 'uv', Float32Array), idx = view(r, 'idx', Uint32Array);
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(old.attributes)) {
      const s = a.itemSize, src = a.array, out = new src.constructor(remap.length * s);
      for (let i = 0; i < remap.length; i++) for (let c = 0; c < s; c++) out[i * s + c] = src[remap[i] * s + c];
      g.setAttribute(name, new THREE.BufferAttribute(out, s, a.normalized));
    }
    g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(uv1), 2));
    g.setIndex(new THREE.BufferAttribute(remap.length > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    // Material je (Material, Atlas) einmal klonen; eigene Shader-Patches (CSM, Nahbereich …) übernehmen
    const src = mesh.material, key = src.uuid + '|' + r.atlas;
    let m = mats.get(key);
    if (!m) {
      m = src.clone();
      const patches = (src.userData.patches || []).filter(p => typeof p === 'function');
      m.userData = { ...src.userData, patches: [...patches, bakedAOPatch(ao)], patchKey: (src.userData.patchKey || src.name || 'm') + 'LM' };
      m.lightMap = map; m.lightMapIntensity = intensity; m.name = (src.name || '') + ' (Lightmap ' + r.atlas + ')';
      gfx.register(m); mats.set(key, m);
    }
    mesh.geometry = g; mesh.material = m; old.dispose(); n++;
  }
  return n;
}

/** Verdeckung aus dem Alphakanal der Lightmap auf indirektes Licht anwenden (nach der Material-AO) */
function bakedAOPatch(strength) {
  return s => {
    s.uniforms.uBakedAO = { value: strength };
    s.fragmentShader = 'uniform float uBakedAO;\n' + s.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
#ifdef USE_LIGHTMAP
	{ float bakedAO = mix( 1.0, texture2D( lightMap, vLightMapUv ).a, uBakedAO );
	  reflectedLight.indirectDiffuse *= bakedAO;
	  reflectedLight.indirectSpecular *= mix( 1.0, bakedAO, 0.6 ); }
#endif`);
  };
}
