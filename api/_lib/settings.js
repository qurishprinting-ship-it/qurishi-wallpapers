'use strict';
// Site settings (theme + categories). Stored in settings.json at the repo root so the static public site
// (GitHub Pages or Vercel) can read it with a plain fetch. It contains NO secrets.
const { BUILTIN_CATEGORIES, DEFAULT_PRIMARY, SLUG_RE, RESERVED_SLUGS, MAX_CATEGORIES } = require('./config');
const { HttpError } = require('./http');
const Theme = require('../../shared/theme');

const LANGS = ['ps', 'fa', 'en'];
const NAME_MAX = 60;

// eslint-disable-next-line no-control-regex
const cleanText = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

function cleanName(s) {
  const v = cleanText(s);
  if (!v) throw new HttpError(400, 'Category name cannot be empty');
  return v;
}
function cleanNames(obj) {
  const out = {};
  if (obj && typeof obj === 'object') for (const l of LANGS) { const v = cleanText(obj[l]); if (v) out[l] = v; }
  return out;
}

function defaultSettings() {
  return {
    version: 1,
    theme: { primary: DEFAULT_PRIMARY },
    categories: BUILTIN_CATEGORIES.map((c, i) => ({ slug: c.slug, name: c.name, names: { ...c.names }, order: i, enabled: true, builtin: true })),
  };
}

// Tolerant: always returns a usable settings object (bad/missing parts fall back to safe defaults).
function sanitize(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const primary = Theme.normalizeHex(raw.theme && raw.theme.primary) || DEFAULT_PRIMARY;
  const builtinSlugs = new Set(BUILTIN_CATEGORIES.map((c) => c.slug));
  const seen = new Set();
  const cats = [];
  if (Array.isArray(raw.categories)) {
    raw.categories.forEach((c, i) => {
      if (!c || typeof c.slug !== 'string' || !SLUG_RE.test(c.slug) || seen.has(c.slug)) return;
      seen.add(c.slug);
      const name = cleanText(c.name) || cleanText(c.names && c.names.en) || c.slug;
      cats.push({
        slug: c.slug, name, names: cleanNames(c.names),
        order: Number.isFinite(c.order) ? c.order : i, enabled: c.enabled !== false, builtin: builtinSlugs.has(c.slug),
      });
    });
  }
  if (!cats.length) return { ...base, theme: { primary } };
  cats.sort((a, b) => a.order - b.order);
  cats.forEach((c, i) => { c.order = i; });
  const out = { version: 1, theme: { primary }, categories: cats };
  if (typeof raw.updatedAt === 'string') out.updatedAt = raw.updatedAt;
  return out;
}

// Parse the text of settings.json. null/empty => defaults. For WRITES use strict=true so a hand-damaged
// file is never silently overwritten with defaults.
function parse(text, { strict = false } = {}) {
  if (text === null || text === undefined || String(text).trim() === '') return defaultSettings();
  try { return sanitize(JSON.parse(text)); } catch {
    if (strict) throw new HttpError(500, 'settings.json is damaged. Fix or delete it in GitHub, then retry.');
    return defaultSettings();
  }
}

const serialize = (settings) => JSON.stringify({ ...settings, updatedAt: new Date().toISOString() }, null, 2) + '\n';

const slugs = (settings) => settings.categories.map((c) => c.slug);
const categoryMap = (settings) => new Map(settings.categories.map((c) => [c.slug, c]));
const rankMap = (settings) => Object.fromEntries(settings.categories.map((c) => [c.slug, c.order]));
// Name used to build default titles such as "Wall 12" (English/base name, never a translation).
const baseName = (settings, slug) => { const c = categoryMap(settings).get(slug); return c ? c.name : slug; };

function slugify(s) {
  return String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/g, '');
}
// Non-Latin names (Pashto/Dari) cannot form a folder name, so they get a short generated one.
function makeSlug(settings, name, names = {}) {
  const taken = new Set(slugs(settings));
  const candidates = [slugify(names.en), slugify(name)].filter(Boolean);
  for (const c of candidates) {
    let slug = c, n = 2;
    while (taken.has(slug) || RESERVED_SLUGS.has(slug) || !SLUG_RE.test(slug)) { slug = `${c.slice(0, 26)}-${n++}`; if (n > 99) break; }
    if (SLUG_RE.test(slug) && !taken.has(slug) && !RESERVED_SLUGS.has(slug)) return slug;
  }
  for (let i = 0; i < 50; i++) {
    const slug = `cat-${Math.random().toString(36).slice(2, 7)}`;
    if (!taken.has(slug)) return slug;
  }
  throw new HttpError(500, 'Could not generate a category id');
}

function assertSlug(settings, slug) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug) || !slugs(settings).includes(slug)) throw new HttpError(400, 'Invalid category');
  return slug;
}

function assertCanAdd(settings) {
  if (settings.categories.length >= MAX_CATEGORIES) throw new HttpError(400, `At most ${MAX_CATEGORIES} categories are supported`);
}

module.exports = { LANGS, defaultSettings, sanitize, parse, serialize, slugs, categoryMap, rankMap, baseName, slugify, makeSlug, assertSlug, assertCanAdd, cleanName, cleanNames, cleanText };
