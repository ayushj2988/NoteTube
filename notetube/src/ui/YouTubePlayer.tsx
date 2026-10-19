import { useEffect, useRef, useState, type RefObject } from 'react'

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
}
interface YTNamespace {
  Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve()
      }
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.onerror = () => {
        apiPromise = null
        reject(new Error('YouTube player failed to load'))
      }
      document.head.appendChild(s)
    })
  }
  return apiPromise
}

export interface PlayerHandle {
  seek: (seconds: number) => void
}

interface Props {
  videoId: string
  start?: number
  /** fires about twice a second while playing, and once after every seek */
  onTime?: (seconds: number, duration: number) => void
  handleRef?: RefObject<PlayerHandle | null>
}

export default function YouTubePlayer({ videoId, start = 0, onTime, handleRef }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let player: YTPlayer | null = null
    let timer: number | undefined
    let pendingSeek: number | null = null
    let ready = false
    const host = document.createElement('div')
    wrap.current?.appendChild(host)
    setStatus('loading')

    const emit = () => {
      if (!player) return
      try {
        onTimeRef.current?.(player.getCurrentTime(), player.getDuration())
      } catch {
        /* player is being torn down */
      }
    }
    const stopPolling = () => window.clearInterval(timer)
    const startPolling = () => {
      stopPolling()
      timer = window.setInterval(emit, 500)
    }

    const handle: PlayerHandle = {
      seek: (s) => {
        if (!player || !ready) {
          pendingSeek = s
          return
        }
        player.seekTo(s, true)
        player.playVideo()
        window.setTimeout(emit, 150)
      },
    }
    if (handleRef) handleRef.current = handle

    loadApi()
      .then(() => {
        if (cancelled || !window.YT) return
        player = new window.YT.Player(host, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(start), origin: window.location.origin },
          events: {
            onReady: () => {
              if (cancelled) return
              ready = true
              setStatus('ready')
              if (pendingSeek !== null) {
                player?.seekTo(pendingSeek, true)
                player?.playVideo()
                pendingSeek = null
              }
              emit()
            },
            onStateChange: (e: { data: number }) => (e.data === 1 ? startPolling() : (stopPolling(), emit())),
            onError: () => !cancelled && setStatus('error'),
          },
        })
      })
      .catch(() => !cancelled && setStatus('error'))

    return () => {
      cancelled = true
      stopPolling()
      if (handleRef) handleRef.current = null
      try {
        player?.destroy()
      } catch {
        /* already gone */
      }
      host.remove()
    }
    // start only matters for the first load; later seeks go through the handle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  return (
    <div className="player">
      <div ref={wrap} className="player-frame" />
      {status === 'loading' && <div className="player-msg" role="status">Loading player…</div>}
      {status === 'error' && (
        <div className="player-msg" role="alert">
          <p>This video can't be played here.</p>
          <a className="btn dark" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
        </div>
      )}
    </div>
  )
}
