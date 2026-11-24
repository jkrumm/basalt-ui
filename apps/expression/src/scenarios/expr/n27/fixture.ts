/**
 * Factory health measures (scenario expr-n27): eight weekly measures with the direction that counts
 * as better, twelve weeks of values, the newest week partial, some weeks without a value. Seeded and
 * deterministic: the same fixture name always draws the same weeks.
 */
import type { SparkPoint } from 'basalt-ui/charts'

export type Direction = 'lower' | 'higher'
export type VerdictName = 'Slid' | 'Better' | 'Steady' | 'No reading'

type Measure = {
  id: string
  name: string
  direction: Direction
  /** Printed after the value, with its space. */
  unit: string
  prefix: string
  digits: number
  /** A value above it is drawn on the sparkline's top edge under the kit's caret. */
  cap: number | undefined
  /** Why a week has no value, for the row's line when this week has none. */
  missing: string
  weeks: readonly (number | null)[]
}

export type Row = Measure & {
  now: number | null
  /** Change against last week in the better direction, whole percent; null without both values. */
  toward: number | null
  verdict: VerdictName
  trend: readonly SparkPoint[]
}

/** How many measures held a verdict in each week with a week before it, oldest first. */
export type CountHistory = { byWeek: readonly SparkPoint[]; now: number; last: number }

export type Fixture = {
  rows: readonly Row[]
  slid: CountHistory
  better: CountHistory
  /** First, middle and last week of `byWeek`, for a card's axis labels. */
  axisLabels: readonly [string, string, string]
  nowLabel: string
  lastLabel: string
}

const FIRST_WEEK = 36
const WEEKS = 12
const NOW = WEEKS - 1
const LAST = WEEKS - 2

const weekLabel = (i: number): string => `W${FIRST_WEEK + i}`

/** mulberry32: a small seeded generator, so a fixture never changes between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Spec = Omit<Measure, 'weeks'> & {
  base: number
  noise: number
  /** Weeks that are set by hand: the story, the spike, the weeks nothing was measured. */
  set: Readonly<Record<number, number | null>>
}

const SPECS: readonly Spec[] = [
  {
    id: 'fix-commits',
    missing: 'no Issue merged',
    name: 'Fix commits per Issue',
    direction: 'lower',
    unit: '',
    prefix: '',
    digits: 1,
    cap: undefined,
    base: 1.3,
    noise: 0.25,
    set: { 9: 1.35, 10: 1.3, 11: 1.9 },
  },
  {
    id: 'review-rounds',
    missing: 'no review finished',
    name: 'Rounds to pass review',
    direction: 'lower',
    unit: '',
    prefix: '',
    digits: 1,
    cap: undefined,
    base: 2.1,
    noise: 0.3,
    set: { 9: 2.3, 10: 2.2, 11: 1.7 },
  },
  {
    id: 'queue-time',
    missing: 'nothing queued',
    name: 'Time in queue, median',
    direction: 'lower',
    unit: ' h',
    prefix: '',
    digits: 1,
    cap: 12,
    base: 4.5,
    noise: 1.2,
    set: { 5: 38.2, 9: 4.4, 10: 5.1, 11: 3.2 },
  },
  {
    id: 'first-pass-ci',
    missing: 'no CI run finished',
    name: 'First-pass CI runs',
    direction: 'higher',
    unit: ' %',
    prefix: '',
    digits: 1,
    cap: undefined,
    base: 86,
    noise: 3,
    set: { 9: 86.2, 10: 86.4, 11: 86.6 },
  },
  {
    id: 'reopened',
    missing: 'no Issue closed',
    name: 'Reopened Issues',
    direction: 'lower',
    unit: ' %',
    prefix: '',
    digits: 0,
    cap: undefined,
    base: 6,
    noise: 2,
    set: { 9: 7, 10: 6, 11: 0 },
  },
  {
    id: 'green-to-merge',
    missing: 'no merge',
    name: 'Time from green to merge, median',
    direction: 'lower',
    unit: ' h',
    prefix: '',
    digits: 1,
    cap: undefined,
    base: 1.2,
    noise: 0.3,
    set: { 9: 1.4, 10: 1.4, 11: 2.4 },
  },
  {
    id: 'failed-deploys',
    missing: 'no deploy went out',
    name: 'Failed deploys',
    direction: 'lower',
    unit: ' %',
    prefix: '',
    digits: 0,
    cap: undefined,
    base: 5,
    noise: 3,
    // No deploy went out in W38 and W43, so there is no rate.
    set: { 2: null, 7: null, 9: 3, 10: 4, 11: 7 },
  },
  {
    id: 'agent-cost',
    missing: 'the cost report has not run',
    name: 'Agent cost per Issue',
    direction: 'lower',
    unit: '',
    prefix: '$',
    digits: 2,
    cap: undefined,
    base: 2.4,
    noise: 0.4,
    // The cost report missed W37 and W42 and has not run for the current week.
    set: { 1: null, 6: null, 9: 2.4, 10: 2.3, 11: null },
  },
]

