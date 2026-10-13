'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { fakeGitHub, call } = require('./helpers');

process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.ADMIN_USERNAME = 'admin';
process.env.GITHUB_OWNER = 'o'; process.env.GITHUB_REPO = 'r'; process.env.GITHUB_TOKEN = 'ghp_TESTTOKEN';
process.env.ALLOW_INSECURE_COOKIE = '1';
process.env.ALLOW_MEMORY_PASSWORD_STORE = '1';

const optPath = require.resolve('../api/_lib/optimize.js');
require.cache[optPath] = { id: optPath, filename: optPath, loaded: true, exports: { optimize: async (buf) => ({
  full: { buffer: Buffer.from('FULL' + buf), width: 900, height: 1600, size: 40000, quality: 74 }, thumb: { buffer: Buffer.from('THUMB' + buf), width: 270, height: 480, size: 9000 },
  original: { format: 'jpeg', width: 3000, height: 5000, size: buf.length }, hash: require('crypto').createHash('sha256').update(buf).digest('hex').slice(0, 32) }) } };

const auth = require('../api/_lib/auth');
const store = require('../api/_lib/store');
const known = require('../api/_lib/categories');
const O = require('../shared/order');
const T = require('../shared/theme');
const H = (f) => require(path.join('../api', f));
let gh, cookie, csrf;
const seed = JSON.stringify([
  { id: '1', title: 'Wall 1', category: 'wall' }, { id: '2', title: 'Wall 2', category: 'wall' }, { id: '3', title: 'Wall 3', category: 'wall' },
  { id: '465 1f', title: 'Flat 465 1f', category: 'flat' }, { id: '9', title: 'Flat 9', category: 'flat' },
]);
const files = () => ({ 'data.json': seed, 'images/wall/1.webp': 'w1', 'images/wall/2.webp': 'w2', 'images/wall/3.jpg': 'w3', 'images/flat/465 1f.jpg': 'f465', 'images/flat/9.webp': 'f9', 'thumbs/wall/1.webp': 't1' });
const authed = (extra = {}) => ({ headers: { cookie, 'x-csrf-token': csrf, ...extra } });
const data = () => JSON.parse(gh.text('data.json'));
const settings = () => JSON.parse(gh.text('settings.json'));
const post = (f, body, method = 'POST', url = '/x') => call(H(`admin/${f}.js`), { method, url, ...authed(), body });
const sorted = (cat) => O.sortItems(data().filter((i) => i.category === cat)).map((i) => i.id);

beforeEach(async () => {
  store._mem.kv.clear(); store._mem.exp.clear(); known.invalidate();
  gh = fakeGitHub(files());
  global.fetch = (u, i) => (String(u).startsWith('https://api.github.com') ? gh.fetchImpl(u, i) : Promise.reject(new Error('unexpected network ' + u)));
  process.env.ADMIN_PASSWORD_HASH = await auth.hashPassword('correct horse');
  const s = auth.createSession('admin'); cookie = `qw_session=${encodeURIComponent(s.token)}`; csrf = s.payload.csrf;
});

// ---------- pure libraries ----------
test('order rule: featured first, then order, legacy untouched, stable', () => {
  const legacy = [{ id: 'a', category: 'x' }, { id: 'b', category: 'x' }, { id: 'c', category: 'x' }];
  assert.deepEqual(O.sortItems(legacy).map((i) => i.id), ['a', 'b', 'c']); // legacy order preserved
  const mixed = [{ id: 'a', category: 'x', order: 2 }, { id: 'b', category: 'x', order: 0 }, { id: 'c', category: 'x', order: 1, featured: true }];
  assert.deepEqual(O.sortItems(mixed).map((i) => i.id), ['c', 'b', 'a']);
  const n = O.normalize(legacy); assert.deepEqual(n.map((i) => i.order), [0, 1, 2]);
  assert.deepEqual(O.sortItems(n).map((i) => i.id), ['a', 'b', 'c']); // normalising never changes what visitors see
  const all = [{ id: 'w1', category: 'wall', order: 0 }, { id: 'w2', category: 'wall', order: 1 }, { id: 'f1', category: 'flat', order: 0 }, { id: 'f2', category: 'flat', order: 1, featured: true }];
  assert.deepEqual(O.sortItems(all, { wall: 0, flat: 1 }).map((i) => i.id), ['f2', 'w1', 'f1', 'w2']);
});

