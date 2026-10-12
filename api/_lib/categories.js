'use strict';
// Which category slugs exist right now? Used by the PUBLIC beacon endpoint, which must not accept arbitrary
// category names but also must not hit GitHub on every request: the answer is cached for a few minutes.
const { BUILTIN_CATEGORIES } = require('./config');
const github = require('./github');
const S = require('./settings');

const TTL_MS = 5 * 60 * 1000;
let cache = { at: 0, slugs: null };
const builtin = () => new Set(BUILTIN_CATEGORIES.map((c) => c.slug));

async function knownSlugs() {
  if (cache.slugs && Date.now() - cache.at < TTL_MS) return cache.slugs;
  try {
    if (!github.configured()) { cache = { at: Date.now(), slugs: builtin() }; return cache.slugs; }
    cache = { at: Date.now(), slugs: new Set(S.slugs(S.parse(await github.readFile('settings.json')))) };
  } catch (e) {
    console.error('[categories] could not refresh:', e.message);
    if (!cache.slugs) return builtin();
    cache.at = Date.now() - TTL_MS + 30 * 1000; // retry in 30 s, meanwhile keep the last known list
  }
  return cache.slugs;
}
const invalidate = () => { cache = { at: 0, slugs: null }; };

module.exports = { knownSlugs, invalidate };
