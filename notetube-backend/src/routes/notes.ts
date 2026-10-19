import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { folders, notes, settings } from "../db/schema.js";
import { newShareToken } from "../lib/crypto.js";
import { notFound, validation } from "../lib/errors.js";
import { parseBody, parseOptionalBody, parseQuery, uuidParam } from "../lib/http.js";
import { sanitizeMarkdown, stripHtml } from "../lib/sanitize.js";
import { parseYoutubeUrl } from "../lib/youtube.js";
import { requireAuth } from "../middleware.js";
import { PLACEHOLDER_TITLE } from "../services/generation.js";
import { createNote, getNoteRow, listNotes, noteJson, requeueNote } from "../services/notes.js";
import { assertTranscriptLongEnough, parseUserTranscript } from "../services/transcript.js";
import type { Ctx, Env } from "../types.js";

const Style = z.enum(["detailed", "concise", "outline"]);
const Lang = z.enum(["en", "hi", "hinglish"]);
const Include = z.object({ flashcards: z.boolean().optional(), quiz: z.boolean().optional(), timestamps: z.boolean().optional() });

const CreateBody = z.object({
  url: z.string().trim().max(2048).optional(),
  transcript_text: z.string().max(400_000, "Transcripts are limited to 400,000 characters.").optional(),
  title: z.string().trim().min(1).max(200).optional(),
  style: Style.optional(), language: Lang.optional(), include: Include.optional(),
});

const flag = z.enum(["1", "true"]).optional().transform((v) => v !== undefined);
const ListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  tag: z.string().trim().toLowerCase().max(32).optional(),
  folder_id: z.union([z.literal("none"), z.string().uuid()]).optional(),
  status: z.enum(["queued", "processing", "ready", "failed"]).optional(),
  has_cards: flag, has_quiz: flag,
  sort: z.enum(["recent", "oldest", "title"]).default("recent"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

const PatchBody = z.object({
  title: z.string().trim().min(1, "Title can't be empty.").max(200),
  content_md: z.string().max(200_000),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(32)).max(12, "At most 12 tags."),
  folder_id: z.string().uuid().nullable(),
  subject: z.string().trim().max(40).nullable(),
  key_concepts: z.array(z.string().trim().min(1).max(80)).max(20),
}).partial().strict();

export function noteRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  const { db } = ctx;
  r.use("*", requireAuth(ctx));

  r.get("/", async (c) => c.json(await listNotes(db, c.get("user").id, parseQuery(c, ListQuery))));

  r.post("/", async (c) => {
    const user = c.get("user");
    const body = await parseBody(c, CreateBody);
    const url = body.url || undefined;
    if (!url && !body.transcript_text) throw validation({ url: "Provide a YouTube link or a transcript." });
    if (!url && !body.title) throw validation({ title: "Give your note a title." });
    ctx.limits.create.check(user.id); // 3 creations / minute

    const youtubeId = url ? parseYoutubeUrl(url) : null; // INVALID_URL
    let transcriptInput: string | null = null;
    if (body.transcript_text) {
      const t = parseUserTranscript(body.transcript_text);
      assertTranscriptLongEnough(t.plainLength); // TRANSCRIPT_TOO_SHORT
      transcriptInput = t.text;
    }
    const [s] = await db.select().from(settings).where(eq(settings.userId, user.id));
    const id = await createNote(db, ctx.config.DAILY_GENERATION_LIMIT, {
      userId: user.id, youtubeId, transcriptInput, title: body.title ?? PLACEHOLDER_TITLE,
      style: body.style ?? s?.defaultStyle ?? "detailed", language: body.language ?? s?.defaultLanguage ?? "en",
      include: { flashcards: body.include?.flashcards ?? s?.autoFlashcards ?? true, quiz: body.include?.quiz ?? true, timestamps: body.include?.timestamps ?? true },
    });
    ctx.notifyWorker();
    return c.json(noteJson(await getNoteRow(db, user.id, id)), 202);
  });

  r.get("/:id", async (c) => c.json(noteJson(await getNoteRow(db, c.get("user").id, uuidParam(c.req.param("id"))))));

  r.patch("/:id", async (c) => {
    const uid = c.get("user").id, id = uuidParam(c.req.param("id"));
    const p = await parseBody(c, PatchBody);
    await getNoteRow(db, uid, id); // 404 if not yours
    const set: Partial<typeof notes.$inferInsert> = { updatedAt: new Date() };
    if (p.title !== undefined) set.title = stripHtml(p.title);
    if (p.content_md !== undefined) set.contentMd = sanitizeMarkdown(p.content_md);
    if (p.tags !== undefined) set.tags = [...new Set(p.tags.map(stripHtml).filter(Boolean))];
    if (p.subject !== undefined) set.subject = p.subject ? stripHtml(p.subject) : null;
    if (p.key_concepts !== undefined) set.keyConcepts = p.key_concepts.map(stripHtml).filter(Boolean);
    if (p.folder_id !== undefined) {
      if (p.folder_id) {
        const [f] = await db.select({ id: folders.id }).from(folders).where(and(eq(folders.id, p.folder_id), eq(folders.userId, uid)));
        if (!f) throw validation({ folder_id: "That folder doesn't exist." });
      }
      set.folderId = p.folder_id;
    }
    await db.update(notes).set(set).where(and(eq(notes.id, id), eq(notes.userId, uid)));
    return c.json(noteJson(await getNoteRow(db, uid, id)));
  });

  r.delete("/:id", async (c) => {
    const res = await db.delete(notes).where(and(eq(notes.id, uuidParam(c.req.param("id")), ), eq(notes.userId, c.get("user").id))).returning({ id: notes.id });
    if (!res.length) throw notFound();
    return c.body(null, 204);
  });

  r.post("/:id/retry", async (c) => {
    const uid = c.get("user").id, id = uuidParam(c.req.param("id"));
    const body = await parseOptionalBody(c, z.object({ transcript_text: z.string().max(400_000).optional() }));
    const row = await getNoteRow(db, uid, id);
    if (row.status !== "failed") throw validation({ status: "Only failed notes can be retried." });
    let input: string | null = null;
    if (body.transcript_text) {
      const t = parseUserTranscript(body.transcript_text);
      assertTranscriptLongEnough(t.plainLength);
      input = t.text;
    }
    ctx.limits.create.check(uid);
    await requeueNote(db, ctx.config.DAILY_GENERATION_LIMIT, uid, id, input);
    ctx.notifyWorker();
    return c.json(noteJson(await getNoteRow(db, uid, id)), 202);
  });

  r.post("/:id/share", async (c) => {
    const uid = c.get("user").id, id = uuidParam(c.req.param("id"));
    const row = await getNoteRow(db, uid, id);
    if (row.share_token) return c.json({ token: row.share_token }); // idempotent
    const token = newShareToken();
    await db.update(notes).set({ shareToken: token }).where(and(eq(notes.id, id), eq(notes.userId, uid), sql`share_token IS NULL`));
    const fresh = await getNoteRow(db, uid, id); // covers a concurrent first call
    return c.json({ token: fresh.share_token });
  });

  r.delete("/:id/share", async (c) => {
    const uid = c.get("user").id, id = uuidParam(c.req.param("id"));
    await getNoteRow(db, uid, id);
    await db.update(notes).set({ shareToken: null }).where(and(eq(notes.id, id), eq(notes.userId, uid)));
    return c.body(null, 204);
  });

  return r;
}
