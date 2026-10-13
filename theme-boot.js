// theme-boot.js — applies the last known brand colour BEFORE first paint (no flash). script.js then refreshes it from settings.json.
"use strict";
(function () {
  try {
    var c = localStorage.getItem("qurishi_primary");
    if (c && window.QTheme) QTheme.apply(c);
  } catch (e) { /* private mode: defaults in style.css are already #121efb */ }
})();
