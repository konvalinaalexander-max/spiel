// Renderer, Postprocessing-Kette, Kaskadenschatten und Material-Registry.
import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, SMAAPreset, FXAAEffect, DepthOfFieldEffect,
  VignetteEffect, ChromaticAberrationEffect, ToneMappingEffect, ToneMappingMode, HueSaturationEffect,
  BrightnessContrastEffect, NoiseEffect, BlendFunction
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { CASEffect } from './cas.js';
import { PRESETS } from './quality.js';
import { TextureFactory } from './textures.js';
import { clamp, damp } from '../core/util.js';

export class Graphics {
  constructor(canvas, presetId) {
    this.preRender = []; // Arbeit, die nur vor einem gezeichneten Bild nötig ist (z. B. Textur-Teil-Uploads der Tafel)
    this.canvas = canvas;
    this.preset = { ...PRESETS[presetId] };
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping; // Tone-Mapping macht der Post-Stack
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    this.renderer = renderer;
    this.tex = new TextureFactory(renderer);
    this.materials = new Set();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.04, 520);
    this.camera.layers.enable(0);
    this.csm = null;
    this.sunDir = new THREE.Vector3(0.75, -0.55, 0.22).normalize();
    this.dofTarget = 0;   // 0 = aus, 1 = Laptop-Fokus
    this.sharpen = 0.3;   // Nachschärfung (CAS), Einstellung 0–0,6
    this.stress = 0;      // 0–1, steuert Aberration/Vignette
    this.size = new THREE.Vector2();
    this.timings = [];
    this._buildCSM();
  }

  // ---------- Materialien ------------------------------------------------
  /** Registriert ein Material: CSM + eigene Shader-Patches werden verkettet. */
  register(m) {
    if (this.materials.has(m)) return m;
    this.materials.add(m);
    this._finalize(m);
    return m;
  }
  _finalize(m) {
    const patches = m.userData.patches || [];
    if (this.csm && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) {
      this.csm.setupMaterial(m);
      const csmFn = m.onBeforeCompile;
      m.onBeforeCompile = (s, r) => { csmFn.call(m, s, r); for (const p of patches) p(s, r); };
    } else if (patches.length) {
      m.onBeforeCompile = (s, r) => { for (const p of patches) p(s, r); };
    }
    if (patches.length) m.customProgramCacheKey = () => (m.userData.patchKey || 'p') + patches.length;
  }
  /**
   * PBR-Material aus Rezeptur. o: { recipe, texOpts, color, roughness, metalness, normalScale, envMapIntensity, ... }
   */
  pbr(o = {}) {
    const params = {
      color: o.color ?? 0xffffff, roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
      envMapIntensity: o.envMapIntensity ?? 1, side: o.side ?? THREE.FrontSide
    };
    const real = o.pbr && this.pbrSets && this.pbrSets[o.pbr];
    if (real) {
      // echtes Material (ambientCG, KTX2): Farbe auf den gewünschten Ton umfärben (Wunsch / Mittelwert der Textur, linear)
      params.map = o.noMap ? null : real.map; params.normalMap = real.normalMap;
      params.roughnessMap = real.orm; params.metalnessMap = real.orm; params.aoMap = real.orm;
      params.aoMapIntensity = o.aoIntensity ?? 1;
      params.roughness = o.roughness ?? 1; params.metalness = real.metal ? 1 : (o.metalness ?? 0);
      params.normalScale = new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1);
      if (o.tint && real.avg) {
        const want = new THREE.Color(o.tint), avg = new THREE.Color().setRGB(real.avg[0], real.avg[1], real.avg[2], THREE.SRGBColorSpace);
        params.color = new THREE.Color(Math.min(3, want.r / Math.max(avg.r, 0.02)), Math.min(3, want.g / Math.max(avg.g, 0.02)), Math.min(3, want.b / Math.max(avg.b, 0.02)));
      }
    } else if (o.recipe) {
      const t = this.tex.make(o.recipe, { size: Math.min(o.texOpts?.size || this.preset.texSize, this.preset.texSize), ...(o.texOpts || {}) });
      params.map = o.noMap ? null : t.map;
      params.normalMap = t.normalMap;
      params.roughnessMap = t.ormMap; params.metalnessMap = t.ormMap; params.aoMap = t.ormMap;
      params.aoMapIntensity = o.aoIntensity ?? 1;
      params.normalScale = new THREE.Vector2(o.normalScale ?? 1, o.normalScale ?? 1);
    }
    for (const k of ['transparent', 'opacity', 'emissive', 'emissiveIntensity', 'emissiveMap', 'depthWrite', 'alphaTest', 'vertexColors', 'flatShading', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits'])
      if (o[k] !== undefined) params[k] = o[k];
    const m = new THREE.MeshStandardMaterial(params);
    if (o.name) m.name = o.name;
    if (real) { m.userData.uvMeters = (o.meters ?? real.meters) / (o.scale ?? 1); m.userData.pbr = o.pbr; }
    if (o.patches) { m.userData.patches = o.patches; m.userData.patchKey = o.patchKey || o.name || 'patched'; }
    return this.register(m);
  }

  // ---------- Schatten ---------------------------------------------------
  _buildCSM() {
    const p = this.preset;
    if (this.csm) { this.csm.remove(); this.csm.dispose(); }
    this.csm = new CSM({
      maxFar: p.shadowMaxFar, cascades: p.cascades, mode: 'practical', parent: this.scene,
      shadowMapSize: p.shadowSize, lightDirection: this.sunDir.clone(), camera: this.camera,
      lightIntensity: 2.6, lightNear: 1, lightFar: 120, lightMargin: 40, shadowBias: -0.00018
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) { l.shadow.normalBias = 0.035; l.color.set(0xfff0d8); }
    for (const m of this.materials) this._finalize(m), (m.needsUpdate = true);
  }
  setSun(dir, intensity, color) {
    this.sunDir.copy(dir).normalize();
    this.csm.lightDirection.copy(this.sunDir);
    for (const l of this.csm.lights) { l.intensity = intensity; if (color) l.color.set(color); }
  }

  // ---------- Post-Stack -------------------------------------------------
  buildPost() {
    const p = this.preset;
    // Kantenglättung: MSAA auf dem Hauptpass (WebGL2); ohne Multisampling SMAA als Rückfall. Kein FXAA (weichzeichnend).
    const caps = this.renderer.capabilities;
    const samples = p.aa === 'msaa' && caps.isWebGL2 ? Math.min(p.msaa || 4, caps.maxSamples || 0) : 0;
    this.msaaSamples = samples;
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: samples });
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (p.ao) {
      const ao = new N8AOPostPass(this.scene, this.camera, 1, 1);
      ao.configuration.aoRadius = 0.55;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 2.4;
      ao.configuration.aoSamples = p.aoSamples;
      ao.configuration.denoiseSamples = 6;
      ao.configuration.denoiseRadius = 10;
      ao.configuration.halfRes = p.aoHalf;
      ao.configuration.gammaCorrection = false;
      ao.configuration.color = new THREE.Color(0x14100c);
      composer.addPass(ao);
      this.aoPass = ao;
    }
    if (p.dof) {
      // nur Fernfeld im Laptop-/Heftblick; volle Auflösung und kleiner Bokeh, damit die Fokusebene messerscharf bleibt
      this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 0.6, focusRange: 0.5, bokehScale: 1.5, resolutionScale: 1 });
      this.dofPass = new EffectPass(this.camera, this.dof);
      this.dofPass.enabled = false;
      composer.addPass(this.dofPass);
    }
    const fx = [];
    // Bloom nur für echte Lichtquellen (Lampen, Fenster, LEDs) – Folien- und Papierweiß liegen darunter
    if (p.bloom) { this.bloom = new BloomEffect({ intensity: 0.3, luminanceThreshold: 1.1, luminanceSmoothing: 0.15, mipmapBlur: true, radius: 0.6, levels: 6 }); fx.push(this.bloom); }
    this.hueSat = new HueSaturationEffect({ saturation: 0, hue: 0 });
    this.bc = new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.08 });
    this.vignette = new VignetteEffect({ eskil: false, offset: 0.35, darkness: 0.2 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    fx.push(this.tone, this.hueSat, this.bc, this.vignette);
    if (p.grain) { this.noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN }); this.noise.blendMode.opacity.value = 0.03; fx.push(this.noise); }
    composer.addPass(new EffectPass(this.camera, ...fx));
    this.ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.25 });
    this.caPass = new EffectPass(this.camera, this.ca);
    this.caPass.enabled = false;
    composer.addPass(this.caPass);
    if (!samples) composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    // Nachschärfung als letzter Pass (Anzeige-Farbraum)
    this.cas = new CASEffect({ sharpness: this.sharpen / 0.6 });
    this.casPass = new EffectPass(this.camera, this.cas);
    this.casPass.enabled = this.sharpen > 0.001;
    composer.addPass(this.casPass);
    this.composer = composer;
    this.resize();
  }
  /** Laufzeit-Änderungen, die keinen Neustart brauchen */
  applyLive(next) {
    const p = this.preset;
    const needRebuildPost = ['ao', 'aoHalf', 'aoSamples', 'bloom', 'dof', 'aa', 'msaa', 'grain'].some(k => next[k] !== p[k]);
    const needCSM = next.cascades !== p.cascades || next.shadowSize !== p.shadowSize || next.shadowMaxFar !== p.shadowMaxFar;
    Object.assign(p, next, { texSize: p.texSize });
    if (needCSM) this._buildCSM();
    if (needRebuildPost) { this.composer.dispose(); this.buildPost(); }
    this.resize();
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth || innerWidth), h = Math.max(1, this.canvas.clientHeight || innerHeight);
    // native Bildschirmpixel (bis Gerätepixelverhältnis maxDpr) × Regler „Renderauflösung“ (renderScale, 50–200 %);
    // Obergrenze ≈ 16,6 Mio. Pixel (doppeltes 4K), damit der Regler auf großen Bildschirmen nichts sprengt
    let dpr = Math.min(window.devicePixelRatio || 1, this.preset.maxDpr) * this.preset.renderScale;
    dpr = Math.min(dpr, Math.sqrt(16.6e6 / (w * h)));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h, false);
    if (this.csm) this.csm.updateFrustums();
    this.size.set(w, h);
    this.pixelRatio = dpr;
  }
  /** tatsächliche Renderauflösung in Pixeln und Verhältnis zu den Bildschirmpixeln (für die Einstellungen) */
  renderInfo() { const c = this.renderer.domElement, dev = window.devicePixelRatio || 1; return { w: c.width, h: c.height, ratio: this.pixelRatio / dev, msaa: this.msaaSamples || 0 }; }
  /** Texturdisziplin: maximale anisotrope Filterung für alle Texturen der Szene (Mipmaps erzeugt three.js ohnehin) */
  finalizeTextures(root = this.scene) {
    const a = this.renderer.capabilities.getMaxAnisotropy(), seen = new Set();
    root.traverse(o => {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap', 'lightMap']) {
        const t = m[k]; if (!t || seen.has(t)) continue; seen.add(t);
        if (t.anisotropy < a && !t.isRenderTargetTexture) { t.anisotropy = a; t.needsUpdate = true; }
      }
    });
    return seen.size;
  }
  setSharpen(v) { this.sharpen = v; if (this.cas) { this.cas.sharpness = v / 0.6; this.casPass.enabled = v > 0.001; } }
  setStress(s) { this.stress = clamp(s, 0, 1); }
  /** Fokussteuerung für DOF (Distanz in m) */
  setFocus(enabled, dist = 0.55, range = 0.35) {
    if (!this.dof) return;
    this.dofPass.enabled = enabled;
    this.dof.cocMaterial.focusDistance = dist;
    this.dof.cocMaterial.focusRange = range;
  }
  render(dt) {
    const s = this.stress;
    if (this.ca) {
      const amt = this.photosensitive || this.caDisabled ? 0 : Math.min(0.0015, Math.max(0, s - 0.55) * 0.0034);
      this.caPass.enabled = amt > 0.0004;
      this.ca.offset.set(amt, amt * 0.6);
    }
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 3.2);
    if (this.vignette) this.vignette.darkness = damp(this.vignette.darkness, (this.vignetteBase ?? 0.2) + s * 0.3, 4, dt) + this.pulse * 0.1 * s;
    this.csm.update();
    for (const f of this.preRender) f();
    this.renderer.info.reset();
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
  stats() { const i = this.renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : 0 }; }
}
