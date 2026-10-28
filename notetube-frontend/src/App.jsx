import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './auth.jsx'
import { SceneProvider, useScene } from './scene/SceneContext.jsx'
import { webglAvailable } from './webgl.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AppLayout from './components/AppLayout.jsx'
import Landing from './pages/Landing.jsx'
import NotFound from './pages/NotFound.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Processing from './pages/Processing.jsx'
import Notes from './pages/Notes.jsx'
import Skim from './pages/Skim.jsx'
import Flashcards from './pages/Flashcards.jsx'
import Quiz from './pages/Quiz.jsx'
import Library from './pages/Library.jsx'
import Progress from './pages/Progress.jsx'
import Settings from './pages/Settings.jsx'

const Scene = lazy(() => import('./scene/Scene.jsx'))
const hasGL = webglAvailable()

// Which scene "view" the dots should show for a URL.
function viewFor(path) {
  if (path === '/') return 'home'
  if (path === '/login' || path === '/signup') return 'login'
  if (path.startsWith('/processing')) return 'processing'
  if (path.endsWith('/skim')) return 'skim'
  if (path.startsWith('/notes')) return 'workspace'
  return path.slice(1).split('/')[0] || 'home'
}

// Tells the scene which page is open, scrolls to the top on a new page, and sends Esc back to the landing page.
function RouteEffects() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const scene = useScene()
  useEffect(() => {
    scene.state.view = viewFor(pathname)
    if (pathname !== '/') window.scrollTo(0, 0)
  }, [pathname, scene])
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (e.key === 'Escape' && pathname !== '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathname, navigate])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <SceneProvider>
        {hasGL && (
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        )}
        <RouteEffects />
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/processing/:id" element={<Processing />} />
            <Route path="/notes/:id" element={<Notes />} />
            <Route path="/notes/:id/skim" element={<Skim />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/library" element={<Library />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </SceneProvider>
    </AuthProvider>
  )
}
