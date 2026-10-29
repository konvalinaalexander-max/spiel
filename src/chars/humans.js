// Echte Figuren im Spiel (Auftrag V3, Phase 4): Daten aus dem eingebetteten Block <script id="assets-humans"> (Build) laden,
// Atlanten (KTX2/Basis) transkodieren, Figuren für Prof, Spielfigur, Nachbarin, Tutorin und Studierende bauen.
// Ohne eingebettete Daten (z. B. Entwicklungsbuild ohne Assets) liefert loadHumans null → das Spiel nutzt die prozeduralen Figuren.
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { decodeHPK, rigFromHPK, humanMaterial } from './humanPack.js';
import { makeRng } from '../core/util.js';

const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
// Hautfarben/Haarfarben der Besetzungsliste (population.js) → grobe Klassen für die Zuordnung zu den Figurtypen
const SKIN = [0xf3d2b9, 0xeec3a2, 0xe0ac86, 0xc98f67, 0xa46d4b, 0x7a4a31];
const hairTone = hex => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); if (hsl.l < 0.12) return 'black'; if (hsl.s < 0.12 && hsl.l > 0.4) return 'gray'; if (hsl.h < 0.06 && hsl.s > 0.5) return 'red'; if (hsl.l > 0.42) return 'blond'; return 'brown'; };
const TINT_GRAY = 1 / 0.4793; // Oberteil-Atlas ist entsättigt mit Mittelwert 0,72 (sRGB) ≈ 0,4793 linear

export async function loadHumans(gfx, onProgress = () => {}) {
  const el = typeof document !== 'undefined' && document.getElementById('assets-humans');
  if (!el || !el.textContent.trim()) return null;
  const data = JSON.parse(el.textContent);
  const files = data.files, index = data.index;
  // KTX2-Transkodierer aus eingebetteten Dateien (kein Netz nötig)
  const manager = new THREE.LoadingManager();
  const urls = {
    'basis/basis_transcoder.js': URL.createObjectURL(new Blob([b64(data.basis.js)], { type: 'text/javascript' })),
    'basis/basis_transcoder.wasm': URL.createObjectURL(new Blob([b64(data.basis.wasm)], { type: 'application/wasm' }))
  };
  manager.setURLModifier(u => urls[u] || u);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('basis/').detectSupport(gfx.renderer);
  const tex = async (name, srgb) => {
    if (!files[name]) return null;
    const t = await new Promise((res, rej) => ktx2.parse(b64(files[name]).buffer, res, rej));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(8, gfx.renderer.capabilities.getMaxAnisotropy());
    t.flipY = false; t.needsUpdate = true;
    return t;
  };
  const H = { index, designs: {}, atlases: {}, normals: {}, mats: {}, used: {} };
  const ids = Object.keys(index.humans);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    H.designs[id] = await decodeHPK(b64(files[id + '.hpk']));
    onProgress(i / ids.length);
  }
  for (const key of new Set(Object.values(H.designs).map(d => d.head.atlas))) {
    H.atlases[key] = await tex(key + '_c.ktx2', true);
    H.normals[key] = await tex(key + '_n.ktx2', false);
  }
  ktx2.dispose();
  /** Materialpaar [deckend, Alpha] je Atlas (geteilt von allen Figuren dieses Atlas) */
  H.materials = key => H.mats[key] || (H.mats[key] = [
    humanMaterial(gfx, { map: H.atlases[key], normalMap: H.normals[key], tint: key.startsWith('crowd'), name: 'human-' + key }),
    humanMaterial(gfx, { map: H.atlases[key], alpha: true, tint: false, name: 'human-' + key + '-a' })
  ]);
  /** Hauptfigur (eigener Atlas): prof, player_a/b/c, neighbor, tutor */
  H.hero = id => {
    const d = H.designs[id]; if (!d) return null;
    const rig = rigFromHPK(d, H.materials(d.head.atlas));
    rig.atlasKey = d.head.atlas;
    return rig;
  };
  /** Studierende:r aus dem Besetzungsplan → passender Figurtyp, Oberteil in der Farbe der Person */
  H.forStudent = s => {
    if (s.role === 'neighbor' && H.designs.neighbor) return H.hero('neighbor');
    const sp = s.spec || {}; const rng = makeRng(s.seed || 1);
    const tone = Math.max(0, SKIN.indexOf(sp.skin)), ht = hairTone(sp.hair ?? 0x3b2a1e);
    const cands = Object.values(H.designs).map(d => d.head).filter(h => h.class === 'crowd' && h.female === !!sp.female);
    let best = null, bestS = -1e9;
    for (const h of cands) {
      const sc = -Math.abs((h.skinTone ?? 1) - tone) * 1.6 + (h.hairTone === ht ? 1 : 0) + (h.top === sp.top?.type ? 0.8 : 0) - (H.used[h.id] || 0) * 0.9 + rng.next() * 0.6;
      if (sc > bestS) { bestS = sc; best = h; }
    }
    H.used[best.id] = (H.used[best.id] || 0) + 1;
    const rig = rigFromHPK(H.designs[best.id], H.materials(best.atlas));
    rig.atlasKey = best.atlas;
    // Einfärbung des Oberteils (nur Vertices mit Teilart 2 werden im Shader damit multipliziert)
    const g = rig.mesh.geometry, n = g.attributes.position.count, tint = new Float32Array(n * 3);
    const c = new THREE.Color(best.tint && sp.top ? sp.top.color : 0xffffff).multiplyScalar(best.tint && sp.top ? TINT_GRAY : 1);
    for (let i = 0; i < n; i++) { tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b; }
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    return rig;
  };
  return H;
}
