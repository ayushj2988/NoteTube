import { Link, useSearchParams } from 'react-router-dom'
import { useStats } from '../api/queries'
import { formatMinutes } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import BarChart from '../ui/BarChart'
import PageHeader from '../ui/PageHeader'
import { EmptyState, ErrorState, Skeleton } from '../ui/States'

export default function Progress() {
  useDocumentTitle('Progress')
  const [params, setParams] = useSearchParams()
  const range: 7 | 30 = params.get('range') === '30' ? 30 : 7
  const q = useStats(range)
  const s = q.data
  const fresh = !!s && s.minutes_total === 0 && s.notes_total === 0 && s.quiz_attempts === 0

  return (
    <section className="view" aria-labelledby="pr-title">
      <PageHeader id="pr-title" title="Progress" sub="Calculated from the time you actually spend reading, reviewing and quizzing." />
      <div className="chips" role="group" aria-label="Time range">
        <button aria-pressed={range === 7} onClick={() => setParams({}, { replace: true })}>Last 7 days</button>
        <button aria-pressed={range === 30} onClick={() => setParams({ range: '30' }, { replace: true })}>Last 30 days</button>
      </div>

      {q.isPending && <Skeleton h={300} r={20} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {fresh && (
        <EmptyState icon="◔" title="Nothing to chart yet" body="Create a note, then read it, review its flashcards or take its quiz. Your progress builds up here.">
          <Link className="btn" to="/app/notes/new">Create a note</Link>
        </EmptyState>
      )}
      {s && !fresh && (
        <>
          <div className="stat-tiles">
            <div className="gl dense tile"><b>{formatMinutes(s.minutes_total)}</b><span>studied</span></div>
            <div className="gl dense tile"><b>{s.streak_days}</b><span>day streak</span></div>
            <div className="gl dense tile"><b>{s.quiz_average === null ? '–' : `${Math.round(s.quiz_average)}%`}</b><span>quiz average{s.quiz_attempts ? ` (${s.quiz_attempts})` : ''}</span></div>
            <div className="gl dense tile"><b>{s.cards_due}</b><span>of {s.cards_total} cards due</span></div>
            <div className="gl dense tile"><b>{s.notes_total}</b><span>notes</span></div>
          </div>

          <div className="gl dense stats">
            <h2>Study time</h2>
            {s.minutes_total === 0 ? <p className="mu stats-empty">No study time in this range.</p> : <BarChart days={s.days} />}
          </div>

          <div className="gl dense stats">
            <h2>Mastery by subject</h2>
            {s.mastery.length === 0 ? (
              <p className="mu">Mastery appears once a note has a subject and you've reviewed its cards or taken its quiz. Set a subject on any note.</p>
            ) : (
              <ul className="mastery">
                {s.mastery.map((m) => (
                  <li key={m.subject}>
                    <div className="row between"><b>{m.subject}</b><span className="mu">{m.percent}% · {m.cards} cards</span></div>
                    <div className="meter" role="progressbar" aria-label={`${m.subject} mastery`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.percent}><i style={{ width: `${m.percent}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