test('order helpers: applySequence, appendToCategory, setFeatured', () => {
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, category: 'x' })).concat([{ id: 'z', category: 'y' }]);
  const seq = O.applySequence(items, 'x', [{ id: 'c' }, { id: 'a', featured: true }, { id: 'ghost' }]);
  assert.deepEqual(O.sortItems(seq.filter((i) => i.category === 'x')).map((i) => i.id), ['a', 'c', 'b', 'd']); // a featured first; unlisted keep relative order after
  assert.equal(seq.find((i) => i.id === 'z').order, 0);
  const f = O.setFeatured(items, 'x', 'd', true);
  assert.equal(O.sortItems(f.filter((i) => i.category === 'x'))[0].id, 'd');
  assert.equal(O.setFeatured(f, 'x', 'd', false).find((i) => i.id === 'd').featured, undefined);
  const moved = O.appendToCategory(items.map((i) => (i.id === 'a' ? { ...i, category: 'y' } : i)), 'y', ['a']);
  assert.deepEqual(O.sortItems(moved.filter((i) => i.category === 'y')).map((i) => i.id), ['z', 'a']);
});

test('theme: default token, hex parsing, readable text for any colour', () => {
  assert.equal(T.DEFAULT_PRIMARY, '#121efb');
  assert.equal(T.normalizeHex('ABC'), '#aabbcc'); assert.equal(T.normalizeHex('#121EFB'), '#121efb');
  for (const bad of ['', 'red', '#12', '#12345g', null, 42, 'javascript:1']) assert.equal(T.normalizeHex(bad), null, String(bad));
  for (const c of ['#121efb', '#ffffff', '#000000', '#ffeb3b', '#7f7f7f', '#e91e63']) {
    const t = T.tokens(c);
    assert.ok(t.contrast.textOnDark >= 4.4 || t.onDark === '#ffffff', `${c} on dark ${t.contrast.textOnDark}`);
    assert.ok(t.contrast.textOnLight >= 4.4, `${c} on light ${t.contrast.textOnLight}`);
    assert.ok(t.contrast.buttonText >= 4.4, `${c} button ${t.contrast.buttonText}`);
  }
});

