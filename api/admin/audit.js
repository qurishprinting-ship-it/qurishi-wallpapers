'use strict';
const { route, send } = require('../_lib/http');
const auth = require('../_lib/auth');
const store = require('../_lib/store');

module.exports = route(['GET'], async (req, res) => {
  auth.requireAdmin(req);
  const [rows] = await store.pipeline([['LRANGE', 'audit', 0, 99]]);
  send(res, 200, { entries: (rows || []).map((x) => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean) });
});
