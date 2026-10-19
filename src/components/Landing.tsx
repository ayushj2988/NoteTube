import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import LiquidLayer from './LiquidLayer'
import { skyState } from '../scene/skyState'

/** Marketing page. The three sample cards are illustration, not user data. */
export default function Landing() {
  const nav = useNavigate()
  const { user, status } = useAuth()
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
        <LiquidLayer radius={99} blur={0.2} displacement={30} />
        <span className="logo"><i aria-hidden="true" />NoteTube</span>
        <button className="login" onClick={() => nav(user ? '/app' : '/login')} disabled={status === 'loading'}>
          {user ? 'Open app' : 'Log in'}
        </button>
      </nav>

      <h1 className="land-h1">
        <span>Place for your</span>
        <span className="l2">lectures, notes</span>
        <span className="l3">and flashcards</span>
      </h1>

      <div className="cards" ref={cards}>
        <div className="c a">
          <span>Turn any lecture into notes, flashcards and quizzes in one app <span aria-hidden="true">✎</span></span>
          <button className="add" onClick={() => nav('/app/notes/new')}><span aria-hidden="true">🔗</span> Paste YouTube link</button>
        </div>
        <div className="c b" aria-label="Example of key points">
          <span className="ic" aria-hidden="true">✎</span>
          <small>Key points</small>
          <div className="kp">✓ BFS uses a queue<br />✓ DFS uses a stack<br />○ Compare complexity</div>
          <small>Auto-saved to your notes</small>
        </div>
        <div className="c d" aria-label="Example of a note with timestamps">
          <div>
            <div className="t">Graph Traversal <span aria-hidden="true">↗</span></div>
            <p><b>03:12</b>Nodes and edges</p>
            <p><b>11:40</b>BFS and queues</p>
          </div>
          <button className="add" onClick={() => nav('/app/library')}>Open your notes</button>
        </div>
      </div>

      <p className="sub">Everything you learn from video lectures, stored in one place. Never lose a key idea.</p>
      <button className="cta" onClick={() => nav('/app')}>Go to your notes hub →</button>
    </main>
  )
}
