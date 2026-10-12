// script.js — Qurishi Wallpapers (public site)
"use strict";

const ITEMS_PER_PAGE = 24;
const WHATSAPP_NUMBER = "93782008590";
const IMG_EXTENSIONS = ["webp", "jpg", "jpeg", "png"]; // legacy records without an explicit `image` path
// Categories come from settings.json (managed in the admin panel). These defaults are used if it cannot be loaded.
const DEFAULT_CATEGORIES = [
  { slug: "wall", name: "Wall", names: { ps: "وال", fa: "دیوار", en: "Wall" }, order: 0, enabled: true },
  { slug: "ceiling", name: "Ceiling", names: { ps: "چت", fa: "سقف", en: "Ceiling" }, order: 1, enabled: true },
  { slug: "flat", name: "Flat", names: { ps: "فلیټ", fa: "فلت", en: "Flat" }, order: 2, enabled: true },
];
let categories = DEFAULT_CATEGORIES;
const SIZES = "(min-width:1700px) 18vw, (min-width:1100px) 23vw, (min-width:700px) 31vw, 48vw";

let allData = [];
let filteredData = [];
let currentCategory = "all";
let currentPage = 1;
let lastFocus = null;
let loaded = false;

const $ = (id) => document.getElementById(id);
const gallery = $("gallery"), searchInput = $("searchInput"), prevBtn = $("prevBtn"), nextBtn = $("nextBtn");
const pageNumber = $("pageNumber"), noResults = $("no-results"), modal = $("previewModal");
const previewImage = $("previewImage"), previewTitle = $("previewTitle"), previewId = $("previewId");
const whatsappBtn = $("whatsappBtn"), closeBtn = $("closeModal"), scrollTopBtn = $("scrollTop");
const languageSelect = $("languageSelect"), themeToggle = $("themeToggle");

// ---- tiny DOM helper (no innerHTML with data => no XSS from titles) ----
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.filter((x) => x != null));
  return n;
}

// ---- analytics (private; anonymous; honours Do-Not-Track) ----
// On GitHub Pages there is no /api, so analytics beacons go to the Vercel project (CORS-allowed in api/track.js).
const API_BASE = /\.github\.io$/.test(location.hostname) ? "https://qurishi-wallpapers.vercel.app" : "";
function track(type, extra = {}) {
  if (navigator.doNotTrack === "1") return;
  const body = JSON.stringify({ type, ...extra });
  try {
    // text/plain keeps it a "simple" cross-origin request (no preflight); the server parses the JSON body regardless.
    if (navigator.sendBeacon && navigator.sendBeacon(API_BASE + "/api/track", new Blob([body], { type: "text/plain;charset=UTF-8" }))) return;
    fetch(API_BASE + "/api/track", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body, keepalive: true }).catch(() => {});
  } catch { /* never break the page for analytics */ }
}

// ---- item helpers ----
// Known slugs are kept as they are; only the old misspellings of the three original categories are repaired.
const normCat = (c) => {
  const x = String(c || "").toLowerCase().trim();
  if (categories.some((k) => k.slug === x)) return x;
  return x.startsWith("ceil") || x === "celing" ? "ceiling" : x.startsWith("flat") ? "flat" : x || "wall";
};
const catInfo = (slug) => categories.find((k) => k.slug === slug);
// Label in the visitor's language: explicit translation > built-in translation > the category's base name.
function catLabel(slug) {
  const k = catInfo(slug);
  return (k && k.names && k.names[currentLang]) || (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][slug]) || (k && k.name) || slug;
}
// Visible = its category is switched on in the admin panel (or is unknown to settings.json, which then only shows under "All").
const isVisible = (item) => { const k = catInfo(normCat(item.category)); return !k || k.enabled !== false; };

const legacyPath = (item, ext) => `images/${normCat(item.category)}/${item.id}.${ext}`;
const imagePath = (item) => item.image || legacyPath(item, "webp");
const thumbPath = (item) => item.thumbnail || imagePath(item);
const absUrl = (rel) => new URL(rel, location.href).href;

