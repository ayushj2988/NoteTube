import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDecks, useFlashcards, useNotes } from '../api/queries'
import { relativeTime } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import DeckManager from '../ui/DeckManager'
import FlashcardReview from '../ui/FlashcardReview'
import PageHeader from '../ui/PageHeader'
import { EmptyState, ErrorState, SkeletonList } from '../ui/States'

export default function Flashcards() {
  useDocumentTitle('Flashcards')
  const nav = useNavigate()
  const [params] = useSearchParams()
  const review = params.get('review') === '1'
  const noteId = params.get('note_id') ?? undefined
  const manage = params.get('manage') ?? undefined
  const decks = useDecks()
  const due = useFlashcards({ due: true, limit: 1 })
  const ready = useNotes({ status: 'ready', limit: 100, sort: 'title' })

  const exit = () => nav('/app/flashcards')

  if (review) {
    return (
      <section className="view" aria-labelledby="fc-title">
        <PageHeader id="fc-title" title="Review" />
        <FlashcardReview key={noteId ?? 'all'} noteId={noteId} onExit={exit} />
      </section>
    )
  }
  if (manage) {
    return (
      <section className="view" aria-labelledby="fc-title">
        <PageHeader id="fc-title" title="Edit flashcards" />
        <DeckManager noteId={manage} onDone={exit} />
      </section>
    )
  }

  const dueCount = due.data?.due_count ?? 0
  const items = decks.data?.items ?? []

  return (
    <section className="view" aria-labelledby="fc-title">
      <PageHeader id="fc-title" title="Flashcards" sub="Spaced repetition: cards you miss come back sooner, cards you know come back later." />

      <div className="gl dense due-card">
        {due.isPending && <p className="mu">Checking what's due…</p>}
        {due.isError && <p className="mu">Couldn't check what's due.</p>}
        {due.data && (
          <>
            <div>
              <b className="due-num">{dueCount}</b>
              <span> card{dueCount === 1 ? '' : 's'} due now</span>
              {dueCount === 0 && due.data.next_due_at && <p className="mu">Next one is due {relativeTime(due.data.next_due_at)}.</p>}
            </div>
            <Link className={`btn${dueCount === 0 ? ' disabled' : ''}`} to="/app/flashcards?review=1" aria-disabled={dueCount === 0} onClick={(e) => dueCount === 0 && e.preventDefault()}>Start review</Link>
          </>
        )}
      </div>

      <h2>Decks</h2>
      {decks.isPending && <SkeletonList rows={3} label="Loading decks" />}
      {decks.isError && <ErrorState error={decks.error} onRetry={() => void decks.refetch()} />}
      {decks.data && items.length === 0 && (
        <EmptyState icon="◧" title="No flashcards yet" body="Flashcards are created with your notes. Generate a note with “Flashcards” switched on, or add cards to an existing note below.">
          <Link className="btn" to="/app/notes/new">Create a note</Link>
        </EmptyState>
      )}
      {items.length > 0 && (
        <ul className="deck-list">
          {items.map((d) => (
            <li key={d.note_id} className="gl dense deck">
              <div className="deck-info">
                <b>{d.note_title}</b>
                <span className="mu">{d.total} card{d.total === 1 ? '' : 's'} · {d.due} due</span>
              </div>
              <div className="row">
                <Link className="btn btn-sm" to={`/app/flashcards?review=1&note_id=${d.note_id}`}>{d.due > 0 ? `Study ${d.due}` : 'Practice'}</Link>
                <Link className="btn ghost btn-sm" to={`/app/flashcards?manage=${d.note_id}`}>Edit</Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {ready.data && ready.data.items.length > 0 && (
        <div className="gl dense add-to-note">
          <label className="field">
            Add your own cards to a note
            <select
              value=""
              onChange={(e) => e.target.value && nav(`/app/flashcards?manage=${e.target.value}`)}
            >
              <option value="">Choose a note…</option>
              {ready.data.items.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
          </label>
        </div>
      )}
    </section>
  )
}
