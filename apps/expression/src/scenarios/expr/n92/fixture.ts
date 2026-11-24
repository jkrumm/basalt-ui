/**
 * Lift balance (scenario expr-n92): the best lifts of one lifter and the four pairs read from them.
 * A fixture is a plain table of best lifts in kg, so every `?fixture=` name is deterministic; a
 * lift that was never logged is `null`.
 */

export type Lifts = {
  squat: number | null
  bench: number | null
  deadlift: number | null
  bodyweight: number | null
  /** Weight added to a pull-up; `null` or 0 when none was added. */
  pullupAdded: number | null
}

export type PairId = 'deadlift-squat' | 'squat-bench' | 'deadlift-bench' | 'pullup-bodyweight'
export type PairState = 'balanced' | 'borderline' | 'imbalanced' | 'critical'

export type Pair = {
  id: PairId
  name: string
  /** The healthy range of the ratio, both ends inside it. */
  range: readonly [number, number]
  /** Why the ratio is missing, or `null` when it was computed. */
  gap: string | null
  ratio: number | null
  state: PairState | null
  /** How far outside the nearest range end, as a fraction of that end; 0 inside the range. */
  miss: number
  /** Which side of the range the ratio sits on; `null` inside it. */
  side: 'below' | 'above' | null
}

/** A ratio within this fraction past a range end is borderline, within the next one imbalanced, beyond it critical. */
export const BORDERLINE = 0.15
export const IMBALANCED = 0.3

const FIXTURES: Readonly<Record<string, Lifts>> = {
  default: { squat: 112, bench: 100, deadlift: 168, bodyweight: 84, pullupAdded: 10 },
  extreme: { squat: 60, bench: 100, deadlift: 190, bodyweight: 84, pullupAdded: 1 },
  'all-balanced': { squat: 125, bench: 100, deadlift: 175, bodyweight: 84, pullupAdded: 42 },
  'no-weight': { squat: 112, bench: 100, deadlift: 168, bodyweight: 84, pullupAdded: 0 },
  'no-data': { squat: 112, bench: null, deadlift: 168, bodyweight: 84, pullupAdded: 10 },
  'one-lift': { squat: 112, bench: null, deadlift: null, bodyweight: 84, pullupAdded: null },
}

const NOTHING: Lifts = {
  squat: null,
  bench: null,
  deadlift: null,
  bodyweight: null,
  pullupAdded: null,
}

/** The lifts of a `?fixture=` name; an unknown name reads as `default`. */
export function liftsOf(fixture: string | undefined): Lifts {
  return FIXTURES[fixture ?? 'default'] ?? FIXTURES['default']!
}

export const NO_LIFTS = NOTHING

const logged = (kg: number | null): kg is number => kg !== null && kg > 0

/** How many of the four lifts were logged: squat, bench, deadlift and a weighted pull-up. */
export function liftsLogged(l: Lifts): number {
  return [l.squat, l.bench, l.deadlift, l.pullupAdded].filter(logged).length
}

const stateOf = (miss: number): PairState => {
  if (miss <= 0) return 'balanced'
  if (miss <= BORDERLINE) return 'borderline'
  if (miss <= IMBALANCED) return 'imbalanced'
  return 'critical'
}

function pair(
  id: PairId,
  name: string,
  range: readonly [number, number],
  top: number | null,
  bottom: number | null,
  gap: string,
): Pair {
  if (!logged(top) || !logged(bottom)) {
    return { id, name, range, gap, ratio: null, state: null, miss: 0, side: null }
  }
  const ratio = top / bottom
  const [lo, hi] = range
  const side = ratio < lo ? 'below' : ratio > hi ? 'above' : null
  const miss = side === 'below' ? (lo - ratio) / lo : side === 'above' ? (ratio - hi) / hi : 0
  return { id, name, range, gap: null, ratio, state: stateOf(miss), miss, side }
}

/** The four pairs, the furthest outside its range first and the unmeasured ones last. */
export function pairsOf(l: Lifts): Pair[] {
  const pairs = [
    pair(
      'deadlift-squat',
      'Deadlift to squat',
      [1.0, 1.25],
      l.deadlift,
      l.squat,
      'Not measured, no deadlift or squat logged',
    ),
    pair(
      'squat-bench',
      'Squat to bench',
      [1.2, 1.5],
      l.squat,
      l.bench,
      'Not measured, no squat or bench logged',
    ),
    pair(
      'deadlift-bench',
      'Deadlift to bench',
      [1.5, 2.0],
      l.deadlift,
      l.bench,
      'Not measured, no deadlift or bench logged',
    ),
    pair(
      'pullup-bodyweight',
      'Pull-up to bodyweight',
      [0.4, 0.7],
      l.pullupAdded,
      l.bodyweight,
      'Not measured, no weight added to pull-ups',
    ),
  ]
  return pairs.toSorted((a, b) => {
    if ((a.ratio === null) !== (b.ratio === null)) return a.ratio === null ? 1 : -1
    return b.miss - a.miss
  })
}
