// views-site.js — Theme & Website settings, Account & Password, Analytics, Activity.
"use strict";

// ---------- Theme & Website ----------
const SWATCHES = ["#121efb", "#0ea5e9", "#7c3aed", "#e11d48", "#f59e0b", "#059669", "#111827"];
views.theme = async () => { const [, me] = await Promise.all([loadSettings(), api("GET", "/api/admin/me")]); S.me = { ...S.me, ...me }; return themeView(me); };
function themeView(me) {
  const saved = S.settings.theme.primary; let draft = saved;
  const picker = h("input", { type: "color", value: saved, "aria-label": t("themePicker") });
  const hex = h("input", { type: "text", value: saved, maxlength: "7", spellcheck: "false", autocomplete: "off", "aria-label": t("themeHex") });
  const hexHint = h("p", { class: "hint", text: "" }), chips = h("div", { class: "chips" }), note = h("p", { class: "hint" }), prevDark = h("div", { class: "mock dark" }), prevLight = h("div", { class: "mock light" });
  const saveBtn = btn(t("themeSave"), { cls: "primary", ic: "check", onclick: save }), cancelBtn = btn(t("cancel"), { onclick: () => { setDraft(saved); } });
  const restoreBtn = btn(t("themeRestore"), { onclick: restore }), state = h("span", { class: "badge gold", hidden: true, text: t("themeUnsaved") });
  S.guard = () => draft !== saved;

  function mock(el, mode, tk) {
    const accent = mode === "dark" ? tk.onDark : tk.onLight, hi = mode === "dark" ? tk.onDarkHi : tk.onLightHi, rgb = QTheme.cssVars(draft)[mode === "dark" ? "--accent-d-rgb" : "--accent-l-rgb"].split(" ").join(",");
    el.replaceChildren(h("h4", { text: t(mode === "dark" ? "themeDark" : "themeLight") }),
      h("div", { class: "tabs" }, h("span", { class: "tab", style: `background:${tk.primary};color:${tk.onPrimary};border-color:${hi}`, text: t("themeActive") }), h("span", { class: "tab", style: `color:${accent};border-color:rgba(${rgb},.45);background:rgba(${rgb},.1)`, text: t("all") })),
      h("div", { class: "mcard", style: `border-color:rgba(${rgb},.4);background:${mode === "dark" ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.7)"}` }, h("b", { style: `color:${accent}`, text: t("themeSample") }),
        h("span", { class: "mbtn", style: `background:${tk.primary};color:${tk.onPrimary}`, text: t("themeButton") }), h("a", { style: `color:${accent}`, text: t("themeLink") })));
  }
  function paint() {
    const tk = QTheme.tokens(draft); mock(prevDark, "dark", tk); mock(prevLight, "light", tk);
    const c = tk.contrast, chip = (label, v) => h("span", { class: "chip " + (v >= 4.5 ? "good" : "low"), text: `${label} ${v}:1` });
    chips.replaceChildren(chip(t("themeButton"), c.buttonText), chip(t("themeDark"), c.textOnDark), chip(t("themeLight"), c.textOnLight));
    note.textContent = tk.adjusted.dark || tk.adjusted.light ? t("themeAdjusted") : "";
    const dirty = draft !== saved; saveBtn.disabled = !dirty; cancelBtn.disabled = !dirty; state.hidden = !dirty; restoreBtn.disabled = saved === S.defaultPrimary && !dirty;
  }
  function setDraft(v) { draft = v; picker.value = v; hex.value = v; hex.removeAttribute("aria-invalid"); hexHint.textContent = ""; hexHint.className = "hint"; paint(); }
  picker.addEventListener("input", () => setDraft(QTheme.normalizeHex(picker.value)));
  hex.addEventListener("input", () => {
    const v = QTheme.normalizeHex(hex.value);
    if (!v) { hex.setAttribute("aria-invalid", "true"); hexHint.className = "hint bad"; hexHint.textContent = t("themeInvalid"); return; }
    draft = v; picker.value = v; hex.removeAttribute("aria-invalid"); hexHint.textContent = ""; paint();
  });
  hex.addEventListener("blur", () => { if (QTheme.normalizeHex(hex.value)) hex.value = draft; });
  async function save() {
    saveBtn.disabled = true;
    try { const r = await api("PUT", "/api/admin/settings", { primary: draft }); S.settings = r.settings; S.guard = null; toast(t("themeSaved") + " — " + t("themePublicNote"), "good"); await renderView(); } catch (x) { toast(x.message, "bad"); paint(); }
  }
  async function restore() {
    if (!(await confirmDialog(t("themeRestoreConfirm"), { confirmText: t("themeRestore") }))) return;
    try { const r = await api("PUT", "/api/admin/settings", { restoreDefault: true }); S.settings = r.settings; S.guard = null; toast(t("themeSaved"), "good"); await renderView(); } catch (x) { toast(x.message, "bad"); }
  }
  const swatches = h("div", { class: "swatches" }, SWATCHES.map((c) => h("button", { class: "swatch", type: "button", style: `background:${c}`, title: c, "aria-label": c, onclick: () => setDraft(c) })));
  paint();
  const s = me.status, row = (k, v, cls) => h("tr", {}, h("td", { text: k }), h("td", { class: cls || "", text: v }));
  return [pageHead(t("theme"), t("themeIntro")),
    h("div", { class: "theme-grid" },
      h("div", { class: "card" }, h("h3", { text: t("themePrimary") }), h("div", { class: "color-row" }, picker, hex), hexHint, swatches,
        h("div", { style: "margin-block-start:14px" }, h("div", { class: "muted", style: "margin-block-end:6px", text: t("themeContrast") }), chips, note),
        h("div", { class: "dlg-actions", style: "justify-content:flex-start;margin-block-start:18px" }, saveBtn, cancelBtn, restoreBtn, state)),
      h("div", { class: "card" }, h("h3", { text: t("themePreview") }), h("div", { class: "grid", style: "gap:14px" }, prevDark, prevLight))),
    h("div", { class: "card", style: "margin-block-start:16px" }, h("h3", { text: t("themeSystem") }), h("div", { class: "table-wrap" }, h("table", { class: "status-table" }, h("tbody", {},
      row(t("github"), s.github ? `${t("connected")} — ${s.githubRepo}` : t("notConfigured"), s.github ? "ok" : "bad"),
      row(t("analyticsStore"), s.analyticsPersistent ? t("persistent") : t("memOnly"), s.analyticsPersistent ? "ok" : "warn"),
      row(t("limits"), `≤ ${s.limits.maxUploadMB} MB / ${t("upload")} · ${s.limits.maxDimension}px · ≈${s.limits.targetKB} KB`)))),
      h("p", { class: "hint", style: "margin-block-start:10px", text: t("themePublicNote") }))];
}

