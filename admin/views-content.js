// views-content.js — Overview, Manage Designs, Add New Design, Manage Categories, Featured & Ordering.
"use strict";

const statCard = (ic, n, label, accent) => h("div", { class: "stat" + (accent ? " accent" : "") }, h("div", { class: "ico" }, icon(ic)), h("div", {}, h("b", { text: fmtN(n) }), h("span", { text: label })));
const titleOf = (k) => (S.items.find((i) => key(i) === k) || {}).title || k;
const topTable = (rows, unit) => rows.length ? h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, rows.map((r) => h("tr", {}, h("td", { text: titleOf(r.key) }), h("td", { class: "muted", text: r.key }), h("td", { text: `${fmtN(r.count)} ${unit}` }))))))
  : h("p", { class: "muted", text: t("noData") });
const auditTable = (rows) => rows.length ? h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: t("time") }), h("th", { text: t("action") }), h("th", { text: t("detail") }))),
  h("tbody", {}, rows.map((r) => h("tr", {}, h("td", { class: "muted", text: new Date(r.t).toLocaleString() }), h("td", { text: r.action }), h("td", { text: r.detail })))))) : h("p", { class: "muted", text: t("noData") });
const rankMap = () => Object.fromEntries(S.cats.map((c) => [c.slug, c.order]));

// ---------- Overview ----------
views.overview = async () => {
  await Promise.all([loadItems(), loadCats(), loadAnalytics(), api("GET", "/api/admin/audit").then((r) => { S.audit = r.entries; })]);
  const a = S.analytics, featured = S.items.filter((i) => i.featured === true).length, missing = S.items.filter((i) => !i.width).length;
  const recent = [...S.items].filter((i) => i.createdAt).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 6);
  const maxN = Math.max(1, ...S.cats.map((c) => c.count));
  return [pageHead(t("overview"), null,
      btn(t("upload"), { cls: "primary", ic: "plus", onclick: () => go("upload") }), btn(t("ordering"), { ic: "star", onclick: () => go("ordering") })),
    !a.persistent && h("div", { class: "banner", text: t("memOnly") }), missing > 0 && h("div", { class: "banner info", text: t("lowMeta", missing) }),
    h("div", { class: "grid stats" }, statCard("designs", S.items.length, t("totalDesigns"), true), statCard("categories", S.cats.length, t("totalCategories")), statCard("star", featured, t("featuredDesigns")),
      statCard("eye", a.visitors.today, t("visitorsToday")), statCard("chat", a.totals.whatsapp, t("whatsapp"))),
    h("div", { class: "grid cols2", style: "margin-block-start:16px" },
      h("div", { class: "card" }, h("h3", { text: t("byCategory") }), S.cats.map((c) => h("div", { class: "bar-row" }, h("span", { text: catLabel(c.slug) + (c.enabled === false ? ` · ${t("hidden")}` : "") }),
        h("div", { class: "track" }, h("i", { style: `width:${Math.round((c.count / maxN) * 100)}%` })), h("span", { class: "muted", text: `${c.count}${c.featured ? ` · ★${c.featured}` : ""}` })))),
      h("div", { class: "card" }, h("h3", { text: t("topViewed") }), topTable(a.topViewed.slice(0, 5), t("views")), h("h3", { style: "margin-block-start:16px", text: t("topOrdered") }), topTable(a.topOrdered.slice(0, 5), t("orders")))),
    h("div", { class: "card", style: "margin-block-start:16px" }, h("h3", { text: t("recentUploads") }),
      recent.length ? h("div", { class: "mini-grid" }, recent.map((i) => h("div", { class: "mini" }, thumb(i, "", {}), h("div", {}, h("b", { text: i.title }), h("div", { class: "muted", text: key(i) }))))) : h("p", { class: "muted", text: t("noData") })),
    h("div", { class: "card", style: "margin-block-start:16px" }, h("h3", { text: t("recentActivity") }), auditTable(S.audit.slice(0, 8)))];
};

