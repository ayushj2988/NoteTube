import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAsync } from '../useAsync.js'
import { ErrorBox, Loading } from '../components/States.jsx'
import { mmss } from '../format.jsx'

// Two-minute version of a note: summary, takeaways, definitions and an outline.
export default function Skim() {
  const { id } = useParams()
  const { data, error, loading, reload } = useAsync(() => api.getNote(id), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const n = data.note
  return (
    <>
      <div className="hd"><h1>Skim: {n.title}</h1><Link className="b" to={`/notes/${id}`}>← Back to full notes</Link></div>
      <div className="cd pad paper skim" style={{ gap: 18 }}>
        <span className="tg">In short</span>
        <p className="pp" style={{ color: '#17140f', fontSize: 18 }}>{n.summary || 'No summary yet.'}</p>
        {!!n.takeaways.length && (
          <div className="nr"><span className="tg">Takeaways</span><p>{n.takeaways.map((t, i) => <span key={i}>{i + 1}. {t}<br /></span>)}</p></div>
        )}
        {!!n.definitions.length && (
          <div className="nr"><span className="tg">Definitions</span><p>{n.definitions.map((d, i) => <span key={i}><b>{d.term}:</b> {d.def}<br /></span>)}</p></div>
        )}
        <div className="nr">
          <span className="tg">Outline</span>
          <p>{n.sections.map((s) => <span key={s.id}>{s.ts != null && <Link className="ts" to={`/notes/${id}`}>{mmss(s.ts)}</Link>} {s.title}<br /></span>)}</p>
        </div>
      </div>
      <Link className="b" style={{ alignSelf: 'flex-start' }} to={`/notes/${id}`}>Back to full notes</Link>
    </>
  )
}
