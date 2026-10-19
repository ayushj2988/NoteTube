import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSettings } from '../api/queries'
import { useMotion } from '../ui/motion'
import { Spinner } from '../ui/States'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const { pathname } = useLocation()
  const { data: settings } = useSettings()
  const { preferred, setPreferred } = useMotion()

  // the account setting wins over this browser's stored value once it has loaded
  useEffect(() => {
    if (settings && settings.reduce_motion !== preferred) setPreferred(settings.reduce_motion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.reduce_motion])

  // after navigating, move keyboard/screen-reader focus to the new page heading
  useEffect(() => {
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>('.view h1')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <main id="main" className="main-host">
          <Suspense fallback={<Spinner label="Loading page" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
