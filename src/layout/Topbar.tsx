import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDueCount, useRecentActivity, useSettings, useUsage } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import LiquidLayer from '../components/LiquidLayer'
import { useDebounced } from '../lib/hooks'

type Menu = 'notifications' | 'profile' | null
interface Alert { key: string; title: string; body: string; to: string }

export default function Topbar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [params, setParams] = useSearchParams()
  const [menu, setMenu] = useState<Menu>(null)
  const root = useRef<HTMLElement>(null)

  // search: on the Library the box is the URL's ?q=, elsewhere it is local until it navigates there
  const onLibrary = loc.pathname === '/app/library'
  const [local, setLocal] = useState('')
  const value = onLibrary ? (params.get('q') ?? '') : local
  const debouncedLocal = useDebounced(local, 350)
  const lastNav = useRef('')
  useEffect(() => {
    if (onLibrary) return
    const q = debouncedLocal.trim()
    if (q && q !== lastNav.current) {
      lastNav.current = q
      nav(`/app/library?q=${encodeURIComponent(q)}`)
      setLocal('')
    }
  }, [debouncedLocal, onLibrary, nav])

  const onSearch = (v: string) => {
    if (onLibrary) {
      const next = new URLSearchParams(params)
      if (v) next.set('q', v)
      else next.delete('q')
      setParams(next, { replace: true })
    } else setLocal(v)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    if (!onLibrary) {
      lastNav.current = q
      nav(`/app/library${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      setLocal('')
    }
  }

  // close menus on outside click / Escape
  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])
  useEffect(() => setMenu(null), [loc.pathname])

  // the bell lists things that need attention, derived from real data (no separate notification store)
  const remind = useSettings().data?.daily_reminder ?? true
  const dueRaw = useDueCount().data?.due_count ?? 0
  const due = remind ? dueRaw : 0
  const notes = useRecentActivity().data?.items ?? []
  const usage = useUsage().data
  const alerts: Alert[] = []
  if (due > 0) alerts.push({ key: 'due', title: `${due} flashcard${due === 1 ? '' : 's'} due`, body: 'Review them now to keep your streak.', to: '/app/flashcards' })
  for (const n of notes) {
    if (n.status === 'failed') alerts.push({ key: n.id, title: 'Generation failed', body: n.title, to: `/app/notes/${n.id}` })
    else if (n.status === 'queued' || n.status === 'processing') alerts.push({ key: n.id, title: 'Notes are generating', body: n.title, to: `/app/notes/${n.id}` })
  }
  if (usage && usage.used >= usage.limit) alerts.push({ key: 'quota', title: "Today's generations are used up", body: 'They reset tomorrow.', to: '/app/account' })
  else if (usage && usage.used / usage.limit >= 0.8) alerts.push({ key: 'quota', title: 'Almost out of generations', body: `${usage.limit - usage.used} left today.`, to: '/app/account' })

  const toggle = (m: Exclude<Menu, null>) => setMenu((c) => (c === m ? null : m))

  return (
    <header ref={root} className="topbar gl">
      <form className="search" role="search" onSubmit={submit}>
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Search notes, concepts, lectures" aria-label="Search notes" value={value} onChange={(e) => onSearch(e.target.value)} />
      </form>

      <div className="menu-anchor">
        <button className="ib liquid" aria-label={alerts.length ? `Notifications, ${alerts.length} need attention` : 'Notifications'} aria-expanded={menu === 'notifications'} aria-haspopup="true" onClick={() => toggle('notifications')}>
          <LiquidLayer radius={999} blur={0.15} displacement={22} />
          <span aria-hidden="true">🔔</span>
          {alerts.length > 0 && <i className="dot" />}
        </button>
        {menu === 'notifications' && (
          <div className="popover" role="menu" aria-label="Notifications">
            {alerts.length === 0 && <p className="pi-empty">You're all caught up.</p>}
            {alerts.map((a) => (
              <Link key={a.key} className="pi" role="menuitem" to={a.to}><b>{a.title}</b><span>{a.body}</span></Link>
            ))}
          </div>
        )}
      </div>

      <div className="menu-anchor">
        <button className="av" aria-label="Profile menu" aria-expanded={menu === 'profile'} aria-haspopup="true" onClick={() => toggle('profile')}>
          {(user?.name?.trim()[0] ?? '?').toUpperCase()}
        </button>
        {menu === 'profile' && (
          <div className="popover popover--narrow" role="menu" aria-label="Profile">
            <p className="pi-who"><b>{user?.name}</b><span>{user?.email}</span></p>
            <Link className="pi" role="menuitem" to="/app/account">Account</Link>
            <Link className="pi" role="menuitem" to="/app/settings">Settings</Link>
            <button className="pi" role="menuitem" onClick={() => void logout().then(() => nav('/', { replace: true }))}>Sign out</button>
          </div>
        )}
      </div>
    </header>
  )
}
