// admin.js — Qurishi admin panel. All data comes from authenticated /api/admin/* endpoints.
// DOM is built with textContent only (no innerHTML) so titles/filenames can never inject markup.
"use strict";

const L = {
  ps: { dir: "rtl", lang: "ps", appName: "اداري پینل", username: "کارن نوم", password: "پټنوم", signIn: "ننوتل", signingIn: "…", logout: "وتل", dashboard: "ډشبورډ", upload: "پورته کول", manager: "مدیریت", analytics: "شمېرنې", activity: "فعالیت", settings: "تنظیمات",
    total: "ټول والپیپرونه", wall: "وال", ceiling: "چت", flat: "فلیټ", visitorsToday: "نن لیدونکي", visitorsWeek: "۷ ورځې لیدونکي", visitorsMonth: "۳۰ ورځې لیدونکي", pageViews: "مخونه لیدل شوي", whatsapp: "واټساپ کلیکونه", topViewed: "ډېر لیدل شوي", topOrdered: "ډېر امر شوي", recentUploads: "وروستي پورته شوي", recentActivity: "وروستی فعالیت", none: "—",
    dropHint: "عکسونه دلته کش کړئ یا د ټاکلو لپاره کلیک وکړئ", category: "کټګوري", clearAll: "ټول پاکول", uploadAll: "ټول پورته کړئ", retry: "بیا هڅه", remove: "لرې کول", ready: "چمتو", uploading: "پورته کېږي…", done: "بشپړ شو", failed: "ناکام", prep: "کوچنی کول…",
    orig: "اصلي", opt: "پروسس شوی", saved: "کمښت", format: "بڼه", dims: "اندازه", overall: "ټولیز پرمختګ", dup: "دا عکس مخکې شته", notImage: "دا فایل عکس نه دی",
    search: "لټون…", all: "ټول", newest: "نوي", oldest: "زاړه", mostViewed: "ډېر لیدل شوي", mostOrdered: "ډېر امر شوي", sort: "ترتیب", edit: "سمول", title: "سرلیک", save: "خوندي کول", cancel: "لغوه", del: "ړنګول", confirmDel: (n) => `ایا ډاډه یاست چې ${n} والپیپر/ونه ړنګ کړئ؟ دا بیرته نه راګرځي.`, selected: (n) => `${n} ټاکل شوي`, moveTo: "کټګورۍ ته لیږدول", apply: "پلي کول", clearSel: "ټاکنه پاکول", loadMore: "نور ښکاره کړئ", views: "لیدنې", orders: "امرونه",
    daily: "ورځنی (۳۰ ورځې)", byCategory: "د کټګورۍ له مخې", visitors: "لیدونکي", allTime: "ټول وخت", noData: "تر اوسه معلومات نشته", audit: "د اداري کړنو لیست", time: "وخت", action: "کړنه", detail: "توضیح",
    github: "GitHub", analyticsStore: "د شمېرنو ذخیره", connected: "وصل شوی", notConfigured: "نه دی تنظیم شوی", memOnly: "یوازې په حافظه کې (دایمي نه دی) — Upstash Redis تنظیم کړئ", persistent: "دایمي", session: "ناسته تر", language: "ژبه", limits: "حدود", lowMeta: (n) => `${n} والپیپرونه د اندازې معلومات نه لري — په GitHub کې د Auto Update Gallery workflow چلوئ.`,
    errAuth: "ننوتل ناکام شو", errNet: "شبکې ستونزه", sessionEnd: "ناسته پای ته ورسېده. بیا ننوځئ.", dupOf: "تکراري", moved: "لیږدول شو", saved2: "خوندي شو", deleted: "ړنګ شو", cdnNote: "نوي عکسونه ښايي ۱–۲ دقیقې وروسته په سایټ کې ښکاره شي (Vercel بیا ډیپلای کوي)." },
  en: { dir: "ltr", lang: "en", appName: "Admin", username: "Username", password: "Password", signIn: "Sign in", signingIn: "…", logout: "Log out", dashboard: "Dashboard", upload: "Upload", manager: "Manager", analytics: "Analytics", activity: "Activity", settings: "Settings",
    total: "Total wallpapers", wall: "Wall", ceiling: "Ceiling", flat: "Flat", visitorsToday: "Visitors today", visitorsWeek: "Visitors (7 days)", visitorsMonth: "Visitors (30 days)", pageViews: "Page views", whatsapp: "WhatsApp clicks", topViewed: "Most viewed", topOrdered: "Most ordered", recentUploads: "Recent uploads", recentActivity: "Recent activity", none: "—",
    dropHint: "Drag images here or click to choose", category: "Category", clearAll: "Clear all", uploadAll: "Upload all", retry: "Retry", remove: "Remove", ready: "Ready", uploading: "Uploading…", done: "Done", failed: "Failed", prep: "Shrinking…",
    orig: "Original", opt: "Optimized", saved: "Saved", format: "Format", dims: "Dimensions", overall: "Overall progress", dup: "Duplicate image", notImage: "Not an image file",
    search: "Search…", all: "All", newest: "Newest", oldest: "Oldest", mostViewed: "Most viewed", mostOrdered: "Most ordered", sort: "Sort", edit: "Edit", title: "Title", save: "Save", cancel: "Cancel", del: "Delete", confirmDel: (n) => `Delete ${n} wallpaper(s)? This cannot be undone.`, selected: (n) => `${n} selected`, moveTo: "Move to category", apply: "Apply", clearSel: "Clear selection", loadMore: "Show more", views: "views", orders: "orders",
    daily: "Daily (30 days)", byCategory: "By category", visitors: "Visitors", allTime: "All time", noData: "No data yet", audit: "Admin audit log", time: "Time", action: "Action", detail: "Detail",
    github: "GitHub", analyticsStore: "Analytics storage", connected: "Connected", notConfigured: "Not configured", memOnly: "Memory only (not persistent) — configure Upstash Redis", persistent: "Persistent", session: "Session expires", language: "Language", limits: "Limits", lowMeta: (n) => `${n} wallpapers have no dimension metadata — run the "Auto Update Gallery" workflow on GitHub.`,
    errAuth: "Sign-in failed", errNet: "Network problem", sessionEnd: "Session ended. Please sign in again.", dupOf: "Duplicate of", moved: "Moved", saved2: "Saved", deleted: "Deleted", cdnNote: "New images appear on the live site after ~1–2 minutes (Vercel redeploys)." },
};

