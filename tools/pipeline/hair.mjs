// Haarkarten der Rocketbox-Figuren aufbereiten (gemeinsam für rocketbox.mjs und people.mjs).
//
// combHairNormals: Die Karten sind beidseitig sichtbar, ihre Normalen zeigen aber teils gegen die Flächenorientierung
// (bei Female_Adult_08 rund 12 %). three.js dreht die Normale auf Rückseiten um; zeigt sie dann vom Betrachter weg, wird
// N·V = 0, Fresnel = 1 und die Karte spiegelt die Umgebung wie Metall („metallener Schädel“). Übliche Lösung bei Haarkarten:
// Normalen nach außen kämmen – Richtung weg von einer Achse durch den Kopf, leicht mit der Originalnormale gemischt – und im
// Shader nicht mehr nach Vorder-/Rückseite umdrehen (humanMaterial, alpha). So wirkt das Haar wie ein Volumen.
//
// bleedRGBA: Farbe aus deckenden Haarpixeln in die durchsichtigen Bereiche ausbluten lassen. Sonst mischen Verkleinerung und
// Mipmaps schwarze Ränder in die Strähnen (dunkler Saum um jede Karte).

/**
 * pos/nor: Float32Array (xyz je Vertex), head: [x,y,z] Kopfknochen, up: Einheitsvektor nach oben, unit: Meter → Modelleinheit,
 * only: optionale Liste der Haar-Vertices (sonst alle)
 */
export function combHairNormals(pos, nor, head, up, unit = 1, only = null, keep = 0.3) {
  const top = 0.1 * unit, bottom = -0.4 * unit, list = only || Array.from({ length: pos.length / 3 }, (_, i) => i);
  let flipped = 0;
  for (const i of list) {
    const dx = pos[i * 3] - head[0], dy = pos[i * 3 + 1] - head[1], dz = pos[i * 3 + 2] - head[2];
    const t = Math.min(top, Math.max(bottom, dx * up[0] + dy * up[1] + dz * up[2]));
    let rx = dx - up[0] * t, ry = dy - up[1] * t, rz = dz - up[2] * t;
    const rl = Math.hypot(rx, ry, rz); if (rl < 1e-6) continue;
    rx /= rl; ry /= rl; rz /= rl;
    let nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
    if (nx * rx + ny * ry + nz * rz < 0) { nx = -nx; ny = -ny; nz = -nz; flipped++; }
    const ox = nx * keep + rx * (1 - keep), oy = ny * keep + ry * (1 - keep), oz = nz * keep + rz * (1 - keep), ol = Math.hypot(ox, oy, oz) || 1;
    nor[i * 3] = ox / ol; nor[i * 3 + 1] = oy / ol; nor[i * 3 + 2] = oz / ol;
  }
  return flipped;
}

/** rgba: Uint8Array/Buffer (w·h·4), wird verändert. Pixel mit Alpha < minA erhalten den Mittelwert deckender Nachbarn. */
export function bleedRGBA(rgba, w, h, minA = 16, passes = 24) {
  let valid = new Uint8Array(w * h);
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] >= minA) { valid[i] = 1; sr += rgba[i * 4]; sg += rgba[i * 4 + 1]; sb += rgba[i * 4 + 2]; sn++; }
  if (!sn) return rgba;
  for (let p = 0; p < passes; p++) {
    const next = valid.slice(); let changed = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (valid[i]) continue;
      let r = 0, g = 0, b = 0, c = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const xx = x + ox, yy = y + oy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx; if (!valid[j]) continue;
        r += rgba[j * 4]; g += rgba[j * 4 + 1]; b += rgba[j * 4 + 2]; c++;
      }
      if (c) { rgba[i * 4] = r / c; rgba[i * 4 + 1] = g / c; rgba[i * 4 + 2] = b / c; next[i] = 1; changed++; }
    }
    valid = next; if (!changed) break;
  }
  // Rest: mittlere Haarfarbe
  for (let i = 0; i < w * h; i++) if (!valid[i]) { rgba[i * 4] = sr / sn; rgba[i * 4 + 1] = sg / sn; rgba[i * 4 + 2] = sb / sn; }
  return rgba;
}
