/**
 * Synthetic, deterministic fixtures for the strip / composition / panel / sparkline chart tabs.
 * Shapes follow the linewatch rows the kinds were extracted from (`docs/waves/v2-chart-inventory.md`
 * l1, l7, l8). No `Math.random` — the page renders identically on every reload.
 */

const BUCKET_MINUTES = 5
const WINDOW_START = Date.UTC(2026, 7, 20, 0, 0, 0)

/** Deterministic pseudo-random in [0, 1). */
export function rand(seed: number, salt = 12.9898): number {
  const x = Math.sin(seed * salt) * 43758.5453
  return x - Math.floor(x)
}

const slotStart = (i: number): Date => new Date(WINDOW_START + i * BUCKET_MINUTES * 60_000)

// ── Availability strip (l1) ─────────────────────────────────────────────────────

export type AvailabilitySlot = {
  start: Date
  /** null = the collector reported nothing for this bucket. */
  lossPct: number | null
  cycles: number
  cyclesDown: number
}

export function buildAvailability(count: number): AvailabilitySlot[] {
  return Array.from({ length: count }, (_, i) => {
    const gap = (i > 61 && i < 74) || (i > 190 && i < 197)
    const outage = i > 128 && i < 133
    const r = rand(i + 1)
    const lossPct = gap ? null : outage ? 100 : r > 0.93 ? Number((r * 8).toFixed(2)) : 0
    return {
      start: slotStart(i),
      lossPct,
      cycles: gap ? 0 : 10,
      cyclesDown: outage ? 10 : 0,
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

export function buildLink(count: number): LinkSlot[] {
  return Array.from({ length: count }, (_, i) => ({
    start: slotStart(i),
    mbit: i > 61 && i < 74 ? null : i < 96 || i >= 174 ? 1000 : 100,
    renegotiated: i === 96 || i === 174,
  }))
}

/** The slowest speed wins and a renegotiation anywhere in the group survives the fold. */
export function mergeLink(group: LinkSlot[]): LinkSlot {
  const measured = group.filter((g) => g.mbit !== null)
  return {
    start: (group[0] as LinkSlot).start,
    mbit: measured.length === 0 ? null : Math.min(...measured.map((g) => g.mbit ?? 0)),
    renegotiated: group.some((g) => g.renegotiated),
  }
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

export function buildThroughput(count: number): ThroughputSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const gap = (i > 61 && i < 74) || (i > 210 && i < 216)
    const r = rand(i + 1, 7.3319)
    const evening = i > 200 ? 3 : 1
    return {
      start: slotStart(i),
      downBytesPerS: gap ? null : Math.round(r * 2_400_000 * evening),
      upBytesPerS: gap ? null : Math.round(rand(i + 999, 7.3319) * 180_000 * evening),
      intervals: gap ? 0 : 20,
      skipped: !gap && r > 0.9 ? 4 : 0,
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
  const rate = (pick: (p: ThroughputSlot) => number | null): number | null =>
    intervals === 0
      ? null
      : measured.reduce((s, p) => s + (pick(p) ?? 0) * p.intervals, 0) / intervals
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
