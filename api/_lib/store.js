'use strict';
// Tiny key/value layer for analytics, rate limits and the audit log.
// Production: Upstash Redis (REST) — works from serverless, no dependency needed.
// Local/dev/test: in-memory fallback (NOT persistent; `persistent()` is false and shown in Admin > Settings).
const { env } = require('./config');

const mem = { kv: new Map(), exp: new Map() };

function memGet(key) {
  const e = mem.exp.get(key);
  if (e && e < Date.now()) { mem.kv.delete(key); mem.exp.delete(key); }
  return mem.kv.get(key);
}

function memExec(args) {
  const [op, key, ...rest] = args;
  const o = String(op).toUpperCase();
  switch (o) {
    case 'INCR': { const v = Number(memGet(key) || 0) + 1; mem.kv.set(key, v); return v; }
    case 'EXPIRE': { mem.exp.set(key, Date.now() + Number(rest[0]) * 1000); return 1; }
    case 'HINCRBY': {
      const h = memGet(key) || {}; h[rest[0]] = Number(h[rest[0]] || 0) + Number(rest[1]);
      mem.kv.set(key, h); return h[rest[0]];
    }
    case 'HGETALL': { const h = memGet(key) || {}; return Object.entries(h).flat().map(String); }
    case 'HDEL': { const h = memGet(key); if (h) delete h[rest[0]]; return 1; }
    case 'LPUSH': { const l = memGet(key) || []; l.unshift(...rest.map(String)); mem.kv.set(key, l); return l.length; }
    case 'LTRIM': { const l = memGet(key) || []; mem.kv.set(key, l.slice(Number(rest[0]), Number(rest[1]) + 1)); return 'OK'; }
    case 'LRANGE': { const l = memGet(key) || []; return l.slice(Number(rest[0]), Number(rest[1]) + 1); }
    case 'PFADD': { const s = memGet(key) || new Set(); rest.forEach((x) => s.add(x)); mem.kv.set(key, s); return 1; }
    case 'PFCOUNT': {
      const u = new Set();
      [key, ...rest].forEach((k) => (memGet(k) || new Set()).forEach((x) => u.add(x)));
      return u.size;
    }
    default: throw new Error(`memory store: unsupported ${o}`);
  }
}

const url = () => env('UPSTASH_REDIS_REST_URL');
const token = () => env('UPSTASH_REDIS_REST_TOKEN');
const persistent = () => Boolean(url() && token());

async function remote(path, body) {
  const res = await fetch(url() + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`store HTTP ${res.status}`);
  return res.json();
}

async function pipeline(cmds) {
  if (!cmds.length) return [];
  if (!persistent()) return cmds.map(memExec);
  const out = await remote('/pipeline', cmds);
  return out.map((r) => { if (r.error) throw new Error('store: ' + r.error); return r.result; });
}

async function cmd(...args) { return (await pipeline([args]))[0]; }

const toObject = (flat) => {
  const o = {};
  for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = Number(flat[i + 1]);
  return o;
};

// Fixed-window rate limiter. Returns {ok, retryAfter}. Fails open so a store outage never takes the site down;
// login uses `strict` to fail closed.
async function rateLimit(name, limit, windowSec, { strict = false } = {}) {
  try {
    const key = `rl:${name}`;
    const [n] = await pipeline([['INCR', key]]);
    if (n === 1) await cmd('EXPIRE', key, windowSec);
    return { ok: n <= limit, retryAfter: windowSec };
  } catch {
    return { ok: !strict, retryAfter: 30, degraded: true };
  }
}

module.exports = { cmd, pipeline, toObject, rateLimit, persistent, _mem: mem };
