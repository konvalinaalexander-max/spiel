// Prozedurale PBR-Texturen, auf der GPU erzeugt (Albedo, Normal, ORM = AO/Roughness/Metalness).
// Jede "Rezeptur" ist eine GLSL-Funktion surf(uv) -> albedo (linear), height, rough, metal, ao.
import * as THREE from 'three';
import NOISE from './noise.glsl';

const COMMON = /* glsl */`
float scratches(vec2 uv, float seed, float density, float width) {
  float s = 0.0;
  for (int k = 0; k < 4; k++) {
    float a = hash12(vec2(seed, float(k) * 1.7)) * 3.14159;
    vec2 d = vec2(cos(a), sin(a));
    float t = dot(uv, vec2(-d.y, d.x)) * density;
    float li = floor(t); float lf = fract(t);
    float on = step(0.93, hash12(vec2(li, float(k) + seed)));
    float along = dot(uv, d) * 7.0 + hash12(vec2(li, 3.0)) * 13.0;
    float seg = smoothstep(0.55, 0.7, vnoise(vec2(along, li * 0.37), vec2(1e5)));
    s += on * seg * smoothstep(width, 0.0, abs(lf - 0.5));
  }
  return clamp(s, 0.0, 1.0);
}
float grainStripes(vec2 uv, float freqAcross, float warpAmt, float seed) {
  float w = fbm(uv + seed, vec2(2.0, 6.0), 4);
  float g = fbm(vec2(uv.x, uv.y + w * warpAmt), vec2(1.0, freqAcross), 3);
  return g;
}
`;

