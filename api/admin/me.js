'use strict';
const { route, send } = require('../_lib/http');
const auth = require('../_lib/auth');
const github = require('../_lib/github');
const store = require('../_lib/store');
const { limits, env } = require('../_lib/config');

module.exports = route(['GET'], async (req, res) => {
  const s = auth.requireAdmin(req);
  send(res, 200, {
    user: s.u, csrf: s.csrf, expiresAt: s.exp * 1000,
    status: {
      github: github.configured(), githubRepo: github.configured() ? `${env('GITHUB_OWNER')}/${env('GITHUB_REPO')}@${env('GITHUB_BRANCH', 'main')}` : null,
      analyticsPersistent: store.persistent(),
      limits: { maxUploadMB: +(limits.maxUploadBytes / 1048576).toFixed(1), maxDimension: limits.maxDimension, targetKB: Math.round(limits.targetBytes / 1024), sessionHours: limits.sessionHours },
    },
  });
});
