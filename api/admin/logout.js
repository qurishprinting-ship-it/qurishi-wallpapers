'use strict';
const { route, send } = require('../_lib/http');
const auth = require('../_lib/auth');
const { audit } = require('../_lib/analytics');

module.exports = route(['POST'], async (req, res) => {
  const s = auth.requireAdmin(req, { csrf: true });
  await audit(s.u, 'logout');
  send(res, 200, { ok: true }, { 'Set-Cookie': auth.clearCookie() });
});
