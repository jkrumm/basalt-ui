/** Seeded training log for scenario expr-n08: one row per past day, a pairing of recovery and planned load. */

export const RECOVERIES = ['low', 'normal', 'high'] as const
export const LOADS = ['light', 'moderate', 'heavy'] as const
export type Recovery = (typeof RECOVERIES)[number]
export type Load = (typeof LOADS)[number]

export const VERDICTS = ['train', 'easy', 'rest', 'thin'] as const
export type Verdict = (typeof VERDICTS)[number]

/** One pairing of the grid: the verdict, the past days behind it and how they went. */
export type Pairing = {
  recovery: Recovery
  load: Load
  days: number
  strong: number
  /** Days since the pairing last came up; null when it never has. */
  lastSeen: number | null
  verdict: Verdict
}

export type Plan = { today: { recovery: Recovery; load: Load }; pairings: readonly Pairing[] }

/** A pairing needs this many past days before it earns a verdict. */
export const MIN_DAYS = 3
/** The share of strong sessions that makes a pairing a train, and the one that makes it a go-easy day. */
export const TRAIN_SHARE = 0.7
export const EASY_SHARE = 0.4

/** The fixture names the scenario knows; anything else renders the default log. */
const FIXTURES = ['zero', 'extreme'] as const
export type FixtureName = (typeof FIXTURES)[number]

const isFixture = (name: string | undefined): name is FixtureName =>
  FIXTURES.some((known) => known === name)

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The chance a session is strong, by recovery and load: good recovery carries a heavy day, low recovery does not. */
function strongChance(recovery: Recovery, load: Load): number {
  const base = { low: 0.2, normal: 0.55, high: 0.85 }[recovery]
  const cost = { light: -0.15, moderate: 0, heavy: 0.2 }[load]
  return Math.min(0.97, Math.max(0.05, base - cost * (recovery === 'high' ? 0.4 : 1)))
}

function verdictOf(days: number, strong: number): Verdict {
  if (days < MIN_DAYS) return 'thin'
  const share = strong / days
  if (share >= TRAIN_SHARE) return 'train'
  if (share >= EASY_SHARE) return 'easy'
  return 'rest'
}

type Spec = { total: number; today: Plan['today']; weight: (r: Recovery, l: Load) => number }

const SPECS: Record<FixtureName | 'default', Spec> = {
  default: { total: 120, today: { recovery: 'normal', load: 'heavy' }, weight: () => 1 },
  /** Today's pairing has never come up: no days, so no verdict. */
  zero: {
    total: 120,
    today: { recovery: 'low', load: 'heavy' },
    weight: (r, l) => (r === 'low' && l === 'heavy' ? 0 : 1),
  },
  /** One pairing holds most of a year of days: a three-digit count and a perfect share. */
  extreme: {
    total: 480,
    today: { recovery: 'high', load: 'moderate' },
    weight: (r, l) =>
      r === 'high' && l === 'moderate' ? 14 : r === 'low' && l === 'heavy' ? 0.06 : 1,
  },
}

export function buildPlan(fixture: string | undefined): Plan {
  const spec = SPECS[isFixture(fixture) ? fixture : 'default']
  const rand = seeded(isFixture(fixture) ? FIXTURES.indexOf(fixture) + 8 : 8)
  const cells = RECOVERIES.flatMap((recovery) => LOADS.map((load) => ({ recovery, load })))
  const weights = cells.map((c) => spec.weight(c.recovery, c.load))
  const sum = weights.reduce((a, b) => a + b, 0)
  const tally = cells.map(() => ({ days: 0, strong: 0, lastSeen: null as number | null }))
  const extreme = fixture === 'extreme'
  for (let day = spec.total - 1; day >= 0; day--) {
    let pick = rand() * sum
    const index = weights.findIndex((w) => (pick -= w) < 0)
    const cell = cells[index]
    const slot = tally[index]
    if (cell === undefined || slot === undefined) continue
    slot.days += 1
    if (extreme ? rand() < 0.99 : rand() < strongChance(cell.recovery, cell.load)) slot.strong += 1
    slot.lastSeen = day
  }
  const pairings = cells.map((cell, i): Pairing => {
    const slot = tally[i] ?? { days: 0, strong: 0, lastSeen: null }
    return { ...cell, ...slot, verdict: verdictOf(slot.days, slot.strong) }
  })
  return { today: spec.today, pairings }
}
