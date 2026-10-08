#!/usr/bin/env node
'use strict';
// Local development server: serves the static site and mounts /api/* handlers exactly like Vercel does.
// Applies the security headers from vercel.json so CSP problems show up locally.
// usage: PORT=3000 node scripts/dev-server.js   (reads .env if present)
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
const BLOCKED = /^\/(api|scripts|test|project|node_modules|\.git|\.github)(\/|$)|\/\.[^/]/;

function loadEnv(root) {
  try {
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* no .env */ }
}

function createServer(root = path.join(__dirname, '..')) {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const globalHeaders = (vercel.headers.find((h) => h.source === '/(.*)') || { headers: [] }).headers;
  return http.createServer(async (req, res) => {
    for (const h of globalHeaders) res.setHeader(h.key, h.value);
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    try {
      if (p.startsWith('/api/')) {
        const file = path.join(root, p.replace(/\/$/, '') + '.js');
        if (!file.startsWith(path.join(root, 'api')) || path.basename(file).startsWith('_') || !fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"Not found"}'); }
        return await require(file)(req, res);
      }
      if (BLOCKED.test(p)) { res.statusCode = 404; return res.end('Not found'); }
      if (p.endsWith('/')) p += 'index.html';
      let file = path.join(root, p);
      if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) { res.statusCode = 301; res.setHeader('Location', p + '/'); return res.end(); }
      if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html'; // cleanUrls
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
      res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    } catch (e) { console.error(e); res.statusCode = 500; res.end('Server error'); }
  });
}

module.exports = { createServer, loadEnv };

if (require.main === module) {
  const root = path.join(__dirname, '..');
  loadEnv(root);
  if (!process.env.ALLOW_INSECURE_COOKIE) process.env.ALLOW_INSECURE_COOKIE = '1'; // http://localhost has no TLS
  const port = Number(process.env.PORT || 3000);
  createServer(root).listen(port, () => console.log(`Qurishi dev server: http://localhost:${port}  (admin: /admin/)`));
}
