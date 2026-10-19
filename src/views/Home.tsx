import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import NoteList from '../components/NoteList'
import { WEEK_BARS, type ReaderTab } from '../lib/data'

interface Props {
  onOpen: (tab: ReaderTab, index: number) => void
  onToast: (msg: string) => void
}

const QUICK: { tab: ReaderTab; icon: string; title: string; sub: string }[] = [
  { tab: 'full', icon: '✎', title: 'AI Notes', sub: 'Structured, searchable' },
  { tab: 'skim', icon: '⚡', title: 'Skim Mode', sub: 'Five-minute recap' },
  { tab: 'cards', icon: '◧', title: 'Flashcards', sub: 'Spaced review' },
  { tab: 'quiz', icon: '?', title: 'Quiz Me', sub: 'Test recall' },
]

export default function Home({ onOpen, onToast }: Props) {
  const [url, setUrl] = useState('https://youtube.com/watch?v=dsa-graphs-101')
  const [transcript, setTranscript] = useState('')
  const [fileName, setFileName] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const generate = () => {
    if (busy) return
    if (!/youtu/.test(url) && !transcript.trim()) {
      onToast('Add a YouTube link or a transcript first')
      return
    }
    setBusy(true)
    timer.current = window.setTimeout(() => {
      setBusy(false)
      onOpen('full', 0)
    }, 1100)
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setTranscript(String(reader.result ?? ''))
      setFileName(file.name)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <section className="view" aria-labelledby="home-title">
      <h1 id="home-title">Turn lectures into <span>notes.</span></h1>
      <p className="sb">Paste a YouTube lecture. Get structured notes, flashcards and quizzes.</p>

      <div className="gl hero">
        <div className="urlrow">
          <input
            aria-label="YouTube URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') generate() }}
            inputMode="url"
          />
          <button className="btn" onClick={generate} disabled={busy}>{busy ? 'Reading lecture…' : 'Generate Notes'}</button>
        </div>
        <button className="link" aria-expanded={showTranscript} onClick={() => setShowTranscript((s) => !s)}>+ Or paste / upload a transcript</button>
        {showTranscript && (
          <div>
            <textarea aria-label="Transcript" placeholder="Paste transcript text here…" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
            <div className="tbox-row">
              <label className="btn dark" style={{ cursor: 'pointer' }}>
                Upload .txt, .srt or .vtt
                <input type="file" accept=".txt,.srt,.vtt,text/plain" className="sr-only" onChange={onFile} />
              </label>
              {fileName && <span className="mu">{fileName}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="grid4">
        {QUICK.map((q) => (
          <button key={q.tab} className="gl lift qc" onClick={() => onOpen(q.tab, 0)}>
            <div className="ico" aria-hidden="true">{q.icon}</div>
            <b>{q.title}</b>
            <span>{q.sub}</span>
          </button>
        ))}
      </div>

      <div className="cols">
        <div>
          <h2>Recent notes</h2>
          <NoteList indices={[0, 1, 2]} onOpen={(i) => onOpen('full', i)} />
        </div>
        <div className="gl dense stats">
          <h2>This week</h2>
          <svg viewBox="0 0 220 90" width="100%" role="img" aria-label="Minutes studied per day, highest on Thursday">
            {WEEK_BARS.map((b) => (
              <rect key={b.x} x={b.x} y={b.y} width={22} height={b.h} rx={6} fill={b.dark ? '#10264a' : '#2a6cd0'} />
            ))}
          </svg>
          <div className="big">
            <div><b>6.4h</b><span>studied</span></div>
            <div><b>84</b><span>cards due</span></div>
            <div><b>91%</b><span>quiz avg</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}
