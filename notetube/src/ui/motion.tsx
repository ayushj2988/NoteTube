import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const KEY = 'nt-reduce-motion'

interface MotionValue {
  /** true when the OS asks for reduced motion or the user switched it on in Settings */
  reduced: boolean
  /** the user's own switch (does not include the OS setting) */
  preferred: boolean
  setPreferred: (v: boolean) => void
}

const Ctx = createContext<MotionValue>({ reduced: false, preferred: false, setPreferred: () => {} })
export const useMotion = () => useContext(Ctx)

function readStored(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [preferred, setPref] = useState(readStored)
  const [os, setOs] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setOs(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  const setPreferred = useCallback((v: boolean) => {
    setPref(v)
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
  }, [])

  const reduced = os || preferred
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduced)
  }, [reduced])

  const value = useMemo(() => ({ reduced, preferred, setPreferred }), [reduced, preferred, setPreferred])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
