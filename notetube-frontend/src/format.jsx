// Small helpers for showing notes in lists.
export const chipFor = (subject) => ['', 'y', 'g'][[...String(subject || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 3]

export function ago(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function mmss(sec) {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

// "==x==" marks a highlight inside a note.
export function withHighlights(text) {
  return String(text || '').split(/(==[^=]+==)/g).map((part, i) =>
    part.startsWith('==') && part.endsWith('==') && part.length > 4 ? <span className="hl" key={i}>{part.slice(2, -2)}</span> : part)
}
