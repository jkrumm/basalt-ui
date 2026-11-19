/** Factory health measures (scenario expr-n27): 8 weekly measures, 12 weeks, the last one partial. Seeded, so every run draws the same weeks. */

export type Measure = {
  id: string
  name: string
  /** What the figure counts, spelled short: `h`, `%`, `/day`. */
  unit: string
  /** The direction that counts as better. */
  better: 'lower' | 'higher'
  /** One plain sentence of what the figure means. */
  info: string
  /** Fraction digits of the printed figure. */
  digits: number
  /** Twelve weekly values, oldest first; `null` is a week nobody measured. The last is the partial week. */
  weeks: readonly (number | null)[]
}

/** The ISO week number of the partial week. */
export const THIS_WEEK = 47
const WEEK_COUNT = 12
export const FIRST_WEEK = THIS_WEEK - WEEK_COUNT + 1

/** mulberry32: a small seeded generator, so a fixture never changes between runs. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Spec = Omit<Measure, 'weeks'> & {
  seed: number
  from: number
  to: number
  /** Noise as a share of the value. */
  noise: number
  /** This week's value against last week's, as a ratio; set so the page has both movers and sliders. */
  thisWeek: number
  /** Weeks (0-based) with no value. */
  gaps?: readonly number[]
  /** Weeks (0-based) pinned to a value: the spike and the zero. */
  pins?: Readonly<Record<number, number>>
}

const SPECS: readonly Spec[] = [
  {
    id: 'fix-commits',
    name: 'Fix commits',
    unit: '/day',
    better: 'lower',
    info: 'Commits that repair an earlier change, per working day.',
    digits: 1,
    seed: 11,
    from: 9,
    to: 6.4,
    noise: 0.06,
    thisWeek: 1.22,
  },
  {
    id: 'rounds',
    name: 'Rounds to pass',
    unit: 'rounds',
    better: 'lower',
    info: 'Review rounds a change needs before it passes.',
    digits: 1,
    seed: 23,
    from: 2.7,
    to: 1.9,
    noise: 0.05,
    thisWeek: 0.9,
  },
  {
    id: 'queue',
    name: 'Time in queue',
    unit: 'h',
    better: 'lower',
    info: 'Median hours an issue waits before an agent picks it up.',
    digits: 1,
    seed: 37,
    from: 6.2,
    to: 5,
    noise: 0.08,
    thisWeek: 1.28,
    pins: { 4: 38 },
  },
  {
    id: 'first-try',
    name: 'First-try pass',
    unit: '%',
    better: 'higher',
    info: 'Share of changes that pass review and checks on the first round.',
    digits: 0,
    seed: 41,
    from: 58,
    to: 70,
    noise: 0.03,
    thisWeek: 1.04,
  },
  {
    id: 'shipped',
    name: 'Issues shipped',
    unit: '/day',
    better: 'higher',
    info: 'Issues merged and deployed, per working day.',
    digits: 1,
    seed: 53,
    from: 6.1,
    to: 7.9,
    noise: 0.05,
    thisWeek: 0.91,
  },
  {
    id: 'red-ci',
    name: 'Red CI runs',
    unit: '%',
    better: 'lower',
    info: 'Share of CI runs that end red.',
    digits: 0,
    seed: 67,
    from: 15,
    to: 6,
    noise: 0.1,
    thisWeek: 0,
  },
  {
    id: 'to-merge',
    name: 'Time to merge',
    unit: 'h',
    better: 'lower',
    info: 'Median hours from the first push to the merge.',
    digits: 1,
    seed: 71,
    from: 19,
    to: 15.5,
    noise: 0.06,
    thisWeek: 0.94,
    gaps: [3, 4],
  },
  {
    id: 'reopened',
    name: 'Reopened issues',
    unit: '%',
    better: 'lower',
    info: 'Share of closed issues that were reopened within a week.',
    digits: 1,
    seed: 83,
    from: 4,
    to: 5.2,
    noise: 0.08,
    thisWeek: 1,
    gaps: [11],
  },
]

const round = (value: number, digits: number): number => {
  const k = 10 ** digits
  return Math.round(value * k) / k
}

function build(spec: Spec): Measure {
  const rand = seeded(spec.seed)
  const last = WEEK_COUNT - 1
  const weeks: (number | null)[] = []
  for (let i = 0; i < WEEK_COUNT; i += 1) {
    const base = spec.from + ((spec.to - spec.from) * i) / last
    const wobble = (rand() * 2 - 1) * spec.noise
    weeks.push(round(Math.max(0, base * (1 + wobble)), spec.digits))
  }
  const prev = weeks[last - 1]
  if (typeof prev === 'number') weeks[last] = round(prev * spec.thisWeek, spec.digits)
  for (const [week, value] of Object.entries(spec.pins ?? {})) weeks[Number(week)] = value
  for (const week of spec.gaps ?? []) weeks[week] = null
  const { id, name, unit, better, info, digits } = spec
  return { id, name, unit, better, info, digits, weeks }
}

const MEASURES: readonly Measure[] = SPECS.map(build)

/** This week's value replaced, the rest of the history kept. */
function withThisWeek(measures: readonly Measure[], pick: (m: Measure) => number | null) {
  return measures.map((m): Measure => ({ ...m, weeks: [...m.weeks.slice(0, -1), pick(m)] }))
}

/**
 * The fixture a `?fixture=` name picks:
 * - `extreme`: the queue has stalled (212 h against a 5 h norm) and CI is red on every run;
 * - `steady`: every measure within a hair of last week, so nothing slid and nothing moved;
 * - `bare`: a first week, so no measure has a value yet.
 */
export function measuresFor(fixture: string | undefined): readonly Measure[] {
  if (fixture === 'extreme') {
    return MEASURES.map((m) => {
      if (m.id === 'queue') return { ...m, weeks: [...m.weeks.slice(0, -1), 212] }
      if (m.id === 'red-ci') return { ...m, weeks: [...m.weeks.slice(0, -1), 100] }
      return m
    })
  }
  if (fixture === 'steady') {
    return withThisWeek(MEASURES, (m) => {
      const prev = m.weeks[WEEK_COUNT - 2]
      return typeof prev === 'number' ? prev : null
    })
  }
  if (fixture === 'bare') return withThisWeek(MEASURES, () => null)
  return MEASURES
}
