import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ErrorState, Spinner } from '../ui/States'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status, error, retry } = useAuth()
  const loc = useLocation()
  if (status === 'loading') return <div className="fullscreen"><Spinner label="Checking your session" /></div>
  if (status === 'error') {
    return (
      <div className="fullscreen">
        <ErrorState title="Can't reach NoteTube" error={error} onRetry={retry} />
      </div>
    )
  }
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <>{children}</>
}
