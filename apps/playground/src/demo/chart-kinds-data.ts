/**
 * Synthetic, deterministic fixtures for the strip / composition / panel / sparkline chart tabs.
 * Shapes follow the linewatch rows the kinds were extracted from (`docs/waves/v2-chart-inventory.md`
 * l1, l7, l8). No `Math.random` — the page renders identically on every reload.
 */

const BUCKET_MINUTES = 5
const WINDOW_START = Date.UTC(2026, 7, 20, 0, 0, 0)

/** Deterministic pseudo-random in [0, 1). */
function rand(seed: number, salt = 12.9898): number {
  const x = Math.sin(seed * salt) * 43758.5453
  return x - Math.floor(x)
}

const slotStart = (i: number): Date => new Date(WINDOW_START + i * BUCKET_MINUTES * 60_000)

/**
 * Every scenario below repeats each `SCENARIO_PERIOD` buckets, so the 48-bucket (unfolded) window
 * already holds a gap, an outage and a renegotiation — and the 288-bucket one holds six of each,
 * which is what gives the fold something to merge.
 */
const SCENARIO_PERIOD = 48
const phaseOf = (i: number): number => i % SCENARIO_PERIOD
const within = (phase: number, from: number, to: number): boolean => phase >= from && phase <= to

// ── Availability strip (l1) ─────────────────────────────────────────────────────

export type AvailabilitySlot = {
  start: Date
  /** null = the collector reported nothing for this bucket. */
  lossPct: number | null
  cycles: number
  cyclesDown: number
}

/** Phases of the availability scenario: a coverage gap, then an outage. */
const AVAILABILITY_GAP: readonly [number, number] = [10, 15]
const AVAILABILITY_OUTAGE: readonly [number, number] = [22, 24]
const CYCLES_PER_BUCKET = 10
/** Share of buckets with some loss, and the loss range they draw from. It straddles the demo's
 * full-intensity loss (5%), so the ramp has both a weak and a saturated end. */
const LOSSY_SHARE = 0.07
const LOSS_MIN_PCT = 0.2
const LOSS_SPAN_PCT = 8

function lossAt(i: number, phase: number): number | null {
  if (within(phase, ...AVAILABILITY_GAP)) return null
  if (within(phase, ...AVAILABILITY_OUTAGE)) return 100
  const r = rand(i + 1)
  if (r <= 1 - LOSSY_SHARE) return 0
  const t = (r - (1 - LOSSY_SHARE)) / LOSSY_SHARE
  return Number((LOSS_MIN_PCT + t * LOSS_SPAN_PCT).toFixed(2))
}

export function buildAvailability(count: number): AvailabilitySlot[] {
  return Array.from({ length: count }, (_, i) => {
    const phase = phaseOf(i)
    const gap = within(phase, ...AVAILABILITY_GAP)
    const outage = within(phase, ...AVAILABILITY_OUTAGE)
    return {
      start: slotStart(i),
      lossPct: lossAt(i, phase),
      cycles: gap ? 0 : CYCLES_PER_BUCKET,
      cyclesDown: outage ? CYCLES_PER_BUCKET : 0,
    }
  })
}

/** MAX, never the mean — averaging a fully-down bucket into its clean neighbours describes a
 * bucket that never happened. A group with no measurement stays absent. */
export function mergeAvailability(group: AvailabilitySlot[]): AvailabilitySlot {
  const measured = group.filter((g) => g.lossPct !== null)
  return {
    start: (group[0] as AvailabilitySlot).start,
    lossPct: measured.length === 0 ? null : Math.max(...measured.map((g) => g.lossPct ?? 0)),
    cycles: measured.reduce((s, g) => s + g.cycles, 0),
    cyclesDown: measured.reduce((s, g) => s + g.cyclesDown, 0),
  }
}

// ── Link speed strip (l8) ───────────────────────────────────────────────────────

export type LinkSlot = { start: Date; mbit: number | null; renegotiated: boolean }

/** The fastest rate the link negotiates — the top of the demo's intensity ramp. */
export const LINK_FULL_MBIT = 1000
const LINK_FALLBACK_MBIT = 100
/** Phases of the link scenario: a gap, a drop to the fallback rate, and the recovery. */
const LINK_GAP: readonly [number, number] = [10, 15]
const LINK_DROP_PHASE = 30
const LINK_RECOVER_PHASE = 40