const S = { lang: localStorage.getItem("qw_admin_lang") || "ps", csrf: null, me: null, view: "dashboard", items: [], analytics: null, audit: [],
  sel: new Set(), q: "", cat: "all", sort: "newest", shown: 60, queue: [], uploadCat: "wall", uploading: false };
const t = (k, ...a) => { const v = L[S.lang][k] ?? L.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };
const CATS = ["wall", "ceiling", "flat"];

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (k === "value") n.value = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const $app = document.getElementById("app");
const fmtKB = (b) => (b >= 1048576 ? (b / 1048576).toFixed(2) + " MB" : Math.round(b / 1024) + " KB");
const fmtN = (n) => Number(n || 0).toLocaleString(S.lang === "ps" ? "en-US" : "en-US");
const key = (i) => `${i.category}/${i.id}`;
const imgSrc = (i) => "/" + (i.thumbnail || i.image || `images/${i.category}/${i.id}.webp`);
function toast(msg, bad) { const n = h("div", { class: "toast " + (bad ? "bad" : ""), role: "status", text: msg }); document.body.append(n); setTimeout(() => n.remove(), 3500); }

// ---------- API ----------
async function api(method, url, body, extra = {}) {
  let res;
  try {
    res = await fetch(url, { method, credentials: "same-origin", headers: { ...(body && !(body instanceof Blob) ? { "Content-Type": "application/json" } : {}), ...(S.csrf ? { "X-CSRF-Token": S.csrf } : {}), ...extra },
      body: body ? (body instanceof Blob ? body : JSON.stringify(body)) : undefined });
  } catch { throw new Error(t("errNet")); }
  if (res.status === 401 && url !== "/api/admin/login") { const was = S.csrf; S.csrf = null; if (was) renderLogin(t("sessionEnd")); throw new Error(t("sessionEnd")); }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data?.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}

