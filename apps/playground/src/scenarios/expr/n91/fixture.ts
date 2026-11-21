/**
 * A seeded library at the end of one enrichment pass. `rest` is the stated shape (about 900 entries:
 * 612 enriched, 48 failed, 240 waiting, 31 on an older schema, 3 unpriced); `fresh` is a library
 * nothing has enriched yet; `outage` is a day the model host dropped most requests.
 */

export type Variant = 'rest' | 'fresh' | 'outage'
export type Kind = 'transport' | 'model' | 'waiting' | 'older' | 'orphaned' | 'unreadable'
export type BillCause = 'waiting' | 'retry' | 'schema'
export type ReasonKey = 'timeout' | 'rate' | 'reset' | 'json' | 'broke' | 'gone' | 'unparsable'
export type ReasonKind = 'transport' | 'model' | 'unreachable'

export type Entry = {
  id: string
  title: string
  kind: Kind
  reason: ReasonKey | null
  /** What the next sweep bills for this entry; `null` when it cannot be priced or cannot be reached. */
  bill: number | null
  /** The last attempt, epoch ms; `null` when the sweep never reached it. */
  at: number | null
}

export type Day = {
  at: Date
  spend: number
  /** Share of reads served from the cache; `null` on a day with no reads. */
  cache: number | null
  /** Entries enriched up to and including this day. */
  enriched: number
  /** Entries whose attempt failed on this day. */
  failed: number
}

export const REASONS: Readonly<Record<ReasonKey, { label: string; kind: ReasonKind }>> = {
  timeout: { label: 'Request timed out', kind: 'transport' },
  rate: { label: 'Rate limited', kind: 'transport' },
  reset: { label: 'Connection reset', kind: 'transport' },
  json: { label: 'Output was not valid JSON', kind: 'model' },
  broke: { label: 'Output failed validation', kind: 'model' },
  gone: { label: 'Source file is gone', kind: 'unreachable' },
  unparsable: { label: 'Source cannot be parsed', kind: 'unreachable' },
}

export type Library = {
  total: number
  enriched: number
  failed: number
  transport: number
  model: number
  /** Not yet enriched, unreachable entries included. */
  waiting: number
  older: number
  unpriced: number
  spent: number
  /** The mean bill of a priced entry; `null` before any entry is priced. */
  priceEach: number | null
  bills: Readonly<Record<BillCause, number>> | null
  billTotal: number | null
  weekAgo: { enriched: number; failed: number }
  spend7: number
  spendPrev7: number
  lagMin: number
  days: readonly Day[]
  entries: readonly Entry[]
  reasons: readonly { key: ReasonKey; count: number }[]
}

type Shape = {
  total: number
  enriched: number
  older: number
  unpriced: number
  transport: number
  model: number
  orphaned: number
  unreadable: number
  lagMin: number
  spike: boolean
}

const SHAPES: Readonly<Record<Variant, Shape>> = {
  rest: {
    total: 900,
    enriched: 612,
    older: 31,
    unpriced: 3,
    transport: 29,
    model: 19,
    orphaned: 4,
    unreadable: 2,
    lagMin: 11,
    spike: false,
  },
  outage: {
    total: 900,
    enriched: 540,
    older: 31,
    unpriced: 3,
    transport: 211,
    model: 21,
    orphaned: 4,
    unreadable: 2,
    lagMin: 38,
    spike: true,
  },
  fresh: {
    total: 120,
    enriched: 0,
    older: 0,
    unpriced: 0,
    transport: 0,
    model: 0,
    orphaned: 0,
    unreadable: 0,
    lagMin: 0,
    spike: false,
  },
}

export const DAY_MS = 86_400_000
export const DAYS = 30
export const NOW = Date.UTC(2026, 10, 21, 14, 30)
const FIRST_DAY = Date.UTC(2026, 9, 23)
/** Sunday 15 Nov: the sweep did not run and nothing read the cache. */
const IDLE_DAY = 23
const BASE_PRICE = 0.0212

