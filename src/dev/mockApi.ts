/**
 * DEV ONLY. An in-browser implementation of docs/API.md so the frontend runs and can be tested with no backend.
 * Enabled by `VITE_MOCK_API=1 npm run dev`. It is excluded from production builds (see main.tsx).
 *
 * It starts empty: no seeded notes, cards or stats. It cannot fetch real YouTube captions or call a real AI, so
 * it builds notes from a transcript the user pastes, using simple text rules. A URL with no transcript fails with
 * NO_CAPTIONS, just like a real video with no readable captions.
 * Test ids: `privatevid1` -> VIDEO_PRIVATE, `longvideo01` -> VIDEO_TOO_LONG, `nocaptions1` -> NO_CAPTIONS.
 * State is kept in localStorage under `nt-mock-db`, so a refresh keeps it. Clear it to start over.
 */
import type {
  Flashcard, Folder, Note, QuizAttempt, QuizQuestion, Settings, User, VideoMeta, ErrorCode, Grade, SessionKind,
} from '../api/types'
import { extractVideoId } from '../lib/youtube'
import { nextSchedule } from '../lib/sm2'

const KEY = 'nt-mock-db'
const LIMIT = 5
const STEPS = ['Fetching transcript', 'Finding key concepts', 'Writing structured notes', 'Building flashcards and quiz']
const STEP_MS = 1500

interface StoredNote extends Note {
  transcript: string
  fail: { code: ErrorCode; message: string } | null
  startedAt: number
  charged: boolean
  chargedAt: number
  wantCards: boolean
  wantQuiz: boolean
  settled: boolean
}
interface Db {
  user: (User & { password: string }) | null
  signedIn: boolean
  settings: Settings
  notes: StoredNote[]
  folders: Folder[]
  cards: Flashcard[]
  questions: QuizQuestion[]
  attempts: QuizAttempt[]
  sessions: { kind: SessionKind; note_id?: string; seconds: number; at: number }[]
  reviews: { at: number }[]
}

const empty = (): Db => ({
  user: null,
  signedIn: false,
  settings: { daily_reminder: true, auto_flashcards: true, reduce_motion: false, default_style: 'detailed', default_language: 'en' },
  notes: [], folders: [], cards: [], questions: [], attempts: [], sessions: [], reviews: [],
})

let db: Db = empty()
const load = () => {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) db = { ...empty(), ...JSON.parse(raw) }
  } catch { /* start empty */ }
}
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ }
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const now = () => new Date().toISOString()
const dayKey = (t: number, tz = 'UTC') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(t)

class Err extends Error {
  constructor(public status: number, public code: ErrorCode, message: string, public details?: Record<string, unknown>) { super(message) }
}
const bad = (code: ErrorCode, message: string, status = 422, details?: Record<string, unknown>) => new Err(status, code, message, details)
const notFound = () => new Err(404, 'NOT_FOUND', 'Not found.')

// ---------- text rules standing in for the AI ----------
const STOP = new Set('the a an and or but of to in on at for with is are was were be been it this that these those as by from we you they he she i not can will do does so if then than there their about into how what which who when where why also more most some such very just'.split(' '))

