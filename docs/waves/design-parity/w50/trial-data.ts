/**
 * The expression trial's five datasets (Wave 50, v4 onward), generated from one seed so every
 * figure agrees with every other: the channel split and the product split sum exactly to the
 * October totals of the daily orders, the revenue-to-date is the same sum, and each log entry is
 * tied to the day whose numbers it explains (the outage day is the low day, the promo the spike).
 *
 * Usage: bun docs/waves/design-parity/w50/trial-data.ts <out-dir>
 * Writes orders.json, target.json, channels.json, products.json, log.json into <out-dir>.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SEED = 50
const FIRST_DAY = '2026-08-24'
const DAYS = 60 // ends 2026-10-22, "today" in the trial
const TARGET = 60_000
const AVG_BAG_PRICE = 14.5

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const rand = mulberry32(SEED)

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Split `total` into integer parts proportional to `weights`, summing exactly to `total`. */
function split(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  const raw = weights.map((w) => (total * w) / sum)
  const parts = raw.map(Math.floor)
  let rest = total - parts.reduce((s, p) => s + p, 0)
  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .toSorted((a, b) => b.frac - a.frac)
  for (const { i } of byRemainder) {
    if (rest === 0) break
    parts[i] = (parts[i] ?? 0) + 1
    rest -= 1
  }
  return parts
}

// Days the log explains: index into the 60-day series.
const OUTAGE_DAY = 49 // 2026-10-12: checkout down 3 h
const PROMO_DAY = 54 // 2026-10-17: newsletter promo
const ROASTER_DAY = 44 // 2026-10-07: roaster maintenance, wholesale delayed

const orders = Array.from({ length: DAYS }, (_, i) => {
  const date = addDays(FIRST_DAY, i)
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const weekend = weekday === 0 || weekday === 6 ? 0.78 : 1
  const growth = 1 + i * 0.006
  let count = Math.round((52 + rand() * 14) * weekend * growth)
  if (i === OUTAGE_DAY) count = Math.round(count * 0.45)
  if (i === PROMO_DAY) count = Math.round(count * 1.7)
  const bags = Math.round(count * (1.45 + rand() * 0.2))
  const revenue = Math.round(bags * AVG_BAG_PRICE * (0.95 + rand() * 0.1))
  return { date, orders: count, bags, revenue }
})

const october = orders.filter((d) => d.date >= '2026-10-01')
const revenueToDate = october.reduce((s, d) => s + d.revenue, 0)
const bagsToDate = october.reduce((s, d) => s + d.bags, 0)

let running = 0
const target = {
  month: '2026-10',
  target: TARGET,
  daysInMonth: 31,
  revenueToDate,
  daily: october.map((d) => {
    running += d.revenue
    return { date: d.date, revenue: d.revenue, cumulative: running }
  }),
}

const CHANNELS = [
  { channel: 'Online shop', weight: 0.46 },
  { channel: 'Wholesale (cafés)', weight: 0.31 },
  { channel: 'Subscriptions', weight: 0.17 },
  { channel: 'Market stall', weight: 0.06 },
] as const
const channelRevenue = split(
  revenueToDate,
  CHANNELS.map((c) => c.weight),
)
const channels = CHANNELS.map((c, i) => ({ channel: c.channel, revenue: channelRevenue[i] ?? 0 }))

const PRODUCTS = [
  'Ethiopia Yirgacheffe',
  'House Espresso',
  'Colombia Huila',
  'Brazil Cerrado',
  'Decaf Swiss Water',
  'Kenya Nyeri',
  'Guatemala Antigua',
  'Sumatra Mandheling',
  'Costa Rica Tarrazú',
  'Peru Cajamarca',
  'Rwanda Huye',
  'Seasonal Blend',
] as const
const productWeights = PRODUCTS.map((_, i) => 1 / (i + 1.6) + rand() * 0.02)
const productBags = split(bagsToDate, productWeights)
const products = PRODUCTS.map((name, i) => ({ product: name, bags: productBags[i] ?? 0 })).toSorted(
  (a, b) => b.bags - a.bags,
)

const day = (i: number) => orders[i]?.date ?? FIRST_DAY
const log = [
  {
    at: `${day(40)}T07:10`,
    severity: 'info',
    kind: 'Delivery',
    note: 'Green coffee from Huila arrived, 18 sacks.',
  },
  {
    at: `${day(41)}T09:30`,
    severity: 'info',
    kind: 'Roast',
    note: 'New profile for House Espresso approved.',
  },
  {
    at: `${day(43)}T16:05`,
    severity: 'warning',
    kind: 'Equipment',
    note: 'Roaster exhaust fan noisy; maintenance booked.',
  },
  {
    at: `${day(ROASTER_DAY)}T08:00`,
    severity: 'warning',
    kind: 'Equipment',
    note: 'Roaster down for maintenance until 14:00.',
  },
  {
    at: `${day(ROASTER_DAY)}T15:20`,
    severity: 'warning',
    kind: 'Wholesale',
    note: 'Six café orders ship one day late.',
  },
  {
    at: `${day(46)}T11:45`,
    severity: 'info',
    kind: 'Stock',
    note: 'Kenya Nyeri down to 9 kg; reorder placed.',
  },
  {
    at: `${day(48)}T10:00`,
    severity: 'info',
    kind: 'Market',
    note: 'Market stall sold out by noon.',
  },
  {
    at: `${day(OUTAGE_DAY)}T12:40`,
    severity: 'critical',
    kind: 'Shop',
    note: 'Checkout down: payment provider timeout.',
  },
  {
    at: `${day(OUTAGE_DAY)}T15:35`,
    severity: 'info',
    kind: 'Shop',
    note: 'Checkout restored after 2 h 55 min.',
  },
  {
    at: `${day(50)}T09:15`,
    severity: 'warning',
    kind: 'Shop',
    note: 'Eleven abandoned carts from the outage emailed.',
  },
  {
    at: `${day(52)}T14:00`,
    severity: 'info',
    kind: 'Subscriptions',
    note: '24 new subscribers this week.',
  },
  {
    at: `${day(PROMO_DAY)}T06:30`,
    severity: 'info',
    kind: 'Marketing',
    note: 'Newsletter promo sent: 10 % off Seasonal Blend.',
  },
  {
    at: `${day(PROMO_DAY)}T18:00`,
    severity: 'info',
    kind: 'Shop',
    note: `Busiest day of the month: ${orders[PROMO_DAY]?.orders ?? 0} orders.`,
  },
  {
    at: `${day(57)}T08:20`,
    severity: 'warning',
    kind: 'Stock',
    note: 'Decaf below safety stock until Friday.',
  },
  {
    at: `${day(59)}T10:10`,
    severity: 'info',
    kind: 'Delivery',
    note: 'Packaging restock delivered.',
  },
]

const out = process.argv[2]
if (!out) throw new Error('usage: bun trial-data.ts <out-dir>')
mkdirSync(out, { recursive: true })
const files = {
  'orders.json': orders,
  'target.json': target,
  'channels.json': channels,
  'products.json': products,
  'log.json': log,
}
for (const [name, data] of Object.entries(files))
  writeFileSync(join(out, name), `${JSON.stringify(data, null, 2)}\n`)

const channelSum = channels.reduce((s, c) => s + c.revenue, 0)
const productSum = products.reduce((s, p) => s + p.bags, 0)
if (channelSum !== revenueToDate || productSum !== bagsToDate) throw new Error('datasets disagree')
process.stdout.write(
  `wrote 5 files to ${out}: October revenue €${revenueToDate}, ${bagsToDate} bags\n`,
)
