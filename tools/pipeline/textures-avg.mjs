// Ergänzt in assets/build/<profil>/textures.json die mittlere Farbe je Material (falls ein älterer Lauf sie nicht geschrieben hat).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
for (const profile of ['desktop', 'mobile']) {
  const mf = path.join(root, 'assets/build', profile, 'textures.json'); if (!fs.existsSync(mf)) continue;
  const man = JSON.parse(fs.readFileSync(mf, 'utf8'));
  for (const id of Object.keys(man)) {
    if (man[id].avg) continue;
    const jpg = path.join(root, 'tools/.cache/ambientcg', id, `${id}_2K-JPG_Color.jpg`); if (!fs.existsSync(jpg)) continue;
    const st = await sharp(jpg).resize(256, 256).stats(); man[id].avg = st.channels.slice(0, 3).map(c => +(c.mean / 255).toFixed(4));
  }
  fs.writeFileSync(mf, JSON.stringify(man, null, 1)); console.log(profile, 'ok');
}