export function buildLink(count: number): LinkSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const phase = phaseOf(i)
    const degraded = phase >= LINK_DROP_PHASE && phase < LINK_RECOVER_PHASE
    let mbit: number | null = degraded ? LINK_FALLBACK_MBIT : LINK_FULL_MBIT
    if (within(phase, ...LINK_GAP)) mbit = null
    return {
      start: slotStart(i),
      mbit,
      renegotiated: phase === LINK_DROP_PHASE || phase === LINK_RECOVER_PHASE,
    }
  })
}

/**
 * A group holding a renegotiation keeps the rate the link renegotiated TO — that is the fact the
 * marker names ("N Mbit after"), and a minimum would report a rate it left. Otherwise the slowest
 * measured speed wins; a group with no measurement stays absent.
 */
export function mergeLink(group: LinkSlot[]): LinkSlot {
  const start = (group[0] as LinkSlot).start
  const renegotiation = group.find((g) => g.renegotiated)
  if (renegotiation) return { start, mbit: renegotiation.mbit, renegotiated: true }
  const speeds = group.flatMap((g) => (g.mbit === null ? [] : [g.mbit]))
  return { start, mbit: speeds.length === 0 ? null : Math.min(...speeds), renegotiated: false }
}

// ── Throughput (l7) ─────────────────────────────────────────────────────────────

export type ThroughputSlot = {
  start: Date
  downBytesPerS: number | null
  upBytesPerS: number | null
  /** Intervals the rate was measured over — the basis of a rate, and the merge weight. */
  intervals: number
  /** Unplaceable samples: the reading is real but understated, so the bar draws dimmer. */
  skipped: number
  /** Source buckets this drawn slot stands for, and how many of those measured nothing. */
  foldedFrom: number
  unmeasured: number
}

/** Phases of the throughput scenario: a gap, and the busy evening that follows. */
const THROUGHPUT_GAP: readonly [number, number] = [10, 15]
const EVENING_FROM_PHASE = 36
const EVENING_FACTOR = 3
const INTERVALS_PER_BUCKET = 20
const MAX_DOWN_BYTES_PER_S = 2_400_000
const MAX_UP_BYTES_PER_S = 180_000
/** A bucket whose draw exceeds this lost some samples to placement: real, but understated. */
const SKIPPED_DRAW = 0.9
const SKIPPED_SAMPLES = 4
const THROUGHPUT_SALT = 7.3319

export function buildThroughput(count: number): ThroughputSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const phase = phaseOf(i)
    const gap = within(phase, ...THROUGHPUT_GAP)
    const r = rand(i + 1, THROUGHPUT_SALT)
    const evening = phase >= EVENING_FROM_PHASE ? EVENING_FACTOR : 1
    return {
      start: slotStart(i),
      downBytesPerS: gap ? null : Math.round(r * MAX_DOWN_BYTES_PER_S * evening),
      upBytesPerS: gap
        ? null
        : Math.round(rand(i + 999, THROUGHPUT_SALT) * MAX_UP_BYTES_PER_S * evening),
      intervals: gap ? 0 : INTERVALS_PER_BUCKET,
      skipped: !gap && r > SKIPPED_DRAW ? SKIPPED_SAMPLES : 0,
      foldedFrom: 1,
      unmeasured: gap ? 1 : 0,
    }
  })
}

/** Weighted by measured intervals — never the mean of per-slot rates, which divides by the wrong
 * denominator. */
export function mergeThroughput(group: ThroughputSlot[]): ThroughputSlot {
  const measured = group.filter((p) => p.downBytesPerS !== null)
  const intervals = measured.reduce((s, p) => s + p.intervals, 0)
  const rate = (pick: (p: ThroughputSlot) => number | null): number | null => {
    if (intervals === 0) return null
    return measured.reduce((s, p) => s + (pick(p) ?? 0) * p.intervals, 0) / intervals
  }
  return {
    start: (group[0] as ThroughputSlot).start,
    downBytesPerS: rate((p) => p.downBytesPerS),
    upBytesPerS: rate((p) => p.upBytesPerS),
    intervals,
    skipped: measured.reduce((s, p) => s + p.skipped, 0),
    foldedFrom: group.length,
    unmeasured: group.length - measured.length,
  }
}

// ── Traffic by channel (StackedArea) ────────────────────────────────────────────

export const TRAFFIC_CHANNELS = ['organic', 'paid', 'referral', 'direct'] as const
export type TrafficChannel = (typeof TRAFFIC_CHANNELS)[number]

export type TrafficPoint = { day: Date } & Record<TrafficChannel, number>

const TRAFFIC_BASE: Record<TrafficChannel, number> = {
  organic: 620,
  paid: 280,
  referral: 150,
  direct: 210,
}

