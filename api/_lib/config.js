'use strict';
// Central place for configuration. Secrets only ever come from environment variables.
const CATEGORIES = ['wall', 'ceiling', 'flat'];

function env(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const limits = {
  // Vercel serverless functions reject request bodies above ~4.5 MB.
  maxUploadBytes: 4.4 * 1024 * 1024,
  maxPixels: 100e6,
  maxDimension: Number(env('IMAGE_MAX_DIMENSION', '1600')),
  targetBytes: Number(env('IMAGE_TARGET_KB', '50')) * 1024,
  hardMaxBytes: Number(env('IMAGE_HARD_MAX_KB', '150')) * 1024,
  thumbWidth: 480,
  sessionHours: Number(env('SESSION_HOURS', '8')),
  bulkMax: 25,
};

module.exports = { CATEGORIES, env, limits };
