'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'zx-'));
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${s.address().port}`)));
const lines = (dir) => { const f = path.join(dir, 'submissions.jsonl'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
const post = (base, p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), redirect: 'manual' });
const good = { name: 'Ali Khan', email: 'ali@example.com', service: 'SEO Services', details: 'I need help ranking my shop.' };

async function withServer(overrides, fn) {
  const dataDir = tmp();
  const server = createServer({ dataDir, staticDir: '', rateMax: 100, ...overrides });
  const base = await listen(server);
  try { await fn(base, dataDir); } finally { await new Promise((r) => server.close(r)); }
}

test('health check', () => withServer({}, async (base) => {
  const r = await fetch(base + '/api/health'); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
}));

test('valid contact submission is saved', () => withServer({}, async (base, dir) => {
  const r = await post(base, '/api/contact', good);
  assert.equal(r.status, 200);
  const j = await r.json(); assert.equal(j.ok, true); assert.ok(j.id);
  const rows = lines(dir); assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'contact'); assert.equal(rows[0].email, 'ali@example.com'); assert.ok(rows[0].createdAt);
}));

test('valid software-interest submission is saved', () => withServer({}, async (base, dir) => {
  const r = await post(base, '/api/software-interest', { name: 'Sara', email: 's@example.com', software_type: 'CRM and client management tools', message: 'Need a CRM for clients.' });
  assert.equal(r.status, 200); assert.equal(lines(dir)[0].type, 'software-interest');
}));

test('invalid input returns 400 with field errors and saves nothing', () => withServer({}, async (base, dir) => {
  const r = await post(base, '/api/contact', { name: 'A', email: 'nope', service: '', details: 'short' });
  assert.equal(r.status, 400);
  const j = await r.json(); assert.deepEqual(Object.keys(j.errors).sort(), ['details', 'email', 'name', 'service']);
  assert.equal(lines(dir).length, 0);
}));

test('overlong fields are rejected and control characters stripped', () => withServer({}, async (base, dir) => {
  const r1 = await post(base, '/api/contact', { ...good, details: 'x'.repeat(3001) });
  assert.equal(r1.status, 400);
  const r2 = await post(base, '/api/contact', { ...good, name: 'Ali\u0000 Khan\u0007' });
  assert.equal(r2.status, 200); assert.equal(lines(dir)[0].name, 'Ali Khan');
}));

test('honeypot: pretends success, stores nothing', () => withServer({}, async (base, dir) => {
  const r = await post(base, '/api/contact', { ...good, _honey: 'http://spam' });
  assert.equal(r.status, 200); assert.equal(lines(dir).length, 0);
}));

test('rate limit returns 429 with Retry-After', () => withServer({ rateMax: 3 }, async (base) => {
  for (let i = 0; i < 3; i++) assert.equal((await post(base, '/api/contact', good)).status, 200);
  const r = await post(base, '/api/contact', good);
  assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0);
}));

test('payload over 20KB gets 413; bad JSON 400; wrong content-type 415; GET 405', () => withServer({}, async (base) => {
  const big = await post(base, '/api/contact', { ...good, details: 'x'.repeat(30000) }).catch(() => ({ status: 413 }));
  assert.equal(big.status, 413);
  const bad = await fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
  const ct = await fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' });
  assert.equal(ct.status, 415);
  assert.equal((await fetch(base + '/api/contact')).status, 405);
  assert.equal((await fetch(base + '/api/nothing')).status, 404);
}));

test('plain HTML form post redirects to the thank-you page', () => withServer({}, async (base, dir) => {
  const r = await fetch(base + '/api/contact', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' }, body: new URLSearchParams(good).toString() });
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/thanks.html'); assert.equal(lines(dir).length, 1);
}));

test('CORS: allowed origin passes, unknown origin blocked, same origin fine', () => withServer({ allowedOrigins: ['https://www.zavexcode.com'] }, async (base, dir) => {
  const pre = await fetch(base + '/api/contact', { method: 'OPTIONS', headers: { Origin: 'https://www.zavexcode.com' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'https://www.zavexcode.com');
  const ok = await post(base, '/api/contact', good, { Origin: 'https://www.zavexcode.com' });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('access-control-allow-origin'), 'https://www.zavexcode.com');
  const evil = await post(base, '/api/contact', good, { Origin: 'https://evil.example' });
  assert.equal(evil.status, 403); assert.equal(lines(dir).length, 1);
}));

test('email: sent through the mail API with auth and reply-to', async () => {
  const got = [];
  const mock = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { got.push({ auth: req.headers.authorization, body: JSON.parse(b) }); res.writeHead(200); res.end('{}'); }); });
  const mailBase = await listen(mock);
  await withServer({ mail: { apiKey: 'test-key', apiUrl: mailBase + '/emails', to: 'me@example.com', from: 'a@b.c' } }, async (base) => {
    assert.equal((await post(base, '/api/contact', good)).status, 200);
    await new Promise((r) => setTimeout(r, 150));
  });
  await new Promise((r) => mock.close(r));
  assert.equal(got.length, 1); assert.equal(got[0].auth, 'Bearer test-key');
  assert.equal(got[0].body.subject, 'New ZavexCode website inquiry'); assert.deepEqual(got[0].body.to, ['me@example.com']); assert.equal(got[0].body.reply_to, 'ali@example.com');
  assert.match(got[0].body.text, /Project details: I need help ranking my shop\./);
});

test('email failure never loses the submission', async () => {
  await withServer({ mail: { apiKey: 'k', apiUrl: 'http://127.0.0.1:1/emails' } }, async (base, dir) => {
    assert.equal((await post(base, '/api/contact', good)).status, 200); assert.equal(lines(dir).length, 1);
  });
});

test('static files: served, 404 page, traversal and dotfiles blocked', async () => {
  const site = tmp();
  fs.writeFileSync(path.join(site, 'index.html'), '<h1>home</h1>'); fs.writeFileSync(path.join(site, '404.html'), 'nope'); fs.writeFileSync(path.join(site, '.env'), 'SECRET=1');
  fs.mkdirSync(path.join(site, 'services')); fs.writeFileSync(path.join(site, 'services', 'index.html'), 'svc');
  fs.writeFileSync(path.join(path.dirname(site), 'outside.txt'), 'outside');
  await withServer({ staticDir: site }, async (base) => {
    assert.equal(await (await fetch(base + '/')).text(), '<h1>home</h1>');
    assert.equal(await (await fetch(base + '/services/')).text(), 'svc');
    const m = await fetch(base + '/missing'); assert.equal(m.status, 404); assert.equal(await m.text(), 'nope');
    assert.equal((await fetch(base + '/.env')).status, 404);
    const raw = await new Promise((resolve) => { const u = new URL(base); const req = http.request({ host: u.hostname, port: u.port, path: '/../outside.txt', method: 'GET' }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, b })); }); req.end(); });
    assert.ok(raw.status === 403 || raw.status === 404 || raw.b !== 'outside', 'traversal must not expose files');
    const enc = await fetch(base + '/%2e%2e/outside.txt'); assert.notEqual(await enc.text(), 'outside');
  });
});

test('backend files copied into the website folder are never served', async () => {
  const site = tmp();
  fs.writeFileSync(path.join(site, 'index.html'), 'home'); fs.writeFileSync(path.join(site, 'server.js'), 'secret code'); fs.writeFileSync(path.join(site, 'package.json'), '{}');
  fs.mkdirSync(path.join(site, 'data')); fs.writeFileSync(path.join(site, 'data', 'submissions.jsonl'), '{"email":"x@y.z"}');
  fs.mkdirSync(path.join(site, 'lib')); fs.writeFileSync(path.join(site, 'lib', 'config.js'), 'x');
  fs.mkdirSync(path.join(site, 'js')); fs.writeFileSync(path.join(site, 'js', 'main.js'), 'public');
  await withServer({ staticDir: site }, async (base) => {
    for (const p of ['/server.js', '/package.json', '/data/submissions.jsonl', '/lib/config.js']) assert.equal((await fetch(base + p)).status, 404, p);
    assert.equal(await (await fetch(base + '/js/main.js')).text(), 'public');
  });
});

test('starting on a busy port explains the problem', async () => {
  const { spawnSync } = require('node:child_process');
  const blocker = http.createServer(); const base = await listen(blocker); const port = new URL(base).port;
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: port, STATIC_DIR: '' }, encoding: 'utf8' });
  await new Promise((res) => blocker.close(res));
  assert.equal(r.status, 1); assert.match(r.stderr, /already in use/); assert.match(r.stderr, /taskkill/);
});

test('backend files and saved submissions are never served, even when inside the site folder', async () => {
  const site = tmp(); // pretend server.js lives inside the website folder
  fs.writeFileSync(path.join(site, 'index.html'), 'home');
  const dataDir = path.join(site, 'data'); fs.mkdirSync(dataDir); fs.writeFileSync(path.join(dataDir, 'submissions.jsonl'), '{"email":"private@example.com"}\n');
  await withServer({ staticDir: site, dataDir }, async (base) => {
    assert.equal((await fetch(base + '/data/submissions.jsonl')).status, 404);
    assert.equal((await fetch(base + '/')).status, 200);
  });
  const real = path.resolve(__dirname, '..');
  await withServer({ staticDir: real }, async (base) => {
    for (const p of ['/server.js', '/lib/store.js', '/package.json', '/.env']) assert.equal((await fetch(base + p)).status, 404, p);
  });
});
