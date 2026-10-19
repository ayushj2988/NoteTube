import { lazy, Suspense, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { queryClient } from './api/queries'
import { AuthProvider } from './auth/AuthContext'
import RequireAuth from './auth/RequireAuth'
import Landing from './components/Landing'
import AppShell from './layout/AppShell'
import { webglAvailable } from './lib/webgl'
import Account from './pages/Account'
import AuthPage from './pages/AuthPage'
import Flashcards from './pages/Flashcards'
import Home from './pages/Home'
import Library from './pages/Library'
import NewNote from './pages/NewNote'
import NotFound from './pages/NotFound'
import Progress from './pages/Progress'
import Quizzes from './pages/Quizzes'
import QuizPage from './pages/QuizPage'
import Settings from './pages/Settings'
import { setSkyMood } from './scene/skyState'
import { MotionProvider, useMotion } from './ui/motion'
import { Spinner } from './ui/States'
import { ToastProvider } from './ui/Toast'

// three.js and the Markdown renderer load after first paint
const SkyScene = lazy(() => import('./scene/SkyScene'))
const NoteView = lazy(() => import('./pages/NoteView'))
const SharedPage = lazy(() => import('./pages/SharedPage'))

const GL = webglAvailable()

function Sky() {
  const { reduced } = useMotion()
  useEffect(() => () => setSkyMood(0), [])
  if (!GL) return null
  return (
    <Suspense fallback={null}>
      <SkyScene reduced={reduced} />
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Sky />
              <Suspense fallback={<div className="fullscreen"><Spinner label="Loading" /></div>}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<AuthPage mode="login" />} />
                  <Route path="/signup" element={<AuthPage mode="signup" />} />
                  <Route path="/s/:token" element={<SharedPage />} />
                  <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
                    <Route index element={<Home />} />
                    <Route path="library" element={<Library />} />
                    <Route path="notes/new" element={<NewNote />} />
                    <Route path="notes/:id" element={<NoteView />} />
                    <Route path="flashcards" element={<Flashcards />} />
                    <Route path="quizzes" element={<Quizzes />} />
                    <Route path="quizzes/:noteId" element={<QuizPage />} />
                    <Route path="progress" element={<Progress />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="account" element={<Account />} />
                    <Route path="*" element={<NotFound inApp />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </MotionProvider>
    </QueryClientProvider>
  )
}
