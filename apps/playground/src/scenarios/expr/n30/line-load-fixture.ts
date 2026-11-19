/** Seeded, deterministic fixture for expr-n30: a week of 15-minute byte counters with gaps where the collector missed its cycles. */

export const CONTRACT_MBIT = { down: 500, up: 50 } as const
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

const BUCKETS_PER_HOUR = 4
const BUCKET_SECONDS = 900

/** One 15-minute counter reading; a bucket the collector skipped has no row at all. */
export type Bucket = { day: number; slot: number; downBytes: number; upBytes: number }

/** One day-and-hour cell: the busiest 15 minutes of each direction, as a share of the contract. */
export type HourCell = {
  key: string
  day: (typeof DAYS)[number]
  hour: string
  /** Busiest bucket as % of the contracted rate; `null` when every bucket of the hour was skipped. */
  downPct: number | null
  upPct: number | null
  downAt: string | null
  upAt: string | null
  /** Buckets of this hour with no reading, 0 to 4. */
  missed: number
}

export type LineLoad = {
  buckets: readonly Bucket[]
  cells: readonly HourCell[]
}

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mbitToBytes = (mbit: number): number => Math.round((mbit * 1e6 * BUCKET_SECONDS) / 8)
const bytesToMbit = (bytes: number): number => (bytes * 8) / (BUCKET_SECONDS * 1e6)

/** Share of the down rate by hour of day: a quiet night, a working-day plateau, a streaming evening. */
function downShape(hour: number, weekend: boolean): number {
  if (hour < 6) return 0.02
  if (hour < 9) return weekend ? 0.05 : 0.14
  if (hour < 17) return weekend ? 0.3 : 0.12
  if (hour < 19) return 0.3
  if (hour < 23) return 0.62
  return 0.2
}

/** Share of the up rate: video calls by day, a nightly cloud backup. */
function upShape(hour: number, weekend: boolean): number {
  if (hour >= 1 && hour < 4) return 0.55
  if (hour < 7) return 0.03
  if (hour < 17) return weekend ? 0.06 : 0.28
  return 0.12
}

export function lineLoad(variant: string | undefined): LineLoad {
  const quiet = variant === 'quiet'
  const next = rng(30)
  const buckets: Bucket[] = []
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < 24 * BUCKETS_PER_HOUR; slot++) {
      const hour = Math.floor(slot / BUCKETS_PER_HOUR)
      const weekend = day >= 5
      const missedRun = day === 2 && hour >= 14 && hour < 16
      const dead = day === 0 && hour === 4
      const scattered = next() < 0.025
      const jitterDown = 0.55 + next() * 0.9
      const jitterUp = 0.55 + next() * 0.9
      if (missedRun || scattered) continue
      const scale = quiet ? 0.04 : 1
      let down = dead ? 0 : downShape(hour, weekend) * CONTRACT_MBIT.down * jitterDown * scale
      let up = dead ? 0 : upShape(hour, weekend) * CONTRACT_MBIT.up * jitterUp * scale
      if (!quiet && day === 3 && slot === 20 * 4 + 1) {
        down = CONTRACT_MBIT.down * (variant === 'over' ? 1.08 : 0.94)
      }
      if (!quiet && day === 1 && slot === 2 * 4 + 2) up = CONTRACT_MBIT.up * 0.88
      buckets.push({
        day,
        slot,
        downBytes: mbitToBytes(Math.min(down, CONTRACT_MBIT.down * 1.2)),
        upBytes: mbitToBytes(Math.min(up, CONTRACT_MBIT.up * 1.2)),
      })
    }
  }
  return { buckets, cells: hourCells(buckets) }
}

export const noLoad: LineLoad = { buckets: [], cells: [] }

const clock = (slot: number): string => {
  const hour = Math.floor(slot / BUCKETS_PER_HOUR)
  const minute = (slot % BUCKETS_PER_HOUR) * 15
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function hourCells(buckets: readonly Bucket[]): HourCell[] {
  const cells: HourCell[] = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const inHour = buckets.filter(
        (b) => b.day === day && Math.floor(b.slot / BUCKETS_PER_HOUR) === hour,
      )
      const busiest = (pick: (b: Bucket) => number, rate: number) => {
        let best: Bucket | undefined
        for (const b of inHour) if (best === undefined || pick(b) > pick(best)) best = b
        if (best === undefined) return { pct: null, at: null }
        return { pct: (bytesToMbit(pick(best)) / rate) * 100, at: clock(best.slot) }
      }
      const down = busiest((b) => b.downBytes, CONTRACT_MBIT.down)
      const up = busiest((b) => b.upBytes, CONTRACT_MBIT.up)
      cells.push({
        key: `${day}-${hour}`,
        day: DAYS[day] ?? 'Mon',
        hour: HOURS[hour] ?? '00',
        downPct: down.pct,
        upPct: up.pct,
        downAt: down.at,
        upAt: up.at,
        missed: BUCKETS_PER_HOUR - inHour.length,
      })
    }
  }
  return cells
}
