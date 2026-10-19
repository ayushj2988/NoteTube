import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import LiquidLayer from '../components/LiquidLayer'

type Kind = 'info' | 'error'
interface ToastApi {
  show: (message: string, kind?: Kind) => void
}
const Ctx = createContext<ToastApi>({ show: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((message: string, kind: Kind = 'info') => {
    setToast({ message, kind })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 5200 : 3200)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api = useMemo(() => ({ show }), [show])
  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status">
        {toast && (
          <div className={`toast liquid${toast.kind === 'error' ? ' toast--error' : ''}`}>
            <LiquidLayer radius={999} blur={0.2} displacement={24} />
            {toast.message}
          </div>
        )}
      </div>
    </Ctx.Provider>
  )
}
