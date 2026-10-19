import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCardActions, useFlashcards } from '../api/queries'
import type { Flashcard, Grade } from '../api/types'
import { errorText } from '../lib/errors'
import { intervalLabel, relativeTime } from '../lib/format'
import { useStudyTimer } from '../lib/hooks'
import { nextSchedule } from '../lib/sm2'
import { EmptyState, ErrorState, Spinner } from './States'

const GRADES: { grade: Grade; label: string; hint: string; key: string }[] = [
  { grade: 'again', label: 'Again', hint: "Didn't know it", key: '1' },
  { grade: 'hard', label: 'Hard', hint: 'Barely', key: '2' },
  { grade: 'good', label: 'Good', hint: 'Knew it', key: '3' },
  { grade: 'easy', label: 'Easy', hint: 'Too easy', key: '4' },
]

function gradeLabel(card: Flashcard, grade: Grade): string {
  return grade === 'again' ? '10 min' : intervalLabel(nextSchedule(card, grade).interval_days)
}

interface Props {
  noteId?: string
  onExit: () => void
}

/** A review session over the due queue (or, when nothing is due for a chosen deck, a practice round that doesn't touch scheduling). */
export default function FlashcardReview({ noteId, onExit }: Props) {
  const due = useFlashcards({ due: true, note_id: noteId, limit: 200 })
  const all = useFlashcards({ note_id: noteId, limit: 200 }, !!noteId && due.isSuccess && due.data.items.length === 0)
  const actions = useCardActions()
  useStudyTimer('flashcards', noteId)

  const [queue, setQueue] = useState<Flashcard[] | null>(null)
  const [practice, setPractice] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [missed, setMissed] = useState(0)
  const [error, setError] = useState('')
  const requeued = useRef(new Set<string>())
  const front = useRef<HTMLDivElement>(null)

  // freeze the queue once so refetches don't reshuffle a session in progress
  useEffect(() => {
    if (queue) return
    if (due.data && due.data.items.length > 0) setQueue(due.data.items)
    else if (due.data && all.data && all.data.items.length > 0) {
      setQueue(all.data.items)
      setPractice(true)
    }
  }, [due.data, all.data, queue])

  const card = queue?.[0]
  const finished = !!queue && queue.length === 0

  // refresh the lists once when a session ends
  const refreshed = useRef(false)
  useEffect(() => {
    if (finished && !refreshed.current) {
      refreshed.current = true
      actions.refresh()
    }
  }, [finished, actions])

  const grade = useCallback(
    (g: Grade) => {
      if (!card || !queue) return
      setError('')
      const advance = () => {
        setReviewed((n) => n + 1)
        if (g === 'again') setMissed((n) => n + 1)
        setFlipped(false)
        setQueue((q) => {
          if (!q) return q
          const [head, ...rest] = q
          // a missed card comes back once more in this session
          if (g === 'again' && !requeued.current.has(head.id)) {
            requeued.current.add(head.id)
            return [...rest, head]
          }
          return rest
        })
      }
      if (practice) return advance()
      actions.review.mutate({ id: card.id, grade: g }, { onSuccess: advance, onError: (e) => setError(errorText(e)) })
    },
    [card, queue, practice, actions.review],
  )

  // keyboard: Space/Enter flips, 1-4 grades
  useEffect(() => {
    if (!card) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, dialog')) return
      if (e.key === ' ' && t.tagName !== 'BUTTON') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && !actions.review.isPending) {
        const g = GRADES.find((x) => x.key === e.key)
        if (g) grade(g.grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, flipped, grade, actions.review.isPending])

  useEffect(() => {
    front.current?.focus()
  }, [card?.id])

  if (due.isPending) return <Spinner label="Loading your cards" />
  if (due.isError) return <ErrorState error={due.error} onRetry={() => void due.refetch()} />
  if (!queue) {
    if (noteId && all.isPending) return <Spinner label="Loading deck" />
    return (
      <EmptyState icon="✓" title="Nothing due right now" body={due.data.next_due_at ? `Your next card is due ${relativeTime(due.data.next_due_at)}.` : 'Add some flashcards to start reviewing.'}>
        <button className="btn dark" onClick={onExit}>Back to flashcards</button>
      </EmptyState>
    )
  }

  if (finished) {
    const next = due.data.next_due_at
    return (
      <div className="gl dense empty-state" role="status">
        <div className="empty-icon" aria-hidden="true">✓</div>
        <h3>{practice ? 'Practice round finished' : 'Session complete'}</h3>
        <p className="mu">
          You went through {reviewed} card{reviewed === 1 ? '' : 's'}{missed ? `, ${missed} you missed` : ''}.
          {practice ? ' Practice rounds don\'t change your schedule.' : next ? ` Next card due ${relativeTime(next)}.` : ''}
        </p>
        <div className="empty-actions">
          <button className="btn dark" onClick={onExit}>Done</button>
          {noteId && <Link className="btn ghost" to={`/app/notes/${noteId}`}>Back to note</Link>}
        </div>
      </div>
    )
  }

  const total = reviewed + (queue?.length ?? 0)
  return (
    <div className="review">
      <div className="review-top">
        <button className="link" onClick={onExit}>← End session</button>
        <span className="mu" aria-live="polite">{practice ? 'Practice · ' : ''}{reviewed + 1} of {total}</span>
      </div>
      <div className="meter" aria-hidden="true"><i style={{ width: `${(reviewed / total) * 100}%` }} /></div>

      <div className="gl dense fc" data-flipped={flipped}>
        <p className="fc-from mu">{card!.note_title}</p>
        <div
          ref={front}
          tabIndex={0}
          role="button"
          aria-expanded={flipped}
          className="fc-face"
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setFlipped((f) => !f)
          }}
        >
          <p className="fc-label">{flipped ? 'Answer' : 'Question'}</p>
          <p className="fc-text" aria-live="polite">{flipped ? card!.back : card!.front}</p>
          {!flipped && <p className="mu fc-tip">Tap, or press Space, to reveal</p>}
        </div>
      </div>

      {error && <p className="field-error" role="alert">Couldn't save that answer: {error}. Press a grade again to retry.</p>}
      {flipped ? (
        <div className="grades" role="group" aria-label="How well did you know it?">
          {GRADES.map((g) => (
            <button key={g.grade} className={`grade grade--${g.grade}`} onClick={() => grade(g.grade)} disabled={actions.review.isPending}>
              <b>{g.label}</b>
              <span>{g.hint}</span>
              <small>{practice ? `key ${g.key}` : `${gradeLabel(card!, g.grade)} · key ${g.key}`}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn dark reveal" onClick={() => setFlipped(true)}>Show answer</button>
      )}
    </div>
  )
}
