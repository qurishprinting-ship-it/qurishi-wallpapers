'use strict';
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const github = require('../_lib/github');
const store = require('../_lib/store');
const { audit, moveCounters } = require('../_lib/analytics');

async function counts() {
  const [v, w] = await store.pipeline([['HGETALL', 'wp:views'], ['HGETALL', 'wp:wa']]);
  return [store.toObject(v), store.toObject(w)];
}

const handler = route(['GET', 'PATCH'], async (req, res) => {
  if (req.method === 'GET') {
    auth.requireAdmin(req);
    const items = await github.readDataJson();
    let views = {}, wa = {};
    try { [views, wa] = await counts(); } catch (e) { console.error('[wallpapers] counts failed:', e.message); }
    return send(res, 200, { items: G.mergeCounts(items, views, wa) });
  }

  const session = auth.requireAdmin(req, { csrf: true });
  const body = await readJson(req);
  const { category: oldCat, id } = G.parseKey(body.key);
  const newTitle = body.title !== undefined ? G.cleanTitle(body.title) : null;
  const newCat = body.category !== undefined ? G.assertCategory(body.category) : null;
  if (newTitle === null && newCat === null) throw new HttpError(400, 'Nothing to change');

  let moved = null;
  const { result } = await github.updateRepo(`Update wallpaper ${oldCat}/${id}`, async (r) => {
    const items = JSON.parse((await r.readText('data.json')) || '[]');
    const idx = items.findIndex((i) => i.category === oldCat && i.id === id);
    if (idx < 0) throw new HttpError(404, 'Wallpaper not found');
    const item = { ...items[idx] };
    const upserts = [], deletes = [];
    if (newTitle !== null) item.title = newTitle;
    if (newCat && newCat !== oldCat) {
      const tree = await r.tree();
      const newId = items.some((i) => i.category === newCat && i.id === id) || tree.has(G.paths(newCat, id).image) ? G.chooseId(items, newCat, '') : id;
      const found = G.locate(item, tree);
      const ext = found.image ? found.image.split('.').pop() : 'webp';
      const to = G.paths(newCat, newId, ext);
      // Re-point the existing blobs at the new paths: no image bytes are downloaded or re-uploaded.
      for (const [from, dest] of [[found.image, to.image], [found.thumbnail, to.thumbnail]]) {
        if (from) { upserts.push({ path: dest, sha: tree.get(from) }); deletes.push(from); }
      }
      if (/^Wall \d|^Ceiling \d|^Flat \d/i.test(item.title) && newTitle === null) item.title = G.titleFor(newCat, newId);
      Object.assign(item, { category: newCat, id: newId, image: to.image, thumbnail: to.thumbnail });
      moved = { from: G.keyOf(oldCat, id), to: G.keyOf(newCat, newId) };
    }
    items[idx] = item;
    upserts.push({ path: 'data.json', content: JSON.stringify(items, null, 2) + '\n' });
    return { upserts, deletes, result: item };
  });

  if (moved) await moveCounters(moved.from, moved.to);
  await audit(session.u, moved ? 'move' : 'edit', moved ? `${moved.from} -> ${moved.to}` : `${oldCat}/${id}`);
  send(res, 200, { item: result, moved });
});
module.exports = handler;
module.exports.config = noBody;
