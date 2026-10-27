// Kachelbares Rauschen für prozedurale Texturen (alle Funktionen periodisch in uv ∈ [0,1)).
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p, vec2 period) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(mod(i, period));
  float b = hash12(mod(i + vec2(1.0, 0.0), period));
  float c = hash12(mod(i + vec2(0.0, 1.0), period));
  float d = hash12(mod(i + vec2(1.0, 1.0), period));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// fbm mit Grundfrequenz freq (vec2, ganzzahlig) → kachelbar
float fbm(vec2 uv, vec2 freq, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  vec2 f = freq;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += vnoise(uv * f, f) * a; n += a; a *= 0.5; f *= 2.0; }
  return s / n;
}
float ridged(vec2 uv, vec2 freq, int oct) {
  float s = 0.0, a = 0.5, n = 0.0; vec2 f = freq;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += (1.0 - abs(vnoise(uv * f, f) * 2.0 - 1.0)) * a; n += a; a *= 0.5; f *= 2.0; }
  return s / n;
}
// Voronoi: x = Distanz zum nächsten Punkt, y = Zell-ID
vec2 voronoi(vec2 uv, vec2 cells) {
  vec2 p = uv * cells; vec2 i = floor(p), f = fract(p);
  float md = 8.0; float id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 c = mod(i + g, cells);
    vec2 o = hash22(c);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < md) { md = d; id = hash12(c * 1.37); }
  }
  return vec2(sqrt(md), id);
}
vec3 srgb2lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 hex(float h) { return vec3(floor(h / 65536.0), mod(floor(h / 256.0), 256.0), mod(h, 256.0)) / 255.0; }
