import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { errorText } from '../lib/errors'
import { formatDate } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import ConfirmDialog from '../ui/ConfirmDialog'
import PageHeader from '../ui/PageHeader'
import UsageMeter from '../ui/UsageMeter'
import { useToast } from '../ui/Toast'

export default function Account() {
  useDocumentTitle('Account')
  const { user, updateUser, logout } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [delError, setDelError] = useState('')

  if (!user) return null

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setError('Enter your name.')
    if (n === user.name) return
    setSaving(true)
    setError('')
    try {
      updateUser((await api.updateMe({ name: n })).user)
      toast.show('Name updated')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setDelError('')
    try {
      await api.deleteAccount()
      await logout()
      nav('/', { replace: true })
    } catch (err) {
      setDelError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <section className="view" aria-labelledby="ac-title">
      <PageHeader id="ac-title" title="Account" />

      <form className="gl dense set-card" onSubmit={save} noValidate>
        <h2>Profile</h2>
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" aria-invalid={!!error} />
        </label>
        <p className="mu">Email: <b>{user.email}</b>{user.has_password ? '' : ' · signed in with Google'}</p>
        <p className="mu">Member since {formatDate(user.created_at)}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="row start">
          <button className="btn" type="submit" disabled={saving || !name.trim() || name.trim() === user.name}>{saving ? 'Saving…' : 'Save name'}</button>
        </div>
      </form>

      <div className="gl dense set-card">
        <h2>Today's generations</h2>
        <UsageMeter />
      </div>

      <div className="gl dense set-card">
        <h2>Session</h2>
        <div className="set-row">
          <div><b>Sign out</b><p className="mu">You'll need to sign in again on this device.</p></div>
          <button className="btn ghost btn-sm" onClick={() => void logout().then(() => nav('/', { replace: true }))}>Sign out</button>
        </div>
        <div className="set-row">
          <div><b>Delete account</b><p className="mu">Permanently deletes your account and everything in it.</p></div>
          <button className="btn danger btn-sm" onClick={() => { setDelError(''); setConfirm(true) }}>Delete account</button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Delete your account?"
        body="Your account, notes, flashcards, quizzes and study history are permanently deleted. This can't be undone."
        confirmLabel="Delete account"
        requireText="DELETE"
        busy={busy}
        error={delError}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      />
    </section>
  )
}
