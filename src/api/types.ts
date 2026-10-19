/** Mirrors docs/API.md. Keep the two in sync. */

export type ErrorCode =
  | 'UNAUTHENTICATED' | 'INVALID_CREDENTIALS' | 'EMAIL_TAKEN' | 'VALIDATION' | 'NOT_FOUND' | 'FORBIDDEN'
  | 'RATE_LIMITED' | 'QUOTA_EXCEEDED' | 'INVALID_URL' | 'VIDEO_NOT_FOUND' | 'VIDEO_PRIVATE' | 'VIDEO_TOO_LONG'
  | 'NO_CAPTIONS' | 'TRANSCRIPT_TOO_SHORT' | 'AI_UNAVAILABLE' | 'AI_BAD_RESPONSE'
  | 'NETWORK' | 'UNKNOWN'

export type NoteStatus = 'queued' | 'processing' | 'ready' | 'failed'
export type NoteStyle = 'detailed' | 'concise' | 'outline'
export type Language = 'en' | 'hi' | 'hinglish'
export type Grade = 'again' | 'hard' | 'good' | 'easy'
export type SessionKind = 'reading' | 'flashcards' | 'quiz'

export interface User {
  id: string
  name: string
  email: string
  avatar_url: string | null
  has_password: boolean
  created_at: string
}

export interface Settings {
  daily_reminder: boolean
  auto_flashcards: boolean
  reduce_motion: boolean
  default_style: NoteStyle
  default_language: Language
}

export interface Usage {
  used: number
  limit: number
  resets_at: string
}

export interface VideoMeta {
  id: string
  title: string
  channel: string
  duration_seconds: number
  thumbnail_url: string
}

export interface VideoPreview {
  video: VideoMeta
  captions: 'available' | 'unavailable' | 'unknown'
}

export interface NoteSummary {
  id: string
  title: string
  status: NoteStatus
  progress: { step: number; total: number; label: string } | null
  error: { code: ErrorCode; message: string } | null
  video: VideoMeta | null
  subject: string | null
  tags: string[]
  folder_id: string | null
  flashcard_count: number
  question_count: number
  created_at: string
  updated_at: string
}

export interface Note extends NoteSummary {
  style: NoteStyle
  language: Language
  summary: string | null
  key_concepts: string[]
  skim: string[]
  content_md: string
  shared: boolean
  share_token: string | null
}

export interface SharedNote {
  title: string
  summary: string | null
  key_concepts: string[]
  skim: string[]
  content_md: string
  video: VideoMeta | null
  author_name: string
  created_at: string
}

export interface Folder { id: string; name: string; note_count: number }
export interface TagCount { tag: string; count: number }

export interface Flashcard {
  id: string
  note_id: string
  note_title: string
  front: string
  back: string
  due_at: string
  interval_days: number
  ease: number
  reps: number
  lapses: number
  last_reviewed_at: string | null
  created_at: string
}
export interface Deck { note_id: string; note_title: string; total: number; due: number }

export interface QuizQuestion {
  id: string
  note_id: string
  question: string
  options: string[]
  answer_index: number
  explanation: string
}
export interface QuizAnswer { question_id: string; picked: number; correct: boolean }
export interface QuizAttempt {
  id: string
  note_id: string
  note_title: string
  score: number
  total: number
  answers: QuizAnswer[]
  retry_of: string | null
  created_at: string
}

export interface Stats {
  days: { date: string; minutes: number }[]
  minutes_total: number
  cards_due: number
  cards_total: number
  notes_total: number
  quiz_average: number | null
  quiz_attempts: number
  streak_days: number
  mastery: { subject: string; percent: number; cards: number }[]
}

export interface ListResponse<T> { items: T[]; total: number }
export interface FlashcardList extends ListResponse<Flashcard> { due_count: number; next_due_at: string | null }

export interface NotesQuery {
  q?: string
  tag?: string
  folder_id?: string
  status?: NoteStatus
  has_cards?: boolean
  has_quiz?: boolean
  sort?: 'recent' | 'oldest' | 'title'
  limit?: number
  offset?: number
}

export interface CreateNoteInput {
  url?: string
  transcript_text?: string
  title?: string
  style: NoteStyle
  language: Language
  include: { flashcards: boolean; quiz: boolean; timestamps: boolean }
}
