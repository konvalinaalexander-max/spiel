// Asset-Quellen (Auftrag V3, Phase 3/7): Die Desktop-Datei bettet alle Binärdaten als Base64 in <script type="text/plain">-Blöcke ein
// (offline per Doppelklick). Der Mobil-Build (gehostet, PWA) legt sie als einzelne Dateien neben index.html und nennt sie in
// <script type="application/json" id="assets-remote"> – dann wird per fetch geladen (Service Worker hält sie offline vor).
export const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

/** Inhalt eines eingebetteten Blocks oder null */
export function embedded(id) {
  const el = typeof document !== 'undefined' && document.getElementById(id);
  return el && el.textContent.trim() ? el.textContent : null;
}

/** Beschreibung der gehosteten Dateien (Mobil-Build) oder null */
export const remote = (() => {
  try { const t = embedded('assets-remote'); return t ? JSON.parse(t) : null; } catch (e) { return null; }
})();

/** Datei relativ zur Seite laden; onBytes(geladen, gesamt) für den Ladebalken in Bytes */
export async function fetchBytes(rel, onBytes = null) {
  const r = await fetch(rel, { cache: 'force-cache' });
  if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  if (!onBytes || !r.body || !r.body.getReader) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onBytes(got, total); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
export async function fetchJSON(rel) { const r = await fetch(rel, { cache: 'force-cache' }); if (!r.ok) throw new Error(`${rel}: HTTP ${r.status}`); return r.json(); }
