// admin.js — core of the Qurishi admin dashboard: state, API client, dialogs, login and the app shell.
// All data comes from authenticated /api/admin/* endpoints. DOM is built with textContent only
// (no innerHTML for data), so titles/filenames can never inject markup.
"use strict";

const S = { lang: localStorage.getItem("qw_admin_lang") || "ps", csrf: null, me: null, view: "overview", items: [], cats: [], settings: null, analytics: null, audit: [],
  sel: new Set(), q: "", cat: "all", sort: "newest", featOnly: false, shown: 60, queue: [], uploadCat: "", uploading: false, guard: null };
const t = (k, ...a) => { const v = (L[S.lang] && L[S.lang][k]) ?? L.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };

// ---------- DOM helpers ----------
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (k === "value") n.value = v;
    else if (k === "checked" || k === "disabled" || k === "selected" || k === "hidden") n[k] = !!v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
// Static, trusted icon paths (never built from data).
const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  designs: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  categories: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ordering: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  theme: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.1"/><circle cx="12" cy="7.5" r="1.1"/><circle cx="16" cy="10" r="1.1"/><path d="M12 21a2.5 2.5 0 0 1 0-5h1.5a2 2 0 0 0 0-4"/>',
  account: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  analytics: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>', activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', top: '<path d="M5 4h14M7 14l5-5 5 5M12 9v11"/>', bottom: '<path d="M5 20h14M7 10l5 5 5-5M12 15V4"/>',
  grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5A8 8 0 1 1 21 12z"/>', check: '<path d="m5 12 5 5 9-10"/>', image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
};
function icon(name, cls = "") { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "icon " + cls); s.setAttribute("aria-hidden", "true"); s.innerHTML = ICONS[name] || ""; return s; }
const btn = (label, { cls = "", ic, onclick, title, disabled, type = "button" } = {}) => h("button", { class: "btn " + cls, type, onclick, title, "aria-label": title || label || false, disabled }, ic ? icon(ic, "sm") : null, label ? h("span", { text: label }) : null);

const $app = document.getElementById("app");
const fmtKB = (b) => (b >= 1048576 ? (b / 1048576).toFixed(2) + " MB" : Math.round(b / 1024) + " KB");
const fmtN = (n) => Number(n || 0).toLocaleString("en-US");
const key = (i) => `${i.category}/${i.id}`;
function toast(msg, kind) { const n = h("div", { class: "toast " + (kind || ""), role: "status", text: msg }); document.body.append(n); setTimeout(() => n.remove(), 3800); }

// ---------- images (legacy records have no thumbnail/image path: probe the usual extensions) ----------
const EXTS = ["webp", "jpg", "jpeg", "png"];
const urlOf = (p) => "/" + p.split("/").map(encodeURIComponent).join("/");
function withFallback(img, i, preferFull) {
  const chain = [];
  if (i.thumbnail || i.image) { chain.push(i.image, i.thumbnail); if (preferFull) chain.reverse(); }
  else EXTS.forEach((e) => chain.push(`images/${i.category}/${i.id}.${e}`));
  const list = chain.filter(Boolean); let n = 0;
  img.addEventListener("error", () => { if (n < list.length) img.src = urlOf(list[n++]); else img.removeAttribute("src"); });
  img.src = urlOf(list[n++] || `images/${i.category}/${i.id}.webp`);
  return img;
}
const thumb = (i, cls = "im", extra = {}) => withFallback(h("img", { class: cls, alt: i.title || "", loading: "lazy", decoding: "async", ...extra }), i);

// ---------- categories (loaded from the API; labels follow the admin language) ----------
const catOf = (slug) => S.cats.find((c) => c.slug === slug);
function catLabel(slug) { const c = catOf(slug); return c ? ((c.names && c.names[S.lang]) || c.name) : (slug ? slug[0].toUpperCase() + slug.slice(1) : ""); }
const catOptions = (selected) => S.cats.map((c) => h("option", { value: c.slug, selected: selected === c.slug, text: catLabel(c.slug) + (c.enabled === false ? ` (${t("hidden")})` : "") }));

