import { useState } from 'react'
import { DECKS } from '../lib/data'

/** Flashcard deck: click or press Enter/Space to flip, arrows via the buttons. */
export default function CardsPanel({ withChips }: { withChips: boolean }) {
  const [deck, setDeck] = useState(0)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const cards = DECKS[deck].cards
  const [front, back] = cards[index]

  const step = (d: number) => {
    setIndex((index + d + cards.length) % cards.length)
    setFlipped(false)
  }

  return (
    <div>
      {withChips && (
        <div className="chips" role="group" aria-label="Deck">
          {DECKS.map((d, i) => (
            <button key={d.name} aria-pressed={i === deck} onClick={() => { setDeck(i); setIndex(0); setFlipped(false) }}>{d.name}</button>
          ))}
        </div>
      )}
      <div
        className="gl fc"
        tabIndex={0}
        role="button"
        aria-label={flipped ? 'Answer. Flip to see the question' : 'Question. Flip to see the answer'}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setFlipped((f) => !f)
          }
        }}
      >
        {flipped ? back : front}
      </div>
      <p className="mu" style={{ textAlign: 'center' }} aria-live="polite">Card {index + 1} of {cards.length} · tap to flip</p>
      <div className="row">
        <button className="btn dark" onClick={() => step(-1)}>Previous</button>
        <button className="btn" onClick={() => step(1)}>Next card</button>
      </div>
    </div>
  )
}
