import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { SessionKind } from '../api/types'

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} · NoteTube` : 'NoteTube'
    return () => {
      document.title = prev
    }
  }, [title])
}

/**
 * Counts active study seconds (screen mounted and tab visible) and reports them to the server about
 * every minute and once more on leave. Anything under 5 s is dropped.
 */
export function useStudyTimer(kind: SessionKind, noteId?: string, enabled = true): void {
  const acc = useRef(0)
  useEffect(() => {
    if (!enabled) return
    acc.current = 0
    let last = document.visibilityState === 'visible' ? Date.now() : 0
    const tick = () => {
      if (last) {
        acc.current += (Date.now() - last) / 1000
        last = Date.now()
      }
    }
    const flush = () => {
      tick()
      const seconds = Math.round(acc.current)
      acc.current = 0
      if (seconds >= 5) api.logSession({ kind, note_id: noteId, seconds: Math.min(seconds, 3600) }).catch(() => {})
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') last = Date.now()
      else {
        flush()
        last = 0
      }
    }
    const iv = window.setInterval(flush, 60_000)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [kind, noteId, enabled])
}
