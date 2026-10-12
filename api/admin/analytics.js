'use strict';
const { route, send } = require('../_lib/http');
const auth = require('../_lib/auth');
const store = require('../_lib/store');
const { dayKey } = require('../_lib/analytics');

const DAYS = 30;
const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

module.exports = route(['GET'], async (req, res) => {
  auth.requireAdmin(req);
  const days = Array.from({ length: DAYS }, (_, i) => dayKey(i));
  const cmds = [
    ['HGETALL', 'stats:total'], ['PFCOUNT', 'uv:all'], ['HGETALL', 'wp:views'], ['HGETALL', 'wp:wa'],
    ['HGETALL', 'cat:views'], ['HGETALL', 'cat:wa'], ['LRANGE', 'activity', 0, 49],
    ['PFCOUNT', ...days.slice(0, 7).map((d) => `uv:day:${d}`)], ['PFCOUNT', ...days.map((d) => `uv:day:${d}`)],
    ...days.map((d) => ['HGETALL', `stats:day:${d}`]), ...days.map((d) => ['PFCOUNT', `uv:day:${d}`]),
  ];
  const r = await store.pipeline(cmds);
  const total = store.toObject(r[0]);
  const daily = days.map((d, i) => ({ date: d, ...{ pv: 0, wa: 0, ...store.toObject(r[9 + i]) }, visitors: Number(r[9 + DAYS + i]) || 0 })).reverse();
  const views = store.toObject(r[2]), wa = store.toObject(r[3]);
  send(res, 200, {
    totals: { pageViews: total.pv || 0, whatsapp: total.wa || 0, visitors: Number(r[1]) || 0 },
    visitors: { today: daily[daily.length - 1].visitors, week: Number(r[7]) || 0, month: Number(r[8]) || 0, all: Number(r[1]) || 0 },
    daily,
    categories: { views: store.toObject(r[4]), whatsapp: store.toObject(r[5]) },
    topViewed: top(views), topOrdered: top(wa),
    recent: (r[6] || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean),
    persistent: store.persistent(),
  });
});
