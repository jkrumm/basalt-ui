/** The fix counts of expr-n79: four rolling seven-day windows, newest first, eight classes, zeros kept. */

export const CLASS_KEYS = [
  'lint',
  'types',
  'flaky',
  'build',
  'deps',
  'deploy',
  'docs',
  'migration',
] as const
export type ClassKey = (typeof CLASS_KEYS)[number]

export const CLASS_NAME: Record<ClassKey, string> = {
  lint: 'Lint',
  types: 'Type errors',
  flaky: 'Flaky tests',
  build: 'Build config',
  deps: 'Dependency bumps',
  deploy: 'Deploy scripts',
  docs: 'Docs drift',
  migration: 'Migrations',
}

export type FixWindow = {
  /** The window as a date range, 'Nov 14–20'. */
  label: string
  /** Its first day, 'Nov 14': the tick on a narrow axis. */
  start: string
  /** Its last day, 'Nov 20'. */
  end: string
  total: number
  repos: number
  counts: Record<ClassKey, number>
}

/** Newest first: the window ending Nov 20 comes before the one ending Nov 13. */
const WINDOWS = [
  { label: 'Nov 14–20', start: 'Nov 14', end: 'Nov 20' },
  { label: 'Nov 7–13', start: 'Nov 7', end: 'Nov 13' },
  { label: 'Oct 31–Nov 6', start: 'Oct 31', end: 'Nov 6' },
  { label: 'Oct 24–30', start: 'Oct 24', end: 'Oct 30' },
] as const

/** The count of the oldest window, per class: migrations never land. */
const OLDEST: Record<ClassKey, number> = {
  lint: 15,
  types: 12,
  flaky: 4,
  build: 9,
  deps: 8,
  deploy: 6,
  docs: 5,
  migration: 0,
}

/** Flaky tests: 4, 3, 3, then double the prior window (a surge makes it far more). */
const FLAKY_OLD_TO_NEW = [4, 3, 3] as const

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build({ surge }: { surge: boolean }): FixWindow[] {
  const rand = seeded(79)
  const byWindow: Record<ClassKey, number>[] = [{ ...OLDEST }]
  for (let i = 1; i < WINDOWS.length; i += 1) {
    const prior = byWindow[i - 1]
    if (prior === undefined) continue
    const next = { ...prior }
    for (const key of CLASS_KEYS) {
      const fall = 0.68 + 0.2 * rand()
      next[key] = Math.round(prior[key] * fall)
    }
    const flaky = FLAKY_OLD_TO_NEW[i]
    if (flaky !== undefined) next.flaky = flaky
    else next.flaky = surge ? 38 : (byWindow[i - 1]?.flaky ?? 0) * 2
    byWindow.push(next)
  }
  return byWindow
    .map((counts, i): FixWindow => {
      const win = WINDOWS[WINDOWS.length - 1 - i]
      const total = CLASS_KEYS.reduce((sum, key) => sum + counts[key], 0)
      return {
        label: win?.label ?? '',
        start: win?.start ?? '',
        end: win?.end ?? '',
        total,
        repos: Math.max(1, Math.round(total / 6.5)),
        counts,
      }
    })
    .reverse()
}

/** `none` is the factory before its first window closed; `surge` is flaky tests far out of range. */
export function windowsFor(fixture: string | undefined): FixWindow[] {
  if (fixture === 'none') return []
  return build({ surge: fixture === 'surge' })
}

export type Trend = 'less' | 'same' | 'more' | 'none'

export type ClassRow = {
  id: ClassKey
  name: string
  now: number
  prior: number
  change: number
  trend: Trend
}

/** One row per class: the newest window against the one before it. A class at zero in every window is `none`. */
export function classRows(windows: readonly FixWindow[]): ClassRow[] {
  const [now, prior] = windows
  if (now === undefined || prior === undefined) return []
  return CLASS_KEYS.map((id): ClassRow => {
    const n = now.counts[id]
    const p = prior.counts[id]
    const never = windows.every((w) => w.counts[id] === 0)
    const trend: Trend = never ? 'none' : n < p ? 'less' : n > p ? 'more' : 'same'
    return { id, name: CLASS_NAME[id], now: n, prior: p, change: n - p, trend }
  }).sort((a, b) => b.now - a.now || a.name.localeCompare(b.name))
}

/** How many classes landed fewer fixes in `windows[0]` than in `windows[1]`; `windows` may start at any depth. */
export function fallingClasses(windows: readonly FixWindow[]): number {
  return classRows(windows).filter((r) => r.trend === 'less').length
}
