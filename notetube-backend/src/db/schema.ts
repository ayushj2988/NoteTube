import { sql } from "drizzle-orm";
import {
  boolean, customType, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text,
  timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(), // always stored lower-cased
  passwordHash: text("password_hash"),
  googleSub: text("google_sub"),
  avatarUrl: text("avatar_url"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_google_sub_uq").on(t.googleSub)]);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(), // SHA-256 of the raw cookie token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
}, (t) => [index("sessions_user_idx").on(t.userId), index("sessions_exp_idx").on(t.expiresAt)]);

export const settings = pgTable("settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dailyReminder: boolean("daily_reminder").notNull().default(true),
  autoFlashcards: boolean("auto_flashcards").notNull().default(true),
  reduceMotion: boolean("reduce_motion").notNull().default(false),
  defaultStyle: text("default_style").notNull().default("detailed"),
  defaultLanguage: text("default_language").notNull().default("en"),
});

export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("folders_user_name_uq").on(t.userId, sql`lower(${t.name})`)]);

export const videos = pgTable("videos", {
  youtubeId: text("youtube_id").primaryKey(),
  title: text("title").notNull(),
  channel: text("channel").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  fetchedAt: ts("fetched_at").notNull().defaultNow(),
});

/** Cache of transcripts fetched from a provider. User-pasted text is NEVER stored here (cache poisoning). */
export const transcripts = pgTable("transcripts", {
  youtubeId: text("youtube_id").notNull(),
  language: text("language").notNull(),
  text: text("text").notNull(),
  source: text("source").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.youtubeId, t.language] })]);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  youtubeId: text("youtube_id"),
  // video metadata is denormalised so a note stays readable and searchable (generated columns can't join)
  videoTitle: text("video_title"),
  videoChannel: text("video_channel"),
  videoDuration: integer("video_duration"),
  videoThumbnail: text("video_thumbnail"),
  title: text("title").notNull(),
  status: text("status").notNull().default("queued"),
  progressStep: integer("progress_step").notNull().default(0),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  style: text("style").notNull().default("detailed"),
  language: text("language").notNull().default("en"),
  include: jsonb("include").$type<{ flashcards: boolean; quiz: boolean; timestamps: boolean }>()
    .notNull().default(sql`'{"flashcards":true,"quiz":true,"timestamps":true}'::jsonb`),
  transcriptInput: text("transcript_input"), // user-pasted text, cleared as soon as the job finishes
  subject: text("subject"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  summary: text("summary"),
  keyConcepts: text("key_concepts").array().notNull().default(sql`'{}'::text[]`),
  skim: text("skim").array().notNull().default(sql`'{}'::text[]`),
  contentMd: text("content_md").notNull().default(""),
  shareToken: text("share_token"),
  leaseUntil: ts("lease_until"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  search: tsvector("search"), // maintained by a trigger (see the custom migration)
}, (t) => [
  index("notes_user_created_idx").on(t.userId, t.createdAt),
  index("notes_status_idx").on(t.status, t.leaseUntil),
  uniqueIndex("notes_share_uq").on(t.shareToken),
  index("notes_search_gin").using("gin", t.search),
]);

export const flashcards = pgTable("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  dueAt: ts("due_at").notNull().defaultNow(),
  intervalDays: integer("interval_days").notNull().default(0),
  ease: doublePrecision("ease").notNull().default(2.5),
  reps: integer("reps").notNull().default(0),
  lapses: integer("lapses").notNull().default(0),
  lastReviewedAt: ts("last_reviewed_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("flashcards_user_due_idx").on(t.userId, t.dueAt), index("flashcards_note_idx").on(t.noteId)]);

export const reviewEvents = pgTable("review_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: uuid("card_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grade: text("grade").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("review_events_user_idx").on(t.userId, t.createdAt)]);

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>().notNull(),
  answerIndex: integer("answer_index").notNull(),
  explanation: text("explanation").notNull().default(""),
}, (t) => [index("quiz_questions_note_idx").on(t.noteId, t.position)]);

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: uuid("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  retryOf: uuid("retry_of"),
  score: integer("score").notNull(),
  total: integer("total").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("quiz_attempts_user_idx").on(t.userId, t.createdAt)]);

export const quizAttemptAnswers = pgTable("quiz_attempt_answers", {
  attemptId: uuid("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  picked: integer("picked").notNull(),
  correct: boolean("correct").notNull(),
}, (t) => [primaryKey({ columns: [t.attemptId, t.questionId] })]);

export const studySessions = pgTable("study_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
  seconds: integer("seconds").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("study_sessions_user_idx").on(t.userId, t.createdAt)]);

/** What the daily quota counts. note_id is SET NULL on note delete, so deleting a note never refunds quota. */
export const generationLog = pgTable("generation_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: uuid("note_id").references(() => notes.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  refunded: boolean("refunded").notNull().default(false),
}, (t) => [index("generation_log_user_idx").on(t.userId, t.createdAt)]);
