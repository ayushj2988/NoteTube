import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { studySessions } from "../db/schema.js";
import { validation } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/http.js";
import { requireAuth } from "../middleware.js";
import { assertOwnsNote } from "../services/notes.js";
import { utcDayStart } from "../services/quota.js";
import type { Ctx, Env } from "../types.js";

const DAY_CAP_SECONDS = 12 * 3600;

export function validTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return true; } catch { return false; }
}
export const dateInTz = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export function lastDays(today: string, n: number): string[] {
  const base = new Date(`${today}T00:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}
export function streakFrom(active: Set<string>, today: string): number {
  const prev = (s: string) => new Date(new Date(`${s}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  let cur = active.has(today) ? today : prev(today); // today may still be empty
  let n = 0;
  while (active.has(cur)) { n++; cur = prev(cur); }
  return n;
}

export function statsRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  const { db } = ctx;
  for (const path of ["/sessions", "/stats/*"]) r.use(path, requireAuth(ctx)); // mounted at "/": protect only our paths

  r.post("/sessions", async (c) => {
    const uid = c.get("user").id;
    const b = await parseBody(c, z.object({
      kind: z.enum(["reading", "flashcards", "quiz"]), note_id: z.string().uuid().optional(), seconds: z.number().finite(),
    }));
    if (b.note_id) await assertOwnsNote(db, uid, b.note_id);
    let seconds = Math.min(3600, Math.max(1, Math.round(b.seconds)));
    const [t] = await db.select({ s: sql<number>`coalesce(sum(${studySessions.seconds}), 0)::int` }).from(studySessions)
      .where(and(eq(studySessions.userId, uid), sql`${studySessions.createdAt} >= ${utcDayStart()}`));
    const remaining = DAY_CAP_SECONDS - (t?.s ?? 0);
    if (remaining <= 0) return c.body(null, 204); // ignore anything above 12 h per day
    seconds = Math.min(seconds, remaining);
    await db.insert(studySessions).values({ userId: uid, kind: b.kind, noteId: b.note_id ?? null, seconds });
    return c.body(null, 204);
  });

  r.get("/stats/summary", async (c) => {
    const uid = c.get("user").id;
    const q = parseQuery(c, z.object({ days: z.enum(["7", "30"]).default("7").transform(Number), tz: z.string().max(64).default("UTC") }));
    if (!validTimeZone(q.tz)) throw validation({ tz: "Unknown time zone." });
    const today = dateInTz(new Date(), q.tz);
    const dates = lastDays(today, q.days);

    const [perDay, cards, notesTotal, quiz, activity, mastery] = await Promise.all([
      db.execute(sql`SELECT to_char(created_at AT TIME ZONE ${q.tz}, 'YYYY-MM-DD') AS d, sum(seconds)::int AS s FROM study_sessions
        WHERE user_id = ${uid} AND created_at >= now() - interval '40 days' GROUP BY d`),
      db.execute(sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE due_at <= now())::int AS due FROM flashcards WHERE user_id = ${uid}`),
      db.execute(sql`SELECT count(*)::int AS n FROM notes WHERE user_id = ${uid}`),
      db.execute(sql`SELECT avg(score::float / NULLIF(total, 0)) * 100 AS avg, count(*)::int AS n FROM quiz_attempts
        WHERE user_id = ${uid} AND created_at >= now() - interval '30 days'`),
      db.execute(sql`SELECT DISTINCT to_char(t AT TIME ZONE ${q.tz}, 'YYYY-MM-DD') AS d FROM (
          SELECT created_at AS t FROM study_sessions WHERE user_id = ${uid} AND created_at >= now() - interval '400 days'
          UNION ALL SELECT created_at FROM review_events WHERE user_id = ${uid} AND created_at >= now() - interval '400 days'
          UNION ALL SELECT created_at FROM quiz_attempts WHERE user_id = ${uid} AND created_at >= now() - interval '400 days') x`),
      db.execute(sql`SELECT n.subject, count(f.id)::int AS cards, avg((f.interval_days >= 6)::int) * 100 AS card_strength,
          (SELECT avg(a.score::float / NULLIF(a.total, 0)) * 100 FROM quiz_attempts a JOIN notes n2 ON n2.id = a.note_id
            WHERE a.user_id = ${uid} AND n2.subject = n.subject) AS quiz_pct
        FROM notes n LEFT JOIN flashcards f ON f.note_id = n.id WHERE n.user_id = ${uid} AND n.subject IS NOT NULL
        GROUP BY n.subject ORDER BY count(f.id) DESC, n.subject`),
    ]);

    const secs = new Map((perDay.rows as { d: string; s: number }[]).map((x) => [x.d, x.s]));
    const days = dates.map((date) => ({ date, minutes: Math.round((secs.get(date) ?? 0) / 60) }));
    const qa = quiz.rows[0] as { avg: number | null; n: number };
    const masteryItems = (mastery.rows as { subject: string; cards: number; card_strength: number | string | null; quiz_pct: number | string | null }[])
      .map((m) => {
        // avg() over integers is numeric, which pg returns as a string: convert before summing
        const parts = [m.card_strength, m.quiz_pct].filter((x) => x !== null && x !== undefined).map(Number);
        return parts.length ? { subject: m.subject, percent: Math.round(parts.reduce((a, b) => a + b, 0) / parts.length), cards: m.cards } : null;
      }).filter((x): x is { subject: string; percent: number; cards: number } => x !== null);

    return c.json({
      days, minutes_total: days.reduce((a, d) => a + d.minutes, 0),
      cards_due: (cards.rows[0] as { due: number }).due, cards_total: (cards.rows[0] as { total: number }).total,
      notes_total: (notesTotal.rows[0] as { n: number }).n,
      quiz_average: qa.avg === null || qa.avg === undefined ? null : Math.round(qa.avg), quiz_attempts: qa.n,
      streak_days: streakFrom(new Set((activity.rows as { d: string }[]).map((x) => x.d)), today),
      mastery: masteryItems,
    });
  });
  return r;
}
