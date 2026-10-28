import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/Card.jsx'
import { api } from '../api.js'
import { useAsync } from '../useAsync.js'
import { Empty, ErrorBox, Loading } from '../components/States.jsx'

// Pick a deck, flip cards, move with Previous / Next (or the arrow keys), and grade each card.
export default function Flashcards() {
  const [params, setParams] = useSearchParams()
  const decks = useAsync(() => api.decks(), [])
  const list = decks.data?.decks || []
  const noteId = params.get('note') || list[0]?.noteId
  const cards = useAsync(() => (noteId ? api.cards(noteId) : Promise.resolve({ cards: [] })), [noteId])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [graded, setGraded] = useState({})
  const [err, setErr] = useState('')
  const total = cards.data?.cards.length || 0

  useEffect(() => { setIndex(0); setFlipped(false); setGraded({}) }, [noteId])

  const go = useCallback((to) => { setIndex((i) => Math.min(total - 1, Math.max(0, typeof to === 'function' ? to(i) : to))); setFlipped(false) }, [total])

  useEffect(() => {
    const key = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight') go((i) => i + 1)
      else if (e.key === 'ArrowLeft') go((i) => i - 1)
      else if (e.key === ' ' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') { e.preventDefault(); setFlipped((f) => !f) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go])

  if (decks.loading) return <Loading />
  if (decks.error) return <ErrorBox error={decks.error} onRetry={decks.reload} />
  if (!list.length) {
    return (
      <>
        <div className="hd"><h1>Flashcards</h1></div>
        <Empty title="No flashcards yet">
          <p>Notes come first. Open a note and press “Make flashcards” to get a deck.</p>
          <Link className="b" style={{ alignSelf: 'flex-start' }} to="/library">Go to my notes</Link>
        </Empty>
      </>
    )
  }

  const card = cards.data?.cards[index]
  const reviewed = Object.keys(graded).length
  const grade = async (g) => {
    setErr('')
    try {
      await api.review(card.id, g)
      setGraded((x) => ({ ...x, [card.id]: g }))
      if (index < total - 1) go(index + 1)
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <>
      <div className="hd"><h1>Flashcards</h1></div>
      <div className="rw c" role="group" aria-label="Decks">
        {list.map((d) => (
          <button key={d.noteId} className={'ck' + (d.noteId === noteId ? ' on' : '')} aria-pressed={d.noteId === noteId} onClick={() => setParams({ note: d.noteId })}>
            {d.title} · {d.due} due
          </button>
        ))}
      </div>

      {cards.loading ? <Loading /> : cards.error ? <ErrorBox error={cards.error} onRetry={cards.reload} /> : card && (
        <>
          <Card as="button" className={'fc' + (flipped ? ' back' : '')} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Answer. Press to see the question' : 'Question. Press to see the answer'} aria-live="polite">
            <small>{flipped ? 'Answer' : 'Question'}</small>
            <span>{flipped ? card.back : card.front}</span>
          </Card>

          <div className="fn">
            <button className="b o" onClick={() => go(index - 1)} disabled={index === 0}>← Previous</button>
            <span className="tg" role="status">Card {index + 1} of {total}</span>
            <button className="b o" onClick={() => go(index + 1)} disabled={index >= total - 1}>Next →</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="tg">{reviewed} of {total} reviewed · tap the card to flip · arrow keys move</span>
            <div className="bar" role="progressbar" aria-label="Reviewed" aria-valuenow={reviewed} aria-valuemin={0} aria-valuemax={total}><i style={{ width: (total ? (reviewed / total) * 100 : 0) + '%' }} /></div>
          </div>
          <div className="rw" role="group" aria-label="How well did you know it?">
            <button className="b r1" onClick={() => grade('again')}>Again</button>
            <button className="b" onClick={() => grade('good')}>Good</button>
            <button className="b r3" onClick={() => grade('easy')}>Easy</button>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          {reviewed === total && total > 0 && <p className="msg ok" role="status">Deck done. Come back when cards are due again.</p>}
        </>
      )}
    </>
  )
}