// ---- Rezepturen -------------------------------------------------------------
// Parameter: uP (vec4) und uC1/uC2 (Farben, sRGB). Ergebnisse in Variablen albedo, height, rough, metal, ao.
const RECIPES = {
  // Furnierte Tischplatte (Buche/Esche), matt lackiert, mit Kratzern
  woodDesk: { normal: 2.2, body: `
    float g = grainStripes(uv, 56.0, 0.09, uSeed);
    float rings = sin((uv.y * 22.0 + fbm(uv, vec2(3.0, 9.0), 4) * 2.0) * 6.2831) * 0.5 + 0.5;
    float pores = vnoise(uv * vec2(512.0, 64.0), vec2(512.0, 64.0));
    float t = smoothstep(0.25, 0.85, g * 0.85 + rings * 0.15);
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), t) * (0.94 + 0.06 * pores);
    float wear = fbm(uv, vec2(4.0, 2.0), 5);
    float sc = scratches(uv, uSeed + 3.0, 260.0, 0.16);
    albedo *= mix(1.0, 0.88, smoothstep(0.6, 0.85, wear));
    albedo = mix(albedo, albedo * 1.25 + 0.02, sc * 0.6);
    height = g * 0.35 + pores * 0.12 - sc * 0.5;
    rough = 0.34 + 0.12 * smoothstep(0.4, 0.9, wear) + 0.06 * pores + sc * 0.25;
    metal = 0.0; ao = 1.0;` },
  // Gebeiztes Eichen-Massivholz (Pultbänke): gerade, feine Maserung mit Markstrahlen, matt lackiert, Gebrauchsspuren
  woodStained: { normal: 1.4, body: `
    float g = fbm(vec2(uv.x * 1.0, uv.y + fbm(uv + uSeed, vec2(1.0, 4.0), 3) * 0.015), vec2(2.0, 90.0), 3);
    float fine = vnoise(uv * vec2(700.0, 140.0), vec2(700.0, 140.0));
    float flecks = smoothstep(0.75, 0.95, vnoise(uv * vec2(40.0, 260.0), vec2(40.0, 260.0))) * 0.5;
    float t = smoothstep(0.3, 0.75, g);
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), t * 0.8) * (0.93 + 0.08 * fine) * (1.0 + flecks * 0.12);
    float wear = fbm(uv, vec2(3.0, 2.0), 5);
    float sc = scratches(uv, uSeed + 5.0, 300.0, 0.14);
    // abgegriffene, hellere Stellen + Kratzer
    albedo *= mix(1.0, 1.18, smoothstep(0.62, 0.85, wear));
    albedo = mix(albedo, albedo * 1.45 + 0.012, sc * 0.55);
    height = g * 0.25 + fine * 0.15 - sc * 0.6;
    rough = 0.42 + 0.14 * smoothstep(0.5, 0.9, wear) + 0.05 * fine + sc * 0.2;
    metal = 0.0; ao = 1.0;` },
  // Akustik-Holzlamellen (vertikal), dunkle Fugen
  woodSlats: { normal: 3.0, body: `
    float n = uP.x;               // Lamellen pro Kachel
    float sx = uv.x * n; float si = floor(sx); float sf = fract(sx);
    float slat = smoothstep(0.0, 0.035, sf) * smoothstep(1.0, 1.0 - uP.y, sf);
    float tone = hash12(vec2(si, uSeed + 7.0));
    float g = fbm(vec2(uv.x * n * 0.2 + si * 0.13, uv.y), vec2(1.0, 30.0), 3);
    float knot = smoothstep(0.08, 0.0, voronoi(uv + si * 0.05, vec2(n, 3.0)).x) * step(0.8, hash12(vec2(si, 2.0)));
    vec3 wood = mix(srgb2lin(uC1), srgb2lin(uC2), smoothstep(0.3, 0.8, g)) * (0.82 + 0.3 * tone);
    wood *= 1.0 - knot * 0.35;
    albedo = mix(srgb2lin(vec3(0.07, 0.055, 0.04)), wood, slat);
    height = slat * (0.7 + 0.08 * g);
    rough = mix(0.9, 0.58 + 0.1 * g, slat);
    metal = 0.0; ao = mix(0.25, 1.0, slat);` },
  // Nadelfilz/Teppich anthrazit
  carpet: { normal: 1.4, body: `
    float n1 = fbm(uv, vec2(48.0), 3);
    float n2 = vnoise(uv * 700.0, vec2(700.0));
    float n3 = vnoise(uv * 350.0 + 3.1, vec2(350.0));
    float speck = step(0.985, hash12(floor(uv * 700.0)));
    albedo = srgb2lin(uC1) * (0.78 + 0.32 * n2) * (0.9 + 0.2 * n1);
    albedo = mix(albedo, srgb2lin(uC2), speck * 0.7);
    height = n2 * 0.6 + n3 * 0.4;
    rough = 0.96; metal = 0.0; ao = 0.85 + 0.15 * n2;` },
  // Linoleum / Marmoleum (Bühne, Gänge)
  linoleum: { normal: 0.6, body: `
    vec2 w = vec2(fbm(uv, vec2(3.0), 5), fbm(uv + 5.2, vec2(3.0), 5));
    float m = fbm(uv + w * 0.35, vec2(6.0, 2.0), 5);
    float fine = vnoise(uv * 400.0, vec2(400.0));
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), smoothstep(0.35, 0.7, m)) * (0.96 + 0.06 * fine);
    float wear = fbm(uv + 1.7, vec2(2.0), 4);
    height = m * 0.2 + fine * 0.1;
    rough = 0.45 + 0.25 * smoothstep(0.4, 0.8, wear) + 0.05 * fine;
    metal = 0.0; ao = 1.0;` },
  // Parkett (Fischgrät vereinfacht als Stabparkett)
  parquet: { normal: 1.6, body: `
    vec2 p = uv * vec2(4.0, 16.0);
    float row = floor(p.y); vec2 q = vec2(p.x + hash12(vec2(row, 1.0)) * 3.0, p.y);
    float plank = floor(q.x); vec2 f = fract(q);
    float id = hash12(vec2(plank, row));
    float edge = smoothstep(0.0, 0.015, f.x) * smoothstep(1.0, 0.985, f.x) * smoothstep(0.0, 0.04, f.y) * smoothstep(1.0, 0.96, f.y);
    float g = fbm(vec2(uv.x * 4.0 + id, f.y * 0.25 + row * 0.25), vec2(1.0, 24.0), 3);
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), smoothstep(0.2, 0.9, g * 0.7 + id * 0.3));
    albedo *= mix(0.6, 1.0, edge);
    float sc = scratches(uv, uSeed, 180.0, 0.2);
    height = edge * 0.5 + g * 0.2 - sc * 0.3;
    rough = 0.42 + 0.12 * id + sc * 0.2;
    metal = 0.0; ao = mix(0.6, 1.0, edge);` },
  // Polsterstoff, gewebt (wird per Material eingefärbt)
  fabric: { normal: 1.8, body: `
    vec2 w = uv * uP.x;
    float cx = step(0.5, fract(floor(w.x) * 0.5 + floor(w.y) * 0.5));
    vec2 f = fract(w);
    float yarnU = sin(f.x * 3.14159); float yarnV = sin(f.y * 3.14159);
    float h = mix(yarnV, yarnU, cx);
    float n = vnoise(uv * uP.x * 0.5, vec2(uP.x * 0.5));
    float pill = step(0.97, hash12(floor(uv * uP.x * 2.0))) * 0.4;
    float wear = fbm(uv, vec2(3.0), 4);
    albedo = vec3(0.78) * (0.85 + 0.15 * h) * (0.92 + 0.12 * n) * mix(1.0, 1.12, smoothstep(0.6, 0.9, wear));
    height = h * 0.8 + n * 0.2 + pill;
    rough = 0.97; metal = 0.0; ao = 0.8 + 0.2 * h;` },
  // Gestrichener Putz
  plaster: { normal: 0.9, body: `
    float n = fbm(uv, vec2(24.0), 5);
    float big = fbm(uv, vec2(3.0), 4);
    float roller = vnoise(vec2(uv.x * 6.0, uv.y * 90.0), vec2(6.0, 90.0));
    albedo = srgb2lin(uC1) * (0.97 + 0.04 * n) * mix(1.0, 0.94, smoothstep(0.55, 0.85, big));
    height = n * 0.6 + roller * 0.15;
    rough = 0.88 + 0.06 * n; metal = 0.0; ao = 1.0;` },
  // Sichtbeton mit Schalungsstößen und Ankerlöchern
  concrete: { normal: 2.0, body: `
    float n = fbm(uv, vec2(8.0), 6);
    float stain = fbm(uv + 2.3, vec2(2.0, 3.0), 5);
    vec2 board = uv * vec2(2.0, 4.0); vec2 bf = fract(board);
    float joint = smoothstep(0.0, 0.006, bf.y) * smoothstep(1.0, 0.994, bf.y) * smoothstep(0.0, 0.004, bf.x) * smoothstep(1.0, 0.996, bf.x);
    vec2 tie = fract(board * vec2(2.0, 1.0)) - vec2(0.5, 0.5);
    float hole = smoothstep(0.03, 0.022, length(tie * vec2(1.0, 0.5)));
    float pores = smoothstep(0.06, 0.0, voronoi(uv, vec2(90.0)).x) * step(0.6, hash12(floor(uv * 90.0)));
    float tone = hash12(floor(board));
    albedo = srgb2lin(uC1) * (0.88 + 0.16 * n + 0.05 * tone) * mix(1.0, 0.82, smoothstep(0.55, 0.9, stain));
    albedo *= mix(0.7, 1.0, joint) * (1.0 - hole * 0.6) * (1.0 - pores * 0.3);
    height = n * 0.4 + joint * 0.3 - hole * 0.8 - pores * 0.4;
    rough = 0.82 + 0.1 * n; metal = 0.0; ao = mix(0.5, 1.0, joint) * (1.0 - hole * 0.5);` },
  // Mineralfaser-Deckenplatten 62,5 cm mit Fissuren
  ceilingTile: { normal: 1.6, body: `
    vec2 t = fract(uv * uP.x);
    float border = smoothstep(0.0, 0.012, t.x) * smoothstep(1.0, 0.988, t.x) * smoothstep(0.0, 0.012, t.y) * smoothstep(1.0, 0.988, t.y);
    float fiss = smoothstep(0.0, 0.08, voronoi(uv, vec2(uP.x * 9.0)).x);
    float pin = step(0.82, hash12(floor(uv * uP.x * 60.0)));
    float n = vnoise(uv * 300.0, vec2(300.0));
    albedo = srgb2lin(uC1) * (0.96 + 0.04 * n) * mix(0.55, 1.0, border) * (1.0 - pin * 0.25) * mix(0.92, 1.0, fiss);
    height = border * 0.6 + fiss * 0.3 - pin * 0.3;
    rough = 0.95; metal = 0.0; ao = mix(0.4, 1.0, border);` },
  // Gebürstetes Metall
  metalBrushed: { normal: 0.5, body: `
    float s = vnoise(uv * vec2(6.0, 900.0), vec2(6.0, 900.0)) * 0.6 + vnoise(uv * vec2(20.0, 2200.0), vec2(20.0, 2200.0)) * 0.4;
    float sm = fbm(uv, vec2(4.0), 4);
    albedo = srgb2lin(uC1) * (0.9 + 0.12 * s);
    height = s * 0.3;
    rough = 0.28 + 0.12 * s + 0.15 * smoothstep(0.55, 0.85, sm);
    metal = 1.0; ao = 1.0;` },
  // Pulverbeschichtetes Metall (Stuhlgestelle) – leichte Orangenhaut
  powderCoat: { normal: 0.8, body: `
    float n = vnoise(uv * 180.0, vec2(180.0)) * 0.6 + vnoise(uv * 420.0, vec2(420.0)) * 0.4;
    float sc = scratches(uv, uSeed, 120.0, 0.12);
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), sc);
    height = n * 0.5 - sc * 0.4;
    rough = 0.45 + 0.08 * n + sc * 0.3; metal = sc * 0.8; ao = 1.0;` },
  // Kunststoff genarbt
  plastic: { normal: 1.0, body: `
    float n = vnoise(uv * 260.0, vec2(260.0)) * 0.5 + vnoise(uv * 600.0, vec2(600.0)) * 0.5;
    albedo = srgb2lin(uC1) * (0.97 + 0.05 * n);
    height = n; rough = 0.55 + 0.1 * n; metal = 0.0; ao = 1.0;` },
  // Papier
  paper: { normal: 0.5, body: `
    float f = vnoise(uv * vec2(900.0, 300.0), vec2(900.0, 300.0));
    float n = fbm(uv, vec2(16.0), 4);
    albedo = srgb2lin(uC1) * (0.97 + 0.03 * f) * (0.98 + 0.03 * n);
    height = f * 0.5 + n * 0.5; rough = 0.9; metal = 0.0; ao = 1.0;` },
  // Kork (Pinnwand)
  cork: { normal: 1.8, body: `
    vec2 v = voronoi(uv, vec2(120.0));
    float n = vnoise(uv * 500.0, vec2(500.0));
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), v.y) * (0.85 + 0.2 * n) * (0.8 + 0.2 * smoothstep(0.0, 0.3, v.x));
    height = smoothstep(0.0, 0.35, v.x) * 0.6 + n * 0.4; rough = 0.92; metal = 0.0; ao = 0.8 + 0.2 * v.x;` },
  // Glas-Schlieren (nur Roughness/AO relevant)
  glassDirt: { normal: 0.15, body: `
    float n = fbm(uv, vec2(3.0, 2.0), 6);
    float streak = vnoise(vec2(uv.x * 40.0, uv.y * 2.0), vec2(40.0, 2.0));
    float drop = smoothstep(0.08, 0.0, voronoi(uv, vec2(30.0)).x) * step(0.7, hash12(floor(uv * 30.0)));
    albedo = vec3(1.0);
    height = n * 0.2;
    rough = 0.04 + 0.22 * smoothstep(0.55, 0.9, n) + 0.08 * streak + drop * 0.2; metal = 0.0; ao = 1.0;` },
  // Feine Stoffstruktur für Kleidung (Vertexfarben färben ein)
  clothDetail: { normal: 1.2, body: `
    vec2 w = uv * 180.0;
    float h = sin(w.x * 3.14159) * 0.5 + 0.5; float v = sin(w.y * 3.14159) * 0.5 + 0.5;
    float twill = sin((w.x + w.y) * 3.14159) * 0.5 + 0.5;
    float n = vnoise(uv * 90.0, vec2(90.0));
    albedo = vec3(1.0) * (0.92 + 0.08 * twill);
    height = twill * 0.6 + h * v * 0.2 + n * 0.2; rough = 0.93; metal = 0.0; ao = 0.9 + 0.1 * twill;` },
  // Tafeloberfläche (matte, grün-schwarz, Wischspuren) – Inhalt kommt per Canvas
  chalkboardBase: { normal: 0.6, body: `
    float n = fbm(uv, vec2(6.0, 3.0), 6);
    float wipe = vnoise(vec2(uv.x * 3.0 + fbm(uv, vec2(2.0), 3), uv.y * 18.0), vec2(3.0, 18.0));
    albedo = srgb2lin(uC1) * (0.92 + 0.12 * n);
    height = n * 0.3 + wipe * 0.1; rough = 0.82 + 0.1 * wipe; metal = 0.0; ao = 1.0;` },
  // Leinwand-Gewebe
  screenWeave: { normal: 0.4, body: `
    vec2 w = uv * 600.0;
    float h = (sin(w.x * 3.14159) * sin(w.y * 3.14159)) * 0.5 + 0.5;
    albedo = vec3(0.92);
    height = h; rough = 0.95; metal = 0.0; ao = 1.0;` },
  // Nylon / Rucksackstoff
  nylon: { normal: 1.0, body: `
    vec2 w = uv * 260.0;
    float rip = max(smoothstep(0.92, 1.0, fract(uv.x * 26.0)), smoothstep(0.92, 1.0, fract(uv.y * 26.0)));
    float h = sin(w.x * 3.14159) * sin(w.y * 3.14159) * 0.5 + 0.5;
    albedo = vec3(0.85) * (0.95 + 0.05 * h);
    height = h * 0.5 + rip * 0.5; rough = 0.7; metal = 0.0; ao = 1.0;` },
  // Ziegelmauerwerk (Läuferverband) mit Fugen
  brick: { normal: 2.2, body: `
    vec2 b = uv * vec2(uP.x, uP.y);
    float row = floor(b.y); b.x += mod(row, 2.0) * 0.5;
    vec2 f = fract(b); vec2 id = floor(b);
    float mortar = smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x) * smoothstep(0.0, 0.12, f.y) * smoothstep(1.0, 0.88, f.y);
    float tone = hash12(id + uSeed);
    float n = fbm(uv, vec2(16.0), 4);
    vec3 brickCol = mix(srgb2lin(uC1), srgb2lin(uC2), tone) * (0.85 + 0.25 * n);
    albedo = mix(srgb2lin(vec3(0.72, 0.69, 0.64)), brickCol, mortar);
    height = mortar * (0.8 + 0.2 * n);
    rough = mix(0.95, 0.82, mortar); metal = 0.0; ao = mix(0.55, 1.0, mortar);` },
  // Wiese/Boden außen
  grass: { normal: 1.0, body: `
    float n = fbm(uv, vec2(16.0), 6);
    float b = vnoise(uv * 400.0, vec2(400.0));
    albedo = mix(srgb2lin(uC1), srgb2lin(uC2), smoothstep(0.3, 0.75, n)) * (0.8 + 0.3 * b);
    height = b; rough = 0.95; metal = 0.0; ao = 0.85 + 0.15 * b;` }
};

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
function frag(body) {
  return `precision highp float;
varying vec2 vUv;
uniform float uMode; uniform float uSeed; uniform vec4 uP; uniform vec3 uC1; uniform vec3 uC2;
${NOISE}
${COMMON}
void main() {
  vec2 uv = vUv;
  vec3 albedo = vec3(0.5); float height = 0.0; float rough = 0.8; float metal = 0.0; float ao = 1.0;
  { ${body} }
  if (uMode < 0.5) gl_FragColor = vec4(clamp(albedo, 0.0, 1.0), 1.0);
  else if (uMode < 1.5) gl_FragColor = vec4(vec3(clamp(height * 0.5 + 0.5, 0.0, 1.0)), 1.0);
  else gl_FragColor = vec4(clamp(ao, 0.0, 1.0), clamp(rough, 0.02, 1.0), clamp(metal, 0.0, 1.0), 1.0);
}`;
}
const NORMAL_FRAG = `precision highp float;
varying vec2 vUv; uniform sampler2D tH; uniform vec2 uTexel; uniform float uStrength;
float h(vec2 o) { return texture2D(tH, vUv + o * uTexel).r; }
void main() {
  float tl = h(vec2(-1.0, 1.0)), t = h(vec2(0.0, 1.0)), tr = h(vec2(1.0, 1.0));
  float l = h(vec2(-1.0, 0.0)), r = h(vec2(1.0, 0.0));
  float bl = h(vec2(-1.0, -1.0)), b = h(vec2(0.0, -1.0)), br = h(vec2(1.0, -1.0));
  float dx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
  float dy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
  vec3 n = normalize(vec3(-dx * uStrength, -dy * uStrength, 1.0));
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
}`;

