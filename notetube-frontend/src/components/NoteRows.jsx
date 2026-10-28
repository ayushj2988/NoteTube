import { Link } from 'react-router-dom'
import { ago, chipFor } from '../format.jsx'

const where = (n) => (n.status === 'ready' ? `/notes/${n.id}` : `/processing/${n.id}`)

// The list of lectures used on the dashboard and in the library. Pass onDelete to show a delete button on each row.
export default function NoteRows({ notes, onDelete }) {
  return (
    <div className="cd lst">
      {notes.map((n) => (
        <div key={n.id} className="rowi">
          <span className={'chip ' + chipFor(n.subject)}>{n.subject}</span>
          <Link className="rt" to={where(n)}>{n.title}{n.status === 'failed' ? ' (failed)' : n.status !== 'ready' ? ' (making notes…)' : ''}</Link>
          <span className="rm">{ago(n.createdAt)}</span>
          <div className="bar sm" aria-hidden="true"><i style={{ width: n.status === 'ready' ? '100%' : (n.progress?.notes ?? 0) + '%' }} /></div>
          {onDelete ? <button className="x" aria-label={`Delete ${n.title}`} onClick={() => onDelete(n)}>×</button> : <span />}
        </div>
      ))}
    </div>
  )
}
