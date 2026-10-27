'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** Tiny .env reader so no dependency is needed. Real environment variables win. */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^(["'])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

function getConfig(overrides = {}) {
  loadEnv(path.join(__dirname, '..', '.env'));
  const e = process.env;
  const cfg = {
    port: Number(e.PORT) || 3000,
    host: e.HOST || '0.0.0.0',
    dataDir: path.resolve(e.DATA_DIR || path.join(__dirname, '..', 'data')),
    staticDir: e.STATIC_DIR === undefined ? path.resolve(__dirname, '..', '..', 'site') : e.STATIC_DIR ? path.resolve(e.STATIC_DIR) : '',
    allowedOrigins: (e.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: e.TRUST_PROXY === 'true',
    rateMax: Number(e.RATE_LIMIT_MAX) || 5,
    rateWindowMs: (Number(e.RATE_LIMIT_WINDOW_MIN) || 10) * 60000,
    maxBodyBytes: 20 * 1024,
    successRedirect: e.SUCCESS_REDIRECT || '/thanks.html',
    mail: {
      apiKey: e.RESEND_API_KEY || '',
      to: e.MAIL_TO || 'zavexcode@gmail.com',
      from: e.MAIL_FROM || 'ZavexCode <onboarding@resend.dev>',
      apiUrl: e.RESEND_API_URL || 'https://api.resend.com/emails',
    },
  };
  return { ...cfg, ...overrides, mail: { ...cfg.mail, ...(overrides.mail || {}) } };
}

module.exports = { getConfig };
