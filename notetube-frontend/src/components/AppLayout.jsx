import { Link, Outlet, useLocation } from 'react-router-dom'
import UserMenu from './UserMenu.jsx'

const LINKS = [
  ['/dashboard', 'Dashboard'], ['/library', 'Library'], ['/flashcards', 'Flashcards'], ['/quiz', 'Quiz'], ['/progress', 'Progress'], ['/settings', 'Settings'],
]

// The frame around every signed-in page: a sidebar on the left (with the user icon at its bottom), the page on the right.
export default function AppLayout() {
  const { pathname } = useLocation()
  const active = (to) => pathname === to || (to === '/library' && (pathname.startsWith('/notes') || pathname.startsWith('/processing')))
  return (
    <div className="v">
      <div className="vw">
        <nav className="sd" aria-label="Main">
          <Link className="wm" to="/">notetube</Link>
          {LINKS.map(([to, label]) => (
            <Link key={to} to={to} className={active(to) ? 'on' : ''} aria-current={active(to) ? 'page' : undefined}>{label}</Link>
          ))}
          <div className="sdu"><UserMenu up /></div>
        </nav>
        <main id="main" className="mn" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}