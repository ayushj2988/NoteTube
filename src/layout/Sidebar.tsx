import { Link, useLocation } from 'react-router-dom'
import { useDueCount, useStats } from '../api/queries'
import UsageMeter from '../ui/UsageMeter'

const ITEMS: { to: string; icon: string; label: string; active: (p: string) => boolean }[] = [
  { to: '/app', icon: '⌂', label: 'Home', active: (p) => p === '/app' || p === '/app/notes/new' },
  { to: '/app/library', icon: '▤', label: 'Library', active: (p) => p === '/app/library' || (p.startsWith('/app/notes/') && p !== '/app/notes/new') },
  { to: '/app/flashcards', icon: '◧', label: 'Flashcards', active: (p) => p.startsWith('/app/flashcards') },
  { to: '/app/quizzes', icon: '✦', label: 'Quizzes', active: (p) => p.startsWith('/app/quizzes') },
  { to: '/app/progress', icon: '📈', label: 'Progress', active: (p) => p === '/app/progress' },
  { to: '/app/settings', icon: '⚙', label: 'Settings', active: (p) => p === '/app/settings' || p === '/app/account' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const due = useDueCount().data?.due_count ?? 0
  const streak = useStats(7).data?.streak_days

  return (
    <aside className="sidebar gl" aria-label="Sidebar">
      <Link className="brand" to="/app"><i aria-hidden="true" /><span>NoteTube</span></Link>
      <nav className="side-nav" aria-label="Sections">
        {ITEMS.map((it) => (
          <Link key={it.to} to={it.to} aria-current={it.active(pathname) ? 'page' : undefined} aria-label={it.label === 'Flashcards' && due ? `Flashcards, ${due} due` : it.label}>
            <span aria-hidden="true">{it.icon}</span>
            <span className="lbl">{it.label}</span>
            {it.label === 'Flashcards' && due > 0 && <b className="badge" aria-hidden="true">{due > 99 ? '99+' : due}</b>}
          </Link>
        ))}
      </nav>
      <div className="sf">
        <p className="streak">{streak ? `${streak} day streak` : 'Study today to start a streak'}</p>
        <UsageMeter compact />
      </div>
    </aside>
  )
}
