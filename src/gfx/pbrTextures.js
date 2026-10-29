// Echte PBR-Materialien (Auftrag V3, Phase 3): ambientCG-Texturen (CC0), von tools/pipeline/textures.mjs als KTX2 kodiert
// (Farbe ETC1S, Normalen UASTC, ORM = Verdeckung/Rauheit/Metall). Desktop: eingebettet im Block <script id="assets-textures">,
// Mobil: Dateien unter remote.textures. Ohne Daten bleibt es bei den prozeduralen Texturen (gfx/textures.js).
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { b64, embedded, remote, fetchBytes, fetchJSON } from '../core/assets.js';

export async function loadPBR(gfx, onProgress = () => {}) {
  let index = null, get = null, basis = null;
  const t = embedded('assets-textures');
  if (t) {
    const data = JSON.parse(t); index = data.index;
    get = async n => (data.files[n] ? b64(data.files[n]) : null);
    const blob = (x, type) => URL.createObjectURL(new Blob([b64(x)], { type }));
    basis = data.basis ? { js: blob(data.basis.js, 'text/javascript'), wasm: blob(data.basis.wasm, 'application/wasm') } : null;
  } else if (remote && remote.textures) {
    index = await fetchJSON(remote.textures + 'textures.json').catch(() => null);
    get = n => fetchBytes(remote.textures + n).catch(() => null);
    basis = { js: remote.basis + 'basis_transcoder.js', wasm: remote.basis + 'basis_transcoder.wasm' };
  }
  if (!index || !Object.keys(index).length) return null;
  // Transkodierer: eigene Blob-URLs, falls die Figuren ihn nicht schon bereitstellen
  if (!basis) {
    const h = embedded('assets-humans'); if (!h) return null;
    const d = JSON.parse(h); const blob = (x, type) => URL.createObjectURL(new Blob([b64(x)], { type }));
    basis = { js: blob(d.basis.js, 'text/javascript'), wasm: blob(d.basis.wasm, 'application/wasm') };
  }
  const manager = new THREE.LoadingManager();
  const urls = { 'basis/basis_transcoder.js': basis.js, 'basis/basis_transcoder.wasm': basis.wasm };
  manager.setURLModifier(u => urls[u] || u);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('basis/').detectSupport(gfx.renderer);
  const aniso = gfx.renderer.capabilities.getMaxAnisotropy();
  const tex = async (name, srgb) => {
    const bytes = await get(name); if (!bytes) return null;
    const tx = await new Promise((res, rej) => ktx2.parse(bytes.buffer, res, rej));
    tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = aniso; tx.needsUpdate = true;
    return tx;
  };
  const sets = {}; const ids = Object.keys(index); let i = 0;
  for (const id of ids) {
    try {
      const [map, normalMap, orm] = await Promise.all([tex(id + '_color.ktx2', true), tex(id + '_normal.ktx2', false), tex(id + '_orm.ktx2', false)]);
      if (map) sets[id] = { map, normalMap, orm, ...index[id] };
    } catch (e) { console.warn('Material', id, e); }
    onProgress(++i / ids.length);
  }
  ktx2.dispose();
  return sets;
}
