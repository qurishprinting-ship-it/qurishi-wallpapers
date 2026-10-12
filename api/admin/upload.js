'use strict';
const { route, send, readRaw, query, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const G = require('../_lib/gallery');
const github = require('../_lib/github');
const { optimize } = require('../_lib/optimize');
const { limits } = require('../_lib/config');
const { audit } = require('../_lib/analytics');
const store = require('../_lib/store');

// One image per request (raw binary body) so a failed file never cancels the others.
const handler = route(['POST'], async (req, res) => {
  const session = auth.requireAdmin(req, { csrf: true });
  const rl = await store.rateLimit(`upload:${session.u}`, 300, 3600);
  if (!rl.ok) throw new HttpError(429, 'Upload limit reached for this hour', { retryAfter: rl.retryAfter });

  const q = query(req);
  const category = G.assertCategory(q.category);
  const buf = await readRaw(req, limits.maxUploadBytes);
  if (!buf.length) throw new HttpError(400, 'Empty upload');
  const originalSize = Math.max(buf.length, Number(req.headers['x-original-size']) || 0);

  const opt = await optimize(buf); // validates real content, throws 415 for non-images
  const now = new Date().toISOString();

  const { result: item } = await github.updateRepo(`Add wallpaper (${category})`, async (r) => {
    const items = JSON.parse((await r.readText('data.json')) || '[]');
    const dup = items.find((i) => i.hash === opt.hash);
    if (dup) throw new HttpError(409, 'Duplicate image', { duplicateOf: G.keyOf(dup.category, dup.id) });
    const tree = await r.tree();
    const id = G.chooseId(items, category, q.name, (p) => tree.has(p));
    const p = G.paths(category, id);
    const record = {
      id, title: G.titleFor(category, id), category,
      image: p.image, thumbnail: p.thumbnail,
      width: opt.full.width, height: opt.full.height, aspectRatio: G.aspectOf(opt.full.width, opt.full.height),
      fileSize: opt.full.size, format: 'webp', createdAt: now, hash: opt.hash,
    };
    items.unshift(record);
    return {
      upserts: [
        { path: p.image, content: opt.full.buffer },
        { path: p.thumbnail, content: opt.thumb.buffer },
        { path: 'data.json', content: JSON.stringify(items, null, 2) + '\n' },
      ],
      result: record,
    };
  });

  await audit(session.u, 'upload', `${item.category}/${item.id}`);
  send(res, 201, {
    item,
    stats: {
      originalSize, optimizedSize: opt.full.size, thumbnailSize: opt.thumb.size,
      reductionPct: Math.max(0, Math.round((1 - opt.full.size / originalSize) * 100)),
      format: 'webp', width: opt.full.width, height: opt.full.height, quality: opt.full.quality,
    },
  });
});
module.exports = handler;
module.exports.config = noBody;
