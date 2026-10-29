// Echte Figuren im Spiel (Auftrag V3, Phase 4): Daten aus dem eingebetteten Block <script id="assets-humans"> (Build) laden,
// Atlanten (KTX2/Basis) transkodieren, Figuren für Prof, Spielfigur, Nachbarin, Tutorin und Studierende bauen.
// Ohne eingebettete Daten (z. B. Entwicklungsbuild ohne Assets) liefert loadHumans null → das Spiel nutzt die prozeduralen Figuren.
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { decodeHPK, rigFromHPK, humanMaterial } from './humanPack.js';
import { Character } from './character.js';
import { ClipCharacter, addGrips } from './clipCharacter.js';
import { makeRng } from '../core/util.js';
import { b64, embedded, remote, fetchBytes, fetchJSON } from '../core/assets.js';
// Hautfarben/Haarfarben der Besetzungsliste (population.js) → grobe Klassen für die Zuordnung zu den Figurtypen
const SKIN = [0xf3d2b9, 0xeec3a2, 0xe0ac86, 0xc98f67, 0xa46d4b, 0x7a4a31];
const hairTone = hex => { const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl); if (hsl.l < 0.12) return 'black'; if (hsl.s < 0.12 && hsl.l > 0.4) return 'gray'; if (hsl.h < 0.06 && hsl.s > 0.5) return 'red'; if (hsl.l > 0.42) return 'blond'; return 'brown'; };
const TINT_GRAY = 1 / 0.4793; // Oberteil-Atlas ist entsättigt mit Mittelwert 0,72 (sRGB) ≈ 0,4793 linear

/**
 * Quelle der Figurdaten: eingebettet (Desktop-Datei: Base64 im Block #assets-humans) oder gehostet (Mobil-Build: Dateien unter
 * remote.humans, per fetch). Liefert { index, get(name) → Promise<Uint8Array|null>, basis: { js, wasm } als URLs }.
 */
async function humanSource(onBytes) {
  const t = embedded('assets-humans');
  if (t) {
    const data = JSON.parse(t);
    const blob = (b, type) => URL.createObjectURL(new Blob([b64(b)], { type }));
    return { index: data.index, get: async n => (data.files[n] ? b64(data.files[n]) : null),
      basis: { js: blob(data.basis.js, 'text/javascript'), wasm: blob(data.basis.wasm, 'application/wasm') } };
  }
  if (!remote || !remote.humans) return null;
  const base = remote.humans, index = await fetchJSON(base + 'index.json');
  const sizes = remote.humansFiles || {}, total = Object.values(sizes).reduce((a, b) => a + b, 0) || 1; let done = 0;
  return { index, basis: { js: remote.basis + 'basis_transcoder.js', wasm: remote.basis + 'basis_transcoder.wasm' },
    get: async n => { if (remote.humansFiles && !(n in sizes)) return null; let last = 0; const u = await fetchBytes(base + n, g => { done += g - last; last = g; onBytes(done / total); }); return u; } };
}

