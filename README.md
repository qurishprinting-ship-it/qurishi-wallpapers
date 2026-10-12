# Qurishi Wallpapers — v2

Pashto-first wallpaper gallery with a secure admin panel, automatic image optimization, automatic GitHub storage and private analytics. This is an upgrade of the existing site (same files, same `data.json`, same IDs, same WhatsApp ordering).

## Architecture

```
Visitors ─▶ static site (index.html, script.js, data.json, images/, thumbs/)
                 │  anonymous beacons ─▶ /api/track ─▶ Upstash Redis (counters only, no personal data)
Owner ─▶ /admin ─▶ /api/admin/*  (signed HttpOnly cookie + CSRF token, server-side checks on EVERY call)
                       ├─ sharp: validate → rotate (EXIF) → strip metadata → resize → WebP (adaptive) + thumbnail
                       └─ GitHub Git-Data API (token only on the server) ─▶ ONE atomic commit: image + thumb + data.json
GitHub push ─▶ Vercel redeploys the site (~1 min)  ·  GitHub Action keeps manual uploads in sync (merge-only)
```

Why Vercel: the GitHub write-token must stay private, so a small server-side API is required. Vercel serves the existing static files unchanged and runs `api/*.js` as serverless functions (free tier is enough). You do **not** buy any "GitHub API". Static hosting alone (GitHub Pages) cannot run the admin API.

## Deploy (one time)

1. **GitHub token** — GitHub → Settings → Developer settings → Fine-grained tokens → *only* repo `qurishprinting-ship-it/qurishi-wallpapers`, permission **Contents: Read and write**. Nothing else.
2. **Vercel** — import the repo (Framework: *Other*, no build command). Add the DNS records Vercel shows for `qurishiprinting.com` (this replaces GitHub Pages hosting).
3. **Analytics storage** — Vercel → Storage/Marketplace → *Upstash Redis* (free) → connect to the project (adds `UPSTASH_REDIS_REST_URL` / `_TOKEN`).
4. **Admin password hash** — on your computer: `npm install && npm run hash-password`, paste the printed `scrypt$…` line.
5. **Environment variables** (Vercel → Settings → Environment Variables; see `.env.example`):
   `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` (32+ random chars), `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
6. Redeploy, open `/admin/`, sign in.
7. **Migrate existing images (once):** GitHub → Actions → *Auto Update Gallery* → *Run workflow*. It fills width/height/aspect-ratio/size/thumbnails for all existing wallpapers **without changing IDs or titles**. Until it has run, the site still works (it falls back to the old paths).

## Using the admin

Login → **Upload**: drop many images, pick a category (override per file if needed), *Upload all*. Each file is optimized and committed independently, so one failure never cancels the rest; *Retry* re-sends only failures. **Manager**: search, filter, sort, edit title, change category (the file is re-pointed, not re-uploaded), delete (confirmation), bulk move/delete. **Analytics / Activity / Settings** are admin-only.

Notes: new images appear on the public site after the Vercel redeploy (~1–2 min). Request bodies are limited to ~4.4 MB by the host, so the browser pre-shrinks very large originals before sending; the server still does the real optimization.

## Image optimization

Real-content validation (not extension), EXIF rotation, metadata stripped, long side ≤ 1600 px, WebP. Adaptive quality ladder 82→55 aiming at ≈ 50 KB (`IMAGE_TARGET_KB`). If a very detailed wallpaper cannot reach 50 KB at q≥55, quality is preferred over size (q60, up to 150 KB), then the image is scaled down in steps — it is never forced into a visibly poor result. 480 px-wide thumbnails are generated for the gallery. The admin sees original size, optimized size, % saved, format and dimensions.

## Data model

`data.json` keeps the old fields and adds: `image, thumbnail, width, height, aspectRatio, fileSize, format, createdAt, hash`. Records are identified by **category + id** (the original data has `002` in both wall and ceiling). View / WhatsApp counters live in Redis (committing to git on every view would be unreasonable) and are merged in the admin.

## Security summary

Scrypt password hash; signed `HttpOnly; Secure; SameSite=Strict` session cookie (8 h); CSRF token + Origin check on every state-changing call; login rate limit (6 / 15 min per IP, fail-closed); constant-time username/password comparison; all admin APIs authorize server-side; GitHub token never reaches the browser or logs; strict path allow-list for every repo write; filenames never used in paths; content validation, size and pixel limits; CSP and security headers (`vercel.json`); DOM built with `textContent` only (no injected HTML); analytics store no IPs (daily-rotating salted hash in a HyperLogLog) and honour Do-Not-Track.
Keep the GitHub token scoped to this one repo; rotate it if it ever leaks.

## Testing

`npm test` — 28 automated tests (auth, sessions, CSRF, rate limit, upload, duplicates, hostile filenames, concurrency + commit conflicts, GitHub 5xx/rate-limit, move/delete/bulk, analytics, path safety). Local run: copy `.env.example` → `.env`, `npm install`, `npm run dev` → http://localhost:3000.

## Changed / new files

New: `api/**`, `admin/**`, `scripts/**`, `test/**`, `thumbs/`, `vercel.json`, `.vercelignore`, `package.json`, `.env.example`, `robots.txt`, `sitemap.xml`, `README.md`.
Rewritten: `index.html`, `style.css`, `script.js`, `translations.js`, `.github/workflows/update-gallery.yml` (now merge-only; the old one regenerated `data.json` from scratch and would have erased all metadata).
Unchanged: `data.json` (until the sync runs), `assets/`, `images/`. `project/compress_watermark.py` is untouched (your offline watermark workflow).
