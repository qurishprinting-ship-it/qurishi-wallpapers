'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { fakeGitHub, call } = require('./helpers');

process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.ADMIN_USERNAME = 'owner';
process.env.GITHUB_OWNER = 'o'; process.env.GITHUB_REPO = 'r'; process.env.GITHUB_TOKEN = 'ghp_TESTTOKEN';
process.env.ALLOW_INSECURE_COOKIE = '1';

// Stub the optimizer (sharp is not installed in this sandbox); the stub returns deterministic "images".
const optPath = require.resolve('../api/_lib/optimize.js');
let nextOpt = null;
require.cache[optPath] = { id: optPath, filename: optPath, loaded: true, exports: {
  optimize: async (buf) => {
    if (buf.toString().startsWith('NOTIMG')) { const { HttpError } = require('../api/_lib/http'); throw new HttpError(415, 'File is not a valid image'); }
    const o = nextOpt || { w: 900, h: 1600 };
    return { full: { buffer: Buffer.from('FULL' + buf.toString()), width: o.w, height: o.h, size: 40000, quality: 74 },
      thumb: { buffer: Buffer.from('THUMB' + buf.toString()), width: 270, height: 480, size: 9000 },
      original: { format: 'jpeg', width: 3000, height: 5000, size: buf.length }, hash: require('crypto').createHash('sha256').update(buf).digest('hex').slice(0, 32) };
  } } };

const auth = require('../api/_lib/auth');
const store = require('../api/_lib/store');
const H = (f) => require(path.join('../api', f));
let gh, cookie, csrf;
const seed = JSON.stringify([
  { id: '002', title: 'Wall 002', category: 'wall' }, { id: '002', title: 'Ceiling 002', category: 'ceiling' }, { id: '5', title: 'Flat 5', category: 'flat' },
]);

beforeEach(async () => {
  store._mem.kv.clear(); store._mem.exp.clear();
  gh = fakeGitHub({ 'data.json': seed, 'images/wall/002.webp': 'oldwall', 'images/ceiling/002.jpg': 'oldceil', 'thumbs/wall/002.webp': 'oldthumb' });
  global.fetch = (u, i) => (String(u).startsWith('https://api.github.com') ? gh.fetchImpl(u, i) : Promise.reject(new Error('unexpected network ' + u)));
  process.env.ADMIN_PASSWORD_HASH = await auth.hashPassword('correct horse');
  const s = auth.createSession('owner'); cookie = `qw_session=${encodeURIComponent(s.token)}`; csrf = s.payload.csrf;
});

const authed = (extra = {}) => ({ headers: { cookie, 'x-csrf-token': csrf, ...extra } });

test('password hashing: verify ok / reject wrong / never plaintext', async () => {
  const h = await auth.hashPassword('s3cret');
  assert.ok(h.startsWith('scrypt$') && !h.includes('s3cret'));
  assert.equal(await auth.verifyPassword('s3cret', h), true);
  assert.equal(await auth.verifyPassword('nope', h), false);
  assert.equal(await auth.verifyPassword('x', 'garbage'), false);
});

test('session tokens: tamper and expiry rejected', () => {
  const { token } = auth.createSession('owner');
  assert.ok(auth.verifySession(token));
  const [b, s] = token.split('.');
  assert.equal(auth.verifySession(b + 'x.' + s), null);
  const forged = Buffer.from(JSON.stringify({ u: 'owner', exp: 9999999999, csrf: 'a' })).toString('base64url');
  assert.equal(auth.verifySession(forged + '.' + s), null);
  const real = JSON.parse(Buffer.from(b, 'base64url'));
  real.exp = 1; const old = Buffer.from(JSON.stringify(real)).toString('base64url');
  assert.equal(auth.verifySession(old + '.' + s), null);
});

test('every admin endpoint refuses unauthenticated requests', async () => {
  for (const [f, method] of [['me', 'GET'], ['wallpapers', 'GET'], ['wallpapers', 'PATCH'], ['bulk', 'POST'], ['upload', 'POST'], ['analytics', 'GET'], ['audit', 'GET'], ['logout', 'POST']]) {
    const r = await call(H(`admin/${f}.js`), { method, url: '/x?category=wall', body: method === 'GET' ? undefined : '{}' });
    assert.equal(r.status, 401, `${f} ${method}`);
  }
  assert.equal(gh.state.log.length, 0);
});

