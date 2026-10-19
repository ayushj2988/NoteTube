/**
 * Mutable state shared by the UI and the R3F render loop. It lives outside React so
 * pointer movement and mood changes never trigger re-renders.
 */
export const skyState = {
  mood: { v: 0, t: 0 },
  pointer: { x: 0, y: 0, sx: 0, sy: 0 },
  /** the landing cards are nudged opposite the pointer for parallax depth */
  parallaxEl: null as HTMLElement | null,
  onMood: null as null | (() => void),
}

/** 0 = landing/app, 1 = reader (camera glides slightly closer) */
export function setSkyMood(t: 0 | 1): void {
  skyState.mood.t = t
  skyState.onMood?.()
}
