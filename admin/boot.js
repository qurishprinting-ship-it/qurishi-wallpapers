// boot.js — start the admin app: restore an existing session or show the login form.
"use strict";
async function boot() {
  try {
    const me = await api("GET", "/api/admin/me");
    S.me = me; S.csrf = me.csrf;
    const v = location.hash.slice(1); if (views[v]) S.view = v;
    renderApp();
  } catch { renderLogin(); }
}
window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (S.csrf && views[v] && v !== S.view) go(v); });
boot();
