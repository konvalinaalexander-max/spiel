// Qualitätsstufen. "live" = ohne Neustart umschaltbar; Texturgröße greift beim nächsten Laden.
// V3: Die Stufen skalieren Schatten, AO, Effekte, Texturen und Sichtweite – nie die Auflösung (immer native Bildschirmpixel,
// bis Gerätepixelverhältnis 2). Kantenglättung per MSAA auf dem Hauptpass, SMAA nur als Rückfall ohne WebGL2-Multisampling.
import { storage } from '../core/util.js';

export const PRESETS = {
  low: {
    id: 'low', maxDpr: 2, renderScale: 1, msaa: 2, cascades: 1, shadowSize: 1024, shadowMaxFar: 18,
    ao: false, aoHalf: true, aoSamples: 8, bloom: false, dof: false, aa: 'msaa', godRays: false, dust: false,
    areaLights: false, spotShadow: false, texSize: 512, grain: false, outsideDetail: 0, envMap: true, studentShadows: false
  },
  medium: {
    id: 'medium', maxDpr: 2, renderScale: 1, msaa: 4, cascades: 2, shadowSize: 1024, shadowMaxFar: 24,
    ao: true, aoHalf: true, aoSamples: 12, bloom: true, dof: true, aa: 'msaa', godRays: true, dust: false,
    areaLights: false, spotShadow: false, texSize: 1024, grain: true, outsideDetail: 1, envMap: true, studentShadows: true
  },
  high: {
    id: 'high', maxDpr: 2, renderScale: 1, msaa: 4, cascades: 3, shadowSize: 2048, shadowMaxFar: 28,
    ao: true, aoHalf: true, aoSamples: 16, bloom: true, dof: true, aa: 'msaa', godRays: true, dust: true,
    areaLights: true, spotShadow: true, texSize: 1024, grain: true, outsideDetail: 2, envMap: true, studentShadows: true
  },
  ultra: {
    id: 'ultra', maxDpr: 2, renderScale: 1, msaa: 4, cascades: 3, shadowSize: 4096, shadowMaxFar: 30,
    ao: true, aoHalf: false, aoSamples: 16, bloom: true, dof: true, aa: 'msaa', godRays: true, dust: true,
    areaLights: true, spotShadow: true, texSize: 2048, grain: true, outsideDetail: 2, envMap: true, studentShadows: true
  }
};
export const PRESET_ORDER = ['low', 'medium', 'high', 'ultra'];

/** Gespeicherte Wahl oder 'auto'. */
export function loadQualityChoice() { return storage.get('quality', 'auto'); }
export function saveQualityChoice(v) { storage.set('quality', v); }
export function loadDetected() { return storage.get('qualityDetected', null); }
export function saveDetected(v) { storage.set('qualityDetected', v); }

/** Grobe Vorab-Schätzung aus GPU-Kennung (nur Startwert; danach misst der Frame-Timer). */
export function guessFromGPU(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) + '';
    if (/swiftshader|llvmpipe|software/i.test(name)) return { preset: 'low', gpu: name };
    if (/rtx|radeon rx|geforce gtx 1[06-9]|apple m[1-9] (pro|max|ultra)|arc a[57]/i.test(name)) return { preset: 'high', gpu: name };
    if (/apple m[1-9]|iris xe|radeon(tm)? graphics|adreno 7/i.test(name)) return { preset: 'medium', gpu: name };
    if (/intel|uhd|hd graphics|mali|adreno/i.test(name)) return { preset: 'low', gpu: name };
    return { preset: 'medium', gpu: name };
  } catch (e) { return { preset: 'medium', gpu: 'unbekannt' }; }
}

/**
 * Misst Frametimes und schlägt eine Stufe vor (nach >= 60 Frames).
 * Ziel: 60 fps → < 16,7 ms. Wir lassen Reserve.
 */
export class FrameTimer {
  constructor() { this.samples = []; this.done = false; }
  push(ms) { if (this.done) return; if (ms > 0 && ms < 500) this.samples.push(ms); }
  ready() { return this.samples.length >= 60; }
  median() { const s = this.samples.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 16; }
  suggest(current) {
    const m = this.median();
    const i = PRESET_ORDER.indexOf(current);
    this.done = true;
    if (m > 26 && i > 0) return PRESET_ORDER[i - 1];
    if (m < 9.5 && i < PRESET_ORDER.length - 1) return PRESET_ORDER[i + 1];
    return current;
  }
}
