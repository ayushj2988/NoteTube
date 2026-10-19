import NoteList from '../components/NoteList'
import { NOTES } from '../lib/data'

interface Props {
  query: string
  onOpen: (index: number) => void
}

export default function Library({ query, onOpen }: Props) {
  const q = query.trim().toLowerCase()
  const indices = NOTES.map((_, i) => i).filter((i) => !q || `${NOTES[i].title} ${NOTES[i].tag}`.toLowerCase().includes(q))
  return (
    <section className="view" aria-labelledby="lib-title">
      <h1 id="lib-title">Library</h1>
      <p className="sb">Every lecture you've turned into notes.</p>
      {indices.length ? <NoteList indices={indices} onOpen={onOpen} /> : <p className="empty">No notes match “{query}”.</p>}
    </section>
  )
}
