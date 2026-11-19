/** One tax year of bookings (n29): seeded and deterministic, so every shot reads the same figures. */

export type TaxTag = 'business' | 'home' | 'donation'

export type Booking = {
  id: string
  /** `YYYY-MM-DD`, always inside the tax year. */
  date: string
  /** Money out, in euros. */
  amount: number
  merchant: string
  category: string
  /** `null` is an untagged booking. */
  tag: TaxTag | null
}

export const TAX_YEAR = 2025

type MerchantSpec = {
  name: string
  category: string
  /** Relative share of the year's 600 bookings. */
  weight: number
  /** A typical booking in euros. */
  typical: number
  /** The tag its bookings take when tagged. */
  tag: TaxTag
  /** The share of its bookings that carry the tag. */
  tagged: number
}

const MERCHANTS: readonly MerchantSpec[] = [
  { name: 'Amazon', category: 'Shopping', weight: 92, typical: 38, tag: 'business', tagged: 0.2 },
  { name: 'PayPal', category: 'Transfers', weight: 58, typical: 64, tag: 'business', tagged: 0.3 },
  { name: 'REWE', category: 'Groceries', weight: 54, typical: 34, tag: 'business', tagged: 0 },
  { name: 'Lidl', category: 'Groceries', weight: 30, typical: 22, tag: 'business', tagged: 0 },
  { name: 'Uber', category: 'Transport', weight: 28, typical: 18, tag: 'business', tagged: 0.35 },
  {
    name: 'Spotify',
    category: 'Subscriptions',
    weight: 12,
    typical: 11,
    tag: 'business',
    tagged: 0,
  },
  {
    name: 'Netflix',
    category: 'Subscriptions',
    weight: 12,
    typical: 14,
    tag: 'business',
    tagged: 0,
  },
  { name: 'Shell', category: 'Transport', weight: 14, typical: 62, tag: 'business', tagged: 0.5 },
  { name: 'dm', category: 'Drugstore', weight: 16, typical: 19, tag: 'home', tagged: 0.1 },
  { name: 'Zalando', category: 'Shopping', weight: 8, typical: 74, tag: 'business', tagged: 0 },
  { name: 'Apple', category: 'Hardware', weight: 7, typical: 120, tag: 'business', tagged: 0.55 },
  { name: 'Hetzner', category: 'Hosting', weight: 12, typical: 29, tag: 'business', tagged: 1 },
  { name: 'Adobe', category: 'Software', weight: 12, typical: 61, tag: 'business', tagged: 1 },
  { name: 'GitHub', category: 'Software', weight: 12, typical: 21, tag: 'business', tagged: 1 },
  { name: 'Notion', category: 'Software', weight: 12, typical: 16, tag: 'business', tagged: 1 },
  { name: 'Figma', category: 'Software', weight: 12, typical: 15, tag: 'business', tagged: 0.9 },
  {
    name: 'Deutsche Bahn',
    category: 'Travel',
    weight: 16,
    typical: 78,
    tag: 'business',
    tagged: 0.8,
  },
  { name: 'Lufthansa', category: 'Travel', weight: 5, typical: 210, tag: 'business', tagged: 0.8 },
  { name: 'Vistaprint', category: 'Print', weight: 5, typical: 48, tag: 'business', tagged: 1 },
  { name: 'Telekom', category: 'Utilities', weight: 12, typical: 52, tag: 'home', tagged: 1 },
  { name: 'Vattenfall', category: 'Utilities', weight: 12, typical: 96, tag: 'home', tagged: 1 },
  { name: 'IKEA', category: 'Furniture', weight: 6, typical: 140, tag: 'home', tagged: 0.7 },
  { name: 'Bauhaus', category: 'Furniture', weight: 5, typical: 58, tag: 'home', tagged: 0.4 },
  {
    name: 'Ärzte ohne Grenzen',
    category: 'Giving',
    weight: 12,
    typical: 40,
    tag: 'donation',
    tagged: 1,
  },
  { name: 'WWF', category: 'Giving', weight: 6, typical: 30, tag: 'donation', tagged: 1 },
  { name: 'Betterplace', category: 'Giving', weight: 4, typical: 50, tag: 'donation', tagged: 1 },
  {
    name: 'Bakery Lenz',
    category: 'Eating out',
    weight: 24,
    typical: 9,
    tag: 'business',
    tagged: 0,
  },
  {
    name: 'Café Hinterhof',
    category: 'Eating out',
    weight: 14,
    typical: 21,
    tag: 'business',
    tagged: 0.2,
  },
  {
    name: 'Steuerberater Kahl',
    category: 'Services',
    weight: 4,
    typical: 190,
    tag: 'business',
    tagged: 1,
  },
  { name: 'Allianz', category: 'Insurance', weight: 6, typical: 85, tag: 'business', tagged: 0.5 },
]

/** mulberry32: a small seeded generator, so the fixture never drifts between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** The merchants a freelancer tags on purpose book more often than the private ones. */
const weightOf = (m: MerchantSpec): number => (m.tagged >= 0.7 ? m.weight * 2.5 : m.weight)

function pick(rand: () => number): MerchantSpec {
  const total = MERCHANTS.reduce((sum, m) => sum + weightOf(m), 0)
  let at = rand() * total
  for (const m of MERCHANTS) {
    at -= weightOf(m)
    if (at < 0) return m
  }
  return MERCHANTS[0] as MerchantSpec
}

function year(): readonly Booking[] {
  const rand = seeded(2025)
  const rows: Booking[] = []
  for (let i = 0; i < 599; i++) {
    const m = pick(rand)
    const month = Math.floor(rand() * 12)
    const day = 1 + Math.floor(rand() * (DAYS_IN_MONTH[month] ?? 28))
    const amount = Math.round(m.typical * (0.4 + rand() * 1.4) * 100) / 100
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    rows.push({
      id: `b${i}`,
      date: `${TAX_YEAR}-${mm}-${dd}`,
      amount,
      merchant: m.name,
      category: m.category,
      tag: rand() < m.tagged ? m.tag : null,
    })
  }
  // The one large untagged booking the year holds: a laptop.
  rows.push({
    id: 'b-laptop',
    date: `${TAX_YEAR}-03-14`,
    amount: 2899,
    merchant: 'Apple',
    category: 'Hardware',
    tag: null,
  })
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

const YEAR = year()

/** The `?fixture=` names this scenario knows. */
const FIXTURES = ['no-donations', 'all-tagged', 'one-merchant'] as const
export type FixtureName = (typeof FIXTURES)[number]

const isFixture = (name: string | undefined): name is FixtureName =>
  FIXTURES.some((f) => f === name)

/** The year's bookings for a fixture name; an unknown or absent name is the rest state. */
export function bookingsFor(name: string | undefined): readonly Booking[] {
  if (!isFixture(name)) return YEAR
  if (name === 'no-donations') return YEAR.filter((b) => b.tag !== 'donation')
  if (name === 'all-tagged')
    return YEAR.map((b): Booking => (b.tag === null ? { ...b, tag: 'business' } : b))
  return YEAR.map((b): Booking =>
    b.tag === null && b.merchant !== 'Amazon' ? { ...b, tag: 'business' } : b,
  )
}
