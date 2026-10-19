import { useRef, useState, type KeyboardEvent } from 'react'
import CardsPanel from '../components/CardsPanel'
import QuizPanel from '../components/QuizPanel'
import LiquidLayer from '../components/LiquidLayer'
import { KEY_CONCEPTS, LECTURE_SECONDS, NOTES, TIMESTAMPS, type ReaderTab } from '../lib/data'

const TABS: { id: ReaderTab; label: string }[] = [
  { id: 'full', label: 'Full notes' },
  { id: 'skim', label: 'Skim' },
  { id: 'cards', label: 'Flashcards' },
  { id: 'quiz', label: 'Quiz' },
]

interface Props {
  noteIndex: number
  tab: ReaderTab
  onTab: (t: ReaderTab) => void
  onBack: () => void
  still: boolean
}

export default function Reader({ noteIndex, tab, onTab, onBack, still }: Props) {
  const note = NOTES[noteIndex]
  const [now, setNow] = useState('00:00')
  const [progress, setProgress] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const seek = (stamp: string) => {
    const [m, s] = stamp.split(':').map(Number)
    setNow(stamp)
    setProgress(((m * 60 + s) / LECTURE_SECONDS) * 100)
  }

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = (i + d + TABS.length) % TABS.length
    onTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="view" aria-label={`Notes: ${note.title}`}>
      <button className="back" onClick={onBack}>← Back</button>
      <div className="reader">
        <div className="gl dense vid">
          <div className="screen"><div className="play" aria-hidden="true">▶</div></div>
          <div className="bar" role="progressbar" aria-label="Lecture position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <p style={{ margin: '8px 4px 0' }} className="mu"><span>{note.title}</span> · <span>{now}</span></p>
          <p style={{ margin: '6px 4px' }}><i className="tag">{note.tag}</i></p>
        </div>

        <div className="reader-right">
          <div className="tabs-pill liquid">
            <LiquidLayer radius={999} blur={0.2} displacement={26} still={still} />
          <div className="tabs" role="tablist" aria-label="Study mode">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => { tabRefs.current[i] = el }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="pane"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => onTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {t.label}
              </button>
            ))}
          </div>
          </div>
          <div className="gl dense pane" id="pane" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'full' && (
              <>
                <h3>Key concepts</h3>
                {KEY_CONCEPTS.map((k) => <span key={k} className="kc">{k}</span>)}
                <h3>Notes</h3>
                {TIMESTAMPS.map(([stamp, text]) => (
                  <p key={stamp}><button className="ts" onClick={() => seek(stamp)} aria-label={`Jump to ${stamp}`}>{stamp}</button>{text}</p>
                ))}
              </>
            )}
            {tab === 'skim' && (
              <>
                <h3>In 30 seconds</h3>
                <p>Graphs = nodes + edges. <b>BFS</b> spreads outward with a queue, so it finds shortest unweighted paths. <b>DFS</b> goes deep with a stack, good for cycles and ordering.</p>
              </>
            )}
            {tab === 'cards' && <CardsPanel withChips={false} />}
            {tab === 'quiz' && <QuizPanel />}
          </div>
        </div>
      </div>
    </section>
  )
}
