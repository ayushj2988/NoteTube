import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api } from './api.js'

// Who is logged in. `user` is { id, name, email }, null (logged out) or undefined (still checking).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    api.me().then((r) => setUser(r.user), () => setUser(null))
    const out = () => setUser(null)
    window.addEventListener('nt-unauthenticated', out)
    return () => window.removeEventListener('nt-unauthenticated', out)
  }, [])

  const login = useCallback(async (email, password) => setUser((await api.login(email, password)).user), [])
  const signup = useCallback(async (name, email, password) => setUser((await api.signup(name, email, password)).user), [])
  const googleLogin = useCallback(async (credential) => setUser((await api.google(credential)).user), [])
  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [])
  const updateProfile = useCallback(async (body) => setUser((await api.updateMe(body)).user), [])

  return <AuthContext.Provider value={{ user, login, signup, googleLogin, logout, updateProfile }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)

// Wrap pages that need a login.
export function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (user === undefined) return <p className="msg" role="status">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
