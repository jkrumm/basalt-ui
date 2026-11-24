/** API credit: three pools and thirty days of hourly spend, seeded so every build draws the same page. */

const HOUR = 3_600_000
export const DAY = 24 * HOUR
/** The page's "now": the hour starting here is not finished, so it holds no spend. */
export const NOW = Date.UTC(2026, 10, 19, 10)
const WEEK_HOURS = 168
const RECENT_HOURS = 72
const WINDOW_HOURS = 720

export type PoolId = 'team' | 'research' | 'batch'
export type SourceId = 'review' | 'code' | 'evals' | 'notebook' | 'docs' | 'export'
export type Variant = 'rest' | 'drained' | 'idle'

export type Pool = { id: PoolId; name: string; size: number; start: number; end: number }
export type Source = { id: SourceId; name: string; pool: PoolId }
export type SpendRow = { at: number; source: SourceId; machine: string; model: string; usd: number }

export const POOLS: readonly Pool[] = [
  {
    id: 'team',
    name: 'Team pool',
    size: 200,
    start: Date.UTC(2026, 10, 5),
    end: Date.UTC(2026, 11, 5),
  },
  {
    id: 'research',
    name: 'Research pool',
    size: 100,
    start: Date.UTC(2026, 10, 10),
    end: Date.UTC(2026, 11, 10),
  },
  {
    id: 'batch',
    name: 'Batch pool',
    size: 100,
    start: Date.UTC(2026, 10, 18, 22),
    end: Date.UTC(2026, 11, 18, 22),
  },
]

const SOURCES: readonly Source[] = [
  { id: 'review', name: 'Review bot', pool: 'team' },
  { id: 'code', name: 'Code agent', pool: 'team' },
  { id: 'evals', name: 'Nightly evals', pool: 'team' },
  { id: 'notebook', name: 'Notebook jobs', pool: 'research' },
  { id: 'docs', name: 'Docs search', pool: 'research' },
  { id: 'export', name: 'Batch export', pool: 'batch' },
]

type Shape = 'work' | 'night' | 'flat'
type Stream = {
  source: SourceId
  machine: string
  model: string
  /** Dollars an hour at the shape's weight 1. */
  rate: number
  shape: Shape
  /** The stream bills from this hour on. */
  since?: number
}

const STREAMS: readonly Stream[] = [
  { source: 'review', machine: 'ci-runner-2', model: 'atlas-large', rate: 0.14, shape: 'work' },
  { source: 'code', machine: 'dev-mini', model: 'atlas-large', rate: 0.1, shape: 'work' },
  { source: 'code', machine: 'dev-laptop', model: 'atlas-fast', rate: 0.04, shape: 'work' },
  { source: 'evals', machine: 'eval-box', model: 'atlas-fast', rate: 0.1, shape: 'night' },
  { source: 'notebook', machine: 'gpu-lab', model: 'atlas-large', rate: 0.07, shape: 'work' },
  { source: 'notebook', machine: 'gpu-lab', model: 'lumen-embed', rate: 0.03, shape: 'work' },
  { source: 'docs', machine: 'search-1', model: 'lumen-embed', rate: 0.045, shape: 'flat' },
  {
    source: 'export',
    machine: 'batch-1',
    model: 'atlas-fast',
    rate: 0.16,
    shape: 'flat',
    since: Date.UTC(2026, 10, 18, 22),
  },
]

/** The one source whose hourly spend doubled in the last three days. */
const RISER: SourceId = 'review'
const RISER_FACTOR = 2.2
/** An hourly extreme: a retry loop in one hour. */
const SPIKE = { source: 'code', at: NOW - 100 * HOUR, usd: 3.4 } as const

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weight(shape: Shape, at: number): number {
  if (shape === 'flat') return 1
  const hour = new Date(at).getUTCHours()
  if (shape === 'night') return hour < 6 ? 3.2 : hour < 8 ? 0.4 : 0
  if (hour >= 9 && hour < 18) return 1.6
  if (hour >= 18 && hour < 22) return 0.6
  return hour >= 6 && hour < 9 ? 0.5 : 0
}

const cents = (usd: number): number => Math.round(usd * 1000) / 1000

