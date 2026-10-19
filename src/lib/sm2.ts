import type { Flashcard, Grade } from '../api/types'

/**
 * SM-2 exactly as specified in docs/API.md. The server is authoritative; the frontend only uses this
 * to label the review buttons ("Good · 6d"). The smoke test pins the same table the backend must pass.
 */
const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 }

export type Schedule = Pick<Flashcard, 'ease' | 'reps' | 'interval_days' | 'lapses'>

export function nextSchedule(card: Schedule, grade: Grade): Schedule & { dueInMinutes: number } {
  const q = QUALITY[grade]
  let { reps, interval_days, lapses } = card
  const ease = Math.max(1.3, card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  let dueInMinutes: number
  if (q < 3) {
    reps = 0
    lapses += 1
    interval_days = 0
    dueInMinutes = 10
  } else {
    reps += 1
    interval_days = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.interval_days * card.ease)
    dueInMinutes = interval_days * 1440
  }
  return { ease, reps, interval_days, lapses, dueInMinutes }
}