function weeksOf(spec: Spec, rand: () => number, set: Spec['set']): (number | null)[] {
  const scale = 10 ** spec.digits
  return Array.from({ length: WEEKS }, (_, i) => {
    const drawn = spec.base + (rand() * 2 - 1) * spec.noise
    const value = i in set ? set[i] : drawn
    if (value === null || value === undefined) return null
    return Math.max(0, Math.round(value * scale) / scale)
  })
}

/** Change against last week in the better direction, in whole percent. */
function towardBetter(
  direction: Direction,
  now: number | null,
  prev: number | null,
): number | null {
  if (now === null || prev === null) return null
  if (now === prev) return 0
  if (prev === 0) return null
  const sign = direction === 'higher' ? 1 : -1
  return Math.round((sign * (now - prev) * 100) / Math.abs(prev)) || 0
}

function verdictOf(toward: number | null): VerdictName {
  if (toward === null) return 'No reading'
  if (toward > 0) return 'Better'
  if (toward < 0) return 'Slid'
  return 'Steady'
}

const ORDER: readonly VerdictName[] = ['Slid', 'Better', 'Steady', 'No reading']

/** Hand-set weeks of a named fixture; the default is the week the case describes. */
function overrides(fixture: string | undefined, spec: Spec): Spec['set'] {
  if (fixture === 'extreme' && spec.id === 'queue-time') return { ...spec.set, 11: 96.4 }
  if (fixture !== 'zero') return spec.set
  // Nothing moved: this week repeats last week, and the reopened rate sits at zero for both.
  const last = spec.id === 'reopened' ? 0 : (spec.set[LAST] ?? null)
  const set: Record<number, number | null> = { ...spec.set, [LAST]: last }
  if (spec.id !== 'agent-cost') set[NOW] = last
  return set
}

export function loadFixture(fixture: string | undefined): Fixture {
  const rand = seeded(2711)
  const measures: Measure[] = SPECS.map((spec) => {
    const { base: _base, noise: _noise, set: _set, ...measure } = spec
    return { ...measure, weeks: weeksOf(spec, rand, overrides(fixture, spec)) }
  })

  const rows: Row[] = measures.map((m) => {
    const now = m.weeks[NOW] ?? null
    const toward = towardBetter(m.direction, now, m.weeks[LAST] ?? null)
    return {
      ...m,
      now,
      toward,
      verdict: verdictOf(toward),
      trend: m.weeks.map((value, i) => ({ value, label: weekLabel(i) })),
    }
  })
  rows.sort(
    (a, b) =>
      ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) ||
      Math.abs(b.toward ?? 0) - Math.abs(a.toward ?? 0) ||
      a.name.localeCompare(b.name),
  )

  const countAt = (verdict: VerdictName, week: number): number =>
    measures.filter(
      (m) =>
        verdictOf(towardBetter(m.direction, m.weeks[week] ?? null, m.weeks[week - 1] ?? null)) ===
        verdict,
    ).length
  const history = (verdict: VerdictName): SparkPoint[] =>
    Array.from({ length: WEEKS - 1 }, (_, i) => ({
      value: countAt(verdict, i + 1),
      label: weekLabel(i + 1),
    }))
  const count = (verdict: VerdictName): CountHistory => ({
    byWeek: history(verdict),
    now: countAt(verdict, NOW),
    last: countAt(verdict, LAST),
  })

  return {
    rows,
    slid: count('Slid'),
    better: count('Better'),
    axisLabels: [weekLabel(1), weekLabel(6), weekLabel(NOW)],
    nowLabel: weekLabel(NOW),
    lastLabel: weekLabel(LAST),
  }
}

export const VERDICT_ORDER = ORDER