/** Every billed hour of the last 30 days, one row per hour, source, machine and model. */
export function spendRows(variant: Variant): SpendRow[] {
  const next = mulberry32(58)
  const rows: SpendRow[] = []
  const first = NOW - WINDOW_HOURS * HOUR
  for (let at = first; at < NOW; at += HOUR) {
    for (const s of STREAMS) {
      if (s.since !== undefined && at < s.since) continue
      const noise = 0.8 + next() * 0.4
      const boost = s.source === RISER && at >= NOW - RECENT_HOURS * HOUR ? RISER_FACTOR : 1
      const idle = variant === 'idle' && (s.source === 'notebook' || s.source === 'docs')
      let usd = idle ? 0 : s.rate * weight(s.shape, at) * noise * boost
      if (
        variant === 'rest' &&
        s.source === SPIKE.source &&
        s.machine === 'dev-laptop' &&
        at === SPIKE.at
      )
        usd = SPIKE.usd
      if (variant === 'drained' && s.source === 'review' && at === NOW - 30 * HOUR) usd = 120
      rows.push({ at, source: s.source, machine: s.machine, model: s.model, usd: cents(usd) })
    }
  }
  return variant === 'drained' ? capPool(rows, 'team') : rows
}

/** A pool that runs dry stops billing: the hour it empties keeps what was left, later hours drop. */
function capPool(rows: readonly SpendRow[], id: PoolId): SpendRow[] {
  const pool = POOLS.find((p) => p.id === id)
  if (pool === undefined) return [...rows]
  const members = new Set(SOURCES.filter((s) => s.pool === id).map((s) => s.id))
  let spent = 0
  let dry = false
  return rows.flatMap((row) => {
    if (!members.has(row.source) || row.at < pool.start) return [row]
    if (dry) return []
    if (spent + row.usd >= pool.size) {
      dry = true
      return [{ ...row, usd: cents(pool.size - spent) }]
    }
    spent += row.usd
    return [row]
  })
}

export type Verdict = 'out' | 'unspent' | 'early' | 'empty'

export type PoolView = {
  pool: Pool
  spent: number
  usedPct: number
  /** Hours the pool has billed since its cycle began. */
  dataHours: number
  /** Dollars an hour over the last 72 hours, or over all the data when it is younger. */
  rate: number
  /** Dollars an hour over the cycle before those hours; null when there is none. */
  earlierRate: number | null
  verdict: Verdict
  /** When the pool is, or is projected to be, empty. */
  emptyAt: number | null
  /** Dollars still in the pool at expiry; null when no projection is possible. */
  leftAtEnd: number | null
  /** The cycle day (fractional) of each cumulative point, as a share of the pool used. */
  daily: readonly { day: number; pct: number }[]
}

/** Fewer hours of data than this carry no projection. */
const MIN_PROJECT_HOURS = 24

export function poolViews(rows: readonly SpendRow[]): PoolView[] {
  return POOLS.map((pool) => {
    const members = new Set(SOURCES.filter((s) => s.pool === pool.id).map((s) => s.id))
    const mine = rows.filter((r) => members.has(r.source) && r.at >= pool.start)
    const spent = mine.reduce((sum, r) => sum + r.usd, 0)
    const dataHours = Math.round((NOW - pool.start) / HOUR)
    const window = Math.min(RECENT_HOURS, dataHours)
    const recent = mine
      .filter((r) => r.at >= NOW - window * HOUR)
      .reduce((sum, r) => sum + r.usd, 0)
    const rate = recent / window
    const remaining = (pool.end - NOW) / HOUR
    const daily: { day: number; pct: number }[] = [{ day: 0, pct: 0 }]
    let running = 0
    let boundary = 1
    for (const r of mine) {
      const end = (r.at + HOUR - pool.start) / DAY
      while (end > boundary + 1e-9) {
        daily.push({ day: boundary, pct: (running / pool.size) * 100 })
        boundary += 1
      }
      running += r.usd
    }
    const elapsed = (NOW - pool.start) / DAY
    daily.push({
      day: Math.round(elapsed * 100) / 100,
      pct: Math.min(100, (spent / pool.size) * 100),
    })
    const earlierHours = dataHours - window
    const earlierRate = earlierHours > 0 ? (spent - recent) / earlierHours : null
    const base = {
      pool,
      spent,
      usedPct: Math.min(100, (spent / pool.size) * 100),
      dataHours,
      rate,
      earlierRate,
      daily,
    }
    if (spent >= pool.size - 0.005) {
      const emptyAt = (mine.at(-1)?.at ?? NOW) + HOUR
      const emptied = { day: (emptyAt - pool.start) / DAY, pct: 100 }
      return {
        ...base,
        daily: [...daily.slice(0, -1), emptied, ...daily.slice(-1)],
        verdict: 'empty',
        emptyAt,
        leftAtEnd: 0,
      } as const
    }
    if (dataHours < MIN_PROJECT_HOURS)
      return { ...base, verdict: 'early', emptyAt: null, leftAtEnd: null } as const
    const projected = spent + rate * remaining
    if (projected >= pool.size)
      return {
        ...base,
        verdict: 'out',
        emptyAt: NOW + ((pool.size - spent) / rate) * HOUR,
        leftAtEnd: 0,
      } as const
    return { ...base, verdict: 'unspent', emptyAt: null, leftAtEnd: pool.size - projected } as const
  })
}