// ---------- login ----------
function setLang(l) { S.lang = l; localStorage.setItem("qw_admin_lang", l); document.documentElement.lang = L[l].lang; document.documentElement.dir = L[l].dir; S.csrf ? render() : renderLogin(); }
function langSelect() { return h("select", { "aria-label": t("language"), onchange: (e) => setLang(e.target.value) }, h("option", { value: "ps", selected: S.lang === "ps" }, "پښتو"), h("option", { value: "en", selected: S.lang === "en" }, "English")); }

function renderLogin(msg = "") {
  document.documentElement.lang = L[S.lang].lang; document.documentElement.dir = L[S.lang].dir;
  const err = h("p", { class: "err", role: "alert", text: msg });
  const u = h("input", { id: "u", autocomplete: "username", required: true });
  const p = h("input", { id: "p", type: "password", autocomplete: "current-password", required: true });
  const btn = h("button", { class: "btn primary", type: "submit", text: t("signIn") });
  const form = h("form", { class: "login", onsubmit: async (e) => {
    e.preventDefault(); btn.disabled = true; btn.textContent = t("signingIn"); err.textContent = "";
    try { const r = await api("POST", "/api/admin/login", { username: u.value, password: p.value }); S.csrf = r.csrf; await boot(); }
    catch (x) { err.textContent = x.status === 401 ? t("errAuth") : x.message; btn.disabled = false; btn.textContent = t("signIn"); p.value = ""; }
  } }, h("img", { src: "../assets/logo.png", alt: "" }), h("h1", { text: t("appName") + " — Qurishi" }),
    h("label", { class: "f", for: "u" }, t("username"), u), h("label", { class: "f", for: "p" }, t("password"), p), err, btn, langSelect());
  $app.replaceChildren(form); u.focus();
}

// ---------- shell ----------
const VIEWS = ["dashboard", "upload", "manager", "analytics", "activity", "settings"];
async function go(v) { S.view = v; await render(); }
async function render() {
  const nav = h("nav", { class: "nav", "aria-label": "Admin" }, VIEWS.map((v) => h("button", { class: S.view === v ? "on" : "", "aria-current": S.view === v ? "page" : false, onclick: () => go(v), text: t(v) })));
  const side = h("aside", { class: "side" }, h("div", { class: "brand" }, h("img", { src: "../assets/logo.png", alt: "" }), t("appName")), nav, h("div", { class: "spacer" }),
    h("div", { class: "row" }, langSelect(), h("button", { class: "btn sm", onclick: logout, text: t("logout") })));
  const main = h("main", { class: "main", id: "main" }, h("p", { class: "muted", text: "…" }));
  $app.replaceChildren(h("div", { class: "shell" }, side, main));
  document.documentElement.dir = L[S.lang].dir; document.documentElement.lang = L[S.lang].lang;
  try { main.replaceChildren(...(await views[S.view]()).filter(Boolean)); } catch (e) { if (S.csrf) main.replaceChildren(h("p", { class: "bad", text: e.message })); }
}
async function logout() { try { await api("POST", "/api/admin/logout", {}); } catch { /* ignore */ } S.csrf = null; renderLogin(); }

async function loadItems() { S.items = (await api("GET", "/api/admin/wallpapers")).items; }
async function loadAnalytics() { S.analytics = await api("GET", "/api/admin/analytics"); }
const statCard = (n, label) => h("div", { class: "stat" }, h("b", { text: fmtN(n) }), h("span", { text: label }));
const titleOf = (k) => (S.items.find((i) => key(i) === k) || {}).title || k;
const topTable = (rows, unit) => rows.length ? h("table", {}, rows.map((r) => h("tr", {}, h("td", { text: titleOf(r.key) }), h("td", { class: "muted", text: r.key }), h("td", { text: `${fmtN(r.count)} ${unit}` })))) : h("p", { class: "muted", text: t("noData") });

