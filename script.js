// =============================================
// script.js — Qurishi Premium Wallpapers
// =============================================

"use strict";

// -----------------------------------------------
// Constants
// -----------------------------------------------
const ITEMS_PER_PAGE  = 20;
const WHATSAPP_NUMBER = "93782008590";
const SKELETON_COUNT  = 8;
const IMG_EXTENSIONS  = ["webp", "jpg", "jpeg", "png"];

// -----------------------------------------------
// State
// -----------------------------------------------
let allData         = [];
let filteredData    = [];
let currentCategory = "all";
let currentPage     = 1;

// -----------------------------------------------
// DOM References
// -----------------------------------------------
const gallery        = document.getElementById("gallery");
const searchInput    = document.getElementById("searchInput");
const prevBtn        = document.getElementById("prevBtn");
const nextBtn        = document.getElementById("nextBtn");
const pageNumber     = document.getElementById("pageNumber");
const noResults      = document.getElementById("no-results");
const previewModal   = document.getElementById("previewModal");
const previewImage   = document.getElementById("previewImage");
const previewTitle   = document.getElementById("previewTitle");
const previewId      = document.getElementById("previewId");
const whatsappBtn    = document.getElementById("whatsappBtn");
const closeModalBtn  = document.getElementById("closeModal");
const scrollTopBtn   = document.getElementById("scrollTop");
const languageSelect = document.getElementById("languageSelect");
const themeToggle    = document.getElementById("themeToggle");

// -----------------------------------------------
// Helper: Normalize Category → folder name
// -----------------------------------------------
function normalizeCategory(rawCategory) {
  if (!rawCategory) return "wall";
  const cat = rawCategory.toLowerCase().trim();
  if (cat === "ceiling" || cat === "celing" || cat === "ceilings") return "ceiling";
  if (cat === "flat"    || cat === "flats")                         return "flat";
  return "wall";
}

// -----------------------------------------------
// Auto Image Path (no "image" key needed in data.json)
// Falls back through jpg → jpeg → png → webp on error
// -----------------------------------------------
function getImagePath(item, ext = "jpg") {
  const folder = normalizeCategory(item.category);
  return `images/${folder}/${item.id}.${ext}`;
}

// Attach a cascading error handler so we try each extension in order,
// then fall back to an inline SVG placeholder on total failure.
function handleImageError(img, item, extIndex = 0) {
  const nextExt = IMG_EXTENSIONS[extIndex];
  if (nextExt) {
    img.onerror = () => handleImageError(img, item, extIndex + 1);
    img.src     = getImagePath(item, nextExt);
  } else {
    img.onerror = null;
    img.src     = buildPlaceholderSVG(item.title);
  }
}

function buildPlaceholderSVG(title) {
  const letter = (title || "W").charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#1a1a2e"/>
    <text x="200" y="165" font-family="serif" font-size="80" fill="#c9a84c" text-anchor="middle" dominant-baseline="middle">${letter}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// -----------------------------------------------
// Theme Management
// -----------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("qurishi_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

function updateThemeIcon(theme) {
  const sunIcon  = themeToggle.querySelector(".sun-icon");
  const moonIcon = themeToggle.querySelector(".moon-icon");
  if (theme === "light") {
    sunIcon.style.display  = "none";
    moonIcon.style.display = "block";
  } else {
    sunIcon.style.display  = "block";
    moonIcon.style.display = "none";
  }
}

themeToggle.addEventListener("click", () => {
  const current  = document.documentElement.getAttribute("data-theme");
  const newTheme = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("qurishi_theme", newTheme);
  updateThemeIcon(newTheme);
  themeToggle.classList.add("spin");
  themeToggle.addEventListener("animationend", () => themeToggle.classList.remove("spin"), { once: true });
});

// -----------------------------------------------
// Skeleton Loader
// -----------------------------------------------
function showSkeletons() {
  gallery.innerHTML = "";
  for (let i = 0; i < SKELETON_COUNT; i++) {
    gallery.insertAdjacentHTML("beforeend", `
      <div class="skeleton">
        <div class="skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton-line" style="width:55%"></div>
          <div class="skeleton-line" style="width:35%"></div>
          <div class="skeleton-btn"></div>
        </div>
      </div>
    `);
  }
}

// -----------------------------------------------
// Build WhatsApp URL
// -----------------------------------------------
function buildWhatsAppURL(id, title, imageRelPath) {
  const base     = window.location.origin + window.location.pathname.replace(/index\.html$/, "");
  const imageUrl = base + imageRelPath;
  const msg      = t("whatsappMsg", id, title, imageUrl);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// -----------------------------------------------
// Render Gallery Cards
// -----------------------------------------------
function renderGallery() {
  gallery.innerHTML = "";

  const start     = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredData.slice(start, start + ITEMS_PER_PAGE);

  if (pageItems.length === 0) {
    noResults.style.display = "block";
    noResults.textContent   = t("noResults");
    updatePagination();
    return;
  }

  noResults.style.display = "none";

  pageItems.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("role", "listitem");
    card.style.animationDelay = `${idx * 0.04}s`;

    // Start with .webp; error handler cascades through extensions
    const initialPath = getImagePath(item, "webp");
    const waURL       = buildWhatsAppURL(item.id, item.title, initialPath);

    // Category badge label
    const catLabel = normalizeCategory(item.category);
    const catDisplay = catLabel.charAt(0).toUpperCase() + catLabel.slice(1);

    card.innerHTML = `
      <div class="card-img-wrap">
        <img
          data-src="${initialPath}"
          data-item-id="${item.id}"
          data-item-category="${item.category}"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          alt="${item.title}"
          loading="lazy"
          draggable="false"
        >
        <span class="category-badge">${catDisplay}</span>
        <div class="zoom-hint" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <span>Preview</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-id">ID: ${item.id}</span>
        </div>
        <div class="card-title">${item.title}</div>
        <a class="btn-whatsapp" href="${waURL}" target="_blank" rel="noopener">
          ${t("orderWhatsapp")}
        </a>
      </div>
    `;

    // Attach error handler after DOM insertion
    const imgEl = card.querySelector("img");
    imgEl.addEventListener("error", () => handleImageError(imgEl, item, 1), { once: true });

    card.querySelector(".card-img-wrap").addEventListener("click", () => openPreview(item));

    gallery.appendChild(card);
  });

  enableLazyLoading();
  updatePagination();
}

