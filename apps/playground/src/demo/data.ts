/**
 * Synthetic, deterministic demo data. No randomness at module load so the playground renders
 * identically every reload (and a `vite build` snapshot is stable). Plain data — no framework
 * import — consumed by the chart pages.
 */

export type DayPoint = {
  date: string
  sessions: number
  signups: number
  revenue: number
  churn: number
  /** Composite health 0–100 driving the ZonedLine demo. */
  health: number
}

export type DateRange = '1d' | '7d' | '30d'

const DAY_LABELS = [
  'Mar 01',
  'Mar 02',
  'Mar 03',
  'Mar 04',
  'Mar 05',
  'Mar 06',
  'Mar 07',
  'Mar 08',
  'Mar 09',
  'Mar 10',
  'Mar 11',
  'Mar 12',
  'Mar 13',
  'Mar 14',
]

// Hand-tuned series — a believable shape, all positive, with one churn dip the zones can frame.
const SESSIONS = [820, 910, 870, 1040, 1180, 760, 690, 1220, 1310, 1280, 1390, 1450, 980, 1010]
const SIGNUPS = [42, 51, 47, 63, 71, 38, 33, 78, 84, 80, 91, 96, 58, 61]
const REVENUE = [1.9, 2.3, 2.1, 2.8, 3.2, 1.6, 1.4, 3.5, 3.8, 3.6, 4.1, 4.4, 2.6, 2.7]
const CHURN = [9, 7, 8, 6, 5, 12, 14, 5, 4, 5, 4, 3, 7, 6]
const HEALTH = [62, 68, 64, 74, 81, 52, 47, 84, 88, 86, 91, 94, 71, 73]

export const SERIES_DATA: DayPoint[] = DAY_LABELS.map((date, i) => ({
  date,
  sessions: SESSIONS[i] ?? 0,
  signups: SIGNUPS[i] ?? 0,
  revenue: REVENUE[i] ?? 0,
  churn: CHURN[i] ?? 0,
  health: HEALTH[i] ?? 0,
}))

// ── Date-range data generator ────────────────────────────────────────────────

/** Base daily values used as the seed for all range generators. */
const BASE_DAILY = { sessions: 1100, signups: 65, revenue: 3.0, churn: 6, health: 75 }

/**
 * Deterministic pseudo-random value seeded by a day index. Produces a repeatable
 * multiplier in [0.6, 1.5] that gives the charts a realistic wavy shape without
 * any runtime randomness.
 */
function dayWave(day: number): number {
  // Mixing sine waves at different frequencies — purely cosmetic, fully deterministic.
  const v = Math.sin(day * 0.27 + 1.3) * 0.25 + Math.sin(day * 0.13 + 2.7) * 0.2 + 1.0
  return Math.round(v * 100) / 100
}

function hourlyWave(hour: number): number {
  const v = Math.sin(hour * 0.52 + 0.8) * 0.3 + Math.sin(hour * 0.18 + 1.9) * 0.15 + 1.0
  return Math.round(v * 100) / 100
}

