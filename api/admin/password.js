'use strict';
const { route, send, readJson, noBody, HttpError } = require('../_lib/http');
const auth = require('../_lib/auth');
const store = require('../_lib/store');
const { env, limits } = require('../_lib/config');
const { audit } = require('../_lib/analytics');

const handler = route(['POST'], async (req, res) => {
  const session = await auth.requireAdmin(req, { csrf: true });
  if (!store.persistent() && !env('ALLOW_MEMORY_PASSWORD_STORE')) {
    throw new HttpError(503, 'Password changes need persistent storage. Connect Upstash Redis in Vercel first (see README).');
  }
  const rl = await store.rateLimit(`pwchange:${session.u}`, 5, 15 * 60, { strict: true });
  if (!rl.ok) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.', { retryAfter: rl.retryAfter });

  const { currentPassword, newPassword, confirmPassword } = await readJson(req, 4096);
  const cur = String(currentPassword || ''), next = String(newPassword || '');
  if (!cur) throw new HttpError(400, 'Enter your current password');
  if (next.length < limits.minPasswordLength) throw new HttpError(400, `New password must be at least ${limits.minPasswordLength} characters`);
  if (next.length > 200) throw new HttpError(400, 'New password is too long (max 200 characters)');
  if (next !== String(confirmPassword || '')) throw new HttpError(400, 'The new passwords do not match');
  if (next === cur) throw new HttpError(400, 'The new password must be different from the current one');

  const ok = await auth.verifyPassword(cur.slice(0, 200), await auth.currentPasswordHash());
  if (!ok) throw new HttpError(403, 'Current password is incorrect');

  const changedAt = await auth.savePasswordHash(await auth.hashPassword(next));
  await audit(session.u, 'password-change');
  // Every older session is now invalid; hand this browser a fresh one so the owner stays signed in.
  const fresh = auth.createSession(session.u, changedAt);
  send(res, 200, { ok: true, csrf: fresh.payload.csrf, expiresAt: fresh.payload.exp * 1000 }, { 'Set-Cookie': auth.sessionCookie(fresh.token) });
});
module.exports = handler;
module.exports.config = noBody;
