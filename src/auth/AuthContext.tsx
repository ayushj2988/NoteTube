import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, setUnauthorizedHandler } from '../api/client'
import { qk } from '../api/queries'
import type { User } from '../api/types'

type Status = 'loading' | 'authed' | 'anon' | 'error'

interface AuthValue {
  user: User | null
  status: Status
  error: unknown
  retry: () => void
  /** call after a successful sign-in or sign-up */
  signedIn: (user: User) => void
  updateUser: (user: User) => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return (await api.me()).user
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
    retry: 1,
  })

  const dropUserData = useCallback(() => {
    qc.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
  }, [qc])

  // any other request answering 401 means the session ended: go back to signed-out state
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (qc.getQueryData(qk.me)) {
        qc.setQueryData(qk.me, null)
        dropUserData()
      }
    })
    return () => setUnauthorizedHandler(null)
  }, [qc, dropUserData])

  const signedIn = useCallback(
    (user: User) => {
      dropUserData()
      qc.setQueryData(qk.me, user)
    },
    [qc, dropUserData],
  )
  const updateUser = useCallback((user: User) => qc.setQueryData(qk.me, user), [qc])
  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* the cookie may already be gone; sign out locally either way */
    }
    qc.setQueryData(qk.me, null)
    dropUserData()
  }, [qc, dropUserData])

  const status: Status = q.isPending ? 'loading' : q.isError ? 'error' : q.data ? 'authed' : 'anon'
  const value = useMemo<AuthValue>(
    () => ({ user: q.data ?? null, status, error: q.error, retry: () => void q.refetch(), signedIn, updateUser, logout }),
    [q, status, signedIn, updateUser, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
