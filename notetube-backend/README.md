# NoteTube backend (Spring Boot)

Java 21 + Spring Boot 3.5 backend for the NoteTube React app. It implements every route in `docs/API.md`
(v3) and runs with **zero setup**: an embedded database is created automatically, and without a Gemini
key it runs in **DEMO mode** (fake but realistic notes), so the frontend works on day one.

> **Status: written but not yet compiled by its author.** The code was syntax-checked and its pure-Java
> logic was run, but Maven was not available when it was written. Run `mvn test` first (see below) and
> report any errors.

## 1. Prerequisites
* JDK 21 (`java -version` must say 21).
* Maven 3.9+ (`mvn -v`). Optional: run `mvn -N wrapper:wrapper` once to create `mvnw` / `mvnw.cmd`.
* No Docker, no PostgreSQL needed for local use.

## 2. Run it (port 8787)
```powershell
cd notetube-backend
copy .env.example .env        # then edit .env (everything is optional for local use)
mvn spring-boot:run
```
Then start the React app (`npm run dev` in `web/`). Vite proxies `/api` to `http://localhost:8787`.

Spring does not read `.env` by itself; `application.yml` imports it (`spring.config.import`), so a `.env`
in the folder you launch from just works. Real OS environment variables also work (and win over `.env`).
Never commit `.env` (it is in `.gitignore`).