// ---------- views ----------
const views = {
  async dashboard() {
    await Promise.all([loadItems(), loadAnalytics(), api("GET", "/api/admin/audit").then((r) => { S.audit = r.entries; })]);
    const c = (k) => S.items.filter((i) => i.category === k).length, a = S.analytics;
    const recent = [...S.items].filter((i) => i.createdAt).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 6);
    const missing = S.items.filter((i) => !i.width).length;
    return [h("h2", { class: "title", text: t("dashboard") }),
      !a.persistent && h("div", { class: "banner", text: t("memOnly") }), missing > 0 && h("div", { class: "banner", text: t("lowMeta", missing) }),
      h("div", { class: "grid stats" }, statCard(S.items.length, t("total")), statCard(c("wall"), t("wall")), statCard(c("ceiling"), t("ceiling")), statCard(c("flat"), t("flat")),
        statCard(a.visitors.today, t("visitorsToday")), statCard(a.visitors.week, t("visitorsWeek")), statCard(a.visitors.month, t("visitorsMonth")), statCard(a.totals.pageViews, t("pageViews")), statCard(a.totals.whatsapp, t("whatsapp"))),
      h("div", { class: "grid cols2", style: "margin-block-start:16px" }, h("div", { class: "panel" }, h("h3", { text: t("topViewed") }), topTable(a.topViewed.slice(0, 5), t("views"))),
        h("div", { class: "panel" }, h("h3", { text: t("topOrdered") }), topTable(a.topOrdered.slice(0, 5), t("orders")))),
      h("h3", { text: t("recentUploads") }), recent.length ? h("div", { class: "wgrid" }, recent.map((i) => h("div", { class: "wc" }, h("img", { class: "im", src: imgSrc(i), alt: i.title, loading: "lazy" }), h("div", { class: "inf" }, h("b", { text: i.title }), h("span", { class: "muted", text: key(i) }))))) : h("p", { class: "muted", text: t("noData") }),
      h("h3", { text: t("recentActivity") }), auditTable(S.audit.slice(0, 8))];
  },

  async upload() { return uploadView(); },
  async manager() { await loadItems(); return managerView(); },

  async analytics() {
    await Promise.all([loadItems(), loadAnalytics()]);
    const a = S.analytics, max = Math.max(1, ...a.daily.map((d) => Math.max(d.pv, d.wa)));
    const chart = h("div", { class: "chart", role: "img", "aria-label": t("daily") }, a.daily.map((d) => h("div", { title: `${d.date}: ${d.pv} / ${d.wa} / ${d.visitors}` }, h("i", { class: "wa", style: `height:${(d.wa / max) * 100}%` }), h("i", { class: "pv", style: `height:${(d.pv / max) * 100}%` }))));
    const ct = a.categories;
    return [h("h2", { class: "title", text: t("analytics") }), !a.persistent && h("div", { class: "banner", text: t("memOnly") }),
      h("div", { class: "grid stats" }, statCard(a.visitors.today, t("visitorsToday")), statCard(a.visitors.week, t("visitorsWeek")), statCard(a.visitors.month, t("visitorsMonth")), statCard(a.visitors.all, `${t("visitors")} (${t("allTime")})`), statCard(a.totals.pageViews, t("pageViews")), statCard(a.totals.whatsapp, t("whatsapp"))),
      h("div", { class: "panel", style: "margin-block-start:16px" }, h("h3", { text: t("daily") }), chart,
        h("div", { class: "legend" }, h("span", { style: "--c:var(--gold)", text: t("pageViews") }), h("span", { style: "--c:var(--ok)", text: t("whatsapp") }))),
      h("div", { class: "grid cols2", style: "margin-block-start:16px" },
        h("div", { class: "panel" }, h("h3", { text: t("byCategory") }), h("table", {}, h("tr", {}, h("th", { text: t("category") }), h("th", { text: t("views") }), h("th", { text: t("orders") })), CATS.map((k) => h("tr", {}, h("td", { text: t(k) }), h("td", { text: fmtN(ct.views[k]) }), h("td", { text: fmtN(ct.whatsapp[k]) }))))),
        h("div", { class: "panel" }, h("h3", { text: t("recentActivity") }), a.recent.length ? h("table", {}, a.recent.slice(0, 12).map((r) => h("tr", {}, h("td", { class: "muted", text: new Date(r.t).toLocaleString() }), h("td", { text: r.type === "wa" ? t("whatsapp") : t("views") }), h("td", { text: titleOf(r.key) })))) : h("p", { class: "muted", text: t("noData") }))),
      h("div", { class: "grid cols2", style: "margin-block-start:16px" }, h("div", { class: "panel" }, h("h3", { text: t("topViewed") }), topTable(a.topViewed, t("views"))), h("div", { class: "panel" }, h("h3", { text: t("topOrdered") }), topTable(a.topOrdered, t("orders"))))];
  },

  async activity() { const r = await api("GET", "/api/admin/audit"); return [h("h2", { class: "title", text: t("activity") }), h("div", { class: "panel" }, auditTable(r.entries))]; },

  async settings() {
    const me = await api("GET", "/api/admin/me"), s = me.status;
    const row = (k, v, cls) => h("tr", {}, h("td", { class: "muted", text: k }), h("td", { class: cls || "", text: v }));
    return [h("h2", { class: "title", text: t("settings") }), h("div", { class: "panel" }, h("table", {},
      row(t("username"), me.user), row(t("github"), s.github ? `${t("connected")} — ${s.githubRepo}` : t("notConfigured"), s.github ? "ok" : "bad"),
      row(t("analyticsStore"), s.analyticsPersistent ? t("persistent") : t("memOnly"), s.analyticsPersistent ? "ok" : "warn"),
      row(t("session"), new Date(me.expiresAt).toLocaleString()),
      row(t("limits"), `≤ ${s.limits.maxUploadMB} MB / ${t("upload")} · ${s.limits.maxDimension}px · ≈${s.limits.targetKB} KB`),
      row(t("language"), ""))), h("div", { style: "margin-block-start:12px" }, langSelect())];
  },
};
const auditTable = (rows) => rows.length ? h("table", {}, h("tr", {}, h("th", { text: t("time") }), h("th", { text: t("action") }), h("th", { text: t("detail") })), rows.map((r) => h("tr", {}, h("td", { class: "muted", text: new Date(r.t).toLocaleString() }), h("td", { text: r.action }), h("td", { text: r.detail })))) : h("p", { class: "muted", text: t("noData") });

