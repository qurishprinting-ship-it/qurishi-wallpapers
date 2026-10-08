'use strict';
const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (status === 204 || body === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readRaw(req, limit) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw new HttpError(413, 'Request body too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limit = 64 * 1024) {
  const raw = await readRaw(req, limit);
  if (!raw.length) return {};
  try {
    const v = JSON.parse(raw.toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function shortHash(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Wraps a handler: method check + uniform error handling. Never leaks stack traces or secrets.
function route(methods, handler) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        return send(res, 405, { error: 'Method not allowed' }, { Allow: methods.join(', ') });
      }
      await handler(req, res);
    } catch (e) {
      if (e instanceof HttpError) {
        const headers = e.extra.retryAfter ? { 'Retry-After': String(e.extra.retryAfter) } : {};
        return send(res, e.status, { error: e.message, ...e.extra }, headers);
      }
      console.error('[api] unexpected error:', e && e.message ? e.message.replace(/ghp_\w+|github_pat_\w+/g, '[redacted]') : 'unknown');
      send(res, 500, { error: 'Internal server error' });
    }
  };
}

const noBody = { api: { bodyParser: false } };

module.exports = { HttpError, send, readRaw, readJson, query, clientIp, shortHash, parseCookies, route, noBody };
