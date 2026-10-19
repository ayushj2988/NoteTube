import { Link } from 'react-router-dom'
import { useDocumentTitle } from '../lib/hooks'
import { EmptyState } from '../ui/States'

export default function NotFound({ inApp = false }: { inApp?: boolean }) {
  useDocumentTitle('Page not found')
  const body = (
    <EmptyState icon="?" title="Page not found" body="That page doesn't exist, or it moved.">
      <Link className="btn" to={inApp ? '/app' : '/'}>{inApp ? 'Back to home' : 'Go to NoteTube'}</Link>
    </EmptyState>
  )
  return inApp ? <section className="view">{body}</section> : <div className="fullscreen">{body}</div>
}