// ---------- API ----------
async function api(method, url, body, extra = {}) {
  let res;
  try {
    res = await fetch(url, { method, credentials: "same-origin", headers: { ...(body && !(body instanceof Blob) ? { "Content-Type": "application/json" } : {}), ...(S.csrf ? { "X-CSRF-Token": S.csrf } : {}), ...extra },
      body: body ? (body instanceof Blob ? body : JSON.stringify(body)) : undefined });
  } catch { throw new Error(t("errNet")); }
  if (res.status === 401 && url !== "/api/admin/login" && url !== "/api/admin/password") { const was = S.csrf; S.csrf = null; if (was) renderLogin(t("sessionEnd")); throw new Error(t("sessionEnd")); }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data?.error || `HTTP ${res.status}`); e.status = res.status; e.data = data; throw e; }
  return data;
}
async function loadItems() { S.items = (await api("GET", "/api/admin/wallpapers")).items; }
async function loadCats() { S.cats = (await api("GET", "/api/admin/categories")).categories; if (!S.uploadCat || !catOf(S.uploadCat)) S.uploadCat = (S.cats.find((c) => c.enabled !== false) || S.cats[0] || {}).slug || ""; }
async function loadSettings() { const r = await api("GET", "/api/admin/settings"); S.settings = r.settings; S.defaultPrimary = r.defaultPrimary; }
async function loadAnalytics() { S.analytics = await api("GET", "/api/admin/analytics"); }

// ---------- dialogs ----------
function openDialog(content, { onClose } = {}) {
  const dlg = h("dialog", {}, content);
  dlg.addEventListener("close", () => { dlg.remove(); if (onClose) onClose(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg); dlg.showModal(); return dlg;
}
function confirmDialog(message, { title = t("confirmTitle"), confirmText = t("save"), danger = false, extra = null } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const ok = btn(confirmText, { cls: danger ? "solid-danger" : "primary", onclick: () => { result = true; dlg.close(); } });
    const dlg = openDialog(h("div", { class: "dlg", role: "alertdialog" }, h("h3", { text: title }), h("p", { class: "muted", text: message }), extra,
      h("div", { class: "dlg-actions" }, btn(t("cancel"), { onclick: () => dlg.close() }), ok)), { onClose: () => resolve(result) });
    ok.focus();
  });
}

// The site logo is assets/logo.png; fall back to the SVG version if the PNG is not deployed.
function logoImg(cls = "") { const i = h("img", { class: cls, src: "../assets/logo.png", alt: "" }); i.addEventListener("error", () => { if (!i.dataset.fb) { i.dataset.fb = "1"; i.src = "../assets/logo.svg"; } }); return i; }

// ---------- login ----------
function setLang(l) { S.lang = l; localStorage.setItem("qw_admin_lang", l); applyDir(); S.csrf ? renderApp() : renderLogin(); }
function applyDir() { document.documentElement.lang = L[S.lang].lang; document.documentElement.dir = L[S.lang].dir; }
const langSelect = () => h("select", { "aria-label": t("language"), onchange: (e) => setLang(e.target.value) }, h("option", { value: "ps", selected: S.lang === "ps" }, "پښتو"), h("option", { value: "en", selected: S.lang === "en" }, "English"));

function renderLogin(msg = "") {
  applyDir(); document.body.classList.remove("nav-open"); S.guard = null;
  const err = h("p", { class: "err", role: "alert", text: msg });
  const u = h("input", { id: "u", type: "text", autocomplete: "username", required: true, value: "admin" });
  const p = h("input", { id: "p", type: "password", autocomplete: "current-password", required: true });
  const go = h("button", { class: "btn primary", type: "submit", text: t("signIn") });
  const form = h("form", { class: "login", onsubmit: async (e) => {
    e.preventDefault(); go.disabled = true; go.textContent = t("signingIn"); err.textContent = "";
    try { const r = await api("POST", "/api/admin/login", { username: u.value, password: p.value }); S.csrf = r.csrf; await boot(); }
    catch (x) { err.textContent = x.status === 401 ? t("errAuth") : x.message; go.disabled = false; go.textContent = t("signIn"); p.value = ""; p.focus(); }
  } }, logoImg("logo"), h("h1", { text: t("appName") + " — Qurishi" }), h("p", { class: "sub", text: t("brandSub") }),
    h("label", { class: "f" }, t("username"), u), h("label", { class: "f" }, t("password"), p), err, go, langSelect());
  $app.replaceChildren(h("div", { class: "login-wrap" }, form)); (u.value ? p : u).focus();
}

