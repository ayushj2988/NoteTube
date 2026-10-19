import type { View } from '../lib/data'

const ITEMS: { v: View; icon: string; label: string }[] = [
  { v: 'home', icon: '⌂', label: 'Home' },
  { v: 'library', icon: '▤', label: 'Library' },
  { v: 'flashcards', icon: '◧', label: 'Flashcards' },
  { v: 'quizzes', icon: '✦', label: 'Quizzes' },
  { v: 'progress', icon: '◔', label: 'Progress' },
  { v: 'settings', icon: '⚙', label: 'Settings' },
]

interface Props {
  view: View
  onNavigate: (v: View) => void
  onBrand: () => void
}

export default function Sidebar({ view, onNavigate, onBrand }: Props) {
  return (
    <aside className="sidebar gl" aria-label="Sidebar">
      <button className="brand" onClick={onBrand}><i aria-hidden="true" /><span>NoteTube</span></button>
      <nav className="side-nav" aria-label="Sections">
        {ITEMS.map((it) => (
          <button key={it.v} aria-current={view === it.v ? 'page' : undefined} onClick={() => onNavigate(it.v)} aria-label={it.label}>
            <span aria-hidden="true">{it.icon}</span> <span className="lbl">{it.label}</span>
          </button>
        ))}
      </nav>
      <div className="sf">Streak · 12 days</div>
    </aside>
  )
}