// ---------- Manage Designs ----------
views.designs = async () => { await Promise.all([loadItems(), loadCats()]); return designsView(); };
function designsView() {
  const grid = h("div", { class: "dgrid" }), bulk = h("div", { class: "bulk", hidden: true }), more = btn(t("loadMore"), { onclick: () => { S.shown += 60; draw(); } });
  const q = h("input", { type: "search", placeholder: t("search"), value: S.q, "aria-label": t("search"), oninput: (e) => { S.q = e.target.value; S.shown = 60; draw(); } });
  const cat = h("select", { "aria-label": t("category"), onchange: (e) => { S.cat = e.target.value; S.shown = 60; draw(); } }, h("option", { value: "all", text: t("all") }), catOptions(S.cat));
  cat.value = S.cat;
  const sort = h("select", { "aria-label": t("sort"), onchange: (e) => { S.sort = e.target.value; draw(); } }, [["order", "displayOrder"], ["newest", "newest"], ["oldest", "oldest"], ["views", "mostViewed"], ["orders", "mostOrdered"]].map(([v, k]) => h("option", { value: v, selected: S.sort === v, text: t(k) })));
  const fo = h("button", { class: "pill", type: "button", "aria-pressed": String(S.featOnly), onclick: () => { S.featOnly = !S.featOnly; fo.setAttribute("aria-pressed", String(S.featOnly)); S.shown = 60; draw(); } }, icon("star", "sm"), t("onlyFeatured"));
  const countTxt = h("span", { class: "muted" });
  const sorters = { newest: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""), oldest: (a, b) => (a.createdAt || "9").localeCompare(b.createdAt || "9"), views: (a, b) => b.views - a.views, orders: (a, b) => b.whatsappClicks - a.whatsappClicks };

  function draw() {
    const needle = S.q.trim().toLowerCase();
    let rows = S.items.filter((i) => (S.cat === "all" || i.category === S.cat) && (!S.featOnly || i.featured === true) && (!needle || i.id.toLowerCase().includes(needle) || (i.title || "").toLowerCase().includes(needle)));
    rows = S.sort === "order" ? QOrder.sortItems(rows, rankMap()) : [...rows].sort(sorters[S.sort]);
    grid.replaceChildren(...rows.slice(0, S.shown).map((i) => {
      const k = key(i), on = S.sel.has(k);
      const card = h("div", { class: "dc " + (on ? "sel" : "") });
      const ck = h("input", { type: "checkbox", class: "ck", checked: on, "aria-label": i.title, onchange: (e) => { e.target.checked ? S.sel.add(k) : S.sel.delete(k); card.classList.toggle("sel", e.target.checked); drawBulk(); } });
      const star = h("button", { class: "btn icon-only sm star starbtn" + (i.featured ? " on" : ""), type: "button", title: i.featured ? t("unfeature") : t("feature"), "aria-pressed": String(!!i.featured), onclick: () => toggleFeatured(i) }, icon("star", "sm"));
      const im = thumb(i, "im", { onclick: () => editDialog(i) });
      card.append(ck, star, im, h("div", { class: "inf" }, h("b", { text: i.title }), h("span", { class: "muted", text: `${catLabel(i.category)} · ${i.id}` }),
        h("span", { class: "faint", text: `${fmtN(i.views)} ${t("views")} · ${fmtN(i.whatsappClicks)} ${t("orders")}` }), i.width ? h("span", { class: "faint", text: `${i.width}×${i.height}${i.fileSize ? " · " + fmtKB(i.fileSize) : ""}` }) : null));
      return card;
    }));
    if (!rows.length) grid.replaceChildren(emptyState("designs", t("emptyDesigns"), t("emptyDesignsHint"), btn(t("upload"), { cls: "primary", ic: "plus", onclick: () => go("upload") })));
    more.hidden = rows.length <= S.shown;
    countTxt.textContent = `${rows.length} / ${S.items.length}`;
    drawBulk();
  }
  async function toggleFeatured(i) {
    try { await api("PATCH", "/api/admin/wallpapers", { key: key(i), featured: !i.featured }); await loadItems(); draw(); toast(t("saved2"), "good"); } catch (e) { toast(e.message, "bad"); }
  }
  function drawBulk() {
    bulk.hidden = S.sel.size === 0;
    const target = h("select", { "aria-label": t("moveTo") }, catOptions());
    bulk.replaceChildren(h("b", { text: t("selected", S.sel.size) }), target, btn(t("moveTo"), { cls: "sm", onclick: () => runBulk("category", target.value) }),
      btn(t("feature"), { cls: "sm", ic: "star", onclick: () => runBulk("feature") }), btn(t("unfeature"), { cls: "sm", onclick: () => runBulk("unfeature") }),
      btn(t("del"), { cls: "sm danger", ic: "trash", onclick: () => runBulk("delete") }), btn(t("clearSel"), { cls: "sm", onclick: () => { S.sel.clear(); draw(); } }));
  }
  async function runBulk(action, category) {
    const keys = [...S.sel];
    if (action === "delete" && !(await confirmDialog(t("confirmDel", keys.length), { title: t("del"), confirmText: t("yesDelete"), danger: true }))) return;
    try {
      for (let i = 0; i < keys.length; i += 25) await api("POST", "/api/admin/bulk", { action, keys: keys.slice(i, i + 25), category, confirm: action === "delete" ? true : undefined });
      S.sel.clear(); toast(action === "delete" ? t("deleted") : t("saved2"), "good"); await Promise.all([loadItems(), loadCats()]); draw();
    } catch (e) { toast(e.message, "bad"); }
  }
  draw();
  return [pageHead(t("designs")), h("div", { class: "toolbar" }, q, cat, sort, fo, countTxt), grid, h("div", { style: "text-align:center;margin-block-start:16px" }, more), bulk];
}