export const variantOf = (fixture: string | undefined): Variant =>
  fixture === 'fresh' || fixture === 'outage' ? fixture : 'rest'

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Splits `total` over `weights` into whole parts that sum to it exactly (largest remainder). */
function split(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum === 0) return weights.map(() => 0)
  const raw = weights.map((w) => (w / sum) * total)
  const parts = raw.map(Math.floor)
  let left = total - parts.reduce((a, b) => a + b, 0)
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (left === 0) break
    parts[i] = (parts[i] ?? 0) + 1
    left -= 1
  }
  return parts
}

const dayOf = (index: number): Date => new Date(FIRST_DAY + index * DAY_MS)
const weekend = (index: number): boolean => [0, 6].includes(dayOf(index).getUTCDay())

const ADJECTIVES = [
  'Field',
  'Harbour',
  'Quiet',
  'Salt',
  'Early',
  'Winter',
  'Stone',
  'Open',
  'Paper',
  'Slow',
]
const NOUNS = [
  'notes',
  'ledger',
  'atlas',
  'letters',
  'survey',
  'diary',
  'index',
  'drafts',
  'maps',
  'records',
]
const SUBJECTS = [
  'tidal flats',
  'the north quay',
  'river gauges',
  'kiln work',
  'orchard rows',
  'ferry timetables',
  'lock repairs',
  'wool prices',
]

