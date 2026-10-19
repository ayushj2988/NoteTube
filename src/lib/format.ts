export function toSeconds(stamp: string): number {
  const parts = stamp.split(':').map(Number)
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

export function formatTimestamp(total: number): string {
  const t = Math.max(0, Math.floor(total))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86_400_000], ['hour', 3_600_000], ['minute', 60_000]]
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf!.format(Math.round(diff / ms), unit)
  }
  return diff > 0 ? 'in a moment' : 'just now'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "10m", "1d", "6d", "2w", "3mo": the label shown on a review button. */
export function intervalLabel(days: number): string {
  if (days <= 0) return '10m'
  if (days < 14) return `${Math.round(days)}d`
  if (days < 60) return `${Math.round(days / 7)}w`
  return `${Math.round(days / 30)}mo`
}

export function weekdayShort(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })
}