function editDialog(item) {
  const title = h("input", { type: "text", value: item.title, maxlength: "120", required: true });
  const cat = h("select", {}, catOptions(item.category));
  const feat = h("input", { type: "checkbox", checked: !!item.featured });
  const img = withFallback(h("img", { class: "pv", alt: item.title }), item, true);
  const meta = `${key(item)}${item.width ? ` · ${item.width}×${item.height}` : ""}${item.fileSize ? ` · ${fmtKB(item.fileSize)}` : ""}${item.format ? ` · ${item.format.toUpperCase()}` : ""}`;
  const dlg = openDialog(h("form", { class: "dlg", onsubmit: async (e) => {
    e.preventDefault();
    const body = { key: key(item) };
    if (title.value.trim() !== item.title) body.title = title.value;
    if (cat.value !== item.category) body.category = cat.value;
    if (feat.checked !== !!item.featured) body.featured = feat.checked;
    if (Object.keys(body).length === 1) return dlg.close();
    try { await api("PATCH", "/api/admin/wallpapers", body); toast(t("saved2"), "good"); dlg.close(); await Promise.all([loadItems(), loadCats()]); await renderView(); } catch (x) { toast(x.message, "bad"); }
  } }, h("h3", { text: t("edit") }), img, h("div", { class: "muted", text: meta }),
  h("label", { class: "f" }, t("title"), title), h("label", { class: "f" }, t("category"), cat),
  h("label", { style: "display:flex;gap:12px;align-items:center;font-weight:600" }, h("span", { class: "switch" }, feat, h("i")), icon("star", "sm"), t("featured")),
  h("div", { class: "dlg-actions", style: "justify-content:space-between" },
    btn(t("del"), { cls: "danger", ic: "trash", onclick: async () => {
      if (!(await confirmDialog(t("confirmDel", 1), { title: t("del"), confirmText: t("yesDelete"), danger: true }))) return;
      try { await api("POST", "/api/admin/bulk", { action: "delete", keys: [key(item)], confirm: true }); toast(t("deleted"), "good"); dlg.close(); await Promise.all([loadItems(), loadCats()]); await renderView(); } catch (x) { toast(x.message, "bad"); }
    } }),
    h("div", { class: "qa" }, btn(t("cancel"), { onclick: () => dlg.close() }), h("button", { class: "btn primary", type: "submit", text: t("save") })))));
  title.focus();
}

