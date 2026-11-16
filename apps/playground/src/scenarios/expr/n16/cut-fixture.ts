/** Seeded fixtures for scenario expr-n16: 90 mornings of weigh-ins with gaps and a skinfold reading every one to two weeks. */

export type FixtureName = 'default' | 'stall' | 'lean-loss' | 'no-skinfold'

export type Day = {
  at: Date
  /** The morning weigh-in; `null` on a day nobody stepped on the scale. */
  weight: number | null
  /** Mean of the weigh-ins in the trailing seven days; `null` when there are none. */
  mean: number | null
  /** The planned weight for this day. */
  plan: number
}

export type Reading = {
  at: Date
  /** Skinfold body fat, percent. */
  bf: number
  /** Fat mass change since the first reading, kg. */
  fatDelta: number
  /** Lean mass change since the first reading, kg. */
  leanDelta: number
}

export type Cut = {
  days: readonly Day[]
  readings: readonly Reading[]
  goal: number
  /** Planned loss, kg per week. */
  planRate: number
  /** Least-squares slope of the last 28 days, kg per week (negative is losing). */
  rate: number
  /** Whole-window weigh-in count. */
  weighIns: number
  longestGap: number
}

type Spec = {
  seed: number
  /** True loss, kg per week. */
  loss: number
  /** Share of the true loss that is fat. */
  fatShare: number
  skinfold: boolean
}

const SPECS: Record<FixtureName, Spec> = {
  default: { seed: 16, loss: 0.41, fatShare: 0.88, skinfold: true },
  stall: { seed: 7, loss: 0, fatShare: 0.9, skinfold: true },
  'lean-loss': { seed: 21, loss: 0.95, fatShare: 0.52, skinfold: true },
  'no-skinfold': { seed: 16, loss: 0.41, fatShare: 0.88, skinfold: false },
}

const DAYS = 90
const START = Date.UTC(2026, 7, 17)
const DAY_MS = 86_400_000
const START_WEIGHT = 92
const START_BF = 24
const GOAL = 84
const PLAN_RATE = 0.5
const READING_DAYS = [0, 9, 16, 28, 37, 44, 56, 65, 72, 85]
const GAP_START = 40
const GAP_END = 44

const isFixture = (name: string): name is FixtureName => Object.hasOwn(SPECS, name)

export const knownFixture = (name: string | undefined): FixtureName =>
  name !== undefined && isFixture(name) ? name : 'default'

/** mulberry32: a small seeded generator, so every build draws the same 90 days. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number, d: number): number => Math.round(n * 10 ** d) / 10 ** d

export function buildCut(name: FixtureName): Cut {
  const spec = SPECS[name]
  const rand = rng(spec.seed)
  const noise = (amp: number): number => (rand() + rand() + rand() - 1.5) * (2 / 3) * amp
  const truth = (i: number): number => START_WEIGHT - (spec.loss * i) / 7

  const weights: (number | null)[] = Array.from({ length: DAYS }, (_, i) => {
    const absent = i !== 0 && (rand() < 0.15 || (i >= GAP_START && i <= GAP_END))
    const day = round(truth(i) + noise(0.9), 1)
    return absent ? null : day
  })

  const meanAt = (i: number): number | null => {
    const window = weights.slice(Math.max(0, i - 6), i + 1).filter((w): w is number => w !== null)
    return window.length < 3 ? null : window.reduce((a, b) => a + b, 0) / window.length
  }

  const days: Day[] = weights.map((weight, i) => ({
    at: new Date(START + i * DAY_MS),
    weight,
    mean: meanAt(i) === null ? null : round(meanAt(i) ?? 0, 2),
    plan: round(START_WEIGHT - (PLAN_RATE * i) / 7, 2),
  }))

  const fat0 = (START_WEIGHT * START_BF) / 100
  const raw = spec.skinfold
    ? READING_DAYS.map((i) => {
        const fat = fat0 - spec.fatShare * (START_WEIGHT - truth(i)) + noise(0.35)
        const bf = round((fat / truth(i)) * 100, 1)
        const mean = meanAt(i) ?? truth(i)
        const fatMass = (mean * bf) / 100
        return { at: new Date(START + i * DAY_MS), bf, fatMass, leanMass: mean - fatMass }
      })
    : []
  const first = raw[0]
  const readings: Reading[] = raw.map((r) => ({
    at: r.at,
    bf: r.bf,
    fatDelta: round(r.fatMass - (first?.fatMass ?? 0), 2),
    leanDelta: round(r.leanMass - (first?.leanMass ?? 0), 2),
  }))

  const recent = weights
    .map((w, i) => ({ w, i }))
    .filter((p): p is { w: number; i: number } => p.w !== null && p.i >= DAYS - 28)
  const mi = recent.reduce((s, p) => s + p.i, 0) / recent.length
  const mw = recent.reduce((s, p) => s + p.w, 0) / recent.length
  const slope =
    recent.reduce((s, p) => s + (p.i - mi) * (p.w - mw), 0) /
    recent.reduce((s, p) => s + (p.i - mi) ** 2, 0)

  let longestGap = 0
  let run = 0
  for (const w of weights) {
    run = w === null ? run + 1 : 0
    longestGap = Math.max(longestGap, run)
  }

  return {
    days,
    readings,
    goal: GOAL,
    planRate: PLAN_RATE,
    rate: round(slope * 7, 2),
    weighIns: weights.filter((w) => w !== null).length,
    longestGap,
  }
}
