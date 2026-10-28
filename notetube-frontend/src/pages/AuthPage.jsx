import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Card from '../components/Card.jsx'
import { useAuth } from '../auth.jsx'
import { useScene } from '../scene/SceneContext.jsx'

// Log in and Sign up share one card. `mode` is 'login' or 'signup'.
export default function AuthPage({ mode }) {
  const signup = mode === 'signup'
  const { user, login, signup: doSignup, googleLogin } = useAuth()
  const location = useLocation()
  const scene = useScene()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const gbox = useRef(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Google button (only drawn when VITE_GOOGLE_CLIENT_ID is set in web/.env)
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return undefined
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => {
      const target = document.getElementById('g-btn')
      if (!window.google || !target) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            await googleLogin(credential)
            scene.pulse(1300)
          } catch (e) {
            setFormError(e.message)
          }
        },
      })
      // Google's real button is drawn invisibly on top of our own button, at the same width (Google allows 200 to 400 px)
      const w = Math.min(400, Math.max(200, Math.round(gbox.current?.offsetWidth || 340)))
      window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: w, text: 'continue_with' })
    }
    document.body.appendChild(s)
    return () => s.remove()
  }, [googleLogin, scene])

  if (user) return <Navigate to={location.state?.from || '/dashboard'} replace />

  const submit = async (e) => {
    e.preventDefault()
    const next = {}
    if (signup && !form.name.trim()) next.name = 'Enter your name'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email'
    if (signup ? form.password.length < 8 : !form.password) next.password = signup ? 'Use at least 8 characters' : 'Enter your password'
    setErrors(next)
    setFormError('')
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      if (signup) await doSignup(form.name.trim(), form.email.trim(), form.password)
      else await login(form.email.trim(), form.password)
      scene.pulse(1300)   // the page then redirects on its own, because the user is now set
    } catch (err) {
      setErrors(err.fields || {})
      setFormError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="v">
      <main id="main" className="ct">
        <Card as="form" className="lg" onSubmit={submit} noValidate>
          <Link className="bk" to="/">← Back to notetube</Link>
          <h2 style={{ fontSize: 34 }}>{signup ? 'Create your account.' : 'Welcome back.'}</h2>
          <p>{signup ? 'Sign up to turn lectures into notes.' : 'Log in to pick up where you left off.'}</p>
          {signup && (
            <label className="fl">Name
              <input value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} aria-describedby="e-name" />
              <p className="err" id="e-name">{errors.name}</p>
            </label>
          )}
          <label className="fl">Email
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@college.edu" autoComplete="email" aria-invalid={!!errors.email} aria-describedby="e-email" />
            <p className="err" id="e-email">{errors.email}</p>
          </label>
          <label className="fl">Password
            <input type="password" value={form.password} onChange={set('password')} placeholder={signup ? 'At least 8 characters' : '••••••••'} autoComplete={signup ? 'new-password' : 'current-password'} aria-invalid={!!errors.password} aria-describedby="e-pw" />
            <p className="err" id="e-pw">{errors.password}</p>
          </label>
          <p className="err" role="alert">{formError}</p>
          <button className="b" type="submit" disabled={busy}>{busy ? (signup ? 'Creating account…' : 'Signing in…') : signup ? 'Sign up' : 'Log in'}</button>
          {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
            <>
              <div className="sep" aria-hidden="true"><span>or</span></div>
              <div className="gwrap" ref={gbox}>
                <span className="b o gfake" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
                  Continue with Google
                </span>
                <div id="g-btn" className="gover" />
              </div>
            </>
          ) : import.meta.env.DEV ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--mu)' }}>Google button hidden: set GOOGLE_CLIENT_ID in the .env file, then restart npm run dev. (This note only shows in development.)</p>
          ) : null}
          <p className="alt">
            {signup ? <>Already have an account? <Link to="/login" state={location.state}>Log in</Link></> : <>New to notetube? <Link to="/signup" state={location.state}>Create an account</Link></>}
          </p>
        </Card>
      </main>
    </div>
  )
}
