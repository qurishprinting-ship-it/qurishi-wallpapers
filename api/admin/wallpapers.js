'use strict';
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const S = require('../_lib/settings');
const O = require('../../shared/order');
const github = require('../_lib/github');
const store = require('../_lib/store');
const { audit, moveCounters } = require('../_lib/analytics');

async function counts() {
  const [v, w] = await store.pipeline([['HGETALL', 'wp:views'], ['HGETALL', 'wp:wa']]);
  return [store.toObject(v), store.toObject(w)];
}

const handler = route(['GET', 'PATCH'], async (req, res) => {
  if (req.method === 'GET') {
    await auth.requireAdmin(req);
    const items = await github.readDataJson();
    let views = {}, wa = {};
    try { [views, wa] = await counts(); } catch (e) { console.error('[wallpapers] counts failed:', e.message); }
    return send(res, 200, { items: G.mergeCounts(items, views, wa) });
  }

  const session = await auth.requireAdmin(req, { csrf: true });
  const body = await readJson(req);
  const { category: oldCat, id } = G.parseKey(body.key);
  const newTitle = body.title !== undefined ? G.cleanTitle(body.title) : null;
  const newCat = body.category !== undefined ? G.assertCategory(body.category) : null;
  if (body.featured !== undefined && typeof body.featured !== 'boolean') throw new HttpError(400, 'featured must be true or false');
  const feat = body.featured === undefined ? null : body.featured;
  if (newTitle === null && newCat === null && feat === null) throw new HttpError(400, 'Nothing to change');

  let moved = null;
  const { result } = await github.updateRepo(`Update wallpaper ${oldCat}/${id}`, async (r) => {
    moved = null; // build() may run again after a commit conflict
    let items = JSON.parse((await r.readText('data.json')) || '[]');
    const settings = S.parse(await r.readText('settings.json'), { strict: true });
    if (newCat) G.assertCategory(newCat, S.slugs(settings));
    const idx = items.findIndex((i) => i.category === oldCat && i.id === id);
    if (idx < 0) throw new HttpError(404, 'Wallpaper not found');
    let upserts = [], deletes = [];
    let curCat = oldCat, curId = id;

    if (newCat && newCat !== oldCat) {
      const tree = await r.tree();
      const m = G.moveItems(items, tree, [{ category: oldCat, id }], newCat, (s) => S.baseName(settings, s));
      items = O.appendToCategory(m.list, newCat, [m.moves[0].newId]);
      upserts = m.upserts; deletes = m.deletes;
      curCat = newCat; curId = m.moves[0].newId;
      moved = { from: m.moves[0].from, to: m.moves[0].to };
    }
    const at = items.findIndex((i) => i.category === curCat && i.id === curId);
    if (newTitle !== null) items[at] = { ...items[at], title: newTitle };
    if (feat !== null) items = O.setFeatured(items, curCat, curId, feat);
    upserts.push({ path: 'data.json', content: JSON.stringify(items, null, 2) + '\n' });
    return { upserts, deletes, result: items.find((i) => i.category === curCat && i.id === curId) };
  });

  if (moved) await moveCounters(moved.from, moved.to);
  await audit(session.u, moved ? 'move' : feat !== null && newTitle === null ? (feat ? 'feature' : 'unfeature') : 'edit', moved ? `${moved.from} -> ${moved.to}` : `${oldCat}/${id}`);
  send(res, 200, { item: result, moved });
});
module.exports = handler;
module.exports.config = noBody;
