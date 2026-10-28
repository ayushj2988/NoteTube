import Card from '../components/Card.jsx'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { useAsync } from '../useAsync.js'
import { useScene } from '../scene/SceneContext.jsx'
import { Empty, ErrorBox, Loading } from '../components/States.jsx'
import NoteRows from '../components/NoteRows.jsx'

// Import a lecture. Notes are always made. Flashcards and a quiz are optional, and can be added later from the notes page.
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const scene = useScene()
  const notes = useAsync(() => api.listNotes(), [])
  const stats = useAsync(() => api.stats(), [])
  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState(false)
  const [text, setText] = useState('')
  const [flash, setFlash] = useState(false)
  const [quiz, setQuiz] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // a link typed on the landing page before logging in
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem('nt_pending_url')
      if (pending) { setUrl(pending); sessionStorage.removeItem('nt_pending_url') }
    } catch { /* ignore */ }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const body = { extras: { flashcards: flash, quiz } }
      if (paste && text.trim()) body.transcript = text
      if (url.trim()) body.url = url.trim()
      const { id } = await api.createNote(body)
      scene.pulse(1900)
      navigate('/processing/' + id)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const list = notes.data?.notes || []
  const latest = list.find((n) => n.status === 'ready')
  const recent = list.slice(0, 5)

  return (
    <>
      <div className="hd one"><h1>Dashboard</h1><p>Hi {user.name.split(' ')[0]}. Paste a lecture and get notes in a minute.</p></div>

      {latest && (
        <Link className="cd hero" to={`/notes/${latest.id}`}>
          <span className="tg">Continue where you left off</span>
          <h2>{latest.title}</h2>
          <span className="b" style={{ alignSelf: 'flex-start' }}>Open notes</span>
        </Link>
      )}

      <Card as="form" big onSubmit={submit}>
        <h2>Import a lecture</h2>
        <div className="rw">
          <label className="fl" style={{ flex: '1 1 320px' }}><span className="sr">YouTube link</span>
            <input type="url" placeholder="Paste a YouTube link" value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button className="b" type="submit" disabled={busy || (!url.trim() && !text.trim())}>{busy ? 'Starting…' : 'Make notes'}</button>
        </div>
        <div className="rw c" role="group" aria-label="What to make">
          <span className="tg">Notes are always made. Also make:</span>
          <label className="pick"><input type="checkbox" checked={flash} onChange={(e) => setFlash(e.target.checked)} /> Flashcards</label>
          <label className="pick"><input type="checkbox" checked={quiz} onChange={(e) => setQuiz(e.target.checked)} /> Quiz</label>
          <button type="button" className="gh" onClick={() => setPaste(!paste)} aria-expanded={paste}>{paste ? 'Hide transcript box' : 'Paste a transcript instead'}</button>
        </div>
        {paste && (
          <label className="fl">Transcript
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the lecture transcript here (200 characters or more)" />
          </label>
        )}
        {error && <p className="err" role="alert">{error.fields?.url || error.message}</p>}
      </Card>

      <h2>Recent lectures</h2>
      {notes.loading ? <Loading /> : notes.error ? <ErrorBox error={notes.error} onRetry={notes.reload} /> : !recent.length
        ? <Empty title="No lectures yet"><p>Paste your first YouTube link above. You will see the notes here.</p></Empty>
        : <NoteRows notes={recent} />}

      <h2>Study tools</h2>
      <div className="g">
        <Link className="cd" to={latest ? `/notes/${latest.id}/skim` : '/library'}><h2>Skim mode</h2><p>Takeaways in two minutes.</p></Link>
        <Link className="cd" to="/flashcards">{stats.data && <span className="chip y">{stats.data.dueToday} due</span>}<h2>Flashcards</h2><p>Review what is due today.</p></Link>
        <Link className="cd" to="/quiz"><h2>Quiz</h2><p>Test what you just watched.</p></Link>
      </div>
    </>
  )
}