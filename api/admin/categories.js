'use strict';
const { route, send, readJson, query, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const S = require('../_lib/settings');
const O = require('../../shared/order');
const github = require('../_lib/github');
const known = require('../_lib/categories');
const { audit, moveCounters } = require('../_lib/analytics');

const withCounts = (settings, items) => settings.categories.map((c) => {
  const mine = items.filter((i) => i.category === c.slug);
  return { ...c, count: mine.length, featured: mine.filter((i) => i.featured === true).length };
});

// Persist settings (+ optional data.json changes) in ONE commit.
const commit = (message, fn) => github.updateRepo(message, async (r) => {
  const settings = S.parse(await r.readText('settings.json'), { strict: true });
  const items = JSON.parse((await r.readText('data.json')) || '[]');
  const out = await fn({ settings, items, r });
  settings.categories.sort((a, b) => a.order - b.order).forEach((c, i) => { c.order = i; });
  const upserts = [{ path: 'settings.json', content: S.serialize(settings) }, ...(out.upserts || [])];
  if (out.items) upserts.push({ path: 'data.json', content: JSON.stringify(out.items, null, 2) + '\n' });
  return { upserts, deletes: out.deletes || [], result: { settings, items: out.items || items, moves: out.moves || [] } };
});

const handler = route(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'], async (req, res) => {
  if (req.method === 'GET') {
    await auth.requireAdmin(req);
    const [st, dt] = await Promise.all([github.readFile('settings.json'), github.readDataJson()]);
    return send(res, 200, { categories: withCounts(S.parse(st), dt) });
  }
  const session = await auth.requireAdmin(req, { csrf: true });
  const q = query(req);
  const body = req.method === 'DELETE' ? {} : await readJson(req, 8192);

  if (req.method === 'POST') {
    const name = S.cleanName(body.name);
    const names = S.cleanNames(body.names);
    const { result } = await commit(`Add category "${name}"`, ({ settings }) => {
      S.assertCanAdd(settings);
      const slug = S.makeSlug(settings, name, names);
      settings.categories.push({ slug, name, names, order: settings.categories.length, enabled: true, builtin: false });
      return {};
    });
    known.invalidate();
    const created = result.settings.categories[result.settings.categories.length - 1];
    await audit(session.u, 'category-add', created.slug);
    return send(res, 201, { category: created, categories: withCounts(result.settings, result.items) });
  }

  if (req.method === 'PATCH') {
    const { result } = await commit(`Edit category ${String(body.slug).slice(0, 30)}`, ({ settings }) => {
      const c = S.categoryMap(settings).get(S.assertSlug(settings, body.slug));
      if (body.name !== undefined) c.name = S.cleanName(body.name);
      if (body.names !== undefined) c.names = S.cleanNames(body.names);
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== 'boolean') throw new HttpError(400, 'enabled must be true or false');
        if (!body.enabled && settings.categories.filter((x) => x.enabled && x.slug !== c.slug).length === 0) throw new HttpError(400, 'At least one category must stay visible');
        c.enabled = body.enabled;
      }
      return {};
    });
    known.invalidate();
    await audit(session.u, 'category-edit', body.slug);
    return send(res, 200, { categories: withCounts(result.settings, result.items) });
  }

  if (req.method === 'PUT') { // re-order: { slugs: [...] } (any category not listed keeps its relative place at the end)
    if (!Array.isArray(body.slugs)) throw new HttpError(400, 'slugs must be a list');
    const { result } = await commit('Re-order categories', ({ settings }) => {
      const rank = new Map();
      body.slugs.forEach((s) => { if (S.slugs(settings).includes(s) && !rank.has(s)) rank.set(s, rank.size); });
      settings.categories.forEach((c) => { c.order = rank.has(c.slug) ? rank.get(c.slug) : 1000 + c.order; });
      return {};
    });
    await audit(session.u, 'category-order', `${body.slugs.length} categories`);
    return send(res, 200, { categories: withCounts(result.settings, result.items) });
  }

  // DELETE ?slug=…&confirm=1[&reassignTo=…]
  if (q.confirm !== '1') throw new HttpError(400, 'Deletion requires confirmation');
  const slug = q.slug;
  const { result } = await commit(`Delete category ${String(slug).slice(0, 30)}`, async ({ settings, items, r }) => {
    const c = S.categoryMap(settings).get(S.assertSlug(settings, slug));
    if (c.builtin) throw new HttpError(400, 'The original categories (Wall, Ceiling, Flat) cannot be deleted. Hide the category instead.');
    const mine = items.filter((i) => i.category === slug);
    let out = {};
    if (mine.length) {
      if (!q.reassignTo) throw new HttpError(409, 'This category still contains designs. Choose where to move them.', { count: mine.length, needsReassign: true });
      const to = S.assertSlug(settings, q.reassignTo);
      if (to === slug) throw new HttpError(400, 'Choose a different category');
      const tree = await r.tree();
      const m = G.moveItems(items, tree, mine.map((i) => ({ category: i.category, id: i.id })), to, (s) => S.baseName(settings, s));
      out = { items: O.appendToCategory(m.list, to, m.moves.map((x) => x.newId)), upserts: m.upserts, deletes: m.deletes, moves: m.moves };
    }
    settings.categories = settings.categories.filter((x) => x.slug !== slug);
    return out;
  });
  for (const m of result.moves) await moveCounters(m.from, m.to);
  known.invalidate();
  await audit(session.u, 'category-delete', `${slug}${result.moves.length ? ` (${result.moves.length} designs moved to ${q.reassignTo})` : ''}`);
  send(res, 200, { categories: withCounts(result.settings, result.items), moved: result.moves.length });
});
module.exports = handler;
module.exports.config = noBody;
