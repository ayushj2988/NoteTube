import { and, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { generationLog, notes } from "../db/schema.js";
import { notFound } from "../lib/errors.js";
import { iso } from "../lib/http.js";
import { PROGRESS_LABELS } from "./generation.js";
import { assertQuota } from "./quota.js";

// Explicit columns: never drag the tsvector or the pasted transcript through the API layer.
const COLS = sql.raw(`n.id, n.user_id, n.folder_id, n.youtube_id, n.video_title, n.video_channel, n.video_duration, n.video_thumbnail,
  n.title, n.status, n.progress_step, n.error_code, n.error_message, n.style, n.language, n.subject, n.tags, n.summary,
  n.key_concepts, n.skim, n.content_md, n.share_token, n.created_at, n.updated_at`);
const COUNTS = sql.raw(`(SELECT count(*)::int FROM flashcards f WHERE f.note_id = n.id) AS flashcard_count,
  (SELECT count(*)::int FROM quiz_questions q WHERE q.note_id = n.id) AS question_count`);

export type NoteRow = {
  id: string; user_id: string; folder_id: string | null; youtube_id: string | null; video_title: string | null; video_channel: string | null;
  video_duration: number | null; video_thumbnail: string | null; title: string; status: string; progress_step: number;
  error_code: string | null; error_message: string | null; style: string; language: string; subject: string | null; tags: string[];
  summary: string | null; key_concepts: string[]; skim: string[]; content_md: string; share_token: string | null;
  created_at: Date | string; updated_at: Date | string; flashcard_count: number; question_count: number;
};

export const videoJson = (r: Pick<NoteRow, "youtube_id" | "video_title" | "video_channel" | "video_duration" | "video_thumbnail">) =>
  r.youtube_id && r.video_title
    ? { id: r.youtube_id, title: r.video_title, channel: r.video_channel ?? "", duration_seconds: r.video_duration ?? 0, thumbnail_url: r.video_thumbnail ?? "" }
    : null;

export function summaryJson(r: NoteRow) {
  const active = r.status === "queued" || r.status === "processing";
  const step = Math.min(4, Math.max(1, r.progress_step));
  return {
    id: r.id, title: r.title, status: r.status,
    progress: active ? { step, total: 4, label: PROGRESS_LABELS[step - 1] } : null,
    error: r.status === "failed" ? { code: r.error_code ?? "AI_UNAVAILABLE", message: r.error_message ?? "Generation failed." } : null,
    video: videoJson(r), subject: r.subject, tags: r.tags, folder_id: r.folder_id,
    flashcard_count: r.flashcard_count, question_count: r.question_count,
    created_at: iso(r.created_at), updated_at: iso(r.updated_at),
  };
}

export const noteJson = (r: NoteRow) => ({
  ...summaryJson(r),
  style: r.style, language: r.language, summary: r.summary, key_concepts: r.key_concepts, skim: r.skim, content_md: r.content_md,
  shared: !!r.share_token, share_token: r.share_token,
});

export async function getNoteRow(db: Db, userId: string, id: string): Promise<NoteRow> {
  const res = await db.execute(sql`SELECT ${COLS}, ${COUNTS} FROM notes n WHERE n.id = ${id} AND n.user_id = ${userId}`);
  const row = res.rows[0] as unknown as NoteRow | undefined;
  if (!row) throw notFound();
  return row;
}

/** Throws NOT_FOUND unless the note belongs to the user. Use before touching anything that hangs off a note. */
export async function assertOwnsNote(db: Db, userId: string, id: string) {
  const [r] = await db.select({ id: notes.id }).from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).limit(1);
  if (!r) throw notFound();
}

export interface ListFilters {
  q?: string; tag?: string; folder_id?: string; status?: string; has_cards?: boolean; has_quiz?: boolean;
  sort: "recent" | "oldest" | "title"; limit: number; offset: number;
}

/** "graph trav" -> "graph:* & trav:*" so partial words match as the user types. */
export function prefixQuery(q: string): string | null {
  const terms = q.match(/[\p{L}\p{N}_]+/gu);
  return terms?.length ? terms.slice(0, 8).map((t) => `${t}:*`).join(" & ") : null;
}

export async function listNotes(db: Db, userId: string, f: ListFilters) {
  const where: SQL[] = [sql`n.user_id = ${userId}`];
  if (f.q) {
    const pq = prefixQuery(f.q);
    if (pq) where.push(sql`n.search @@ to_tsquery('simple', ${pq})`);
  }
  if (f.tag) where.push(sql`${f.tag} = ANY(n.tags)`);
  if (f.folder_id === "none") where.push(sql`n.folder_id IS NULL`);
  else if (f.folder_id) where.push(sql`n.folder_id = ${f.folder_id}`);
  if (f.status) where.push(sql`n.status = ${f.status}`);
  if (f.has_cards) where.push(sql`EXISTS (SELECT 1 FROM flashcards f WHERE f.note_id = n.id)`);
  if (f.has_quiz) where.push(sql`EXISTS (SELECT 1 FROM quiz_questions q WHERE q.note_id = n.id)`);
  const w = sql.join(where, sql` AND `);
  const order = f.sort === "oldest" ? sql`n.created_at ASC, n.id` : f.sort === "title" ? sql`lower(n.title) ASC, n.id` : sql`n.created_at DESC, n.id`;
  const [items, total] = await Promise.all([
    db.execute(sql`SELECT ${COLS}, ${COUNTS} FROM notes n WHERE ${w} ORDER BY ${order} LIMIT ${f.limit} OFFSET ${f.offset}`),
    db.execute(sql`SELECT count(*)::int AS n FROM notes n WHERE ${w}`),
  ]);
  return { items: (items.rows as unknown as NoteRow[]).map(summaryJson), total: (total.rows[0] as { n: number }).n };
}

export interface NewNote {
  userId: string; youtubeId: string | null; transcriptInput: string | null; title: string;
  style: string; language: string; include: { flashcards: boolean; quiz: boolean; timestamps: boolean };
}

/** Quota check + note + quota log row in ONE transaction, serialised per user so two requests can't both slip under the limit. */
export async function createNote(db: Db, limit: number, n: NewNote): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${n.userId}))`);
    await assertQuota(tx, n.userId, limit);
    const [row] = await tx.insert(notes).values({
      userId: n.userId, youtubeId: n.youtubeId, transcriptInput: n.transcriptInput, title: n.title,
      style: n.style, language: n.language, include: n.include, status: "queued", progressStep: 1,
    }).returning({ id: notes.id });
    await tx.insert(generationLog).values({ userId: n.userId, noteId: row!.id });
    return row!.id;
  });
}

export async function requeueNote(db: Db, limit: number, userId: string, id: string, transcriptInput: string | null) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    await assertQuota(tx, userId, limit);
    await tx.update(notes).set({
      status: "queued", progressStep: 1, errorCode: null, errorMessage: null, attempts: 0, leaseUntil: null, updatedAt: new Date(),
      ...(transcriptInput ? { transcriptInput } : {}),
    }).where(and(eq(notes.id, id), eq(notes.userId, userId)));
    await tx.insert(generationLog).values({ userId, noteId: id });
  });
}
