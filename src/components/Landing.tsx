import { useEffect, useRef } from 'react'
import LiquidLayer from './LiquidLayer'
import { skyState } from '../scene/skyState'

interface Props {
  onEnter: () => void
  onPaste: () => void
  onOpenNotes: () => void
  still: boolean
}

export default function Landing({ onEnter, onPaste, onOpenNotes, still }: Props) {
  const cards = useRef<HTMLDivElement>(null)

  // the sky render loop nudges the cards opposite the pointer
  useEffect(() => {
    skyState.parallaxEl = cards.current
    return () => {
      skyState.parallaxEl = null
    }
  }, [])

  return (
    <main className="page" id="land">
      <nav className="nav liquid" aria-label="Primary">
        <LiquidLayer radius={99} blur={0.2} displacement={30} still={still} />
        <span className="logo"><i aria-hidden="true" />NoteTube</span>
        <button className="login" onClick={onEnter}>Log in</button>
      </nav>

      <h1 className="land-h1">
        <span>Place for your</span>
        <span className="l2">lectures, notes</span>
        <span className="l3">and flashcards</span>
      </h1>

      <div className="cards" ref={cards}>
        <div className="c a">
          <span>Turn any lecture into notes, flashcards and quizzes in one app <span aria-hidden="true">✎</span></span>
          <button className="add" onClick={onPaste}><span aria-hidden="true">🔗</span> Paste YouTube link</button>
        </div>
        <div className="c b">
          <span className="ic" aria-hidden="true">✎</span>
          <small>Key points</small>
          <div className="kp">✓ BFS uses a queue<br />✓ DFS uses a stack<br />○ Compare complexity</div>
          <small>Auto-saved to your notes</small>
        </div>
        <div className="c d">
          <div>
            <div className="t">Graph Traversal <span aria-hidden="true">↗</span></div>
            <p><b>03:12</b>Nodes and edges</p>
            <p><b>11:40</b>BFS and queues</p>
          </div>
          <button className="add" onClick={onOpenNotes}>Open notes</button>
        </div>
      </div>

      <p className="sub">Everything you learn from video lectures, stored in one place. Never lose a key idea.</p>
      <button className="cta" onClick={onEnter}>Go to your notes hub →</button>
    </main>
  )
}
