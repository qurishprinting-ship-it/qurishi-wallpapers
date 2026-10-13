'use strict';
// Theme settings. settings.json is public (read by the static site) and contains no secrets.
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const S = require('../_lib/settings');
const Theme = require('../../shared/theme');
const github = require('../_lib/github');
const { DEFAULT_PRIMARY } = require('../_lib/config');
const { audit } = require('../_lib/analytics');

const handler = route(['GET', 'PUT'], async (req, res) => {
  if (req.method === 'GET') {
    await auth.requireAdmin(req);
    const settings = S.parse(await github.readFile('settings.json'));
    return send(res, 200, { settings, defaultPrimary: DEFAULT_PRIMARY });
  }
  const session = await auth.requireAdmin(req, { csrf: true });
  const body = await readJson(req, 4096);
  const primary = body.restoreDefault === true ? DEFAULT_PRIMARY : Theme.normalizeHex(body.primary);
  if (!primary) throw new HttpError(400, 'Enter a valid colour such as #121efb');
  const { result } = await github.updateRepo('Update theme colour', async (r) => {
    const settings = S.parse(await r.readText('settings.json'), { strict: true });
    if (settings.theme.primary === primary) return { result: settings };
    settings.theme.primary = primary;
    return { upserts: [{ path: 'settings.json', content: S.serialize(settings) }], result: settings };
  });
  await audit(session.u, 'theme', primary);
  send(res, 200, { settings: result });
});
module.exports = handler;
module.exports.config = noBody;
