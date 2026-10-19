import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDueCount, useNotes, useStats } from '../api/queries'
import LiquidLayer from '../components/LiquidLayer'
import { friendlyMessage } from '../lib/errors'
import { formatMinutes } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { isYouTubeUrl } from '../lib/youtube'
import BarChart from '../ui/BarChart'
import { EmptyState, ErrorState, Skeleton, SkeletonList } from '../ui/States'
import NoteCard from '../ui/NoteCard'
import PageHeader from '../ui/PageHeader'
import TranscriptField from '../ui/TranscriptField'

export default function Home() {
  useDocumentTitle('Home')
  const nav = useNavigate()
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [error, setError] = useState('')

  const recent = useNotes({ limit: 3, sort: 'recent' })
  const latest = useNotes({ limit: 1, sort: 'recent', status: 'ready' })
  const stats = useStats(7)
  const due = useDueCount().data?.due_count ?? 0

  const generate = (e: FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    if (!u && !transcript.trim()) return setError('Paste a YouTube link or a transcript first.')
    if (u && !isYouTubeUrl(u)) return setError(friendlyMessage('INVALID_URL'))
    setError('')
    nav('/app/notes/new', { state: { url: u, transcript } })
  }

  const first = latest.data?.items[0]
  const quick = [
    { to: first ? `/app/notes/${first.id}` : '/app/notes/new', icon: '✎', title: 'AI Notes', sub: first ? 'Open your latest notes' : 'Create your first note' },
    { to: first ? `/app/notes/${first.id}?tab=skim` : '/app/notes/new', icon: '⚡', title: 'Skim Mode', sub: 'Five-minute recap' },
    { to: '/app/flashcards', icon: '◧', title: 'Flashcards', sub: due > 0 ? `${due} due now` : 'Spaced review' },
    { to: '/app/quizzes', icon: '?', title: 'Quiz Me', sub: 'Test recall' },
  ]

  const s = stats.data
  const hasStudy = !!s && s.minutes_total > 0

  return (
    <section className="view" aria-labelledby="home-title">
      <PageHeader id="home-title" title={<>Turn lectures into <span>notes.</span></>} sub="Paste a YouTube lecture. Get structured notes, flashcards and quizzes." />

      <form className="gl hero liquid" onSubmit={generate} noValidate>
        <LiquidLayer radius={20} blur={0.25} displacement={32} />
        <div className="urlrow">
          <input aria-label="YouTube URL" placeholder="https://youtube.com/watch?v=…" value={url} inputMode="url" onChange={(e) => { setUrl(e.target.value); setError('') }} aria-invalid={!!error} aria-describedby="home-err" />
          <button className="btn" type="submit">Generate Notes</button>
        </div>
        <p id="home-err" className="nerr" role="alert">{error}</p>
        <button type="button" className="link" aria-expanded={showTranscript} onClick={() => setShowTranscript((v) => !v)}>
          + Or paste / upload a transcript
        </button>
        {showTranscript && <TranscriptField value={transcript} onChange={setTranscript} />}
      </form>

      <div className="grid4">
        {quick.map((q) => (
          <Link key={q.title} to={q.to} className="gl lift qc">
            <div className="ico" aria-hidden="true">{q.icon}</div>
            <b>{q.title}</b>
            <span>{q.sub}</span>
          </Link>
        ))}
      </div>

      <div className="cols">
        <div>
          <h2>Recent notes</h2>
          {recent.isPending && <SkeletonList rows={3} tall label="Loading recent notes" />}
          {recent.isError && <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />}
          {recent.data && recent.data.items.length === 0 && (
            <EmptyState icon="✎" title="No notes yet" body="Paste a lecture link above and your first notes will show up here.">
              <Link className="btn" to="/app/notes/new">Create your first note</Link>
            </EmptyState>
          )}
          {recent.data && recent.data.items.length > 0 && (
            <div className="recent">
              {recent.data.items.map((n) => <NoteCard key={n.id} note={n} />)}
              {recent.data.total > 3 && <Link className="link" to="/app/library">See all {recent.data.total} notes</Link>}
            </div>
          )}
        </div>

        <div className="gl dense stats">
          <h2>This week</h2>
          {stats.isPending && <Skeleton h={120} r={12} />}
          {stats.isError && <ErrorState title="Couldn't load your week" error={stats.error} onRetry={() => void stats.refetch()} />}
          {s && !hasStudy && <p className="mu stats-empty">No study time yet. Open a note or review a card and it shows up here.</p>}
          {s && hasStudy && <BarChart days={s.days} />}
          {s && (
            <div className="big">
              <div><b>{formatMinutes(s.minutes_total)}</b><span>studied</span></div>
              <div><b>{s.cards_due}</b><span>cards due</span></div>
              <div><b>{s.quiz_average === null ? '–' : `${Math.round(s.quiz_average)}%`}</b><span>quiz avg</span></div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