function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function dayLabel(offset: number): string {
  // Count backwards from "today" (Jun 30) so the 30d view looks recent.
  const d = new Date(2025, 5, 30 - offset)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function generateDashboardData(range: DateRange): {
  series: DayPoint[]
  sparks: { sessions: number[]; signups: number[]; revenue: number[] }
} {
  const count = range === '1d' ? 24 : range === '7d' ? 7 : 30
  const isHourly = range === '1d'

  const series: DayPoint[] = []
  const sSessions: number[] = []
  const sSignups: number[] = []
  const sRevenue: number[] = []

  for (let i = 0; i < count; i++) {
    const wave = isHourly ? hourlyWave(i) : dayWave(i)
    const sessions = Math.round(BASE_DAILY.sessions * wave * (isHourly ? 0.06 : 1))
    const signups = Math.round(BASE_DAILY.signups * wave * (isHourly ? 0.06 : 1))
    const revenue = Math.round(BASE_DAILY.revenue * wave * (isHourly ? 0.06 : 1) * 100) / 100
    const churn = Math.round(BASE_DAILY.churn * (2 - wave))
    const health = Math.round(BASE_DAILY.health * Math.min(wave, 1.3))

    series.push({
      date: isHourly ? hourLabel(i) : dayLabel(count - 1 - i),
      sessions,
      signups,
      revenue,
      churn,
      health,
    })
    sSessions.push(sessions)
    sSignups.push(signups)
    sRevenue.push(revenue)
  }

  return { series, sparks: { sessions: sSessions, signups: sSignups, revenue: sRevenue } }
}

/** Channel mix for the Donut demo. */
export type ChannelSlice = { key: string; label: string; value: number }
export const CHANNEL_MIX: ChannelSlice[] = [
  { key: 'sessions', label: 'Direct', value: 4200 },
  { key: 'signups', label: 'Referral', value: 2600 },
  { key: 'revenue', label: 'Organic', value: 1900 },
  { key: 'churn', label: 'Paid', value: 1100 },
]

/** Bare number arrays for the sparklines (one per KPI tile). */
export const SPARK_SESSIONS = SESSIONS
export const SPARK_SIGNUPS = SIGNUPS
export const SPARK_REVENUE = REVENUE

// ── MultiLine demo: per-lift e1RM trend + trailing MA + PR markers ──────────

/** Trailing moving average (deterministic) — window-sized mean ending at each index. */
function trailingMa(arr: number[], window: number): number[] {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = arr.slice(start, i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

/** Boolean PR flags — true where the value strictly exceeds every prior value (a running max). */
function prFlags(arr: number[]): boolean[] {
  let max = -Infinity
  return arr.map((v) => {
    const isPr = v > max
    if (isPr) max = v
    return isPr
  })
}

const BENCH = [100, 102, 101, 105, 104, 108, 107, 110, 109, 113, 112, 116]
const SQUAT = [140, 143, 142, 148, 150, 149, 154, 156, 155, 160, 162, 166]
const DEAD = [180, 178, 185, 188, 186, 192, 195, 193, 200, 198, 205, 208]
const BENCH_MA = trailingMa(BENCH, 4)
const SQUAT_MA = trailingMa(SQUAT, 4)
const DEAD_MA = trailingMa(DEAD, 4)
const BENCH_PR = prFlags(BENCH)
const SQUAT_PR = prFlags(SQUAT)
const DEAD_PR = prFlags(DEAD)

export type LiftPoint = {
  /** Session label (x category). */
  session: string
  bench: number
  squat: number
  dead: number
  benchMa: number
  squatMa: number
  deadMa: number
  benchPr: boolean
  squatPr: boolean
  deadPr: boolean
}

/** Estimated 1RM (kg) across 12 sessions for three lifts, with 4-session MAs + PR flags. */
export const LIFT_TREND: LiftPoint[] = BENCH.map((_, i) => ({
  session: `S${i + 1}`,
  bench: BENCH[i]!,
  squat: SQUAT[i]!,
  dead: DEAD[i]!,
  benchMa: Math.round((BENCH_MA[i] ?? 0) * 10) / 10,
  squatMa: Math.round((SQUAT_MA[i] ?? 0) * 10) / 10,
  deadMa: Math.round((DEAD_MA[i] ?? 0) * 10) / 10,
  benchPr: BENCH_PR[i] ?? false,
  squatPr: SQUAT_PR[i] ?? false,
  deadPr: DEAD_PR[i] ?? false,
}))

// ── DualPanel demo: acute vs chronic load + signed divergence histogram ─────

const ACUTE = [48, 55, 60, 52, 46, 58, 66, 70, 64, 55, 50, 62, 68, 58]
const CHRONIC = [50, 51, 52, 52, 53, 54, 55, 57, 58, 58, 57, 58, 60, 60]

export type LoadPoint = {
  date: string
  /** 7-day acute training load. */
  acute: number
  /** 28-day chronic training load (baseline). */
  chronic: number
  /** Signed acute − chronic (the bottom-pane histogram). */
  divergence: number
}

/** Acute/chronic load over the same 14-day calendar as SERIES_DATA. */
export const LOAD_TREND: LoadPoint[] = DAY_LABELS.map((date, i) => ({
  date,
  acute: ACUTE[i]!,
  chronic: CHRONIC[i]!,
  divergence: ACUTE[i]! - CHRONIC[i]!,
}))

// ── Heatmap demo: day-of-week × hour-of-day session intensity ───────────────

const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const HEATMAP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const

/** Deterministic intensity: weekday morning + evening peaks, lighter weekends. */
function sessionLoad(dayIdx: number, hour: number): number {
  const weekend = dayIdx >= 5
  const morning = Math.max(0, 10 - Math.abs(hour - 10) * 2.2)
  const evening = Math.max(0, 12 - Math.abs(hour - 18) * 2.6)
  const base = morning + evening
  const dayFactor = weekend ? 0.45 : 1 - dayIdx * 0.05
  return Math.round(base * dayFactor)
}

export type HeatCell = { day: string; hour: string; sessions: number }

/** 7×12 grid of session counts (84 cells). */
export const ACTIVITY_HEATMAP: HeatCell[] = HEATMAP_DAYS.flatMap((day, di) =>
  HEATMAP_HOURS.map((hour) => ({
    day,
    hour: `${hour}:00`,
    sessions: sessionLoad(di, hour),
  })),
)
