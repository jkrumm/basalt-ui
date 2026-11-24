/**
 * The model router's last 14 days, seeded and deterministic: picks (a time, a caller, a target or a
 * refusal with its reason) and the cache-hit share per caller per day, the way the gateway log
 * would report them.
 */
import { createFormat } from 'basalt-ui'

export const CALLERS = [
  'factory-lead',
  'review-agent',
  'hermes',
  'oc',
  'brain-sync',
  'modelpick',
] as const
export type Caller = (typeof CALLERS)[number]

export type Target = 'iu' | 'me' | 'iu-api'
export type Reason = 'quota' | 'policy' | 'down'

/** One pick: served by a target, or refused with a reason (never both). */
export type Pick = {
  at: number
  caller: Caller
  target: Target | null
  reason: Reason | null
}

/** The picks of one day, counted. A day with no picks is the gateway being down. */
export type Day = {
  id: string
  label: string
  iu: number
  me: number
  iuApi: number
  quota: number
  policy: number
  down: number
  served: number
  refused: number
  total: number
  top: Target | null
}

/** The cache-hit share (percent) of one caller on one day; `null` when no pick was logged. */
export type CacheCell = {
  id: string
  caller: Caller
  day: string
  label: string
  share: number | null
}

export type Fixture = { picks: readonly Pick[]; days: readonly Day[]; cache: readonly CacheCell[] }

const DAY_MS = 86_400_000
const START = Date.UTC(2026, 10, 5)
/** The gateway was down for this whole day (an index into the fortnight). */
const DOWN_DAY = 7
/** The caller whose cache hits fell to zero, from this day on. */
const ZERO_CALLER: Caller = 'hermes'
const ZERO_FROM = 10

/** Weights per day: iu, me, iu-api, then the three refusal reasons. */
type Mix = readonly [number, number, number, number, number, number]
const PLAN: readonly { n: number; mix: Mix }[] = [
  { n: 62, mix: [66, 26, 4, 1, 3, 0] },
  { n: 58, mix: [67, 25, 4, 1, 3, 0] },
  { n: 66, mix: [65, 27, 4, 1, 3, 0] },
  { n: 61, mix: [66, 26, 4, 1, 3, 0] },
  { n: 70, mix: [64, 27, 5, 1, 3, 0] },
  { n: 44, mix: [68, 24, 4, 1, 3, 0] },
  { n: 40, mix: [69, 23, 4, 1, 3, 0] },
  { n: 0, mix: [0, 0, 0, 0, 0, 0] },
  { n: 92, mix: [60, 30, 4, 0, 3, 3] },
  { n: 72, mix: [52, 20, 6, 0, 3, 19] },
  { n: 66, mix: [58, 28, 5, 0, 3, 6] },
  { n: 70, mix: [32, 36, 8, 18, 6, 0] },
  { n: 74, mix: [22, 30, 24, 20, 4, 0] },
  { n: 68, mix: [24, 26, 34, 13, 3, 0] },
]
const OUTCOMES = ['iu', 'me', 'iu-api', 'quota', 'policy', 'down'] as const
const CALLER_WEIGHTS = [30, 22, 16, 14, 10, 8] as const
/** The usual cache-hit share of each caller, in percent. */
const CACHE_BASE = [74, 58, 82, 41, 91, 28] as const

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function weighted<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T {
  const sum = weights.reduce((a, b) => a + b, 0)
  let at = rng() * sum
  for (const [i, w] of weights.entries()) {
    at -= w
    const item = items[i]
    if (at < 0 && item !== undefined) return item
  }
  return items[items.length - 1] as T
}

const format = createFormat()
// cycle-expression-14: no day-and-month date style in the kit: 'short' prints the year, and only an explicit undefined year drops it
const NO_YEAR = { year: undefined } as Intl.DateTimeFormatOptions
const dayId = (i: number): string => new Date(START + i * DAY_MS).toISOString().slice(0, 10)
const dayLabel = (i: number): string => format.date(new Date(START + i * DAY_MS), 'short', NO_YEAR)

function planOf(name: string | undefined): readonly { n: number; mix: Mix }[] {
  if (name === 'calm')
    return PLAN.map((d) => ({ n: d.n, mix: [d.mix[0], d.mix[1], d.mix[2], 0, 0, 0] }))
  if (name === 'extreme') {
    // one day of a retry loop: nearly every pick refused for quota, from one caller
    return PLAN.map((d, i) => (i === 12 ? { n: 2400, mix: [6, 4, 2, 84, 4, 0] as const } : d))
  }
  return PLAN
}

export function fixtureOf(name: string | undefined): Fixture {
  const rng = seeded(64)
  const plan = planOf(name)
  const picks: Pick[] = []
  for (const [i, day] of plan.entries()) {
    const times = Array.from(
      { length: day.n },
      () => START + i * DAY_MS + Math.floor(rng() * DAY_MS),
    ).sort((a, b) => a - b)
    for (const at of times) {
      const outcome = weighted(rng, OUTCOMES, day.mix)
      const loop = name === 'extreme' && i === 12 && rng() < 0.9
      const caller = loop ? 'oc' : weighted(rng, CALLERS, CALLER_WEIGHTS)
      const served = outcome === 'iu' || outcome === 'me' || outcome === 'iu-api'
      picks.push({ at, caller, target: served ? outcome : null, reason: served ? null : outcome })
    }
  }

  const days: Day[] = plan.map((_, i) => {
    const of = picks.filter((p) => p.at >= START + i * DAY_MS && p.at < START + (i + 1) * DAY_MS)
    const count = (t: Target): number => of.filter((p) => p.target === t).length
    const why = (r: Reason): number => of.filter((p) => p.reason === r).length
    const iu = count('iu')
    const me = count('me')
    const iuApi = count('iu-api')
    const top =
      of.length === 0 ? null : iu >= me && iu >= iuApi ? 'iu' : me >= iuApi ? 'me' : 'iu-api'
    return {
      id: dayId(i),
      label: dayLabel(i),
      iu,
      me,
      iuApi,
      quota: why('quota'),
      policy: why('policy'),
      down: why('down'),
      served: iu + me + iuApi,
      refused: of.length - (iu + me + iuApi),
      total: of.length,
      top,
    }
  })

  const noise = seeded(7)
  const cache: CacheCell[] = CALLERS.flatMap((caller, c) =>
    days.map((day, i): CacheCell => {
      const wobble = Math.round((noise() - 0.5) * 12)
      const zero = caller === ZERO_CALLER && i >= ZERO_FROM
      const share =
        i === DOWN_DAY ? null : zero ? 0 : Math.max(1, Math.min(99, (CACHE_BASE[c] ?? 0) + wobble))
      return { id: `${caller}/${day.id}`, caller, day: day.id, label: day.label, share }
    }),
  )

  return { picks, days, cache }
}
