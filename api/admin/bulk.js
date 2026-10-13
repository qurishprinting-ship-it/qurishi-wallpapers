'use strict';
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const S = require('../_lib/settings');
const O = require('../../shared/order');
const github = require('../_lib/github');
const { limits } = require('../_lib/config');
const { audit, moveCounters } = require('../_lib/analytics');

const ACTIONS = ['delete', 'category', 'feature', 'unfeature'];

const handler = route(['POST'], async (req, res) => {
  const session = await auth.requireAdmin(req, { csrf: true });
  const body = await readJson(req, 16 * 1024);
  if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length > limits.bulkMax) throw new HttpError(400, `Select 1–${limits.bulkMax} wallpapers per request`);
  const keys = [...new Set(body.keys)].map(G.parseKey);
  if (body.action === 'delete' && body.confirm !== true) throw new HttpError(400, 'Deletion requires confirmation');
  if (!ACTIONS.includes(body.action)) throw new HttpError(400, 'Unknown action');
  const target = body.action === 'category' ? G.assertCategory(body.category) : null;

  const moves = [];
  const { result } = await github.updateRepo(`Bulk ${body.action} (${keys.length})`, async (r) => {
    moves.length = 0; // build() may run again after a commit conflict
    const items = JSON.parse((await r.readText('data.json')) || '[]');
    const settings = S.parse(await r.readText('settings.json'), { strict: true });
    if (target) G.assertCategory(target, S.slugs(settings));
    const upserts = [], deletes = [];
    let list = items;
    let done = [], skipped = [];

    if (body.action === 'delete') {
      const tree = await r.tree();
      for (const { category, id } of keys) {
        const idx = list.findIndex((i) => i.category === category && i.id === id);
        if (idx < 0) { skipped.push(G.keyOf(category, id)); continue; }
        const f = G.locate(list[idx], tree);
        for (const p of [f.image, f.thumbnail]) if (p) deletes.push(p);
        list = list.filter((_, n) => n !== idx);
        done.push(G.keyOf(category, id));
      }
    } else if (body.action === 'category') {
      const tree = await r.tree();
      const m = G.moveItems(list, tree, keys, target, (s) => S.baseName(settings, s));
      list = m.moves.length ? O.appendToCategory(m.list, target, m.moves.map((x) => x.newId)) : m.list;
      upserts.push(...m.upserts); deletes.push(...m.deletes); moves.push(...m.moves); done = m.done; skipped = m.skipped;
    } else {
      const want = body.action === 'feature';
      for (const { category, id } of keys) {
        if (!list.some((i) => i.category === category && i.id === id)) { skipped.push(G.keyOf(category, id)); continue; }
        list = O.setFeatured(list, category, id, want);
        done.push(G.keyOf(category, id));
      }
    }
    upserts.push({ path: 'data.json', content: JSON.stringify(list, null, 2) + '\n' });
    return { upserts, deletes, result: { done, skipped } };
  });

  for (const m of moves) await moveCounters(m.from, m.to);
  await audit(session.u, `bulk-${body.action}`, `${result.done.length} item(s)`);
  send(res, 200, result);
});
module.exports = handler;
module.exports.config = noBody;
