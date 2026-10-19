import { useEffect, useRef, useState } from 'react'

interface GoogleId {
  initialize(cfg: { client_id: string; callback: (r: { credential: string }) => void }): void
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

const CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID
let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        gisPromise = null
        reject(new Error('Google sign-in failed to load'))
      }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

interface Props {
  onCredential: (credential: string) => void
  onProblem: (message: string) => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

export default function GoogleButton({ onCredential, onProblem, text = 'continue_with' }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  cb.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled || !host.current || !window.google) return
        window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => cb.current(r.credential) })
        window.google.accounts.id.renderButton(host.current, {
          theme: 'outline', size: 'large', shape: 'pill', text, logo_alignment: 'center', width: host.current.clientWidth || 320,
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [text])

  if (CLIENT_ID && !failed) return <div ref={host} className="google-host" aria-label="Sign in with Google" />

  return (
    <button
      type="button"
      className="google-fallback"
      onClick={() =>
        onProblem(
          failed
            ? "Google sign-in couldn't load. Check your connection or use email instead."
            : 'Google sign-in is not set up yet. Add VITE_GOOGLE_CLIENT_ID to enable it, or use email.',
        )
      }
    >
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
        <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
      </svg>
      Continue with Google
    </button>
  )
}
