import { useMemo, useState, type RefObject } from 'react'
import type { VideoMeta } from '../../api/types'
import type { Chapter } from '../../lib/chapters'
import { formatTimestamp } from '../../lib/format'
import YouTubePlayer, { type PlayerHandle } from '../YouTubePlayer'

interface Props {
  video: VideoMeta
  chapters: Chapter[]
  handleRef: RefObject<PlayerHandle | null>
}

/** Owns the playback clock, so only this panel re-renders twice a second, not the whole note. */
export default function PlayerPanel({ video, chapters, handleRef }: Props) {
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(video.duration_seconds)

  const active = useMemo(() => {
    let idx = -1
    chapters.forEach((c, i) => {
      if (c.seconds <= time + 0.5) idx = i
    })
    return idx
  }, [chapters, time])

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0
  return (
    <div className="gl dense vid">
      <YouTubePlayer
        videoId={video.id}
        handleRef={handleRef}
        onTime={(t, d) => {
          setTime(t)
          if (d > 0) setDuration(d)
        }}
      />
      <div className="bar" role="progressbar" aria-label="Video position" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)} aria-valuetext={`${formatTimestamp(time)} of ${formatTimestamp(duration)}`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="mu vid-meta">
        <span>{video.channel}</span>
        <span>{formatTimestamp(time)} / {formatTimestamp(duration)}</span>
      </p>
      {chapters.length > 0 && (
        <nav aria-label="Chapters">
          <h2 className="chap-title">Chapters</h2>
          <ol className="chapters">
            {chapters.map((c, i) => (
              <li key={`${c.seconds}-${i}`}>
                <button type="button" aria-current={i === active ? 'true' : undefined} onClick={() => handleRef.current?.seek(c.seconds)}>
                  <span className="ts-static">{c.stamp}</span>
                  <span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  )
}