export type PoolKey = Exclude<PoolId, 'batch'> | `${Exclude<PoolId, 'batch'>}Proj`
export type PoolRow = { day: number } & Record<PoolKey, number | null>

/** One row per cycle day that holds a point; a pool without a point on that day is null there. */
export function poolRows(views: readonly PoolView[]): PoolRow[] {
  const byDay = new Map<number, PoolRow>()
  const put = (day: number, key: PoolKey, pct: number): void => {
    const x = Math.round(day * 100) / 100
    let row = byDay.get(x)
    if (row === undefined) {
      row = {
        day: x,
        team: null,
        research: null,
        teamProj: null,
        researchProj: null,
      }
      byDay.set(x, row)
    }
    row[key] = pct
  }
  for (const v of views) {
    // cycle-expression-13: a pool with under 24 hours of data is a two-point stub whose end label the kit places far from it, so it gets no line and no focus step
    if (v.verdict === 'early' || v.pool.id === 'batch') continue
    for (const p of v.daily) put(p.day, v.pool.id, p.pct)
    const now = v.daily.at(-1)
    if (now === undefined) continue
    const key: PoolKey = `${v.pool.id}Proj`
    if (v.verdict === 'out' && v.emptyAt !== null) {
      put(now.day, key, now.pct)
      put((v.emptyAt - v.pool.start) / DAY, key, 100)
    }
    if (v.verdict === 'unspent' && v.leftAtEnd !== null) {
      put(now.day, key, now.pct)
      put(30, key, ((v.pool.size - v.leftAtEnd) / v.pool.size) * 100)
    }
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day)
}

export type HourRow = { at: Date; review: number; others: number }

/** The past week by the hour: Review bot, and every other source summed. */
export function hourRows(rows: readonly SpendRow[]): HourRow[] {
  const from = NOW - WEEK_HOURS * HOUR
  const byHour = new Map<number, HourRow>()
  for (let at = from; at < NOW; at += HOUR)
    byHour.set(at, { at: new Date(at), review: 0, others: 0 })
  for (const r of rows) {
    const row = byHour.get(r.at)
    if (row === undefined) continue
    if (r.source === RISER) row.review += r.usd
    else row.others += r.usd
  }
  return [...byHour.values()]
}

export type SourceView = {
  source: Source
  poolName: string
  weekUsd: number
  /** Hourly spend of the last 3 days against the 4 days before, in percent; null under 24 hours of data. */
  changePct: number | null
  machine: string
  model: string
}

const top = (names: Map<string, number>): string => {
  const ranked = [...names.entries()].sort((a, b) => b[1] - a[1])
  return ranked[0]?.[0] ?? ''
}

export function sourceViews(rows: readonly SpendRow[]): SourceView[] {
  const weekFrom = NOW - WEEK_HOURS * HOUR
  const recentFrom = NOW - RECENT_HOURS * HOUR
  return SOURCES.map((source) => {
    const week = rows.filter((r) => r.source === source.id && r.at >= weekFrom)
    const sum = (list: readonly SpendRow[]): number => list.reduce((s, r) => s + r.usd, 0)
    const recent = week.filter((r) => r.at >= recentFrom)
    const before = week.filter((r) => r.at < recentFrom)
    const hours = new Set(week.map((r) => r.at)).size
    const recentRate = sum(recent) / Math.min(RECENT_HOURS, hours)
    const beforeRate =
      before.length === 0 ? 0 : sum(before) / (hours - Math.min(RECENT_HOURS, hours))
    const machines = new Map<string, number>()
    const models = new Map<string, number>()
    for (const r of week) {
      machines.set(r.machine, (machines.get(r.machine) ?? 0) + r.usd)
      models.set(r.model, (models.get(r.model) ?? 0) + r.usd)
    }
    const pool = POOLS.find((p) => p.id === source.pool)
    return {
      source,
      poolName: pool?.name ?? '',
      weekUsd: sum(week),
      changePct:
        hours < MIN_PROJECT_HOURS || beforeRate === 0 ? null : (recentRate / beforeRate - 1) * 100,
      machine: top(machines),
      model: top(models),
    }
  }).sort((a, b) => b.weekUsd - a.weekUsd)
}

/** The fixture names `?fixture=` knows; anything else draws the rest state. */
export function variantOf(fixture: string | undefined): Variant {
  if (fixture === 'drained' || fixture === 'idle') return fixture
  return 'rest'
}
