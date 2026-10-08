'use strict';
// Starts the REAL dev server + REAL api handlers against an in-memory GitHub, for browser testing.
// The only substitute: image encoding is done with Pillow (sharp is not installable offline here).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { fakeGitHub } = require('./helpers');

const SITE = process.argv[2] || '/tmp/site';
const PORT = Number(process.argv[3] || 4173);
process.env.SESSION_SECRET = 'e'.repeat(48);
process.env.ADMIN_USERNAME = 'owner';
process.env.GITHUB_OWNER = 'o'; process.env.GITHUB_REPO = 'r'; process.env.GITHUB_TOKEN = 'ghp_FAKE';
process.env.ALLOW_INSECURE_COOKIE = '1';

const PY = `
import sys, io, json, base64, hashlib
from PIL import Image, ImageOps
raw = sys.stdin.buffer.read()
try:
    im = Image.open(io.BytesIO(raw)); im.load()
except Exception:
    print(json.dumps({"error": "invalid"})); sys.exit(0)
if im.format.lower() not in ("jpeg","png","webp","tiff","mpo"): print(json.dumps({"error":"format"})); sys.exit(0)
ow, oh = im.size
im = ImageOps.exif_transpose(im).convert("RGB")
im.thumbnail((1600,1600))
best=None
for q in (82,74,66,60,55):
    b=io.BytesIO(); im.save(b,"WEBP",quality=q,method=4); best=(q,b.getvalue())
    if len(best[1])<=50*1024: break
t=im.copy(); t.thumbnail((480,960)); tb=io.BytesIO(); t.save(tb,"WEBP",quality=62)
print(json.dumps({"w":im.size[0],"h":im.size[1],"q":best[0],"full":base64.b64encode(best[1]).decode(),"thumb":base64.b64encode(tb.getvalue()).decode(),"tw":t.size[0],"th":t.size[1],"fmt":"jpeg","ow":ow,"oh":oh}))
`;
const optPath = require.resolve('../api/_lib/optimize.js');
require.cache[optPath] = { id: optPath, filename: optPath, loaded: true, exports: { optimize: async (buf) => {
  const { HttpError } = require('../api/_lib/http');
  const r = spawnSync('python3', ['-c', PY], { input: buf, maxBuffer: 64 * 1024 * 1024 });
  const o = JSON.parse(r.stdout.toString() || '{"error":"invalid"}');
  if (o.error) throw new HttpError(415, o.error === 'invalid' ? 'File is not a valid image' : 'Unsupported image format');
  const full = Buffer.from(o.full, 'base64');
  return { full: { buffer: full, width: o.w, height: o.h, size: full.length, quality: o.q },
    thumb: { buffer: Buffer.from(o.thumb, 'base64'), width: o.tw, height: o.th, size: Buffer.from(o.thumb, 'base64').length },
    original: { format: o.fmt, width: o.ow, height: o.oh, size: buf.length },
    hash: require('crypto').createHash('sha256').update(full).digest('hex').slice(0, 32) };
} } };

// seed fake GitHub from the fixture site on disk
const seed = {};
const walk = (d) => { for (const f of fs.readdirSync(path.join(SITE, d))) { const rel = path.join(d, f); fs.statSync(path.join(SITE, rel)).isDirectory() ? walk(rel) : (seed[rel] = fs.readFileSync(path.join(SITE, rel))); } };
for (const d of ['images/wall', 'images/ceiling', 'images/flat', 'thumbs/wall', 'thumbs/ceiling', 'thumbs/flat']) { try { walk(d); } catch { /* none */ } }
seed['data.json'] = fs.readFileSync(path.join(SITE, 'data.json'));
const gh = fakeGitHub(Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v])));
global.fetch = (u, i) => (String(u).startsWith('https://api.github.com') ? gh.fetchImpl(u, i) : Promise.reject(new Error('blocked ' + u)));

(async () => {
  const { hashPassword } = require('../api/_lib/auth');
  process.env.ADMIN_PASSWORD_HASH = await hashPassword('test-password-123');
  const { createServer } = require(path.join(SITE, 'scripts/dev-server.js'));
  const inner = createServer(SITE);
  const mime = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
  const server = require('http').createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname).slice(1);
    if (req.method === 'GET' && /^(data\.json|(images|thumbs)\/(wall|ceiling|flat)\/[^/]+)$/.test(p) && gh.has(p)) { // "deployed" state = fake repo head
      res.setHeader('Content-Type', mime[path.extname(p)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-cache'); return res.end(gh.files().get(p));
    }
    inner.emit('request', req, res);
  });
  server.listen(PORT, () => console.log('READY ' + PORT));
})();
