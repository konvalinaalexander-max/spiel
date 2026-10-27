// Übersetzungstabelle DE/EN. Alle UI-Texte laufen über t('schlüssel', {platzhalter}).
import DE from '../content/strings.de.json';
import EN from '../content/strings.en.json';
import { bus, storage } from '../core/util.js';

const TABLES = { de: DE, en: EN };
let lang = storage.get('lang', (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en');
if (!TABLES[lang]) lang = 'de';
const missing = new Set();

export function getLang() { return lang; }
export function setLang(l) {
  if (!TABLES[l] || l === lang) return;
  lang = l; storage.set('lang', l);
  document.documentElement.lang = l;
  bus.emit('lang', l);
}
export function t(key, vars) {
  let s = TABLES[lang][key];
  if (s === undefined) { s = TABLES.de[key]; if (!missing.has(key)) { missing.add(key); if (typeof console !== 'undefined') console.warn('i18n: fehlender Schlüssel ' + key); } }
  if (s === undefined) return key;
  if (Array.isArray(s)) s = s[Math.floor(Math.random() * s.length)];
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}
export function hasKey(key) { return key in TABLES[lang]; }
/** Übersetzt alle Elemente mit data-i18n / data-i18n-attr="attr:key" */
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) { const [a, k] = pair.split(':'); if (a && k) el.setAttribute(a.trim(), t(k.trim())); }
  });
  document.documentElement.lang = lang;
}
export const TABLES_FOR_TEST = TABLES;
