'use strict';
const { Readable } = require('stream');
const crypto = require('crypto');

// Minimal in-memory GitHub (Git Data API subset) so the real commit logic is exercised without network.
function fakeGitHub(initial = {}) {
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
  const putBlob = (buf) => { const s = sha(buf); blobs.set(s, buf); return s; };
  const files0 = new Map(Object.entries(initial).map(([p, c]) => [p, putBlob(Buffer.from(c))]));
  const t0 = sha(Buffer.from('t0'));
  trees.set(t0, files0);
  const c0 = sha(Buffer.from('c0'));
  commits.set(c0, { tree: t0, parents: [] });
  const state = { head: c0, log: [], calls: 0, failNextRefUpdate: 0 };
  const headFiles = () => trees.get(commits.get(state.head).tree);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

  const fetchImpl = async (url, init = {}) => {
    state.calls++;
    const u = new URL(url);
    const m = u.pathname.replace(/^\/repos\/[^/]+\/[^/]+/, '');
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    if (!String(init.headers && init.headers.Authorization).startsWith('Bearer ')) return json({ message: 'no auth' }, 401);
    let r;
    if (method === 'GET' && (r = m.match(/^\/git\/ref\/heads\/(.+)$/))) return json({ object: { sha: state.head } });
    if (method === 'GET' && (r = m.match(/^\/git\/commits\/(\w+)$/))) return json({ tree: { sha: commits.get(r[1]).tree } });
    if (method === 'GET' && (r = m.match(/^\/git\/trees\/(\w+)$/))) {
      return json({ truncated: false, tree: [...trees.get(r[1])].map(([path, s]) => ({ path, sha: s, type: 'blob' })) });
    }
    if (method === 'GET' && m.startsWith('/contents/')) {
      const p = decodeURIComponent(m.slice('/contents/'.length));
      const ref = u.searchParams.get('ref');
      const files = trees.get(commits.get(commits.has(ref) ? ref : state.head).tree);
      return files.has(p) ? new Response(blobs.get(files.get(p))) : json({ message: 'Not Found' }, 404);
    }
    if (method === 'POST' && m === '/git/blobs') return json({ sha: putBlob(Buffer.from(body.content, 'base64')) }, 201);
    if (method === 'POST' && m === '/git/trees') {
      const next = new Map(trees.get(body.base_tree));
      for (const e of body.tree) {
        if (e.sha === null) { if (!next.has(e.path)) return json({ message: 'path not found' }, 422); next.delete(e.path); }
        else next.set(e.path, e.sha);
      }
      const s = sha(Buffer.from(JSON.stringify([...next]) + Math.random()));
      trees.set(s, next);
      return json({ sha: s }, 201);
    }
    if (method === 'POST' && m === '/git/commits') {
      const s = sha(Buffer.from(JSON.stringify(body) + Math.random()));
      commits.set(s, { tree: body.tree, parents: body.parents, message: body.message });
      return json({ sha: s }, 201);
    }
    if (method === 'PATCH' && m.startsWith('/git/refs/heads/')) {
      if (state.failNextRefUpdate > 0) { state.failNextRefUpdate--; return json({ message: 'Update is not a fast forward' }, 422); }
      if (commits.get(body.sha).parents[0] !== state.head) return json({ message: 'Update is not a fast forward' }, 422);
      state.head = body.sha;
      state.log.push(commits.get(body.sha).message);
      return json({ ok: true });
    }
    return json({ message: `unhandled ${method} ${m}` }, 500);
  };
  return {
    fetchImpl, state,
    files: () => new Map([...headFiles()].map(([p, s]) => [p, blobs.get(s)])),
    text: (p) => (headFiles().has(p) ? blobs.get(headFiles().get(p)).toString('utf8') : null),
    has: (p) => headFiles().has(p),
    blobSha: (p) => headFiles().get(p),
    // simulates a commit made by someone else (e.g. GitHub web UI) between our read and write
    externalCommit(path, content) {
      const files = new Map(headFiles()); files.set(path, putBlob(Buffer.from(content)));
      const ts = sha(Buffer.from('ext' + Math.random())); trees.set(ts, files);
      const cs = sha(Buffer.from('extc' + Math.random())); commits.set(cs, { tree: ts, parents: [state.head], message: 'external' });
      state.head = cs;
    },
  };
}

function mockReq({ method = 'GET', url = '/', headers = {}, body } = {}) {
  const data = body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const req = Readable.from(data);
  req.method = method; req.url = url;
  req.headers = { host: 'example.test', ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
  req.socket = { remoteAddress: '10.0.0.1' };
  return req;
}

async function call(handler, opts) {
  const req = mockReq(opts);
  const res = { headers: {}, statusCode: 200, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body += b || ''; this.done = true; } };
  await handler(req, res);
  let json = null;
  try { json = res.body ? JSON.parse(res.body) : null; } catch { /* not json */ }
  return { status: res.statusCode, headers: res.headers, json };
}

module.exports = { fakeGitHub, call, mockReq };
