# NoteTube API contract (v1)

The React app talks to exactly this contract. A backend that implements it works with the frontend unchanged.
`src/dev/mockApi.ts` is an in-browser implementation of the same contract (dev only) and acts as an executable spec.

## Conventions

- Base path `/api`. JSON in, JSON out, UTF-8. Timestamps are ISO 8601 UTC strings. IDs are opaque strings.
- **Auth is a session cookie** (`HttpOnly`, `Secure` in production, `SameSite=Lax`). The browser sends it automatically
  (`credentials: "include"`). The frontend never sees a token. In development Vite proxies `/api` to the backend, so no CORS is needed.
  If you host the API on another origin, allow that origin with `Access-Control-Allow-Credentials: true`.
- Every route except `/auth/signup`, `/auth/login`, `/auth/google` and `GET /share/:token` needs a valid session, else `401 UNAUTHENTICATED`.
- Every query is scoped to the signed-in user. Another user's id returns `404 NOT_FOUND` (never `403`, so ids can't be probed).
- State-changing requests must pass an `Origin` check against the allowed frontend origin (CSRF defence on top of `SameSite`).
- `204` responses have no body. Lists are `{ "items": [...], "total": n }` unless stated.

### Errors

Every non-2xx response has this body (the frontend switches on `code`):

```json
{ "error": { "code": "QUOTA_EXCEEDED", "message": "Human readable, safe to show", "details": { } } }
```

| code | HTTP | meaning / `details` |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | no or expired session |
| `INVALID_CREDENTIALS` | 401 | wrong email or password (same message for unknown email) |
| `EMAIL_TAKEN` | 409 | signup with an existing email |
| `VALIDATION` | 422 | `details.fields = { fieldName: "message" }` |
| `NOT_FOUND` | 404 | missing or not yours |
| `FORBIDDEN` | 403 | origin check failed etc. |
| `RATE_LIMITED` | 429 | `Retry-After` header (seconds) |
| `QUOTA_EXCEEDED` | 429 | daily generation limit. `details = { limit, used, resets_at }` |
| `INVALID_URL` | 400 | not a YouTube watch / share / shorts / embed URL |
| `VIDEO_NOT_FOUND` | 404 | video deleted or id wrong |
| `VIDEO_PRIVATE` | 403 | private, unlisted-and-blocked, age-restricted or members-only |
| `VIDEO_TOO_LONG` | 422 | over `MAX_VIDEO_MINUTES` (default 240). `details.max_minutes` |
| `NO_CAPTIONS` | 422 | no transcript could be obtained by any strategy |
| `TRANSCRIPT_TOO_SHORT` | 422 | supplied transcript under ~200 characters |
| `AI_UNAVAILABLE` | 503 | model overloaded, timed out or provider quota hit |
| `AI_BAD_RESPONSE` | 502 | model output failed schema validation after one repair retry |

---

## Auth and account

### Types

```ts
User = { id, name, email, avatar_url: string | null, has_password: boolean, created_at }
```

| Method and path | Body | Response |
| --- | --- | --- |
| `POST /auth/signup` | `{ name, email, password }` (password 8 to 128 chars) | `201 { user }` and sets cookie |
| `POST /auth/login` | `{ email, password }` | `{ user }` and sets cookie |
| `POST /auth/google` | `{ credential }` (Google Identity Services ID token) | `{ user }`. Verify signature, `aud`, `iss`, `exp`, `email_verified`. Create the user on first sign-in, link by email otherwise |
| `POST /auth/logout` | none | `204`, clears cookie |
| `GET /auth/me` | none | `{ user }` or `401` |
| `PATCH /me` | `{ name }` | `{ user }` |
| `GET /me/export` | none | JSON download with every row the user owns (notes, cards, attempts, sessions, settings) |
| `DELETE /me/data` | none | `204`. Deletes notes, folders, flashcards, quiz data, sessions. Keeps the account and settings |
| `DELETE /me` | none | `204`. Deletes everything, including the account, and clears the cookie |

### Settings

```ts
Settings = {
  daily_reminder: boolean,
  auto_flashcards: boolean,          // default for "also create flashcards"
  reduce_motion: boolean,
  default_style: "detailed" | "concise" | "outline",
  default_language: "en" | "hi" | "hinglish"
}
```

`GET /settings` returns `Settings` (create defaults on first read). `PATCH /settings` accepts any subset and returns the full `Settings`.

### Usage

