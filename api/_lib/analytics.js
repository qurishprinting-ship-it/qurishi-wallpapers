'use strict';
const store = require('./store');

// Afghanistan time (UTC+4:30) so "today" matches the owner's day.
const KABUL_MS = 4.5 * 3600e3;
const dayKey = (offset = 0, now = Date.now()) => new Date(now + KABUL_MS - offset * 86400e3).toISOString().slice(0, 10);

async function audit(actor, action, detail = '') {
  try {
    const entry = JSON.stringify({ t: new Date().toISOString(), actor, action, detail: String(detail).slice(0, 200) });
    await store.pipeline([['LPUSH', 'audit', entry], ['LTRIM', 'audit', 0, 499]]);
  } catch (e) { console.error('[audit] failed:', e.message); }
}

async function moveCounters(fromKey, toKey) {
  try {
    const [v, w] = await store.pipeline([['HGETALL', 'wp:views'], ['HGETALL', 'wp:wa']]);
    const cmds = [];
    const vo = store.toObject(v), wo = store.toObject(w);
    if (vo[fromKey]) cmds.push(['HINCRBY', 'wp:views', toKey, vo[fromKey]], ['HDEL', 'wp:views', fromKey]);
    if (wo[fromKey]) cmds.push(['HINCRBY', 'wp:wa', toKey, wo[fromKey]], ['HDEL', 'wp:wa', fromKey]);
    await store.pipeline(cmds);
  } catch (e) { console.error('[analytics] moveCounters failed:', e.message); }
}

module.exports = { dayKey, audit, moveCounters };