// -----------------------------------------------
// Lazy Loading via IntersectionObserver
// -----------------------------------------------
const imgObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute("data-src");
    }
    imgObserver.unobserve(img);
  });
}, { rootMargin: "150px" });

function enableLazyLoading() {
  document.querySelectorAll("img[data-src]").forEach(img => imgObserver.observe(img));
}

// -----------------------------------------------
// Filter
// -----------------------------------------------
function filterGallery() {
  const q = searchInput.value.trim().toLowerCase();

  filteredData = allData.filter(item => {
    const itemCat = normalizeCategory(item.category);
    const catOk   = currentCategory === "all" || itemCat === currentCategory;
    const qOk     = !q || item.id.toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
    return catOk && qOk;
  });

  currentPage = 1;
  renderGallery();
}

// -----------------------------------------------
// Pagination
// -----------------------------------------------
function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  pageNumber.textContent = t("pageLabel", currentPage, totalPages);
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages;
}

prevBtn.addEventListener("click", () => {
  if (currentPage > 1) { currentPage--; renderGallery(); scrollToGallery(); }
});

nextBtn.addEventListener("click", () => {
  const total = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  if (currentPage < total) { currentPage++; renderGallery(); scrollToGallery(); }
});

function scrollToGallery() {
  document.getElementById("gallery-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

// -----------------------------------------------
// Preview Modal
// -----------------------------------------------
function openPreview(item) {
  const initialPath    = getImagePath(item, "jpg");
  previewImage.src     = initialPath;
  previewImage.onerror = () => handleImageError(previewImage, item, 1);
  previewTitle.textContent = item.title;
  previewId.textContent    = `ID: ${item.id}`;
  whatsappBtn.href         = buildWhatsAppURL(item.id, item.title, initialPath);
  whatsappBtn.textContent  = t("orderWhatsapp");
  previewModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closePreview() {
  previewModal.classList.remove("active");
  document.body.style.overflow = "";
  // Stop loading the image to save bandwidth
  previewImage.src = "";
}

closeModalBtn.addEventListener("click", closePreview);
previewModal.addEventListener("click", e => { if (e.target === previewModal) closePreview(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closePreview(); });

// -----------------------------------------------
// Category Tabs
// -----------------------------------------------
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    currentCategory = btn.dataset.category;
    location.hash   = currentCategory === "all" ? "" : currentCategory;
    updateBrowserTitle();
    filterGallery();
  });
});

// -----------------------------------------------
// Search
// -----------------------------------------------
searchInput.addEventListener("input", filterGallery);

// -----------------------------------------------
// Language Switcher
// -----------------------------------------------
languageSelect.value = currentLang;
languageSelect.addEventListener("change", () => setLang(languageSelect.value));
document.addEventListener("langchange", () => { applyTranslations(); filterGallery(); });

function applyTranslations() {
  searchInput.placeholder = t("searchPlaceholder");
  prevBtn.textContent     = t("prevPage");
  nextBtn.textContent     = t("nextPage");

  document.querySelectorAll(".tab").forEach(btn => {
    const cat = btn.dataset.category;
    btn.textContent = t(cat === "all" ? "allCategories" : cat);
  });
  updatePagination();
}

// -----------------------------------------------
// Scroll to Top
// -----------------------------------------------
window.addEventListener("scroll", () => {
  scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
});
scrollTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// -----------------------------------------------
// Browser Title
// -----------------------------------------------
function updateBrowserTitle() {
  document.title = currentCategory === "all"
    ? "Qurishi Wallpapers"
    : `Qurishi Wallpapers — ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}`;
}

// -----------------------------------------------
// Hash Routing on Load
// -----------------------------------------------
window.addEventListener("load", () => {
  const hash = location.hash.replace("#", "").trim();
  if (hash) {
    const btn = document.querySelector(`.tab[data-category="${hash}"]`);
    if (btn) {
      document.querySelectorAll(".tab").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentCategory = hash;
    }
  }
  updateBrowserTitle();
});

// -----------------------------------------------
// Image Protection
// -----------------------------------------------
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("dragstart",   e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.ctrlKey && ["s", "u", "p"].includes(e.key.toLowerCase())) e.preventDefault();
});

// -----------------------------------------------
// Init — Load data.json
// -----------------------------------------------
(async function init() {
  initTheme();
  showSkeletons();
  applyTranslations();

  try {
    const res = await fetch("./data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allData = await res.json();
    filterGallery();
  } catch (err) {
    console.error("[Qurishi]", err);
    gallery.innerHTML = `
      <p style="color:var(--text-muted);padding:60px 20px;text-align:center;grid-column:1/-1">
        Could not load gallery data. Please try again later.
      </p>`;
  }
})();
