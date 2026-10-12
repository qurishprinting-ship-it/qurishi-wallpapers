'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../api/_lib/gallery');
const { assertSafePath } = require('../api/_lib/github');
const { dayKey } = require('../api/_lib/analytics');

test('sanitizeStem strips paths, dots, unicode tricks', () => {
  assert.equal(G.sanitizeStem('../../etc/passwd.jpg'), 'passwd');
  assert.equal(G.sanitizeStem('My Photo (3).JPG'), 'my-photo-3');
  assert.equal(G.sanitizeStem('..'), '');
  assert.equal(G.sanitizeStem('عکس.png'), '');
});

test('assertSafePath only allows the exact repo layout', () => {
  for (const ok of ['data.json', 'images/wall/1.webp', 'thumbs/flat/ab-c_1.webp', 'images/ceiling/002.jpg']) assert.equal(assertSafePath(ok), ok);
  for (const bad of ['../data.json', 'images/../data.json', 'images/wall/../x.webp', '.github/workflows/x.yml', 'images/other/1.webp', 'images/wall/1.php', 'images/wall/.webp', '/images/wall/1.webp', 'images/wall/1.webp\n', 'images//wall/1.webp', 'package.json', 'api/admin/me.js'])
    assert.throws(() => assertSafePath(bad), { status: 400 }, bad);
});

test('chooseId: keeps free numeric filename, keeps zero padding, else next number', () => {
  const items = [{ id: '10', category: 'wall' }, { id: '002', category: 'wall' }];
  assert.equal(G.chooseId(items, 'wall', '500.jpg'), '500');
  assert.equal(G.chooseId(items, 'wall', '10.jpg'), '11');
  assert.equal(G.chooseId(items, 'wall', 'IMG_2231.jpg'), '11');
  assert.equal(G.chooseId(items, 'flat', 'IMG.jpg'), '1');
  assert.equal(G.chooseId(items, 'wall', '500.jpg', (p) => p === 'images/wall/500.webp'), '11');
});

test('aspect ratio helper and parseKey', () => {
  assert.equal(G.aspectOf(1080, 1920), 0.5625); assert.equal(G.aspectOf(1920, 1080), 1.7778); assert.equal(G.aspectOf(1000, 1000), 1);
  assert.deepEqual(G.parseKey('flat/12'), { category: 'flat', id: '12' });
  assert.throws(() => G.parseKey('flat/../x'));
});

test('sortItems', () => {
  const items = [{ id: 'a', createdAt: '2026-01-01', views: 1, whatsappClicks: 9 }, { id: 'b', createdAt: '2026-02-01', views: 5, whatsappClicks: 0 }];
  assert.equal(G.sortItems(items, 'newest')[0].id, 'b'); assert.equal(G.sortItems(items, 'oldest')[0].id, 'a');
  assert.equal(G.sortItems(items, 'views')[0].id, 'b'); assert.equal(G.sortItems(items, 'orders')[0].id, 'a');
});

test('dayKey uses Afghanistan time (UTC+4:30)', () => {
  assert.equal(dayKey(0, Date.parse('2026-10-07T20:00:00Z')), '2026-10-08');
  assert.equal(dayKey(0, Date.parse('2026-10-07T19:00:00Z')), '2026-10-07');
});
