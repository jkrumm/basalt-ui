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
