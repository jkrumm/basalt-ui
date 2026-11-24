/**
 * Seeded fixture for expr-n89: the waits the factory adds between Issues over 30 days, the ten test
 * steps with the highest peak memory, and the clean-up counter. Same seed, same data, on every build.
 */

export type Verdict = 'needed' | 'notNeeded' | 'notMeasured' | 'takenBack'

export type WaitSource = {
  id: string
  name: string
  needed: number
  notNeeded: number
  notMeasured: number
  takenBack: number
  total: number
  /** Minutes the waits judged not needed added to the queue; `null` where no wait was measured. */
  notNeededMinutes: number | null
  /** The day the source was switched off after its waits, else `null`. */
  stoppedOn: Date | null
}

export type TestStep = {
  name: string
  /** The median run's peak memory, GB. */
  median: number
  /** The highest single run's peak memory, GB. */
  peak: number
  runs: number
  /** Runs within a fifth of the peak, the peak run included. */
  nearPeak: number
}

export type CleanDay = { day: Date; released: number }

export type Scene = {
  sources: readonly WaitSource[]
  steps: readonly TestStep[]
  days: readonly CleanDay[]
  /** Share of the prior 30 days' waits judged needed, 0 to 1. */
  priorNeededShare: number
  /** The median released count of the days before the gap. */
  typicalDay: number
}

const DAY_MS = 86_400_000
/** The window's last day, UTC (the page's "today"). */
export const LAST_DAY = new Date(Date.UTC(2026, 10, 21))
const DAYS = 30

/** mulberry32: a tiny seeded generator, so the fixture never changes between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Counts = Record<Verdict, number>

const sourceRow = (
  id: string,
  name: string,
  counts: Counts,
  minutes: { low: number; high: number } | null,
  stoppedOn: Date | null,
  rand: () => number,
): WaitSource => {
  let notNeededMinutes: number | null = null
  if (minutes !== null) {
    notNeededMinutes = 0
    for (let i = 0; i < counts.notNeeded; i += 1) {
      notNeededMinutes += Math.round(minutes.low + rand() * (minutes.high - minutes.low))
    }
  }
  return {
    id,
    name,
    ...counts,
    total: counts.needed + counts.notNeeded + counts.notMeasured + counts.takenBack,
    notNeededMinutes,
    stoppedOn,
  }
}

const sourcesFor = (calm: boolean): readonly WaitSource[] => {
  const rand = seeded(89)
  const stopped = new Date(Date.UTC(2026, 10, 12))
  if (calm) {
    return [
      sourceRow(
        'overlap',
        'File overlap',
        { needed: 40, notNeeded: 0, notMeasured: 3, takenBack: 3 },
        { low: 10, high: 50 },
        null,
        rand,
      ),
      sourceRow(
        'plan',
        'Plan edge',
        { needed: 30, notNeeded: 0, notMeasured: 2, takenBack: 2 },
        { low: 10, high: 50 },
        null,
        rand,
      ),
      sourceRow(
        'memory',
        'Memory guard',
        { needed: 20, notNeeded: 0, notMeasured: 1, takenBack: 1 },
        { low: 10, high: 50 },
        null,
        rand,
      ),
      sourceRow(
        'spacing',
        'Slot spacing',
        { needed: 0, notNeeded: 0, notMeasured: 16, takenBack: 2 },
        null,
        null,
        rand,
      ),
    ]
  }
  return [
    sourceRow(
      'overlap',
      'File overlap',
      { needed: 33, notNeeded: 8, notMeasured: 2, takenBack: 3 },
      { low: 12, high: 55 },
      null,
      rand,
    ),
    sourceRow(
      'plan',
      'Plan edge',
      { needed: 17, notNeeded: 11, notMeasured: 3, takenBack: 3 },
      { low: 15, high: 80 },
      null,
      rand,
    ),
    sourceRow(
      'memory',
      'Memory guard',
      { needed: 3, notNeeded: 15, notMeasured: 1, takenBack: 3 },
      { low: 20, high: 95 },
      stopped,
      rand,
    ),
    sourceRow(
      'spacing',
      'Slot spacing',
      { needed: 0, notNeeded: 0, notMeasured: 16, takenBack: 2 },
      null,
      null,
      rand,
    ),
  ]
}

/** [name, the median run's peak memory in GB, runs in 30 days]. */
const STEPS: readonly (readonly [string, number, number])[] = [
  ['e2e', 2.4, 41],
  ['ui', 7.7, 52],
  ['site', 6.9, 28],
  ['pack', 5.8, 30],
  ['unit', 4.9, 118],
  ['tsc', 4.3, 64],
  ['size', 3.5, 30],
  ['lint', 2.8, 118],
  ['docs', 2.3, 22],
  ['cli', 1.9, 64],
]
/** The one run far above the rest, on the first step. */
const OUTLIER_GB = 14.6

const median = (xs: readonly number[]): number => {
  const sorted = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? 0) + hi) / 2
}

const round1 = (n: number): number => Math.round(n * 10) / 10

const stepsFor = (calm: boolean): readonly TestStep[] => {
  const rand = seeded(8901)
  const steps = STEPS.map(([name, mid, runs]): TestStep => {
    const all = Array.from({ length: runs }, () => mid * (0.94 + rand() * 0.12))
    if (name === 'e2e' && !calm) all[runs - 1] = OUTLIER_GB
    const peak = Math.max(...all)
    return {
      name,
      median: round1(median(all)),
      peak: round1(peak),
      runs,
      nearPeak: all.filter((r) => r >= peak * 0.8).length,
    }
  })
  return steps.toSorted((a, b) => b.peak - a.peak)
}

const daysFor = (calm: boolean): { days: readonly CleanDay[]; typicalDay: number } => {
  const rand = seeded(890)
  const days = Array.from({ length: DAYS }, (_, i): CleanDay => {
    const day = new Date(LAST_DAY.getTime() - (DAYS - 1 - i) * DAY_MS)
    const ran = 3 + Math.floor(rand() * 9)
    if (calm) return { day, released: ran }
    if (i === DAYS - 1) return { day, released: 40 }
    return { day, released: i >= DAYS - 6 ? 0 : ran }
  })
  return { days, typicalDay: median(days.slice(0, DAYS - 6).map((d) => d.released)) }
}

/** `calm` is the only named fixture; anything else is the rest state. */
export function sceneFor(fixture: string | undefined): Scene {
  const calm = fixture === 'calm'
  const { days, typicalDay } = daysFor(calm)
  return {
    sources: sourcesFor(calm),
    steps: stepsFor(calm),
    days,
    priorNeededShare: calm ? 0.7 : 0.38,
    typicalDay,
  }
}