function parseLines(t: string): { s: number | null; text: string }[] {
  return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^\[((?:\d+:)?\d{1,2}:\d{2})\]\s*(.*)$/)
    if (!m) return { s: null, text: l }
    return { s: m[1].split(':').map(Number).reduce((a, n) => a * 60 + n, 0), text: m[2] }
  })
}
const stamp = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`
}
const firstSentence = (t: string) => (t.match(/[^.!?]+[.!?]?/)?.[0] ?? t).trim()
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t)

function build(n: StoredNote): void {
  const lines = parseLines(n.transcript)
  const per = Math.max(1, Math.ceil(lines.length / 6))
  const groups: typeof lines[] = []
  for (let i = 0; i < lines.length; i += per) groups.push(lines.slice(i, i + per))
  let clock = 0
  const chapters = groups.map((g, i) => {
    const s = g[0].s ?? (clock += 60, (i * 90))
    return { s, title: clip(firstSentence(g[0].text).replace(/[.!?]$/, ''), 60), lines: g }
  })
  const words = new Map<string, number>()
  for (const w of n.transcript.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? []) if (!STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1)
  n.key_concepts = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w)
  n.summary = clip(lines.slice(0, 2).map((l) => l.text).join(' '), 300)
  n.skim = chapters.slice(0, 5).map((c) => clip(firstSentence(c.lines[0].text), 140))
    n.content_md = chapters.map((c) => {
    const body = n.style === 'concise' ? firstSentence(c.lines[0].text) : c.lines.map((l) => `- ${l.s !== null ? `[${stamp(l.s)}] ` : ''}${l.text}`).join('\n')
    return `## [${stamp(c.s)}] ${c.title}\n\n${body}`
  }).join('\n\n')

  db.cards = db.cards.filter((c) => c.note_id !== n.id)
  db.questions = db.questions.filter((q) => q.note_id !== n.id)
  if (n.wantCards) {
    for (const l of lines) {
      const m = l.text.match(/^(.{4,80}?)\s+(?:is|are)\s+(.{8,300})$/i)
      if (m && db.cards.filter((c) => c.note_id === n.id).length < 12) {
        db.cards.push({ id: uid(), note_id: n.id, note_title: n.title, front: `What ${/\sare\s/i.test(l.text) ? 'are' : 'is'} ${m[1].replace(/^(the|a|an)\s/i, (x) => x.toLowerCase())}?`, back: clip(m[2].replace(/[.]$/, ''), 300), due_at: now(), interval_days: 0, ease: 2.5, reps: 0, lapses: 0, last_reviewed_at: null, created_at: now() })
      }
    }
    if (!db.cards.some((c) => c.note_id === n.id)) {
      for (const c of chapters.slice(0, 6)) db.cards.push({ id: uid(), note_id: n.id, note_title: n.title, front: `What is covered at ${stamp(c.s)}?`, back: c.title, due_at: now(), interval_days: 0, ease: 2.5, reps: 0, lapses: 0, last_reviewed_at: null, created_at: now() })
    }
  }
  if (n.wantQuiz && chapters.length >= 2) {
    chapters.slice(0, 6).forEach((c, i) => {
      const others = chapters.filter((_, j) => j !== i).map((x) => x.title).slice(0, 3)
      const options = [...others]
      const at = i % (options.length + 1)
      options.splice(at, 0, c.title)
      db.questions.push({ id: uid(), note_id: n.id, question: `Which topic starts the section at ${stamp(c.s)}?`, options, answer_index: at, explanation: `The section at ${stamp(c.s)} begins with “${c.title}”.` })
    })
  }
  n.flashcard_count = db.cards.filter((c) => c.note_id === n.id).length
  n.question_count = db.questions.filter((q) => q.note_id === n.id).length
}

/** Notes advance with the clock: a read after enough time settles them. */
function settle(n: StoredNote): void {
  if (n.status === 'ready' || n.status === 'failed') return
  const elapsed = Date.now() - n.startedAt
  const step = Math.min(4, Math.floor(elapsed / STEP_MS) + 1)
  if (elapsed < STEP_MS * 4) {
    n.status = 'processing'
    n.progress = { step, total: 4, label: STEPS[step - 1] }
    return
  }
  n.progress = null
  if (n.fail) {
    n.status = 'failed'
    n.error = n.fail
    n.charged = false
  } else {
    build(n)
    n.status = 'ready'
    n.error = null
  }
  n.updated_at = now()
  save()
}

const strip = (n: StoredNote): Note => {
  const { transcript: _t, fail: _f, startedAt: _s, charged: _c, chargedAt: _ca, wantCards: _wc, wantQuiz: _wq, settled: _st, ...rest } = n
  void _t; void _f; void _s; void _c; void _ca; void _wc; void _wq; void _st
  return rest
}
const summary = (n: StoredNote) => {
  const { content_md: _a, summary: _b, key_concepts: _k, skim: _s, style: _y, language: _l, shared: _sh, share_token: _tk, ...rest } = strip(n)
  void _a; void _b; void _k; void _s; void _y; void _l; void _sh; void _tk
  return rest
}
const mine = (id: string) => {
  const n = db.notes.find((x) => x.id === id)
  if (!n) throw notFound()
  settle(n)
  return n
}
const usage = () => {
  const today = dayKey(Date.now())
  const used = db.notes.filter((n) => n.charged && dayKey(n.chargedAt) === today).length
  const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0)
  return { used, limit: LIMIT, resets_at: tomorrow.toISOString() }
}

