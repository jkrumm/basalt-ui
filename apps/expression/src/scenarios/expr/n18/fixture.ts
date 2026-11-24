/** Queue waits (scenario expr-n18): a seeded week of about 120 waits, a few still open at `NOW`. */

const NOW = Date.UTC(2026, 10, 16, 12, 0)
const HOUR = 3_600_000
const WEEK = 7 * 24 * HOUR

const REASONS = [
  { key: 'host-slot', label: 'Host slot' },
  { key: 'account-quota', label: 'Account quota' },
  { key: 'owner-answer', label: 'Owner answer' },
  { key: 'another-issue', label: 'Another Issue' },
  { key: 'merge-window', label: 'Merge window' },
] as const

export type ReasonKey = (typeof REASONS)[number]['key']

/** `end: null` is a wait still open at `NOW`. */
export type Wait = { issue: number; reason: ReasonKey; start: number; end: number | null }

/** Per reason: how many waits and the span in hours they run (short to long). */
const SHAPE: Record<ReasonKey, { count: number; min: number; max: number }> = {
  'host-slot': { count: 38, min: 0.4, max: 5 },
  'account-quota': { count: 14, min: 2, max: 9 },
  'owner-answer': { count: 22, min: 1, max: 16 },
  'another-issue': { count: 24, min: 1, max: 10 },
  'merge-window': { count: 22, min: 0.3, max: 3 },
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildWaits(): Wait[] {
  const rand = mulberry32(1816)
  const waits: Wait[] = []
  for (const { key } of REASONS) {
    const { count, min, max } = SHAPE[key]
    for (let i = 0; i < count; i++) {
      // Skewed to short: most waits are brief, a few run long.
      const hours = min + (max - min) * rand() ** 2
      const end = NOW - Math.floor(rand() * (WEEK - hours * HOUR))
      waits.push({
        issue: 1400 + Math.floor(rand() * 300),
        reason: key,
        start: end - Math.round(hours * HOUR),
        end,
      })
    }
  }
  // The newest waits of two reasons are still open.
  const open = (reason: ReasonKey, n: number): void => {
    const newest = waits
      .filter((w) => w.reason === reason)
      .sort((a, b) => (b.end ?? 0) - (a.end ?? 0))
      .slice(0, n)
    for (const w of newest) w.end = null
  }
  open('owner-answer', 3)
  open('account-quota', 2)
  open('another-issue', 2)
  open('host-slot', 2)
  return waits.sort((a, b) => a.start - b.start)
}

const BASE = buildWaits()

/** `quiet`: no wait for the merge window (a zero reason); `extreme`: one owner answer open for 6.5 days. */
export function waitsFor(fixture: string | undefined): readonly Wait[] {
  if (fixture === 'quiet') return BASE.filter((w) => w.reason !== 'merge-window')
  if (fixture === 'extreme') {
    return [...BASE, { issue: 1388, reason: 'owner-answer', start: NOW - 156 * HOUR, end: null }]
  }
  return BASE
}

export type ReasonRow = {
  reason: ReasonKey
  label: string
  waits: number
  stillOpen: number
  doneHours: number
  openHours: number
  totalHours: number
  longest: { issue: number; hours: number } | null
}

/** One row per reason, most hours first; a reason with no wait stays, last, at zero. */
export function reasonRows(waits: readonly Wait[]): ReasonRow[] {
  const rows = REASONS.map(({ key, label }): ReasonRow => {
    const mine = waits.filter((w) => w.reason === key)
    let doneHours = 0
    let openHours = 0
    let longest: ReasonRow['longest'] = null
    for (const w of mine) {
      const hours = ((w.end ?? NOW) - w.start) / HOUR
      if (w.end === null) openHours += hours
      else doneHours += hours
      if (longest === null || hours > longest.hours) longest = { issue: w.issue, hours }
    }
    return {
      reason: key,
      label,
      waits: mine.length,
      stillOpen: mine.filter((w) => w.end === null).length,
      doneHours,
      openHours,
      totalHours: doneHours + openHours,
      longest,
    }
  })
  return rows.sort((a, b) => b.totalHours - a.totalHours)
}
