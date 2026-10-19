import type { ReactNode } from 'react'
import { errorText } from '../lib/errors'

export function Skeleton({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skel" aria-hidden="true" style={{ height: h, width: w, borderRadius: r }} />
}

export function SkeletonList({ rows = 3, tall = false, label = 'Loading' }: { rows?: number; tall?: boolean; label?: string }) {
  return (
    <div className="skel-list" role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="gl skel-row">
          <Skeleton h={tall ? 64 : 48} w={tall ? 112 : 86} r={10} />
          <div className="skel-lines">
            <Skeleton h={14} w="70%" />
            <Skeleton h={12} w="40%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}…</span>
    </div>
  )
}

export function EmptyState({ icon = '✦', title, body, children }: { icon?: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="gl dense empty-state">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      {body && <p className="mu">{body}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, title = "Couldn't load this", children }: { error: unknown; onRetry?: () => void; title?: string; children?: ReactNode }) {
  return (
    <div className="gl dense empty-state error-state" role="alert">
      <div className="empty-icon" aria-hidden="true">!</div>
      <h3>{title}</h3>
      <p className="mu">{errorText(error)}</p>
      <div className="empty-actions">
        {onRetry && <button className="btn dark" onClick={onRetry}>Try again</button>}
        {children}
      </div>
    </div>
  )
}

export function FieldError({ children }: { children?: string }) {
  return children ? <p className="field-error" role="alert">{children}</p> : null
}