## 3. Configuration (`.env`)
| Variable | Meaning |
|---|---|
| `PORT` | HTTP port (default 8787) |
| `FRONTEND_URL` | Allowed browser origin(s), comma separated. Used for the Origin check on POST/PATCH/DELETE |
| `SESSION_SECRET` | 32+ random bytes, Base64 (`openssl rand -base64 48`). **Required when `NODE_ENV=production`** |
| `SESSION_DAYS` | Cookie/session lifetime (default 30) |
| `GOOGLE_CLIENT_ID` | Enables Google sign-in |
| `GEMINI_API_KEY` | Empty = DEMO mode. Set it for real AI notes |
| `GEMINI_MODEL` | Default `gemini-3.6-flash` (verified to exist in Google's docs; Google lists it as a previous-generation Flash model, newer ones exist) |
| `YOUTUBE_API_KEY` | Optional: video title, channel, thumbnail, duration, and "does this video exist/public" check |
| `DAILY_GENERATION_LIMIT` | Notes per user per UTC day (default 5) |
| `MAX_VIDEO_MINUTES` | Longer videos fail with `VIDEO_TOO_LONG` (default 240) |
| `WORKER_CONCURRENCY` | Size of the generation thread pool (default 2) |
| `GEMINI_MAX_RPM` | Shared Gemini requests per minute (default 10) |
| `NODE_ENV` | `development` or `production`. Mapped to `app.environment` (Spring ignores `NODE_ENV` by itself). Production makes the cookie `Secure` and enforces `SESSION_SECRET` |
| `TRUST_PROXY` | `true` only behind your own reverse proxy: the client IP then comes from the last `X-Forwarded-For` entry |
| `LOG_LEVEL` | Root log level |
| `SPRING_PROFILES_ACTIVE` | unset = embedded H2 database in `./data`. `postgres` = use `DATABASE_URL` |
| `DATABASE_URL` | Only with the `postgres` profile. Node style `postgres://user:pass@host:5432/db` (converted to JDBC; percent-encode special characters in the password) |
| `AUTH_RATE_LIMIT`, `NOTE_RATE_LIMIT` | Optional overrides (defaults 10 per 15 min per IP, 3 per minute per user) |

## 4. Database
* Default: embedded H2 file database in `./data` (delete the folder to reset). Flyway creates the schema.
* PostgreSQL: create an empty database, set `SPRING_PROFILES_ACTIVE=postgres` and `DATABASE_URL`.
  Flyway applies `V1__init.sql` on start. Hibernate only *validates* the schema (never changes it).
* Add future changes as new files `V2__...sql`; never edit an applied migration.
* If a database was created by the old Node server, do not point this app at it without a compatible migration.

## 5. DEMO mode
With no `GEMINI_API_KEY` the app logs `DEMO mode` at startup. Pasted transcripts (200+ words) produce
notes built from your text; a YouTube link produces sample "How hash tables work" notes with timestamps;
flashcards and quizzes are generated too. A YouTube URL containing `nocaptions`
(e.g. `https://www.youtube.com/watch?v=nocaptions1`) fails with `NO_CAPTIONS` so you can test the
retry-with-pasted-transcript flow.

## 6. How generation works
`POST /api/notes` saves the note (`queued`) and returns `202`. A bounded worker pool (`WORKER_CONCURRENCY`)
then: checks video length, uses the pasted/saved transcript (otherwise Gemini's YouTube video input),
rejects transcripts under 200 words (`TRANSCRIPT_TOO_SHORT`), generates notes (long transcripts are chunked,
summarised and merged), saves them in one transaction, then builds requested flashcards/quiz **from the saved
notes**. Progress is committed as it goes. On startup, notes left `queued`/`processing` are resumed.
Official YouTube caption download needs OAuth/ownership, so this app does **not** scrape captions.

## 7. Google sign-in
Not described in `docs/API.md`, so this is a **proposed** endpoint: `POST /api/auth/google` with
`{"credential": "<Google ID token>"}` returns `200 {user}` and sets the same `nt_session` cookie.
The backend verifies signature, issuer, audience (= `GOOGLE_CLIENT_ID`) and expiry itself.
Account policy: the Google `sub` is the identity key; a Google login whose verified email already belongs to a
password account is refused with `409 EMAIL_TAKEN` (no automatic linking).
Frontend: add `googleLogin: (credential) => request('/auth/google', { method: 'POST', body: { credential } })`
to `web/src/api.js`, load Google Identity Services and call it from the button callback.
Create the OAuth client in Google Cloud Console (Web application) with `http://localhost:5173` as an authorised JavaScript origin.

## 8. Try it from PowerShell
```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$h = @{ }  # no Origin header needed outside the browser
Invoke-RestMethod http://localhost:8787/api/auth/signup -Method Post -WebSession $s -ContentType 'application/json' `
  -Body '{"name":"Ayush","email":"a@example.com","password":"password123"}'
$r = Invoke-RestMethod http://localhost:8787/api/notes -Method Post -WebSession $s -ContentType 'application/json' `
  -Body (@{ url = 'https://youtu.be/dQw4w9WgXcQ'; extras = @{ flashcards = $true; quiz = $true } } | ConvertTo-Json)
Start-Sleep 3
Invoke-RestMethod "http://localhost:8787/api/notes/$($r.id)" -WebSession $s | ConvertTo-Json -Depth 6
Invoke-RestMethod http://localhost:8787/api/stats -WebSession $s
```
curl: `curl.exe -c jar.txt -b jar.txt -H "Content-Type: application/json" -d "{\"email\":\"a@example.com\",\"password\":\"password123\"}" http://localhost:8787/api/auth/login`

## 9. Tests
```powershell
mvn test
```
Unit tests (scheduling, validation, chunking, URLs, rate limiter, DB URL parsing, error JSON) and
`ApiIntegrationTest` (auth, Google with a mocked verifier, notes, `NO_CAPTIONS` -> retry, extras, cards,
quiz scoring, stats, ownership, recovery). They use in-memory H2 and the demo generator; no network.

## 10. Security notes and limits
* Sessions: random 32-byte token in an HttpOnly, SameSite=Lax cookie; only an HMAC-SHA256 hash (keyed by
  `SESSION_SECRET`) is stored. Logout deletes the session; expired sessions are purged hourly.
* CSRF tokens are disabled on purpose; instead POST/PUT/PATCH/DELETE must come from an allowed Origin
  and bodies must be `application/json`.
* Limits are **in memory**: they reset on restart and are not shared between several server instances.
  Auth 10 per 15 min per IP; note creation 3 per minute per user; daily limit per user; Gemini RPM.
* Bodies: 1 MB, 2 MB for creating/retrying notes. Requests with a body and no length (chunked) are refused.
* Stats streak is counted within the 120-day heatmap window.

## 11. Hosting (e.g. React on Vercel)
Vercel hosts the frontend; the Spring Boot app needs a host that runs a JVM (Docker is common but not the
only way). Add a rewrite so the browser stays same-origin and the cookie works:
`vercel.json`: `{ "rewrites": [{ "source": "/api/:path*", "destination": "https://YOUR-BACKEND/api/:path*" }] }`
Backend env: `NODE_ENV=production`, `SESSION_SECRET`, `FRONTEND_URL=https://your-app.vercel.app`,
`SPRING_PROFILES_ACTIVE=postgres`, `DATABASE_URL`, `TRUST_PROXY=true`.

## 12. Implemented / not done
Implemented: all routes in `docs/API.md`; Google sign-in (proposed route); demo mode; chunking, retry and
backoff for Gemini; recovery on restart.
Not done / unverified: live Gemini, YouTube and Google calls (need your keys); public share routes (not in the
contract); the app has not been compiled or run by its author.
