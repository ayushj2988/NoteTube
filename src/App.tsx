import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Landing from './components/Landing'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import Toast from './components/Toast'
import Home from './views/Home'
import Library from './views/Library'
import { FlashcardsView, QuizzesView } from './views/Study'
import Progress from './views/Progress'
import Settings from './views/Settings'
import NewNote from './views/NewNote'
import Reader from './views/Reader'
import { setSkyMood } from './scene/skyState'
import { webglAvailable } from './lib/webgl'
import type { ReaderTab, View } from './lib/data'

// the three.js bundle loads after first paint, so the UI is usable immediately
const SkyScene = lazy(() => import('./scene/SkyScene'))

export default function App() {
  const [inApp, setInApp] = useState(false)
  const [view, setView] = useState<View>('home')
  const [noteIndex, setNoteIndex] = useState(0)
  const [tab, setTab] = useState<ReaderTab>('full')
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [gl] = useState(webglAvailable)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduced)
  }, [reduced])

  // the sky eases closer while reading
  useEffect(() => {
    setSkyMood(inApp && view === 'read' ? 1 : 0)
  }, [inApp, view])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }, [])

  const enter = (v: View = 'home') => {
    setInApp(true)
    setView(v)
  }
  const openRead = useCallback((t: ReaderTab, index: number) => {
    setNoteIndex(index)
    setTab(t)
    setInApp(true)
    setView('read')
  }, [])
  const goHome = useCallback(() => setView('home'), [])
  const openFirstNote = useCallback(() => openRead('full', 0), [openRead])

  const search = (q: string) => {
    setQuery(q)
    if (q && view !== 'library') setView('library')
  }

  return (
    <>
      {gl && (
        <Suspense fallback={null}>
          <SkyScene reduced={reduced} />
        </Suspense>
      )}

      {!inApp ? (
        <Landing onEnter={() => enter('home')} onPaste={() => enter('new')} onOpenNotes={() => openRead('full', 0)} still={reduced} />
      ) : (
        <div className="app">
          <Sidebar view={view} onNavigate={setView} onBrand={() => { setInApp(false); setView('home') }} />
          <div className="app-main">
            <Topbar query={query} onQuery={search} onSettings={() => setView('settings')} onSignOut={() => setInApp(false)} still={reduced} />
            <main style={{ display: 'contents' }} id="main">
              {view === 'home' && <Home onOpen={openRead} onToast={showToast} />}
              {view === 'library' && <Library query={query} onOpen={(i) => openRead('full', i)} />}
              {view === 'flashcards' && <FlashcardsView />}
              {view === 'quizzes' && <QuizzesView />}
              {view === 'progress' && <Progress />}
              {view === 'settings' && <Settings reduceMotion={reduced} onReduceMotion={setReduced} />}
              {view === 'new' && <NewNote onBack={goHome} onDone={openFirstNote} reduced={reduced} />}
              {view === 'read' && <Reader noteIndex={noteIndex} tab={tab} onTab={setTab} onBack={goHome} still={reduced} />}
            </main>
          </div>
        </div>
      )}

      <Toast message={toast} still={reduced} />
    </>
  )
}
