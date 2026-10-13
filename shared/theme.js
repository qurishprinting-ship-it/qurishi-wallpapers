/* shared/theme.js — brand-colour tokens with accessible contrast. Used by the public site and the admin preview.
 * The admin picks ONE primary colour. From it we derive:
 *   --primary / --on-primary         buttons and active pills (text colour chosen for >= 4.5:1 where possible)
 *   --accent-d* / --accent-l*        coloured TEXT, icons and borders on the dark / light page background,
 *                                    lightened or darkened as needed so they stay readable (>= 4.5:1).
 * A very dark or very light primary therefore never produces unreadable text.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QTheme = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DEFAULT_PRIMARY = '#121efb';
  const DARK_BG = '#0a0a12';   // matches --bg in style.css (dark mode)
  const LIGHT_BG = '#e8dfc8';  // matches --bg in style.css (light mode)
  const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

  function normalizeHex(v) {
    if (typeof v !== 'string') return null;
    const m = v.trim().match(HEX_RE);
    if (!m) return null;
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return '#' + h;
  }
  const toRgb = (hex) => { const h = normalizeHex(hex).slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const toHex = (rgb) => '#' + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');

  function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb([h, s, l]) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const luminance = (hex) => { const [r, g, b] = toRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const round2 = (n) => Math.round(n * 100) / 100;

  // White or near-black, whichever reads better on `bg`.
  function readableOn(bg) { return contrast('#ffffff', bg) >= contrast('#0b0b12', bg) ? '#ffffff' : '#0b0b12'; }

  // Keep hue/saturation, move lightness (up on dark pages, down on light pages) until `min` contrast is met.
  function ensureContrast(hex, bg, min, dir) {
    if (contrast(hex, bg) >= min) return hex;
    let [h, s, l] = rgbToHsl(toRgb(hex));
    let best = hex;
    for (let i = 0; i < 100; i++) {
      l += dir * 0.01;
      if (l > 1 || l < 0) break;
      best = toHex(hslToRgb([h, s, l]));
      if (contrast(best, bg) >= min) return best;
    }
    return best;
  }
  function shift(hex, dl) { const [h, s, l] = rgbToHsl(toRgb(hex)); return toHex(hslToRgb([h, s, Math.max(0, Math.min(1, l + dl))])); }

  function tokens(input) {
    const primary = normalizeHex(input) || DEFAULT_PRIMARY;
    const onDark = ensureContrast(primary, DARK_BG, 4.5, +1);
    const onLight = ensureContrast(primary, LIGHT_BG, 4.5, -1);
    const t = {
      primary, onPrimary: readableOn(primary),
      onDark, onDarkHi: ensureContrast(shift(onDark, 0.1), DARK_BG, 4.5, +1),
      onLight, onLightHi: ensureContrast(shift(onLight, 0.06), LIGHT_BG, 3, -1),
    };
    t.contrast = {
      buttonText: round2(contrast(t.primary, t.onPrimary)),
      textOnDark: round2(contrast(t.onDark, DARK_BG)),
      textOnLight: round2(contrast(t.onLight, LIGHT_BG)),
      rawOnDark: round2(contrast(primary, DARK_BG)),
      rawOnLight: round2(contrast(primary, LIGHT_BG)),
    };
    t.adjusted = { dark: t.onDark !== primary, light: t.onLight !== primary };
    return t;
  }

  const rgbStr = (hex) => toRgb(hex).join(' ');
  function cssVars(input) {
    const t = tokens(input);
    return {
      '--primary': t.primary, '--primary-rgb': rgbStr(t.primary), '--on-primary': t.onPrimary,
      '--accent-d': t.onDark, '--accent-d-rgb': rgbStr(t.onDark), '--accent-d-hi': t.onDarkHi,
      '--accent-l': t.onLight, '--accent-l-rgb': rgbStr(t.onLight), '--accent-l-hi': t.onLightHi,
    };
  }
  function apply(input, el) {
    const target = el || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!target) return null;
    const vars = cssVars(input);
    for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v);
    return vars;
  }

  return { DEFAULT_PRIMARY, DARK_BG, LIGHT_BG, normalizeHex, tokens, cssVars, apply, contrast, luminance, readableOn };
});
