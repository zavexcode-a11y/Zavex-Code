# ZavexCode backend

Receives the two website forms (contact + software interest), validates them, saves them, and optionally emails you.
It is separate from the website: the website is the `site/` folder, this is `backend/`. No dependencies, Node 18+.

## Run it
```
cd backend
cp .env.example .env      # optional, every value has a default
node server.js            # http://localhost:3000
npm test                  # 13 automated tests
```
`node server.js` also serves `../site`, so http://localhost:3000 shows the website with the API on the same address.
Set `STATIC_DIR=` (empty) in `.env` to run the API only.

## Folder layout (important)
Keep two separate folders side by side. Do not copy `server.js` or `lib/` into the website folder:
```
zavexcode/
  site/      <- the website (index.html, css/, js/ ...)
  backend/   <- server.js, lib/, package.json
```
Run `node server.js` from inside `backend/`. As a safety net the server never serves backend files or saved submissions, but a clean split is still the right setup.

## Troubleshooting
- **EADDRINUSE / "port already in use":** another program (or an earlier copy of this server) is using the port. Either choose another port, `$env:PORT=5000; node server.js` in PowerShell (or `PORT=5000` in `.env`), or free it with `netstat -ano | findstr :3000` then `taskkill /PID <number> /F`.
- Do not edit the port inside `server.js`; use `PORT` as above.

## Connect the website to it
Edit **`site/js/config.js`**:
- `apiUrl: ""` backend off. Forms go through FormSubmit (how it works today).
- `apiUrl: "/"` backend on the same domain as the website.
- `apiUrl: "https://api.yourdomain.com"` backend on another domain. Add your website to `ALLOWED_ORIGINS` in `.env`.

If the backend is down or unreachable, the forms automatically fall back to FormSubmit, so no message is lost.
With JavaScript off, the forms always use FormSubmit.

## Endpoints
| Method | Path | Fields |
|---|---|---|
| POST | `/api/contact` | name, email, service, details |
| POST | `/api/software-interest` | name, email, software_type, message |
| GET | `/api/health` | none |

Responses: `200 {ok:true}`, `400 {ok:false, errors:{field:message}}`, `429` too many requests, `413` too large, `403` origin not allowed.
Field rules live in `lib/validate.js` (keep them in sync if you rename a form field).

## Where submissions go
- Saved to `data/submissions.jsonl`, one JSON object per line (id, type, createdAt, fields). Back this file up. It is not served to the web.
- Email: set `RESEND_API_KEY` (free account at resend.com) and `MAIL_TO`. `MAIL_FROM` must be a sender verified in Resend. Email is best effort: a failed email never loses a submission.
- To use MongoDB later, change only the body of `save()` in `lib/store.js`.

## Spam and safety
Hidden honeypot field, 5 submissions per IP per 10 minutes (`RATE_LIMIT_*`), 20 KB body limit, control characters stripped, origin check (CORS allow-list), no IP addresses stored.
Behind a proxy or host (Render, Railway, Nginx, Cloudflare) set `TRUST_PROXY=true` so the real visitor IP is used for the limit.

## Deploying
Any Node host works (Render, Railway, Fly.io, a VPS). Start command: `node server.js`. Set the environment variables from `.env.example` in the host's dashboard. The host's disk must be persistent if you rely on `data/submissions.jsonl`.
