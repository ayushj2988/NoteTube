import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useScene } from '../scene/SceneContext.jsx'
import { api } from '../api.js'
import { useAsync } from '../useAsync.js'
import { Empty, ErrorBox, Loading } from '../components/States.jsx'
import { chipFor, mmss, withHighlights } from '../format.jsx'

// The notes workspace: the video and the study tools on the left, the notes on the right.
// Timestamps jump the video. Edit, Highlight and Add note change the text and save it to the server.
export default function Notes() {
  const { id } = useParams()
  const [poll, setPoll] = useState(0)
  const { data, error, loading, reload, setData } = useAsync(() => api.getNote(id), [id], poll)
  const note = data?.note
  const [start, setStart] = useState(null)   // null: video not started; a number: playing from that second
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const sel = useRef(null)

  const extrasBusy = note && (note.extras.flashcards === 'processing' || note.extras.quiz === 'processing')
  useEffect(() => { setPoll(extrasBusy ? 1500 : 0) }, [extrasBusy])

  // while flashcards or a quiz are being made, the dots turn into the notes sheet and then split into cards
  const scene = useScene()
  const extrasP = note ? note.progress.extras : 0
  useEffect(() => {
    if (extrasBusy) {
      scene.state.extra = Math.min(0.9, Math.max(0.15, extrasP / 100))
      return undefined
    }
    if (scene.state.extra === null) return undefined
    scene.state.extra = 1                                  // finished: show the cards for a moment, then relax
    const t = setTimeout(() => { scene.state.extra = null }, 2500)
    return () => clearTimeout(t)
  }, [extrasBusy, extrasP, scene])
  useEffect(() => () => { scene.state.extra = null }, [scene])

  if (loading && !note) return <Loading label="Opening notes…" />
  if (error && !note) return <ErrorBox error={error} onRetry={reload} />
  if (note.status !== 'ready') {
    return (
      <Empty title={note.status === 'failed' ? 'These notes failed' : 'Still making these notes'}>
        <p>{note.status === 'failed' ? note.error?.message : 'It should only take a moment.'}</p>
        <Link className="b" style={{ alignSelf: 'flex-start' }} to={`/processing/${id}`}>See progress</Link>
      </Empty>
    )
  }

  const toDraft = (s) => ({ ...s, tsText: s.ts != null ? mmss(s.ts) : '' })
  const startEdit = () => { setDraft(note.sections.map(toDraft)); setTitle(note.title); setEditing(true); setMsg(null) }
  const cancel = () => { setEditing(false); setMsg(null) }
  const save = async () => {
    // timestamps are typed as 1:05 or 1:02:03 (or plain seconds); empty means no timestamp
    const sections = []
    for (const d of draft) {
      if (!d.title.trim() && !d.body.trim()) continue
      const ts = parseTs(d.tsText)
      if (Number.isNaN(ts)) return setMsg({ ok: false, text: `“${d.tsText}” is not a time. Use minutes:seconds, like 12:30.` })
      const { tsText, ...rest } = d
      void tsText
      sections.push({ ...rest, ts })
    }
    setSaving(true)
    setMsg(null)
    try {
      const r = await api.updateNote(id, { title, sections })
      setData(r)
      setEditing(false)
      setMsg({ ok: true, text: 'Saved.' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
    setSaving(false)
  }
  const edit = (i, key) => (e) => setDraft((d) => d.map((s, j) => (j === i ? { ...s, [key]: e.target.value } : s)))
  const remember = (i) => (e) => { sel.current = { i, start: e.target.selectionStart, end: e.target.selectionEnd } }
  const highlight = () => {
    const s = sel.current
    if (!s || s.start === s.end) return setMsg({ ok: false, text: 'Select some words inside a note first, then press Highlight.' })
    setDraft((d) => d.map((x, j) => {
      if (j !== s.i) return x
      const picked = x.body.slice(s.start, s.end)
      // pressing Highlight on an already highlighted piece removes the marks
      const next = picked.startsWith('==') && picked.endsWith('==') ? picked.slice(2, -2) : `==${picked}==`
      return { ...x, body: x.body.slice(0, s.start) + next + x.body.slice(s.end) }
    }))
    setMsg(null)
  }
  const addNote = () => {
    if (!editing) startEdit()
    setDraft((d) => [...(editing ? d : note.sections.map(toDraft)), { id: 'new' + Date.now(), ts: null, tsText: '', title: '', body: '' }])
  }
  const removeSection = (i) => setDraft((d) => d.filter((_, j) => j !== i))

  const makeExtras = async (flashcards, quiz) => {
    setMsg(null)
    try {
      await api.makeExtras(id, flashcards, quiz)
      setData({ note: { ...note, extras: { flashcards: flashcards ? 'processing' : note.extras.flashcards, quiz: quiz ? 'processing' : note.extras.quiz } } })
      setPoll(1500)
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
  }

  const rows = editing ? draft : note.sections

  return (
    <>
      <div className="hd">
        <div>
          <span className={'chip ' + chipFor(note.subject)}>{note.subject}</span>
          {editing ? <label className="fl" style={{ marginTop: 8 }}><span className="sr">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: 22 }} /></label> : <h1>{note.title}</h1>}
          <p style={{ margin: '6px 0 0', color: 'var(--mu)', fontSize: 14 }}>{note.durationSec ? `${mmss(note.durationSec)} long · ` : ''}{note.sections.length} sections</p>
        </div>
        <div className="tools">
          <Link className="b sm" to={`/notes/${id}/skim`}>Skim mode</Link>
          {editing ? (
            <>
              <button className="b sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="b o sm" onClick={cancel} disabled={saving}>Cancel</button>
            </>
          ) : <button className="b o sm" onClick={startEdit}>Edit notes</button>}
          <button className="b o sm" onClick={highlight} disabled={!editing} title={editing ? 'Select words in a note, then press this' : 'Press Edit notes first'}>Highlight</button>
          <button className="b o sm" onClick={addNote}>Add note</button>
        </div>
      </div>
      {msg && <p className={'msg ' + (msg.ok ? 'ok' : 'bad')} role="status">{msg.text}</p>}
      {editing && <p className="tg">Select words inside a note and press Highlight. Highlighted words sit between == marks.</p>}

      <div className="nw">
        <div className="left">
          <Video note={note} start={start} />
          <div className="cd">
            <h2>Study tools</h2>
            <p>Notes are done. Make flashcards or a quiz from them whenever you want.</p>
            <Extra label="Flashcards" status={note.extras.flashcards} onMake={() => makeExtras(true, false)} to={`/flashcards?note=${id}`} open="Study flashcards" />
            <Extra label="Quiz" status={note.extras.quiz} onMake={() => makeExtras(false, true)} to={`/quiz?note=${id}`} open="Take the quiz" />
          </div>
        </div>

        <div className="cd pad paper">
          {!rows.length && <p>There are no notes yet. Press Add note.</p>}
          {rows.map((s, i) => (
            <div className="nr" key={s.id || i}>
              {editing ? (
                <label className="fl" style={{ flex: 'none' }}><span>Time</span><input value={s.tsText} onChange={edit(i, 'tsText')} placeholder="12:30" inputMode="numeric" aria-label="Timestamp (optional), like 12:30" /></label>
              ) : s.ts != null && note.youtubeId ? <button className="ts" onClick={() => setStart(s.ts)} aria-label={`Jump the video to ${mmss(s.ts)}`}>{mmss(s.ts)}</button> : <span className="ts" aria-hidden="true" style={{ visibility: s.ts != null ? 'visible' : 'hidden' }}>{s.ts != null ? mmss(s.ts) : '00:00'}</span>}
              {editing ? (
                <div>
                  <input value={s.title} onChange={edit(i, 'title')} placeholder="Heading" aria-label="Heading" />
                  <textarea value={s.body} onChange={edit(i, 'body')} onSelect={remember(i)} onBlur={remember(i)} placeholder="Write the note" aria-label="Note text" />
                  <button className="gh" onClick={() => removeSection(i)}>Remove this note</button>
                </div>
              ) : (
                <div>
                  <h3>{s.title}</h3>
                  <p>{withHighlights(s.body)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// "12:30" or "1:02:03" or "90" becomes seconds. Empty becomes null. Anything else becomes NaN.
function parseTs(text) {
  const t = String(text || '').trim()
  if (!t) return null
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return NaN
  return t.split(':').reduce((a, p) => a * 60 + Number(p), 0)
}

function Extra({ label, status, onMake, to, open }) {
  return (
    <div className="rw c" style={{ justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      {status === 'ready' && <Link className="b sm" to={to}>{open}</Link>}
      {status === 'none' && <button className="b o sm" onClick={onMake}>Make {label.toLowerCase()}</button>}
      {status === 'processing' && <span className="tg" role="status">Making…</span>}
      {status === 'failed' && <button className="b o sm" onClick={onMake}>Failed. Try again</button>}
    </div>
  )
}

// The video starts when you press play or a timestamp. Without a link (a pasted transcript) there is no video.
function Video({ note, start }) {
  const [playing, setPlaying] = useState(false)
  const from = start ?? 0
  const show = playing || start !== null
  if (!note.youtubeId) {
    return <div className="video"><div className="vc"><p>This note was made from a pasted transcript, so there is no video.</p></div></div>
  }
  return (
    <div className="video">
      {show ? (
        <iframe key={from} title="Lecture video" src={`https://www.youtube-nocookie.com/embed/${note.youtubeId}?start=${Math.floor(from)}&autoplay=1&rel=0`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <div className="vc"><button className="play" aria-label="Play the video" onClick={() => setPlaying(true)} /><p>Source video</p></div>
      )}
    </div>
  )
}
