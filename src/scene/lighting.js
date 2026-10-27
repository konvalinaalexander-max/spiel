// Licht: Sonne (CSM, über Graphics), Himmel/Hemisphäre, Deckenlichtlinien, Tafelstrahler, Fensterlicht,
// Lichtschächte ("God Rays") und Staub im Sonnenlicht, Umgebungs-Map aus der Raumszene.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import * as LY from './layout.js';
import { damp, makeRng } from '../core/util.js';

const { ROOM } = LY;
export const WEATHER = {
  sunny: { sun: 2.7, sunColor: 0xfff0d6, hemi: 0.42, sky: 0xd6e6f5, shaft: 1, window: 3.2, exposure: 1.0 },
  cloudy: { sun: 0.55, sunColor: 0xe8eef5, hemi: 0.55, sky: 0xc9d2da, shaft: 0.15, window: 2.2, exposure: 1.05 },
  rain: { sun: 0.25, sunColor: 0xd5dde6, hemi: 0.5, sky: 0x9fa9b3, shaft: 0, window: 1.5, exposure: 1.08 }
};

export function buildLighting(gfx, hall, weatherId) {
  const scene = gfx.scene, q = gfx.preset;
  const W = WEATHER[weatherId] || WEATHER.sunny;
  const out = { weather: weatherId, flicker: { idx: 3, t: 0 } };
  // Sonne (Tageszeit Vormittag, Fenster an der linken Seite)
  gfx.setSun(new THREE.Vector3(0.78, -0.5, 0.28), W.sun, W.sunColor);
  const hemi = new THREE.HemisphereLight(W.sky, 0xc4b9aa, W.hemi); scene.add(hemi); out.hemi = hemi;
  // Eingelassene LED-Panels (4 Reihen à 4)
  out.ceiling = [];
  const rowsZ = [...new Set(hall.ledPanels.map(p => p[1]))];
  if (q.areaLights) {
    RectAreaLightUniformsLib.init();
    for (const z of rowsZ) {
      const ra = new THREE.RectAreaLight(0xfff3e6, 5.5, 6.6, 0.6);
      ra.position.set(0, ROOM.h - 0.03, z); ra.rotation.x = -Math.PI / 2;
      scene.add(ra); out.ceiling.push(ra);
    }
    for (const c of LY.WINDOWS.list) {
      const wl = new THREE.RectAreaLight(W.sky, W.window, LY.WINDOWS.w - 0.1, LY.WINDOWS.y1 - LY.WINDOWS.y0 - 0.1);
      wl.position.set(ROOM.x0 - 0.05, (LY.WINDOWS.y0 + LY.WINDOWS.y1) / 2, c); wl.lookAt(0, (LY.WINDOWS.y0 + LY.WINDOWS.y1) / 2 - 0.8, c);
      scene.add(wl); out.ceiling.push(wl); wl.userData.window = true;
    }
  } else {
    // Strahler nach unten (keine Lichtflecken an der Decke)
    for (const z of rowsZ) {
      const p = new THREE.SpotLight(0xfff3e6, q.id === 'low' ? 26 : 22, 10, 1.2, 0.9, 1.3);
      p.position.set(0, ROOM.h - 0.05, z); p.target.position.set(0, 0, z + 0.3); scene.add(p, p.target); out.ceiling.push(p);
    }
  }
  // Tafelstrahler
  for (const dx of [-1.1, 1.1]) {
    const s = new THREE.SpotLight(0xfff4e6, 7, 7, 0.6, 0.6, 1.5);
    s.position.set(LY.BOARD.x + dx, ROOM.h - 0.1, ROOM.z0 + 1.8);
    s.target.position.set(LY.BOARD.x + dx * 0.6, 2.0, ROOM.z0);
    scene.add(s, s.target);
  }
  // Leuchte über dem Pult
  const lp = new THREE.SpotLight(0xfff0dd, 4, 6, 0.6, 0.7, 1.6); lp.position.set(LY.LECTERN.x - 0.3, ROOM.h - 0.1, LY.LECTERN.z + 0.6); lp.target.position.set(LY.LECTERN.x, 1, LY.LECTERN.z); scene.add(lp, lp.target);

  // Lichtschächte durch die Fenster
  out.shafts = [];
  if (q.godRays && W.shaft > 0) {
    const sun = gfx.sunDir.clone().normalize();
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uInt: { value: 0.09 * W.shaft }, uColor: { value: new THREE.Color(W.sunColor) } },
      vertexShader: `varying vec3 vP; varying float vL; varying float vE; varying vec3 vN; attribute float aL; attribute float aE; void main(){ vL=aL; vE=aE; vN=normalize(mat3(modelMatrix)*normal); vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.0);}`,
      fragmentShader: `uniform float uTime; uniform float uInt; uniform vec3 uColor; varying vec3 vP; varying float vL; varying float vE; varying vec3 vN;
        float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
        float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){ float fade = smoothstep(0.0,0.12,vL)*(1.0-smoothstep(0.45,1.0,vL));
          fade *= smoothstep(0.0, 0.45, vE) * smoothstep(1.0, 0.55, vE);
          vec3 V = normalize(cameraPosition - vP); fade *= pow(1.0 - abs(dot(normalize(vN), V)), 1.5);
          float d = n3(vP*1.3+vec3(uTime*0.05,0.0,uTime*0.03))*0.6+0.4;
          gl_FragColor = vec4(uColor*uInt*fade*d, 1.0); }`
    });
    out.shaftMat = shaftMat;
    for (const c of LY.WINDOWS.list) {
      const y0 = LY.WINDOWS.y0 + 0.05, y1 = LY.WINDOWS.y1 - 0.05, z0 = c - LY.WINDOWS.w / 2 + 0.06, z1 = c + LY.WINDOWS.w / 2 - 0.06;
      // Fensterrechteck entlang der Sonnenrichtung bis zur Reihenhöhe extrudieren
      const len = 6.5;
      const corners = [[ROOM.x0, y0, z0], [ROOM.x0, y1, z0], [ROOM.x0, y1, z1], [ROOM.x0, y0, z1]].map(a => new THREE.Vector3(...a));
      const far = corners.map(v => v.clone().addScaledVector(sun, len));
      const pos = [], L = [], E = [], idx = [];
      // jede Seitenfläche quer unterteilt, damit die Kanten weich ausblenden
      const seg = 6;
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        const o = pos.length / 3;
        for (let j = 0; j <= seg; j++) {
          const t = j / seg;
          const a = corners[k].clone().lerp(corners[k2], t), b = far[k].clone().lerp(far[k2], t);
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z); L.push(0, 1); E.push(t, t);
        }
        for (let j = 0; j < seg; j++) { const i0 = o + j * 2; idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aL', new THREE.Float32BufferAttribute(L, 1)); g.setAttribute('aE', new THREE.Float32BufferAttribute(E, 1)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, shaftMat); m.renderOrder = 3; m.frustumCulled = false; scene.add(m); out.shafts.push(m);
    }
  }
  // Staub im Sonnenlicht
  if (q.dust && W.shaft > 0.5) {
    const rng = makeRng(31); const N = 900; const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    const sun = gfx.sunDir.clone().normalize();
    for (let i = 0; i < N; i++) {
      const c = rng.pick(LY.WINDOWS.list); const s = rng.range(0.3, 6.5);
      const p = new THREE.Vector3(ROOM.x0, rng.range(LY.WINDOWS.y0, LY.WINDOWS.y1), c + rng.range(-1, 1)).addScaledVector(sun, s);
      pos.set([p.x, p.y, p.z], i * 3); seed[i] = rng.next() * 100;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const dm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: gfx.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ vec3 p = position + vec3(sin(uTime*0.11+aSeed)*0.25, sin(uTime*0.07+aSeed*1.7)*0.18, cos(uTime*0.09+aSeed)*0.25);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = uPx*(2.2+fract(aSeed)*2.0)/(-mv.z)*3.0;
          vA = 0.35+0.65*fract(aSeed*7.3); vA *= 0.5+0.5*sin(uTime*0.6+aSeed*3.0); }`,
      fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(d)); gl_FragColor = vec4(vec3(1.0,0.96,0.88)*a*vA*0.55,1.0); }`
    });
    const pts = new THREE.Points(g, dm); pts.frustumCulled = false; scene.add(pts); out.dust = dm;
  }
  // Laptop-Leuchten (wird vom Spieler gesteuert)
  const glow = new THREE.PointLight(0x9fb6ff, 0, 1.4, 2); scene.add(glow); out.laptopGlow = glow;
  out.update = (dt, t) => {
    if (out.shaftMat) out.shaftMat.uniforms.uTime.value = t;
    if (out.dust) out.dust.uniforms.uTime.value = t;
    // ein Deckenlicht flackert dezent (abschaltbar: Fotosensitivität)
    const f = out.flicker;
    if (!gfx.photosensitive && out.ceiling[f.idx] && !out.ceiling[f.idx].userData.window) {
      f.t -= dt;
      const L = out.ceiling[f.idx]; L.userData.base = L.userData.base ?? L.intensity;
      if (f.t < 0) { f.t = 6 + Math.random() * 18; f.burst = 0.5 + Math.random() * 0.6; }
      if (f.burst > 0) { f.burst -= dt; L.intensity = L.userData.base * (Math.random() < 0.5 ? 0.55 : 1); } else L.intensity = L.userData.base;
    }
  };
  out.setFlickerBurst = () => { out.flicker.t = 0; };
  return out;
}

/** Umgebungs-Map aus der fertigen Szene (Reflexionen, indirektes Licht) */
export function bakeEnvironment(gfx) {
  const pm = new THREE.PMREMGenerator(gfx.renderer);
  const env = pm.fromScene(gfx.scene, 0.035, 0.1, 60, { position: new THREE.Vector3(0, 2.6, -1) });
  gfx.scene.environment = env.texture;
  gfx.scene.environmentIntensity = 0.55;
  pm.dispose();
  return env;
}
