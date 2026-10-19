import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  flashcards, folders, notes, quizAttempts, quizAttemptAnswers, quizQuestions, reviewEvents, settings, studySessions, users,
} from "../db/schema.js";
import { parseBody } from "../lib/http.js";
import { requireAuth } from "../middleware.js";
import { clearSessionCookie, toAuthUser, userJson } from "../services/auth.js";
import { getUsage } from "../services/quota.js";
import type { Ctx, Env } from "../types.js";

const SettingsPatch = z.object({
  daily_reminder: z.boolean(), auto_flashcards: z.boolean(), reduce_motion: z.boolean(),
  default_style: z.enum(["detailed", "concise", "outline"]), default_language: z.enum(["en", "hi", "hinglish"]),
}).partial().strict();

const settingsJson = (s: typeof settings.$inferSelect) => ({
  daily_reminder: s.dailyReminder, auto_flashcards: s.autoFlashcards, reduce_motion: s.reduceMotion,
  default_style: s.defaultStyle, default_language: s.defaultLanguage,
});

export function meRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  // mounted at "/", so protect only our own paths (a bare "*" would also cover /auth/login)
  for (const path of ["/me", "/me/*", "/settings", "/usage"]) r.use(path, requireAuth(ctx));
  const { db } = ctx;

  r.patch("/me", async (c) => {
    const { name } = await parseBody(c, z.object({ name: z.string().trim().min(1, "Enter your name.").max(80) }));
    const [u] = await db.update(users).set({ name }).where(eq(users.id, c.get("user").id)).returning();
    return c.json({ user: userJson(toAuthUser(u!)) });
  });

  r.get("/me/export", async (c) => {
    const uid = c.get("user").id;
    const [user] = await db.select().from(users).where(eq(users.id, uid));
    const noteRows = await db.select().from(notes).where(eq(notes.userId, uid));
    const noteIds = noteRows.map((n) => n.id);
    const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.userId, uid));
    const out = {
      exported_at: new Date().toISOString(),
      user: user ? userJson(toAuthUser(user)) : null,
      settings: (await db.select().from(settings).where(eq(settings.userId, uid)))[0] ?? null,
      folders: await db.select().from(folders).where(eq(folders.userId, uid)),
      notes: noteRows.map(({ search: _s, leaseUntil: _l, transcriptInput: _t, ...n }) => n),
      flashcards: await db.select().from(flashcards).where(eq(flashcards.userId, uid)),
      review_events: await db.select().from(reviewEvents).where(eq(reviewEvents.userId, uid)),
      quiz_questions: noteIds.length ? await db.select().from(quizQuestions).where(inArray(quizQuestions.noteId, noteIds)) : [],
      quiz_attempts: attempts,
      quiz_attempt_answers: attempts.length
        ? await db.select().from(quizAttemptAnswers).where(inArray(quizAttemptAnswers.attemptId, attempts.map((a) => a.id))) : [],
      study_sessions: await db.select().from(studySessions).where(eq(studySessions.userId, uid)),
    };
    c.header("Content-Disposition", 'attachment; filename="notetube-export.json"');
    return c.json(out);
  });

  // Deletes the user's content but keeps the account, settings and the generation log
  // (so deleting data can never be used to reset the daily quota).
  r.delete("/me/data", async (c) => {
    const uid = c.get("user").id;
    await db.transaction(async (tx) => {
      await tx.delete(notes).where(eq(notes.userId, uid)); // cascades: cards, questions, attempts, answers
      await tx.delete(folders).where(eq(folders.userId, uid));
      await tx.delete(studySessions).where(eq(studySessions.userId, uid));
      await tx.delete(reviewEvents).where(eq(reviewEvents.userId, uid));
      await tx.delete(quizAttempts).where(eq(quizAttempts.userId, uid));
      await tx.delete(flashcards).where(eq(flashcards.userId, uid));
    });
    return c.body(null, 204);
  });

  r.delete("/me", async (c) => {
    await db.delete(users).where(eq(users.id, c.get("user").id)); // everything cascades, sessions included
    clearSessionCookie(c, ctx.config);
    return c.body(null, 204);
  });

  r.get("/settings", async (c) => {
    const uid = c.get("user").id;
    await db.insert(settings).values({ userId: uid }).onConflictDoNothing();
    const [s] = await db.select().from(settings).where(eq(settings.userId, uid));
    return c.json(settingsJson(s!));
  });

  r.patch("/settings", async (c) => {
    const uid = c.get("user").id;
    const p = await parseBody(c, SettingsPatch);
    await db.insert(settings).values({ userId: uid }).onConflictDoNothing();
    const set: Partial<typeof settings.$inferInsert> = {};
    if (p.daily_reminder !== undefined) set.dailyReminder = p.daily_reminder;
    if (p.auto_flashcards !== undefined) set.autoFlashcards = p.auto_flashcards;
    if (p.reduce_motion !== undefined) set.reduceMotion = p.reduce_motion;
    if (p.default_style !== undefined) set.defaultStyle = p.default_style;
    if (p.default_language !== undefined) set.defaultLanguage = p.default_language;
    const [s] = Object.keys(set).length
      ? await db.update(settings).set(set).where(eq(settings.userId, uid)).returning()
      : await db.select().from(settings).where(eq(settings.userId, uid));
    return c.json(settingsJson(s!));
  });

  r.get("/usage", async (c) => c.json(await getUsage(db, c.get("user").id, ctx.config.DAILY_GENERATION_LIMIT)));
  return r;
}
