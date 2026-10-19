import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { notes, quizAttemptAnswers, quizAttempts, quizQuestions } from "../db/schema.js";
import { validation } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/http.js";
import { requireAuth } from "../middleware.js";
import { assertOwnsNote } from "../services/notes.js";
import type { Ctx, Env } from "../types.js";

export function quizRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  const { db } = ctx;
  r.use("*", requireAuth(ctx));

  r.get("/questions", async (c) => {
    const { note_id } = parseQuery(c, z.object({ note_id: z.string().uuid("note_id is required.") }));
    await assertOwnsNote(db, c.get("user").id, note_id);
    const rows = await db.select().from(quizQuestions).where(eq(quizQuestions.noteId, note_id)).orderBy(asc(quizQuestions.position));
    return c.json({ items: rows.map((q) => ({ id: q.id, note_id: q.noteId, question: q.question, options: q.options, answer_index: q.answerIndex, explanation: q.explanation })) });
  });

  async function attemptsJson(rows: { a: typeof quizAttempts.$inferSelect; title: string }[]) {
    const ids = rows.map((x) => x.a.id);
    const ans = ids.length ? await db.select().from(quizAttemptAnswers).where(inArray(quizAttemptAnswers.attemptId, ids)) : [];
    return rows.map(({ a, title }) => ({
      id: a.id, note_id: a.noteId, note_title: title, score: a.score, total: a.total,
      answers: ans.filter((x) => x.attemptId === a.id).map((x) => ({ question_id: x.questionId, picked: x.picked, correct: x.correct })),
      retry_of: a.retryOf, created_at: a.createdAt.toISOString(),
    }));
  }

  r.post("/attempts", async (c) => {
    const uid = c.get("user").id;
    const b = await parseBody(c, z.object({
      note_id: z.string().uuid(),
      answers: z.array(z.object({ question_id: z.string().uuid(), picked: z.number().int().min(0).max(3) })).min(1, "Answer at least one question.").max(50),
      retry_of: z.string().uuid().optional(),
    }));
    await assertOwnsNote(db, uid, b.note_id);
    const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.noteId, b.note_id));
    const byId = new Map(qs.map((q) => [q.id, q]));
    const seen = new Set<string>();
    for (const a of b.answers) {
      if (!byId.has(a.question_id)) throw validation({ answers: "An answer refers to a question that isn't part of this note." });
      if (seen.has(a.question_id)) throw validation({ answers: "Each question can only be answered once." });
      seen.add(a.question_id);
    }
    if (b.retry_of) {
      const [prev] = await db.select({ id: quizAttempts.id }).from(quizAttempts)
        .where(and(eq(quizAttempts.id, b.retry_of), eq(quizAttempts.userId, uid), eq(quizAttempts.noteId, b.note_id)));
      if (!prev) throw validation({ retry_of: "That attempt doesn't exist for this note." });
    }
    // the server decides what is correct
    const graded = b.answers.map((a) => ({ ...a, correct: byId.get(a.question_id)!.answerIndex === a.picked }));
    const score = graded.filter((g) => g.correct).length;
    const id = await db.transaction(async (tx) => {
      const [att] = await tx.insert(quizAttempts).values({ userId: uid, noteId: b.note_id, retryOf: b.retry_of ?? null, score, total: graded.length }).returning({ id: quizAttempts.id });
      await tx.insert(quizAttemptAnswers).values(graded.map((g) => ({ attemptId: att!.id, questionId: g.question_id, picked: g.picked, correct: g.correct })));
      return att!.id;
    });
    const [row] = await db.select({ a: quizAttempts, title: notes.title }).from(quizAttempts).innerJoin(notes, eq(notes.id, quizAttempts.noteId)).where(eq(quizAttempts.id, id));
    return c.json((await attemptsJson([row!]))[0], 201);
  });

  r.get("/attempts", async (c) => {
    const uid = c.get("user").id;
    const q = parseQuery(c, z.object({ note_id: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(20) }));
    const where = q.note_id ? and(eq(quizAttempts.userId, uid), eq(quizAttempts.noteId, q.note_id)) : eq(quizAttempts.userId, uid);
    const rows = await db.select({ a: quizAttempts, title: notes.title }).from(quizAttempts).innerJoin(notes, eq(notes.id, quizAttempts.noteId))
      .where(where).orderBy(desc(quizAttempts.createdAt)).limit(q.limit);
    return c.json({ items: await attemptsJson(rows) });
  });
  return r;
}
