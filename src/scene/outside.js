// Blick aus dem 3. OG des Gregor-Mendel-Hauses: Gregor-Mendel-Straße mit Bushaltestelle Linnéplatz (40A/37A),
// Türkenschanzpark im Herbst (Laub- und Nadelbäume), Cottage-Villen, Paulinenwarte, Wienerwald-Silhouette.
// Außerdem: elektrische Verdunkelungsrollos.
import * as THREE from 'three';
import * as LY from './layout.js';
import { Batcher, mergeGeometries, rbox, box, cyl, mat } from '../gfx/geom.js';
import { makeRng, damp } from '../core/util.js';

const { ROOM } = LY;
const GROUND = -12.6;   // 3. Obergeschoß

function leafTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = makeRng(kind === 'needle' ? 9 : 4);
  g.clearRect(0, 0, 256, 256);
  if (kind === 'needle') {
    for (let i = 0; i < 26; i++) {
      const x = 20 + r.next() * 216, y = 20 + r.next() * 216, a = r.next() * Math.PI * 2, L = 40 + r.next() * 50;
      g.strokeStyle = `rgba(${200 + r.next() * 55},${200 + r.next() * 55},${200 + r.next() * 55},1)`; g.lineWidth = 2.2;
      for (let k = 0; k < 24; k++) { const t = k / 24, bx = x + Math.cos(a) * L * t, by = y + Math.sin(a) * L * t; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + s * 0.9) * 12, by + Math.sin(a + s * 0.9) * 12); g.stroke(); } }
    }
  } else {
    for (let i = 0; i < 150; i++) {
      const x = 16 + r.next() * 224, y = 16 + r.next() * 224, a = r.next() * Math.PI * 2, s = 7 + r.next() * 9, v = 170 + r.next() * 85 | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); g.ellipse(x, y, s, s * 0.55, a, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function buildOutside(gfx, weatherId, quality) {
  const scene = gfx.scene; const rng = makeRng(1180);
  const out = { t: 0, busT: 20 };
  const W = { sunny: { top: 0x4a86c8, hor: 0xd3e2ee, cloud: 0.35, dark: 0, haze: 0xb9c9d6 }, cloudy: { top: 0x8e9cab, hor: 0xd6dde3, cloud: 0.85, dark: 0.15, haze: 0xc5ccd2 }, rain: { top: 0x5d6873, hor: 0xa9b2ba, cloud: 1.0, dark: 0.35, haze: 0x9aa3ab } }[weatherId] || {};
  // ---------------------------------------------------------------- Himmel mit Wolken und Wienerwald-Silhouette
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(W.top) }, uHor: { value: new THREE.Color(W.hor) }, uHaze: { value: new THREE.Color(W.haze) }, uCloud: { value: W.cloud }, uDark: { value: W.dark }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uHaze; uniform float uCloud; uniform float uDark; uniform float uTime; varying vec3 vD;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=n(p)*a;p*=2.03;a*=0.5;}return s;}
      void main(){ float y = vD.y;
        vec3 col = mix(uHor, uTop, pow(max(y, 0.0), 0.55));
        vec2 uv = vD.xz / (max(y, 0.02) + 0.18) * 1.3 + vec2(uTime*0.004, uTime*0.0015);
        float c = smoothstep(1.0 - uCloud*0.75, 1.15 - uCloud*0.5, fbm(uv));
        vec3 cloudCol = mix(vec3(1.0), vec3(0.6,0.64,0.69), uDark + c*0.25);
        col = mix(col, cloudCol, c * smoothstep(0.02, 0.15, y));
        // Hügelkette (Wienerwald) am Horizont
        float az = atan(vD.z, vD.x);
        float ridge = 0.035 + 0.025*sin(az*3.1+1.2) + 0.012*sin(az*9.7) + 0.006*sin(az*23.0);
        float hill = smoothstep(ridge + 0.004, ridge - 0.004, y) * smoothstep(-0.05, 0.0, y);
        col = mix(col, mix(uHaze, vec3(0.32,0.4,0.36), 0.35), hill * 0.85);
        col = mix(col, uHaze, smoothstep(0.0, -0.08, y));
        gl_FragColor = vec4(col, 1.0); }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 32, 16), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky); out.sky = skyMat;
  scene.fog = null;

  // ---------------------------------------------------------------- Außenfassade (Ziegel) mit Fensteröffnungen
  const brick = gfx.pbr({ name: 'brick', recipe: 'brick', texOpts: { p: [4, 13, 0, 0], c1: '#a8543e', c2: '#8f4532', size: 512 } });
  const cornice = gfx.pbr({ name: 'cornice', recipe: 'plaster', texOpts: { c1: '#e9dfcc', seed: 3, size: 256 } });
  const B = new Batcher();
  const fx = ROOM.x0 - 0.42, WN = LY.WINDOWS;
  const outerH0 = GROUND, outerH1 = ROOM.h + 3;
  // Mauerstücke um die Fenster (Außenseite)
  let z = ROOM.z0 - 0.5;
  for (const c of WN.list) { B.add(box(0.1, outerH1 - outerH0, c - WN.w / 2 - z), brick, mat(fx - 0.05, (outerH0 + outerH1) / 2, (z + c - WN.w / 2) / 2), { tile: 1.2 }); z = c + WN.w / 2; }
  B.add(box(0.1, outerH1 - outerH0, ROOM.z1 + 0.5 - z), brick, mat(fx - 0.05, (outerH0 + outerH1) / 2, (z + ROOM.z1 + 0.5) / 2), { tile: 1.2 });
  for (const c of WN.list) {
    B.add(box(0.1, WN.y0 - outerH0, WN.w), brick, mat(fx - 0.05, (outerH0 + WN.y0) / 2, c), { tile: 1.2 });
    B.add(box(0.1, outerH1 - WN.y1, WN.w), brick, mat(fx - 0.05, (WN.y1 + outerH1) / 2, c), { tile: 1.2 });
    B.add(rbox(0.22, 0.08, WN.w + 0.2, 0.02), cornice, mat(fx - 0.11, WN.y0 - 0.05, c), { tile: 0.6 }); // Sohlbank
    B.add(rbox(0.12, 0.18, WN.w + 0.3, 0.02), cornice, mat(fx - 0.06, WN.y1 + 0.12, c), { tile: 0.6 }); // Sturzgesims
  }
  B.add(rbox(0.3, 0.25, ROOM.z1 - ROOM.z0 + 1, 0.04), cornice, mat(fx - 0.15, -0.35, 0), { tile: 1 }); // Geschoßgesims

  // ---------------------------------------------------------------- Boden: Straße, Gehsteige, Park
  const grass = gfx.pbr({ name: 'grass', recipe: 'grass', texOpts: { c1: '#5b7f3e', c2: '#87924a', size: 512 } });
  const asphalt = gfx.pbr({ name: 'asphalt', recipe: 'concrete', texOpts: { c1: '#4f5154', seed: 5, size: 512 } });
  const pave = gfx.pbr({ name: 'sidewalk', recipe: 'concrete', texOpts: { c1: '#a39f97', seed: 7, size: 512 } });
  const mark = gfx.pbr({ name: 'roadMark', color: 0xe8e6dc, roughness: 0.7 });
  B.add(box(400, 0.2, 400), grass, mat(-150, GROUND - 0.1, 0), { tile: 8 });
  B.add(box(4.5, 0.1, 160), pave, mat(-7.4, GROUND + 0.05, 0), { tile: 2 });        // Gehsteig am Haus
  B.add(box(8, 0.06, 160), asphalt, mat(-13.6, GROUND + 0.03, 0), { tile: 4 });      // Gregor-Mendel-Straße
  for (let zz = -78; zz < 78; zz += 6) B.add(box(0.14, 0.065, 3), mark, mat(-13.6, GROUND + 0.035, zz), { cast: false });
  B.add(box(3, 0.12, 160), pave, mat(-19.1, GROUND + 0.06, 0), { tile: 2 });        // Gehsteig Parkseite
  // Bushaltestelle "Linnéplatz" (40A/37A)
  const stopX = -19.6, stopZ = -6;
  const steel = gfx.pbr({ name: 'steel', recipe: 'metalBrushed', texOpts: { c1: '#9aa0a6', size: 256 }, metalness: 1 });
  B.add(cyl(0.05, 0.05, 2.8, 10), steel, mat(stopX + 0.6, GROUND + 1.4, stopZ + 3), {});
  const signCv = document.createElement('canvas'); signCv.width = 256; signCv.height = 256; { const g = signCv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e3000f'; g.fillRect(0, 0, 256, 70); g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.fillText('Linnéplatz', 22, 50); g.fillStyle = '#e3000f'; g.font = 'bold 64px Arial'; g.fillText('40A', 22, 150); g.fillText('37A', 22, 230); }
  const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = gfx.pbr({ name: 'busSign', roughness: 0.6 }); signMat.map = signTex;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), signMat); sign.position.set(stopX + 0.55, GROUND + 2.5, stopZ + 3); sign.rotation.y = Math.PI / 2; scene.add(sign);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.35, roughness: 0.1 }); gfx.register(glassMat);
  B.add(box(1.4, 0.06, 3.4), steel, mat(stopX - 0.4, GROUND + 2.45, stopZ), {});
  for (const dz of [-1.65, 1.65]) B.add(cyl(0.04, 0.04, 2.4, 8), steel, mat(stopX - 1.0, GROUND + 1.2, stopZ + dz), {});
  const shelterGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.2), glassMat); shelterGlass.position.set(stopX - 1.05, GROUND + 1.2, stopZ); shelterGlass.rotation.y = Math.PI / 2; scene.add(shelterGlass);
  // Parkbänke, Laternen, Parkweg
  const lampMat = gfx.pbr({ name: 'lampPost', color: 0x2a3033, roughness: 0.5, metalness: 0.6 });
  for (let zz = -48; zz < 48; zz += 16) { B.add(cyl(0.07, 0.09, 4.5, 8), lampMat, mat(-17.9, GROUND + 2.25, zz), {}); B.add(rbox(0.6, 0.18, 0.28, 0.06), lampMat, mat(-17.6, GROUND + 4.5, zz), {}); }
  const path = gfx.pbr({ name: 'gravel', recipe: 'concrete', texOpts: { c1: '#b9a98a', seed: 12, size: 512 } });
  B.add(box(2.6, 0.04, 140), path, mat(-30, GROUND + 0.02, 0, 0, 0.12, 0), { tile: 2 });
  const benchMat = gfx.pbr({ name: 'parkBench', color: 0x3c5a3a, roughness: 0.7 });
  for (const zz of [-20, 4, 26]) { B.add(rbox(0.5, 0.06, 1.8, 0.02), benchMat, mat(-28.3, GROUND + 0.45, zz), {}); B.add(rbox(0.06, 0.45, 1.8, 0.02), benchMat, mat(-28.05, GROUND + 0.72, zz), {}); }

  // ---------------------------------------------------------------- Cottage-Villen und Paulinenwarte
  const villaCols = ['#efe2bd', '#e7d49b', '#f3efe6', '#e2c98e', '#ebe4d4'];
  const winDark = gfx.pbr({ name: 'winDark', color: 0x2b333b, roughness: 0.15, metalness: 0.3 });
  const roofRed = gfx.pbr({ name: 'roofRed', recipe: 'concrete', texOpts: { c1: '#8f4a37', seed: 2, size: 256 } });
  for (let i = 0; i < 9; i++) {
    const vx = -95 - rng.range(0, 60), vz = -90 + i * 22 + rng.range(-6, 6), vw = rng.range(10, 15), vh = rng.range(10, 14), y0 = GROUND + rng.range(4, 10);
    const vm = gfx.pbr({ name: 'villa' + (i % 5), recipe: 'plaster', texOpts: { c1: villaCols[i % 5], seed: i % 5, size: 256 } });
    B.add(box(vw, vh, vw * 0.8), vm, mat(vx, y0 + vh / 2, vz), { tile: 3 });
    const roof = new THREE.ConeGeometry(vw * 0.78, vh * 0.42, 4, 1); roof.rotateY(Math.PI / 4);
    B.add(roof, roofRed, mat(vx, y0 + vh + vh * 0.21, vz, 0, 0, 0, 1, 1, 0.82), { tile: 2 });
    for (let f = 0; f < 3; f++) for (let k = 0; k < 4; k++) B.add(box(0.2, 1.7, 1.1), winDark, mat(vx + vw / 2 + 0.06, y0 + 2 + f * 3.2, vz - vw * 0.3 + k * vw * 0.2), { cast: false });
  }
  const warteX = -165, warteZ = -38, warteY = GROUND + 14;
  const stoneMat = gfx.pbr({ name: 'warteStone', recipe: 'concrete', texOpts: { c1: '#d8d0bf', seed: 14, size: 256 } });
  B.add(cyl(3.2, 3.6, 17, 20), stoneMat, mat(warteX, warteY + 8.5, warteZ), { tile: 3 });
  B.add(cyl(3.9, 3.9, 4, 20), gfx.pbr({ name: 'fachwerk', recipe: 'plaster', texOpts: { c1: '#f2ede2', seed: 9, size: 256 } }), mat(warteX, warteY + 19, warteZ), { tile: 2 });
  const beam = gfx.pbr({ name: 'beam', color: 0x4a3326, roughness: 0.8 }); // ein Material für alle Balken → ein Draw Call
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; B.add(box(0.25, 4, 0.25), beam, mat(warteX + Math.cos(a) * 3.95, warteY + 19, warteZ + Math.sin(a) * 3.95), { cast: false }); }
  B.add(new THREE.ConeGeometry(4.6, 4, 20), roofRed, mat(warteX, warteY + 23, warteZ), { tile: 2 });
  // Gebäude und Straße werfen keine Schatten: vom Saal aus nicht sichtbar, kostet aber je Kaskade ≈ 10 Draw Calls
  for (const m of B.build(scene, 'outside')) m.castShadow = false;

  // ---------------------------------------------------------------- Bäume (Laubkarten mit Wind)
  out.windU = { value: 0 };
  const windPatch = s => {
    s.uniforms.uWind = out.windU;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float k = clamp((wp.y - ${GROUND.toFixed(1)} - 3.0) * 0.012, 0.0, 0.35);
          transformed.x += sin(uWind * 1.3 + wp.z * 0.21 + wp.x * 0.13) * k + sin(uWind * 4.1 + wp.y * 1.7 + wp.x) * k * 0.25;
          transformed.z += cos(uWind * 1.1 + wp.x * 0.17) * k * 0.7; }`);
  };
  const leafMat = gfx.pbr({ name: 'leaves', vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.45, patches: [windPatch], patchKey: 'wind' });
  leafMat.map = leafTexture('leaf');
  const needleMat = gfx.pbr({ name: 'needles', vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.4, patches: [windPatch], patchKey: 'wind' });
  needleMat.map = leafTexture('needle');
  const bark = gfx.pbr({ name: 'bark', recipe: 'concrete', texOpts: { c1: '#4c3d31', seed: 11, size: 256 } });
  const autumn = weatherId === 'sunny' ? ['#c8902c', '#d9a838', '#b5612a', '#8f9a3a', '#a7432a', '#d3b54a', '#6e8a35'] : ['#a8802c', '#b8963a', '#9a5a2a', '#7a8a3a', '#8f4a2a', '#b39a44', '#5f7a35'];
  const TB = new Batcher();
  const card = new THREE.PlaneGeometry(1, 1);
  const addCrown = (x, y, z, rx, ry, rz, n, m, cols, size) => {
    for (let k = 0; k < n; k++) {
      const u = rng.next() * Math.PI * 2, v = Math.acos(rng.range(-1, 1)), rr = Math.cbrt(rng.next());
      const px = x + Math.sin(v) * Math.cos(u) * rx * rr, py = y + Math.cos(v) * ry * rr, pz = z + Math.sin(v) * Math.sin(u) * rz * rr;
      const s = size * rng.range(0.7, 1.3);
      const col = new THREE.Color(rng.pick(cols)).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.06, 0.04));
      // nach außen dunkler/innen dunkler (Selbstverschattung)
      col.multiplyScalar(0.55 + 0.45 * rr);
      TB.add(card, m, mat(px, py, pz, rng.range(0, Math.PI), rng.range(0, Math.PI), rng.range(0, Math.PI), s, s, s), { color: col, keepUV: true, cast: true });
    }
  };
  const nTrees = quality.outsideDetail >= 2 ? 95 : quality.outsideDetail >= 1 ? 70 : 40;
  for (let i = 0; i < nTrees; i++) {
    const x = -22 - Math.pow(rng.next(), 0.8) * 95, zz = rng.range(-90, 80);
    const conifer = rng.chance(0.42);
    const hgt = rng.range(14, 24), gy = GROUND + Math.max(0, (-x - 40) * 0.08);
    TB.add(cyl(0.22, 0.38, hgt * 0.75, 7), bark, mat(x, gy + hgt * 0.37, zz), { tile: 1.5 });
    if (conifer) {
      for (let k = 0; k < 6; k++) { const t = k / 6; addCrown(x, gy + hgt * (0.3 + t * 0.62), zz, (1 - t) * 3.6 + 0.6, 1.4, (1 - t) * 3.6 + 0.6, 26, needleMat, ['#2f4a2e', '#3a5634', '#26402a', '#425c3a'], 2.0); }
    } else {
      const cr = rng.range(4, 6.5);
      addCrown(x, gy + hgt * 0.68, zz, cr, cr * 0.8, cr, quality.outsideDetail >= 2 ? 110 : 80, leafMat, autumn, 2.6);
    }
  }
  // Alleebäume direkt an der Straße (näher → etwas mehr Karten)
  for (let zz = -40; zz <= 40; zz += 10 + rng.range(-2, 3)) {
    const x = -18.2, hgt = rng.range(15, 19);
    TB.add(cyl(0.25, 0.35, hgt * 0.7, 8), bark, mat(x, GROUND + hgt * 0.35, zz), { tile: 1.5 });
    addCrown(x, GROUND + hgt * 0.72, zz, 4.2, 3.6, 4.2, 140, leafMat, autumn, 2.0);
  }
  TB.build(scene, 'trees');

  // ---------------------------------------------------------------- Verkehr: Busse 40A/37A (rot), Autos
  out.vehicles = [];
  const B2 = new Batcher();
  const makeBus = line => {
    const g = new THREE.Group();
    const red = gfx.pbr({ name: 'busRed', color: 0xd7141a, roughness: 0.35, metalness: 0.2 });
    const white = gfx.pbr({ name: 'busWhite', color: 0xf3f3f0, roughness: 0.4 });
    const body = new THREE.Mesh(rbox(2.5, 2.6, 12, 0.25, 2), red); body.position.y = 1.55;
    const roof = new THREE.Mesh(rbox(2.4, 0.3, 11.6, 0.12, 1), white); roof.position.y = 2.95;
    const win = new THREE.Mesh(box(2.54, 1.0, 11.2), winDark); win.position.y = 2.0;
    const lcv = document.createElement('canvas'); lcv.width = 128; lcv.height = 48; { const c = lcv.getContext('2d'); c.fillStyle = '#111'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#ffb000'; c.font = 'bold 34px Arial'; c.fillText(line, 10, 36); }
    const lt = new THREE.CanvasTexture(lcv); lt.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshBasicMaterial({ map: lt })); disp.position.set(0, 2.65, 6.02);
    g.add(body, roof, win, disp);
    // vier Räder als ein Mesh (ein Draw Call)
    const wg = []; for (const zz of [-3.8, 3.8]) for (const sx of [-1, 1]) { const w = cyl(0.5, 0.5, 0.3, 16); w.rotateZ(Math.PI / 2); w.translate(sx * 1.15, 0.5, zz); wg.push(w); }
    g.add(new THREE.Mesh(mergeGeometries(wg, false), lampMat));
    return g;
  };
  const carCols = [0x2f4a6b, 0xb8bcc0, 0x1f1f1f, 0x8a2a24, 0xe8e6e0, 0x3e5a3a];
  const makeCar = i => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(rbox(1.8, 0.75, 4.3, 0.25, 2), gfx.pbr({ name: 'car' + i, color: carCols[i % 6], roughness: 0.25, metalness: 0.6 })); body.position.y = 0.6;
    const cab = new THREE.Mesh(rbox(1.6, 0.6, 2.2, 0.2, 2), winDark); cab.position.set(0, 1.2, -0.2);
    g.add(body, cab); return g;
  };
  const lanes = [-12.0, -15.2];
  for (let i = 0; i < 2; i++) { const b = makeBus(i ? '37A' : '40A'); b.position.set(lanes[i % 2], GROUND, 200); b.userData = { bus: true, lane: i % 2, speed: 0, wait: rng.range(5, 40), stop: false }; scene.add(b); out.vehicles.push(b); }
  for (let i = 0; i < 5; i++) { const c = makeCar(i); c.position.set(lanes[i % 2], GROUND, 200); c.userData = { lane: i % 2, speed: 0, wait: rng.range(1, 30) }; scene.add(c); out.vehicles.push(c); }
  // geparkte Autos auf der Hausseite: statisch gebatcht (Vertexfarben) statt 12 Einzel-Meshes
  const parked = gfx.pbr({ name: 'parkedCars', color: 0xffffff, roughness: 0.25, metalness: 0.6, vertexColors: true });
  for (let i = 0; i < 6; i++) {
    const z = -40 + i * 13 + rng.range(-2, 2);
    B2.add(rbox(1.8, 0.75, 4.3, 0.25, 2), parked, mat(-10.4, GROUND + 0.6, z), { color: carCols[(i + 3) % 6], keepUV: true, cast: false });
    B2.add(rbox(1.6, 0.6, 2.2, 0.2, 2), winDark, mat(-10.4, GROUND + 1.2, z - 0.2), { keepUV: true, cast: false });
  }
  B2.build(scene, 'parked');
  // ---------------------------------------------------------------- Regen
  if (weatherId === 'rain' || weatherId === 'cloudy') {
    const N = 3000, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = rng.range(-40, -5); pos[i * 3 + 1] = rng.range(GROUND, 16); pos[i * 3 + 2] = rng.range(-30, 25); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uAmt: { value: weatherId === 'rain' ? 1 : 0 } },
      vertexShader: `uniform float uTime; void main(){ vec3 p = position; p.y = ${GROUND.toFixed(1)} + mod(p.y - ${GROUND.toFixed(1)} - uTime*9.0, 29.0); vec4 mv = modelViewMatrix*vec4(p,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = 70.0/(-mv.z); }`,
      fragmentShader: `uniform float uAmt; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.07, 0.0, abs(d.x)) * smoothstep(0.5, 0.0, abs(d.y)); gl_FragColor = vec4(0.78,0.82,0.88, a*0.35*uAmt); }`
    });
    const rain = new THREE.Points(g, rm); rain.frustumCulled = false; scene.add(rain); out.rain = rm;
  }
  /** Regen setzt ein (Ereignis bei bewölktem Wetter) */
  out.startRain = () => { if (out.rain) out.rainTarget = 1; };
  out.update = (dt, t, onBus) => {
    out.t = t; skyMat.uniforms.uTime.value = t; out.windU.value = t * (weatherId === 'rain' ? 1.6 : 1);
    if (out.rain) { out.rain.uniforms.uTime.value = t; if (out.rainTarget) out.rain.uniforms.uAmt.value = Math.min(1, out.rain.uniforms.uAmt.value + dt * 0.08); }
    for (const v of out.vehicles) {
      const u = v.userData, dir = u.lane === 0 ? 1 : -1;
      if (u.speed === 0 && !u.stopping) { u.wait -= dt; if (u.wait <= 0) { u.speed = u.bus ? 9 : 11 + Math.random() * 4; v.position.z = -95 * dir; u.stopped = false; if (onBus && u.bus) onBus('approach', v); } continue; }
      // Busse halten am Linnéplatz (Parkseite)
      if (u.bus && u.lane === 1 && !u.stopped && Math.abs(v.position.z - (stopZ - 0)) < 14) {
        const d = v.position.z - stopZ; u.speed = Math.max(0.4, Math.min(u.speed, Math.abs(d) * 0.8));
        if (Math.abs(d) < 0.5) { u.stopped = true; u.dwell = 12; u.stopping = true; if (onBus) onBus('stop', v); }
      }
      if (u.stopping) { u.dwell -= dt; if (u.dwell <= 0) { u.stopping = false; u.speed = 2; if (onBus) onBus('depart', v); } continue; }
      if (u.bus && u.stopped) u.speed = Math.min(9, u.speed + dt * 1.5);
      v.position.z += u.speed * dir * dt; v.rotation.y = dir > 0 ? 0 : Math.PI;
      if (Math.abs(v.position.z) > 100) { u.speed = 0; u.wait = (u.bus ? 35 : 6) + Math.random() * 40; v.position.z = 200; }
    }
  };
  out.ground = GROUND;
  return out;
}

/** Elektrische Verdunkelung: graue Screen-Rollos, je Fenster absenkbar (0 = offen, 1 = zu) */
export function buildBlinds(gfx, initial = [0.45, 0, 0]) {
  const WN = LY.WINDOWS;
  const fab = gfx.pbr({ name: 'rollo', recipe: 'fabric', color: 0x8f9297, texOpts: { p: [300, 0, 0, 0], size: 256, seed: 6 }, side: THREE.DoubleSide });
  fab.transparent = true; fab.opacity = 0.93;
  const housing = gfx.pbr({ name: 'rolloBox', recipe: 'plastic', texOpts: { c1: '#e8e7e2', size: 256 } });
  // Rollokästen sind statisch → ein gemeinsames Mesh
  const boxes = new THREE.Mesh(mergeGeometries(WN.list.map(c => rbox(0.12, 0.12, WN.w + 0.1, 0.02).translate(ROOM.x0 - 0.06, WN.y1 + 0.12, c)), false), housing);
  boxes.castShadow = true; gfx.scene.add(boxes);
  const items = WN.list.map((c, i) => {
    const x = ROOM.x0 - 0.06;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(WN.w - 0.02, 1), fab); cloth.rotation.y = Math.PI / 2; cloth.castShadow = true; cloth.receiveShadow = true;
    const bar = new THREE.Mesh(rbox(0.03, 0.03, WN.w - 0.01, 0.008), housing); bar.castShadow = true;
    gfx.scene.add(cloth, bar);
    return { cloth, bar, c, x, state: initial[i] ?? 0, target: initial[i] ?? 0 };
  });
  const apply = it => {
    const h = Math.max(0.001, (WN.y1 - WN.y0 + 0.1) * it.state);
    it.cloth.scale.y = h; it.cloth.position.set(it.x, WN.y1 + 0.06 - h / 2, it.c); it.cloth.visible = h > 0.01;
    it.bar.position.set(it.x, WN.y1 + 0.06 - h, it.c);
  };
  items.forEach(apply);
  return {
    items,
    set(i, v) { if (items[i]) items[i].target = v; },
    moving: false,
    update(dt) { let m = false; for (const it of items) { const d = it.target - it.state; if (Math.abs(d) > 0.002) { it.state += Math.sign(d) * Math.min(Math.abs(d), dt * 0.16); apply(it); m = true; } } this.moving = m; return m; }
  };
}
