import { useEffect, useRef, useState } from 'react'
import { isYouTubeUrl } from '../lib/youtube'

const STEPS = ['Fetching transcript', 'Finding key concepts', 'Writing structured notes', 'Building flashcards and quiz']
const STYLES = ['Detailed', 'Concise', 'Outline']
const SAMPLE = 'https://youtube.com/watch?v=dsa-graphs-101'

interface Props {
  onBack: () => void
  onDone: () => void
  reduced: boolean
}

export default function NewNote({ onBack, onDone, reduced }: Props) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [style, setStyle] = useState(0)
  const [stage, setStage] = useState(-1)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [])

  // walk through the generation steps, then open the reader
  useEffect(() => {
    if (stage < 0) return
    const last = stage >= STEPS.length
    const t = window.setTimeout(() => (last ? onDone() : setStage(stage + 1)), last ? 500 : reduced ? 200 : 800)
    return () => window.clearTimeout(t)
  }, [stage, reduced, onDone])

  const fetchLecture = (value = url) => {
    if (!isYouTubeUrl(value)) {
      setError("That doesn't look like a YouTube link. Try youtube.com/watch?v=… or youtu.be/…")
      setReady(false)
      return
    }
    setError('')
    setReady(true)
  }

  const running = stage >= 0

  return (
    <section className="view" aria-labelledby="new-title">
      <button className="back" onClick={onBack}>← Back</button>
      <h1 id="new-title">New note from <span>YouTube.</span></h1>
      <p className="sb">Paste a lecture link and we'll build your notes.</p>

      <div className="gl dense hero">
        <div className="urlrow">
          <input
            ref={input}
            aria-label="YouTube link"
            placeholder="https://youtube.com/watch?v=…"
            value={url}
            inputMode="url"
            onChange={(e) => { setUrl(e.target.value); setReady(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchLecture() }}
          />
          <button className="btn" onClick={() => fetchLecture()}>Fetch lecture</button>
        </div>
        <p className="nerr" role="alert">{error}</p>
        <button className="link" onClick={() => { setUrl(SAMPLE); fetchLecture(SAMPLE) }}>Use a sample link</button>
        {ready && (
          <div className="gl dense pv">
            <div className="th" style={{ background: '#2a6cd0', width: 160 }}><small>48:12</small></div>
            <div>
              <b>Graph Traversal: BFS &amp; DFS</b><br />
              <span className="mu">Algorithms Lab · 48:12 · English captions found</span>
            </div>
          </div>
        )}
      </div>

      <div className="gl dense hero" style={{ marginTop: 14 }}>
        <h2>Note options</h2>
        <p className="mu">Style</p>
        <div className="chips" role="group" aria-label="Note style">
          {STYLES.map((s, i) => (
            <button key={s} aria-pressed={i === style} onClick={() => setStyle(i)}>{s}</button>
          ))}
        </div>
        <p className="mu" style={{ marginTop: 12 }}>Also create</p>
        <label className="tg"><span>Flashcards</span><input type="checkbox" defaultChecked /></label>
        <label className="tg"><span>Quiz questions</span><input type="checkbox" defaultChecked /></label>
        <label className="tg"><span>Clickable timestamps</span><input type="checkbox" defaultChecked /></label>
        <div className="row" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
          <button className="btn" disabled={!ready || running} onClick={() => setStage(0)}>Generate notes</button>
          <select aria-label="Language" defaultValue="English">
            <option>English</option>
            <option>Hindi</option>
            <option>Hinglish</option>
          </select>
        </div>
        {running && (
          <ul className="steps" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s}>{i < stage ? '✓' : i === stage ? '…' : '○'} {s}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
