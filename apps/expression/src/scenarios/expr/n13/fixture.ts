/** Recurring charges for scenario expr-n13: seeded, deterministic, 18 charges with 12 months of price history. */

export type Interval = 'monthly' | 'quarterly' | 'yearly'

export type Charge = {
  id: string
  payee: string
  category: string
  interval: Interval
  /** The amount billed per interval, December 2025 to November 2026. */
  history: readonly number[]
}

export type Row = Charge & {
  /** What the charge costs per month: quarterly over 3, yearly over 12. */
  perMonth: number
  /** Monthly equivalent in each of the 12 months. */
  monthly: readonly number[]
  /** Change in the monthly equivalent, first month to last. */
  change: number
  /** The amount billed per interval, now. */
  billed: number
}

export const MONTHS = [
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
] as const

const MONTHS_PER: Record<Interval, number> = { monthly: 1, quarterly: 3, yearly: 12 }

/** A tiny seeded PRNG so the gradual drifts are the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** A price that holds, then steps to a new one from month index `at` (0 is December). */
const step = (from: number, to: number, at: number): number[] =>
  Array.from({ length: 12 }, (_, i) => (i < at ? from : to))

const flat = (value: number): number[] => step(value, value, 0)

/** A price that drifts up a little most months: the energy tariff. */
function drift(from: number, to: number, seed: number): number[] {
  const rand = mulberry32(seed)
  const noise = Array.from({ length: 12 }, () => (rand() - 0.5) * 3)
  return noise.map((n, i) => round2(from + ((to - from) * i) / 11 + (i === 0 || i === 11 ? 0 : n)))
}

const CHARGES: readonly Charge[] = [
  {
    id: 'rent',
    payee: 'Rent',
    category: 'Housing',
    interval: 'monthly',
    history: step(1180, 1230, 7),
  },
  {
    id: 'childcare',
    payee: 'Childcare',
    category: 'Family',
    interval: 'monthly',
    history: flat(420),
  },
  {
    id: 'health',
    payee: 'Health insurance',
    category: 'Insurance',
    interval: 'monthly',
    history: step(312, 338, 3),
  },
  {
    id: 'electricity',
    payee: 'Electricity',
    category: 'Utilities',
    interval: 'monthly',
    history: drift(74, 96, 13),
  },
  {
    id: 'internet',
    payee: 'Internet',
    category: 'Utilities',
    interval: 'monthly',
    history: step(39.9, 44.9, 6),
  },
  {
    id: 'mobile',
    payee: 'Mobile plans',
    category: 'Utilities',
    interval: 'monthly',
    history: flat(28),
  },
  {
    id: 'video',
    payee: 'Video streaming',
    category: 'Subscriptions',
    interval: 'monthly',
    history: step(11.99, 13.99, 4),
  },
  {
    id: 'music',
    payee: 'Music family plan',
    category: 'Subscriptions',
    interval: 'monthly',
    history: flat(16.99),
  },
  {
    id: 'news',
    payee: 'Newspaper',
    category: 'Subscriptions',
    interval: 'monthly',
    history: step(14.9, 19.9, 9),
  },
  {
    id: 'sports',
    payee: 'Sports streaming',
    category: 'Subscriptions',
    interval: 'monthly',
    history: step(29.99, 0, 9),
  },
  {
    id: 'cloud',
    payee: 'Cloud storage',
    category: 'Subscriptions',
    interval: 'monthly',
    history: flat(2.99),
  },
  { id: 'gym', payee: 'Gym', category: 'Health', interval: 'monthly', history: step(39, 44, 2) },
  {
    id: 'car',
    payee: 'Car insurance',
    category: 'Insurance',
    interval: 'quarterly',
    history: step(164, 181, 6),
  },
  {
    id: 'water',
    payee: 'Water',
    category: 'Utilities',
    interval: 'quarterly',
    history: step(118, 127, 5),
  },
  {
    id: 'waste',
    payee: 'Waste collection',
    category: 'Utilities',
    interval: 'quarterly',
    history: flat(63),
  },
  {
    id: 'contents',
    payee: 'Home contents insurance',
    category: 'Insurance',
    interval: 'yearly',
    history: step(186, 204, 3),
  },
  {
    id: 'breakdown',
    payee: 'Breakdown cover',
    category: 'Insurance',
    interval: 'yearly',
    history: flat(94),
  },
  {
    id: 'licence',
    payee: 'Design software licence',
    category: 'Subscriptions',
    interval: 'yearly',
    history: step(144, 156, 8),
  },
]

/** The names `?fixture=` takes. */
const FIXTURE_NAMES = ['extreme', 'flat', 'single'] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

export const isFixtureName = (value: string | undefined): value is FixtureName =>
  FIXTURE_NAMES.some((name) => name === value)

/** `extreme`: the electricity tariff jumps almost fivefold in October and a 2,880 yearly premium lands. `flat`: no price moved. `single`: one charge only. */
function variant(name: FixtureName | undefined): readonly Charge[] {
  if (name === 'single') return CHARGES.filter((c) => c.id === 'rent')
  if (name === 'flat') return CHARGES.map((c) => ({ ...c, history: flat(c.history[0] ?? 0) }))
  if (name === 'extreme') {
    return CHARGES.map((c) => {
      if (c.id === 'electricity') return { ...c, history: step(74, 355, 10) }
      if (c.id === 'breakdown') return { ...c, history: step(94, 2880, 5) }
      return c
    })
  }
  return CHARGES
}

function toRow(c: Charge): Row {
  const per = MONTHS_PER[c.interval]
  const monthly = c.history.map((h) => round2(h / per))
  const first = monthly[0] ?? 0
  const last = monthly[monthly.length - 1] ?? 0
  return {
    ...c,
    perMonth: last,
    monthly,
    change: round2(last - first),
    billed: c.history[c.history.length - 1] ?? 0,
  }
}

/** Rows ordered by what they grew, the biggest rise first, then by cost. */
export function loadRows(name: FixtureName | undefined): readonly Row[] {
  return variant(name)
    .map(toRow)
    .sort((a, b) => b.change - a.change || b.perMonth - a.perMonth)
}
