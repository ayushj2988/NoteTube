import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import { useAsync } from '../useAsync.js'
import { useScene } from '../scene/SceneContext.jsx'
import { ErrorBox, Loading } from '../components/States.jsx'

// Live progress for one lecture. It asks the server every 1.5 seconds. The dots gather into a notes page as the work moves along.
export default function Processing() {
  const { id } = useParams()
  const navigate = useNavigate()
  const scene = useScene()
  const [polling, setPolling] = useState(1500)
  const { data, error, loading, reload } = useAsync(() => api.getNote(id), [id], polling)
  const note = data?.note
  const [paste, setPaste] = useState(false)
  const [text, setText] = useState('')
  const [retryError, setRetryError] = useState('')

  const asked = note && (note.extras.flashcards !== 'none' || note.extras.quiz !== 'none')
  const extrasBusy = note && (note.extras.flashcards === 'processing' || note.extras.quiz === 'processing')
  const done = note && note.status === 'ready' && !extrasBusy

  useEffect(() => {
    if (!note) return
    const p = note.progress
    scene.state.procP = note.status === 'ready' ? 1 : Math.min(0.95, (p.transcript * 0.3 + p.notes * 0.7) / 100)
    // flashcards / quiz asked for: once the notes are ready, the sheet splits into cards as they are made
    const asked = note.extras.flashcards !== 'none' || note.extras.quiz !== 'none'
    const made = note.extras.flashcards === 'ready' || note.extras.quiz === 'ready'
    scene.state.procQ = !asked || note.status !== 'ready' ? 0 : made && !extrasBusy ? 1 : Math.min(0.9, (p.extras || 10) / 100)
    if (note.status === 'failed' || done) setPolling(0)
    else setPolling(1500)
  }, [note, done, scene])
  useEffect(() => () => { scene.state.procP = 0; scene.state.procQ = 0 }, [scene])

  const retry = async (withText) => {
    setRetryError('')
    try {
      await api.retryNote(id, withText)
      setPaste(false)
      setPolling(1500)
      reload()
    } catch (e) {
      setRetryError(e.message)
    }
  }

  if (loading && !note) return <Loading label="Starting…" />
  if (error && !note) return <ErrorBox error={error} onRetry={reload} />
  const p = note.progress

  return (
    <>
      <div className="hd one"><h1>{note.status === 'ready' ? 'Your notes are ready' : 'Making your notes'}</h1><p>{note.status === 'ready' || note.title !== 'New lecture' ? note.title : 'Reading the lecture'}</p></div>

      <div className="cd" aria-live="polite">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Step label="Transcript fetched" value={p.transcript} />
          <Step label="Structuring notes" value={p.notes} />
          {asked && <Step label={`${[note.extras.flashcards !== 'none' && 'Flashcards', note.extras.quiz !== 'none' && 'Quiz'].filter(Boolean).join(' and ')}`} value={note.extras.flashcards === 'ready' || note.extras.quiz === 'ready' ? 100 : p.extras} />}
        </div>
      </div>

      {note.status === 'failed' && (
        <div className="cd" role="alert">
          <span className="chip w">Failed</span>
          <h2>{note.error?.code === 'NO_CAPTIONS' ? 'Transcript unavailable' : 'The notes could not be made'}</h2>
          <p>{note.error?.message}</p>
          <div className="rw">
            <button className="b" onClick={() => retry()}>Retry</button>
            <button className="b o" onClick={() => setPaste(!paste)} aria-expanded={paste}>Paste transcript</button>
          </div>
          {paste && (
            <>
              <label className="fl">Transcript<textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the lecture transcript (200 characters or more)" /></label>
              <button className="b" style={{ alignSelf: 'flex-start' }} disabled={text.trim().length < 200} onClick={() => retry(text)}>Make notes from this</button>
            </>
          )}
          {retryError && <p className="err">{retryError}</p>}
        </div>
      )}

      {note.status === 'ready' && (
        <div className="rw">
          <button className="b" onClick={() => navigate(`/notes/${id}`)}>Open your notes</button>
          {extrasBusy && <span className="tg" role="status">Flashcards and quiz are still being made. You can open the notes now.</span>}
        </div>
      )}
      {note.status !== 'ready' && note.status !== 'failed' && <p className="tg" role="status">This takes under a minute. You can leave this page; it keeps going. <Link to="/dashboard" style={{ textDecoration: 'underline' }}>Back to dashboard</Link></p>}
    </>
  )
}

function Step({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="tg">{label}</span>
      <div className="bar" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{ width: value + '%' }} /></div>
    </div>
  )
}