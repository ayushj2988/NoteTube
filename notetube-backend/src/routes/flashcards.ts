import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { flashcards, reviewEvents } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { iso, parseBody, parseQuery, uuidParam } from "../lib/http.js";
import { stripHtml } from "../lib/sanitize.js";
import { applySm2, type Grade } from "../lib/sm2.js";
import { requireAuth } from "../middleware.js";
import { assertOwnsNote } from "../services/notes.js";
import type { Ctx, Env } from "../types.js";

type Row = {
  id: string; note_id: string; note_title: string; front: string; back: string; due_at: Date | string; interval_days: number; ease: number;
  reps: number; lapses: number; last_reviewed_at: Date | string | null; created_at: Date | string;
};
const cardJson = (r: Row) => ({
  id: r.id, note_id: r.note_id, note_title: r.note_title, front: r.front, back: r.back, due_at: iso(r.due_at),
  interval_days: r.interval_days, ease: r.ease, reps: r.reps, lapses: r.lapses,
  last_reviewed_at: iso(r.last_reviewed_at), created_at: iso(r.created_at),
});
const SEL = sql`SELECT f.id, f.note_id, n.title AS note_title, f.front, f.back, f.due_at, f.interval_days, f.ease, f.reps, f.lapses, f.last_reviewed_at, f.created_at
  FROM flashcards f JOIN notes n ON n.id = f.note_id`;

const ListQuery = z.object({
  due: z.enum(["1", "true"]).optional(), note_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50), offset: z.coerce.number().int().min(0).default(0),
});
const Text = (max: number) => z.string().trim().min(1, "Can't be empty.").max(max);

export function flashcardRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  const { db } = ctx;
  r.use("*", requireAuth(ctx));

  const one = async (uid: string, id: string) => {
    const res = await db.execute(sql`${SEL} WHERE f.id = ${id} AND f.user_id = ${uid}`);
    const row = res.rows[0] as unknown as Row | undefined;
    if (!row) throw notFound();
    return row;
  };

  r.get("/", async (c) => {
    const uid = c.get("user").id, q = parseQuery(c, ListQuery);
    const conds = [sql`f.user_id = ${uid}`];
    if (q.due) conds.push(sql`f.due_at <= now()`);
    if (q.note_id) conds.push(sql`f.note_id = ${q.note_id}`);
    const w = sql.join(conds, sql` AND `);
    const [items, total, agg] = await Promise.all([
      db.execute(sql`${SEL} WHERE ${w} ORDER BY f.due_at ASC, f.id LIMIT ${q.limit} OFFSET ${q.offset}`),
      db.execute(sql`SELECT count(*)::int AS n FROM flashcards f WHERE ${w}`),
      db.execute(sql`SELECT count(*) FILTER (WHERE due_at <= now())::int AS due_count, min(due_at) FILTER (WHERE due_at > now()) AS next_due_at
        FROM flashcards WHERE user_id = ${uid}`),
    ]);
    const a = agg.rows[0] as { due_count: number; next_due_at: Date | string | null };
    return c.json({
      items: (items.rows as unknown as Row[]).map(cardJson), total: (total.rows[0] as { n: number }).n,
      due_count: a.due_count, next_due_at: iso(a.next_due_at),
    });
  });

  r.get("/decks", async (c) => {
    const res = await db.execute(sql`SELECT n.id AS note_id, n.title AS note_title, count(*)::int AS total,
        count(*) FILTER (WHERE f.due_at <= now())::int AS due
      FROM flashcards f JOIN notes n ON n.id = f.note_id WHERE f.user_id = ${c.get("user").id}
      GROUP BY n.id ORDER BY n.created_at DESC`);
    return c.json({ items: res.rows });
  });

  r.post("/", async (c) => {
    const uid = c.get("user").id;
    const b = await parseBody(c, z.object({ note_id: z.string().uuid(), front: Text(300), back: Text(500) }));
    await assertOwnsNote(db, uid, b.note_id);
    const [row] = await db.insert(flashcards).values({ userId: uid, noteId: b.note_id, front: stripHtml(b.front), back: stripHtml(b.back) }).returning({ id: flashcards.id });
    return c.json(cardJson(await one(uid, row!.id)), 201);
  });

  r.patch("/:id", async (c) => {
    const uid = c.get("user").id, id = uuidParam(c.req.param("id"));
    const b = await parseBody(c, z.object({ front: Text(300), back: Text(500) }).partial().strict());
    await one(uid, id);
    const set: Partial<typeof flashcards.$inferInsert> = {};
    if (b.front !== undefined) set.front = stripHtml(b.front);
    if (b.back !== undefined) set.back = stripHtml(b.back);
    if (Object.keys(set).length) await db.update(flashcards).set(set).where(and(eq(flashcards.id, id), eq(flashcards.userId, uid)));
    return c.json(cardJson(await one(uid, id)));
  });

  r.delete("/:id", async (c) => {
    const res = await db.delete(flashcards).where(and(eq(flashcards.id, uuidParam(c.req.param("id"))), eq(flashcards.userId, c.get("user").id))).returning({ id: flashcards.id });
    if (!res.length) throw notFound();
    return c.body(null, 204);
  });

  r.post("/:id/review", async (c) => {
    const uid = c.get("user").id, id = uuidParam(c.req.param("id"));
    const { grade } = await parseBody(c, z.object({ grade: z.enum(["again", "hard", "good", "easy"]) }));
    await db.transaction(async (tx) => {
      const [card] = await tx.select().from(flashcards).where(and(eq(flashcards.id, id), eq(flashcards.userId, uid))).for("update");
      if (!card) throw notFound();
      const now = new Date();
      const next = applySm2({ ease: card.ease, reps: card.reps, intervalDays: card.intervalDays, lapses: card.lapses }, grade as Grade, now);
      await tx.update(flashcards).set({ ease: next.ease, reps: next.reps, intervalDays: next.intervalDays, lapses: next.lapses, dueAt: next.dueAt, lastReviewedAt: now })
        .where(eq(flashcards.id, id));
      await tx.insert(reviewEvents).values({ cardId: id, userId: uid, grade });
    });
    return c.json(cardJson(await one(uid, id)));
  });
  return r;
}
