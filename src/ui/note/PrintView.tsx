import type { Note } from '../../api/types'
import { formatDate, formatTimestamp } from '../../lib/format'
import Markdown from '../Markdown'

/** Mounted in document.body only while printing; hidden on screen, the only thing shown in the print stylesheet. */
export default function PrintView({ note }: { note: Note }) {
  const meta = [note.video?.channel, note.video ? formatTimestamp(note.video.duration_seconds) : null, formatDate(note.created_at)].filter(Boolean)
  return (
    <article className="print-only">
      <h1>{note.title}</h1>
      <p className="print-meta">{meta.join(' · ')}</p>
      {note.summary && <p>{note.summary}</p>}
      {note.key_concepts.length > 0 && <p><b>Key concepts:</b> {note.key_concepts.join(', ')}</p>}
      <Markdown source={note.content_md} />
    </article>
  )
}
