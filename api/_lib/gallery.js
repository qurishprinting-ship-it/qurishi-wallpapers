'use strict';
// Pure gallery/metadata logic (no I/O) — unit tested.
const { SLUG_RE } = require('./config');
const { HttpError } = require('./http');

// Existing designs include IDs such as "465 1f" or "448 copy", so a single space (and a few harmless
// punctuation marks) is allowed. Slashes, dots and control characters never are => no path traversal.
const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9 _()+-]{0,63}$/;
const validId = (id) => typeof id === 'string' && ID_RE.test(id) && !/\s$/.test(id);
const keyOf = (category, id) => `${category}/${id}`;

function parseKey(key) {
  const s = String(key);
  const i = s.indexOf('/');
  const category = i > 0 ? s.slice(0, i) : '';
  const id = i > 0 ? s.slice(i + 1) : '';
  if (!SLUG_RE.test(category) || !validId(id)) throw new HttpError(400, 'Invalid wallpaper key');
  return { category, id };
}

// `known` = array of slugs from settings.json. Without it only the slug SHAPE is checked.
function assertCategory(c, known) {
  if (typeof c !== 'string' || !SLUG_RE.test(c) || (known && !known.includes(c))) throw new HttpError(400, 'Invalid category');
  return c;
}

// "My Photo (3).JPG" -> "my-photo-3"; never returns path separators, dots or unicode tricks.
function sanitizeStem(filename) {
  const base = String(filename || '').split(/[\\/]/).pop().replace(/\.[^.]*$/, '');
  return base.normalize('NFKD').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function cleanTitle(t) {
  // eslint-disable-next-line no-control-regex
  const s = String(t ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!s) throw new HttpError(400, 'Title cannot be empty');
  return s;
}

const paths = (category, id, ext = 'webp') => ({
  image: `images/${category}/${id}.${ext}`,
  thumbnail: `thumbs/${category}/${id}.webp`,
});

// Keep a numeric ID if the filename is numeric and free; otherwise next number in that category.
function chooseId(items, category, filename, pathTaken = () => false) {
  const taken = (id) => items.some((i) => i.category === category && i.id === id) || pathTaken(paths(category, id).image);
  const stem = sanitizeStem(filename);
  if (/^\d{1,6}$/.test(stem) && !taken(stem)) return stem;
  const nums = items.filter((i) => i.category === category && /^\d+$/.test(i.id)).map((i) => parseInt(i.id, 10));
  let n = (nums.length ? Math.max(...nums) : 0) + 1;
  while (taken(String(n))) n++;
  return String(n);
}

// Legacy records (original data.json) only have id/title/category: find the real files in the repo tree.
function locate(item, tree) {
  const exts = ['webp', 'jpg', 'jpeg', 'png'];
  let image = item.image && tree.has(item.image) ? item.image : null;
  if (!image) image = exts.map((e) => `images/${item.category}/${item.id}.${e}`).find((p) => tree.has(p)) || null;
  const thumb = item.thumbnail && tree.has(item.thumbnail) ? item.thumbnail : (tree.has(paths(item.category, item.id).thumbnail) ? paths(item.category, item.id).thumbnail : null);
  return { image, thumbnail: thumb };
}

// Default title shown for a design that was never renamed, e.g. "Wall 12".
function titleFor(name, id) {
  const n = String(name || '');
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${id}`;
}

function aspectOf(w, h) {
  return w && h ? Math.round((w / h) * 10000) / 10000 : null;
}

function publicRecord(r) {
  // Fields stored in data.json (counters live in the analytics store, not in git).
  const { views, whatsappClicks, ...rest } = r; // eslint-disable-line no-unused-vars
  return rest;
}

function mergeCounts(items, views, wa) {
  return items.map((i) => ({ ...i, views: views[keyOf(i.category, i.id)] || 0, whatsappClicks: wa[keyOf(i.category, i.id)] || 0 }));
}

function sortItems(items, sort) {
  const by = {
    newest: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    oldest: (a, b) => String(a.createdAt || '9').localeCompare(String(b.createdAt || '9')),
    views: (a, b) => b.views - a.views,
    orders: (a, b) => b.whatsappClicks - a.whatsappClicks,
  }[sort];
  return by ? [...items].sort(by) : items;
}

/**
 * Move designs to another category by RE-POINTING existing blobs (no image bytes are downloaded or re-uploaded).
 * Pure: returns { list, upserts, deletes, moves, done, skipped }. The caller commits and then fixes the order.
 * `nameOf(slug)` gives the English/base category name used to recognise un-renamed default titles.
 */
function moveItems(list, tree, keys, target, nameOf = (s) => s) {
  const upserts = [], deletes = [], moves = [], done = [], skipped = [];
  let cur = list;
  for (const { category, id } of keys) {
    const idx = cur.findIndex((i) => i.category === category && i.id === id);
    if (idx < 0 || category === target) { skipped.push(keyOf(category, id)); continue; }
    const item = cur[idx];
    const free = !cur.some((i) => i.category === target && i.id === id) && !tree.has(paths(target, id).image);
    const newId = free ? id : chooseId(cur, target, '', (p) => tree.has(p));
    const found = locate(item, tree);
    const to = paths(target, newId, found.image ? found.image.split('.').pop() : 'webp');
    for (const [from, dest] of [[found.image, to.image], [found.thumbnail, to.thumbnail]]) {
      if (from) { upserts.push({ path: dest, sha: tree.get(from) }); deletes.push(from); }
    }
    const generic = [nameOf(category), category].some((n) => String(item.title).toLowerCase() === titleFor(n, id).toLowerCase());
    cur = cur.slice();
    cur[idx] = { ...item, category: target, id: newId, image: to.image, thumbnail: to.thumbnail, title: generic ? titleFor(nameOf(target), newId) : item.title };
    moves.push({ from: keyOf(category, id), to: keyOf(target, newId), newId });
    done.push(keyOf(category, id));
  }
  return { list: cur, upserts, deletes, moves, done, skipped };
}

module.exports = { locate, ID_RE, validId, keyOf, parseKey, assertCategory, sanitizeStem, cleanTitle, paths, chooseId, titleFor, aspectOf, publicRecord, mergeCounts, sortItems, moveItems };
