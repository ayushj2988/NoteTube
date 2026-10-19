import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  danger?: boolean
  /** the user must type this word to enable the confirm button */
  requireText?: string
  busy?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, body, confirmLabel = 'Delete', danger = true, requireText, busy, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setTyped('')
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
  }, [open])

  const ok = !requireText || typed.trim() === requireText
  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby="dlg-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onCancel()
      }}
    >
      {open && (
        <form
          method="dialog"
          className="dlg-body"
          onSubmit={(e) => {
            e.preventDefault()
            if (ok && !busy) onConfirm()
          }}
        >
          <h2 id="dlg-title">{title}</h2>
          {body && <p className="mu">{body}</p>}
          {requireText && (
            <label className="dlg-type">
              Type <b>{requireText}</b> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
            </label>
          )}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className={`btn ${danger ? 'danger' : 'dark'}`} disabled={!ok || busy}>
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
