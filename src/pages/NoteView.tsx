import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useDeleteNote, useFlashcards, useInvalidateNotes, useNote, useUpdateNote } from '../api/queries'
import type { Note } from '../api/types'
import LiquidLayer from '../components/LiquidLayer'
import { parseChapters } from '../lib/chapters'
import { errorText } from '../lib/errors'
import { downloadText, noteToMarkdown, slug } from '../lib/exportNote'
import { formatDate, formatTimestamp } from '../lib/format'
import { useDocumentTitle, useStudyTimer } from '../lib/hooks'
import { setSkyMood } from '../scene/skyState'
import ConfirmDialog from '../ui/ConfirmDialog'
import { EmptyState, ErrorState, Skeleton } from '../ui/States'
import { useToast } from '../ui/Toast'
import type { PlayerHandle } from '../ui/YouTubePlayer'
import { GenerationFailed, GenerationProgress } from '../ui/note/GenerationState'
import NoteBody from '../ui/note/NoteBody'
import OrganizePanel from '../ui/note/OrganizePanel'
import PlayerPanel from '../ui/note/PlayerPanel'
import PrintView from '../ui/note/PrintView'
import SharePanel from '../ui/note/SharePanel'
import QuizRunner from '../ui/QuizRunner'

type Tab = 'full' | 'skim' | 'cards' | 'quiz'
const TABS: { id: Tab; label: string }[] = [
  { id: 'full', label: 'Full notes' },
  { id: 'skim', label: 'Skim' },
  { id: 'cards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
]

function CardsTab({ note }: { note: Note }) {
  const q = useFlashcards({ note_id: note.id, limit: 200 })
  if (q.isPending) return <Skeleton h={120} r={12} />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />
  const cards = q.data.items
  const due = cards.filter((c) => new Date(c.due_at).getTime() <= Date.now()).length
  if (cards.length === 0) {
    return (
      <EmptyState icon="◧" title="No flashcards for this note" body="Generate with “Flashcards” switched on, or add your own cards.">
        <Link className="btn dark" to={`/app/flashcards?manage=${note.id}`}>Add cards</Link>
      </EmptyState>
    )
  }
  return (
    <div>
      <p className="mu" aria-live="polite">{cards.length} card{cards.length === 1 ? '' : 's'} · {due} due now</p>
      <div className="row start">
        <Link className="btn" to={`/app/flashcards?review=1&note_id=${note.id}`}>{due > 0 ? `Study ${due} due` : 'Practice this deck'}</Link>
        <Link className="btn ghost" to={`/app/flashcards?manage=${note.id}`}>Edit cards</Link>
      </div>
      <ul className="card-preview">
        {cards.map((c) => (
          <li key={c.id}>
            <b>{c.front}</b>
            <span>{c.back}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EditNotes({ note, onDone }: { note: Note; onDone: () => void }) {
  const update = useUpdateNote(note.id)
  const [md, setMd] = useState(note.content_md)
  const [concepts, setConcepts] = useState(note.key_concepts.join(', '))
  const [error, setError] = useState('')
  const save = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    update.mutate(
      { content_md: md, key_concepts: concepts.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20) },
      { onSuccess: onDone, onError: (err) => setError(errorText(err)) },
    )
  }
  return (
    <form className="edit-notes" onSubmit={save}>
      <label className="field">
        Key concepts (comma separated)
        <input value={concepts} onChange={(e) => setConcepts(e.target.value)} />
      </label>
      <label className="field">
        Notes (Markdown)
        <textarea className="edit-area" value={md} onChange={(e) => setMd(e.target.value)} spellCheck />
      </label>
      <p className="mu">
        Headings like <code>## [03:12] Title</code> become chapters. <code>[03:12]</code> anywhere becomes a button that jumps the video. Raw HTML is not rendered.
      </p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="row start">
        <button className="btn" type="submit" disabled={update.isPending || !md.trim()}>{update.isPending ? 'Saving…' : 'Save changes'}</button>
        <button className="btn ghost" type="button" onClick={onDone} disabled={update.isPending}>Cancel</button>
      </div>
    </form>
  )
}

export default function NoteView() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const q = useNote(id)
  const note = q.data
  const update = useUpdateNote(id ?? '')
  const del = useDeleteNote()
  const invalidate = useInvalidateNotes()

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [printing, setPrinting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<PlayerHandle | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useDocumentTitle(note?.title ?? 'Note')
  useEffect(() => {
    setSkyMood(1)
    return () => setSkyMood(0)
  }, [])

  const tabParam = params.get('tab')
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'full'
  const ready = note?.status === 'ready'
  useStudyTimer('reading', id, ready && (tab === 'full' || tab === 'skim') && !editing)

  // when generation finishes (or fails and the quota is refunded) refresh the lists, counts and usage meter
  const prevStatus = useRef(note?.status)
  useEffect(() => {
    const was = prevStatus.current
    prevStatus.current = note?.status
    if ((was === 'queued' || was === 'processing') && note && note.status !== 'queued' && note.status !== 'processing') invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.status])

  const seek = useCallback((s: number) => handleRef.current?.seek(s), [])
  const chapters = useMemo(() => (note ? parseChapters(note.content_md) : []), [note])

  // close the export menu on outside click / Escape
  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e: PointerEvent) => !exportRef.current?.contains(e.target as Node) && setExportOpen(false)
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setExportOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [exportOpen])

  // PDF export = the browser's print dialog on a print-only copy of the note
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener('afterprint', done)
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    return () => {
      window.removeEventListener('afterprint', done)
      cancelAnimationFrame(raf)
    }
  }, [printing])

  if (q.isPending) {
    return (
      <section className="view" aria-busy="true">
        <Skeleton h={40} w="50%" r={10} />
        <div style={{ height: 16 }} />
        <Skeleton h={320} r={20} />
      </section>
    )
  }
  if (q.isError) {
    const gone = q.error instanceof ApiError && q.error.status === 404
    return (
      <section className="view">
        {gone ? (
          <EmptyState icon="?" title="Note not found" body="It may have been deleted.">
            <Link className="btn" to="/app/library">Back to library</Link>
          </EmptyState>
        ) : (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        )}
      </section>
    )
  }
  if (!note) return null

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'full') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }
  const onTabKey = (e: KeyboardEvent, idx: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (idx + d + TABS.length) % TABS.length
    setTab(TABS[n].id)
    tabRefs.current[n]?.focus()
  }

  const saveTitle = (e: FormEvent) => {
    e.preventDefault()
    const t = titleDraft.trim()
    if (!t || t === note.title) return setEditingTitle(false)
    update.mutate({ title: t }, { onSuccess: () => setEditingTitle(false), onError: (err) => toast.show(errorText(err), 'error') })
  }

  const meta = [note.video?.channel, note.video ? formatTimestamp(note.video.duration_seconds) : null, note.subject, formatDate(note.created_at)].filter(Boolean)

  const header = (
    <>
      <Link className="back" to="/app/library">← Library</Link>
      <header className="reader-head">
        <div className="reader-title">
          {editingTitle ? (
            <form className="inline-form" onSubmit={saveTitle}>
              <label className="sr-only" htmlFor="title-edit">Note title</label>
              <input id="title-edit" value={titleDraft} maxLength={200} autoFocus onChange={(e) => setTitleDraft(e.target.value)} />
              <button className="btn dark btn-sm" type="submit" disabled={update.isPending}>Save</button>
              <button className="btn ghost btn-sm" type="button" onClick={() => setEditingTitle(false)}>Cancel</button>
            </form>
          ) : (
            <h1 id="note-title" tabIndex={-1}>
              {note.title}
              {ready && <button className="icon-btn" aria-label="Rename note" onClick={() => { setTitleDraft(note.title); setEditingTitle(true) }}>✎</button>}
            </h1>
          )}
          <p className="reader-meta">{meta.join(' · ')}</p>
        </div>
        {ready && (
          <div className="reader-actions">
            <button className="btn ghost btn-sm" aria-expanded={shareOpen} onClick={() => setShareOpen((v) => !v)}>{note.shared ? 'Shared' : 'Share'}</button>
            <div className="menu-anchor" ref={exportRef}>
              <button className="btn ghost btn-sm" aria-haspopup="true" aria-expanded={exportOpen} onClick={() => setExportOpen((v) => !v)}>Export</button>
              {exportOpen && (
                <div className="popover popover--narrow" role="menu" aria-label="Export">
                  <button className="pi" role="menuitem" onClick={() => { downloadText(`${slug(note.title)}.md`, noteToMarkdown(note), 'text/markdown'); setExportOpen(false) }}>
                    <b>Markdown</b><span>Download a .md file</span>
                  </button>
                  <button className="pi" role="menuitem" onClick={() => { setExportOpen(false); setPrinting(true) }}>
                    <b>PDF</b><span>Opens the print dialog. Choose “Save as PDF”.</span>
                  </button>
                </div>
              )}
            </div>
            <button className="btn ghost btn-sm" onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
        )}
      </header>
    </>
  )

  const dialog = (
    <ConfirmDialog
      open={confirmDelete}
      title={`Delete “${note.title}”?`}
      body="This also deletes its flashcards, quiz questions, quiz history and any share link. It can't be undone."
      busy={del.isPending}
      onCancel={() => setConfirmDelete(false)}
      onConfirm={() => del.mutate(note.id, { onSuccess: () => { toast.show('Note deleted'); nav('/app/library', { replace: true }) }, onError: (e) => toast.show(errorText(e), 'error') })}
    />
  )

  if (note.status === 'queued' || note.status === 'processing') {
    return (
      <section className="view" aria-labelledby="note-title">
        {header}
        <GenerationProgress note={note} />
      </section>
    )
  }
  if (note.status === 'failed') {
    return (
      <section className="view" aria-labelledby="note-title">
        {header}
        <GenerationFailed note={note} />
      </section>
    )
  }

  return (
    <section className="view" aria-labelledby="note-title">
      {header}
      {shareOpen && <SharePanel note={note} />}

      <div className="reader">
        <div className="reader-left">
          {note.video ? (
            <PlayerPanel video={note.video} chapters={chapters} handleRef={handleRef} />
          ) : (
            <div className="gl dense vid no-video">
              <p><b>No video attached</b></p>
              <p className="mu">This note was made from a pasted transcript, so there is no player. Timestamps are shown as plain text.</p>
            </div>
          )}
          <OrganizePanel note={note} />
        </div>

        <div className="reader-right">
          <div className="tabs-pill liquid">
            <LiquidLayer radius={999} blur={0.2} displacement={26} />
            <div className="tabs" role="tablist" aria-label="Study mode">
              {TABS.map((t, idx) => (
                <button
                  key={t.id}
                  ref={(el) => { tabRefs.current[idx] = el }}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="pane"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, idx)}
                >
                  {t.label}
                  {t.id === 'cards' && note.flashcard_count > 0 && <span className="tab-count"> {note.flashcard_count}</span>}
                  {t.id === 'quiz' && note.question_count > 0 && <span className="tab-count"> {note.question_count}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="gl dense pane" id="pane" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'full' && (
              editing ? (
                <EditNotes note={note} onDone={() => setEditing(false)} />
              ) : (
                <>
                  <div className="pane-tools"><button className="link" onClick={() => setEditing(true)}>Edit notes</button></div>
                  <NoteBody summary={note.summary} concepts={note.key_concepts} md={note.content_md} onSeek={note.video ? seek : undefined} />
                </>
              )
            )}
            {tab === 'skim' && (
              <>
                <h3>In 30 seconds</h3>
                {note.skim.length === 0 ? (
                  <p className="mu">No skim summary for this note.</p>
                ) : (
                  <ul className="skim">{note.skim.map((s, k) => <li key={k}>{s}</li>)}</ul>
                )}
              </>
            )}
            {tab === 'cards' && <CardsTab note={note} />}
            {tab === 'quiz' && <QuizRunner noteId={note.id} />}
          </div>
        </div>
      </div>

      {dialog}
      {printing && createPortal(<PrintView note={note} />, document.body)}
    </section>
  )
}
