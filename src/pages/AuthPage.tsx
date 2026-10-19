import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import GoogleButton from '../auth/GoogleButton'
import { errorText, fieldErrors } from '../lib/errors'
import { useDocumentTitle } from '../lib/hooks'
import { FieldError } from '../ui/States'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup'
  useDocumentTitle(signup ? 'Create account' : 'Sign in')
  const { user, signedIn } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/app'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  const finish = (u: Awaited<ReturnType<typeof api.login>>['user']) => {
    signedIn(u)
    nav(from, { replace: true })
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (signup && !name.trim()) next.name = 'Enter your name.'
    if (!EMAIL.test(email.trim())) next.email = 'Enter a valid email address.'
    if (signup ? password.length < 8 : !password) next.password = signup ? 'Use at least 8 characters.' : 'Enter your password.'
    setErrors(next)
    setFormError('')
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      const res = signup
        ? await api.signup({ name: name.trim(), email: email.trim(), password })
        : await api.login({ email: email.trim(), password })
      finish(res.user)
    } catch (err) {
      const fields = fieldErrors(err)
      if (Object.keys(fields).length) setErrors(fields)
      else if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setErrors({ email: errorText(err) })
      else setFormError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const onGoogle = async (credential: string) => {
    setBusy(true)
    setFormError('')
    try {
      finish((await api.google(credential)).user)
    } catch (err) {
      setFormError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <Link to="/" className="auth-brand"><span className="logo"><i aria-hidden="true" />NoteTube</span></Link>
      <form className="gl dense auth-card" onSubmit={onSubmit} noValidate aria-labelledby="auth-title">
        <h1 id="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mu">{signup ? 'Turn lectures into notes, flashcards and quizzes.' : 'Sign in to your notes hub.'}</p>

        <GoogleButton text={signup ? 'signup_with' : 'signin_with'} onCredential={onGoogle} onProblem={setFormError} />
        <div className="or" aria-hidden="true"><span>or</span></div>

        {signup && (
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} aria-describedby="e-name" />
            <span id="e-name"><FieldError>{errors.name}</FieldError></span>
          </label>
        )}
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" aria-invalid={!!errors.email} aria-describedby="e-email" />
          <span id="e-email"><FieldError>{errors.email}</FieldError></span>
        </label>
        <label className="field">
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} aria-invalid={!!errors.password} aria-describedby="e-pass" />
          <span id="e-pass"><FieldError>{errors.password}</FieldError></span>
        </label>

        <FieldError>{formError}</FieldError>
        <button className="btn auth-submit" type="submit" disabled={busy}>
          {busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
        </button>
        <p className="mu auth-switch">
          {signup ? 'Already have an account?' : 'New to NoteTube?'}{' '}
          <Link to={signup ? '/login' : '/signup'} state={loc.state}>{signup ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </form>
    </main>
  )
}
