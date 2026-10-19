# NoteTube

Turn YouTube lectures (or pasted transcripts) into notes, flashcards and quizzes. React 19 + TypeScript + Vite, a React Three Fiber cloud sky, and liquid-glass UI.

## Run it

```bash
npm install
npm run dev:mock     # full app with an in-browser mock backend, no server needed
npm run dev          # real backend: proxies /api to http://localhost:8787
npm run build        # typecheck + production build
```

`dev:mock` is for development only. It starts empty (no fake data), keeps its state in your browser's localStorage under `nt-mock-db`, and cannot reach real YouTube or an AI. It builds notes from a transcript you paste.
Test ids: `youtu.be/privatevid1` (private video), `youtu.be/longvideo01` (too long), `youtu.be/nocaptions1` (no captions). Any other link with no pasted transcript also fails with "no captions", like an unreadable video would.

## What is in it

- Auth: sign up, sign in, Google button, sign out, protected `/app` routes, account page.
- Real URLs (React Router): `/app/notes/:id`, `/app/library?q=&tag=&folder=`, `/app/flashcards?review=1`, `/s/:token` for public shared notes.
- Notes: Markdown rendering, edit, rename, delete, tags, subject, folders, server-side search, export to Markdown and PDF (print dialog), share links.
- Player: YouTube iframe player, `[mm:ss]` buttons and the chapter list seek the video.
- Generation: four-step progress, specific errors (no captions, private, too long, quota, AI busy) each with a way forward, transcript paste or upload (.txt .srt .vtt).
- Flashcards: SM-2 spaced repetition, due queue, again/hard/good/easy (keys 1-4), add, edit, delete.
- Quizzes: instant explanations, saved attempts, retry the questions you missed.
- Progress: computed from real study time, reviews and quiz attempts.
- Settings saved to the account, data export, delete my data, delete account. Usage meter. Bell that lists due cards, generating and failed notes.

## Backend

`docs/API.md` is the contract the frontend speaks. `docs/BACKEND_PROMPT.md` is a complete prompt to hand to a coding agent to build a matching backend (Hono, Postgres, Gemini, YouTube Data API, sessions, quota, tests).
The frontend only needs `/api` to implement that contract, nothing else.

## Layout

```
src/api        typed client, contract types, React Query hooks
src/auth       auth context, route guard, Google button
src/pages      one file per screen
src/ui         shared pieces (reader panels, quiz runner, flashcard review, dialogs, states)
src/scene      the React Three Fiber sky
src/dev        in-browser mock API (dev only)
```

## Notes on the glass

Large panels use CSS glass. `liquid-glass-react` is used only on small pill shapes (search of the nav, tabs, toast, buttons) where real refraction reads well. Glass hosts must not sit inside elements that animate `opacity` or `filter`, which is why page transitions animate `transform` only.
