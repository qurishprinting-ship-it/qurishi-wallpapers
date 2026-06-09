// =============================================
// script.js — Qurishi Premium Wallpapers
// =============================================

"use strict";

// -----------------------------------------------
// Constants
// -----------------------------------------------
const ITEMS_PER_PAGE   = 20;
const WHATSAPP_NUMBER  = "93782008590";
const SKELETON_COUNT   = 8;

// -----------------------------------------------
// State
// -----------------------------------------------
let allData      = [];
let filteredData = [];
let currentCategory = "all";
let currentPage     = 1;

// -----------------------------------------------
// DOM References
// -----------------------------------------------
const gallery       = document.getElementById("gallery");
const searchInput   = document.getElementById("searchInput");
const prevBtn       = document.getElementById("prevBtn");
const nextBtn       = document.getElementById("nextBtn");
const pageNumber    = document.getElementById("pageNumber");
const noResults     = document.getElementById("no-results");
const previewModal  = document.getElementById("previewModal");
const previewImage  = document.getElementById("previewImage");
const previewTitle  = document.getElementById("previewTitle");
const previewId     = document.getElementById("previewId");
const whatsappBtn   = document.getElementById("whatsappBtn");
const closeModalBtn = document.getElementById("closeModal");
const scrollTopBtn  = document.getElementById("scrollTop");
const languageSelect= document.getElementById("languageSelect");

// -----------------------------------------------
// Helper: Normalize Categories for Folders & Filtering
// -----------------------------------------------
function normalizeCategory(rawCategory) {
  if (!rawCategory) return "wall";
  
  // توري واړه کوي او اضافي خالي ځایونه له منځه وړي
  const cat = rawCategory.toLowerCase().trim();
  
  // که په هر ډول لیکل شوی وي، د فولډر اصلي نوم ته یې اړوي
  if (cat === "ceiling" || cat === "celing" || cat === "ceilings") {
    return "ceiling";
  }
  if (cat === "flat" || cat === "flats") {
    return "flat";
  }
  return "wall"; // که بل هر څه وي د ډیفالټ په توګه وال فولډر ته ځي
}

// د عکس اوتومات لاره جوړول
function getImagePath(item) {
  const safeFolder = normalizeCategory(item.category);
  return `images/${safeFolder}/${item.id}.jpg`;
}

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
// Build WhatsApp URL for a given item
// -----------------------------------------------
function buildWhatsAppURL(id, title, imageRelPath) {
  const base    = window.location.origin + window.location.pathname.replace(/index\.html$/, "");
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
    card.style.animationDelay = `${idx * 0.04}s`;

    // په اوتومات ډول د عکس لاره موندل
    const automaticImagePath = getImagePath(item);
    const waURL = buildWhatsAppURL(item.id, item.title, automaticImagePath);

    card.innerHTML = `
      <div class="card-img-wrap">
        <img
          data-src="${automaticImagePath}"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          alt="${item.title}"
          loading="lazy"
        >
        <div class="zoom-hint">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
      </div>
      <div class="card-body">
        <div class="card-id">ID: ${item.id}</div>
        <div class="card-title">${item.title}</div>
        <a class="btn-whatsapp" href="${waURL}" target="_blank" rel="noopener">
          ${t("orderWhatsapp")}
        </a>
      </div>
    `;

    card.querySelector(".card-img-wrap").addEventListener("click", () => {
      openPreview(item);
    });

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
}, { rootMargin: "120px" });

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
    const filterCat = normalizeCategory(currentCategory);

    const catOk = currentCategory === "all" || itemCat === filterCat;
    const qOk   = !q || item.id.toLowerCase().includes(q) || item.title.toLowerCase().includes(q);
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
  const automaticImagePath = getImagePath(item);
  
  previewImage.src         = automaticImagePath;
  previewTitle.textContent = item.title;
  previewId.textContent    = `ID: ${item.id}`;
  whatsappBtn.href         = buildWhatsAppURL(item.id, item.title, automaticImagePath);
  whatsappBtn.textContent  = t("orderWhatsapp");
  previewModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closePreview() {
  previewModal.classList.remove("active");
  document.body.style.overflow = "";
}

closeModalBtn.addEventListener("click", closePreview);

previewModal.addEventListener("click", e => {
  if (e.target === previewModal) closePreview();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closePreview();
});

// -----------------------------------------------
// Category Tabs
// -----------------------------------------------
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
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

languageSelect.addEventListener("change", () => {
  setLang(languageSelect.value);
});

document.addEventListener("langchange", () => {
  applyTranslations();
  filterGallery(); 
});

function applyTranslations() {
  searchInput.placeholder = t("searchPlaceholder");
  prevBtn.textContent     = t("prevPage");
  nextBtn.textContent     = t("nextPage");

  document.querySelectorAll(".tab").forEach(btn => {
    const cat = btn.dataset.category;
    const key = cat === "all" ? "allCategories" : cat;
    btn.textContent = t(key);
  });

  updatePagination();
}

// -----------------------------------------------
// Scroll to Top
// -----------------------------------------------
window.addEventListener("scroll", () => {
  scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// -----------------------------------------------
// Browser Title & Hash
// -----------------------------------------------
function updateBrowserTitle() {
  let title = "Qurishi Wallpapers";
  if (currentCategory !== "all") title += " — " + currentCategory;
  document.title = title;
}

window.addEventListener("load", () => {
  const hash = location.hash.replace("#", "").trim();
  if (hash) {
    const btn = document.querySelector(`.tab[data-category="${hash}"]`);
    if (btn) {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = hash;
    }
  }
  updateBrowserTitle();
});

// -----------------------------------------------
// Image Protection
// -----------------------------------------------
document.addEventListener("contextmenu",  e => e.preventDefault());
document.addEventListener("dragstart",    e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (e.ctrlKey && ["s","u","p"].includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
});

// -----------------------------------------------
// Init — Load data.json
// -----------------------------------------------
(async function init() {
  showSkeletons();
  applyTranslations();

  try {
    const res  = await fetch("./data.json");
    if (!res.ok) throw new Error("Failed to load data.json");
    const data = await res.json();

    allData = data;
    filterGallery();

  } catch (err) {
    console.error("[Qurishi]", err);
    gallery.innerHTML = `<p style="color:#888;padding:40px;text-align:center">
      Could not load gallery data. Please try again later.
    </p>`;
  }
})();
