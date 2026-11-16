/** Seeded daily AI cost per model: 14 days ending on a partial Thursday, plus the weekly budget. */

export const MODELS = [
  { key: 'frontierXl', label: 'frontier-xl', weekday: 112, weekend: 26 },
  { key: 'frontierM', label: 'frontier-m', weekday: 58, weekend: 18 },
  { key: 'fastS', label: 'fast-s', weekday: 24, weekend: 9 },
  { key: 'embedV2', label: 'embed-v2', weekday: 7, weekend: 0 },
] as const

export type ModelKey = (typeof MODELS)[number]['key']

export type Day = {
  day: Date
  partial: boolean
  total: number
} & Record<ModelKey, number>

export type SpendFixture = {
  days: readonly Day[]
  /** The budget week's first index in `days` (Monday). */
  weekStart: number
  /** Share of today already elapsed. */
  dayShare: number
  weeklyBudget: number
  /** Whole days of the budget week after today. */
  daysAfterToday: number
}

export const CURRENCY = 'USD'
const WEEKLY_BUDGET = 1400
const DAY_SHARE = 0.45
const FIRST_DAY = Date.UTC(2026, 9, 30)
const DAY_COUNT = 14
/** Index of Monday Nov 9 in the 14 days from Oct 30. */
const WEEK_START = 10

/** Deterministic noise in [0, 1): the same fixture on every render and in every shot. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(spike: number, todayZero: boolean): SpendFixture {
  const rand = seeded(1212)
  const days: Day[] = Array.from({ length: DAY_COUNT }, (_, i) => {
    const at = new Date(FIRST_DAY + i * 86_400_000)
    const weekend = at.getUTCDay() === 0 || at.getUTCDay() === 6
    const today = i === DAY_COUNT - 1
    const row: Record<ModelKey, number> = { frontierXl: 0, frontierM: 0, fastS: 0, embedV2: 0 }
    for (const m of MODELS) {
      const base = weekend ? m.weekend : m.weekday
      let cost = base * (0.8 + rand() * 0.4)
      // A runaway batch job on the largest model: the extreme value of the `over` fixture.
      if (spike > 0 && m.key === 'frontierXl' && i >= WEEK_START + 2)
        cost *= i === DAY_COUNT - 2 ? spike * 1.4 : spike
      if (today) cost = todayZero ? 0 : cost * DAY_SHARE
      row[m.key] = Math.round(cost * 100) / 100
    }
    const total = MODELS.reduce((sum, m) => sum + row[m.key], 0)
    return { day: at, partial: today, total: Math.round(total * 100) / 100, ...row }
  })
  return {
    days,
    weekStart: WEEK_START,
    dayShare: todayZero ? 0 : DAY_SHARE,
    weeklyBudget: WEEKLY_BUDGET,
    daysAfterToday: 3,
  }
}

const FIXTURES = {
  rest: build(0, false),
  over: build(2.2, false),
  breach: build(6, false),
  zero: build(0, true),
} as const

/** `?fixture=over` (a runaway job, pace over budget), `?fixture=breach` (spend past the budget), `?fixture=zero` (today not billed yet); anything else is the rest state. */
export function pickFixture(name: string | undefined): SpendFixture {
  if (name === 'over') return FIXTURES.over
  if (name === 'breach') return FIXTURES.breach
  if (name === 'zero') return FIXTURES.zero
  return FIXTURES.rest
}
