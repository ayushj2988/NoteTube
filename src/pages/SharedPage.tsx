import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSharedNote } from '../api/queries'
import { parseChapters } from '../lib/chapters'
import { formatDate, formatTimestamp } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { EmptyState, Spinner } from '../ui/States'
import type { PlayerHandle } from '../ui/YouTubePlayer'
import NoteBody from '../ui/note/NoteBody'
import PlayerPanel from '../ui/note/PlayerPanel'

/** Public, read-only copy of a note at /s/:token. No account needed. */
export default function SharedPage() {
  const { token = '' } = useParams()
  const q = useSharedNote(token)
  const handleRef = useRef<PlayerHandle | null>(null)
  const seek = useCallback((s: number) => handleRef.current?.seek(s), [])
  const note = q.data
  const chapters = useMemo(() => (note ? parseChapters(note.content_md) : []), [note])
  useDocumentTitle(note?.title ?? 'Shared note')

  // a shared link should not be indexed
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    return () => m.remove()
  }, [])

  if (q.isPending) return <div className="fullscreen"><Spinner label="Loading shared note" /></div>
  if (q.isError || !note) {
    return (
      <div className="fullscreen">
        <EmptyState icon="?" title="This link isn't active" body="The note was deleted or its owner stopped sharing it.">
          <Link className="btn" to="/">Go to NoteTube</Link>
        </EmptyState>
      </div>
    )
  }
  return (
    <main className="shared-page">
      <Link to="/" className="auth-brand"><span className="logo"><i aria-hidden="true" />NoteTube</span></Link>
      <div className={`shared-grid${note.video ? '' : ' single'}`}>
        {note.video && <div className="shared-side"><PlayerPanel video={note.video} chapters={chapters} handleRef={handleRef} /></div>}
        <article className="gl dense doc">
          <h1>{note.title}</h1>
          <p className="reader-meta">By {note.author_name} · {formatDate(note.created_at)}{note.video ? ` · ${note.video.channel} · ${formatTimestamp(note.video.duration_seconds)}` : ''}</p>
          {note.skim.length > 0 && (
            <>
              <h3>In 30 seconds</h3>
              <ul className="skim">{note.skim.map((s, k) => <li key={k}>{s}</li>)}</ul>
            </>
          )}
          <NoteBody summary={note.summary} concepts={note.key_concepts} md={note.content_md} onSeek={note.video ? seek : undefined} />
          <p className="shared-cta">Want notes like this from your own lectures? <Link to="/signup">Create a free account</Link></p>
        </article>
      </div>
    </main>
  )
}
