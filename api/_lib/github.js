'use strict';
// GitHub integration (server-side only). Uses the Git Data API so a whole batch of changes
// (image + thumbnail + data.json, or a move/delete) lands as ONE atomic commit.
const { env } = require('./config');
const { HttpError } = require('./http');

const API = 'https://api.github.com';
// Only these exact path shapes may ever be written/deleted. No traversal, no arbitrary paths.
const SAFE_PATH = /^(?:data\.json|(?:images|thumbs)\/(?:wall|ceiling|flat)\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}\.(?:webp|jpg|jpeg|png|WEBP|JPG|JPEG|PNG))$/;

function assertSafePath(p) {
  if (typeof p !== 'string' || !SAFE_PATH.test(p)) throw new HttpError(400, 'Unsafe repository path');
  return p;
}

function cfg() {
  const c = { owner: env('GITHUB_OWNER'), repo: env('GITHUB_REPO'), branch: env('GITHUB_BRANCH', 'main'), token: env('GITHUB_TOKEN') };
  if (!c.owner || !c.repo || !c.token) throw new HttpError(503, 'GitHub is not configured (GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN)');
  if (!/^[\w.-]+$/.test(c.owner) || !/^[\w.-]+$/.test(c.repo) || !/^[\w./-]+$/.test(c.branch)) throw new HttpError(503, 'Invalid GitHub configuration');
  return c;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_WAIT_MS = 8000;

async function gh(method, path, body, { accept = 'application/vnd.github+json', raw = false } = {}) {
  const c = cfg();
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${API}/repos/${c.owner}/${c.repo}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${c.token}`,
          Accept: accept,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'qurishi-wallpapers-admin',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      lastErr = new HttpError(504, 'GitHub request timed out or failed');
      await sleep(400 * 2 ** attempt);
      continue;
    }
    if (res.ok) return raw ? Buffer.from(await res.arrayBuffer()) : res.status === 204 ? null : res.json();
    if (res.status === 404) return null;
    const remaining = res.headers.get('x-ratelimit-remaining');
    const retryAfter = Number(res.headers.get('retry-after') || 0);
    const limited = res.status === 429 || (res.status === 403 && (remaining === '0' || retryAfter > 0));
    if (limited) {
      const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000 - Date.now();
      const wait = retryAfter ? retryAfter * 1000 : reset > 0 ? reset : 2000;
      if (wait > MAX_WAIT_MS) throw new HttpError(429, 'GitHub rate limit reached. Try again in a few minutes.', { retryAfter: Math.ceil(wait / 1000) });
      await sleep(wait);
      lastErr = new HttpError(429, 'GitHub rate limit reached');
      continue;
    }
    if (res.status >= 500) { lastErr = new HttpError(502, 'GitHub is temporarily unavailable'); await sleep(400 * 2 ** attempt); continue; }
    const text = await res.text().catch(() => '');
    const err = new HttpError(res.status === 401 || res.status === 403 ? 502 : res.status, `GitHub error ${res.status}`);
    err.github = text.slice(0, 300);
    throw err;
  }
  throw lastErr || new HttpError(502, 'GitHub request failed');
}

/**
 * Read-modify-commit loop.
 * build(reader) returns { upserts: [{path, content?:Buffer|string, sha?:string}], deletes: [path], result }
 * `sha` reuses an existing blob (used for moves: no download/upload of image bytes).
 */
async function updateRepo(message, build) {
  const c = cfg();
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = await gh('GET', `/git/ref/heads/${c.branch}`);
    if (!ref) throw new HttpError(503, `Branch "${c.branch}" not found`);
    const headSha = ref.object.sha;
    const headCommit = await gh('GET', `/git/commits/${headSha}`);
    let treeMap;
    const reader = {
      async tree() {
        if (!treeMap) {
          const t = await gh('GET', `/git/trees/${headCommit.tree.sha}?recursive=1`);
          if (t && t.truncated) throw new HttpError(500, 'Repository tree too large');
          treeMap = new Map((t ? t.tree : []).filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));
        }
        return treeMap;
      },
      async readText(path) {
        const buf = await gh('GET', `/contents/${path}?ref=${headSha}`, null, { accept: 'application/vnd.github.raw+json', raw: true });
        return buf ? buf.toString('utf8') : null;
      },
    };
    const { upserts = [], deletes = [], result } = await build(reader);
    if (!upserts.length && !deletes.length) return { result, commit: null };

    const entries = [];
    for (const u of upserts) {
      assertSafePath(u.path);
      let sha = u.sha;
      if (!sha) {
        const content = Buffer.isBuffer(u.content) ? u.content : Buffer.from(String(u.content), 'utf8');
        const blob = await gh('POST', '/git/blobs', { content: content.toString('base64'), encoding: 'base64' });
        sha = blob.sha;
      }
      entries.push({ path: u.path, mode: '100644', type: 'blob', sha });
    }
    for (const d of deletes) entries.push({ path: assertSafePath(d), mode: '100644', type: 'blob', sha: null });

    const tree = await gh('POST', '/git/trees', { base_tree: headCommit.tree.sha, tree: entries });
    const commit = await gh('POST', '/git/commits', { message, tree: tree.sha, parents: [headSha] });
    try {
      await gh('PATCH', `/git/refs/heads/${c.branch}`, { sha: commit.sha, force: false });
      return { result, commit: commit.sha };
    } catch (e) {
      if (e.status === 422 || e.status === 409) { await sleep(150 * (attempt + 1) + Math.random() * 200); continue; } // someone else committed: re-read and retry
      throw e;
    }
  }
  throw new HttpError(409, 'Repository is busy, please retry');
}

// Fresh (uncached) read of data.json straight from the branch.
async function readDataJson() {
  const c = cfg();
  const buf = await gh('GET', `/contents/data.json?ref=${encodeURIComponent(c.branch)}`, null, { accept: 'application/vnd.github.raw+json', raw: true });
  if (!buf) return [];
  const data = JSON.parse(buf.toString('utf8'));
  if (!Array.isArray(data)) throw new HttpError(500, 'data.json is malformed');
  return data;
}

const configured = () => Boolean(env('GITHUB_OWNER') && env('GITHUB_REPO') && env('GITHUB_TOKEN'));

module.exports = { assertSafePath, updateRepo, readDataJson, configured, SAFE_PATH };
