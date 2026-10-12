# Qurishi Wallpapers — v3 (categories, ordering, theme, password)

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


---

# v3 upgrade — what is new and how it works

**No new environment variables are required.** Everything below uses the GitHub + Upstash setup you already have.

## Where the new data lives
| Data | Stored in | Public? |
|---|---|---|
| Categories (names, translations, order, visible/hidden) and the brand colour | `settings.json` in the repo (written by the admin through the GitHub API) | yes — read by the website, contains no secrets |
| Featured flag and display order of each design | extra fields `featured` / `order` inside `data.json` records | yes |
| Admin password **changed from the panel** | Upstash Redis key `admin:pw` (scrypt hash only) | **no** — private |
| Original admin password | `ADMIN_PASSWORD_HASH` env var — untouched, still the fallback | no |

`data.json` stays a plain array, so the GitHub Action, `scripts/sync_data.py` and every old tool keep working. Existing records are never rewritten except to add `order` (and `featured`) once you use ordering.

## Display-order rule (public site, admin and API share `shared/order.js`)
* **Inside a category:** featured designs first, then your manual order, then original `data.json` position.
* **In "All":** featured first, then each design's position inside its own category, then the category order — so the best design of every category appears first, then the second best, and so on.
* Designs that were never ordered keep their old order, so nothing moves until you decide to move it.
* The sort is stable, so pagination and refreshes never reshuffle. The gallery places cards left-to-right in this order.
* New uploads lead their group (below featured designs) until you re-order.

## Password
* **Account & Password** → current password, new password, confirmation. Minimum 10 characters.
* The new hash is saved in Upstash. Login checks that first and falls back to `ADMIN_PASSWORD_HASH`, so the original password keeps working until you change it.
* Changing it signs out every other session. Password changes need Upstash (the panel tells you if it is missing).
* **Locked out? Recovery:** in the Upstash console delete the key `admin:pw` — the original password from `ADMIN_PASSWORD_HASH` works again.

## Categories
* Add / rename / translate / hide / re-order in **Manage Categories**; new categories appear on the public site automatically (first upload creates `images/<slug>/`).
* The three original categories can be renamed, hidden and re-ordered but **not deleted**. Other categories can be deleted only after confirmation; if they contain designs you must pick a category to move them to — designs are never deleted silently.
* A category's folder name (slug) never changes when you rename it, so image URLs stay valid.
* A folder under `images/` that is not registered in `settings.json` still shows its designs under "All" (no tab).

## Colours
* Default `#121efb`. **Theme & Website** has a colour picker, hex field, live dark/light preview, Save, Cancel, Restore default.
* Text, links and borders are lightened/darkened automatically so they stay readable (WCAG 4.5:1 where possible).

## Public site on GitHub Pages
The site reads `data.json` and `settings.json` as static files, so it works on GitHub Pages and Vercel alike. Analytics beacons from GitHub Pages go to the Vercel project (`TRACK_ALLOWED_ORIGINS` controls the allowed origin).
Admin changes are committed to GitHub; GitHub Pages / Vercel redeploy in ~1–2 minutes.

## Deploying this upgrade
1. Copy the changed files over your repository (do **not** replace the whole repo — your `images/` and `thumbs/` stay as they are). See `CHANGES.md`.
2. Commit and push to `main` (GitHub Pages and the Vercel project redeploy automatically).
3. Open `https://qurishi-wallpapers.vercel.app/admin/` and sign in with your **existing** password.
4. Make sure Upstash is connected in Vercel (needed for analytics and password changes).

## Rollback
Everything is in git: revert the commit, or restore the original files. The only data changes the upgrade makes are the new `settings.json` and the added `order`/`featured` fields.

## Known limits
* Hidden/disabled categories hide designs from the website but keep their files.
* The admin UI Pashto labels for the new sections should be reviewed by a native speaker.
* Drag-and-drop works with a mouse; on touch devices use the arrow/top/bottom buttons.
