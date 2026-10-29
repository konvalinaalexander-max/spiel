// Echte Geräuschaufnahmen (Auftrag V3, Phase 6b): aufbereitet von tools/audio/build_sfx.py (Schnitt, Entrauschen, Pegel, nahtlose
// Schleifen, Opus). Desktop: eingebettet im Block <script id="assets-sfx">; Mobil-Build: Dateien unter remote.sfx, per fetch.
// Liefert { name: [AudioBuffer, …] } – die Klangsynthese springt nur noch für fehlende Namen ein (UI-Signaltöne des Laptops).
import { b64, embedded, remote, fetchBytes, fetchJSON } from '../core/assets.js';

const OAC = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : (typeof webkitOfflineAudioContext !== 'undefined' ? webkitOfflineAudioContext : null);
const decode = (ctx, bytes) => new Promise((res) => { try { const p = ctx.decodeAudioData(bytes.buffer, res, () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (e) { res(null); } });

export async function loadSfx(progress = () => {}) {
  if (!OAC) return {};
  const t = embedded('assets-sfx');
  let list = [];
  if (t) {
    const data = JSON.parse(t);
    for (const [name, m] of Object.entries(data)) for (const f of m.files) list.push({ name, gain: m.gain ?? 1, get: async () => b64(f) });
  } else if (remote && remote.sfx) {
    const man = await fetchJSON(remote.sfx + 'manifest.json').catch(() => null);
    if (!man) return {};
    for (const [name, m] of Object.entries(man)) for (const f of m.files) list.push({ name, gain: m.gain ?? 1, get: () => fetchBytes(remote.sfx + f) });
  } else return {};
  const ctx = new OAC(2, 1, 48000), out = {};
  let done = 0;
  await Promise.all(list.map(async it => {
    try {
      const buf = await decode(ctx, await it.get());
      if (buf) {
        // Pegel wie der bisherige Klang (Mischung im Spiel bleibt), einmal beim Laden
        if (Math.abs(it.gain - 1) > 1e-3) for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= it.gain; }
        (out[it.name] || (out[it.name] = [])).push(buf);
      }
    } catch (e) { /* Rückfall: Synthese */ }
    progress(++done / list.length);
  }));
  return out;
}
