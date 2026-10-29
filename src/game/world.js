// Die 3D-Welt einer Sitzung: Hörsaal, Technik, Licht, Außenwelt, Requisiten, Studierende, Prof, eigener Körper.
// Wird pro Kombination aus Wetter + Sitzplatz + Qualität einmal aufgebaut (Neustart = Seite neu laden).
import * as THREE from 'three';
import { buildHall } from '../scene/hall.js';
import { buildFixtures, makePosters, buildHybridMonitor } from '../scene/fixtures.js';
import { buildLighting, bakeEnvironment } from '../scene/lighting.js';
import { buildOutside, buildBlinds } from '../scene/outside.js';
import { buildProps, buildDetails } from '../scene/props.js';
import { characterMaterial } from '../chars/rig.js';
import { Crowd } from '../chars/crowd.js';
import { loadHumans } from '../chars/humans.js';
import { loadPBR } from '../gfx/pbrTextures.js';
import { loadPropModels } from '../scene/realProps.js';
import { planPopulation } from './population.js';
import { damp } from '../core/util.js';
import * as LY from '../scene/layout.js';

export const POP_SEED = 4711;
export const SLIDE_META = {
  de: { university: 'Universität für Bodenkultur Wien', institute: 'Institut für Tierernährung, Tierische Lebensmittel und Ernährungsphysiologie', courseShort: 'Tierernährung VO', footer: 'Tierernährung VO · WS 2026/27 · HS 31' },
  en: { university: 'University of Natural Resources and Life Sciences, Vienna', institute: 'Institute of Animal Nutrition, Animal Products and Nutrition Physiology', courseShort: 'Animal Nutrition (lecture)', footer: 'Animal Nutrition · Winter term 2026/27 · HS 31' }
};

/** progress(fraction, labelKey) */
export async function buildWorld(gfx, params, progress = () => {}) {
  const step = async (f, key) => { progress(f, key); await new Promise(r => setTimeout(r, 0)); };
  const W = { params, gfx };
  await step(0.05, 'load.hall');
  // echte Materialien (ambientCG) vor dem Saal laden; ohne Daten bleibt es bei den prozeduralen Texturen
  if (gfx.pbrSets === undefined) { try { gfx.pbrSets = await loadPBR(gfx, f => progress(0.05 + f * 0.05, 'load.hall')); } catch (e) { console.warn('Materialien: Rückfall auf prozedurale Texturen', e); gfx.pbrSets = null; } }
  W.hall = buildHall(gfx);
  await step(0.25, 'load.fixtures');
  W.fx = buildFixtures(gfx, W.hall, { posters: makePosters() });
  W.monitor = buildHybridMonitor(gfx, params.lang || 'de', { canvas: W.fx.slides.canvas, active: () => W.fx.beamer.level > 0.5 });
  await step(0.35, 'load.light');
  W.light = buildLighting(gfx, W.hall, params.weather);
  await step(0.42, 'load.outside');
  W.outside = buildOutside(gfx, params.weather, gfx.preset);
  W.blinds = buildBlinds(gfx, params.weather === 'sunny' ? [0.45, 0, 0] : [0, 0, 0]);
  await step(0.52, 'load.props');
  W.plan = planPopulation(POP_SEED, params.seat);
  if (W.models === undefined) { try { W.models = await loadPropModels(gfx); } catch (e) { console.warn('Requisiten: Rückfall auf einfache Formen', e); W.models = null; } }
  W.props = buildProps(gfx, W.hall, W.plan, { models: W.models, weather: params.weather, notesHeader: params.lang === 'en' ? 'Animal Nutrition – 27 Oct' : 'Tierernährung VO – 27.10.' });
  W.details = buildDetails(gfx, W.hall, W.plan);
  await step(0.62, 'load.people');
  W.charMat = characterMaterial(gfx);
  // Echte Figuren (MakeHuman/MPFB, CC0); ohne eingebettete Daten bleibt es bei den prozeduralen Figuren
  try { W.humans = await loadHumans(gfx, f => progress(0.6 + f * 0.02, 'load.people')); } catch (e) { console.warn('Figuren: Rückfall auf prozedurale Figuren', e); W.humans = null; }
  W.crowd = new Crowd(gfx, W.charMat, { ...W.plan, students: [] }, { shadows: gfx.preset.id === 'ultra' ? 'all' : gfx.preset.studentShadows, humans: W.humans });
  // Figuren einzeln anlegen und zwischendurch dem Browser Luft lassen (Menü bleibt bedienbar)
  for (let i = 0; i < W.plan.students.length; i++) {
    W.crowd.addStudent(W.plan.students[i]);
    if (i % 4 === 3) await step(0.62 + 0.14 * i / W.plan.students.length, 'load.people');
  }
  W.crowd.plan = W.plan;
  W.crowd.mergeMeshes(W.charMat);
  // Handys in der Hand
  for (const st of W.crowd.list) if (st.s.profile === 'phone') W.props.table.handPhone(st.rig.bones.handR, st.s.id);
  await step(0.78, 'load.env');
  bakeEnvironment(gfx);
  await step(0.86, 'load.post');
  gfx.buildPost();
  // Schiebetafeln bewegen sich weich
  W.updateBoards = dt => {
    for (const p of W.fx.panels) { const y = p.group.position.y; if (Math.abs(y - p.targetY) > 1e-4) { p.group.position.y = damp(y, p.targetY, 2.2, dt); W.boardMoving = true; } }
  };
  W.textureCount = gfx.finalizeTextures();
  // Shader vorkompilieren (vermeidet Ruckler beim ersten Blick in eine Richtung); parallel, wo der Treiber es kann
  try { if (gfx.renderer.compileAsync && gfx.renderer.extensions.has('KHR_parallel_shader_compile')) await gfx.renderer.compileAsync(gfx.scene, gfx.camera); else gfx.renderer.compile(gfx.scene, gfx.camera); } catch (e) { /* optional */ }
  await step(0.95, 'load.compile');
  return W;
}

/** Kamerafahrt für die Startseite (Live-Hero): ruhiger Schwenk durch den leeren Saal */
export function heroCamera(cam, t) {
  const k = (Math.sin(t * 0.05) + 1) / 2;
  const x = -3.6 + k * 2.2, y = 2.75 + Math.sin(t * 0.07) * 0.15, z = 5.3 - k * 0.6;
  cam.position.set(x, y, z);
  cam.lookAt(-0.2 + k * 1.2, 1.55, -5.2);
  if (cam.fov !== 52) { cam.fov = 52; cam.updateProjectionMatrix(); }
}
export { LY };