// ---------- categories ----------
test('categories: defaults, create (incl. Pashto name), edit, hide, reorder; new category usable for upload', async () => {
  let r = await call(H('admin/categories.js'), { headers: { cookie } });
  assert.deepEqual(r.json.categories.map((c) => [c.slug, c.count]), [['wall', 3], ['ceiling', 0], ['flat', 2]]);
  r = await post('categories', { name: 'Kids Room', names: { ps: 'د ماشومانو خونه' } });
  assert.equal(r.status, 201, JSON.stringify(r.json)); assert.equal(r.json.category.slug, 'kids-room');
  const ps = await post('categories', { name: 'نوی' }); assert.match(ps.json.category.slug, /^cat-[a-z0-9]+$/);
  assert.equal((await post('categories', { name: '   ' })).status, 400);
  assert.equal((await post('categories', { name: 'Wall' })).json.category.slug, 'wall-2'); // never collides
  assert.equal(settings().categories.length, 6);
  const up = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=kids-room&name=77.jpg', ...authed(), body: Buffer.from('kid') });
  assert.equal(up.status, 201); assert.equal(up.json.item.title, 'Kids Room 77'); assert.ok(gh.has('images/kids-room/77.webp'));
  assert.equal((await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=nope&name=1.jpg', ...authed(), body: Buffer.from('x') })).status, 400);

  r = await post('categories', { slug: 'kids-room', name: 'Kids', enabled: false }, 'PATCH');
  assert.equal(r.status, 200); assert.equal(settings().categories.find((c) => c.slug === 'kids-room').enabled, false);
  assert.ok(gh.has('images/kids-room/77.webp')); // renaming/hiding never moves files
  r = await post('categories', { slugs: ['flat', 'kids-room', 'wall'] }, 'PUT');
  assert.deepEqual(settings().categories.map((c) => c.slug).slice(0, 3), ['flat', 'kids-room', 'wall']);
  // cannot hide everything
  for (const c of settings().categories.filter((c) => c.enabled && c.slug !== 'flat')) await post('categories', { slug: c.slug, enabled: false }, 'PATCH');
  assert.equal((await post('categories', { slug: 'flat', enabled: false }, 'PATCH')).status, 400);
});

test('categories: delete needs confirmation, built-ins are protected, designs are reassigned (never silently deleted)', async () => {
  await post('categories', { name: 'Gold' });
  await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=gold&name=5.jpg', ...authed(), body: Buffer.from('g1') });
  const del = (q) => call(H('admin/categories.js'), { method: 'DELETE', url: '/api/admin/categories?' + q, ...authed() });
  assert.equal((await del('slug=gold')).status, 400);                         // no confirmation
  assert.equal((await del('slug=wall&confirm=1')).status, 400);               // built-in
  const need = await del('slug=gold&confirm=1');
  assert.equal(need.status, 409); assert.equal(need.json.count, 1); assert.equal(need.json.needsReassign, true);
  assert.equal((await del('slug=gold&confirm=1&reassignTo=gold')).status, 400);
  assert.equal((await del('slug=gold&confirm=1&reassignTo=missing')).status, 400);
  assert.ok(data().some((i) => i.category === 'gold')); // still there after refusals
  const ok = await del('slug=gold&confirm=1&reassignTo=flat');
  assert.equal(ok.status, 200, JSON.stringify(ok.json)); assert.equal(ok.json.moved, 1);
  assert.ok(!settings().categories.some((c) => c.slug === 'gold'));
  assert.equal(data().filter((i) => i.category === 'flat').length, 3);
  const moved = data().find((i) => i.title === 'Flat 5'); assert.ok(moved && gh.has(moved.image)); assert.ok(!gh.has('images/gold/5.webp'));
  assert.equal((await post('categories', { name: 'Empty' })).status, 201);
  assert.equal((await del('slug=empty&confirm=1')).status, 200); // empty category: no reassignment needed
});

test('categories: reassigning designs with spaces in their IDs works (legacy "465 1f")', async () => {
  await post('categories', { name: 'Gold' });
  const r = await post('bulk', { action: 'category', category: 'gold', keys: ['flat/465 1f'] });
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.deepEqual(r.json.done, ['flat/465 1f']);
  assert.ok(gh.has('images/gold/465 1f.jpg') && !gh.has('images/flat/465 1f.jpg'));
});

// ---------- featured + ordering ----------
test('featured + order: save sequence atomically, public rule applied, other categories untouched, spaced IDs ok', async () => {
  const before = JSON.stringify(data().filter((i) => i.category === 'flat'));
  const r = await post('order', { category: 'wall', order: [{ id: '3', featured: true }, { id: '1', featured: false }, { id: '2', featured: false }] });
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.featured, 1);
  assert.deepEqual(sorted('wall'), ['3', '1', '2']);
  assert.equal(gh.state.log.length, 1);
  const flat = await post('order', { category: 'flat', order: [{ id: '9' }, { id: '465 1f', featured: true }] });
  assert.equal(flat.status, 200); assert.deepEqual(sorted('flat'), ['465 1f', '9']);
  assert.notEqual(JSON.stringify(data().filter((i) => i.category === 'flat')), before);
  assert.deepEqual(sorted('wall'), ['3', '1', '2']); // wall unaffected by the flat save
  // order survives reload (read straight from the repo) and a stale/partial list cannot lose designs
  await post('order', { category: 'wall', order: [{ id: '2' }, { id: 'ghost' }] });
  assert.deepEqual(sorted('wall'), ['3', '2', '1'].filter((x) => x === '3').concat(['2', '1']));
  assert.equal(data().filter((i) => i.category === 'wall').length, 3);
  assert.equal((await post('order', { category: 'wall', order: [{ id: '../x' }] })).status, 400);
  assert.equal((await post('order', { category: 'nope', order: [] })).status, 400);
});

test('featured toggle via PATCH and bulk; new uploads lead their group; moves land at the end', async () => {
  await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'wall/2', featured: true } });
  assert.deepEqual(sorted('wall'), ['2', '1', '3']);
  assert.equal(data().find((i) => i.id === '2').featured, true);
  await post('bulk', { action: 'feature', keys: ['flat/9', 'flat/465 1f'] });
  assert.equal(data().filter((i) => i.featured).length, 3);
  await post('bulk', { action: 'unfeature', keys: ['flat/9'] });
  assert.equal(data().find((i) => i.category === 'flat' && i.id === '9').featured, undefined);
  const up = await call(H('admin/upload.js'), { method: 'POST', url: '/u?category=wall&name=50.jpg', ...authed(), body: Buffer.from('new') });
  assert.equal(up.status, 201); assert.deepEqual(sorted('wall'), ['2', '50', '1', '3']); // featured stays on top, newest leads the rest
  await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'wall/1', category: 'flat' } });
  const flat = sorted('flat'); assert.equal(flat[flat.length - 1], '1');
  assert.equal((await call(H('admin/wallpapers.js'), { method: 'PATCH', ...authed(), body: { key: 'wall/2', featured: 'yes' } })).status, 400);
});