test('forged cookie / garbage cookie is rejected', async () => {
  for (const c of ['qw_session=abc.def', 'qw_session=', 'qw_session=' + 'a'.repeat(2000)]) {
    assert.equal((await call(H('admin/me.js'), { headers: { cookie: c } })).status, 401);
  }
});

test('login: success sets HttpOnly SameSite=Strict cookie; wrong password 401; no token in response', async () => {
  const bad = await call(H('admin/login.js'), { method: 'POST', body: { username: 'owner', password: 'wrong' } });
  assert.equal(bad.status, 401);
  const badUser = await call(H('admin/login.js'), { method: 'POST', body: { username: 'root', password: 'correct horse' } });
  assert.equal(badUser.status, 401);
  const ok = await call(H('admin/login.js'), { method: 'POST', body: { username: 'owner', password: 'correct horse' } });
  assert.equal(ok.status, 200);
  assert.match(ok.headers['set-cookie'], /HttpOnly/); assert.match(ok.headers['set-cookie'], /SameSite=Strict/);
  assert.ok(ok.json.csrf);
  assert.ok(!JSON.stringify(ok.json).includes('ghp_'));
  const me = await call(H('admin/me.js'), { headers: { cookie: ok.headers['set-cookie'].split(';')[0] } });
  assert.equal(me.status, 200);
  assert.ok(!JSON.stringify(me.json).includes('ghp_TESTTOKEN'));
});

test('login rate limiting kicks in after repeated failures', async () => {
  let last;
  for (let i = 0; i < 8; i++) last = await call(H('admin/login.js'), { method: 'POST', body: { username: 'owner', password: 'bad' + i } });
  assert.equal(last.status, 429);
  const stillBlocked = await call(H('admin/login.js'), { method: 'POST', body: { username: 'owner', password: 'correct horse' } });
  assert.equal(stillBlocked.status, 429);
});

test('login without configured hash -> 503, not open access', async () => {
  delete process.env.ADMIN_PASSWORD_HASH;
  const r = await call(H('admin/login.js'), { method: 'POST', body: { username: 'owner', password: '' } });
  assert.equal(r.status, 503);
});

test('CSRF: mutating request without token or with foreign Origin is blocked', async () => {
  const noCsrf = await call(H('admin/wallpapers.js'), { method: 'PATCH', headers: { cookie }, body: { key: 'wall/002', title: 'x' } });
  assert.equal(noCsrf.status, 403);
  const badOrigin = await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed({ origin: 'https://evil.test' }), body: { key: 'wall/002', title: 'x' } });
  assert.equal(badOrigin.status, 403);
  const goodOrigin = await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed({ origin: 'https://example.test' }), body: { key: 'wall/002', title: 'Fine' } });
  assert.equal(goodOrigin.status, 200);
});

test('upload: writes image + thumbnail + data.json in ONE commit, reports stats', async () => {
  const r = await call(H('admin/upload.js'), { method: 'POST', url: '/api/admin/upload?category=wall&name=700.jpg', ...authed({ 'x-original-size': '2000000' }), body: Buffer.from('img-A') });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.item.id, '700');
  assert.equal(r.json.item.aspectRatio, 0.5625);
  assert.equal(r.json.stats.originalSize, 2000000); assert.equal(r.json.stats.reductionPct, 98);
  assert.ok(gh.has('images/wall/700.webp') && gh.has('thumbs/wall/700.webp'));
  const data = JSON.parse(gh.text('data.json'));
  assert.equal(data[0].id, '700'); assert.equal(data.length, 4); // existing records preserved, new one first
  assert.equal(data.find((d) => d.category === 'ceiling').id, '002');
  assert.equal(gh.state.log.length, 1);
});

