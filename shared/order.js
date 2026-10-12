/* shared/order.js — the ONE display-order rule used by the public site, the admin panel and the API.
 *
 * Within a category:   featured designs first, then ascending `order`, then original data.json position.
 * In the "All" view:   featured first, then ascending `order` (each design's position inside ITS category),
 *                      then the category's display rank, then data.json position.
 *                      => the best design of every category is shown first, then the second best, and so on.
 *
 * Designs that have no numeric `order` yet (legacy records, or files added by hand) are treated as
 * "before every ordered design, in their data.json order" — so an untouched legacy data.json keeps
 * exactly its old display order. Every admin action that depends on order first calls normalize(),
 * which writes explicit 0..n-1 positions without changing what visitors see.
 * The sort is total and stable (final tie-break = array position), so pagination never reshuffles.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QOrder = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const UNORDERED = -1e9;
  const isFeatured = (i) => i.featured === true;
  const effOrder = (i, idx) => (Number.isFinite(i.order) ? i.order : UNORDERED + idx);

  // Sort the designs of ONE category (or a mixed list when `catRank` is given) by the rule above.
  function sortItems(items, catRank) {
    const rows = items.map((item, idx) => ({ item, idx }));
    rows.sort((a, b) =>
      (isFeatured(b.item) - isFeatured(a.item)) ||
      (effOrder(a.item, a.idx) - effOrder(b.item, b.idx)) ||
      (catRank ? ((catRank[a.item.category] ?? 1e6) - (catRank[b.item.category] ?? 1e6)) : 0) ||
      (a.idx - b.idx));
    return rows.map((r) => r.item);
  }

  // Give every design a numeric `order` (0..n-1 per category) WITHOUT changing the current display order.
  // Returns a new array (same positions as the input); items are shallow-copied only when they change.
  function normalize(items) {
    const byCat = new Map();
    items.forEach((it, idx) => { if (!byCat.has(it.category)) byCat.set(it.category, []); byCat.get(it.category).push({ it, idx }); });
    const next = items.slice();
    for (const rows of byCat.values()) {
      rows.sort((a, b) => (effOrder(a.it, a.idx) - effOrder(b.it, b.idx)) || (a.idx - b.idx));
      rows.forEach((r, n) => { if (r.it.order !== n) next[r.idx] = { ...r.it, order: n }; });
    }
    return next;
  }

  // Apply an explicit sequence for one category: `seq` = [{ id, featured? }, ...] in the wanted order.
  // Designs not mentioned keep their relative order after the listed ones. Returns a new array.
  function applySequence(items, category, seq) {
    const norm = normalize(items);
    const inCat = norm.filter((i) => i.category === category);
    const byId = new Map(inCat.map((i) => [i.id, i]));
    const listed = [];
    const seen = new Set();
    for (const s of seq) {
      if (byId.has(s.id) && !seen.has(s.id)) { seen.add(s.id); listed.push(s); }
    }
    const rest = sortItems(inCat).filter((i) => !seen.has(i.id)).map((i) => ({ id: i.id }));
    const finalSeq = [...listed, ...rest];
    const pos = new Map(finalSeq.map((s, n) => [s.id, n]));
    const feat = new Map(listed.filter((s) => typeof s.featured === 'boolean').map((s) => [s.id, s.featured]));
    return norm.map((i) => {
      if (i.category !== category) return i;
      const out = { ...i, order: pos.get(i.id) };
      if (feat.has(i.id)) { if (feat.get(i.id)) out.featured = true; else delete out.featured; }
      return out;
    });
  }

  // Put designs at the END of their (new) category, keeping their relative order. Used after moves.
  function appendToCategory(items, category, ids) {
    const norm = normalize(items);
    const idSet = new Set(ids);
    const others = sortItems(norm.filter((i) => i.category === category && !idSet.has(i.id)));
    let n = others.length ? Math.max(...others.map((i) => i.order)) + 1 : 0;
    const moved = norm.filter((i) => i.category === category && idSet.has(i.id)).sort((a, b) => a.order - b.order);
    const pos = new Map(moved.map((i) => [i.id, n++]));
    return norm.map((i) => (i.category === category && pos.has(i.id) ? { ...i, order: pos.get(i.id) } : i));
  }

  // Put one design at the FRONT of its group (featured or not), used when featuring / un-featuring.
  function setFeatured(items, category, id, featured) {
    const norm = normalize(items);
    const target = norm.find((i) => i.category === category && i.id === id);
    if (!target) return items;
    const wantFeatured = !!featured;
    const group = norm.filter((i) => i.category === category && i.id !== id && isFeatured(i) === wantFeatured);
    const front = group.length ? Math.min(...group.map((i) => i.order)) - 1 : target.order;
    const res = norm.map((i) => {
      if (i.category !== category || i.id !== id) return i;
      const out = { ...i, order: front };
      if (wantFeatured) out.featured = true; else delete out.featured;
      return out;
    });
    return normalize(res);
  }

  return { sortItems, normalize, applySequence, appendToCategory, setFeatured, isFeatured, effOrder };
});