// If a path 404s: thumbnail -> full image -> other extensions -> placeholder. Never leaves a broken icon.
function attachFallback(img, item) {
  let step = 0;
  const chain = [];
  if (item.thumbnail && img.dataset.role !== "full") chain.push(imagePath(item));
  if (!item.image) IMG_EXTENSIONS.slice(1).forEach((e) => chain.push(legacyPath(item, e)));
  img.addEventListener("error", () => {
    img.removeAttribute("srcset");
    if (step < chain.length) { img.src = chain[step++]; return; }
    img.src = placeholder(item.title);
  });
}
function placeholder(title) {
  const l = (title || "W").trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#1a1a2e"/><text x="200" y="270" font-family="serif" font-size="90" fill="#c9a84c" text-anchor="middle">${l.replace(/[<&>]/g, "")}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// ---- theme ----
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.querySelector(".sun-icon").hidden = theme === "light";
  themeToggle.querySelector(".moon-icon").hidden = theme !== "light";
}
function initTheme() {
  let saved = "dark";
  try { saved = localStorage.getItem("qurishi_theme") || "dark"; } catch { /* ignore */ }
  applyTheme(saved === "light" ? "light" : "dark");
}
themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  applyTheme(next);
  try { localStorage.setItem("qurishi_theme", next); } catch { /* ignore */ }
});

// ---- skeletons (varied ratios to hint at the masonry layout) ----
function showSkeletons() {
  gallery.classList.remove("masonry"); masonryCards = [];
  gallery.replaceChildren(...[0.56, 1.78, 0.75, 1, 0.56, 0.75, 1.78, 1].map((r) =>
    el("div", { class: "skeleton", "aria-hidden": "true" }, el("div", { class: "skeleton-img", style: `aspect-ratio:${r}` }), el("div", { class: "skeleton-body" }, el("div", { class: "skeleton-line" }), el("div", { class: "skeleton-btn" })))));
}