test('upload: non-image rejected (415), nothing committed; bad category 400; oversize 413', async () => {
  const bad = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=wall&name=a.jpg', ...authed(), body: Buffer.from('NOTIMG...') });
  assert.equal(bad.status, 415);
  assert.equal((await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=../../etc&name=a.jpg', ...authed(), body: Buffer.from('x') })).status, 400);
  const big = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=wall&name=a.jpg', ...authed({ 'content-length': String(6 * 1048576) }), body: Buffer.from('x') });
  assert.equal(big.status, 413);
  assert.equal(gh.state.log.length, 0);
});

test('upload: duplicate content detected; hostile filenames cannot influence the repo path', async () => {
  const a = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=flat&name=../../.github/workflows/evil.yml', ...authed(), body: Buffer.from('same') });
  assert.equal(a.status, 201);
  assert.match(a.json.item.image, /^images\/flat\/\d+\.webp$/);
  const dup = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=wall&name=1.png', ...authed(), body: Buffer.from('same') });
  assert.equal(dup.status, 409); assert.ok(dup.json.duplicateOf);
  for (const p of gh.files().keys()) assert.ok(!p.includes('workflows'), p);
});

test('upload: numeric filename that is taken gets the next free number (no overwrite)', async () => {
  const r = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=wall&name=002.jpg', ...authed(), body: Buffer.from('new-wall') });
  assert.equal(r.json.item.id, '3');
  assert.equal(gh.files().get('images/wall/002.webp').toString(), 'oldwall');
});

test('upload: 6 files concurrently + a foreign commit mid-flight -> all land, none lost', async () => {
  gh.state.failNextRefUpdate = 2;
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => call(H('admin/upload.js'), { method: 'POST', url: `/u?category=ceiling&name=n${i}.jpg`, ...authed(), body: Buffer.from('img' + i) })));
  assert.deepEqual(rs.map((r) => r.status), Array(6).fill(201), JSON.stringify(rs.map((r) => r.json)));
  const data = JSON.parse(gh.text('data.json'));
  assert.equal(data.length, 3 + 6);
  assert.equal(new Set(data.filter((d) => d.category === 'ceiling').map((d) => d.id)).size, 7);
});

test('GitHub failure surfaces as a clean error and never leaks the token', async () => {
  global.fetch = async () => new Response('{"message":"Bad credentials ghp_TESTTOKEN"}', { status: 401 });
  const r = await call(H('admin/wallpapers.js'), { headers: { cookie } });
  assert.ok(r.status >= 400);
  assert.ok(!JSON.stringify(r).includes('ghp_TESTTOKEN'));
});

test('GitHub rate limit with long reset -> 429 with Retry-After, no hang', async () => {
  global.fetch = async () => new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) } });
  const t0 = Date.now();
  const r = await call(H('admin/wallpapers.js'), { headers: { cookie } });
  assert.equal(r.status, 429); assert.ok(r.headers['retry-after']); assert.ok(Date.now() - t0 < 2000);
});

test('transient 5xx is retried and then succeeds', async () => {
  let n = 0;
  const real = global.fetch;
  global.fetch = (u, i) => (++n <= 2 ? Promise.resolve(new Response('oops', { status: 502 })) : real(u, i));
  const r = await call(H('admin/wallpapers.js'), { headers: { cookie } });
  assert.equal(r.status, 200); assert.equal(r.json.items.length, 3);
});

test('edit title (sanitized) & duplicate IDs across categories stay addressable by category/id', async () => {
  const r = await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'ceiling/002', title: '  Royal <b>Gold</b>  ' } });
  assert.equal(r.status, 200); assert.equal(r.json.item.title, 'Royal bGold/b');
  const data = JSON.parse(gh.text('data.json'));
  assert.equal(data.find((d) => d.category === 'wall' && d.id === '002').title, 'Wall 002');
  assert.equal((await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'wall/999', title: 'x' } })).status, 404);
  assert.equal((await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: '../etc/passwd', title: 'x' } })).status, 400);
});

test('category change: file moves by re-pointing the blob, old path removed, record + counters follow', async () => {
  await store.pipeline([['HINCRBY', 'wp:views', 'wall/002', 7], ['HINCRBY', 'wp:wa', 'wall/002', 2]]);
  const sha = gh.blobSha('images/wall/002.webp');
  const r = await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'wall/002', category: 'flat' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.item.category, 'flat');
  assert.ok(gh.has(r.json.item.image) && !gh.has('images/wall/002.webp') && !gh.has('thumbs/wall/002.webp'));
  assert.equal(gh.blobSha(r.json.item.image), sha); // same blob, nothing re-uploaded
  const list = await call(H('admin/wallpapers.js'), { headers: { cookie } });
  const moved = list.json.items.find((i) => i.category === 'flat' && i.id === r.json.item.id);
  assert.equal(moved.views, 7); assert.equal(moved.whatsappClicks, 2);
});

