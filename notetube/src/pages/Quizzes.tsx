import { Link } from 'react-router-dom'
import { useNotes, useQuizAttempts } from '../api/queries'
import { relativeTime } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import PageHeader from '../ui/PageHeader'
import { EmptyState, ErrorState, SkeletonList } from '../ui/States'

export default function Quizzes() {
  useDocumentTitle('Quizzes')
  const notes = useNotes({ has_quiz: true, status: 'ready', limit: 100, sort: 'recent' })
  const attempts = useQuizAttempts({ limit: 50 })

  const latest = new Map<string, { score: number; total: number; at: string }>()
  for (const a of attempts.data?.items ?? []) if (!latest.has(a.note_id)) latest.set(a.note_id, { score: a.score, total: a.total, at: a.created_at })

  return (
    <section className="view" aria-labelledby="qz-title">
      <PageHeader id="qz-title" title="Quizzes" sub="Test what you remember. Every attempt is saved so you can watch yourself improve." />

      {notes.isPending && <SkeletonList rows={3} label="Loading quizzes" />}
      {notes.isError && <ErrorState error={notes.error} onRetry={() => void notes.refetch()} />}
      {notes.data && notes.data.items.length === 0 && (
        <EmptyState icon="?" title="No quizzes yet" body="Quizzes come with your notes. Generate a note with “Quiz questions” switched on.">
          <Link className="btn" to="/app/notes/new">Create a note</Link>
        </EmptyState>
      )}
      {notes.data && notes.data.items.length > 0 && (
        <ul className="deck-list">
          {notes.data.items.map((n) => {
            const l = latest.get(n.id)
            return (
              <li key={n.id} className="gl dense deck">
                <div className="deck-info">
                  <b>{n.title}</b>
                  <span className="mu">
                    {n.question_count} questions
                    {l ? ` · last score ${l.score}/${l.total} (${Math.round((l.score / l.total) * 100)}%), ${relativeTime(l.at)}` : ' · not taken yet'}
                  </span>
                </div>
                <Link className="btn btn-sm" to={`/app/quizzes/${n.id}`}>{l ? 'Take again' : 'Start'}</Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