// ---------- upload ----------
let qid = 0;
async function shrinkIfNeeded(file) {
  const LIMIT = 4.2 * 1024 * 1024;
  if (file.size <= LIMIT) return file;
  // Host body limit is ~4.5 MB: downscale huge originals in the browser first (the server still does the real optimization).
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  let scale = Math.min(1, 2600 / Math.max(bmp.width, bmp.height)), q = 0.9;
  for (let i = 0; i < 6; i++) {
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= LIMIT) return blob;
    scale *= 0.8; q = Math.max(0.75, q - 0.05);
  }
  throw new Error("Image too large");
}
function xhrUpload(url, blob, headers, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("POST", url); x.withCredentials = true;
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch { /* ignore */ } x.status >= 200 && x.status < 300 ? resolve(d) : reject(Object.assign(new Error(d.error || `HTTP ${x.status}`), { status: x.status, data: d })); };
    x.onerror = () => reject(new Error(t("errNet"))); x.ontimeout = x.onerror; x.timeout = 120000; x.send(blob);
  });
}
async function uploadOne(q, refresh) {
  q.status = "uploading"; q.progress = 0; q.error = ""; refresh();
  try {
    const blob = await shrinkIfNeeded(q.file);
    const r = await xhrUpload(`/api/admin/upload?category=${q.category}&name=${encodeURIComponent(q.file.name)}`, blob, { "X-CSRF-Token": S.csrf, "X-Original-Size": String(q.file.size), "Content-Type": "application/octet-stream" }, (p) => { q.progress = p * 0.95; refresh(); });
    q.status = "done"; q.progress = 1; q.result = r;
  } catch (e) {
    if (e.status === 401) { S.csrf = null; renderLogin(t("sessionEnd")); return; }
    q.status = "error"; q.error = e.status === 409 ? `${t("dup")} (${e.data?.duplicateOf || ""})` : e.status === 415 ? t("notImage") : e.message;
  }
  refresh();
}
function uploadView() {
  const list = h("div", { class: "queue" }), overall = h("div", { class: "bar" }, h("i")), overallTxt = h("span", { class: "muted" });
  const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: (e) => { add(e.target.files); e.target.value = ""; } });
  const upBtn = h("button", { class: "btn primary", onclick: run }), clr = h("button", { class: "btn", onclick: () => { if (S.uploading) return; S.queue.forEach((q) => URL.revokeObjectURL(q.url)); S.queue = []; refresh(); }, text: t("clearAll") });
  const catSel = h("select", { onchange: (e) => { S.uploadCat = e.target.value; S.queue.forEach((q) => { if (q.status !== "done") q.category = S.uploadCat; }); refresh(); } }, CATS.map((c) => h("option", { value: c, selected: S.uploadCat === c, text: t(c) })));
  const drop = h("div", { class: "drop", tabindex: "0", role: "button", onclick: () => input.click(), onkeydown: (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.click()),
    ondragover: (e) => { e.preventDefault(); drop.classList.add("over"); }, ondragleave: () => drop.classList.remove("over"), ondrop: (e) => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); } }, t("dropHint"));

  function add(files) {
    for (const f of files) {
      if (!f.type.startsWith("image/")) { toast(`${f.name}: ${t("notImage")}`, true); continue; }
      if (S.queue.some((q) => q.file.name === f.name && q.file.size === f.size && q.file.lastModified === f.lastModified)) continue;
      S.queue.push({ id: ++qid, file: f, url: URL.createObjectURL(f), category: S.uploadCat, status: "ready", progress: 0, error: "", result: null });
    }
    refresh();
  }
  function refresh() {
    list.replaceChildren(...S.queue.map((q) => {
      const st = q.status === "done" ? h("span", { class: "ok st", text: t("done") }) : q.status === "error" ? h("span", { class: "bad st", text: `${t("failed")}: ${q.error}` }) : h("span", { class: "muted st", text: t(q.status === "uploading" ? "uploading" : "ready") });
      const info = q.result ? h("div", { class: "st muted" }, `${t("orig")}: ${fmtKB(q.result.stats.originalSize)} → ${t("opt")}: ${fmtKB(q.result.stats.optimizedSize)} (−${q.result.stats.reductionPct}%) · ${q.result.stats.format.toUpperCase()} · ${q.result.stats.width}×${q.result.stats.height} · ${q.result.item.category}/${q.result.item.id}`) : null;
      const cat = h("select", { disabled: q.status === "uploading" || q.status === "done", onchange: (e) => { q.category = e.target.value; } }, CATS.map((c) => h("option", { value: c, selected: q.category === c, text: t(c) })));
      return h("div", { class: "qi" }, h("img", { src: q.url, alt: "" }), h("div", {}, h("div", { class: "nm", text: `${q.file.name} · ${fmtKB(q.file.size)}` }), h("div", { class: "bar" }, h("i", { style: `width:${Math.round(q.progress * 100)}%` })), st, info),
        h("div", { style: "display:grid;gap:6px" }, cat, h("button", { class: "btn sm", disabled: q.status === "uploading", onclick: () => { URL.revokeObjectURL(q.url); S.queue = S.queue.filter((x) => x !== q); refresh(); }, text: t("remove") })));
    }));
    const n = S.queue.length, done = S.queue.filter((q) => q.status === "done").length, pending = S.queue.filter((q) => q.status === "ready" || q.status === "error").length;
    const frac = n ? S.queue.reduce((s, q) => s + (q.status === "done" ? 1 : q.progress), 0) / n : 0;
    overall.firstChild.style.width = Math.round(frac * 100) + "%"; overallTxt.textContent = n ? `${t("overall")}: ${done}/${n}` : "";
    const failed = S.queue.some((q) => q.status === "error");
    upBtn.textContent = failed && pending === S.queue.filter((q) => q.status === "error").length ? t("retry") : t("uploadAll");
    upBtn.disabled = S.uploading || pending === 0; clr.disabled = S.uploading;
  }
  async function run() {
    S.uploading = true; refresh();
    const todo = S.queue.filter((q) => q.status === "ready" || q.status === "error");
    const worker = async () => { while (todo.length) await uploadOne(todo.shift(), refresh); };
    await Promise.all([worker(), worker()]); // 2 at a time; one failure never stops the rest
    S.uploading = false; refresh();
    if (S.queue.some((q) => q.status === "done")) toast(t("cdnNote"));
  }
  refresh();
  return [h("h2", { class: "title", text: t("upload") }), h("div", { class: "toolbar" }, h("label", { class: "f" }, t("category"), catSel)), drop, input,
    h("div", { class: "toolbar", style: "margin-block-start:14px" }, upBtn, clr, h("div", { style: "flex:1;min-width:160px" }, overall, overallTxt)), list];
}

