import { formatMinutes, weekdayShort } from '../lib/format'

interface Props {
  days: { date: string; minutes: number }[]
}

/** Minutes studied per day. Bars have text alternatives; the busiest day is drawn dark. */
export default function BarChart({ days }: Props) {
  const W = 300
  const H = 120
  const pad = 16
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const slot = W / days.length
  const bw = Math.max(4, Math.min(26, slot - 6))
  const peak = days.reduce((a, d) => (d.minutes > a.minutes ? d : a), days[0])
  const every = days.length > 10 ? 5 : 1
  const summary = days.map((d) => `${d.date}: ${formatMinutes(d.minutes)}`).join(', ')
  return (
    <svg viewBox={`0 0 ${W} ${H + pad}`} width="100%" role="img" aria-label={`Minutes studied per day. ${summary}`} className="chart">
      {days.map((d, i) => {
        const h = d.minutes > 0 ? Math.max(4, (d.minutes / max) * (H - 8)) : 3
        const x = i * slot + (slot - bw) / 2
        return (
          <g key={d.date}>
            <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(6, bw / 2)} fill={d.minutes === 0 ? 'rgba(16,38,74,.15)' : d === peak ? '#10264a' : '#2a6cd0'}>
              <title>{`${d.date}: ${formatMinutes(d.minutes)}`}</title>
            </rect>
            {i % every === 0 && (
              <text x={x + bw / 2} y={H + 12} textAnchor="middle" fontSize="9" fill="#3c5278">
                {days.length > 10 ? d.date.slice(8) : weekdayShort(d.date)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
