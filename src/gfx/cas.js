// Contrast Adaptive Sharpening (Portierung des Prinzips von AMD FidelityFX CAS, MIT-lizenziert).
// Schärft Kanten abhängig vom lokalen Kontrast: flache Flächen bleiben ruhig, Schrift und Konturen werden klar,
// ohne die Überschwinger eines einfachen Unscharf-Maskierens. Läuft als letzter Pass im Anzeige-Farbraum (0–1).
import { Uniform } from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';

const fragment = /* glsl */ `
uniform float sharpness;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 t = texelSize;
  vec3 a = texture2D(inputBuffer, uv + vec2(-t.x, -t.y)).rgb;
  vec3 b = texture2D(inputBuffer, uv + vec2(0.0, -t.y)).rgb;
  vec3 c = texture2D(inputBuffer, uv + vec2(t.x, -t.y)).rgb;
  vec3 d = texture2D(inputBuffer, uv + vec2(-t.x, 0.0)).rgb;
  vec3 e = inputColor.rgb;
  vec3 f = texture2D(inputBuffer, uv + vec2(t.x, 0.0)).rgb;
  vec3 g = texture2D(inputBuffer, uv + vec2(-t.x, t.y)).rgb;
  vec3 h = texture2D(inputBuffer, uv + vec2(0.0, t.y)).rgb;
  vec3 i = texture2D(inputBuffer, uv + vec2(t.x, t.y)).rgb;
  // weiches Minimum/Maximum über Kreuz + Diagonalen
  vec3 mn = min(min(min(d, e), min(f, b)), h);
  vec3 mn2 = min(mn, min(min(a, c), min(g, i)));
  mn += mn2;
  vec3 mx = max(max(max(d, e), max(f, b)), h);
  vec3 mx2 = max(mx, max(max(a, c), max(g, i)));
  mx += mx2;
  // Verstärkung nach verbleibendem Spielraum bis 0 bzw. 1
  vec3 amp = clamp(min(mn, 2.0 - mx) / max(mx, vec3(1e-5)), 0.0, 1.0);
  amp = sqrt(amp);
  float peak = -1.0 / mix(8.0, 5.0, clamp(sharpness, 0.0, 1.0));
  vec3 w = amp * peak;
  vec3 col = (b * w + d * w + f * w + h * w + e) / (1.0 + 4.0 * w);
  outputColor = vec4(clamp(col, 0.0, 1.0), inputColor.a);
}`;

export class CASEffect extends Effect {
  constructor({ sharpness = 0.3 } = {}) {
    super('CASEffect', fragment, {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([['sharpness', new Uniform(sharpness)]])
    });
  }
  get sharpness() { return this.uniforms.get('sharpness').value; }
  set sharpness(v) { this.uniforms.get('sharpness').value = v; }
}
