/** Seeded fixture for the catalogue fetch (scenario expr-n76): same name, same data, every run. */

export type ItemType = 'tutorial' | 'course' | 'lesson' | 'other'
export type ItemState = 'done' | 'fetching' | 'queued' | 'paused' | 'dead' | 'failed'
export type PauseReason = 'throttle' | 'breaker' | 'recycle'
export type Status = 'moving' | 'paused' | 'finished'

export type Hour = { at: Date; pages: number }
export type TypeRow = {
  type: ItemType
  total: number
  counts: Record<ItemState, number>
}
export type FailedItem = {
  id: string
  type: ItemType
  kind: 'failure' | 'dead'
  reason: string
}
export type Snapshot = {
  status: Status
  /** Why the fetch paused; null when it is moving, finished or stopped with no reason recorded. */
  reason: PauseReason | null
  /** Start of the zero run that ends the 24 hours; null while moving. */
  since: Date | null
  hours: readonly Hour[]
  /** When the fetch ends at the 24 hour median; null once finished. */
  eta: Date | null
  types: readonly TypeRow[]
  failed: readonly FailedItem[]
}

export const HOUR_MS = 3_600_000
/** The fixture's clock: the last bar is 13:00 to 14:00. */
const NOW = Date.UTC(2026, 10, 20, 14, 0)
const TYPES: readonly ItemType[] = ['tutorial', 'course', 'lesson', 'other']
const PAGES_PER_ITEM = 9
/** The spike fixture's one hour: far over a usual 300. */
const SPIKE_PAGES = 5200

type Config = {
  status: Status
  reason: PauseReason | null
  zeroRun: number
  spike?: boolean
  clean?: boolean
}

const CONFIGS: Record<string, Config> = {
  throttle: { status: 'paused', reason: 'throttle', zeroRun: 3 },
  breaker: { status: 'paused', reason: 'breaker', zeroRun: 6 },
  recycle: { status: 'paused', reason: 'recycle', zeroRun: 1 },
  'no-reason': { status: 'paused', reason: null, zeroRun: 4 },
  moving: { status: 'moving', reason: null, zeroRun: 0 },
  spike: { status: 'moving', reason: null, zeroRun: 0, spike: true },
  finished: { status: 'finished', reason: null, zeroRun: 5, clean: true },
}
const TOTAL: Record<ItemType, number> = { tutorial: 150, course: 164, lesson: 128, other: 56 }
const DONE: Record<ItemType, number> = { tutorial: 118, course: 121, lesson: 94, other: 42 }
const DEAD: Record<ItemType, number> = { tutorial: 3, course: 4, lesson: 4, other: 0 }
const FAILED: Record<ItemType, number> = { tutorial: 1, course: 1, lesson: 1, other: 0 }
const WORKING: Record<ItemType, number> = { tutorial: 2, course: 3, lesson: 2, other: 1 }

const FAILED_ITEMS: readonly FailedItem[] = [
  {
    id: '/tutorial/sql-windows',
    type: 'tutorial',
    kind: 'failure',
    reason: 'Timeout, 3 tries',
  },
  {
    id: '/course/rust-embedded',
    type: 'course',
    kind: 'failure',
    reason: 'HTTP 500, 3 tries',
  },
  {
    id: '/lesson/ci-caching-04',
    type: 'lesson',
    kind: 'failure',
    reason: 'No title found',
  },
  { id: '/tutorial/intro-to-cvs', type: 'tutorial', kind: 'dead', reason: 'HTTP 404' },
  { id: '/tutorial/flash-basics', type: 'tutorial', kind: 'dead', reason: 'HTTP 404' },
  { id: '/tutorial/jquery-ui', type: 'tutorial', kind: 'dead', reason: 'HTTP 410, gone' },
  { id: '/course/angularjs-1x', type: 'course', kind: 'dead', reason: 'HTTP 404' },
  { id: '/course/python-2-port', type: 'course', kind: 'dead', reason: 'HTTP 404' },
  {
    id: '/course/silverlight',
    type: 'course',
    kind: 'dead',
    reason: 'No DNS record',
  },
  { id: '/course/bower-flows', type: 'course', kind: 'dead', reason: 'HTTP 410, gone' },
  { id: '/lesson/grunt-watch-02', type: 'lesson', kind: 'dead', reason: 'HTTP 404' },
  { id: '/lesson/grunt-watch-03', type: 'lesson', kind: 'dead', reason: 'HTTP 404' },
  { id: '/lesson/coffeescript-07', type: 'lesson', kind: 'dead', reason: 'HTTP 404' },
  { id: '/lesson/flash-audio-01', type: 'lesson', kind: 'dead', reason: 'HTTP 404' },
]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hoursOf(config: Config): Hour[] {
  const rand = mulberry32(76)
  return Array.from({ length: 24 }, (_, i) => {
    const at = new Date(NOW - (24 - i) * HOUR_MS)
    const usual = Math.round(250 + 70 * Math.sin((i / 24) * 2 * Math.PI + 1) + rand() * 60)
    const fromEnd = 24 - i
    if (fromEnd <= config.zeroRun) return { at, pages: 0 }
    if (fromEnd === config.zeroRun + 1 && config.zeroRun > 0)
      return { at, pages: Math.round(usual * 0.4) }
    if (config.spike && i === 9) return { at, pages: SPIKE_PAGES }
    return { at, pages: usual }
  })
}

function typesOf(config: Config): TypeRow[] {
  return TYPES.map((type) => {
    const clean = config.clean === true
    const working = clean ? 0 : WORKING[type]
    const done = clean ? TOTAL[type] : DONE[type]
    const dead = clean ? 0 : DEAD[type]
    const failed = clean ? 0 : FAILED[type]
    const paused = config.status === 'paused' ? working : 0
    const fetching = config.status === 'moving' ? working : 0
    const queued = TOTAL[type] - done - dead - failed - working
    return { type, total: TOTAL[type], counts: { done, fetching, queued, paused, dead, failed } }
  })
}

/** The middle hour of the window: one spike or one pause does not move it. */
export function medianPages(hours: readonly Hour[]): number {
  const sorted = hours.map((h) => h.pages).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0)
}

const CACHE = new Map<string, Snapshot>()

/** The snapshot for a `?fixture=` name; an unknown or missing name is the rest state. */
export function snapshotOf(name: string | undefined): Snapshot {
  const key = name !== undefined && name in CONFIGS ? name : 'throttle'
  const cached = CACHE.get(key)
  if (cached !== undefined) return cached
  const config = CONFIGS[key] ?? CONFIGS['throttle']!
  const hours = hoursOf(config)
  const types = typesOf(config)
  const left = types.reduce((n, t) => n + t.counts.queued + t.counts.fetching + t.counts.paused, 0)
  const median = medianPages(hours)
  const hoursLeft = Math.ceil((left * PAGES_PER_ITEM) / median)
  const snapshot: Snapshot = {
    status: config.status,
    reason: config.reason,
    since: config.status === 'moving' ? null : (hours[24 - config.zeroRun]?.at ?? null),
    hours,
    eta: config.status === 'finished' ? null : new Date(NOW + hoursLeft * HOUR_MS),
    types,
    failed: config.clean === true ? [] : FAILED_ITEMS,
  }
  CACHE.set(key, snapshot)
  return snapshot
}
