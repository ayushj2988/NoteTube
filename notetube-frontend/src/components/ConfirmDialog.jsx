import { useEffect, useRef } from 'react'

// A confirm box in the app's own style (replaces the browser's window.confirm).
//   open       true to show it
//   title, children   the question
//   confirmLabel      text on the red button, e.g. "Delete"
//   onConfirm / onCancel
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Delete', busy, onConfirm, onCancel }) {
  const cancelBtn = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    cancelBtn.current?.focus()
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }
    document.addEventListener('keydown', key, true)
    return () => document.removeEventListener('keydown', key, true)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
        <span className="bd">Careful</span>
        <h2 id="dlg-t">{title}</h2>
        <p>{children}</p>
        <div className="rw c">
          <button className="b r1" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : confirmLabel}</button>
          <button className="b o" ref={cancelBtn} onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  )
}