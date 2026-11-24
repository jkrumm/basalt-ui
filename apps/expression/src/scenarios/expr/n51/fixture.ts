/** Card charges, 20 Oct to 18 Nov: a seeded fixture of about 400 charges, each with its merchant's median of the last 12 months. */

export type Flag = 'over' | 'repeat' | 'none'

export type Charge = {
  id: string
  merchant: string
  at: Date
  amount: number
  /** The merchant's median charge over the last 12 months. */
  median: number
  /** `null` is a charge nobody has categorised. */
  category: string | null
  /** Amount over the merchant's median. */
  ratio: number
  flag: Flag
  /** The table's words for the same two facts. */
  check: 'Over 2×' | 'Repeat' | 'In range'
  categoryText: string
}

/** A charge is unusual from this multiple of its merchant's median. */
export const UNUSUAL_FROM = 2
const UNCATEGORISED = 'Uncategorised'

type Merchant = {
  name: string
  median: number
  /** Spread of an ordinary charge around the median (log scale); 0 is a fixed amount. */
  sigma: number
  count: number
  category: string | null
  /** Hours of the day a charge lands in. */
  hours: readonly [number, number]
  /** A category to use when the fixture is calm and nothing is left uncategorised. */
  calmCategory?: string
}

const MERCHANTS: readonly Merchant[] = [
  { name: 'REWE', median: 38.4, sigma: 0.3, count: 44, category: 'Groceries', hours: [9, 20] },
  { name: 'Lidl', median: 27.9, sigma: 0.3, count: 38, category: 'Groceries', hours: [8, 20] },
  { name: 'Aldi', median: 31.2, sigma: 0.3, count: 28, category: 'Groceries', hours: [8, 20] },
  { name: 'Edeka', median: 22.5, sigma: 0.35, count: 26, category: 'Groceries', hours: [8, 20] },
  {
    name: 'Bäckerei Hoffmann',
    median: 6.8,
    sigma: 0.2,
    count: 50,
    category: 'Groceries',
    hours: [6, 11],
  },
  {
    name: 'Rösterei Nord',
    median: 4.6,
    sigma: 0.15,
    count: 36,
    category: 'Eating out',
    hours: [7, 16],
  },
  {
    name: 'Burger Haus',
    median: 28.0,
    sigma: 0.25,
    count: 12,
    category: 'Eating out',
    hours: [12, 22],
  },
  {
    name: 'Trattoria Roma',
    median: 54.0,
    sigma: 0.3,
    count: 7,
    category: 'Eating out',
    hours: [18, 22],
  },
  {
    name: 'Lieferando',
    median: 31.5,
    sigma: 0.25,
    count: 17,
    category: 'Eating out',
    hours: [18, 22],
  },
  {
    name: 'BVG Fahrscheine',
    median: 3.0,
    sigma: 0,
    count: 24,
    category: 'Transport',
    hours: [6, 20],
  },
  {
    name: 'Deutsche Bahn',
    median: 24.9,
    sigma: 0.45,
    count: 7,
    category: 'Transport',
    hours: [6, 18],
  },
  { name: 'Aral', median: 61.0, sigma: 0.2, count: 7, category: 'Transport', hours: [7, 19] },
  { name: 'Shell', median: 58.4, sigma: 0.2, count: 5, category: 'Transport', hours: [7, 19] },
  {
    name: 'Apotheke am Markt',
    median: 17.9,
    sigma: 0.4,
    count: 8,
    category: 'Health',
    hours: [9, 18],
  },
  { name: 'dm', median: 19.4, sigma: 0.35, count: 14, category: 'Health', hours: [10, 19] },
  { name: 'Rossmann', median: 14.7, sigma: 0.35, count: 8, category: 'Health', hours: [10, 19] },
  { name: 'Amazon', median: 29.9, sigma: 0.4, count: 20, category: 'Shopping', hours: [8, 23] },
  { name: 'Zalando', median: 48.0, sigma: 0.35, count: 4, category: 'Shopping', hours: [18, 23] },
  { name: 'IKEA', median: 64.0, sigma: 0.45, count: 4, category: 'Home', hours: [11, 17] },
  { name: 'Cinemaxx', median: 21.0, sigma: 0.15, count: 4, category: 'Leisure', hours: [17, 21] },
  { name: 'Netflix', median: 12.99, sigma: 0, count: 1, category: 'Subscriptions', hours: [3, 4] },
  { name: 'Spotify', median: 16.99, sigma: 0, count: 1, category: 'Subscriptions', hours: [3, 4] },
  {
    name: 'Apple Services',
    median: 2.99,
    sigma: 0,
    count: 2,
    category: 'Subscriptions',
    hours: [3, 4],
  },
  { name: 'Vodafone', median: 39.99, sigma: 0, count: 1, category: 'Utilities', hours: [4, 5] },
  {
    name: 'Stadtwerke Süd',
    median: 94.0,
    sigma: 0,
    count: 1,
    category: 'Utilities',
    hours: [4, 5],
  },
  { name: 'Fitness First', median: 39.9, sigma: 0, count: 2, category: 'Leisure', hours: [5, 7] },
  {
    name: 'SumUp *Kiosk Ecke',
    median: 8.5,
    sigma: 0.3,
    count: 10,
    category: null,
    hours: [7, 21],
    calmCategory: 'Eating out',
  },
  {
    name: 'PayPal *Marktplatz',
    median: 22.9,
    sigma: 0.3,
    count: 7,
    category: null,
    hours: [10, 22],
    calmCategory: 'Shopping',
  },
  {
    name: 'Stripe *Studio',
    median: 15.0,
    sigma: 0.2,
    count: 3,
    category: null,
    hours: [10, 18],
    calmCategory: 'Home',
  },
]

