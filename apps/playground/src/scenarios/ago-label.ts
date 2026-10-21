const MIN_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** `date` as a label against a fixed reading time, so the label never drifts with the live clock. */
export const agoLabel = (date: Date, now: Date): string => {
  const ms = now.getTime() - date.getTime()
  if (ms < MIN_MS) return 'just now'
  if (ms < HOUR_MS) return `${Math.floor(ms / MIN_MS)} min ago`
  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  const days = Math.floor(ms / DAY_MS)
  if (days === 1) return 'yesterday'
  return days < 14 ? `${days} days ago` : `${Math.round(days / 7)} weeks ago`
}