// ---------- Account & Password ----------
views.account = async () => { const me = await api("GET", "/api/admin/me"); S.me = { ...S.me, ...me }; return accountView(me); };
function accountView(me) {
  const min = me.status.limits.minPasswordLength, can = me.status.canChangePassword;
  const msg = h("div", { role: "status", "aria-live": "polite" });
  const field = (label, autocomplete) => {
    const i = h("input", { type: "password", autocomplete, required: true, disabled: !can, maxlength: "200" });
    const tg = h("button", { type: "button", onclick: () => { const show = i.type === "password"; i.type = show ? "text" : "password"; tg.textContent = show ? t("accHide") : t("accShow"); } , text: t("accShow") });
    return { i, node: h("label", { class: "f" }, label, h("div", { class: "pw-field" }, i, tg)) };
  };
  const cur = field(t("accCurrent"), "current-password"), nw = field(t("accNew"), "new-password"), cf = field(t("accConfirm"), "new-password");
  const hint = h("p", { class: "hint", text: t("accTooShort", min) }), match = h("p", { class: "hint" });
  const submit = h("button", { class: "btn primary", type: "submit", disabled: !can, text: t("accSubmit") });
  const validate = () => {
    const short = nw.i.value.length > 0 && nw.i.value.length < min;
    hint.className = "hint" + (short ? " bad" : ""); nw.i.toggleAttribute("aria-invalid", short);
    const bad = cf.i.value.length > 0 && cf.i.value !== nw.i.value; match.className = "hint" + (bad ? " bad" : ""); match.textContent = bad ? t("accMismatch") : ""; cf.i.toggleAttribute("aria-invalid", bad);
    return !short && !bad;
  };
  [nw.i, cf.i].forEach((i) => i.addEventListener("input", validate));
  const show = (kind, text) => msg.replaceChildren(h("div", { class: "msg " + kind, text }));
  const form = h("form", { class: "card", style: "display:grid;gap:14px", onsubmit: async (e) => {
    e.preventDefault(); msg.replaceChildren();
    if (!validate() || nw.i.value.length < min) return show("bad", t("accTooShort", min));
    if (nw.i.value !== cf.i.value) return show("bad", t("accMismatch"));
    if (nw.i.value === cur.i.value) return show("bad", t("accSameAsOld"));
    submit.disabled = true;
    try {
      const r = await api("POST", "/api/admin/password", { currentPassword: cur.i.value, newPassword: nw.i.value, confirmPassword: cf.i.value });
      S.csrf = r.csrf; // the server issued a fresh session; all older sessions are now invalid
      [cur.i, nw.i, cf.i].forEach((i) => { i.value = ""; }); show("good", t("accDone")); toast(t("accDone"), "good");
    } catch (x) { show("bad", x.message); cur.i.focus(); } finally { submit.disabled = !can; }
  } }, h("h3", { text: t("accChange") }), !can && h("div", { class: "banner", text: t("accNoStore") }), cur.node, nw.node, hint, cf.node, match, msg, h("div", {}, submit));
  const row = (k, v) => h("tr", {}, h("td", { class: "muted", text: k }), h("td", { text: v }));
  return [pageHead(t("accTitle")), h("div", { class: "acc-grid" }, form,
    h("div", { class: "card" }, h("h3", { text: t("account") }), h("table", {}, h("tbody", {}, row(t("accUser"), me.user), row(t("accSession"), new Date(me.expiresAt).toLocaleString()))),
      h("p", { class: "hint", style: "margin-block:12px", text: t("accLogoutNote") }), btn(t("logout"), { ic: "logout", onclick: logout })))];
}

