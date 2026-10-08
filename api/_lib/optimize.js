'use strict';
const crypto = require('crypto');
const { limits } = require('./config');
const { HttpError } = require('./http');

let sharp;
function getSharp() {
  if (!sharp) {
    try { sharp = require('sharp'); } catch { throw new HttpError(503, 'Image optimizer (sharp) is not installed'); }
  }
  return sharp;
}

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'avif', 'tiff']);
const FULL_QUALITIES = [82, 74, 66, 60, 55];
const SCALES = [1, 0.88, 0.76];

/**
 * Validates the real image content (not the extension), fixes EXIF orientation, strips metadata,
 * resizes, and encodes WebP adaptively: highest quality that fits the ~50 KB target; if even q55 does not fit,
 * prefer visual quality (q60 up to the hard cap) over forcing a tiny file.
 */
async function optimize(input) {
  const sh = getSharp();
  let meta;
  try {
    meta = await sh(input, { limitInputPixels: limits.maxPixels, failOn: 'error' }).metadata();
  } catch {
    throw new HttpError(415, 'File is not a valid image');
  }
  if (!ALLOWED.has(meta.format)) throw new HttpError(415, `Unsupported image format: ${meta.format}`);
  if (meta.pages && meta.pages > 1) throw new HttpError(415, 'Animated images are not supported');
  if (!meta.width || !meta.height) throw new HttpError(415, 'Image has no dimensions');

  const encode = async (long, quality) => {
    const { data, info } = await sh(input, { limitInputPixels: limits.maxPixels })
      .rotate() // apply EXIF orientation
      .toColourspace('srgb')
      .resize({ width: long, height: long, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4, smartSubsample: true }) // metadata is dropped by default
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height, size: data.length, quality };
  };

  let fallback = null;
  let last = null;
  for (const scale of SCALES) {
    const long = Math.round(limits.maxDimension * scale);
    for (const q of FULL_QUALITIES) {
      const r = await encode(long, q);
      last = r;
      if (r.size <= limits.targetBytes) return finish(r);
      if (q === 60 && r.size <= limits.hardMaxBytes && !fallback) fallback = r;
    }
  }
  return finish(fallback || last);

  async function finish(full) {
    const { data, info } = await sh(full.buffer)
      .resize({ width: limits.thumbWidth, height: limits.thumbWidth * 2, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 62, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return {
      full,
      thumb: { buffer: data, width: info.width, height: info.height, size: data.length },
      original: { format: meta.format, width: meta.width, height: meta.height, size: input.length },
      hash: crypto.createHash('sha256').update(full.buffer).digest('hex').slice(0, 32),
    };
  }
}

module.exports = { optimize };