`GET /usage` returns `{ used, limit, resets_at }`. The limit is per user per UTC day (`DAILY_GENERATION_LIMIT`, default 5).
A generation counts when the note is created and is refunded if the note ends `failed`.

---

## Videos

```ts
VideoMeta = { id: string, title, channel, duration_seconds: number, thumbnail_url }
```

`POST /videos/preview` with `{ url }` returns:

```json
{ "video": { "id": "aircAruvnKk", "title": "…", "channel": "…", "duration_seconds": 1120, "thumbnail_url": "https://i.ytimg.com/vi/…/hqdefault.jpg" },
  "captions": "available" | "unavailable" | "unknown" }
```

Metadata comes from the YouTube Data API `videos.list` (about 1 quota unit). `captions` is a best-effort probe of the caption fetch
strategy, never an error. Errors: `INVALID_URL`, `VIDEO_NOT_FOUND`, `VIDEO_PRIVATE`, `VIDEO_TOO_LONG`.
Cache previews by video id for 24 hours.

---

## Notes

```ts
NoteStatus = "queued" | "processing" | "ready" | "failed"

NoteSummary = {
  id, title, status: NoteStatus,
  progress: { step: number, total: number, label: string } | null,   // while queued/processing
  error: { code: string, message: string } | null,                   // when failed
  video: VideoMeta | null,                                           // null for transcript-only notes
  subject: string | null, tags: string[], folder_id: string | null,
  flashcard_count: number, question_count: number,
  created_at, updated_at
}

Note = NoteSummary & {
  style: "detailed" | "concise" | "outline",
  language: "en" | "hi" | "hinglish",
  summary: string | null,
  key_concepts: string[],
  skim: string[],                       // about 5 bullets
  content_md: string,                   // Markdown. Section headings look like "## [03:12] Title"
  shared: boolean, share_token: string | null
}
```

`content_md` rules the frontend relies on:

- Plain Markdown (GFM). **No raw HTML**. The frontend does not render it.
- A timestamp is written `[mm:ss]` or `[h:mm:ss]`. The frontend turns every one into a button that seeks the video.
- Chapters are `##` or `###` headings that start with a timestamp: `## [11:40] BFS and queues`. They drive the chapter list.

| Method and path | Notes |
| --- | --- |
| `GET /notes` | Query: `q` (full text over title, video title, tags, key concepts, content), `tag`, `folder_id` (`none` = unfiled), `status`, `has_cards=1`, `has_quiz=1`, `sort=recent\|oldest\|title` (default `recent`), `limit` (default 24, max 100), `offset`. Returns `{ items: NoteSummary[], total }` |
| `POST /notes` | Body below. `202` with the `Note` (`status: "queued"`) |
| `GET /notes/:id` | `Note`. The frontend polls this every 2 s while `queued` or `processing` |
| `PATCH /notes/:id` | Any of `title`, `content_md`, `tags` (max 12, each 1 to 32 chars, lower-cased), `folder_id` (or `null`), `subject`, `key_concepts`. Returns `Note` |
| `DELETE /notes/:id` | `204`. Cascades to flashcards, questions, attempts and share link |
| `POST /notes/:id/retry` | Body `{ transcript_text? }`. Only for `failed` notes. Re-queues. `202 Note`. Counts toward quota again |
| `POST /notes/:id/share` | `{ token }`. Idempotent. Token is 128-bit random, URL safe. Link is `${FRONTEND_URL}/s/${token}` |
| `DELETE /notes/:id/share` | `204`. Revokes the token |
| `GET /tags` | `{ items: [{ tag, count }] }` sorted by count |

`POST /notes` body:

```json
{
  "url": "https://youtu.be/aircAruvnKk",      // optional if transcript_text is given
  "transcript_text": "[00:03] Welcome …",     // optional; lines may start with [mm:ss]. Max 400 000 chars
  "title": "My lecture",                       // required only when there is no url
  "style": "detailed", "language": "en",
  "include": { "flashcards": true, "quiz": true, "timestamps": true }
}
```

At least one of `url` or `transcript_text` is required. Errors on create: `QUOTA_EXCEEDED`, `RATE_LIMITED`, `VALIDATION`, `INVALID_URL`,
`TRANSCRIPT_TOO_SHORT`. Source problems that need network work (private video, no captions, too long, AI failures) are reported
asynchronously: the note ends `failed` with `error.code` set. The frontend shows a specific message and action per code.

`progress.step` goes 1 to 4 with `total: 4`. The labels are: `Fetching transcript`, `Finding key concepts`, `Writing structured notes`,
`Building flashcards and quiz`. A note is `ready` only when everything the user asked for is saved.

