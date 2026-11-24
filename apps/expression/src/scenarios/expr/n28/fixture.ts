/** Household spending: 12 months (Dec 2025 to Nov 2026, November partial) over 10 categories, seeded. */

export const MONTHS = [
  { key: 'Dec', full: 'December 2025' },
  { key: 'Jan', full: 'January 2026' },
  { key: 'Feb', full: 'February 2026' },
  { key: 'Mar', full: 'March 2026' },
  { key: 'Apr', full: 'April 2026' },
  { key: 'May', full: 'May 2026' },
  { key: 'Jun', full: 'June 2026' },
  { key: 'Jul', full: 'July 2026' },
  { key: 'Aug', full: 'August 2026' },
  { key: 'Sep', full: 'September 2026' },
  { key: 'Oct', full: 'October 2026' },
  { key: 'Nov', full: 'November 2026' },
] as const

/** The last complete month is October (index 10); November (index 11) is 17 of 30 days. */
export const LAST_COMPLETE = 10
export const PARTIAL = 11
const PARTIAL_SHARE = 17 / 30

export type Merchant = { name: string; total: number }

export type Category = {
  name: string
  months: readonly number[]
  merchants: readonly Merchant[]
  /** Total of the 12 months, November to date included. */
  total: number
  /** Index of the first month with spending. */
  firstMonth: number
  /** October minus September. */
  delta: number
  /** September, the base of the delta. */
  prior: number
}

type Spec = {
  name: string
  profile: readonly number[]
  fixed?: boolean
  merchants: readonly (readonly [string, number])[]
}

const SPECS: readonly Spec[] = [
  {
    name: 'Housing',
    profile: Array(12).fill(1240),
    fixed: true,
    merchants: [
      ['Landlord, monthly rent', 0.92],
      ['Waste and water', 0.08],
    ],
  },
  {
    name: 'Groceries',
    profile: [810, 790, 760, 770, 740, 730, 720, 760, 750, 780, 790, 780],
    merchants: [
      ['Rewe', 0.36],
      ['Lidl', 0.3],
      ['Edeka', 0.2],
      ['Weekly market', 0.14],
    ],
  },
  {
    name: 'Transport',
    profile: [260, 240, 250, 230, 250, 270, 300, 310, 280, 260, 255, 250],
    merchants: [
      ['Shell', 0.38],
      ['City transit pass', 0.3],
      ['Car service garage', 0.2],
      ['Parking', 0.12],
    ],
  },
  {
    name: 'Energy',
    profile: [230, 225, 190, 140, 100, 80, 72, 70, 78, 92, 205, 210],
    merchants: [
      ['Stadtwerke electricity', 0.46],
      ['Gas supplier', 0.42],
      ['Chimney sweep', 0.12],
    ],
  },
  {
    name: 'Insurance',
    profile: Array(12).fill(186),
    fixed: true,
    merchants: [
      ['Liability and contents', 0.31],
      ['Health top-up', 0.44],
      ['Legal cover', 0.25],
    ],
  },
  {
    name: 'Dining',
    profile: [210, 160, 140, 170, 190, 230, 260, 280, 240, 200, 190, 200],
    merchants: [
      ['Pizzeria Napoli', 0.3],
      ['Cafe Mitte', 0.28],
      ['Burger shop', 0.22],
      ['Sushi bar', 0.2],
    ],
  },
  {
    name: 'Leisure',
    profile: [180, 120, 110, 130, 160, 190, 210, 220, 170, 150, 160, 160],
    merchants: [
      ['Streaming bundle', 0.22],
      ['Cinema', 0.2],
      ['Climbing gym', 0.33],
      ['Books', 0.25],
    ],
  },
  {
    name: 'Clothing',
    profile: [260, 70, 80, 100, 120, 90, 75, 95, 150, 130, 190, 170],
    merchants: [
      ['Kids outlet', 0.4],
      ['Sports outfitter', 0.35],
      ['Department store', 0.25],
    ],
  },
  {
    name: 'Travel',
    profile: [120, 0, 0, 380, 0, 0, 1450, 820, 60, 140, 60, 0],
    merchants: [
      ['Rail tickets', 0.3],
      ['Beach house rental', 0.45],
      ['Airline', 0.25],
    ],
  },
  {
    name: 'Renovation',
    profile: [0, 0, 0, 640, 980, 450, 0, 0, 320, 180, 210, 150],
    merchants: [
      ['Hardware store', 0.5],
      ['Tiler, invoice', 0.34],
      ['Paint shop', 0.16],
    ],
  },
]

/** A small seeded generator (mulberry32), so every load draws the same year. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function split(total: number, parts: readonly (readonly [string, number])[]): Merchant[] {
  let left = total
  return parts.map(([name, weight], i) => {
    const value = i === parts.length - 1 ? left : Math.round(total * weight)
    left -= value
    return { name, total: value }
  })
}

export type Variant = 'default' | 'extreme'

/** Categories ranked by 12-month total. `extreme` books a 2,950 flight in October. */
export function buildCategories(variant: Variant): Category[] {
  const rand = seeded(28)
  return SPECS.map((spec) => {
    const months = spec.profile.map((base, i) => {
      if (base === 0) return 0
      const noise = spec.fixed ? 1 : 0.97 + rand() * 0.06
      const partial = spec.fixed || i !== PARTIAL ? 1 : PARTIAL_SHARE
      return Math.round(base * noise * partial)
    })
    if (variant === 'extreme' && spec.name === 'Travel') months[LAST_COMPLETE] = 2950
    const total = months.reduce((sum, v) => sum + v, 0)
    const prior = months[LAST_COMPLETE - 1] ?? 0
    return {
      name: spec.name,
      months,
      merchants: split(total, spec.merchants).sort((a, b) => b.total - a.total),
      total,
      firstMonth: months.findIndex((v) => v > 0),
      delta: (months[LAST_COMPLETE] ?? 0) - prior,
      prior,
    }
  }).sort((a, b) => b.total - a.total)
}