test('bulk delete requires confirmation, caps batch size, removes files + records in one commit', async () => {
  const noConfirm = await call(H('admin/bulk.js'), { method: 'POST', ...authed(), body: { action: 'delete', keys: ['wall/002'] } });
  assert.equal(noConfirm.status, 400);
  const tooMany = await call(H('admin/bulk.js'), { method: 'POST', ...authed(), body: { action: 'delete', confirm: true, keys: Array.from({ length: 40 }, (_, i) => `wall/${i}`) } });
  assert.equal(tooMany.status, 400);
  const before = gh.state.log.length;
  const r = await call(H('admin/bulk.js'), { method: 'POST', ...authed(), body: { action: 'delete', confirm: true, keys: ['wall/002', 'ceiling/002', 'flat/404'] } });
  assert.equal(r.status, 200); assert.deepEqual(r.json.done.sort(), ['ceiling/002', 'wall/002']); assert.deepEqual(r.json.skipped, ['flat/404']);
  assert.equal(gh.state.log.length, before + 1);
  assert.ok(!gh.has('images/wall/002.webp') && !gh.has('thumbs/wall/002.webp') && !gh.has('images/ceiling/002.jpg'));
  assert.deepEqual(JSON.parse(gh.text('data.json')).map((d) => d.id), ['5']);
});

test('bulk category change keeps both 002 records distinct', async () => {
  const r = await call(H('admin/bulk.js'), { method: 'POST', ...authed(), body: { action: 'category', category: 'flat', keys: ['wall/002', 'ceiling/002'] } });
  assert.equal(r.status, 200);
  const flats = JSON.parse(gh.text('data.json')).filter((d) => d.category === 'flat');
  assert.equal(flats.length, 3); assert.equal(new Set(flats.map((f) => f.id)).size, 3);
  for (const f of flats) assert.ok(gh.has(f.image) || f.id === '5', f.image);
});

test('track: counts visits/views/whatsapp; analytics is admin-only; bad input rejected', async () => {
  const T = H('track.js');
  assert.equal((await call(T, { method: 'POST', body: { type: 'visit' } })).status, 204);
  assert.equal((await call(T, { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' }, body: { type: 'visit' } })).status, 204);
  await call(T, { method: 'POST', body: { type: 'view', id: '002', category: 'wall' } });
  await call(T, { method: 'POST', body: { type: 'wa', id: '002', category: 'wall', source: 'preview' } });
  await call(T, { method: 'POST', body: { type: 'wa', id: '5', category: 'flat', source: 'card' } });
  assert.equal((await call(T, { method: 'POST', body: { type: 'wa', id: '../x', category: 'wall' } })).status, 400);
  assert.equal((await call(T, { method: 'POST', body: { type: 'wa', id: '1', category: 'hack' } })).status, 400);
  assert.equal((await call(T, { method: 'POST', body: { type: 'zzz' } })).status, 400);
  assert.equal((await call(T, { method: 'GET' })).status, 405);
  assert.equal((await call(H('admin/analytics.js'), {})).status, 401);
  const a = await call(H('admin/analytics.js'), { headers: { cookie } });
  assert.equal(a.status, 200);
  assert.equal(a.json.totals.pageViews, 2); assert.equal(a.json.totals.whatsapp, 2); assert.equal(a.json.visitors.today, 2);
  assert.deepEqual(a.json.topOrdered.map((x) => x.key).sort(), ['flat/5', 'wall/002']);
  assert.equal(a.json.topViewed[0].key, 'wall/002');
  assert.equal(a.json.daily.length, 30); assert.equal(a.json.categories.whatsapp.wall, 1);
  assert.ok(!JSON.stringify(a.json).includes('10.0.0.1')); // no raw IPs stored/returned
});

test('audit log records admin actions', async () => {
  await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'wall/002', title: 'Audit me' } });
  const r = await call(H('admin/audit.js'), { headers: { cookie } });
  assert.equal(r.json.entries[0].action, 'edit');
});
