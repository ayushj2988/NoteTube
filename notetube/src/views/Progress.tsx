import { MASTERY } from '../lib/data'

const STATS = [
  { b: '6.4h', s: 'studied this week' },
  { b: '84', s: 'cards due' },
  { b: '91%', s: 'quiz average' },
  { b: '12', s: 'day streak' },
]

export default function Progress() {
  return (
    <section className="view" aria-labelledby="pg-title">
      <h1 id="pg-title">Progress</h1>
      <p className="sb">Your learning at a glance.</p>
      <div className="grid4">
        {STATS.map((s) => (
          <div key={s.s} className="gl dense stats"><div className="big"><div><b>{s.b}</b><span>{s.s}</span></div></div></div>
        ))}
      </div>
      <div className="gl dense hero">
        <h2>Subject mastery</h2>
        {MASTERY.map((m) => (
          <div key={m.name} className="mb" role="img" aria-label={`${m.name}: ${m.v}%`}>
            <span>{m.name}</span>
            <i style={{ ['--w' as string]: `${m.v}%` }} />
            <b>{m.v}%</b>
          </div>
        ))}
      </div>
    </section>
  )
}