export const TRAFFIC: TrafficPoint[] = Array.from({ length: 30 }, (_, i) => {
  const weekday = i % 7 < 5 ? 1 : 0.62
  const point = { day: new Date(Date.UTC(2026, 8, 1 + i)) } as TrafficPoint
  for (const [n, key] of TRAFFIC_CHANNELS.entries()) {
    const drift = 1 + (i / 30) * (key === 'organic' ? 0.35 : key === 'paid' ? -0.1 : 0.05)
    point[key] = Math.round(
      TRAFFIC_BASE[key] * weekday * drift * (0.9 + rand(i * 4 + n, 3.1) * 0.2),
    )
  }
  return point
})

// ── Donut: revenue by plan ──────────────────────────────────────────────────────

export const PLAN_REVENUE = [
  { key: 'team', value: 48_200 },
  { key: 'pro', value: 31_900 },
  { key: 'enterprise', value: 22_400 },
  { key: 'starter', value: 9_600 },
  { key: 'education', value: 4_100 },
  { key: 'nonprofit', value: 2_300 },
  { key: 'legacy', value: 1_450 },
  { key: 'trial', value: 820 },
] as const

// ── Heatmap: sessions by weekday × hour ─────────────────────────────────────────

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

export type ActivityCell = { day: string; hour: string; sessions: number | null }

/** Working-hours bulge on weekdays, flat on weekends; Sunday 02–04 has no data (a maintenance
 * window), and Wednesday 09 is a measured null — both read as ABSENT, neither as zero. */
export const ACTIVITY: ActivityCell[] = WEEKDAYS.flatMap((day, d) =>
  HOURS.flatMap((hour, h): ActivityCell[] => {
    if (day === 'Sun' && h >= 2 && h <= 4) return []
    if (day === 'Wed' && h === 9) return [{ day, hour, sessions: null }]
    const work =
      d < 5 ? Math.exp(-(((h - 13) / 4.5) ** 2)) : 0.25 * Math.exp(-(((h - 15) / 5) ** 2))
    return [
      { day, hour, sessions: Math.round(8 + work * 140 * (0.85 + rand(d * 24 + h, 5.7) * 0.3)) },
    ]
  }),
)

// ── DualPanel: forecast vs actual, signed variance ──────────────────────────────

export type ForecastPoint = { day: Date; actual: number; forecast: number }

export const FORECAST: ForecastPoint[] = Array.from({ length: 30 }, (_, i) => {
  const forecast = 118 + i * 0.9 + Math.sin(i / 3.2) * 6
  return {
    day: new Date(Date.UTC(2026, 8, 1 + i)),
    forecast: Number(forecast.toFixed(1)),
    actual: Number((forecast + Math.sin(i / 1.9) * 9 + (rand(i, 8.1) - 0.5) * 6).toFixed(1)),
  }
})

// ── Sparklines ──────────────────────────────────────────────────────────────────

export const SPARK_ACTIVE_USERS = [
  1180, 1210, 1195, 1260, 1310, 1290, 1340, 1385, 1360, 1420, 1455, 1483,
]
export const SPARK_LOSS = [0, 0, 0.4, 0, 0, 1.2, 0, 0, 0, 3.1, 0.2, 0, 0, 0, 0.8, 0, 0, 0, 0, 0.1]

export type ServiceRow = {
  name: string
  region: string
  rtt: readonly number[]
  errors: readonly number[]
}

export const SERVICES: ServiceRow[] = [
  {
    name: 'edge-gateway',
    region: 'eu-central',
    rtt: [22, 24, 21, 23, 25, 22, 24, 23, 22, 21],
    errors: [0, 1, 0, 0, 2, 0, 0, 1, 0, 0],
  },
  {
    name: 'auth',
    region: 'eu-central',
    rtt: [41, 44, 52, 61, 58, 49, 47, 45, 43, 42],
    errors: [1, 0, 3, 6, 4, 1, 0, 0, 1, 0],
  },
  {
    name: 'billing',
    region: 'us-east',
    rtt: [88, 91, 87, 95, 102, 99, 94, 90, 92, 89],
    errors: [0, 0, 1, 0, 0, 2, 0, 0, 0, 1],
  },
  {
    name: 'search',
    region: 'ap-south',
    rtt: [140, 132, 150, 171, 188, 176, 160, 149, 143, 138],
    errors: [2, 1, 4, 8, 11, 7, 3, 2, 1, 1],
  },
]
