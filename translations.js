// ===================================
// translations.js — Qurishi Wallpapers
// Supports: Pashto (ps), Dari (fa), English (en)
// ===================================

const TRANSLATIONS = {

  ps: {
    siteTitle:     "قریشی والپيپر",
    searchPlaceholder: "د وال پیپر نمبر یا نوم ولټوئ...",
    allCategories: "ټول",
    wall:          "دیوال",
    ceiling:       "چت",
    flat:          "تکه یی مسطح",
    orderWhatsapp: "📲 واټساپ امر",
    prevPage:      "←  شا ته",
    nextPage:      "مخ →",
    pageOf:        "مخ",
    of:            "نه",
    noResults:     "هیڅ پایله ونه موندل شوه.",
    fullscreenAlt: "د والپیپر لیدل",
    closePreview:  "وتل",
    previewTitle:  "د ډیزاین معلومات",
    whatsappMsg:   (id, title, url) =>
      `السلام علیکم\nزه دغه ډیزاین غواړم.\n\nID: ${id}\nعنوان: ${title}\n\nانځور:\n${url}`,
    loadingText:   "لوډیږي...",
    pageLabel:     (cur, total) => `مخ ${cur} / ${total}`,
  },

  fa: {
    siteTitle:     "کاغذ دیواری قریشی",
    searchPlaceholder: "شماره یا عنوان طرح را جستجو کنید...",
    allCategories: "همه",
    wall:          "دیوار",
    ceiling:       "سقف/چت",
    flat:          "مسطح تکه یی",
    orderWhatsapp: "📲 سفارش واتساپ",
    prevPage:      "← قبلی",
    nextPage:      "بعدی →",
    pageOf:        "صفحه",
    of:            "از",
    noResults:     "هیچ نتیجه‌ای یافت نشد.",
    fullscreenAlt: "پیش‌نمایش کاغذ دیواری",
    closePreview:  "بستن",
    previewTitle:  "اطلاعات طرح",
    whatsappMsg:   (id, title, url) =>
      `السلام علیکم\nمن این طرح را می‌خواهم.\n\nID: ${id}\nعنوان: ${title}\n\nتصویر:\n${url}`,
    loadingText:   "در حال بارگذاری...",
    pageLabel:     (cur, total) => `صفحه ${cur} / ${total}`,
  },

  en: {
    siteTitle:     "Qurishi 3D Wallpapers",
    searchPlaceholder: "Search by ID or title...",
    allCategories: "All",
    wall:          "Wall",
    ceiling:       "Ceiling",
    flat:          "Flat",
    orderWhatsapp: "📲 Order on WhatsApp",
    prevPage:      "← Prev",
    nextPage:      "Next →",
    pageOf:        "Page",
    of:            "of",
    noResults:     "No results found.",
    fullscreenAlt: "Wallpaper preview",
    closePreview:  "Close",
    previewTitle:  "Design Details",
    whatsappMsg:   (id, title, url) =>
      `السلام علیکم\nI want this wallpaper.\n\nID: ${id}\nTitle: ${title}\n\nImage:\n${url}`,
    loadingText:   "Loading...",
    pageLabel:     (cur, total) => `Page ${cur} / ${total}`,
  }

};

// Current active language (default English)
let currentLang = localStorage.getItem("qurishi_lang") || "en";

/**
 * Get a translation string for the current language.
 * @param {string} key
 * @param {...any} args — forwarded to function values
 */
function t(key, ...args) {
  const val = TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return typeof val === "function" ? val(...args) : val;
}

/**
 * Change the active language and persist it.
 * Dispatches a "langchange" event on document.
 */
function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem("qurishi_lang", lang);
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}
