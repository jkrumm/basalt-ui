/**
 * Regenerates `src/demo/cbbi.snapshot.json`: `bun apps/playground/scripts/cbbi-snapshot.ts [--from <file|url>]`.
 *
 * The snapshot is the public CBBI daily data (the Colin Talks Crypto Bitcoin Bull Run Index: the price,
 * the confidence and nine metrics, each in a plain and a diminishing-returns variant), trimmed to
 * what the dashboard draws: every third day ending on the latest, a metric stored in thousandths so
 * a reading is an integer, the price whole above 100 USD. The page reads it through a query, so a
 * live endpoint replaces the snapshot with no change to the page.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'https://colintalkscrypto.com/cbbi/data/latest.json'
const OUT = join(import.meta.dir, '..', 'src', 'demo', 'cbbi.snapshot.json')
const STEP = 3

/** The source's metric names in the order the page lists them, with the keys the snapshot stores. */
const METRICS = [
  ['PiCycle', 'piCycle'],
  ['RUPL', 'rupl'],
  ['RHODL', 'rhodl'],
  ['Puell', 'puell'],
  ['2YMA', 'ma2y'],
  ['Trolololo', 'trolololo'],
  ['MVRV', 'mvrv'],
  ['ReserveRisk', 'reserveRisk'],
  ['Woobull', 'woobull'],
] as const

type Series = Record<string, number | null>
const arg = process.argv.indexOf('--from')
const from = arg === -1 ? SOURCE : (process.argv[arg + 1] ?? SOURCE)
const raw: Record<string, Series> = JSON.parse(
  from.startsWith('http') ? await (await fetch(from)).text() : readFileSync(from, 'utf8'),
)

const price = raw['Price'] as Series
const days = Object.keys(price)
  .map(Number)
  .sort((a, b) => a - b)
// Every STEP-th day counted back from the latest, so the last reading is always kept.
const kept = days.filter((_, i) => (days.length - 1 - i) % STEP === 0)
const read = (key: string, t: number): number | null => (raw[key] as Series)[String(t)] ?? null
const thousandths = (v: number | null): number | null => (v === null ? null : Math.round(v * 1000))
const dollars = (v: number | null): number | null =>
  v === null ? null : v < 100 ? Math.round(v * 100) / 100 : Math.round(v)

const first = kept[0] as number
writeFileSync(
  OUT,
  JSON.stringify({
    source: SOURCE,
    start: new Date(first * 1000).toISOString().slice(0, 10),
    stepDays: STEP,
    price: kept.map((t) => dollars(read('Price', t))),
    metrics: Object.fromEntries(
      METRICS.map(([key, name]) => [
        name,
        {
          plain: kept.map((t) => thousandths(read(key, t))),
          dr: kept.map((t) => thousandths(read(`${key}2`, t))),
        },
      ]),
    ),
  }),
)
console.log(`${kept.length} readings from ${new Date(first * 1000).toISOString().slice(0, 10)}`)