/** The charges the story turns on: fixed instants and amounts, replacing the seeded draw for their merchant. */
type Pinned = { merchant: string; at: string; amount: number; calmAmount: number }
const PINNED: readonly Pinned[] = [
  { merchant: 'Stadtwerke Süd', at: '2026-11-04T04:10:00Z', amount: 940, calmAmount: 94 },
  { merchant: 'Lieferando', at: '2026-11-09T20:15:00Z', amount: 81.9, calmAmount: 31.5 },
  { merchant: 'dm', at: '2026-11-12T11:30:00Z', amount: 52.4, calmAmount: 19.4 },
  { merchant: 'IKEA', at: '2026-11-15T15:05:00Z', amount: 187.5, calmAmount: 64 },
  { merchant: 'PayPal *Marktplatz', at: '2026-10-28T19:40:00Z', amount: 71, calmAmount: 22.9 },
  { merchant: 'Apple Services', at: '2026-10-24T03:10:00Z', amount: 0, calmAmount: 2.99 },
  { merchant: 'Fitness First', at: '2026-11-03T06:02:00Z', amount: 39.9, calmAmount: 39.9 },
  { merchant: 'Fitness First', at: '2026-11-03T06:07:00Z', amount: 39.9, calmAmount: 0 },
]

const START = Date.UTC(2026, 9, 20)
const DAY = 86_400_000
const DAYS = 30

/** mulberry32: the same seed draws the same month. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cents = (n: number): number => Math.round(n * 100) / 100

type Raw = { merchant: Merchant; at: number; amount: number }

function draw(calm: boolean): Raw[] {
  const rand = rng(5151)
  const normal = (): number => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const raw: Raw[] = []
  const taken = new Set<string>()
  for (const m of MERCHANTS) {
    const pinned = PINNED.filter((p) => p.merchant === m.name)
    for (const p of pinned) {
      if (calm && p.calmAmount === 0) continue
      raw.push({ merchant: m, at: Date.parse(p.at), amount: calm ? p.calmAmount : p.amount })
      taken.add(`${m.name}|${p.at.slice(0, 10)}|${calm ? p.calmAmount : p.amount}`)
    }
    for (let i = pinned.length; i < m.count; i += 1) {
      const factor = Math.min(1.75, Math.max(0.55, Math.exp(m.sigma * normal())))
      const day = Math.floor(rand() * DAYS)
      const hour = m.hours[0] + Math.floor(rand() * (m.hours[1] - m.hours[0]))
      const at = START + day * DAY + hour * 3_600_000 + Math.floor(rand() * 60) * 60_000
      let amount = cents(m.median * factor)
      const dayKey = new Date(at).toISOString().slice(0, 10)
      while (taken.has(`${m.name}|${dayKey}|${amount}`)) amount = cents(amount + 0.01)
      taken.add(`${m.name}|${dayKey}|${amount}`)
      raw.push({ merchant: m, at, amount })
    }
  }
  return raw.sort((a, b) => a.at - b.at)
}

/** The month's charges in time order. `calm` is a month with nothing unusual and nothing uncategorised. */
export function buildCharges(calm: boolean): Charge[] {
  const seen = new Set<string>()
  return draw(calm).map((r, i) => {
    const day = new Date(r.at).toISOString().slice(0, 10)
    const repeatKey = `${r.merchant.name}|${day}|${r.amount}`
    const repeat = seen.has(repeatKey)
    seen.add(repeatKey)
    const ratio = r.amount / r.merchant.median
    const flag: Flag = ratio >= UNUSUAL_FROM ? 'over' : repeat ? 'repeat' : 'none'
    const category = calm
      ? (r.merchant.category ?? r.merchant.calmCategory ?? null)
      : r.merchant.category
    return {
      id: `c${String(i + 1).padStart(3, '0')}`,
      merchant: r.merchant.name,
      at: new Date(r.at),
      amount: r.amount,
      median: r.merchant.median,
      category,
      ratio,
      flag,
      check: flag === 'over' ? 'Over 2×' : flag === 'repeat' ? 'Repeat' : 'In range',
      categoryText: category ?? UNCATEGORISED,
    }
  })
}

/** What the answer rests on, read off the charges. */
export function summarise(charges: readonly Charge[]) {
  const flagged = charges.filter((c) => c.flag !== 'none')
  const over = charges.filter((c) => c.flag === 'over')
  const uncategorised = charges.filter((c) => c.category === null)
  const repeats = charges.filter((c) => c.flag === 'repeat')
  return {
    unusual: flagged.length,
    excess: over.reduce((sum, c) => sum + (c.amount - c.median), 0),
    uncategorised: uncategorised.length,
    uncategorisedSum: uncategorised.reduce((sum, c) => sum + c.amount, 0),
    repeated: [...new Set(repeats.map((c) => c.merchant))],
  }
}

/** The rows to check, most unusual first, then the uncategorised newest first. */
export function toCheck(charges: readonly Charge[]): Charge[] {
  const rank = (c: Charge): number => (c.flag === 'over' ? 0 : c.flag === 'repeat' ? 1 : 2)
  return charges
    .filter((c) => c.flag !== 'none' || c.category === null)
    .sort(
      (a, b) =>
        rank(a) - rank(b) || (rank(a) === 0 ? b.ratio - a.ratio : b.at.getTime() - a.at.getTime()),
    )
}
