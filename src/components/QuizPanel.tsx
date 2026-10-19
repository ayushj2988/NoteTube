import { useState } from 'react'
import { QUESTIONS } from '../lib/data'

export default function QuizPanel() {
  const [qi, setQi] = useState(0)
  const [score, setScore] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)

  if (qi >= QUESTIONS.length) {
    return (
      <div>
        <h3>Done! You scored {score} / {QUESTIONS.length}</h3>
        <button className="btn dark" onClick={() => { setQi(0); setScore(0); setPicked(null) }}>Try again</button>
      </div>
    )
  }

  const q = QUESTIONS[qi]
  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i === q.answer) setScore((s) => s + 1)
  }

  return (
    <div>
      <p className="mu">Question {qi + 1} of {QUESTIONS.length}</p>
      <h3>{q.q}</h3>
      {q.options.map((o, i) => {
        const state = picked === null ? '' : i === q.answer ? 'ok' : i === picked ? 'no' : ''
        return (
          <button key={o} className={`opt ${state}`} onClick={() => choose(i)} aria-disabled={picked !== null}>
            {o}
            {state === 'ok' && <span className="sr-only"> (correct)</span>}
            {state === 'no' && <span className="sr-only"> (incorrect)</span>}
          </button>
        )
      })}
      {picked !== null && (
        <button className="btn dark" onClick={() => { setQi(qi + 1); setPicked(null) }}>
          {qi + 1 < QUESTIONS.length ? 'Next' : 'Finish'}
        </button>
      )}
    </div>
  )
}
