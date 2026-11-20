/** Harbour wave forecast: 48 hourly rows at the harbour and four points offshore, seeded and deterministic. */
import { createFormat } from 'basalt-ui'

export const LIMIT = 1.5
export const NEXT_HOURS = 12
const WINDOW_ROWS = 4
export const OFFSHORE_POINTS = 4

export type FixtureName = 'rest' | 'calm' | 'storm'

export type Hour = {
  id: string
  at: Date
  /** Significant wave height at the harbour, m. */
  hs: number
  /** Wave period at the harbour, s. */
  tp: number
  /** Wind speed, kt; direction in degrees, null when the wind is 0. */
  wind: number
  dir: number | null
  /** Significant wave height at each offshore point, m. */
  offshore: readonly number[]
  offshoreMax: number
  clock: string
  stamp: string
  windText: string
  /** Height and period as one cell: 2.2 m, 10 s. */
  seaText: string
  sea: 'over' | 'under'
}

export type Forecast = {
  rows: readonly Hour[]
  /** The next 12 hours, the rows the table lists. */
  next: readonly Hour[]
  peak: Hour
  /** The calmest run of rows with every hour under the limit, or null when none is. */
  calm: { from: Hour; to: Hour; mean: number } | null
}

type Shape = { swell: number; base: number; windScale: number; second: number }

const SHAPES: Record<FixtureName, Shape> = {
  rest: { swell: 2.1, base: 0.3, windScale: 1, second: 0.5 },
  calm: { swell: 0.45, base: 0.25, windScale: 0.05, second: 0.2 },
  storm: { swell: 3.6, base: 1.9, windScale: 1.6, second: 0.9 },
}

/** Wind speed controls (hour, kt): a blow from the north-west, a calm at midday tomorrow, a breeze from the south-west. */
const WIND_POINTS: readonly (readonly [number, number])[] = [
  [0, 14],
  [6, 19],
  [12, 15],
  [18, 6],
  [22, 0],
  [26, 3],
  [32, 9],
  [40, 16],
  [47, 20],
]
const SWELL_PEAK_HOUR = 9
const LEADS = [1, 2, 3, 2]
const OFFSHORE_GAIN = [1.35, 1.5, 1.25, 1.6]
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const START = Date.UTC(2026, 10, 19, 18)
const HOUR_MS = 3_600_000
const format = createFormat()
const pad = (n: number): string => String(n).padStart(2, '0')

/** `Fri 17:00`, UTC: the one hour label of the axis, the cursor and the table. */
export function stampOf(at: Date): string {
  return `${format.date(at, 'weekday')} ${pad(at.getUTCHours())}:00`
}

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function windAt(hour: number, scale: number): number {
  const upper = WIND_POINTS.findIndex(([h]) => h >= hour)
  const [h1, w1] = WIND_POINTS[Math.max(upper, 1)] ?? [47, 20]
  const [h0, w0] = WIND_POINTS[Math.max(upper, 1) - 1] ?? [0, 14]
  return Math.max(0, Math.round((w0 + ((w1 - w0) * (hour - h0)) / (h1 - h0)) * scale))
}

const round1 = (n: number): number => Math.round(n * 10) / 10

function compass(dir: number): string {
  return COMPASS[Math.round(dir / 45) % 8] ?? 'N'
}

/** Raw height and swell share at an hour, before noise. */
function seaAt(hour: number, shape: Shape): { hs: number; swellShare: number; wind: number } {
  const wind = windAt(hour, shape.windScale)
  const swell =
    shape.swell * Math.exp(-(((hour - SWELL_PEAK_HOUR) / 5.5) ** 2)) +
    shape.second * Math.exp(-(((hour - 44) / 6) ** 2))
  const windSea = 0.045 * wind
  const hs = Math.hypot(swell, windSea, shape.base)
  return { hs, swellShare: swell / (swell + windSea + shape.base), wind }
}

export function forecastOf(name: FixtureName): Forecast {
  const shape = SHAPES[name]
  const noise = seeded(56)
  const rows: Hour[] = Array.from({ length: 48 }, (_, i) => {
    const at = new Date(START + i * HOUR_MS)
    const { hs, swellShare, wind } = seaAt(i, shape)
    const tp = Math.round(5 + 8.5 * swellShare)
    const hsRound = round1(hs + (noise() - 0.5) * 0.1)
    const dir = wind === 0 ? null : i < 17 ? 315 : i < 34 ? 225 : 180
    const offshore = LEADS.map((lead, k) =>
      round1(
        seaAt(Math.min(47, i + lead), shape).hs * (OFFSHORE_GAIN[k] ?? 1) + (noise() - 0.5) * 0.2,
      ),
    )
    const clock = `${pad(at.getUTCHours())}:00`
    return {
      id: `h${pad(i)}`,
      at,
      hs: hsRound,
      tp,
      wind,
      dir,
      offshore,
      offshoreMax: Math.max(...offshore),
      clock,
      stamp: stampOf(at),
      seaText: `${hsRound.toFixed(1)} m, ${tp} s`,
      windText: dir === null ? `${wind} kt` : `${compass(dir)} ${wind} kt`,
      sea: hsRound > LIMIT ? 'over' : 'under',
    }
  })
  const next = rows.slice(0, NEXT_HOURS)
  const peak = next.reduce((best, r) => (r.hs > best.hs ? r : best), next[0] as Hour)
  return { rows, next, peak, calm: calmestRun(rows) }
}

function calmestRun(rows: readonly Hour[]): Forecast['calm'] {
  let best: NonNullable<Forecast['calm']> | null = null
  for (let i = 0; i + WINDOW_ROWS <= rows.length; i++) {
    const run = rows.slice(i, i + WINDOW_ROWS)
    if (run.some((r) => r.hs > LIMIT)) continue
    const mean = run.reduce((s, r) => s + r.hs, 0) / WINDOW_ROWS
    const from = run[0]
    const to = run.at(-1)
    if (from === undefined || to === undefined) continue
    if (best === null || mean < best.mean) best = { from, to, mean }
  }
  return best
}
