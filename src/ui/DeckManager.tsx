import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCardActions, useFlashcards, useNote } from '../api/queries'
import type { Flashcard } from '../api/types'
import { errorText } from '../lib/errors'
import { relativeTime } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'
import { EmptyState, ErrorState, Skeleton } from './States'
import { useToast } from './Toast'

function CardRow({ card }: { card: Flashcard }) {
  const { update, remove } = useCardActions()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [confirm, setConfirm] = useState(false)

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    update.mutate({ id: card.id, front: front.trim(), back: back.trim() }, { onSuccess: () => setEditing(false), onError: (err) => toast.show(errorText(err), 'error') })
  }

  if (editing) {
    return (
      <li className="dm-row">
        <form onSubmit={save} className="dm-edit">
          <label className="field">Front<textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} maxLength={1000} autoFocus /></label>
          <label className="field">Back<textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} maxLength={2000} /></label>
          <div className="row start">
            <button className="btn dark btn-sm" type="submit" disabled={update.isPending || !front.trim() || !back.trim()}>Save</button>
            <button className="btn ghost btn-sm" type="button" onClick={() => { setEditing(false); setFront(card.front); setBack(card.back) }}>Cancel</button>
          </div>
        </form>
      </li>
    )
  }
  return (
    <li className="dm-row">
      <div className="dm-text">
        <b>{card.front}</b>
        <span>{card.back}</span>
        <small className="mu">{card.reps === 0 ? 'New' : `Due ${relativeTime(card.due_at)}`}{card.lapses ? ` · missed ${card.lapses}×` : ''}</small>
      </div>
      <div className="dm-actions">
        <button className="link" onClick={() => setEditing(true)} aria-label={`Edit card: ${card.front}`}>Edit</button>
        <button className="link link-danger" onClick={() => setConfirm(true)} aria-label={`Delete card: ${card.front}`}>Delete</button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this card?"
        body={card.front}
        busy={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => remove.mutate(card.id, { onSuccess: () => setConfirm(false), onError: (err) => toast.show(errorText(err), 'error') })}
      />
    </li>
  )
}

export default function DeckManager({ noteId, onDone }: { noteId: string; onDone: () => void }) {
  const note = useNote(noteId)
  const cards = useFlashcards({ note_id: noteId, limit: 200 })
  const { create } = useCardActions()
  const toast = useToast()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    create.mutate({ note_id: noteId, front: front.trim(), back: back.trim() }, {
      onSuccess: () => { setFront(''); setBack(''); toast.show('Card added') },
      onError: (err) => toast.show(errorText(err), 'error'),
    })
  }

  return (
    <div className="dm">
      <div className="row between">
        <h2>{note.data ? note.data.title : 'Deck'}</h2>
        <div className="row">
          {note.data && <Link className="link" to={`/app/notes/${noteId}`}>Open note</Link>}
          <button className="btn ghost btn-sm" onClick={onDone}>Done</button>
        </div>
      </div>

      <form className="gl dense dm-add" onSubmit={add}>
        <h3>Add a card</h3>
        <label className="field">Front (question)<textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} maxLength={1000} /></label>
        <label className="field">Back (answer)<textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} maxLength={2000} /></label>
        <button className="btn" type="submit" disabled={create.isPending || !front.trim() || !back.trim()}>{create.isPending ? 'Adding…' : 'Add card'}</button>
      </form>

      {cards.isPending && <Skeleton h={90} r={14} />}
      {cards.isError && <ErrorState error={cards.error} onRetry={() => void cards.refetch()} />}
      {cards.data && cards.data.items.length === 0 && <EmptyState icon="◧" title="No cards yet" body="Add your first card above." />}
      {cards.data && cards.data.items.length > 0 && (
        <>
          <p className="mu" aria-live="polite">{cards.data.total} card{cards.data.total === 1 ? '' : 's'}</p>
          <ul className="gl dense dm-list">{cards.data.items.map((c) => <CardRow key={c.id} card={c} />)}</ul>
        </>
      )}
    </div>
  )
}