// ---------- shell ----------
const views = {}; // filled by views-content.js and views-site.js: name -> async () => [nodes]
const NAV = [
  { id: "overview", ic: "overview" },
  { group: "navContent" }, { id: "designs", ic: "designs" }, { id: "upload", ic: "plus" }, { id: "categories", ic: "categories" }, { id: "ordering", ic: "ordering" },
  { group: "navSite" }, { id: "theme", ic: "theme" }, { id: "account", ic: "account" },
  { group: "navInsights" }, { id: "analytics", ic: "analytics" }, { id: "activity", ic: "activity" },
];
async function go(v) {
  if (S.guard && S.guard()) { if (!(await confirmDialog(t("ordLeave"), { confirmText: t("del"), danger: true }))) return; }
  S.guard = null; S.view = v; history.replaceState(null, "", "#" + v);
  document.body.classList.remove("nav-open"); renderNav(); await renderView(); window.scrollTo(0, 0);
}
function renderNav() {
  document.querySelectorAll(".nav-item[data-view]").forEach((b) => { const on = b.dataset.view === S.view; if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
}
async function renderView() {
  const main = document.getElementById("main"); if (!main) return;
  main.replaceChildren(h("div", { class: "sk-grid" }, [1, 2, 3, 4].map(() => h("div", { class: "skeleton" }))));
  try { main.replaceChildren(...(await views[S.view]()).filter(Boolean)); }
  catch (e) { if (S.csrf) main.replaceChildren(h("div", { class: "empty" }, h("b", { class: "bad", text: e.message }), btn(t("retry"), { onclick: renderView }))); }
}
function renderApp() {
  applyDir();
  const nav = h("nav", { "aria-label": "Admin" }, NAV.map((n) => n.group ? h("div", { class: "nav-group", text: t(n.group) }) :
    h("button", { class: "nav-item", type: "button", "data-view": n.id, onclick: () => go(n.id) }, icon(n.ic), h("span", { text: t(n.id) }))));
  const side = h("aside", { class: "sidebar", id: "sidebar" },
    h("div", { class: "brand" }, logoImg(), h("div", {}, h("b", { text: t("appName") }), h("small", { text: t("brandSub") }))), nav,
    h("div", { class: "side-foot" }, h("div", { class: "who", text: `${t("username")}: ${S.me ? S.me.user : ""}` }), langSelect(), btn(t("logout"), { cls: "ghost", ic: "logout", onclick: logout })));
  const top = h("header", { class: "topbar" }, h("button", { class: "btn icon-only", type: "button", "aria-label": t("menu"), "aria-controls": "sidebar", onclick: () => document.body.classList.toggle("nav-open") }, icon("menu")), logoImg(), h("b", { text: t("appName") + " — Qurishi" }));
  const main = h("main", { class: "main", id: "main", tabindex: "-1" });
  $app.replaceChildren(h("div", { class: "app" }, top, side, h("div", { style: "min-width:0" }, main)), h("div", { class: "scrim", onclick: () => document.body.classList.remove("nav-open") }));
  renderNav(); renderView();
}
async function logout() {
  if (S.guard && S.guard() && !(await confirmDialog(t("ordLeave"), { confirmText: t("del"), danger: true }))) return;
  try { await api("POST", "/api/admin/logout", {}); } catch { /* ignore */ }
  S.csrf = null; S.me = null; S.guard = null; renderLogin();
}
const pageHead = (title, sub, ...actions) => h("div", { class: "page-head" }, h("div", {}, h("h2", { text: title }), sub ? h("p", { text: sub }) : null), actions.length ? h("div", { class: "qa" }, actions) : null);
const emptyState = (ic, title, sub, ...actions) => h("div", { class: "empty" }, icon(ic), h("b", { text: title }), sub ? h("span", { text: sub }) : null, actions.length ? h("div", { class: "qa", style: "justify-content:center" }, actions) : null);
window.addEventListener("beforeunload", (e) => { if (S.guard && S.guard()) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });
