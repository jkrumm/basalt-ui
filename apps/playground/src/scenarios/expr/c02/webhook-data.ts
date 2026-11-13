/**
 * c02 fixture: webhook deliveries, 8 endpoints by 24 hourly buckets, attempts and failures per cell.
 * Deterministic: the seeded generator runs once at module load and "now" is a fixed instant.
 *
 * The story it carries, so the board can be checked against it:
 *   - orders:    a FAILURE problem. From 09:00 UTC nearly every delivery fails; volume stays normal.
 *   - crm-sync:  a VOLUME problem. From 11:00 UTC attempts run at about eight times normal and a
 *                share of them are rejected (rate limit); the failure rate stays modest.
 *   - shipments: one transient bad hour that recovered: not part of the answer.
 *   - ledger:    a trickle endpoint with empty hours and a 2-of-2 hour (an extreme rate on a
 *                sample too small to mean anything).
 */
import { itemAt, seeded } from '../../fixture-utils'

/** The reading time. Fixed, so "last 3 h" and "since 09:00" never move under a screenshot. */
export const NOW_MS = Date.UTC(2026, 10, 12, 15, 0)
const HOUR_MS = 3_600_000
export const WINDOW_HOURS = 24
const WINDOW_START = NOW_MS - WINDOW_HOURS * HOUR_MS

/** A cell with fewer attempts than this has no meaningful rate. */
export const MIN_SAMPLE = 5
/** The recent window the table's "now" figures read, in hours. */
export const RECENT_HOURS = 3
/** An hour at or above this failure rate (%) is failing; at or above `WARN_RATE_PCT` it is elevated. */
export const FAIL_RATE_PCT = 20
export const WARN_RATE_PCT = 5
/** Attempts at or above this multiple of the endpoint's own median are a volume problem. */
export const VOLUME_RATIO = 3

export type Cell = {
  endpoint: string
  /** The bucket start, epoch ms. */
  hourMs: number
  attempts: number
  failures: number
}

type EndpointSpec = {
  name: string
  url: string
  /** Typical attempts per hour at the daily average. */
  base: number
  /** Typical failure rate, 0..1. */
  failRate: number
  /** Overrides by bucket index (0 = oldest): attempts multiplier and failure rate. */
  override?: (index: number) => { volume?: number; failRate?: number } | undefined
  /** Buckets forced to an exact `[attempts, failures]`. */
  exact?: Readonly<Record<number, readonly [number, number]>>
}

/** Bucket index of a UTC clock hour inside the window (the window opens at 15:00 the day before). */
const idxOf = (utcHour: number): number => (utcHour - 15 + 24) % 24

const SPECS: readonly EndpointSpec[] = [
  {
    name: 'orders',
    url: 'shop.example.com/hooks/orders',
    base: 420,
    failRate: 0.008,
    override: (i) => {
      if (i === idxOf(9)) return { volume: 1.1, failRate: 0.38 }
      if (i > idxOf(9)) return { volume: 1.15, failRate: 0.86 + ((i * 7) % 11) / 100 }
      return undefined
    },
  },
  {
    name: 'crm-sync',
    url: 'crm.example.com/sync',
    base: 90,
    failRate: 0.01,
    override: (i) =>
      i >= idxOf(11) ? { volume: 8 + (i % 3) * 0.6, failRate: 0.07 + (i % 4) * 0.012 } : undefined,
  },
  { name: 'invoices', url: 'billing.example.com/hooks/invoice', base: 210, failRate: 0.01 },
  { name: 'inventory', url: 'warehouse.example.com/stock', base: 300, failRate: 0.005 },
  {
    name: 'shipments',
    url: 'logistics.example.com/shipments',
    base: 150,
    failRate: 0.02,
    override: (i) => (i === idxOf(2) ? { failRate: 0.27 } : undefined),
  },
  {
    name: 'ledger',
    url: 'finance.example.com/ledger',
    base: 5,
    failRate: 0.02,
    exact: {
      [idxOf(18)]: [0, 0],
      [idxOf(19)]: [0, 0],
      [idxOf(20)]: [0, 0],
      [idxOf(21)]: [0, 0],
      [idxOf(5)]: [2, 2],
    },
  },
  { name: 'alerts', url: 'ops.example.com/alerts', base: 60, failRate: 0.012 },
  { name: 'audit-log', url: 'audit.example.com/ingest', base: 40, failRate: 0.004 },
]

/** Traffic follows the working day: a trough at 01:00 UTC, a peak at 13:00. */
const daily = (utcHour: number): number => 0.7 + 0.3 * Math.cos(((utcHour - 13) / 24) * 2 * Math.PI)

function buildCells(): Cell[] {
  const rand = seeded(20261112)
  const cells: Cell[] = []
  for (const spec of SPECS) {
    for (let i = 0; i < WINDOW_HOURS; i++) {
      const hourMs = WINDOW_START + i * HOUR_MS
      const utcHour = new Date(hourMs).getUTCHours()
      const forced = spec.exact?.[i]
      if (forced !== undefined) {
        cells.push({ endpoint: spec.name, hourMs, attempts: forced[0], failures: forced[1] })
        continue
      }
      const o = spec.override?.(i)
      const attempts = Math.max(
        0,
        Math.round(spec.base * daily(utcHour) * (o?.volume ?? 1) * (0.9 + rand() * 0.2)),
      )
      const rate = (o?.failRate ?? spec.failRate) * (0.8 + rand() * 0.4)
      cells.push({
        endpoint: spec.name,
        hourMs,
        attempts,
        failures: Math.min(attempts, Math.round(attempts * rate)),
      })
    }
  }
  return cells
}

export const CELLS: readonly Cell[] = buildCells()

/** Failure rate in percent; null when no rate exists (no attempts) or means little (a tiny sample). */
export const failureRatePct = (c: Pick<Cell, 'attempts' | 'failures'>): number | null =>
  c.attempts < MIN_SAMPLE ? null : (c.failures / c.attempts) * 100

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? itemAt(sorted, mid)
    : (itemAt(sorted, mid - 1) + itemAt(sorted, mid)) / 2
}

export type Status = 'Failing' | 'Degraded' | 'Healthy'
export type Problem = 'failures' | 'volume' | 'none'

export type EndpointRow = {
  name: string
  url: string
  status: Status
  problem: Problem
  /** Failure rate over the last `RECENT_HOURS`, percent; null when the sample is too small. */
  recentRatePct: number | null
  recentAttempts: number
  /** Last-window hourly attempts as a multiple of the endpoint's 24 h median. */
  recentVolumeRatio: number
  typicalAttempts: number
  /** Start of the trailing run of elevated hours; undefined when the endpoint is healthy now. */
  sinceMs: number | undefined
  /** Start of the trailing run at or above the fail line; undefined when the last hour is under it. */
  failSinceMs: number | undefined
  /** Start of the trailing run at or above the volume line; undefined when the last hour is under it. */
  spikeSinceMs: number | undefined
  /** When the problem the table names began: the spike for a volume problem, else the failing run. */
  problemSinceMs: number | undefined
  /** Failure rate over the hours before the problem began (the whole window if it never did). */
  baselineRatePct: number | null
}

const byEndpoint = (name: string): Cell[] => CELLS.filter((c) => c.endpoint === name)

/** The endpoint's own median hourly attempts: its volume baseline. */
export const typicalAttempts = (name: string): number =>
  median(byEndpoint(name).map((c) => c.attempts))

/** Attempts of a cell as a multiple of its endpoint's baseline; null when the baseline is zero. */
const TYPICAL = new Map(SPECS.map((s) => [s.name, typicalAttempts(s.name)]))
export const volumeRatio = (c: Pick<Cell, 'endpoint' | 'attempts'>): number | null => {
  const typical = TYPICAL.get(c.endpoint) ?? 0
  return typical === 0 ? null : c.attempts / typical
}

const isElevated = (c: Cell): boolean => {
  const rate = failureRatePct(c)
  const ratio = volumeRatio(c)
  return (rate !== null && rate >= WARN_RATE_PCT) || (ratio !== null && ratio >= VOLUME_RATIO)
}