// ---------- manager ----------
function managerView() {
  const grid = h("div", { class: "wgrid" }), bulk = h("div", { class: "bulk", hidden: true }), more = h("button", { class: "btn", text: t("loadMore"), onclick: () => { S.shown += 60; draw(); } });
  const q = h("input", { type: "search", placeholder: t("search"), value: S.q, "aria-label": t("search"), oninput: (e) => { S.q = e.target.value; S.shown = 60; draw(); } });
  const cat = h("select", { "aria-label": t("category"), onchange: (e) => { S.cat = e.target.value; S.shown = 60; draw(); } }, ["all", ...CATS].map((c) => h("option", { value: c, selected: S.cat === c, text: t(c) })));
  const sort = h("select", { "aria-label": t("sort"), onchange: (e) => { S.sort = e.target.value; draw(); } }, [["newest", "newest"], ["oldest", "oldest"], ["views", "mostViewed"], ["orders", "mostOrdered"]].map(([v, k]) => h("option", { value: v, selected: S.sort === v, text: t(k) })));
  const sorters = { newest: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""), oldest: (a, b) => (a.createdAt || "9").localeCompare(b.createdAt || "9"), views: (a, b) => b.views - a.views, orders: (a, b) => b.whatsappClicks - a.whatsappClicks };

  function draw() {
    const needle = S.q.trim().toLowerCase();
    const rows = S.items.filter((i) => (S.cat === "all" || i.category === S.cat) && (!needle || i.id.toLowerCase().includes(needle) || (i.title || "").toLowerCase().includes(needle)));
    if (S.sort !== "newest" || rows.some((r) => r.createdAt)) rows.sort(sorters[S.sort]);
    grid.replaceChildren(...rows.slice(0, S.shown).map((i) => {
      const k = key(i), on = S.sel.has(k);
      const ck = h("input", { type: "checkbox", class: "ck", checked: on, "aria-label": i.title, onchange: (e) => { e.target.checked ? S.sel.add(k) : S.sel.delete(k); card.classList.toggle("sel", e.target.checked); drawBulk(); } });
      const card = h("div", { class: "wc " + (on ? "sel" : "") }, ck, h("img", { class: "im", src: imgSrc(i), alt: i.title, loading: "lazy", onclick: () => editDialog(i), onerror: (e) => { e.target.onerror = null; e.target.src = "/" + (i.image || ""); } }),
        h("div", { class: "inf" }, h("b", { text: i.title }), h("span", { class: "muted", text: `${t(i.category)} · ${i.id}` }), h("br"),
          h("span", { class: "muted", text: `${fmtN(i.views)} ${t("views")} · ${fmtN(i.whatsappClicks)} ${t("orders")}` }), i.width ? h("div", { class: "muted", text: `${i.width}×${i.height}${i.fileSize ? " · " + fmtKB(i.fileSize) : ""}` }) : null));
      return card;
    }));
    more.hidden = rows.length <= S.shown;
    countTxt.textContent = `${rows.length} / ${S.items.length}`;
    drawBulk();
  }
  function drawBulk() {
    bulk.hidden = S.sel.size === 0;
    const target = h("select", { "aria-label": t("moveTo") }, CATS.map((c) => h("option", { value: c, text: t(c) })));
    bulk.replaceChildren(h("b", { text: t("selected", S.sel.size) }), h("span", { class: "muted", text: t("moveTo") }), target,
      h("button", { class: "btn sm", text: t("apply"), onclick: () => runBulk("category", target.value) }), h("button", { class: "btn sm danger", text: t("del"), onclick: () => runBulk("delete") }), h("button", { class: "btn sm", text: t("clearSel"), onclick: () => { S.sel.clear(); draw(); } }));
  }
  async function runBulk(action, category) {
    const keys = [...S.sel];
    if (action === "delete" && !confirm(t("confirmDel", keys.length))) return;
    try {
      for (let i = 0; i < keys.length; i += 25) await api("POST", "/api/admin/bulk", { action, keys: keys.slice(i, i + 25), category, confirm: action === "delete" ? true : undefined });
      S.sel.clear(); toast(action === "delete" ? t("deleted") : t("moved")); await loadItems(); draw();
    } catch (e) { toast(e.message, true); }
  }
  const countTxt = h("span", { class: "muted" });
  draw();
  return [h("h2", { class: "title", text: t("manager") }), h("div", { class: "toolbar" }, q, cat, sort, countTxt), grid, h("div", { style: "text-align:center;margin-block-start:14px" }, more), bulk];
}

