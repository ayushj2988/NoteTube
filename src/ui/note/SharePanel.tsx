import { useRef } from 'react'
import type { Note } from '../../api/types'
import { useShare } from '../../api/queries'
import { errorText } from '../../lib/errors'
import { useToast } from '../Toast'

export default function SharePanel({ note }: { note: Note }) {
  const { share, unshare } = useShare(note.id)
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const url = note.share_token ? `${window.location.origin}/s/${note.share_token}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.show('Link copied')
    } catch {
      input.current?.select()
      toast.show('Press Ctrl+C to copy the selected link')
    }
  }

  return (
    <div className="gl dense share-panel" role="region" aria-label="Share this note">
      {!note.shared ? (
        <>
          <p><b>Share a read-only copy.</b> Anyone with the link can read the notes (not your flashcards or quiz results). You can turn it off any time.</p>
          <button className="btn dark btn-sm" disabled={share.isPending} onClick={() => share.mutate(undefined, { onError: (e) => toast.show(errorText(e), 'error') })}>
            {share.isPending ? 'Creating…' : 'Create share link'}
          </button>
        </>
      ) : (
        <>
          <label className="field">
            Anyone with this link can read this note
            <span className="share-row">
              <input ref={input} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <button className="btn dark btn-sm" onClick={() => void copy()}>Copy</button>
            </span>
          </label>
          <button className="link link-danger" disabled={unshare.isPending} onClick={() => unshare.mutate(undefined, { onError: (e) => toast.show(errorText(e), 'error') })}>
            {unshare.isPending ? 'Turning off…' : 'Stop sharing'}
          </button>
        </>
      )}
    </div>
  )
}
