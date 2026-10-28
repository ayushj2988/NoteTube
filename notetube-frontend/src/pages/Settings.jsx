import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Settings() {
  const { user, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)

  const save = async (e) => {
    e.preventDefault()
    setErrors({})
    setMsg(null)
    try {
      await updateProfile({ name, email })
      setMsg({ ok: true, text: 'Saved.' })
    } catch (err) {
      setErrors(err.fields || {})
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <>
      <div className="hd"><h1>Settings</h1></div>
      <form className="cd" onSubmit={save} noValidate>
        <h2>Profile</h2>
        <label className="fl">Name<input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} /><p className="err">{errors.name}</p></label>
        <label className="fl">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} /><p className="err">{errors.email}</p></label>
        <div className="rw c"><button className="b" type="submit">Save changes</button>{msg && <span className={msg.ok ? 'tg' : 'err'} role="status">{msg.text}</span>}</div>
      </form>

      <div className="cd">
        <h2>Session</h2>
        <p>This device, signed in as {user.email}.</p>
        <button className="b o" style={{ alignSelf: 'flex-start' }} onClick={async () => { await logout(); navigate('/') }}>Log out</button>
      </div>
    </>
  )
}
