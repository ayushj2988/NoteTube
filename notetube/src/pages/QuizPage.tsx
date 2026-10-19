import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useNote } from '../api/queries'
import { useDocumentTitle } from '../lib/hooks'
import PageHeader from '../ui/PageHeader'
import QuizRunner from '../ui/QuizRunner'
import { EmptyState, ErrorState, Skeleton } from '../ui/States'

export default function QuizPage() {
  const { noteId = '' } = useParams()
  const note = useNote(noteId)
  useDocumentTitle(note.data ? `Quiz: ${note.data.title}` : 'Quiz')

  if (note.isPending) return <section className="view"><Skeleton h={36} w="50%" /><div style={{ height: 14 }} /><Skeleton h={260} r={20} /></section>
  if (note.isError) {
    const gone = note.error instanceof ApiError && note.error.status === 404
    return (
      <section className="view">
        {gone ? (
          <EmptyState icon="?" title="Quiz not found" body="That note may have been deleted.">
            <Link className="btn" to="/app/quizzes">All quizzes</Link>
          </EmptyState>
        ) : (
          <ErrorState error={note.error} onRetry={() => void note.refetch()} />
        )}
      </section>
    )
  }
  return (
    <section className="view" aria-labelledby="qp-title">
      <Link className="back" to="/app/quizzes">← Quizzes</Link>
      <PageHeader id="qp-title" title={note.data.title} sub={<Link className="link" to={`/app/notes/${noteId}`}>Open the notes</Link>} />
      <div className="gl dense pane">
        <QuizRunner noteId={noteId} />
      </div>
    </section>
  )
}
