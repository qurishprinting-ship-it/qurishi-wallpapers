'use strict';
const crypto = require('crypto');
const { env, limits } = require('./config');
const { HttpError, parseCookies, clientIp, shortHash } = require('./http');
const store = require('./store');

const COOKIE = 'qw_session';
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

const scrypt = (pw, salt, o) =>
  new Promise((res, rej) => crypto.scrypt(pw, salt, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

// Format: scrypt$N$r$p$saltB64$hashB64  (generate with `npm run hash-password`)
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  try {
    const [alg, N, r, p, saltB64, hashB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), { N: +N, r: +r, p: +p, keylen: expected.length });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const b64u = (b) => Buffer.from(b).toString('base64url');
const secret = () => {
  const s = env('SESSION_SECRET');
  if (s.length < 32) throw new HttpError(503, 'Server is not configured (SESSION_SECRET must be at least 32 characters)');
  return s;
};
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

function createSession(user, minIat = 0) {
  const now = Math.max(Math.floor(Date.now() / 1000), minIat); // never older than the last password change
  const payload = { u: user, iat: now, exp: now + limits.sessionHours * 3600, csrf: crypto.randomBytes(18).toString('base64url') };
  const body = b64u(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, payload };
}

function verifySession(token) {
  if (!token || typeof token !== 'string' || token.length > 1024) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const good = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp > Math.floor(Date.now() / 1000) ? p : null;
  } catch {
    return null;
  }
}

const cookieAttrs = (maxAge) => `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (env('NODE_ENV') === 'development' || env('ALLOW_INSECURE_COOKIE') ? '' : '; Secure');
const sessionCookie = (token) => `${COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(limits.sessionHours * 3600)}`;
const clearCookie = () => `${COOKIE}=; ${cookieAttrs(0)}`;

function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return; // same-origin GET navigations / non-browser clients carry no Origin
  let host;
  try { host = new URL(origin).host; } catch { throw new HttpError(403, 'Bad origin'); }
  if (host !== req.headers.host) throw new HttpError(403, 'Cross-origin request blocked');
}

// Password changes are stored in the private key/value store (Upstash) under this key as
// {"hash":"scrypt$…","changedAt":<unix seconds>}. When present it takes precedence over the ADMIN_PASSWORD_HASH
// environment variable (which stays untouched as a fallback — delete the key to fall back to it again).
const PW_KEY = 'admin:pw';

async function readPasswordRecord() {
  const raw = await store.cmd('GET', PW_KEY);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw);
    return rec && typeof rec.hash === 'string' ? rec : null;
  } catch { return null; }
}

// The hash that is currently valid: the stored override, else the environment variable.
async function currentPasswordHash() {
  let rec = null;
  try { rec = await readPasswordRecord(); } catch (e) {
    // Fail closed: if the store is down we cannot know whether the password was changed.
    console.error('[auth] password store unavailable:', e.message);
    throw new HttpError(503, 'Sign-in is temporarily unavailable. Please try again in a minute.');
  }
  return rec ? rec.hash : env('ADMIN_PASSWORD_HASH');
}

async function savePasswordHash(hash) {
  const changedAt = Math.floor(Date.now() / 1000);
  await store.cmd('SET', PW_KEY, JSON.stringify({ hash, changedAt }));
  return changedAt;
}

// Server-side authorization for every admin endpoint. `csrf: true` for state-changing requests.
// Async because a session issued BEFORE the last password change is no longer valid.
async function requireAdmin(req, { csrf = false } = {}) {
  const session = verifySession(parseCookies(req)[COOKIE]);
  if (!session) throw new HttpError(401, 'Not authenticated');
  if (csrf) {
    checkOrigin(req);
    const sent = String(req.headers['x-csrf-token'] || '');
    const a = Buffer.from(sent), b = Buffer.from(session.csrf);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(403, 'Invalid CSRF token');
  }
  try {
    const rec = await readPasswordRecord();
    if (rec && Number.isFinite(rec.changedAt) && session.iat < rec.changedAt) throw new HttpError(401, 'Password was changed. Please sign in again.');
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error('[auth] revocation check skipped (store unavailable):', e.message); // availability over strictness here
  }
  return session;
}

const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

async function login(req, username, password) {
  const ip = shortHash(clientIp(req), env('SESSION_SECRET'));
  const byIp = await store.rateLimit(`login:ip:${ip}`, 6, 15 * 60, { strict: true });
  const global = await store.rateLimit('login:all', 40, 60 * 60, { strict: true });
  if (!byIp.ok || !global.ok) throw new HttpError(429, 'Too many login attempts. Try again later.', { retryAfter: 900 });

  const hash = await currentPasswordHash();
  if (!hash) throw new HttpError(503, 'Admin login is not configured (ADMIN_PASSWORD_HASH missing)');
  const userOk = typeof username === 'string' && username.length < 100 &&
    crypto.timingSafeEqual(Buffer.from(shortHash(username)), Buffer.from(shortHash(env('ADMIN_USERNAME', 'admin'))));
  // Always run scrypt so response time does not reveal whether the username was right.
  const passOk = await verifyPassword(String(password || '').slice(0, 200), userOk ? hash : DUMMY);
  if (!(userOk && passOk)) throw new HttpError(401, 'Invalid username or password');
  return createSession(env('ADMIN_USERNAME', 'admin'));
}

module.exports = { hashPassword, verifyPassword, createSession, verifySession, sessionCookie, clearCookie, requireAdmin, login, currentPasswordHash, savePasswordHash, COOKIE, PW_KEY };