// ---- WhatsApp ----
function waURL(item) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t("whatsappMsg", item.id, item.title, absUrl(imagePath(item))))}`;
}
function waLink(item, source, cls) {
  const a = el("a", { class: cls, href: waURL(item), target: "_blank", rel: "noopener", text: t("order"), "data-wa": "" });
  // Record the click, then let the browser open WhatsApp normally (no preventDefault).
  a.addEventListener("click", () => track("wa", { id: item.id, category: normCat(item.category), source }));
  return a;
}

// ---- gallery ----
function card(item, idx) {
  const cat = normCat(item.category);
  const hasDims = item.width > 0 && item.height > 0;
  const img = el("img", {
    src: thumbPath(item), alt: t("cardAlt", item.title, catLabel(cat)), loading: idx < 4 ? "eager" : "lazy", decoding: "async", draggable: "false",
    width: hasDims ? Math.min(item.width, 480) : false,
    height: hasDims ? Math.round(Math.min(item.width, 480) * item.height / item.width) : false,
    srcset: hasDims && item.thumbnail && item.image ? `${item.thumbnail} ${Math.min(item.width, 480)}w, ${item.image} ${item.width}w` : false,
    sizes: hasDims && item.thumbnail && item.image ? SIZES : false,
    style: hasDims ? `aspect-ratio:${item.width}/${item.height}` : "aspect-ratio:3/4",
  });
  // Legacy record without stored dimensions: adopt the image's real ratio once it loads (never crop).
  if (!hasDims) img.addEventListener("load", () => { if (img.naturalWidth) img.style.aspectRatio = `${img.naturalWidth}/${img.naturalHeight}`; }, { once: true });
  attachFallback(img, item);

  const media = el("button", { class: "card-media", type: "button", "aria-label": `${t("preview")}: ${item.title}` },
    img, el("span", { class: "category-badge", text: catLabel(cat) }),
    item.featured === true ? el("span", { class: "featured-badge", text: "★ " + t("featured") }) : null, el("span", { class: "zoom-hint", "aria-hidden": "true", text: t("preview") }));
  media.addEventListener("click", () => openPreview(item, media));

  return el("article", { class: "card", role: "listitem" }, media,
    el("div", { class: "card-body" },
      el("div", { class: "card-meta" }, el("span", { class: "card-id", text: `${t("idLabel")}: ${item.id}` })),
      el("h2", { class: "card-title", text: item.title }),
      waLink(item, "card", "btn-whatsapp")));
}

// Masonry that keeps READING ORDER: design #1 top-left, #2 next to it, … (CSS columns would fill column by
// column, which would scatter the owner's "best first" order). Each card goes into the currently shortest column.
let masonryCards = [];
const columnCount = () => { const w = window.innerWidth; return w >= 1700 ? 5 : w >= 1100 ? 4 : w >= 700 ? 3 : 2; };
function layoutMasonry(cards = masonryCards) {
  masonryCards = cards;
  if (!cards.length) { gallery.classList.remove("masonry"); gallery.replaceChildren(); return; }
  const n = columnCount(), heights = new Array(n).fill(0), cols = Array.from({ length: n }, () => el("div", { class: "gcol" }));
  for (const { item, node } of cards) {
    const aspect = item.width && item.height ? item.width / item.height : 0.75;
    const c = heights.indexOf(Math.min(...heights));
    cols[c].append(node); heights[c] += 1 / aspect + 0.45; // image height + card text/button (relative to column width)
  }
  gallery.classList.add("masonry");
  gallery.replaceChildren(...cols);
}
let lastCols = columnCount();
window.addEventListener("resize", () => { const n = columnCount(); if (n !== lastCols && masonryCards.length) { lastCols = n; layoutMasonry(); } });

function renderGallery() {
  if (!loaded) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const items = filteredData.slice(start, start + ITEMS_PER_PAGE);
  layoutMasonry(items.map((item) => ({ item, node: card(item) })));
  noResults.hidden = items.length > 0;
  noResults.textContent = t("noResults");
  updatePagination();
}

function filterGallery() {
  if (!loaded) return;
  const q = searchInput.value.trim().toLowerCase();
  // Display order = the rule in shared/order.js (featured first, then the admin's manual order). Same for every page.
  const rank = Object.fromEntries(categories.map((k) => [k.slug, k.order]));
  const ordered = QOrder.sortItems(allData.map((i) => ({ ...i, category: normCat(i.category) })), rank);
  filteredData = ordered.filter((i) => isVisible(i) && (currentCategory === "all" || i.category === currentCategory) &&
    (!q || String(i.id).toLowerCase().includes(q) || String(i.title).toLowerCase().includes(q)));
  currentPage = 1;
  renderGallery();
}

function updatePagination() {
  const total = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  pageNumber.textContent = t("pageLabel", currentPage, total);
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= total;
  $("pagination").hidden = filteredData.length <= ITEMS_PER_PAGE;
}
const toGallery = () => $("gallery-section").scrollIntoView({ behavior: "smooth", block: "start" });
prevBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderGallery(); toGallery(); } });
nextBtn.addEventListener("click", () => { if (currentPage < Math.ceil(filteredData.length / ITEMS_PER_PAGE)) { currentPage++; renderGallery(); toGallery(); } });

// ---- preview modal (respects the real aspect ratio: 9:16 stays tall, 16:9 stays wide, 1:1 stays square) ----
function openPreview(item, opener) {
  lastFocus = opener || document.activeElement;
  const hasDims = item.width > 0 && item.height > 0;
  previewImage.removeAttribute("srcset");
  previewImage.dataset.role = "full";
  previewImage.alt = t("previewAlt", item.title);
  if (hasDims) { previewImage.width = item.width; previewImage.height = item.height; previewImage.style.aspectRatio = `${item.width}/${item.height}`; }
  else { previewImage.removeAttribute("width"); previewImage.removeAttribute("height"); previewImage.style.aspectRatio = ""; }
  previewImage.onerror = () => { previewImage.onerror = null; previewImage.src = item.thumbnail && previewImage.src !== absUrl(item.thumbnail) ? item.thumbnail : placeholder(item.title); };
  previewImage.src = imagePath(item);
  previewTitle.textContent = item.title;
  previewId.textContent = `${t("idLabel")}: ${item.id}`;
  const fresh = waLink(item, "preview", "btn-whatsapp");
  fresh.id = "whatsappBtn";
  whatsappBtn.replaceWith(fresh);
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("active"));
  document.body.style.overflow = "hidden";
  closeBtn.focus();
  track("view", { id: item.id, category: normCat(item.category) });
}
function closePreview() {
  if (modal.hidden) return;
  modal.classList.remove("active");
  modal.hidden = true;
  document.body.style.overflow = "";
  previewImage.removeAttribute("src");
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
closeBtn.addEventListener("click", closePreview);
modal.addEventListener("click", (e) => { if (e.target === modal || e.target.classList.contains("modal-inner")) closePreview(); });
document.addEventListener("keydown", (e) => {
  if (modal.hidden) return;
  if (e.key === "Escape") return closePreview();
  if (e.key === "Tab") { // keep focus inside the dialog
    const f = [closeBtn, $("whatsappBtn")];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[1].focus(); }
    else if (!e.shiftKey && i === 1) { e.preventDefault(); f[0].focus(); }
    else if (i < 0) { e.preventDefault(); f[0].focus(); }
  }
});

// ---- tabs / search ----
function selectCategory(cat, { silent = false } = {}) {
  currentCategory = cat;
  document.querySelectorAll(".tab").forEach((b) => { const on = b.dataset.category === cat; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); });
  history.replaceState(null, "", cat === "all" ? location.pathname + location.search : `#${cat}`);
  if (!silent && cat !== "all") track("category", { category: cat });
  filterGallery();
}
function buildTabs() {
  const bar = $("tabs-bar");
  const all = bar.querySelector('[data-category="all"]');
  const tabs = [...categories].filter((k) => k.enabled !== false).sort((a, b) => a.order - b.order).map((k) =>
    el("button", { class: "tab", type: "button", role: "tab", "data-category": k.slug, "aria-selected": "false", text: catLabel(k.slug) }));
  bar.replaceChildren(all, ...tabs);
  bar.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => selectCategory(b.dataset.category)));
  const on = bar.querySelector(`[data-category="${CSS.escape(currentCategory)}"]`);
  if (!on) currentCategory = "all"; // the chosen category was hidden/removed
  bar.querySelectorAll(".tab").forEach((b) => { const sel = b.dataset.category === currentCategory; b.classList.toggle("active", sel); b.setAttribute("aria-selected", String(sel)); });
}
let searchTimer;
searchInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(filterGallery, 120); });

