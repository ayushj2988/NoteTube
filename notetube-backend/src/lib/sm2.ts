export type Grade = "again" | "hard" | "good" | "easy";
export interface CardState { ease: number; reps: number; intervalDays: number; lapses: number }

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const DAY = 86_400_000;

export const NEW_CARD: CardState = { ease: 2.5, reps: 0, intervalDays: 0, lapses: 0 };

/** SM-2 exactly as written in the API contract. The frontend runs the same function to label its buttons. */
export function applySm2(card: CardState, grade: Grade, now: Date): CardState & { dueAt: Date } {
  const q = QUALITY[grade];
  let { reps, intervalDays, lapses } = card;
  let dueAt: Date;
  if (q < 3) {
    reps = 0; lapses += 1; intervalDays = 0;
    dueAt = new Date(now.getTime() + 10 * 60_000);
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(card.intervalDays * card.ease);
    dueAt = new Date(now.getTime() + intervalDays * DAY);
  }
  const ease = Math.max(1.3, card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return { ease, reps, intervalDays, lapses, dueAt };
}
