import { useRef, useState } from 'react'
import { useQuizAttempts, useQuizQuestions, useSubmitAttempt } from '../api/queries'
import type { QuizAttempt, QuizQuestion } from '../api/types'
import { errorText } from '../lib/errors'
import { relativeTime } from '../lib/format'
import { useStudyTimer } from '../lib/hooks'
import { EmptyState, ErrorState, Spinner } from './States'

interface Finished {
  questions: QuizQuestion[]
  picked: number[]
  attempt: QuizAttempt | null
  error: string
}

/** One quiz for one note: instant feedback with explanations, a saved attempt, and a "retry the ones I missed" round. */
export default function QuizRunner({ noteId }: { noteId: string }) {
  const qs = useQuizQuestions(noteId)
  const history = useQuizAttempts({ note_id: noteId, limit: 8 })
  const submit = useSubmitAttempt()
  useStudyTimer('quiz', noteId)

  const [subset, setSubset] = useState<QuizQuestion[] | null>(null)
  const [retryOf, setRetryOf] = useState<string | undefined>()
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number[]>([])
  const [chosen, setChosen] = useState<number | null>(null)
  const [done, setDone] = useState<Finished | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  if (qs.isPending) return <Spinner label="Loading quiz" />
  if (qs.isError) return <ErrorState error={qs.error} onRetry={() => void qs.refetch()} />
  const all = qs.data.items
  if (all.length === 0) {
    return <EmptyState icon="?" title="No quiz for this note" body="This note was made without quiz questions. Generate it again with “Quiz questions” switched on." />
  }

  const questions = subset ?? all
  const reset = (next: QuizQuestion[] | null, retry?: string) => {
    setSubset(next)
    setRetryOf(retry)
    setI(0)
    setPicked([])
    setChosen(null)
    setDone(null)
    window.setTimeout(() => heading.current?.focus(), 0)
  }

  const send = (qsList: QuizQuestion[], answers: number[], retry?: string) => {
    setDone({ questions: qsList, picked: answers, attempt: null, error: '' })
    submit.mutate(
      { note_id: noteId, answers: qsList.map((q, k) => ({ question_id: q.id, picked: answers[k] })), retry_of: retry },
      {
        onSuccess: (attempt) => setDone({ questions: qsList, picked: answers, attempt, error: '' }),
        onError: (e) => setDone({ questions: qsList, picked: answers, attempt: null, error: errorText(e) }),
      },
    )
  }

  const choose = (opt: number) => {
    if (chosen !== null) return
    setChosen(opt)
    setPicked((p) => [...p, opt])
  }
  const next = () => {
    if (i + 1 < questions.length) {
      setI(i + 1)
      setChosen(null)
    } else send(questions, picked, retryOf)
  }

  // ----- results -----
  if (done) {
    const score = done.questions.reduce((n, q, k) => n + (done.picked[k] === q.answer_index ? 1 : 0), 0)
    const total = done.questions.length
    const wrong = done.questions.filter((q, k) => done.picked[k] !== q.answer_index)
    const pct = Math.round((score / total) * 100)
    return (
      <div className="quiz">
        <h2 ref={heading} tabIndex={-1}>{retryOf ? 'Retry round' : 'Quiz'} complete: {score} / {total}</h2>
        <p className="quiz-score" aria-label={`${pct} percent`}>{pct}%</p>
        {submit.isPending && <p className="mu" role="status">Saving your result…</p>}
        {done.attempt && <p className="mu" role="status">Result saved.</p>}
        {done.error && (
          <p className="field-error" role="alert">
            Couldn't save this result: {done.error}{' '}
            <button className="link" onClick={() => send(done.questions, done.picked, retryOf)}>Try saving again</button>
          </p>
        )}
        <div className="row start">
          {wrong.length > 0 && <button className="btn" onClick={() => reset(wrong, done.attempt?.id)}>Retry the {wrong.length} I missed</button>}
          <button className="btn dark" onClick={() => reset(null)}>Start over</button>
        </div>
        <ol className="q-review">
          {done.questions.map((q, k) => {
            const ok = done.picked[k] === q.answer_index
            return (
              <li key={q.id} data-ok={ok}>
                <p><b>{k + 1}. {q.question}</b></p>
                <p className="q-ans">
                  <span className="sr-only">{ok ? 'Correct. ' : 'Incorrect. '}</span>
                  Your answer: {q.options[done.picked[k]]}
                  {!ok && <> · Correct: <b>{q.options[q.answer_index]}</b></>}
                </p>
                <p className="mu">{q.explanation}</p>
              </li>
            )
          })}
        </ol>
        <button className="link" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>{showHistory ? 'Hide' : 'Show'} past attempts</button>
        {showHistory && <History attempts={history.data?.items ?? []} loading={history.isPending} />}
      </div>
    )
  }

  // ----- a question -----
  const q = questions[i]
  return (
    <div className="quiz">
      <p className="mu" aria-live="polite">{retryOf ? 'Retry round · ' : ''}Question {i + 1} of {questions.length}</p>
      <div className="meter" aria-hidden="true"><i style={{ width: `${(i / questions.length) * 100}%` }} /></div>
      <h3 ref={heading} tabIndex={-1} key={q.id}>{q.question}</h3>
      <div role="group" aria-label="Answers">
        {q.options.map((o, k) => {
          const state = chosen === null ? '' : k === q.answer_index ? 'ok' : k === chosen ? 'no' : ''
          return (
            <button key={k} className={`opt ${state}`} aria-disabled={chosen !== null} onClick={() => choose(k)}>
              <span className="opt-key" aria-hidden="true">{String.fromCharCode(65 + k)}</span>
              <span>{o}</span>
              {state === 'ok' && <span className="sr-only"> (correct answer)</span>}
              {state === 'no' && <span className="sr-only"> (your answer, incorrect)</span>}
            </button>
          )
        })}
      </div>
      {chosen !== null && (
        <div className="explain" role="status">
          <b>{chosen === q.answer_index ? 'Correct.' : 'Not quite.'}</b> {q.explanation}
        </div>
      )}
      {chosen !== null && <button className="btn dark" onClick={next} autoFocus>{i + 1 < questions.length ? 'Next question' : 'See results'}</button>}
    </div>
  )
}

export function History({ attempts, loading }: { attempts: QuizAttempt[]; loading?: boolean }) {
  if (loading) return <Spinner label="Loading history" />
  if (attempts.length === 0) return <p className="mu">No attempts yet.</p>
  return (
    <ul className="history">
      {attempts.map((a) => (
        <li key={a.id}>
          <b>{a.score} / {a.total}</b>
          <span>{Math.round((a.score / a.total) * 100)}%{a.retry_of ? ' · retry round' : ''}</span>
          <span className="mu">{relativeTime(a.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}