function titleOf(rand: () => number): string {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} on ${pick(SUBJECTS)}`
}

const REASON_SPLIT: Readonly<Record<'transport' | 'model', readonly ReasonKey[]>> = {
  transport: ['timeout', 'rate', 'reset'],
  model: ['json', 'broke'],
}
const REASON_WEIGHTS: Readonly<Record<'transport' | 'model', readonly number[]>> = {
  transport: [14, 9, 6],
  model: [11, 8],
}

const KIND_ORDER: readonly Kind[] = [
  'orphaned',
  'unreadable',
  'model',
  'transport',
  'older',
  'waiting',
]

export function buildLibrary(variant: Variant): Library {
  const s = SHAPES[variant]
  const rand = seeded(variant === 'rest' ? 9101 : variant === 'outage' ? 9102 : 9103)
  const failed = s.transport + s.model
  const waitingReachable = s.total - s.enriched - failed - s.orphaned - s.unreadable

  // One weight per day: a slow ramp, quieter weekends, and nothing on the idle day.
  const activity = Array.from({ length: DAYS }, (_, d) => {
    if (d === IDLE_DAY) return 0
    return (0.6 + d / DAYS) * (weekend(d) ? 0.45 : 1) * (0.85 + rand() * 0.3)
  })
  const active = s.enriched + failed > 0
  const enrichedPerDay = split(s.enriched, activity)
  const modelPerDay = split(s.model, activity)
  const transportWeights = s.spike ? activity.map((w, d) => (d === 28 ? w * 60 : w)) : activity
  const transportPerDay = split(s.transport, transportWeights)

  // Every enriched entry gets a day and a bill; the unpriced ones carry none.
  const enrichedDays = enrichedPerDay.flatMap((n, d) => Array.from({ length: n }, () => d))
  const costs = enrichedDays.map(() => Math.round(BASE_PRICE * (0.55 + rand()) * 10_000) / 10_000)
  const unpricedAt = new Set(
    [40, 233, 481].slice(0, s.unpriced).map((i) => i % Math.max(1, s.enriched)),
  )
  const priced = costs.filter((_, i) => !unpricedAt.has(i))
  const priceEach =
    priced.length === 0
      ? null
      : Math.round((priced.reduce((a, b) => a + b, 0) / priced.length) * 10_000) / 10_000

  const spendPerDay = Array.from({ length: DAYS }, () => 0)
  enrichedDays.forEach((d, i) => {
    if (unpricedAt.has(i)) return
    spendPerDay[d] = (spendPerDay[d] ?? 0) + (costs[i] ?? 0)
  })
  // A model-output failure was billed for its tokens; a transport failure never reached the model.
  modelPerDay.forEach((n, d) => {
    spendPerDay[d] = (spendPerDay[d] ?? 0) + n * BASE_PRICE * 0.6
  })

  let cumulative = 0
  const days: Day[] = Array.from({ length: DAYS }, (_, d) => {
    cumulative += enrichedPerDay[d] ?? 0
    const idle = d === IDLE_DAY || !active
    return {
      at: dayOf(d),
      spend: Math.round((spendPerDay[d] ?? 0) * 100) / 100,
      cache: idle ? null : Math.min(0.9, 0.52 + d * 0.011 + (rand() - 0.5) * 0.08),
      enriched: cumulative,
      failed: (modelPerDay[d] ?? 0) + (transportPerDay[d] ?? 0),
    }
  })

  // The entries that still need something: ids are shuffled so kinds mix through the library.
  const ids = Array.from({ length: s.total }, (_, i) => `lib-${String(i + 1).padStart(4, '0')}`)
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const a = ids[i] as string
    ids[i] = ids[j] as string
    ids[j] = a
  }
  const counts: Readonly<Record<Kind, number>> = {
    orphaned: s.orphaned,
    unreadable: s.unreadable,
    model: s.model,
    transport: s.transport,
    older: s.older,
    waiting: waitingReachable,
  }
  const reasonPool: Record<'transport' | 'model', ReasonKey[]> = { transport: [], model: [] }
  for (const kind of ['transport', 'model'] as const) {
    const parts = split(counts[kind], REASON_WEIGHTS[kind])
    REASON_SPLIT[kind].forEach((key, i) =>
      reasonPool[kind].push(...Array.from({ length: parts[i] ?? 0 }, () => key)),
    )
  }
  const failDays = {
    transport: transportPerDay.flatMap((n, d) => Array.from({ length: n }, () => d)),
    model: modelPerDay.flatMap((n, d) => Array.from({ length: n }, () => d)),
  }
  const olderDays = enrichedDays.filter((_, i) => !unpricedAt.has(i)).slice(0, s.older)

  let cursor = 0
  const entries: Entry[] = []
  for (const kind of KIND_ORDER) {
    for (let n = 0; n < counts[kind]; n += 1) {
      const id = ids[cursor] as string
      cursor += 1
      const day =
        kind === 'transport' || kind === 'model'
          ? (failDays[kind][n] ?? 0)
          : kind === 'older'
            ? (olderDays[n] ?? 0)
            : IDLE_DAY - 1
      const stamp = FIRST_DAY + day * DAY_MS + Math.floor(rand() * 20) * 3_600_000 + 3_600_000
      const reason: ReasonKey | null =
        kind === 'transport' || kind === 'model'
          ? (reasonPool[kind][n] ?? null)
          : kind === 'orphaned'
            ? 'gone'
            : kind === 'unreadable'
              ? 'unparsable'
              : null
      const reachable = kind !== 'orphaned' && kind !== 'unreadable'
      entries.push({
        id,
        title: titleOf(rand),
        kind,
        reason,
        bill: reachable && priceEach !== null ? priceEach : null,
        at: kind === 'waiting' ? null : stamp,
      })
    }
  }

  const reasons = (Object.keys(REASONS) as ReasonKey[])
    .map((key) => ({ key, count: entries.filter((e) => e.reason === key).length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)

  const round = (n: number): number => Math.round(n * 100) / 100
  const bills =
    priceEach === null
      ? null
      : {
          waiting: round(waitingReachable * priceEach),
          retry: round(failed * priceEach),
          schema: round(s.older * priceEach),
        }
  const spent = round(spendPerDay.reduce((a, b) => a + b, 0))
  const failedUpTo = (index: number): number =>
    days.slice(0, index + 1).reduce((a, d) => a + d.failed, 0)
  const sum = (from: number, to: number): number =>
    round(days.slice(from, to).reduce((a, d) => a + d.spend, 0))

  return {
    total: s.total,
    enriched: s.enriched,
    failed,
    transport: s.transport,
    model: s.model,
    waiting: s.total - s.enriched - failed,
    older: s.older,
    unpriced: s.unpriced,
    spent,
    priceEach,
    bills,
    billTotal: bills === null ? null : round(bills.waiting + bills.retry + bills.schema),
    weekAgo: {
      enriched: days[DAYS - 8]?.enriched ?? 0,
      failed: failedUpTo(DAYS - 8),
    },
    spend7: sum(DAYS - 7, DAYS),
    spendPrev7: sum(DAYS - 14, DAYS - 7),
    lagMin: s.lagMin,
    days,
    entries,
    reasons,
  }
}