export async function loadHumans(gfx, onProgress = () => {}) {
  const src = await humanSource(f => onProgress(Math.min(1, f)));
  if (!src) return null;
  const index = src.index;
  // KTX2-Transkodierer (Desktop: aus eingebetteten Dateien, kein Netz nötig)
  const manager = new THREE.LoadingManager();
  const urls = { 'basis/basis_transcoder.js': src.basis.js, 'basis/basis_transcoder.wasm': src.basis.wasm };
  manager.setURLModifier(u => urls[u] || u);
  const ktx2 = new KTX2Loader(manager).setTranscoderPath('basis/').detectSupport(gfx.renderer);
  const tex = async (name, srgb) => {
    const bytes = await src.get(name);
    if (!bytes) return null;
    const t = await new Promise((res, rej) => ktx2.parse(bytes.buffer, res, rej));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(8, gfx.renderer.capabilities.getMaxAnisotropy());
    t.flipY = false; t.needsUpdate = true;
    return t;
  };
  const H = { index, designs: {}, atlases: {}, normals: {}, mats: {}, used: {}, clips: {}, rocketbox: !!index.people };
  // Rocketbox-Figuren (tools/pipeline/people.mjs): index.people statt index.humans, dazu Animationen je Satz
  const ids = Object.keys(index.people || index.humans);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    H.designs[id] = await decodeHPK(await src.get(id + '.hpk'));
    if (!remote) onProgress(i / ids.length);
  }
  for (const key of new Set(Object.values(H.designs).map(d => d.head.atlas))) {
    H.atlases[key] = await tex(key + '_c.ktx2', true);
    H.normals[key] = !index.atlases || index.atlases[key]?.normal ? await tex(key + '_n.ktx2', false) : null;
  }
  ktx2.dispose();
  if (index.clips) for (const [set, c] of Object.entries(index.clips)) { const b = await src.get(c.file); if (b) H.clips[set] = await decodeClips(b); }
  /** Laufzeit-Figur: Rocketbox mit Animationen (ClipCharacter), sonst Character. set: 'prof' ergänzt die Prof-Gesten */
  H.character = (rig, opts = {}, set = null) => {
    if (!rig.rocketbox) return new Character(rig, opts);
    const g = rig.spec.female ? 'f' : 'm', clips = new Map([...(H.clips[g] || new Map()), ...((set && H.clips[set]) || new Map())]);
    return new ClipCharacter(rig, clips, opts);
  };
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
    if (rig.rocketbox) addGrips(rig);
    return rig;
  };
  /** beliebiger Figurtyp direkt (Prüfansichten); Mengen-Typen mit neutraler Einfärbung */
  H.design = (id, tintHex = null) => {
    const d = H.designs[id]; if (!d) return null;
    const rig = rigFromHPK(d, H.materials(d.head.atlas)); rig.atlasKey = d.head.atlas;
    if (d.head.atlas.startsWith('crowd')) {
      const g = rig.mesh.geometry, n = g.attributes.position.count, tint = new Float32Array(n * 3);
      const c = new THREE.Color(tintHex ?? 0xffffff).multiplyScalar(tintHex != null && d.head.tint ? TINT_GRAY : 1);
      for (let i = 0; i < n; i++) { tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b; }
      g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    }
    return rig;
  };
  /** Studierende:r aus dem Besetzungsplan → passender Figurtyp, Oberteil in der Farbe der Person */
  H.forStudent = s => {
    if (s.role === 'neighbor' && H.designs.neighbor) return H.hero('neighbor');
    const sp = s.spec || {}; const rng = makeRng(s.seed || 1);
    const tone = Math.max(0, SKIN.indexOf(sp.skin)), ht = hairTone(sp.hair ?? 0x3b2a1e);
    const cands = Object.values(H.designs).map(d => d.head).filter(h => h.class === 'crowd' && h.female === !!sp.female);
    if (!cands.length) return null;
    let best = null, bestS = -1e9;
    for (const h of cands) {
      const sc = -Math.abs((h.skinTone ?? 1) - tone) * 1.6 + (h.hairTone === ht ? 1 : 0) + (h.top === sp.top?.type ? 0.8 : 0) - (H.used[h.id] || 0) * 0.9 + rng.next() * 0.6;
      if (sc > bestS) { bestS = sc; best = h; }
    }
    H.used[best.id] = (H.used[best.id] || 0) + 1;
    const rig = rigFromHPK(H.designs[best.id], H.materials(best.atlas));
    rig.atlasKey = best.atlas;
    if (rig.rocketbox) addGrips(rig);
    // Einfärbung des Oberteils (nur Vertices mit Teilart 2 werden im Shader damit multipliziert)
    const g = rig.mesh.geometry, n = g.attributes.position.count, tint = new Float32Array(n * 3);
    const c = new THREE.Color(best.tint && sp.top ? sp.top.color : 0xffffff).multiplyScalar(best.tint && sp.top ? TINT_GRAY : 1);
    for (let i = 0; i < n; i++) { tint[i * 3] = c.r; tint[i * 3 + 1] = c.g; tint[i * 3 + 2] = c.b; }
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    return rig;
  };
  return H;
}

/** Animationen (CLP2, gzip): Kopf-JSON { fps, clips: [{ name, dur, frames, loop, tracks: [{ b, q|p: [Offset, Anzahl] }] }] } → Map Name → AnimationClip */
export async function decodeClips(bytes) {
  const ab = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const dv = new DataView(ab);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'CLP2') throw new Error('Clips: falsches Format');
  // Differenzen aufsummieren (Int16 mit Überlauf, wie beim Packen)
  const undelta = (a, n, k) => { const v = new Float32Array(a.length), acc = new Int16Array(n); for (let i = 0; i < a.length; i++) { acc[i % n] = i < n ? a[i] : acc[i % n] + a[i]; v[i] = acc[i % n] * k; } return v; };
  const jl = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 8, jl))), base = 8 + jl;
  const out = new Map();
  for (const c of head.clips) {
    const times = new Float32Array(c.frames); for (let f = 0; f < c.frames; f++) times[f] = f / head.fps;
    const tracks = c.tracks.map(t => {
      if (t.q) return new THREE.QuaternionKeyframeTrack(t.b + '.quaternion', times, undelta(new Int16Array(ab, base + t.q[0], t.q[1]), 4, 1 / 32767));
      return new THREE.VectorKeyframeTrack(t.b + '.position', times, undelta(new Int16Array(ab, base + t.p[0], t.p[1]), 3, 1e-4));
    });
    const clip = new THREE.AnimationClip(c.name, c.dur, tracks); clip.userData = { loop: c.loop };
    out.set(c.name, clip);
  }
  return out;
}
