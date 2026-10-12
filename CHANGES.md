# CHANGES — v3 upgrade (copy these files over your repository)

Do NOT replace your whole repo: your real `images/`, `thumbs/` and `assets/logo.png` are not part of this package and must stay as they are.

## New files
- `settings.json` — categories + brand colour (public, no secrets)
- `shared/order.js`, `shared/theme.js` — the single ordering rule and colour/contrast logic
- `theme-boot.js` — applies the last known colour before first paint
- `api/_lib/settings.js`, `api/_lib/categories.js`
- `api/admin/settings.js`, `categories.js`, `order.js`, `password.js`
- `admin/i18n.js`, `admin/views-content.js`, `admin/views-site.js`, `admin/boot.js`
- `test/features.test.js`, `CHANGES.md`

## Modified files
- Public site: `index.html`, `script.js`, `style.css`, `translations.js`
- Admin UI (redesigned): `admin/index.html`, `admin/admin.css`, `admin/admin.js`
- API: `api/_lib/{config,auth,gallery,github,store}.js`, `api/admin/{wallpapers,bulk,upload,me,analytics,audit,logout}.js`, `api/track.js`
- `scripts/sync_data.py` (dynamic categories), `test/{unit,e2e-harness}.test|js`, `.env.example`, `README.md`

## Unchanged
`vercel.json`, `.vercelignore`, `.github/workflows/update-gallery.yml`, `package.json`, `data.json` (only gains `order`/`featured` when you use ordering), login credentials, all images.
