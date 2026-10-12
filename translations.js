// translations.js — Qurishi Wallpapers
// Pashto (ps) is the DEFAULT language. Dari (fa) and English (en) are chosen explicitly by the visitor.
// Every customer-facing string lives here.
"use strict";

const TRANSLATIONS = {
  ps: {
    htmlLang: "ps", dir: "rtl",
    title: "قریشی ۳ډي والپیپر | Qurishi 3D Wallpapers",
    brand: "قریشی", brandSub: "۳ډي والپیپر", home: "کور",
    heroTitle: "قریشی ۳ډي والپیپر",
    tagline: "دیوال · چت · فلیټ — مستقیم په واټساپ کې امر وکړئ",
    searchPlaceholder: "د ډیزاین شمېره یا نوم ولټوئ…",
    categories: "کټګورۍ",
    all: "ټول", wall: "وال", ceiling: "چت", flat: "فلیټ",
    order: "په واټساپ امر وکړئ",
    prev: "مخکینی", next: "راتلونکی",
    pageLabel: (c, t) => `مخ ${c} / ${t}`,
    noResults: "هیڅ پایله ونه موندل شوه.",
    loadError: "د ګیلرۍ معلومات نه لوستل کېږي. مهرباني وکړئ وروسته بیا هڅه وکړئ.",
    preview: "کتنه", previewAlt: (title) => `د والپیپر کتنه: ${title}`, cardAlt: (title, cat) => `${title} — ${cat}`,
    close: "تړل", theme: "د رنګ حالت بدلول", language: "ژبه", scrollTop: "پورته",
    skip: "اصلي منځپانګې ته تلل", idLabel: "شمېره",
    rights: "© 2026 قریشی چاپ · ټول حقوق خوندي دي",
    whatsappMsg: (id, title, url) => `السلام علیکم\nزه دغه ډیزاین غواړم.\n\nID: ${id}\nعنوان: ${title}\n\nانځور:\n${url}`,
  },
  fa: {
    htmlLang: "fa-AF", dir: "rtl",
    title: "کاغذ دیواری قریشی | Qurishi 3D Wallpapers",
    brand: "قریشی", brandSub: "والپیپر سه‌بعدی", home: "صفحه اصلی",
    heroTitle: "کاغذ دیواری سه‌بعدی قریشی",
    tagline: "دیوار · سقف · فلت — سفارش مستقیم از طریق واتساپ",
    searchPlaceholder: "شماره یا نام طرح را جستجو کنید…",
    categories: "دسته‌بندی‌ها",
    all: "همه", wall: "دیوار", ceiling: "سقف", flat: "فلت",
    order: "سفارش از طریق واتساپ",
    prev: "قبلی", next: "بعدی",
    pageLabel: (c, t) => `صفحه ${c} / ${t}`,
    noResults: "نتیجه‌ای یافت نشد.",
    loadError: "بارگذاری گالری ممکن نشد. لطفاً بعداً دوباره تلاش کنید.",
    preview: "پیش‌نمایش", previewAlt: (title) => `پیش‌نمایش کاغذ دیواری: ${title}`, cardAlt: (title, cat) => `${title} — ${cat}`,
    close: "بستن", theme: "تغییر حالت روشن/تاریک", language: "زبان", scrollTop: "بالا",
    skip: "رفتن به محتوای اصلی", idLabel: "شماره",
    rights: "© 2026 چاپ قریشی · تمام حقوق محفوظ است",
    whatsappMsg: (id, title, url) => `السلام علیکم\nمن این طرح را می‌خواهم.\n\nID: ${id}\nعنوان: ${title}\n\nتصویر:\n${url}`,
  },
  en: {
    htmlLang: "en", dir: "ltr",
    title: "Qurishi 3D Wallpapers",
    brand: "Qurishi", brandSub: "3D Wallpapers", home: "Home",
    heroTitle: "Qurishi 3D Wallpapers",
    tagline: "Wall · Ceiling · Flat — Order direct on WhatsApp",
    searchPlaceholder: "Search by ID or title…",
    categories: "Categories",
    all: "All", wall: "Wall", ceiling: "Ceiling", flat: "Flat",
    order: "Order on WhatsApp",
    prev: "Previous", next: "Next",
    pageLabel: (c, t) => `Page ${c} / ${t}`,
    noResults: "No results found.",
    loadError: "Could not load the gallery. Please try again later.",
    preview: "Preview", previewAlt: (title) => `Wallpaper preview: ${title}`, cardAlt: (title, cat) => `${title} — ${cat}`,
    close: "Close", theme: "Toggle dark/light mode", language: "Language", scrollTop: "Back to top",
    skip: "Skip to main content", idLabel: "ID",
    rights: "© 2026 Qurishi Printing · All rights reserved",
    whatsappMsg: (id, title, url) => `السلام علیکم\nI want this wallpaper.\n\nID: ${id}\nTitle: ${title}\n\nImage:\n${url}`,
  },
};

const DEFAULT_LANG = "ps";
const LANG_KEY = "qurishi_lang";

// Pashto unless the visitor EXPLICITLY picked another language earlier. Browser language is deliberately ignored.
function readStoredLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v && TRANSLATIONS[v] ? v : DEFAULT_LANG;
  } catch { return DEFAULT_LANG; }
}

let currentLang = readStoredLang();

function t(key, ...args) {
  const val = TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
  return typeof val === "function" ? val(...args) : val;
}

function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* private mode */ }
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}