### Folders

```ts
Folder = { id, name, note_count }
```

`GET /folders` returns `{ items: Folder[] }`. `POST /folders { name }` returns `201 Folder` (name 1 to 40 chars, unique per user, else `VALIDATION`).
`PATCH /folders/:id { name }` returns `Folder`. `DELETE /folders/:id` returns `204` (notes become unfiled).

---

## Flashcards

```ts
Flashcard = {
  id, note_id, note_title, front, back,
  due_at, interval_days: number, ease: number, reps: number, lapses: number,
  last_reviewed_at: string | null, created_at
}
Deck = { note_id, note_title, total: number, due: number }
```

| Method and path | Notes |
| --- | --- |
| `GET /flashcards` | Query: `due=1` (due_at <= now, oldest first), `note_id`, `limit` (default 50, max 200), `offset`. Returns `{ items, total, due_count, next_due_at }`. `due_count` is across all the user's cards. `next_due_at` is the earliest future due time or `null` |
| `GET /flashcards/decks` | `{ items: Deck[] }`, one per note that has cards |
| `POST /flashcards` | `{ note_id, front, back }` returns `201 Flashcard`. New cards are due immediately, ease 2.5 |
| `PATCH /flashcards/:id` | `{ front?, back? }` |
| `DELETE /flashcards/:id` | `204` |
| `POST /flashcards/:id/review` | `{ grade: "again" \| "hard" \| "good" \| "easy" }` returns the updated `Flashcard`. Also record a review event |

### Scheduling (SM-2). The frontend uses the same function to label the buttons, so match it exactly

```
quality: again = 1, hard = 3, good = 4, easy = 5
new card: ease = 2.5, reps = 0, interval_days = 0, lapses = 0, due_at = now

if quality < 3:                      # again
    reps = 0; lapses += 1; interval_days = 0
    due_at = now + 10 minutes
else:
    reps += 1
    if reps == 1: interval_days = 1
    elif reps == 2: interval_days = 6
    else: interval_days = round(previous_interval_days * ease)
    due_at = now + interval_days days
ease = max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))   # applied for every grade
```

---

## Quizzes

```ts
QuizQuestion = { id, note_id, question, options: string[], answer_index: number, explanation: string }
QuizAttempt = {
  id, note_id, note_title, score: number, total: number,
  answers: { question_id, picked: number, correct: boolean }[],
  retry_of: string | null, created_at
}
```

| Method and path | Notes |
| --- | --- |
| `GET /quiz/questions?note_id=` | `{ items: QuizQuestion[] }`. This is a personal study app, so `answer_index` and `explanation` are sent with the questions |
| `POST /quiz/attempts` | `{ note_id, answers: [{ question_id, picked }], retry_of? }`. The **server** computes `correct` and `score`. Returns `201 QuizAttempt` |
| `GET /quiz/attempts` | Query: `note_id`, `limit` (default 20). Newest first. `{ items: QuizAttempt[] }` |

---

## Study time and stats

`POST /sessions` with `{ kind: "reading" | "flashcards" | "quiz", note_id?, seconds }` returns `204`. Clamp `seconds` to 1..3600 and ignore anything above 12 h per day.
The frontend sends this about every 60 s while a study screen is open and visible, and once more on leave.

`GET /stats/summary?days=7&tz=Asia/Calcutta` (`days` 7 or 30, `tz` is an IANA zone used for day buckets):

```json
{
  "days": [{ "date": "2026-10-12", "minutes": 35 }],
  "minutes_total": 240,
  "cards_due": 14, "cards_total": 120, "notes_total": 8,
  "quiz_average": 82,
  "quiz_attempts": 5,
  "streak_days": 4,
  "mastery": [{ "subject": "Algorithms", "percent": 71, "cards": 24 }]
}
```

- `days` has one entry per day, oldest first, zero-filled.
- `quiz_average` is the mean of `score / total` in percent over the last 30 days, or `null` with no attempts.
- `streak_days` counts consecutive days (ending today, or yesterday if today is still empty) with any session, review or quiz attempt.
- `mastery` is per `subject`. Combine flashcard strength (share of the subject's cards with `interval_days >= 6`) and average quiz percent. Use whichever of the two exists. Omit subjects with neither.

---

## Public share

`GET /share/:token` (no auth) returns:

```ts
{ title, summary, key_concepts, skim, content_md, video: VideoMeta | null, author_name: string, created_at }
```

Unknown or revoked tokens return `404 NOT_FOUND`. Send `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
