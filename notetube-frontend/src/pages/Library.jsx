import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useAsync } from '../useAsync.js'
import { Empty, ErrorBox, Loading } from '../components/States.jsx'
import NoteRows from '../components/NoteRows.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

// Search and filter every saved note. The search waits a moment after typing so the server is not asked on every key.
export default function Library() {
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setTerm(q), 250)
    return () => clearTimeout(t)
  }, [q])
  const all = useAsync(() => api.listNotes(), [])
  const found = useAsync(() => api.listNotes({ q: term, subject }), [term, subject])
  const subjects = [...new Set((all.data?.notes || []).map((n) => n.subject))].sort()

  const [target, setTarget] = useState(null)   // the note waiting for a delete confirmation
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState('')
  const remove = async () => {
    setDeleting(true)
    setDelError('')
    try {
      await api.deleteNote(target.id)
      setTarget(null)
      all.reload()
      found.reload()
    } catch (e) {
      setDelError(e.message)
    }
    setDeleting(false)
  }

  return (
    <>
      <div className="hd"><h1>Notes library</h1></div>
      <div className="rw">
        <label className="fl" style={{ flex: '1 1 260px' }}><span>Search</span><input type="search" placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="fl" style={{ flex: '0 1 220px' }}><span>Subject</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {found.loading ? <Loading /> : found.error ? <ErrorBox error={found.error} onRetry={found.reload} /> : !found.data.notes.length
        ? <Empty title={term || subject ? 'No notes match' : 'No notes yet'}><p>{term || subject ? 'Try a different search.' : 'Paste a YouTube link on the dashboard to make your first notes.'}</p>{!term && !subject && <Link className="b" style={{ alignSelf: 'flex-start' }} to="/dashboard">Go to dashboard</Link>}</Empty>
        : <NoteRows notes={found.data.notes} onDelete={(n) => { setDelError(''); setTarget(n) }} />}
      {delError && !target && <p className="err" role="alert">{delError}</p>}
      <ConfirmDialog open={!!target} title="Delete these notes?" busy={deleting} onCancel={() => setTarget(null)} onConfirm={remove}>
        “{target?.title}” and its flashcards and quiz will be gone for good.{delError && <b className="err"> {delError}</b>}
      </ConfirmDialog>
    </>
  )
}