function summarize(spec: EndpointSpec): EndpointRow {
  const cells = byEndpoint(spec.name)
  const recent = cells.slice(-RECENT_HOURS)
  const recentAttempts = recent.reduce((sum, c) => sum + c.attempts, 0)
  const recentFailures = recent.reduce((sum, c) => sum + c.failures, 0)
  const recentRatePct = failureRatePct({ attempts: recentAttempts, failures: recentFailures })
  const typical = TYPICAL.get(spec.name) ?? 0
  const recentVolumeRatio = typical === 0 ? 0 : recentAttempts / RECENT_HOURS / typical

  const status: Status =
    recentRatePct !== null && recentRatePct >= FAIL_RATE_PCT
      ? 'Failing'
      : (recentRatePct !== null && recentRatePct >= WARN_RATE_PCT) ||
          recentVolumeRatio >= VOLUME_RATIO
        ? 'Degraded'
        : 'Healthy'
  const problem: Problem =
    status === 'Healthy' ? 'none' : recentVolumeRatio >= VOLUME_RATIO ? 'volume' : 'failures'

  let sinceMs: number | undefined
  if (status !== 'Healthy') {
    for (const c of cells.toReversed()) {
      if (!isElevated(c)) break
      sinceMs = c.hourMs
    }
  }
  const trailingStart = (hit: (c: Cell) => boolean): number | undefined => {
    let start: number | undefined
    for (const c of cells.toReversed()) {
      if (!hit(c)) break
      start = c.hourMs
    }
    return start
  }
  const failSinceMs = trailingStart((c) => (failureRatePct(c) ?? 0) >= FAIL_RATE_PCT)
  const spikeSinceMs = trailingStart((c) => (volumeRatio(c) ?? 0) >= VOLUME_RATIO)
  const problemSinceMs =
    problem === 'volume'
      ? spikeSinceMs
      : problem === 'failures'
        ? (failSinceMs ?? sinceMs)
        : undefined
  const before = cells.filter((c) => problemSinceMs === undefined || c.hourMs < problemSinceMs)
  const baselineRatePct = failureRatePct({
    attempts: before.reduce((sum, c) => sum + c.attempts, 0),
    failures: before.reduce((sum, c) => sum + c.failures, 0),
  })
  return {
    name: spec.name,
    url: spec.url,
    status,
    problem,
    recentRatePct,
    recentAttempts,
    recentVolumeRatio,
    typicalAttempts: typical,
    sinceMs,
    failSinceMs,
    spikeSinceMs,
    problemSinceMs,
    baselineRatePct,
  }
}

const SEVERITY: Record<Status, number> = { Failing: 0, Degraded: 1, Healthy: 2 }

/** Most urgent first: the heatmaps and the table share this row order. */
export const ENDPOINTS: readonly EndpointRow[] = SPECS.map(summarize).toSorted(
  (a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name),
)

export const ENDPOINT_ORDER: readonly string[] = ENDPOINTS.map((e) => e.name)

/** Hour bucket keys, oldest first. */
export const HOUR_KEYS: readonly string[] = Array.from({ length: WINDOW_HOURS }, (_, i) =>
  String(WINDOW_START + i * HOUR_MS),
)

const pad = (n: number): string => String(n).padStart(2, '0')

/** `15:00`, UTC: a fixed clock, never the machine's zone. */
export const fmtClock = (ms: number): string => `${pad(new Date(ms).getUTCHours())}:00`

/** `Thu 12 Nov, 09:00` for a tooltip header. */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
export const fmtStamp = (ms: number): string => {
  const d = new Date(ms)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${fmtClock(ms)} UTC`
}

/** `6 h` style span from an instant to the reading time. */
export const fmtSpan = (sinceMs: number): string => `${Math.round((NOW_MS - sinceMs) / HOUR_MS)} h`

export const FAILING_COUNT = ENDPOINTS.filter((e) => e.status === 'Failing').length
export const DEGRADED_COUNT = ENDPOINTS.filter((e) => e.status === 'Degraded').length