// ---------- Analytics ----------
views.analytics = async () => {
  await Promise.all([loadItems(), loadCats(), loadAnalytics()]);
  const a = S.analytics, max = Math.max(1, ...a.daily.map((d) => Math.max(d.pv, d.wa)));
  const chart = h("div", { class: "chart", role: "img", "aria-label": t("daily") }, a.daily.map((d) => h("div", { title: `${d.date}: ${d.pv} / ${d.wa} / ${d.visitors}` }, h("i", { class: "wa", style: `height:${(d.wa / max) * 100}%` }), h("i", { class: "pv", style: `height:${(d.pv / max) * 100}%` }))));
  const ct = a.categories;
  return [pageHead(t("analytics")), !a.persistent && h("div", { class: "banner", text: t("memOnly") }),
    h("div", { class: "grid stats" }, statCard("eye", a.visitors.today, t("visitorsToday")), statCard("eye", a.visitors.week, t("visitorsWeek")), statCard("eye", a.visitors.month, t("visitorsMonth")), statCard("analytics", a.visitors.all, `${t("visitors")} (${t("allTime")})`), statCard("designs", a.totals.pageViews, t("pageViews")), statCard("chat", a.totals.whatsapp, t("whatsapp"))),
    h("div", { class: "card", style: "margin-block-start:16px" }, h("h3", { text: t("daily") }), chart, h("div", { class: "legend" }, h("span", { style: "--c:var(--primary)", text: t("pageViews") }), h("span", { style: "--c:#12b886", text: t("whatsapp") }))),
    h("div", { class: "grid cols2", style: "margin-block-start:16px" },
      h("div", { class: "card" }, h("h3", { text: t("byCategory") }), h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", { text: t("category") }), h("th", { text: t("views") }), h("th", { text: t("orders") }))),
        h("tbody", {}, S.cats.map((c) => h("tr", {}, h("td", { text: catLabel(c.slug) }), h("td", { text: fmtN(ct.views[c.slug]) }), h("td", { text: fmtN(ct.whatsapp[c.slug]) }))))))),
      h("div", { class: "card" }, h("h3", { text: t("recentActivity") }), a.recent.length ? h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, a.recent.slice(0, 12).map((r) => h("tr", {}, h("td", { class: "muted", text: new Date(r.t).toLocaleString() }), h("td", { text: r.type === "wa" ? t("whatsapp") : t("views") }), h("td", { text: titleOf(r.key) })))))) : h("p", { class: "muted", text: t("noData") }))),
    h("div", { class: "grid cols2", style: "margin-block-start:16px" }, h("div", { class: "card" }, h("h3", { text: t("topViewed") }), topTable(a.topViewed, t("views"))), h("div", { class: "card" }, h("h3", { text: t("topOrdered") }), topTable(a.topOrdered, t("orders"))))];
};

// ---------- Activity ----------
views.activity = async () => { const r = await api("GET", "/api/admin/audit"); return [pageHead(t("activity"), t("audit")), h("div", { class: "card" }, auditTable(r.entries))]; };
