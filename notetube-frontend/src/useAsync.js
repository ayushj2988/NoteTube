import { useCallback, useEffect, useRef, useState } from 'react'

// Runs an async function and gives back { data, error, loading, reload }.
// It re-runs when `deps` change. `pollMs` > 0 makes it reload quietly on a timer (used while a job is running).
export function useAsync(fn, deps = [], pollMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const run = useCallback((quiet) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }))
    return fnRef.current().then(
      (data) => alive.current && setState({ data, error: null, loading: false }),
      (error) => alive.current && setState((s) => ({ data: quiet ? s.data : null, error, loading: false })),
    )
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(false) }, deps)
  useEffect(() => {
    if (!pollMs) return undefined
    const t = setInterval(() => run(true), pollMs)
    return () => clearInterval(t)
  }, [pollMs, run])

  return { ...state, reload: () => run(true), setData: (data) => setState((s) => ({ ...s, data })) }
}
