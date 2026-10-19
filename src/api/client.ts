import type {
  CreateNoteInput, Deck, ErrorCode, Flashcard, FlashcardList, Folder, Grade, ListResponse, Note, NoteSummary,
  NotesQuery, QuizAttempt, QuizQuestion, SessionKind, Settings, SharedNote, Stats, TagCount, Usage, User,
  VideoPreview,
} from './types'

const BASE: string = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  status: number
  code: ErrorCode
  details?: Record<string, unknown>
  retryAfter?: number
  constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>, retryAfter?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.retryAfter = retryAfter
  }
}

const STATUS_CODE: Record<number, ErrorCode> = {
  401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'EMAIL_TAKEN', 422: 'VALIDATION', 429: 'RATE_LIMITED', 503: 'AI_UNAVAILABLE',
}

/** Called when any request (other than the sign-in calls) comes back 401. AuthProvider registers one. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn
}

interface Options {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  keepalive?: boolean
  /** a 401 here is an expected answer, not a signed-out event */
  quiet401?: boolean
}

async function request<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  let url = BASE + path
  if (opts.query) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(opts.query)) if (v !== undefined && v !== '') sp.set(k, String(v))
    const qs = sp.toString()
    if (qs) url += '?' + qs
  }
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      keepalive: opts.keepalive,
      signal: opts.signal,
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.")
  }
  if (res.status === 204) return undefined as T
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: ErrorCode; message?: string; details?: Record<string, unknown> } } | null)?.error
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined
    const code = err?.code ?? STATUS_CODE[res.status] ?? 'UNKNOWN'
    if (res.status === 401 && !opts.quiet401) onUnauthorized?.()
    throw new ApiError(res.status, code, err?.message ?? `Request failed (${res.status})`, err?.details, retryAfter)
  }
  return data as T
}

const get = <T,>(path: string, o?: Options) => request<T>('GET', path, o)
const post = <T,>(path: string, body?: unknown, o?: Options) => request<T>('POST', path, { ...o, body: body ?? {} })
const patch = <T,>(path: string, body: unknown, o?: Options) => request<T>('PATCH', path, { ...o, body })
const del = <T = void,>(path: string, o?: Options) => request<T>('DELETE', path, o)

export const api = {
  // auth + account
  me: () => get<{ user: User }>('/auth/me', { quiet401: true }),
  signup: (b: { name: string; email: string; password: string }) => post<{ user: User }>('/auth/signup', b, { quiet401: true }),
  login: (b: { email: string; password: string }) => post<{ user: User }>('/auth/login', b, { quiet401: true }),
  google: (credential: string) => post<{ user: User }>('/auth/google', { credential }, { quiet401: true }),
  logout: () => post<void>('/auth/logout'),
  updateMe: (b: { name: string }) => patch<{ user: User }>('/me', b),
  exportData: () => get<unknown>('/me/export'),
  deleteMyData: () => del('/me/data'),
  deleteAccount: () => del('/me'),

  settings: () => get<Settings>('/settings'),
  updateSettings: (b: Partial<Settings>) => patch<Settings>('/settings', b),
  usage: () => get<Usage>('/usage'),

  // videos + notes
  previewVideo: (url: string, signal?: AbortSignal) => post<VideoPreview>('/videos/preview', { url }, { signal }),
  notes: (q: NotesQuery) =>
    get<ListResponse<NoteSummary>>('/notes', {
      query: { ...q, has_cards: q.has_cards ? 1 : undefined, has_quiz: q.has_quiz ? 1 : undefined },
    }),
  note: (id: string) => get<Note>(`/notes/${id}`),
  createNote: (b: CreateNoteInput) => post<Note>('/notes', b),
  updateNote: (id: string, b: Partial<Pick<Note, 'title' | 'content_md' | 'tags' | 'folder_id' | 'subject' | 'key_concepts'>>) =>
    patch<Note>(`/notes/${id}`, b),
  deleteNote: (id: string) => del(`/notes/${id}`),
  retryNote: (id: string, transcript_text?: string) => post<Note>(`/notes/${id}/retry`, transcript_text ? { transcript_text } : {}),
  shareNote: (id: string) => post<{ token: string }>(`/notes/${id}/share`),
  unshareNote: (id: string) => del(`/notes/${id}/share`),
  sharedNote: (token: string) => get<SharedNote>(`/share/${encodeURIComponent(token)}`, { quiet401: true }),
  tags: () => get<{ items: TagCount[] }>('/tags'),

  folders: () => get<{ items: Folder[] }>('/folders'),
  createFolder: (name: string) => post<Folder>('/folders', { name }),
  renameFolder: (id: string, name: string) => patch<Folder>(`/folders/${id}`, { name }),
  deleteFolder: (id: string) => del(`/folders/${id}`),

  // flashcards
  flashcards: (q: { due?: boolean; note_id?: string; limit?: number; offset?: number }) =>
    get<FlashcardList>('/flashcards', { query: { ...q, due: q.due ? 1 : undefined } }),
  decks: () => get<{ items: Deck[] }>('/flashcards/decks'),
  createCard: (b: { note_id: string; front: string; back: string }) => post<Flashcard>('/flashcards', b),
  updateCard: (id: string, b: { front?: string; back?: string }) => patch<Flashcard>(`/flashcards/${id}`, b),
  deleteCard: (id: string) => del(`/flashcards/${id}`),
  reviewCard: (id: string, grade: Grade) => post<Flashcard>(`/flashcards/${id}/review`, { grade }),

  // quizzes
  quizQuestions: (note_id: string) => get<{ items: QuizQuestion[] }>('/quiz/questions', { query: { note_id } }),
  quizAttempts: (q: { note_id?: string; limit?: number }) => get<{ items: QuizAttempt[] }>('/quiz/attempts', { query: q }),
  submitAttempt: (b: { note_id: string; answers: { question_id: string; picked: number }[]; retry_of?: string }) =>
    post<QuizAttempt>('/quiz/attempts', b),

  // study time + stats
  logSession: (b: { kind: SessionKind; note_id?: string; seconds: number }) =>
    post<void>('/sessions', b, { keepalive: true, quiet401: true }),
  stats: (days: 7 | 30) =>
    get<Stats>('/stats/summary', { query: { days, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } }),
}
