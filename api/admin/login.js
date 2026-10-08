'use strict';
const { route, send, readJson, noBody } = require('../_lib/http');
const auth = require('../_lib/auth');
const { audit } = require('../_lib/analytics');

const handler = route(['POST'], async (req, res) => {
  const { username, password } = await readJson(req, 4096);
  const { token, payload } = await auth.login(req, username, password);
  await audit(payload.u, 'login');
  send(res, 200, { ok: true, csrf: payload.csrf, expiresAt: payload.exp * 1000 }, { 'Set-Cookie': auth.sessionCookie(token) });
});
module.exports = handler;
module.exports.config = noBody;
