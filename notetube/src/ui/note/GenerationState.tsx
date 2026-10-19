import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { useDeleteNote, useRetryNote } from '../../api/queries'
import type { Note } from '../../api/types'
import { errorText, friendlyMessage, isRetryable } from '../../lib/errors'
import { relativeTime } from '../../lib/format'
import { MAX_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_CHARS } from '../../lib/transcript'
import ConfirmDialog from '../ConfirmDialog'
import TranscriptField from '../TranscriptField'
import { useToast } from '../Toast'

export const STEPS = ['Fetching transcript', 'Finding key concepts', 'Writing structured notes', 'Building flashcards and quiz']

export function GenerationProgress({ note }: { note: Note }) {
  const queued = note.status === 'queued'
  const step = Math.min(STEPS.length, Math.max(1, note.progress?.step ?? 1))
  return (
    <div className="gl dense gen-card" role="status" aria-live="polite">
      <h2>{queued ? 'Waiting to start…' : 'Making your notes…'}</h2>
      <ol className="steps">
        {STEPS.map((label, i) => {
          const state = queued ? 'todo' : i + 1 < step ? 'done' : i + 1 === step ? 'now' : 'todo'
          return (
            <li key={label} data-state={state}>
              <span className="step-mark" aria-hidden="true">{state === 'done' ? '✓' : state === 'now' ? '…' : '○'}</span>
              {label}
              <span className="sr-only">{state === 'done' ? ' (done)' : state === 'now' ? ' (in progress)' : ''}</span>
            </li>
          )
        })}
      </ol>
      <div className="meter" aria-hidden="true"><i style={{ width: `${queued ? 4 : ((step - 0.5) / STEPS.length) * 100}%` }} /></div>
      <p className="mu">
        This usually takes under a minute. You can leave this page: the note keeps generating and appears in your <Link to="/app/library">Library</Link>.
      </p>
    </div>
  )
}

const PASTE_CODES = new Set(['NO_CAPTIONS', 'VIDEO_PRIVATE', 'VIDEO_TOO_LONG', 'TRANSCRIPT_TOO_SHORT'])

function retryProblem(e: unknown): string {
  if (e instanceof ApiError && e.code === 'QUOTA_EXCEEDED') {
    const d = e.details as { limit?: number; resets_at?: string } | undefined
    return d?.limit
      ? `You've used all ${d.limit} generations for today. They reset ${d.resets_at ? relativeTime(d.resets_at) : 'tomorrow'}.`
      : friendlyMessage('QUOTA_EXCEEDED')
  }
  return errorText(e)
}

export function GenerationFailed({ note }: { note: Note }) {
  const nav = useNavigate()
  const toast = useToast()
  const retry = useRetryNote(note.id)
  const del = useDeleteNote()
  const [transcript, setTranscript] = useState('')
  const [confirm, setConfirm] = useState(false)

  const code = note.error?.code ?? 'UNKNOWN'
  const canRetry = isRetryable(code)
  const canPaste = PASTE_CODES.has(code)
  const t = transcript.trim()
  const transcriptOk = t.length >= MIN_TRANSCRIPT_CHARS && t.length <= MAX_TRANSCRIPT_CHARS

  return (
    <div className="gl dense gen-card gen-failed" role="alert">
      <h2>We couldn't make notes from this</h2>
      <p>{friendlyMessage(code, note.error?.message)}</p>

      {canRetry && (
        <button className="btn" disabled={retry.isPending} onClick={() => retry.mutate(undefined)}>
          {retry.isPending ? 'Starting…' : 'Try again'}
        </button>
      )}

      {canPaste && (
        <div className="gen-paste">
          <h3>Use a transcript instead</h3>
          <p className="mu">Paste the text of the lecture, or upload a .srt / .vtt file. Timestamps in the file become clickable.</p>
          <TranscriptField value={transcript} onChange={setTranscript} />
          <button className="btn" disabled={!transcriptOk || retry.isPending} onClick={() => retry.mutate(t)}>
            {retry.isPending ? 'Starting…' : 'Generate from transcript'}
          </button>
        </div>
      )}

      {retry.isError && <p className="field-error" role="alert">{retryProblem(retry.error)}</p>}

      <div className="gen-links">
        <Link className="link" to="/app/notes/new">Start over with another video</Link>
        <button className="link link-danger" onClick={() => setConfirm(true)}>Delete this note</button>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete this note?"
        body="It will be removed from your library."
        busy={del.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => del.mutate(note.id, { onSuccess: () => { toast.show('Note deleted'); nav('/app/library', { replace: true }) }, onError: (e) => toast.show(errorText(e), 'error') })}
      />
    </div>
  )
}
