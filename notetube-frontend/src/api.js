// Every call to the NoteTube server lives here, one function per route (see docs/API.md).
export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields || {}
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the NoteTube server. Is it running on port 8787?')
  }
  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const e = data?.error || {}
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('nt-unauthenticated'))
    throw new ApiError(res.status, e.code || 'UNKNOWN', e.message || 'Something went wrong.', e.fields)
  }
  return data
}

// The server may leave some fields out while a note is still being made. Fill them in so no page ever crashes on a missing field.
const fillNote = (n) => (n && typeof n === 'object' ? {
  ...n,
  title: n.title || 'New lecture',
  subject: n.subject || 'General',
  status: n.status || 'processing',
  createdAt: n.createdAt || new Date().toISOString(),
  progress: { transcript: 0, notes: 0, extras: 0, ...(n.progress || {}) },
  extras: { flashcards: 'none', quiz: 'none', ...(n.extras || {}) },
  sections: n.sections || [],
  takeaways: n.takeaways || [],
  definitions: n.definitions || [],
} : n)
const fillOne = (r) => (r && r.note ? { ...r, note: fillNote(r.note) } : r)
const fillList = (r) => (r && Array.isArray(r.notes) ? { ...r, notes: r.notes.map(fillNote) } : r)

export const api = {
  signup: (name, email, password) => request('/auth/signup', { method: 'POST', body: { name, email, password } }),
  google: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),

  createNote: (body) => request('/notes', { method: 'POST', body }),
  listNotes: ({ q = '', subject = '' } = {}) => request(`/notes?q=${encodeURIComponent(q)}&subject=${encodeURIComponent(subject)}`).then(fillList),
  getNote: (id) => request('/notes/' + id).then(fillOne),
  updateNote: (id, body) => request('/notes/' + id, { method: 'PATCH', body }).then(fillOne),
  deleteNote: (id) => request('/notes/' + id, { method: 'DELETE' }),
  retryNote: (id, transcript) => request(`/notes/${id}/retry`, { method: 'POST', body: transcript ? { transcript } : {} }),
  makeExtras: (id, flashcards, quiz) => request(`/notes/${id}/extras`, { method: 'POST', body: { flashcards, quiz } }),

  decks: () => request('/decks'),
  cards: (noteId) => request(`/notes/${noteId}/cards`),
  review: (cardId, grade) => request(`/cards/${cardId}/review`, { method: 'POST', body: { grade } }),

  quizzes: () => request('/quizzes'),
  quiz: (noteId) => request(`/notes/${noteId}/quiz`),
  submitAttempt: (noteId, answers) => request(`/notes/${noteId}/quiz/attempts`, { method: 'POST', body: { answers } }),

  stats: () => request('/stats'),
}
