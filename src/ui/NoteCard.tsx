import { Link } from 'react-router-dom'
import type { NoteSummary } from '../api/types'
import { formatTimestamp, relativeTime } from '../lib/format'

function hue(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export default function NoteCard({ note }: { note: NoteSummary }) {
  const h = hue(note.title)
  const labels = [note.subject, ...note.tags].filter((t): t is string => !!t).slice(0, 3)
  return (
    <Link to={`/app/notes/${note.id}`} className="gl lift rn">
      <div className="th" style={{ background: `linear-gradient(135deg, hsl(${h} 60% 42%), hsl(${(h + 40) % 360} 55% 28%))` }}>
        {note.video && <img src={note.video.thumbnail_url} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        {note.video && <small>{formatTimestamp(note.video.duration_seconds)}</small>}
      </div>
      <div className="rn-body">
        <b>{note.title}</b>
        <span>
          {relativeTime(note.created_at)}
          {note.status === 'ready' && ` · ${note.flashcard_count} cards · ${note.question_count} questions`}
        </span>
        <div className="tags">
          {note.status === 'queued' || note.status === 'processing' ? <i className="tag tag--busy">Generating…</i> : null}
          {note.status === 'failed' ? <i className="tag tag--bad">Failed</i> : null}
          {labels.map((t) => <i key={t} className="tag">{t}</i>)}
        </div>
      </div>
    </Link>
  )
}