// ---------- Add New Design (upload) ----------
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
    const r = await xhrUpload(`/api/admin/upload?category=${encodeURIComponent(q.category)}&name=${encodeURIComponent(q.file.name)}`, blob, { "X-CSRF-Token": S.csrf, "X-Original-Size": String(q.file.size), "Content-Type": "application/octet-stream" }, (p) => { q.progress = p * 0.95; refresh(); });
    q.status = "done"; q.progress = 1; q.result = r;
  } catch (e) {
    if (e.status === 401) { S.csrf = null; renderLogin(t("sessionEnd")); return; }
    q.status = "error"; q.error = e.status === 409 ? `${t("dup")} (${e.data?.duplicateOf || ""})` : e.status === 415 ? t("notImage") : e.message;
  }
  refresh();
}
views.upload = async () => { await loadCats(); return uploadView(); };
function uploadView() {
  const list = h("div", { class: "queue" }), overall = h("div", { class: "progress" }, h("i")), overallTxt = h("span", { class: "muted" });
  const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: (e) => { add(e.target.files); e.target.value = ""; } });
  const upBtn = h("button", { class: "btn primary", type: "button", onclick: run }), clr = btn(t("clearAll"), { onclick: () => { if (S.uploading) return; S.queue.forEach((q) => URL.revokeObjectURL(q.url)); S.queue = []; refresh(); } });
  const catSel = h("select", { onchange: (e) => { S.uploadCat = e.target.value; S.queue.forEach((q) => { if (q.status !== "done") q.category = S.uploadCat; }); refresh(); } }, catOptions(S.uploadCat));
  const drop = h("div", { class: "drop", tabindex: "0", role: "button", onclick: () => input.click(), onkeydown: (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.click()),
    ondragover: (e) => { e.preventDefault(); drop.classList.add("over"); }, ondragleave: () => drop.classList.remove("over"), ondrop: (e) => { e.preventDefault(); drop.classList.remove("over"); add(e.dataTransfer.files); } }, icon("upload"), t("dropHint"));
  function add(files) {
    for (const f of files) {
      if (!f.type.startsWith("image/")) { toast(`${f.name}: ${t("notImage")}`, "bad"); continue; }
      if (S.queue.some((q) => q.file.name === f.name && q.file.size === f.size && q.file.lastModified === f.lastModified)) continue;
      S.queue.push({ id: ++qid, file: f, url: URL.createObjectURL(f), category: S.uploadCat, status: "ready", progress: 0, error: "", result: null });
    }
    refresh();
  }
  function refresh() {
    list.replaceChildren(...S.queue.map((q) => {
      const st = q.status === "done" ? h("span", { class: "ok st", text: t("done") }) : q.status === "error" ? h("span", { class: "bad st", text: `${t("failed")}: ${q.error}` }) : h("span", { class: "muted st", text: t(q.status === "uploading" ? "uploading" : "ready") });
      const info = q.result ? h("div", { class: "st muted" }, `${t("orig")}: ${fmtKB(q.result.stats.originalSize)} → ${t("opt")}: ${fmtKB(q.result.stats.optimizedSize)} (−${q.result.stats.reductionPct}%) · ${q.result.stats.format.toUpperCase()} · ${q.result.stats.width}×${q.result.stats.height} · ${q.result.item.category}/${q.result.item.id}`) : null;
      const cat = h("select", { disabled: q.status === "uploading" || q.status === "done", onchange: (e) => { q.category = e.target.value; } }, catOptions(q.category));
      return h("div", { class: "qi" }, h("img", { src: q.url, alt: "" }), h("div", {}, h("div", { class: "nm", text: `${q.file.name} · ${fmtKB(q.file.size)}` }), h("div", { class: "progress", style: "margin-block:6px" }, h("i", { style: `width:${Math.round(q.progress * 100)}%` })), st, info),
        h("div", { class: "side" }, cat, btn(t("remove"), { cls: "sm", disabled: q.status === "uploading", onclick: () => { URL.revokeObjectURL(q.url); S.queue = S.queue.filter((x) => x !== q); refresh(); } })));
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
    if (S.queue.some((q) => q.status === "done")) toast(t("cdnNote"), "good");
  }
  refresh();
  return [pageHead(t("upload")), h("div", { class: "card", style: "margin-block-end:16px" }, h("label", { class: "f", style: "max-width:320px" }, t("category"), catSel)), drop, input,
    h("div", { class: "toolbar", style: "margin-block-start:16px" }, upBtn, clr, h("div", { style: "flex:1;min-width:160px" }, overall, overallTxt)), list];
}

// ---------- Manage Categories ----------
views.categories = async () => { await loadCats(); return categoriesView(); };
function categoriesView() {
  const list = h("div", { class: "cat-list" });
  const name = h("input", { type: "text", maxlength: "60", placeholder: t("catName"), "aria-label": t("catName") });
  const trIn = { ps: h("input", { type: "text", maxlength: "60", placeholder: t("catPs"), dir: "rtl" }), fa: h("input", { type: "text", maxlength: "60", placeholder: t("catFa"), dir: "rtl" }), en: h("input", { type: "text", maxlength: "60", placeholder: t("catEn"), dir: "ltr" }) };
  const addBtn = h("button", { class: "btn primary", type: "submit" }, icon("plus", "sm"), h("span", { text: t("catAdd") }));
  const addForm = h("form", { class: "card", onsubmit: async (e) => {
    e.preventDefault(); if (!name.value.trim()) { name.setAttribute("aria-invalid", "true"); name.focus(); return; }
    addBtn.disabled = true;
    try {
      const names = Object.fromEntries(Object.entries(trIn).map(([k, v]) => [k, v.value]).filter(([, v]) => v.trim()));
      const r = await api("POST", "/api/admin/categories", { name: name.value, names }); S.cats = r.categories; toast(t("saved2"), "good");
      name.value = ""; Object.values(trIn).forEach((i) => { i.value = ""; }); name.removeAttribute("aria-invalid"); draw();
    } catch (x) { toast(x.message, "bad"); } finally { addBtn.disabled = false; }
  } }, h("h3", { text: t("catAddTitle") }), h("div", { class: "add-cat" }, h("label", { class: "f" }, t("catName"), name), addBtn),
  h("details", { class: "tr" }, h("summary", { text: t("catTranslations") }), h("div", { class: "tr-grid" }, trIn.ps, trIn.fa, trIn.en)));

  async function save(call) { try { const r = await call(); S.cats = r.categories; draw(); toast(t("saved2"), "good"); } catch (x) { toast(x.message, "bad"); await loadCats().catch(() => {}); draw(); } }
  const reorder = (i, d) => { const s = S.cats.map((c) => c.slug); const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; save(() => api("PUT", "/api/admin/categories", { slugs: s })); };

  function draw() {
    list.replaceChildren(...S.cats.map((c, i) => {
      const sw = h("input", { type: "checkbox", checked: c.enabled !== false, "aria-label": t("catVisible"), onchange: (e) => save(() => api("PATCH", "/api/admin/categories", { slug: c.slug, enabled: e.target.checked })) });
      return h("div", { class: "cat-row" + (c.enabled === false ? " off" : "") },
        h("div", { class: "arrows" }, btn("", { cls: "icon-only sm ghost", ic: "up", title: t("moveUp"), disabled: i === 0, onclick: () => reorder(i, -1) }), btn("", { cls: "icon-only sm ghost", ic: "down", title: t("moveDown"), disabled: i === S.cats.length - 1, onclick: () => reorder(i, 1) })),
        h("div", {}, h("div", { class: "nm" }, catLabel(c.slug), c.builtin ? h("span", { class: "badge gray", text: t("catBuiltin") }) : null, c.enabled === false ? h("span", { class: "badge gold", text: t("hidden") }) : null),
          h("div", { class: "meta", text: `${c.count} ${t("catDesigns")}${c.featured ? ` · ★ ${c.featured}` : ""} · ${t("catSlugHint")}: ${c.slug}` })),
        h("label", { class: "vis" }, h("span", { class: "switch" }, sw, h("i")), t("catVisible")),
        h("div", { class: "ctl" }, btn(t("edit"), { cls: "sm", ic: "edit", onclick: () => editCat(c) }),
          btn(t("del"), { cls: "sm danger", ic: "trash", disabled: c.builtin, title: c.builtin ? t("catDeleteBuiltin") : t("del"), onclick: () => deleteCat(c) })));
    }));
  }
  function editCat(c) {
    const nm = h("input", { type: "text", value: c.name, maxlength: "60", required: true });
    const tr = { ps: h("input", { type: "text", value: (c.names || {}).ps || "", maxlength: "60", dir: "rtl" }), fa: h("input", { type: "text", value: (c.names || {}).fa || "", maxlength: "60", dir: "rtl" }), en: h("input", { type: "text", value: (c.names || {}).en || "", maxlength: "60", dir: "ltr" }) };
    const dlg = openDialog(h("form", { class: "dlg", onsubmit: async (e) => {
      e.preventDefault();
      try { const r = await api("PATCH", "/api/admin/categories", { slug: c.slug, name: nm.value, names: Object.fromEntries(Object.entries(tr).map(([k, v]) => [k, v.value])) }); S.cats = r.categories; dlg.close(); draw(); toast(t("saved2"), "good"); } catch (x) { toast(x.message, "bad"); }
    } }, h("h3", { text: t("catEdit") }), h("label", { class: "f" }, t("catName"), nm), h("div", { class: "muted", text: t("catTranslations") }),
    h("div", { class: "tr-grid" }, h("label", { class: "f" }, t("catPs"), tr.ps), h("label", { class: "f" }, t("catFa"), tr.fa), h("label", { class: "f" }, t("catEn"), tr.en)),
    h("div", { class: "dlg-actions" }, btn(t("cancel"), { onclick: () => dlg.close() }), h("button", { class: "btn primary", type: "submit", text: t("save") }))));
    nm.focus();
  }
  function deleteCat(c) {
    const others = S.cats.filter((x) => x.slug !== c.slug);
    const target = h("select", {}, others.map((o) => h("option", { value: o.slug, text: catLabel(o.slug) + (o.enabled === false ? ` (${t("hidden")})` : "") })));
    const has = c.count > 0;
    const go2 = btn(has ? t("catMoveDelete") : t("del"), { cls: "solid-danger", onclick: async () => {
      go2.disabled = true;
      try {
        const qs = `slug=${encodeURIComponent(c.slug)}&confirm=1` + (has ? `&reassignTo=${encodeURIComponent(target.value)}` : "");
        const r = await api("DELETE", "/api/admin/categories?" + qs); S.cats = r.categories; dlg.close(); draw(); toast(t("deleted"), "good");
      } catch (x) { toast(x.message, "bad"); go2.disabled = false; }
    } });
    const dlg = openDialog(h("div", { class: "dlg", role: "alertdialog" }, h("h3", { text: t("catDeleteTitle") }),
      h("p", { class: "muted", text: has ? t("catDeleteHas", catLabel(c.slug), c.count) : t("catDeleteEmpty", catLabel(c.slug)) }),
      has ? h("label", { class: "f" }, t("catMoveDesignsTo"), target) : null,
      h("div", { class: "dlg-actions" }, btn(t("cancel"), { onclick: () => dlg.close() }), go2)));
  }
  draw();
  return [pageHead(t("categories"), t("catHiddenNote")), addForm, h("div", { style: "margin-block-start:16px" }, list)];
}

// ---------- Featured & Ordering ----------
views.ordering = async () => { await Promise.all([loadItems(), loadCats()]); if (!S.ordCat || !catOf(S.ordCat)) S.ordCat = (S.cats[0] || {}).slug; return orderingView(); };
function orderingView() {
  const root = h("div");
  let byId = new Map(), draft = null, snapshot = "";
  const dirty = () => draft && JSON.stringify(draft) !== snapshot;
  function load() {
    const items = QOrder.sortItems(S.items.filter((i) => i.category === S.ordCat));
    byId = new Map(items.map((i) => [i.id, i]));
    draft = { feat: items.filter((i) => i.featured === true).map((i) => i.id), oth: items.filter((i) => i.featured !== true).map((i) => i.id) };
    snapshot = JSON.stringify(draft);
  }
  S.guard = dirty;
  const move = (arr, from, to) => { if (to < 0 || to >= arr.length || from === to) return; const [x] = arr.splice(from, 1); arr.splice(to, 0, x); render(); };
  const toggle = (id, list) => { const src = draft[list], dst = list === "feat" ? draft.oth : draft.feat; src.splice(src.indexOf(id), 1); dst.unshift(id); render(); }; // goes to the front of the other group
  let dragging = null;

  function row(id, list, idx) {
    const it = byId.get(id), arr = draft[list], base = list === "feat" ? 0 : draft.feat.length;
    const r = h("div", { class: "ord-row" + (list === "feat" ? " feat" : ""), draggable: "true", "data-id": id, "data-list": list });
    const star = h("button", { class: "btn icon-only sm star" + (list === "feat" ? " on" : ""), type: "button", title: list === "feat" ? t("unfeature") : t("feature"), "aria-pressed": String(list === "feat"), onclick: () => toggle(id, list) }, icon("star", "sm"));
    r.append(h("div", { class: "grip", title: t("ordDragHint") }, icon("grip")), h("div", { class: "pos", text: String(base + idx + 1) }), thumb(it, "", { alt: "" }),
      h("div", { style: "min-width:0" }, h("div", { class: "t", text: it.title }), h("div", { class: "s", text: it.id })),
      h("div", { class: "ctl" }, star,
        btn("", { cls: "icon-only sm", ic: "top", title: t("moveTop"), disabled: idx === 0, onclick: () => move(arr, idx, 0) }), btn("", { cls: "icon-only sm", ic: "up", title: t("moveUp"), disabled: idx === 0, onclick: () => move(arr, idx, idx - 1) }),
        btn("", { cls: "icon-only sm", ic: "down", title: t("moveDown"), disabled: idx === arr.length - 1, onclick: () => move(arr, idx, idx + 1) }), btn("", { cls: "icon-only sm", ic: "bottom", title: t("moveBottom"), disabled: idx === arr.length - 1, onclick: () => move(arr, idx, arr.length - 1) })));
    r.addEventListener("dragstart", (e) => { dragging = { id, list }; r.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); });
    r.addEventListener("dragend", () => { dragging = null; root.querySelectorAll(".ord-row").forEach((x) => x.classList.remove("dragging", "over-top", "over-bottom")); });
    r.addEventListener("dragover", (e) => {
      if (!dragging || dragging.list !== list || dragging.id === id) return;
      e.preventDefault(); const rect = r.getBoundingClientRect(), after = e.clientY > rect.top + rect.height / 2;
      r.classList.toggle("over-bottom", after); r.classList.toggle("over-top", !after);
    });
    r.addEventListener("dragleave", () => r.classList.remove("over-top", "over-bottom"));
    r.addEventListener("drop", (e) => {
      if (!dragging || dragging.list !== list || dragging.id === id) return; e.preventDefault();
      const rect = r.getBoundingClientRect(), after = e.clientY > rect.top + rect.height / 2;
      const from = arr.indexOf(dragging.id); arr.splice(from, 1);
      let to = arr.indexOf(id); if (after) to++; arr.splice(to, 0, dragging.id); dragging = null; render();
    });
    return r;
  }
  async function pick(slug) {
    if (slug === S.ordCat) return;
    if (dirty() && !(await confirmDialog(t("ordLeave"), { confirmText: t("del"), danger: true }))) return;
    S.ordCat = slug; load(); render();
  }
  async function save() {
    const order = [...draft.feat.map((id) => ({ id, featured: true })), ...draft.oth.map((id) => ({ id, featured: false }))];
    try { await api("POST", "/api/admin/order", { category: S.ordCat, order }); await Promise.all([loadItems(), loadCats()]); load(); render(); toast(t("ordSaved"), "good"); } catch (x) { toast(x.message, "bad"); }
  }
  function render() {
    const scroll = window.scrollY;
    const pills = h("div", { class: "pill-tabs", role: "group" }, S.cats.map((c) => h("button", { class: "pill", type: "button", "aria-pressed": String(c.slug === S.ordCat), onclick: () => pick(c.slug) }, catLabel(c.slug), h("small", { text: String(c.count) }))));
    const featList = h("div", { class: "ord-list" }, draft.feat.length ? draft.feat.map((id, i) => row(id, "feat", i)) : h("p", { class: "hint", style: "padding:6px 2px", text: t("ordEmptyFeatured") }));
    const othList = h("div", { class: "ord-list" }, draft.oth.map((id, i) => row(id, "oth", i)));
    const bar = dirty() ? h("div", { class: "savebar", role: "status" }, h("b", { text: t("ordUnsaved") }), h("div", { class: "qa" }, btn(t("ordDiscard"), { onclick: () => { load(); render(); } }), btn(t("ordSave"), { cls: "primary", ic: "check", onclick: save }))) : null;
    const empty = !byId.size ? emptyState("designs", t("emptyDesigns"), null, btn(t("upload"), { cls: "primary", ic: "plus", onclick: () => go("upload") })) : null;
    root.replaceChildren(...[pills, empty, empty ? null : h("div", { class: "ord-section" }, h("h3", {}, icon("star", "sm"), `${t("ordFeaturedSection")} (${draft.feat.length})`), featList),
      empty ? null : h("div", { class: "ord-section" }, h("h3", { text: `${t("ordOthersSection")} (${draft.oth.length})` }), othList), bar].filter(Boolean));
    window.scrollTo(0, scroll);
  }
  load(); render();
  return [pageHead(t("ordTitle"), t("ordIntro")), root];
}