// ---------- theme ----------
test('theme: save, validate, restore default; public settings.json readable without secrets', async () => {
  let r = await call(H('admin/settings.js'), { headers: { cookie } });
  assert.equal(r.json.settings.theme.primary, '#121efb'); assert.equal(r.json.defaultPrimary, '#121efb');
  assert.equal((await post('settings', { primary: 'blue' }, 'PUT')).status, 400);
  assert.equal((await post('settings', { primary: '#12' }, 'PUT')).status, 400);
  r = await post('settings', { primary: '#E91E63' }, 'PUT'); assert.equal(r.status, 200);
  assert.equal(settings().theme.primary, '#e91e63');
  assert.ok(!gh.text('settings.json').match(/token|password|secret|hash/i));
  assert.equal((await call(H('admin/settings.js'), { headers: { cookie } })).json.settings.theme.primary, '#e91e63');
  const commits = gh.state.log.length;
  await post('settings', { primary: '#e91e63' }, 'PUT'); assert.equal(gh.state.log.length, commits); // unchanged => no empty commit
  r = await post('settings', { restoreDefault: true }, 'PUT'); assert.equal(settings().theme.primary, '#121efb');
});

test('settings.json damaged => writes refuse instead of overwriting; reads fall back to defaults', async () => {
  gh = fakeGitHub({ ...files(), 'settings.json': '{ not json' });
  global.fetch = (u, i) => gh.fetchImpl(u, i);
  assert.equal((await post('settings', { primary: '#000000' }, 'PUT')).status, 500);
  assert.equal(gh.text('settings.json'), '{ not json');
  assert.equal((await call(H('admin/settings.js'), { headers: { cookie } })).json.settings.categories.length, 3);
});

// ---------- password ----------
test('password change: validation, current password required, persists, old sessions revoked, env password still the fallback', async () => {
  const pw = (b) => post('password', b);
  assert.equal((await pw({ currentPassword: 'wrong', newPassword: 'a-long-new-pass', confirmPassword: 'a-long-new-pass' })).status, 403);
  assert.equal((await pw({ currentPassword: 'correct horse', newPassword: 'short', confirmPassword: 'short' })).status, 400);
  assert.equal((await pw({ currentPassword: 'correct horse', newPassword: 'a-long-new-pass', confirmPassword: 'different-one-x' })).status, 400);
  assert.equal((await pw({ currentPassword: 'correct horse', newPassword: 'correct horse', confirmPassword: 'correct horse' })).status, 400);
  assert.equal((await pw({ currentPassword: '', newPassword: 'a-long-new-pass', confirmPassword: 'a-long-new-pass' })).status, 400);
  // nothing changed yet: old password still logs in
  store._mem.kv.clear();
  assert.equal((await call(H('admin/login.js'), { method: 'POST', body: { username: 'admin', password: 'correct horse' } })).status, 200);

  const oldCookie = cookie;
  await new Promise((r) => setTimeout(r, 1100)); // iat has 1-second resolution
  const ok = await pw({ currentPassword: 'correct horse', newPassword: 'a-long-new-pass', confirmPassword: 'a-long-new-pass' });
  assert.equal(ok.status, 200, JSON.stringify(ok.json)); assert.ok(ok.json.csrf); assert.match(ok.headers['set-cookie'], /HttpOnly/);
  assert.ok(!JSON.stringify(ok).includes('a-long-new-pass'));
  const stored = await store.cmd('GET', 'admin:pw'); assert.ok(stored.includes('scrypt$') && !stored.includes('a-long-new-pass'));
  assert.equal((await call(H('admin/me.js'), { headers: { cookie: oldCookie } })).status, 401);              // old session revoked
  assert.equal((await call(H('admin/me.js'), { headers: { cookie: ok.headers['set-cookie'].split(';')[0] } })).status, 200); // new one works
  store._mem.exp.clear(); for (const k of [...store._mem.kv.keys()]) if (k.startsWith('rl:')) store._mem.kv.delete(k);
  assert.equal((await call(H('admin/login.js'), { method: 'POST', body: { username: 'admin', password: 'correct horse' } })).status, 401);
  assert.equal((await call(H('admin/login.js'), { method: 'POST', body: { username: 'admin', password: 'a-long-new-pass' } })).status, 200);
  // recovery: deleting the stored override restores the original (environment) password
  await store.cmd('DEL', 'admin:pw'); store._mem.kv.forEach((_, k) => k.startsWith('rl:') && store._mem.kv.delete(k));
  assert.equal((await call(H('admin/login.js'), { method: 'POST', body: { username: 'admin', password: 'correct horse' } })).status, 200);
});

test('password change refused without persistent storage in production; rate limited; needs login + CSRF', async () => {
  const prev = process.env.ALLOW_MEMORY_PASSWORD_STORE; delete process.env.ALLOW_MEMORY_PASSWORD_STORE;
  const r = await post('password', { currentPassword: 'correct horse', newPassword: 'a-long-new-pass', confirmPassword: 'a-long-new-pass' });
  assert.equal(r.status, 503); process.env.ALLOW_MEMORY_PASSWORD_STORE = prev;
  assert.equal((await call(H('admin/password.js'), { method: 'POST', body: {} })).status, 401);
  assert.equal((await call(H('admin/password.js'), { method: 'POST', headers: { cookie }, body: {} })).status, 403);
  let last; for (let i = 0; i < 7; i++) last = await post('password', { currentPassword: 'bad' + i, newPassword: 'a-long-new-pass', confirmPassword: 'a-long-new-pass' });
  assert.equal(last.status, 429);
});

test('every NEW admin endpoint refuses unauthenticated requests and writes nothing', async () => {
  for (const [f, m] of [['settings', 'GET'], ['settings', 'PUT'], ['categories', 'GET'], ['categories', 'POST'], ['categories', 'PATCH'], ['categories', 'PUT'], ['categories', 'DELETE'], ['order', 'POST'], ['password', 'POST']]) {
    const r = await call(H(`admin/${f}.js`), { method: m, url: '/x?slug=wall&confirm=1', body: m === 'GET' || m === 'DELETE' ? undefined : '{}' });
    assert.equal(r.status, 401, `${f} ${m}`);
  }
  assert.equal(gh.state.log.length, 0);
});

test('track accepts designs with spaces and new categories, rejects unknown ones', async () => {
  await post('categories', { name: 'Gold' }); known.invalidate();
  const T2 = H('track.js');
  assert.equal((await call(T2, { method: 'POST', body: { type: 'view', id: '465 1f', category: 'flat' } })).status, 204);
  assert.equal((await call(T2, { method: 'POST', body: { type: 'view', id: '1', category: 'gold' } })).status, 204);
  assert.equal((await call(T2, { method: 'POST', body: { type: 'view', id: '1', category: 'hack' } })).status, 400);
});

// ---------- Vercel Hobby plan: at most 12 serverless functions ----------
test('deployable serverless functions stay within the Hobby limit (12)', () => {
  const fs = require('fs');
  const root = path.join(__dirname, '..', 'api');
  const fns = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('_') || e.name.startsWith('.')) continue; // Vercel ignores _-prefixed files/folders (helpers)
      if (e.isDirectory()) walk(path.join(dir, e.name), rel + e.name + '/');
      else if (/\.(js|mjs|cjs|ts)$/.test(e.name)) fns.push(rel + e.name);
    }
  };
  walk(root, '');
  assert.ok(fns.length <= 12, `${fns.length} functions: ${fns.join(', ')}`);
  assert.ok(!fns.includes('admin/audit.js'), 'audit is served by analytics.js?view=audit');
});

test('merged route: analytics?view=audit returns the audit log, plain analytics still returns stats; both need login', async () => {
  const A = H('admin/analytics.js');
  assert.equal((await call(A, { url: '/api/admin/analytics?view=audit' })).status, 401);
  assert.equal((await call(A, { url: '/api/admin/analytics' })).status, 401);
  await post('settings', { primary: '#e91e63' }, 'PUT'); // writes an audit entry
  const audit = await call(A, { url: '/api/admin/analytics?view=audit', headers: { cookie } });
  assert.equal(audit.status, 200); assert.ok(Array.isArray(audit.json.entries)); assert.equal(audit.json.entries[0].action, 'theme');
  assert.equal(audit.json.totals, undefined);
  const stats = await call(A, { url: '/api/admin/analytics', headers: { cookie } });
  assert.equal(stats.status, 200); assert.ok(stats.json.totals && stats.json.daily.length === 30); assert.equal(stats.json.entries, undefined);
  assert.equal((await call(A, { method: 'POST', url: '/api/admin/analytics?view=audit', ...authed(), body: {} })).status, 405);
});
