'use strict';
// Pure gallery/metadata logic (no I/O) — unit tested.
const { CATEGORIES } = require('./config');
const { HttpError } = require('./http');

const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const keyOf = (category, id) => `${category}/${id}`;

function parseKey(key) {
  const m = /^(wall|ceiling|flat)\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,63})$/.exec(String(key));
  if (!m) throw new HttpError(400, 'Invalid wallpaper key');
  return { category: m[1], id: m[2] };
}

function assertCategory(c) {
  if (!CATEGORIES.includes(c)) throw new HttpError(400, 'Invalid category');
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

function titleFor(category, id) {
  return `${category[0].toUpperCase()}${category.slice(1)} ${id}`;
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

module.exports = { locate, ID_RE, keyOf, parseKey, assertCategory, sanitizeStem, cleanTitle, paths, chooseId, titleFor, aspectOf, publicRecord, mergeCounts, sortItems };
