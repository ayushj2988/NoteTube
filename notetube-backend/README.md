# NoteTube backend

REST API for NoteTube: turns YouTube lectures (or pasted transcripts) into structured notes, flashcards and quizzes.
Node 22 + TypeScript (strict) + Hono, PostgreSQL 16 + Drizzle, argon2id sessions, Gemini for generation.
It implements the frontend's API contract exactly (paths, field names, status codes, error codes).

## Quick start

Prerequisites: Node 22+, Docker (for Postgres), and API keys for Gemini and YouTube (see below).

```bash
cp .env.example .env            # then fill in the blanks
npm install
docker compose up -d && npm run db:migrate && npm run dev
```

Optional: `npm run seed` creates `demo@example.com` / `demo-password-123` with two notes so the UI isn't empty
(it refuses to run when `NODE_ENV=production`).

Run the frontend against it: `VITE_API_PROXY=http://localhost:8787 npm run dev`
(Vite proxies `/api`, so there is no CORS and the cookie stays same-origin).

## Environment variables

The server refuses to start and lists every missing or invalid variable.

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no (8787) | |
| `DATABASE_URL` | yes | `postgres://notetube:notetube@localhost:5432/notetube` for the compose database |
| `FRONTEND_URL` | yes | Origin check (CSRF), CORS and share links |
| `SESSION_SECRET` | yes | 32+ random chars: `openssl rand -hex 32` |
| `SESSION_DAYS` | no (30) | Cookie and session lifetime |
| `GOOGLE_CLIENT_ID` | yes | Same value as the frontend's `VITE_GOOGLE_CLIENT_ID` |
| `GEMINI_API_KEY` | yes | Server-side only. Never put it in a `VITE_` variable |
| `GEMINI_MODEL` | yes | Current Flash-class id. `.env.example` has `gemini-3.6-flash` from the docs' model list, but ids rotate: check ai.google.dev/gemini-api/docs/models |
| `YOUTUBE_API_KEY` | yes | Data API v3, `videos.list` only (about 1 quota unit per video) |
| `DAILY_GENERATION_LIMIT` | no (5) | Per user per UTC day. Failed notes are refunded |
| `MAX_VIDEO_MINUTES` | no (240) | |
| `TRUST_PROXY` | no (false) | **Set `true` behind Render/Railway/nginx**, otherwise every user shares one IP and the per-IP auth limit locks everyone out |
| `WORKER_CONCURRENCY` | no (2) | Notes processed in parallel |
| `GEMINI_MAX_RPM` | no (10) | Project-wide cap on model requests. The free tier is per *project*, not per user |
| `LOG_LEVEL` | no (info) | |

### Getting the keys

- **Gemini**: https://aistudio.google.com/apikey, "Create API key". The free tier needs no card. Limits are per project and
  shown on AI Studio's rate-limit page; they change, so don't hard-code them. On the free tier Google may use prompts to improve
  its products, so mention that in your privacy text or use a paid tier before real users.
- **YouTube Data API**: Google Cloud Console, create a project, enable "YouTube Data API v3", Credentials, "Create API key"
  (restrict it to that API).
- **Google sign-in**: Cloud Console, APIs & Services, Credentials, "OAuth client ID", type "Web application", and add your
  frontend origin under "Authorized JavaScript origins". The client ID goes in both `GOOGLE_CLIENT_ID` (here) and
  `VITE_GOOGLE_CLIENT_ID` (frontend).

## Tests

```bash
npm test          # 39 tests, real Postgres, fake YouTube / captions / Gemini / Google
npm run typecheck
```

Tests use `TEST_DATABASE_URL` (default `postgres://notetube:notetube@localhost:5432/notetube_test`). Create that database once
(`docker compose exec db createdb -U notetube notetube_test`); the suite drops and re-migrates its schema on every run.
Nothing touches the network.

## How generation works

`POST /notes` validates, checks the daily quota and inserts the note plus a `generation_log` row in **one transaction**,
serialised per user with an advisory lock (two simultaneous requests can't both slip under the limit). The note starts `queued`.

The worker is a Postgres-backed queue: it claims a note with `FOR UPDATE SKIP LOCKED` and a 2-minute lease (heartbeat every 30 s).
If the process dies the lease expires and the note is picked up again; on boot anything left in `processing` is reclaimed
immediately. After 3 attempts a note fails instead of looping.

1. **Fetching transcript.** Video metadata (cached 24 h), then the first source that works: text the user pasted, the transcript
   cache, a caption provider behind the `TranscriptProvider` interface, and finally Gemini reading the public video URL.
   Only provider-fetched captions are cached, never user-pasted text.
2. **Finding key concepts / Writing notes.** One Gemini call with JSON-schema output (two stages for very long transcripts: chunk
   summaries first). The transcript is wrapped as untrusted data. Transient provider errors (429, 5xx, timeouts) are retried twice
   with backoff.
3. **Validate.** zod schema, length caps, 4 distinct options, `answer_index` 0-3, no timestamps beyond the video, de-duplicated
   cards, HTML tags stripped (code spans and fences are kept). On failure there is **one repair attempt** that shows the model its
   own validation errors; still failing means `AI_BAD_RESPONSE`.
4. **Building flashcards and quiz.** Note, cards and questions are saved in one transaction and the pasted transcript is deleted.
   Any failure sets `status = failed` with a contract error code and refunds the quota.

## Assumptions and things worth knowing

- **Contract deviations: none.** Where the contract is silent I chose: a request body over 1.5 MB gets `413` with code
  `VALIDATION`; a YouTube outage or exhausted YouTube key becomes `AI_UNAVAILABLE` (no better code exists); retrying a non-failed
  note is `422 VALIDATION`; `Note.video` is `null` until the worker has fetched metadata; the public share page only serves
  `ready` notes.
- **Not verified against live services** (no network where this was built): the caption library (unofficial; expect breakage and
  datacenter-IP blocks, which is why pasted transcripts and the Gemini-video fallback exist), Gemini's YouTube-URL input (a preview
  feature with a daily free-tier cap), real Google ID tokens, and the real `@google/genai` structured-output call. All sit behind
  interfaces with fakes in the tests, but give each one a manual run with real keys before relying on it.
- **Cookies.** `SameSite=Lax` means the API and frontend must be same-site: proxy `/api` through the frontend host, or use one
  registrable domain. A separate `*.vercel.app` plus `*.onrender.com` pair will log in and then fail with 401 on every call.
- **Rate limiters are in memory** (single instance). If you scale out, move the counters to Postgres or Redis; the `RateLimiter`
  interface stays the same. The worker queue already supports several instances, except the boot-time lease reset, which assumes one.
- **Deleting data** keeps the generation log, so it can't be used to reset the quota. `DELETE /me` removes everything, sessions and
  log included.
- **Search** uses a trigger-maintained `tsvector` with prefix matching ("graph" finds "graphs"), not a generated column, because
  generated columns can't use `array_to_string` or read other tables.

## Layout

```
src/routes      HTTP layer (one file per resource)
src/services    auth, notes, generation pipeline, YouTube / transcript / Gemini adapters, quota
src/jobs        Postgres-backed worker
src/db          Drizzle schema, migrate, seed
src/lib         errors, SM-2, URL parsing, sanitising, rate limiter, logger
drizzle/        generated SQL migrations (plus the search trigger)
tests/          Vitest, real Postgres
```
