/**
 * c07 fixture: one eval run of 60 cases against its baseline run. Seeded (mulberry32), no clock:
 * the run and baseline dates are literals. Fixtures: `default` (beat the baseline), `tied` (every
 * case on the same side as the baseline: zero flips) and `regressed` (more cases lost than won).
 */

export type Verdict = 'Pass' | 'Fail'
/** The side a case is on: the two flips first, then the two cases that held. */
export type Change = 'Regressed' | 'Fixed' | 'Still passing' | 'Still failing'
export type FixtureName = 'default' | 'tied' | 'regressed'

export type CaseRow = {
  id: string
  input: string
  expected: string
  actual: string
  baseline: Verdict
  now: Verdict
  change: Change
}

export const FIXTURE_NAMES: readonly FixtureName[] = ['default', 'tied', 'regressed']
export const RUN_LABEL = '13 Nov 2026'
export const BASELINE_LABEL = '6 Nov 2026'
export const CASE_COUNT = 60

/** P(pass now | baseline passed), P(pass now | baseline failed) per fixture. */
const ODDS: Record<Exclude<FixtureName, 'tied'>, readonly [number, number]> = {
  default: [0.8, 0.3],
  regressed: [0.62, 0.12],
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

type Task = { input: string; expected: string; wrong: string }

const EVENTS = [
  'The treaty was signed',
  'The bridge opened',
  'The probe launched',
  'The firm listed',
]

function taskFor(index: number, rand: () => number): Task {
  const family = index % 3
  if (family === 0) {
    const km = 3 + Math.floor(rand() * 90)
    return {
      input: `Convert ${km} km to miles, one decimal.`,
      expected: `${(km * 0.621371).toFixed(1)} mi`,
      wrong: `${(km * 0.62).toFixed(0)} mi`,
    }
  }
  if (family === 1) {
    const list = Array.from({ length: 5 }, () => 1 + Math.floor(rand() * 40))
    const sorted = list.toSorted((x, y) => x - y)
    const swapped = [...sorted]
    ;[swapped[1], swapped[3]] = [swapped[3] ?? 0, swapped[1] ?? 0]
    return {
      input: `Sort ascending: ${list.join(', ')}`,
      expected: sorted.join(', '),
      wrong: swapped.join(', '),
    }
  }
  const year = 1950 + Math.floor(rand() * 70)
  const event = EVENTS[Math.floor(rand() * EVENTS.length)] ?? 'The event happened'
  return {
    input: `Extract the year: "${event} in ${year}, after two delays."`,
    expected: String(year),
    wrong: String(year - 1 - Math.floor(rand() * 3)),
  }
}

const changeOf = (baseline: Verdict, now: Verdict): Change => {
  if (baseline === now) return now === 'Pass' ? 'Still passing' : 'Still failing'
  return now === 'Pass' ? 'Fixed' : 'Regressed'
}

const ORDER: Record<Change, number> = {
  Regressed: 0,
  Fixed: 1,
  'Still passing': 2,
  'Still failing': 3,
}

/** The cases that changed sides: a regression or a fix. */
export const flips = (rows: readonly CaseRow[]): CaseRow[] =>
  rows.filter((r) => r.change === 'Regressed' || r.change === 'Fixed')

/** Regressions, then fixes, then the cases that held (passing before failing), each by id. */
export function buildCases(name: FixtureName): CaseRow[] {
  const rand = mulberry32(20261113)
  const rows = Array.from({ length: CASE_COUNT }, (_, index): CaseRow => {
    const task = taskFor(index, rand)
    const baseline: Verdict = rand() < 0.62 ? 'Pass' : 'Fail'
    const roll = rand()
    const odds = name === 'tied' ? undefined : ODDS[name]
    const now: Verdict =
      odds === undefined ? baseline : roll < odds[baseline === 'Pass' ? 0 : 1] ? 'Pass' : 'Fail'
    return {
      id: `eval-${String(index + 1).padStart(3, '0')}`,
      input: task.input,
      expected: task.expected,
      actual: now === 'Pass' ? task.expected : task.wrong,
      baseline,
      now,
      change: changeOf(baseline, now),
    }
  })
  return rows.toSorted((a, b) => ORDER[a.change] - ORDER[b.change])
}

export type Tally = {
  total: number
  passNow: number
  passBase: number
  fixed: number
  regressed: number
  heldPass: number
  heldFail: number
}

export function tally(rows: readonly CaseRow[]): Tally {
  const count = (change: Change): number => rows.filter((r) => r.change === change).length
  return {
    total: rows.length,
    passNow: rows.filter((r) => r.now === 'Pass').length,
    passBase: rows.filter((r) => r.baseline === 'Pass').length,
    fixed: count('Fixed'),
    regressed: count('Regressed'),
    heldPass: count('Still passing'),
    heldFail: count('Still failing'),
  }
}
