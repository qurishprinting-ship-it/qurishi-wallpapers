'use strict';
// Public, write-only analytics beacon. No personal data stored: visitors are counted via a daily-rotating salted hash in a HyperLogLog.
const { route, send, readJson, clientIp, shortHash, noBody } = require('./_lib/http');
const { env, CATEGORIES } = require('./_lib/config');
const { ID_RE } = require('./_lib/gallery');
const { dayKey } = require('./_lib/analytics');
const store = require('./_lib/store');

const handler = route(['POST'], async (req, res) => {
  const ip = clientIp(req);
  const rl = await store.rateLimit(`track:${shortHash(ip)}`, 120, 60);
  if (!rl.ok) return send(res, 429, { error: 'Too many requests' });

  const b = await readJson(req, 2048);
  const day = dayKey();
  const cat = CATEGORIES.includes(b.category) ? b.category : null;
  const id = typeof b.id === 'string' && ID_RE.test(b.id) ? b.id : null;
  const key = cat && id ? `${cat}/${id}` : null;
  const source = b.source === 'preview' ? 'preview' : 'card';
  const cmds = [];

  switch (b.type) {
    case 'visit': {
      const ua = String(req.headers['user-agent'] || '').slice(0, 200);
      const vid = shortHash(env('SESSION_SECRET', 'dev'), day, ip, ua);
      cmds.push(['HINCRBY', 'stats:total', 'pv', 1], ['HINCRBY', `stats:day:${day}`, 'pv', 1],
        ['PFADD', `uv:day:${day}`, vid], ['PFADD', 'uv:all', vid]);
      break;
    }
    case 'category':
      if (!cat) return send(res, 400, { error: 'Bad category' });
      cmds.push(['HINCRBY', 'cat:views', cat, 1]);
      break;
    case 'view':
      if (!key) return send(res, 400, { error: 'Bad wallpaper' });
      cmds.push(['HINCRBY', 'wp:views', key, 1], ['HINCRBY', 'cat:views', cat, 1],
        ['LPUSH', 'activity', JSON.stringify({ t: new Date().toISOString(), type: 'view', key })], ['LTRIM', 'activity', 0, 199]);
      break;
    case 'wa':
      if (!key) return send(res, 400, { error: 'Bad wallpaper' });
      cmds.push(['HINCRBY', 'stats:total', 'wa', 1], ['HINCRBY', `stats:day:${day}`, 'wa', 1],
        ['HINCRBY', 'wp:wa', key, 1], ['HINCRBY', 'cat:wa', cat, 1],
        ['LPUSH', 'activity', JSON.stringify({ t: new Date().toISOString(), type: 'wa', key, source })], ['LTRIM', 'activity', 0, 199]);
      break;
    default:
      return send(res, 400, { error: 'Unknown event' });
  }
  try { await store.pipeline(cmds); } catch (e) { console.error('[track] store error:', e.message); }
  send(res, 204);
});

module.exports = handler;
module.exports.config = noBody;
