# NoteTube

React + TypeScript + Vite port of the NoteTube prototype: a blue-sky landing page, a light glass notes hub, and a
React Three Fiber cloud scene behind it. The glass chrome uses
[`liquid-glass-react`](https://github.com/rdev/liquid-glass-react).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

## Structure

| Path | What it holds |
| --- | --- |
| `src/scene/SkyScene.tsx` | R3F cloud banks: one instanced draw call, drift computed in the vertex shader, pointer parallax, reader dolly |
| `src/scene/skyState.ts` | Mutable pointer/mood state shared with the render loop (no React re-renders) |
| `src/components/LiquidLayer.tsx` | Wraps `liquid-glass-react` as a layer that fills its parent |
| `src/components/` | Landing, Sidebar, Topbar, Toast, NoteList, CardsPanel, QuizPanel |
| `src/views/` | Home, Library, Flashcards, Quizzes, Progress, Settings, NewNote, Reader |
| `src/lib/data.ts` | Sample notes, timestamps, decks and quiz questions |

## Notes

- Liquid glass is used on the landing nav, sidebar, top bar, toast and the Home URL panel. Other surfaces use
  plain CSS glass, so there are only a few SVG refraction filters on screen. Refraction renders in Chromium;
  other browsers get the blur and highlights only.
- A liquid-glass host must not have its own `backdrop-filter`, and its ancestors must not use `filter` or
  `opacity` animations, or the glass stops seeing the sky behind it. That is why `.view` animates `transform` only.
- `prefers-reduced-motion` (or the Settings toggle) stops the render loop, parallax, card bobbing and glass refraction.
- Lecture generation is simulated with sample content; there is no transcript backend yet.
