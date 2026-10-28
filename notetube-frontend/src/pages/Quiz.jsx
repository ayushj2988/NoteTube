import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAsync } from '../useAsync.js'
import { Empty, ErrorBox, Loading } from '../components/States.jsx'

// One question at a time. Pick an answer, see right or wrong with the reason, then the next one. The score is saved at the end.
export default function Quiz() {
  const [params, setParams] = useSearchParams()
  const quizzes = useAsync(() => api.quizzes(), [])
  const list = quizzes.data?.quizzes || []
  const noteId = params.get('note') || list[0]?.noteId
  const quiz = useAsync(() => (noteId ? api.quiz(noteId) : Promise.resolve({ questions: [] })), [noteId])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  const reset = () => { setI(0); setPicked(null); setAnswers([]); setResult(null); setErr('') }
  useEffect(reset, [noteId])

  if (quizzes.loading) return <Loading />
  if (quizzes.error) return <ErrorBox error={quizzes.error} onRetry={quizzes.reload} />
  if (!list.length) {
    return (
      <>
        <div className="hd"><h1>Quiz</h1></div>
        <Empty title="No quiz yet">
          <p>Open a note and press “Make quiz” to get questions from it.</p>
          <Link className="b" style={{ alignSelf: 'flex-start' }} to="/library">Go to my notes</Link>
        </Empty>
      </>
    )
  }

  const qs = quiz.data?.questions || []
  const q = qs[i]
  const choose = (n) => { if (picked === null) setPicked(n) }
  const next = async () => {
    const all = [...answers, { questionId: q.id, picked }]
    if (i < qs.length - 1) { setAnswers(all); setI(i + 1); setPicked(null); return }
    try {
      const r = await api.submitAttempt(noteId, all)
      setAnswers(all)
      setResult(r.attempt)
      quizzes.reload()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <>
      <div className="hd"><h1>Quiz</h1></div>
      <div className="rw c" role="group" aria-label="Quizzes">
        {list.map((d) => (
          <button key={d.noteId} className={'ck' + (d.noteId === noteId ? ' on' : '')} aria-pressed={d.noteId === noteId} onClick={() => setParams({ note: d.noteId })}>
            {d.title}{d.lastScore ? ` · last ${d.lastScore.score}/${d.lastScore.total}` : ''}
          </button>
        ))}
      </div>

      {quiz.loading ? <Loading /> : quiz.error ? <ErrorBox error={quiz.error} onRetry={quiz.reload} /> : result ? (
        <div className="cd pad" style={{ gap: 14 }}>
          <span className="tg">Your score</span>
          <span className="big" style={{ color: result.score === result.total ? 'var(--gr)' : 'var(--fg)' }}>{result.score}/{result.total}</span>
          {result.mistakes.length ? <p>To revise: {[...new Set(result.mistakes.map((m) => m.topic))].join(', ')}.</p> : <p>Perfect. Nothing to revise.</p>}
          <div className="rw"><button className="b" onClick={reset}>Try again</button><Link className="b o" to="/progress">See progress</Link></div>
        </div>
      ) : q && (
        <div className="cd pad paper" style={{ gap: 16 }}>
          <span className="tg" role="status">Question {i + 1} of {qs.length}</span>
          <h2 style={{ fontSize: 26 }}>{q.question}</h2>
          <div className="op">
            {q.options.map((o, n) => {
              const state = picked === null ? '' : n === q.answerIndex ? ' ok' : n === picked ? ' no' : ''
              return <button key={n} className={'cd opt' + state} data-l={'ABCD'[n]} disabled={picked !== null} onClick={() => choose(n)}>{o}</button>
            })}
          </div>
          {picked !== null && (
            <div className="cd" role="status">
              <span className={'chip ' + (picked === q.answerIndex ? 'g' : 'w')}>{picked === q.answerIndex ? 'Correct' : 'Not quite'}</span>
              <p>{q.explanation}</p>
            </div>
          )}
          {picked !== null && <button className="b" style={{ alignSelf: 'flex-start' }} onClick={next}>{i < qs.length - 1 ? 'Next question' : 'See my score'}</button>}
          {err && <p className="err" role="alert">{err}</p>}
        </div>
      )}
    </>
  )
}
