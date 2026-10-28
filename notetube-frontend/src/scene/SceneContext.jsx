import { createContext, useContext, useMemo } from 'react'

// A tiny shared "mailbox" between the pages and the dots. Pages write to it; the scene reads it every frame.
// It is a plain object, so changing it never re-renders React.
//   view        which page is open ('home', 'login', 'dashboard', ...)
//   procP       0 to 1, how far the lecture is processed (the dots gather into the notes sheet)
//   procQ       0 to 1, how far the flashcards and quiz are made (the notes sheet then splits into cards)
//   extra       null normally. A number 0 to 1 while flashcards or a quiz are being made on any page: sheet first, then cards
//   pulseUntil  time (ms) until which the dots pull toward the notes sheet (a link was just submitted)
//   stageEl     the landing page hero frame. The dots move into it and take its size.
//   tilt        radians the hero frame is tilted by (the scene tilts the dots the same way)
//   level       0 raw transcript, 1 notes, 2 flashcards. Written by the scene, read by the landing page labels.
const SceneContext = createContext(null)

export function SceneProvider({ children }) {
  const value = useMemo(() => {
    const state = { view: 'home', procP: 0, procQ: 0, extra: null, pulseUntil: 0, stageEl: null, tilt: 0, level: 0 }
    return { state, pulse: (ms = 1500) => { state.pulseUntil = performance.now() + ms } }
  }, [])
  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
}
export const useScene = () => useContext(SceneContext)