function editDialog(item) {
  const title = h("input", { value: item.title, maxlength: "120", required: true }), cat = h("select", {}, CATS.map((c) => h("option", { value: c, selected: item.category === c, text: t(c) })));
  const dlg = h("dialog", { "aria-label": t("edit") }, h("form", { method: "dialog", onsubmit: async (e) => {
    e.preventDefault();
    const body = { key: key(item) }; if (title.value.trim() !== item.title) body.title = title.value; if (cat.value !== item.category) body.category = cat.value;
    if (Object.keys(body).length === 1) return dlg.close();
    try { await api("PATCH", "/api/admin/wallpapers", body); toast(t("saved2")); dlg.close(); await loadItems(); await render(); } catch (x) { toast(x.message, true); }
  } },
    h("img", { src: "/" + (item.image || item.thumbnail || `images/${item.category}/${item.id}.webp`), alt: item.title, onerror: (e) => { e.target.onerror = null; e.target.src = imgSrc(item); } }),
    h("div", { class: "muted", text: `${key(item)}${item.width ? ` · ${item.width}×${item.height}` : ""}${item.fileSize ? ` · ${fmtKB(item.fileSize)}` : ""}${item.format ? ` · ${item.format.toUpperCase()}` : ""}` }),
    h("label", { class: "f" }, t("title"), title), h("label", { class: "f" }, t("category"), cat),
    h("div", { style: "display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap" }, h("div", { style: "display:flex;gap:8px" }, h("button", { class: "btn primary", type: "submit", text: t("save") }), h("button", { class: "btn", type: "button", onclick: () => dlg.close(), text: t("cancel") })),
      h("button", { class: "btn danger", type: "button", text: t("del"), onclick: async () => {
        if (!confirm(t("confirmDel", 1))) return;
        try { await api("POST", "/api/admin/bulk", { action: "delete", keys: [key(item)], confirm: true }); toast(t("deleted")); dlg.close(); await loadItems(); await render(); } catch (x) { toast(x.message, true); }
      } }))));
  dlg.addEventListener("close", () => dlg.remove()); document.body.append(dlg); dlg.showModal();
}

// ---------- boot ----------
async function boot() {
  try { const me = await api("GET", "/api/admin/me"); S.csrf = me.csrf; S.me = me; await render(); }
  catch { renderLogin(); }
}
boot();