const col = hex => new THREE.Color(hex);

export class TextureFactory {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.cache = new Map();
    this.programs = new Map();
    this.normalMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: NORMAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tH: { value: null }, uTexel: { value: new THREE.Vector2() }, uStrength: { value: 1 } }
    });
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
    this.count = 0;
  }
  _mat(name) {
    if (!this.programs.has(name)) {
      const r = RECIPES[name];
      if (!r) throw new Error('Unbekannte Textur-Rezeptur: ' + name);
      this.programs.set(name, new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: frag(r.body), depthTest: false, depthWrite: false,
        uniforms: { uMode: { value: 0 }, uSeed: { value: 0 }, uP: { value: new THREE.Vector4() }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() } }
      }));
    }
    return this.programs.get(name);
  }
  _rt(size, srgb, mips = true) {
    const rt = new THREE.WebGLRenderTarget(size, size, {
      depthBuffer: false, generateMipmaps: mips, minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, type: THREE.UnsignedByteType
    });
    rt.texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    rt.texture.anisotropy = this.maxAniso;
    return rt;
  }
  /**
   * Erzeugt {map, normalMap, ormMap} für eine Rezeptur.
   * opts: size, seed, p:[x,y,z,w], c1:'#rrggbb', c2, normal (Stärke), repeat:[x,y]
   */
  make(name, opts = {}) {
    const key = name + JSON.stringify(opts);
    if (this.cache.has(key)) return this.cache.get(key);
    const size = opts.size || 1024;
    const m = this._mat(name);
    m.uniforms.uSeed.value = opts.seed || 0;
    m.uniforms.uP.value.fromArray(opts.p || [16, 0.12, 0, 0]);
    // Farben sind als sRGB gedacht: der Shader wendet srgb2lin an → hier sRGB-Rohwerte übergeben
    m.uniforms.uC1.value.setRGB(...col(opts.c1 || '#c49a6c').convertLinearToSRGB().toArray());
    m.uniforms.uC2.value.setRGB(...col(opts.c2 || '#9a744c').convertLinearToSRGB().toArray());
    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevAuto = r.autoClear;
    r.autoClear = true;
    this.quad.material = m;
    const out = {};
    const albedo = this._rt(size, true);
    m.uniforms.uMode.value = 0; r.setRenderTarget(albedo); r.render(this.scene, this.cam);
    const height = this._rt(size, false, false);
    m.uniforms.uMode.value = 1; r.setRenderTarget(height); r.render(this.scene, this.cam);
    const orm = this._rt(size, false);
    m.uniforms.uMode.value = 2; r.setRenderTarget(orm); r.render(this.scene, this.cam);
    const normal = this._rt(size, false);
    this.normalMat.uniforms.tH.value = height.texture;
    this.normalMat.uniforms.uTexel.value.set(1 / size, 1 / size);
    this.normalMat.uniforms.uStrength.value = (opts.normal ?? RECIPES[name].normal) * size / 512;
    this.quad.material = this.normalMat;
    r.setRenderTarget(normal); r.render(this.scene, this.cam);
    r.setRenderTarget(prevRT);
    r.autoClear = prevAuto;
    height.dispose();
    out.map = albedo.texture; out.normalMap = normal.texture; out.ormMap = orm.texture;
    out._targets = [albedo, normal, orm];
    this.cache.set(key, out);
    this.count++;
    return out;
  }
  dispose() { for (const v of this.cache.values()) v._targets.forEach(t => t.dispose()); this.cache.clear(); }
}
export const RECIPE_NAMES = Object.keys(RECIPES);
