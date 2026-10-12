'use strict';
// Central place for configuration. Secrets only ever come from environment variables.

// The three original categories. They are seeded into settings.json and can be renamed, re-ordered
// or hidden — but never deleted, so the existing site structure can't be lost by accident.
const BUILTIN_CATEGORIES = [
  { slug: 'wall', name: 'Wall', names: { ps: 'وال', fa: 'دیوار', en: 'Wall' } },
  { slug: 'ceiling', name: 'Ceiling', names: { ps: 'چت', fa: 'سقف', en: 'Ceiling' } },
  { slug: 'flat', name: 'Flat', names: { ps: 'فلیټ', fa: 'فلت', en: 'Flat' } },
];
const CATEGORIES = BUILTIN_CATEGORIES.map((c) => c.slug); // legacy export: the built-in slugs only
const DEFAULT_PRIMARY = '#121efb';
// A category slug is also its image folder name (images/<slug>/…), so it must be path-safe.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
const RESERVED_SLUGS = new Set(['all', 'api', 'admin', 'assets', 'images', 'thumbs', 'shared', 'scripts']);
const MAX_CATEGORIES = 30;

function env(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const limits = {
  // Vercel serverless functions reject request bodies above ~4.5 MB.
  maxUploadBytes: 4.4 * 1024 * 1024,
  maxPixels: 100e6,
  maxDimension: Number(env('IMAGE_MAX_DIMENSION', '1600')),
  targetBytes: Number(env('IMAGE_TARGET_KB', '50')) * 1024,
  hardMaxBytes: Number(env('IMAGE_HARD_MAX_KB', '150')) * 1024,
  thumbWidth: 480,
  sessionHours: Number(env('SESSION_HOURS', '8')),
  bulkMax: 25,
  orderMax: 2000,
  minPasswordLength: 10,
};

module.exports = { CATEGORIES, BUILTIN_CATEGORIES, DEFAULT_PRIMARY, SLUG_RE, RESERVED_SLUGS, MAX_CATEGORIES, env, limits };
