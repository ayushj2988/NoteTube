import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

// The round user icon (first letter of the name) with a small menu. Esc or a click outside closes it.
// up: open the menu above the icon (used at the bottom of the sidebar)
export default function UserMenu({ up = false }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc, true)
    }
  }, [open])

  if (!user) return null
  const initial = (user.name || user.email || '?').trim()[0].toUpperCase()
  return (
    <div className="um" ref={box}>
      <button className={up ? 'avrow' : 'av'} aria-label={`Account menu for ${user.name || user.email}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {up ? <><span className="av">{initial}</span><span className="avn">{user.name || user.email}</span></> : initial}
      </button>
      {open && (
        <div className={'pop' + (up ? ' up' : '')} role="menu">
          <div className="who"><b>{user.name}</b><span>{user.email}</span></div>
          <Link role="menuitem" to="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)}>Settings</Link>
          <button role="menuitem" onClick={async () => { setOpen(false); await logout(); navigate('/') }}>Log out</button>
        </div>
      )}
    </div>
  )
}