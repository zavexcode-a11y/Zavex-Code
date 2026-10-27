'use strict';
/**
 * ZavexCode backend: receives the website forms.
 *   POST /api/contact             contact page form
 *   POST /api/software-interest   software page form
 *   GET  /api/health              uptime check
 * It also serves the ../site folder, so one `node server.js` runs everything locally.
 * No dependencies. Needs Node 18+.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('./lib/config');
const { validate } = require('./lib/validate');
const store = require('./lib/store');
const mail = require('./lib/mail');
const { createLimiter } = require('./lib/ratelimit');

const PRIVATE = new Set(['server.js', 'package.json', 'package-lock.json', 'readme.md', 'lib', 'test', 'data', 'node_modules']);
const ROUTES = { '/api/contact': 'contact', '/api/software-interest': 'software-interest' };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

function createServer(overrides = {}) {
  const cfg = getConfig(overrides);
  const limiter = createLimiter(cfg.rateMax, cfg.rateWindowMs);

  const clientIp = (req) => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

  function baseHeaders(extra = {}) {
    return { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...extra };
  }
  function send(res, status, body, headers = {}) {
    const isJson = typeof body === 'object';
    res.writeHead(status, baseHeaders({ 'Content-Type': isJson ? 'application/json' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers }));
    res.end(isJson ? JSON.stringify(body) : body);
  }

  /** Same-origin requests are always fine. Other origins must be listed in ALLOWED_ORIGINS. */
  function originAllowed(req) {
    const origin = req.headers.origin;
    if (!origin) return { ok: true };
    let host;
    try { host = new URL(origin).host; } catch { return { ok: false }; }
    if (host === req.headers.host) return { ok: true };
    return cfg.allowedOrigins.includes(origin) ? { ok: true, cors: origin } : { ok: false };
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > cfg.maxBodyBytes) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const type = String(req.headers['content-type'] || '').split(';')[0].trim();
        try {
          if (type === 'application/json') return resolve(JSON.parse(raw || '{}'));
          if (type === 'application/x-www-form-urlencoded') return resolve(Object.fromEntries(new URLSearchParams(raw)));
        } catch { return reject(Object.assign(new Error('Invalid body'), { status: 400 })); }
        reject(Object.assign(new Error('Unsupported content type'), { status: 415 }));
      });
      req.on('error', reject);
    });
  }

  async function handleForm(req, res, kind, cors) {
    const corsHeaders = cors ? { 'Access-Control-Allow-Origin': cors, Vary: 'Origin' } : {};
    const wantsHtml = String(req.headers.accept || '').includes('text/html') && req.headers['content-type'] !== 'application/json';

    const rate = limiter.check(clientIp(req));
    if (!rate.allowed) return send(res, 429, { ok: false, error: 'Too many requests. Please try again later.' }, { ...corsHeaders, 'Retry-After': String(rate.retryAfter) });

    let body;
    try { body = await readBody(req); } catch (err) { return send(res, err.status || 400, { ok: false, error: err.message }, corsHeaders); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, { ok: false, error: 'Invalid body' }, corsHeaders);

    // honeypot: bots fill the hidden field. Pretend success, store nothing.
    if (String(body._honey || '').trim()) {
      return wantsHtml ? send(res, 303, '', { ...corsHeaders, Location: cfg.successRedirect }) : send(res, 200, { ok: true }, corsHeaders);
    }

    const result = validate(kind, body);
    if (!result.ok) return send(res, 400, { ok: false, errors: result.errors }, corsHeaders);

    let record;
    try { record = await store.save(cfg.dataDir, kind, result.data); }
    catch (err) { console.error('[store] failed:', err.message); return send(res, 500, { ok: false, error: 'Could not save your message. Please try again or contact us on WhatsApp.' }, corsHeaders); }

    // email is best effort: the submission is already saved
    const text = Object.entries(result.data).map(([k, v]) => `${result.labels[k]}: ${v}`).join('\n') + `\n\nID: ${record.id}\nReceived: ${record.createdAt}`;
    mail.notify(cfg.mail, { subject: result.subject, text, replyTo: result.data.email }).catch((err) => console.error('[mail] failed:', err.message));

    return wantsHtml ? send(res, 303, '', { ...corsHeaders, Location: cfg.successRedirect }) : send(res, 200, { ok: true, id: record.id }, corsHeaders);
  }

  function serveStatic(req, res, pathname) {
    if (!cfg.staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) return send(res, 404, 'Not found');
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
    const root = cfg.staticDir;
    let file = path.join(root, path.normalize(rel));
    if (file !== root && !file.startsWith(root + path.sep)) return send(res, 403, 'Forbidden');
    if (path.basename(file).startsWith('.')) return send(res, 404, 'Not found');
    // never serve backend code or saved submissions, even if this folder sits inside the website folder
    const here = __dirname;
    const hidden = [cfg.dataDir, path.join(here, 'lib'), path.join(here, 'test'), path.join(here, 'node_modules'), path.join(here, 'server.js'), path.join(here, 'package.json'), path.join(here, 'README.md')];
    if (hidden.some((h) => file === h || file.startsWith(h + path.sep))) return send(res, 404, 'Not found');
    // never serve backend files (source, saved submissions, secrets), even if they were copied into the website folder
    const first = rel.split(/[\\/]+/).filter(Boolean)[0] || '';
    if (PRIVATE.has(first.toLowerCase()) || /\.(jsonl|env|log)$/i.test(rel)) return send(res, 404, 'Not found');
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
    let status = 200;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { file = path.join(root, '404.html'); status = 404; if (!fs.existsSync(file)) return send(res, 404, 'Not found'); }
    res.writeHead(status, baseHeaders({ 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      if (pathname.startsWith('/api/')) {
        const origin = originAllowed(req);
        if (!origin.ok) return send(res, 403, { ok: false, error: 'Origin not allowed' });
        if (req.method === 'OPTIONS') {
          return send(res, 204, '', origin.cors ? { 'Access-Control-Allow-Origin': origin.cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } : {});
        }
        if (pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });
        if (ROUTES[pathname]) {
          if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Use POST' }, { Allow: 'POST, OPTIONS' });
          return await handleForm(req, res, ROUTES[pathname], origin.cors);
        }
        return send(res, 404, { ok: false, error: 'Not found' });
      }
      return serveStatic(req, res, pathname);
    } catch (err) {
      console.error('[server]', err);
      if (!res.headersSent) send(res, 500, { ok: false, error: 'Server error' });
    }
  });
  server.on('close', () => limiter.stop());
  server.config = cfg;
  return server;
}

module.exports = { createServer };

if (require.main === module) {
  const server = createServer();
  const { port, host, staticDir, dataDir } = server.config;
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${port} is already in use (another program, or an earlier copy of this server, is running).`);
      console.error('Fix it in one of these ways:');
      console.error(`  1. Use another port:   PowerShell:  $env:PORT=5000; node server.js     (or put PORT=5000 in a .env file)`);
      console.error(`  2. Free the port:      netstat -ano | findstr :${port}     then     taskkill /PID <number> /F`);
      process.exit(1);
    }
    throw err;
  });
  server.listen(port, host, () => {
    console.log(`ZavexCode backend listening on http://localhost:${port}`);
    console.log(`  submissions saved to ${dataDir}`);
    console.log(staticDir ? `  serving website from ${staticDir}` : '  API only (STATIC_DIR is empty)');
    console.log(server.config.mail.apiKey ? `  email notifications -> ${server.config.mail.to}` : '  email notifications off (set RESEND_API_KEY to enable)');
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
}
