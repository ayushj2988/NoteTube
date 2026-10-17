import { useEffect, useRef, useState } from 'react'
import LiquidLayer from './LiquidLayer'
import { NOTIFICATIONS } from '../lib/data'

interface Props {
  query: string
  onQuery: (q: string) => void
  onSettings: () => void
  onSignOut: () => void
  still: boolean
}

type Menu = 'notifications' | 'profile' | null

export default function Topbar({ query, onQuery, onSettings, onSignOut, still }: Props) {
  const [menu, setMenu] = useState<Menu>(null)
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setMenu(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const toggle = (m: Exclude<Menu, null>) => setMenu((cur) => (cur === m ? null : m))

  return (
    <header ref={root} className="topbar gl">
      <label className="search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          placeholder="Search notes, concepts, lectures"
          aria-label="Search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>

      <div className="menu-anchor">
        <button className="ib liquid" aria-label="Notifications" aria-expanded={menu === 'notifications'} aria-haspopup="true" onClick={() => toggle('notifications')}>
          <LiquidLayer radius={999} blur={0.15} displacement={22} still={still} />
          <span aria-hidden="true">🔔</span><i className="dot" />
        </button>
        {menu === 'notifications' && (
          <div className="popover" role="menu" aria-label="Notifications">
            {NOTIFICATIONS.map((n) => (
              <div key={n.t} className="pi" role="menuitem"><b>{n.t}</b><span>{n.s}</span></div>
            ))}
          </div>
        )}
      </div>

      <div className="menu-anchor">
        <button className="av" aria-label="Profile menu" aria-expanded={menu === 'profile'} aria-haspopup="true" onClick={() => toggle('profile')}>A</button>
        {menu === 'profile' && (
          <div className="popover" role="menu" aria-label="Profile">
            <button className="pi" role="menuitem" onClick={() => { setMenu(null); onSettings() }}><b>Settings</b><span>Reminders, motion, flashcards</span></button>
            <button className="pi" role="menuitem" onClick={() => { setMenu(null); onSignOut() }}><b>Back to landing</b><span>Leave the notes hub</span></button>
          </div>
        )}
      </div>
    </header>
  )
}
