'use strict';
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const github = require('../_lib/github');
const { limits } = require('../_lib/config');
const { audit, moveCounters } = require('../_lib/analytics');

const handler = route(['POST'], async (req, res) => {
  const session = auth.requireAdmin(req, { csrf: true });
  const body = await readJson(req, 16 * 1024);
  if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length > limits.bulkMax) throw new HttpError(400, `Select 1–${limits.bulkMax} wallpapers per request`);
  const keys = [...new Set(body.keys)].map(G.parseKey);
  if (body.action === 'delete' && body.confirm !== true) throw new HttpError(400, 'Deletion requires confirmation');
  if (!['delete', 'category'].includes(body.action)) throw new HttpError(400, 'Unknown action');
  const target = body.action === 'category' ? G.assertCategory(body.category) : null;

  const moves = [];
  const { result } = await github.updateRepo(`Bulk ${body.action} (${keys.length})`, async (r) => {
    moves.length = 0; // build() may run again after a commit conflict
    const items = JSON.parse((await r.readText('data.json')) || '[]');
    const tree = await r.tree();
    const upserts = [], deletes = [];
    const done = [], skipped = [];
    let list = items;
    for (const { category, id } of keys) {
      const idx = list.findIndex((i) => i.category === category && i.id === id);
      if (idx < 0) { skipped.push(G.keyOf(category, id)); continue; }
      const item = list[idx];
      if (body.action === 'delete') {
        const f = G.locate(item, tree);
        for (const p of [f.image, f.thumbnail]) if (p) deletes.push(p);
        list = list.filter((_, n) => n !== idx);
        done.push(G.keyOf(category, id));
      } else if (target === category) {
        skipped.push(G.keyOf(category, id));
      } else {
        const free = !list.some((i) => i.category === target && i.id === id) && !tree.has(G.paths(target, id).image);
        const newId = free ? id : G.chooseId(list, target, '', (p) => tree.has(p));
        const found = G.locate(item, tree);
        const to = G.paths(target, newId, found.image ? found.image.split('.').pop() : 'webp');
        for (const [from, dest] of [[found.image, to.image], [found.thumbnail, to.thumbnail]]) {
          if (from) { upserts.push({ path: dest, sha: tree.get(from) }); deletes.push(from); }
        }
        const generic = /^(Wall|Ceiling|Flat) \d+$/i.test(item.title);
        list[idx] = { ...item, category: target, id: newId, image: to.image, thumbnail: to.thumbnail, title: generic ? G.titleFor(target, newId) : item.title };
        moves.push({ from: G.keyOf(category, id), to: G.keyOf(target, newId) });
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