// ---- language ----
function applyTranslations() {
  const L = TRANSLATIONS[currentLang];
  document.documentElement.lang = L.htmlLang;
  document.documentElement.dir = L.dir;
  document.title = L.title;
  document.querySelectorAll("[data-i18n]").forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll("[data-i18n-attr]").forEach((n) => n.dataset.i18nAttr.split(";").forEach((pair) => { const [a, k] = pair.split(":"); n.setAttribute(a, t(k)); }));
  document.querySelectorAll(".tab").forEach((b) => { b.textContent = b.dataset.category === "all" ? t("all") : catLabel(b.dataset.category); });
  languageSelect.value = currentLang;
  if (modal.hidden) updatePagination();
}
languageSelect.addEventListener("change", () => setLang(languageSelect.value));
document.addEventListener("langchange", () => { closePreview(); applyTranslations(); renderGallery(); });

// ---- misc ----
window.addEventListener("scroll", () => scrollTopBtn.classList.toggle("visible", window.scrollY > 500), { passive: true });
scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
// Light deterrent only on images (we no longer block keyboard shortcuts or the whole page).
document.addEventListener("contextmenu", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });
document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });

// ---- settings (categories + brand colour) ----
async function loadSettings() {
  try {
    const res = await fetch("settings.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const cfg = await res.json();
    if (Array.isArray(cfg.categories) && cfg.categories.length) {
      categories = cfg.categories.filter((k) => k && /^[a-z0-9][a-z0-9-]{0,29}$/.test(k.slug)).map((k, i) => ({ slug: k.slug, name: String(k.name || k.slug), names: k.names || {}, order: Number.isFinite(k.order) ? k.order : i, enabled: k.enabled !== false }));
    }
    const primary = QTheme.normalizeHex(cfg.theme && cfg.theme.primary);
    if (primary) { QTheme.apply(primary); try { localStorage.setItem("qurishi_primary", primary); } catch { /* ignore */ } }
  } catch (err) {
    console.warn("[Qurishi] settings.json unavailable, using defaults:", err.message); // the gallery still works
  }
}

// ---- init ----
(async function init() {
  initTheme();
  applyTranslations();
  showSkeletons();
  track("visit");
  const hash = decodeURIComponent(location.hash.slice(1));
  try {
    const [res] = await Promise.all([fetch("data.json", { cache: "no-cache" }), loadSettings()]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allData = Array.isArray(data) ? data : [];
    if (hash && categories.some((k) => k.slug === hash && k.enabled !== false)) currentCategory = hash;
    buildTabs();
    loaded = true;
    selectCategory(currentCategory, { silent: true });
  } catch (err) {
    console.error("[Qurishi]", err);
    gallery.classList.remove("masonry"); gallery.replaceChildren(el("p", { class: "load-error", text: t("loadError") }));
  }
})();
