// script.js — Qurishi Wallpapers (public site)
"use strict";

const ITEMS_PER_PAGE = 24;
const WHATSAPP_NUMBER = "93782008590";
const IMG_EXTENSIONS = ["webp", "jpg", "jpeg", "png"]; // legacy records without an explicit `image` path
const CATEGORIES = ["wall", "ceiling", "flat"];
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
function track(type, extra = {}) {
  if (navigator.doNotTrack === "1") return;
  const body = JSON.stringify({ type, ...extra });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* never break the page for analytics */ }
}

// ---- item helpers ----
const normCat = (c) => { const x = String(c || "").toLowerCase().trim(); return x.startsWith("ceil") || x === "celing" ? "ceiling" : x.startsWith("flat") ? "flat" : "wall"; };
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
    src: thumbPath(item), alt: t("cardAlt", item.title, t(cat)), loading: idx < 4 ? "eager" : "lazy", decoding: "async", draggable: "false",
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
    img, el("span", { class: "category-badge", text: t(cat) }), el("span", { class: "zoom-hint", "aria-hidden": "true", text: t("preview") }));
  media.addEventListener("click", () => openPreview(item, media));

  return el("article", { class: "card", role: "listitem" }, media,
    el("div", { class: "card-body" },
      el("div", { class: "card-meta" }, el("span", { class: "card-id", text: `${t("idLabel")}: ${item.id}` })),
      el("h2", { class: "card-title", text: item.title }),
      waLink(item, "card", "btn-whatsapp")));
}

function renderGallery() {
  if (!loaded) return;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const items = filteredData.slice(start, start + ITEMS_PER_PAGE);
  gallery.replaceChildren(...items.map(card));
  noResults.hidden = items.length > 0;
  noResults.textContent = t("noResults");
  updatePagination();
}

function filterGallery() {
  if (!loaded) return;
  const q = searchInput.value.trim().toLowerCase();
  filteredData = allData.filter((i) => (currentCategory === "all" || normCat(i.category) === currentCategory) &&
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
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => selectCategory(b.dataset.category)));
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
  document.querySelectorAll(".tab").forEach((b) => { b.textContent = t(b.dataset.category === "all" ? "all" : b.dataset.category); });
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

// ---- init ----
(async function init() {
  initTheme();
  applyTranslations();
  showSkeletons();
  track("visit");
  const hash = location.hash.slice(1);
  if (CATEGORIES.includes(hash)) selectCategory(hash, { silent: true });
  try {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allData = Array.isArray(data) ? data : [];
    loaded = true;
    filterGallery();
  } catch (err) {
    console.error("[Qurishi]", err);
    gallery.replaceChildren(el("p", { class: "load-error", text: t("loadError") }));
  }
})();