function videoMeta(id: string): VideoMeta {
  return { id, title: `YouTube video ${id}`, channel: 'Unknown channel (mock)', duration_seconds: 900, thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
}

// ---------- routes ----------
type Ctx = { body: any; query: URLSearchParams; params: string[] }
type Handler = (c: Ctx) => unknown
const routes: [string, RegExp, Handler][] = []
const on = (method: string, path: string, h: Handler) => routes.push([method, new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`), h])
const authed = () => { if (!db.signedIn || !db.user) throw new Err(401, 'UNAUTHENTICATED', 'Sign in.') }
const pub = (u: Db['user']): User => { const { password: _p, ...r } = u!; void _p; return r }

on('POST', '/auth/signup', ({ body }) => {
  const f: Record<string, string> = {}
  if (!body.name?.trim()) f.name = 'Enter your name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? '')) f.email = 'Enter a valid email address.'
  if ((body.password ?? '').length < 8) f.password = 'Use at least 8 characters.'
  if (Object.keys(f).length) throw bad('VALIDATION', 'Invalid', 422, { fields: f })
  if (db.user && db.user.email === body.email.toLowerCase()) throw new Err(409, 'EMAIL_TAKEN', 'taken')
  db = { ...empty(), user: { id: uid(), name: body.name.trim(), email: body.email.toLowerCase(), password: body.password, avatar_url: null, has_password: true, created_at: now() }, signedIn: true }
  return { user: pub(db.user) }
})
on('POST', '/auth/login', ({ body }) => {
  if (!db.user || db.user.email !== String(body.email).toLowerCase() || db.user.password !== body.password) throw new Err(401, 'INVALID_CREDENTIALS', 'Wrong email or password.')
  db.signedIn = true
  return { user: pub(db.user) }
})
on('POST', '/auth/google', () => { throw bad('VALIDATION', 'Google sign-in is not available in the mock API.') })
on('POST', '/auth/logout', () => { db.signedIn = false; return undefined })
on('GET', '/auth/me', () => { authed(); return { user: pub(db.user) } })
on('PATCH', '/me', ({ body }) => { authed(); db.user!.name = String(body.name).trim(); return { user: pub(db.user) } })
on('GET', '/me/export', () => { authed(); const { user: _u, ...rest } = db; void _u; return { exported_at: now(), ...rest, notes: db.notes.map(strip) } })
on('DELETE', '/me/data', () => { authed(); db = { ...empty(), user: db.user, signedIn: true, settings: db.settings }; return undefined })
on('DELETE', '/me', () => { authed(); db = empty(); return undefined })

on('GET', '/settings', () => { authed(); return db.settings })
on('PATCH', '/settings', ({ body }) => { authed(); db.settings = { ...db.settings, ...body }; return db.settings })
on('GET', '/usage', () => { authed(); return usage() })

on('POST', '/videos/preview', ({ body }) => {
  authed()
  const id = extractVideoId(String(body.url ?? ''))
  if (!id) throw bad('INVALID_URL', 'bad url', 400)
  if (id === 'privatevid1') throw bad('VIDEO_PRIVATE', 'private', 403)
  if (id === 'longvideo01') throw bad('VIDEO_TOO_LONG', 'too long', 422, { max_minutes: 240 })
  return { video: videoMeta(id), captions: id === 'nocaptions1' ? 'unavailable' : 'unknown' }
})

on('GET', '/notes', ({ query }) => {
  authed()
  db.notes.forEach(settle)
  let list = [...db.notes]
  const q = query.get('q')?.toLowerCase().trim()
  if (q) list = list.filter((n) => [n.title, n.video?.title, n.subject, ...n.tags, ...n.key_concepts, n.content_md].filter(Boolean).join(' ').toLowerCase().includes(q))
  const tag = query.get('tag'); if (tag) list = list.filter((n) => n.tags.includes(tag))
  const folder = query.get('folder_id'); if (folder) list = list.filter((n) => (folder === 'none' ? !n.folder_id : n.folder_id === folder))
  const status = query.get('status'); if (status) list = list.filter((n) => n.status === status)
  if (query.get('has_cards')) list = list.filter((n) => n.flashcard_count > 0)
  if (query.get('has_quiz')) list = list.filter((n) => n.question_count > 0)
  const sort = query.get('sort') ?? 'recent'
  list.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at))
  const offset = Number(query.get('offset')) || 0
  const limit = Math.min(100, Number(query.get('limit')) || 24)
  return { items: list.slice(offset, offset + limit).map(summary), total: list.length }
})
on('POST', '/notes', ({ body }) => {
  authed()
  const url = String(body.url ?? '').trim()
  const text = String(body.transcript_text ?? '').trim()
  if (!url && !text) throw bad('VALIDATION', 'Need a link or transcript', 422, { fields: { url: 'Paste a YouTube link or a transcript.' } })
  if (text && text.length < 200) throw bad('TRANSCRIPT_TOO_SHORT', 'short')
  let video: VideoMeta | null = null
  if (url) {
    const id = extractVideoId(url)
    if (!id) throw bad('INVALID_URL', 'bad url', 400)
    video = videoMeta(id)
  } else if (!String(body.title ?? '').trim()) throw bad('VALIDATION', 'Title needed', 422, { fields: { title: 'Give this note a title.' } })
  const u = usage()
  if (u.used >= u.limit) throw new Err(429, 'QUOTA_EXCEEDED', 'quota', { ...u })
  // the mock cannot read real captions, so a link with no pasted transcript ends the way an unreadable video would
  const fail: StoredNote['fail'] = text || !video ? null
    : video.id === 'privatevid1' ? { code: 'VIDEO_PRIVATE', message: 'Video is private.' }
    : video.id === 'longvideo01' ? { code: 'VIDEO_TOO_LONG', message: 'Video is too long.' }
    : { code: 'NO_CAPTIONS', message: 'No captions could be read for this video.' }
  const n: StoredNote = {
    id: uid(), title: video ? video.title : String(body.title).trim(), status: 'queued', progress: { step: 1, total: 4, label: STEPS[0] }, error: null,
    video, subject: null, tags: [], folder_id: null, flashcard_count: 0, question_count: 0, created_at: now(), updated_at: now(),
    style: body.style ?? 'detailed', language: body.language ?? 'en', summary: null, key_concepts: [], skim: [], content_md: '', shared: false, share_token: null,
    transcript: text, fail, startedAt: Date.now(), charged: true, chargedAt: Date.now(),
    wantCards: !!body.include?.flashcards, wantQuiz: !!body.include?.quiz, settled: false,
  }
  db.notes.push(n)
  return { __status: 202, ...strip(n) }
})
on('GET', '/notes/:id', ({ params }) => strip(mine(params[0])))
on('PATCH', '/notes/:id', ({ params, body }) => {
  authed()
  const n = mine(params[0])
  if ('title' in body) { if (!String(body.title).trim()) throw bad('VALIDATION', 'x', 422, { fields: { title: 'Title is required.' } }); n.title = String(body.title).trim().slice(0, 200) }
  if ('content_md' in body) n.content_md = String(body.content_md)
  if ('key_concepts' in body) n.key_concepts = body.key_concepts
  if ('tags' in body) n.tags = [...new Set<string>((body.tags as string[]).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 12)
  if ('folder_id' in body) n.folder_id = body.folder_id
  if ('subject' in body) n.subject = body.subject ? String(body.subject).trim() : null
  n.updated_at = now()
  db.cards.forEach((c) => { if (c.note_id === n.id) c.note_title = n.title })
  return strip(n)
})
on('DELETE', '/notes/:id', ({ params }) => {
  authed(); mine(params[0])
  const id = params[0]
  db.notes = db.notes.filter((n) => n.id !== id)
  db.cards = db.cards.filter((c) => c.note_id !== id)
  db.questions = db.questions.filter((q) => q.note_id !== id)
  db.attempts = db.attempts.filter((a) => a.note_id !== id)
  return undefined
})
on('POST', '/notes/:id/retry', ({ params, body }) => {
  authed()
  const n = mine(params[0])
  if (n.status !== 'failed') throw bad('VALIDATION', 'Only failed notes can be retried.')
  const text = String(body.transcript_text ?? '').trim()
  if (text && text.length < 200) throw bad('TRANSCRIPT_TOO_SHORT', 'short')
  const u = usage()
  if (u.used >= u.limit) throw new Err(429, 'QUOTA_EXCEEDED', 'quota', { ...u })
  if (text) n.transcript = text
  n.fail = n.transcript ? null : n.fail ?? { code: 'NO_CAPTIONS', message: 'No captions could be read for this video.' }
  Object.assign(n, { status: 'queued', error: null, progress: { step: 1, total: 4, label: STEPS[0] }, startedAt: Date.now(), charged: true, chargedAt: Date.now() })
  return { __status: 202, ...strip(n) }
})
on('POST', '/notes/:id/share', ({ params }) => { authed(); const n = mine(params[0]); n.shared = true; n.share_token ??= uid() + uid(); return { token: n.share_token } })
on('DELETE', '/notes/:id/share', ({ params }) => { authed(); const n = mine(params[0]); n.shared = false; n.share_token = null; return undefined })
on('GET', '/share/:token', ({ params }) => {
  const n = db.notes.find((x) => x.shared && x.share_token === params[0])
  if (!n) throw notFound()
  return { title: n.title, summary: n.summary, key_concepts: n.key_concepts, skim: n.skim, content_md: n.content_md, video: n.video, author_name: db.user?.name ?? 'Someone', created_at: n.created_at }
})
on('GET', '/tags', () => {
  authed()
  const m = new Map<string, number>()
  db.notes.forEach((n) => n.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)))
  return { items: [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count) }
})

const folderOut = (f: Folder): Folder => ({ ...f, note_count: db.notes.filter((n) => n.folder_id === f.id).length })
on('GET', '/folders', () => { authed(); return { items: db.folders.map(folderOut) } })
on('POST', '/folders', ({ body }) => {
  authed()
  const name = String(body.name ?? '').trim()
  if (!name || name.length > 40 || db.folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) throw bad('VALIDATION', 'x', 422, { fields: { name: name ? 'A folder with that name already exists.' : 'Enter a name.' } })
  const f = { id: uid(), name, note_count: 0 }
  db.folders.push(f)
  return { __status: 201, ...f }
})
on('PATCH', '/folders/:id', ({ params, body }) => { authed(); const f = db.folders.find((x) => x.id === params[0]); if (!f) throw notFound(); f.name = String(body.name).trim(); return folderOut(f) })
on('DELETE', '/folders/:id', ({ params }) => { authed(); db.folders = db.folders.filter((f) => f.id !== params[0]); db.notes.forEach((n) => { if (n.folder_id === params[0]) n.folder_id = null }); return undefined })

// flashcards
on('GET', '/flashcards', ({ query }) => {
  authed()
  const t = Date.now()
  let list = db.cards.filter((c) => !query.get('note_id') || c.note_id === query.get('note_id'))
  if (query.get('due')) list = list.filter((c) => new Date(c.due_at).getTime() <= t).sort((a, b) => a.due_at.localeCompare(b.due_at))
  const offset = Number(query.get('offset')) || 0
  const limit = Math.min(200, Number(query.get('limit')) || 50)
  const dueCount = db.cards.filter((c) => new Date(c.due_at).getTime() <= t).length
  const future = db.cards.filter((c) => new Date(c.due_at).getTime() > t).map((c) => c.due_at).sort()[0] ?? null
  return { items: list.slice(offset, offset + limit), total: list.length, due_count: dueCount, next_due_at: future }
})
on('GET', '/flashcards/decks', () => {
  authed()
  const t = Date.now()
  const m = new Map<string, { note_id: string; note_title: string; total: number; due: number }>()
  for (const c of db.cards) {
    const d = m.get(c.note_id) ?? { note_id: c.note_id, note_title: c.note_title, total: 0, due: 0 }
    d.total++
    if (new Date(c.due_at).getTime() <= t) d.due++
    m.set(c.note_id, d)
  }
  return { items: [...m.values()] }
})
on('POST', '/flashcards', ({ body }) => {
  authed()
  const n = mine(body.note_id)
  if (!String(body.front ?? '').trim() || !String(body.back ?? '').trim()) throw bad('VALIDATION', 'x')
  const c: Flashcard = { id: uid(), note_id: n.id, note_title: n.title, front: String(body.front).trim(), back: String(body.back).trim(), due_at: now(), interval_days: 0, ease: 2.5, reps: 0, lapses: 0, last_reviewed_at: null, created_at: now() }
  db.cards.push(c)
  n.flashcard_count = db.cards.filter((x) => x.note_id === n.id).length
  return { __status: 201, ...c }
})
const card = (id: string) => { const c = db.cards.find((x) => x.id === id); if (!c) throw notFound(); return c }
on('PATCH', '/flashcards/:id', ({ params, body }) => { authed(); const c = card(params[0]); if (body.front !== undefined) c.front = body.front; if (body.back !== undefined) c.back = body.back; return c })
on('DELETE', '/flashcards/:id', ({ params }) => { authed(); const c = card(params[0]); db.cards = db.cards.filter((x) => x.id !== c.id); const n = db.notes.find((x) => x.id === c.note_id); if (n) n.flashcard_count = db.cards.filter((x) => x.note_id === n.id).length; return undefined })
on('POST', '/flashcards/:id/review', ({ params, body }) => {
  authed()
  const c = card(params[0])
  const g = body.grade as Grade
  const s = nextSchedule(c, g)
  Object.assign(c, { ease: s.ease, reps: s.reps, interval_days: s.interval_days, lapses: s.lapses, last_reviewed_at: now(), due_at: new Date(Date.now() + s.dueInMinutes * 60_000).toISOString() })
  db.reviews.push({ at: Date.now() })
  return c
})

// quizzes
on('GET', '/quiz/questions', ({ query }) => { authed(); return { items: db.questions.filter((q) => q.note_id === query.get('note_id')) } })
on('GET', '/quiz/attempts', ({ query }) => {
  authed()
  const nid = query.get('note_id')
  const items = db.attempts.filter((a) => !nid || a.note_id === nid).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, Number(query.get('limit')) || 20)
  return { items }
})
on('POST', '/quiz/attempts', ({ body }) => {
  authed()
  const n = mine(body.note_id)
  const answers = (body.answers as { question_id: string; picked: number }[]).map((a) => {
    const q = db.questions.find((x) => x.id === a.question_id && x.note_id === n.id)
    if (!q) throw bad('VALIDATION', 'Unknown question')
    return { question_id: a.question_id, picked: a.picked, correct: a.picked === q.answer_index }
  })
  const at: QuizAttempt = { id: uid(), note_id: n.id, note_title: n.title, score: answers.filter((a) => a.correct).length, total: answers.length, answers, retry_of: body.retry_of ?? null, created_at: now() }
  db.attempts.push(at)
  return { __status: 201, ...at }
})

// sessions + stats
on('POST', '/sessions', ({ body }) => {
  authed()
  const seconds = Math.max(1, Math.min(3600, Math.round(Number(body.seconds) || 0)))
  db.sessions.push({ kind: body.kind, note_id: body.note_id, seconds, at: Date.now() })
  return undefined
})
on('GET', '/stats/summary', ({ query }) => {
  authed()
  const days = Number(query.get('days')) === 30 ? 30 : 7
  const tz = query.get('tz') || 'UTC'
  const out: { date: string; minutes: number }[] = []
  for (let i = days - 1; i >= 0; i--) out.push({ date: dayKey(Date.now() - i * 86_400_000, tz), minutes: 0 })
  const idx = new Map(out.map((d, i) => [d.date, i]))
  for (const s of db.sessions) { const i = idx.get(dayKey(s.at, tz)); if (i !== undefined) out[i].minutes += s.seconds / 60 }
  out.forEach((d) => { d.minutes = Math.round(d.minutes) })
  const active = new Set<string>([...db.sessions.map((s) => dayKey(s.at, tz)), ...db.reviews.map((r) => dayKey(r.at, tz)), ...db.attempts.map((a) => dayKey(new Date(a.created_at).getTime(), tz))])
  let streak = 0
  let d = Date.now()
  if (!active.has(dayKey(d, tz))) d -= 86_400_000
  while (active.has(dayKey(d, tz))) { streak++; d -= 86_400_000 }
  const recent = db.attempts.filter((a) => Date.now() - new Date(a.created_at).getTime() < 30 * 86_400_000)
  const quizAvg = recent.length ? (recent.reduce((n, a) => n + a.score / a.total, 0) / recent.length) * 100 : null
  const t = Date.now()
  const subjects = new Map<string, { cards: Flashcard[]; scores: number[] }>()
  for (const n of db.notes) {
    if (!n.subject) continue
    const e = subjects.get(n.subject) ?? { cards: [], scores: [] }
    e.cards.push(...db.cards.filter((c) => c.note_id === n.id))
    e.scores.push(...db.attempts.filter((a) => a.note_id === n.id).map((a) => (a.score / a.total) * 100))
    subjects.set(n.subject, e)
  }
  const mastery = [...subjects.entries()].flatMap(([subject, e]) => {
    const parts: number[] = []
    if (e.cards.length && e.cards.some((c) => c.reps > 0)) parts.push((e.cards.filter((c) => c.interval_days >= 6).length / e.cards.length) * 100)
    if (e.scores.length) parts.push(e.scores.reduce((a, b) => a + b, 0) / e.scores.length)
    return parts.length ? [{ subject, percent: Math.round(parts.reduce((a, b) => a + b, 0) / parts.length), cards: e.cards.length }] : []
  })
  return {
    days: out, minutes_total: out.reduce((n, x) => n + x.minutes, 0),
    cards_due: db.cards.filter((c) => new Date(c.due_at).getTime() <= t).length, cards_total: db.cards.length, notes_total: db.notes.length,
    quiz_average: quizAvg, quiz_attempts: recent.length, streak_days: streak, mastery,
  }
})

// ---------- fetch interception ----------
function banner() {
  if (document.getElementById('mock-banner')) return
  const b = document.createElement('div')
  b.id = 'mock-banner'
  b.className = 'mock-banner'
  b.textContent = 'Dev mock API: data lives in this browser only. No real YouTube or AI calls.'
  document.body.appendChild(b)
}

export function installMockApi(): void {
  load()
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    if (!url.pathname.startsWith('/api/')) return real(input, init)
    const path = url.pathname.slice(4)
    const method = (init?.method ?? 'GET').toUpperCase()
    await new Promise((r) => setTimeout(r, 120))
    const json = (status: number, data: unknown) =>
      status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    for (const [m, re, h] of routes) {
      if (m !== method) continue
      const match = re.exec(path)
      if (!match) continue
      try {
        let body: any = {}
        if (init?.body) try { body = JSON.parse(String(init.body)) } catch { body = {} }
        const out = h({ body, query: url.searchParams, params: match.slice(1).map(decodeURIComponent) }) as any
        save()
        if (out === undefined) return json(204, null)
        if (out && typeof out === 'object' && '__status' in out) { const { __status, ...rest } = out; return json(__status, rest) }
        return json(200, out)
      } catch (e) {
        if (e instanceof Err) return json(e.status, { error: { code: e.code, message: e.message, details: e.details } })
        console.error('[mock api]', e)
        return json(500, { error: { code: 'UNKNOWN', message: 'Mock API error' } })
      }
    }
    return json(404, { error: { code: 'NOT_FOUND', message: 'No such mock route' } })
  }
  if (document.body) banner()
  else document.addEventListener('DOMContentLoaded', banner)
}
