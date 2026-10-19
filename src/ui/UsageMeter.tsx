import { useUsage } from '../api/queries'
import { relativeTime } from '../lib/format'

export default function UsageMeter({ compact = false }: { compact?: boolean }) {
  const { data, isPending, isError } = useUsage()
  if (isError) return compact ? null : <p className="mu">Usage unavailable right now.</p>
  if (isPending || !data) return compact ? <div className="skel" style={{ height: 34 }} aria-hidden="true" /> : null
  const left = Math.max(0, data.limit - data.used)
  const pct = Math.min(100, (data.used / data.limit) * 100)
  return (
    <div className="usage" data-low={left === 0 ? 'true' : undefined}>
      <div className="usage-line">
        <b>{left}</b> of {data.limit} generations left today
      </div>
      <div className="meter" role="progressbar" aria-label="Daily generations used" aria-valuemin={0} aria-valuemax={data.limit} aria-valuenow={data.used}>
        <i style={{ width: `${pct}%` }} />
      </div>
      {!compact && <p className="mu">Resets {relativeTime(data.resets_at)}.</p>}
    </div>
  )
}
