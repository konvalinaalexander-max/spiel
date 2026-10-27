import * as THREE from 'three';
import { Graphics } from './gfx/graphics.js';
import { buildHall } from './scene/hall.js';
import { buildFixtures, makePosters } from './scene/fixtures.js';
import { buildLighting, bakeEnvironment } from './scene/lighting.js';
import { buildOutside, buildBlinds } from './scene/outside.js';
import * as LY from './scene/layout.js';
const qs = new URLSearchParams(location.search);
const g = new Graphics(document.getElementById('c'), qs.get('q') || 'medium');
const weather = qs.get('w') || 'sunny';
const hall = buildHall(g);
const fx = buildFixtures(g, hall, { posters: makePosters() });
const light = buildLighting(g, hall, weather);
const outside = buildOutside(g, weather, g.preset);
const blinds = buildBlinds(g);
fx.slides.title({ university: 'Universität für Bodenkultur Wien', institute: 'Institut für Tierernährung', courseShort: 'Tierernährung VO', footer: 'Tierernährung VO · WS 2026/27' }, { title: 'Tierernährung', sub: 'Vorlesung · Bachelor Agrarwissenschaften', who: 'Prof. H. Haferkorn', when: 'Dienstag, 10:15 Uhr · HS 13' });
fx.updateSlideTextures(); fx.setBeamer(true); fx.beamer.level = 1; fx.updateBeamer(0);
fx.setClock(10 * 60 + 17);
const low = fx.lowPanel(); low.chalk.write(['Weender Analyse', 'XP = N × 6,25', 'NfE = TM − (XA+XP+XL+XF)']);
for (let i = 0; i < 400; i++) low.chalk.update(0.05, 900);
bakeEnvironment(g);
g.buildPost();
const cam = g.camera;
const seat = LY.allSeats().find(s => s.row === 4 && s.k === 7);
const views = {
  seat: () => { cam.position.set(seat.x, seat.floor + 1.2, seat.z + 0.05); cam.lookAt(-0.6, 1.7, -6); },
  back: () => { cam.position.set(3.9, 3.2, 5.5); cam.lookAt(-1, 1.2, -5); },
  front: () => { cam.position.set(3.0, 1.75, -5.6); cam.lookAt(-1, 1.6, 3); },
  side: () => { cam.position.set(4.2, 2.2, -2.0); cam.lookAt(-5, 2.2, -1); },
  window: () => { cam.position.set(seat.x, seat.floor + 1.2, seat.z + 0.05); cam.lookAt(-6, 2.3, -2.5); },
  desk: () => { cam.position.set(seat.x, seat.floor + 1.15, seat.z + 0.1); cam.lookAt(seat.x, seat.floor + 0.6, seat.z - 0.9); },
  outside: () => { cam.position.set(-4.0, 2.0, -1.2); cam.lookAt(-30, -6, 2); }
};
(views[qs.get('v') || 'seat'])();
cam.fov = 60; cam.updateProjectionMatrix();
addEventListener('resize', () => g.resize());
let last = performance.now(), t = 0;
const still = qs.has('still');
window.__capture = (n = 2) => { for (let i = 0; i < n; i++) { light.update(0.016, t); g.render(0.016); } return g.canvas.toDataURL('image/png'); };
function frame(now) { if (still) return; requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; light.update(dt, t); outside.update(dt, t); blinds.update(dt); fx.updateBeamer(dt); g.render(dt); }
requestAnimationFrame(frame);
window.__g = g; window.__views = views;
