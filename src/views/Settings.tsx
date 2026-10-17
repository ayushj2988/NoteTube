import { useState } from 'react'

interface Props {
  reduceMotion: boolean
  onReduceMotion: (v: boolean) => void
}

export default function Settings({ reduceMotion, onReduceMotion }: Props) {
  const [reminder, setReminder] = useState(true)
  const [autoCards, setAutoCards] = useState(true)
  return (
    <section className="view" aria-labelledby="st-title">
      <h1 id="st-title">Settings</h1>
      <p className="sb">Make NoteTube yours.</p>
      <div className="gl dense hero">
        <label className="tg"><span>Daily study reminder</span><input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /></label>
        <label className="tg"><span>Auto-generate flashcards from notes</span><input type="checkbox" checked={autoCards} onChange={(e) => setAutoCards(e.target.checked)} /></label>
        <label className="tg"><span>Reduce background motion</span><input type="checkbox" checked={reduceMotion} onChange={(e) => onReduceMotion(e.target.checked)} /></label>
      </div>
    </section>
  )
}
