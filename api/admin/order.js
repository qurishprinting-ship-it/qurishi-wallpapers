'use strict';
// Save the display order (and featured flags) of ONE category in a single atomic commit.
// body: { category, order: [{ id, featured }, ...] }  — the full sequence as the admin sees it (featured group first).
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const S = require('../_lib/settings');
const O = require('../../shared/order');
const github = require('../_lib/github');
const { limits } = require('../_lib/config');
const { audit } = require('../_lib/analytics');

const handler = route(['POST'], async (req, res) => {
  const session = await auth.requireAdmin(req, { csrf: true });
  const body = await readJson(req, 512 * 1024);
  const category = G.assertCategory(body.category);
  if (!Array.isArray(body.order) || body.order.length > limits.orderMax) throw new HttpError(400, 'Invalid order list');
  const seq = body.order.map((e) => {
    if (!e || !G.validId(e.id)) throw new HttpError(400, 'Invalid design id in order list');
    return { id: e.id, featured: e.featured === undefined ? undefined : e.featured === true };
  });
  const { result } = await github.updateRepo(`Re-order ${category}`, async (r) => {
    const settings = S.parse(await r.readText('settings.json'), { strict: true });
    G.assertCategory(category, S.slugs(settings));
    const items = JSON.parse((await r.readText('data.json')) || '[]');
    const next = O.applySequence(items, category, seq);
    const mine = next.filter((i) => i.category === category);
    return { upserts: [{ path: 'data.json', content: JSON.stringify(next, null, 2) + '\n' }], result: { count: mine.length, featured: mine.filter((i) => i.featured === true).length } };
  });
  await audit(session.u, 'reorder', `${category}: ${result.count} designs, ${result.featured} featured`);
  send(res, 200, result);
});
module.exports = handler;
module.exports.config = noBody;
