/**
 * The model router's week (scenario expr-n41): about 4,000 requests over seven days, each with its
 * kind, the model that served it, the model tried first when it fell back, and its latency. Seeded
 * and deterministic. `week` has one model unavailable for three hours; `calm` has no fallback at
 * all; `down` has the model unavailable for the whole week.
 */

export const MODELS = ['atlasLarge', 'atlasFast', 'novaCode', 'lumenEmbed', 'lumenLite'] as const
export type Model = (typeof MODELS)[number]

export const MODEL_NAMES: Readonly<Record<Model, string>> = {
  atlasLarge: 'Atlas Large',
  atlasFast: 'Atlas Fast',
  novaCode: 'Nova Code',
  lumenEmbed: 'Lumen Embed',
  lumenLite: 'Lumen Lite',
}

export const KINDS = ['chat', 'code', 'embedding', 'summary'] as const
export type Kind = (typeof KINDS)[number]

export const KIND_NAMES: Readonly<Record<Kind, string>> = {
  chat: 'Chat',
  code: 'Code',
  embedding: 'Embedding',
  summary: 'Summary',
}

/** The model each kind is tried on first. */
export const FIRST_TRY: Readonly<Record<Kind, Model>> = {
  chat: 'atlasLarge',
  code: 'novaCode',
  embedding: 'lumenEmbed',
  summary: 'atlasFast',
}

/** The model a kind falls back to, and the one it falls back to while `atlasLarge` is unavailable. */
const SECOND: Readonly<Record<Kind, Model>> = {
  chat: 'atlasFast',
  code: 'atlasLarge',
  embedding: 'lumenLite',
  summary: 'atlasLarge',
}
const SECOND_WHILE_DOWN: Readonly<Record<Kind, Model>> = {
  chat: 'atlasFast',
  code: 'atlasFast',
  embedding: 'lumenLite',
  summary: 'novaCode',
}

export type RouterRequest = {
  /** Epoch ms. */
  at: number
  kind: Kind
  served: Model
  /** The model tried first when the request fell back, else null. */
  triedFirst: Model | null
  latencyMs: number
}

export type Outage = { model: Model; from: number; to: number }

export type RouterWeek = {
  start: number
  end: number
  requests: readonly RouterRequest[]
  outages: readonly Outage[]
}

export const HOUR_MS = 3_600_000
export const WEEK_HOURS = 168
/** Monday 9 November 2026, 00:00 UTC. */
const WEEK_START = Date.UTC(2026, 10, 9)
const WEEK_END = WEEK_START + WEEK_HOURS * HOUR_MS

const TOTAL = 4_000
const KIND_SHARE: Readonly<Record<Kind, number>> = {
  chat: 0.45,
  code: 0.22,
  embedding: 0.2,
  summary: 0.13,
}
/** The chance a request falls back with every model healthy: a timeout on the first try. */
const TIMEOUT_CHANCE: Readonly<Record<Kind, number>> = {
  chat: 0.016,
  code: 0.034,
  embedding: 0.004,
  summary: 0.012,
}
const MEDIAN_MS: Readonly<Record<Model, number>> = {
  atlasLarge: 920,
  atlasFast: 380,
  novaCode: 640,
  lumenEmbed: 55,
  lumenLite: 90,
}
/** A request that timed out twice: the one extreme latency of the week. */
const DOUBLE_TIMEOUT_MS = 29_810

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Requests in an hour: Knuth's method, fine for a mean under 60. */
function poisson(rng: () => number, mean: number): number {
  const limit = Math.exp(-mean)
  let count = 0
  let product = rng()
  while (product > limit) {
    count += 1
    product *= rng()
  }
  return count
}

const normal = (rng: () => number): number =>
  Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())

/** Traffic by hour of the week: a working-day bump from 06:00 to 22:00, quieter at the weekend. */
function hourWeight(hour: number): number {
  const hourOfDay = hour % 24
  const bump = Math.max(0, Math.sin(((hourOfDay - 6) / 16) * Math.PI))
  const weekend = Math.floor(hour / 24) >= 5 ? 0.55 : 1
  return (0.25 + 0.75 * bump) * weekend
}

function kindOf(rng: () => number): Kind {
  const draw = rng()
  let edge = 0
  for (const kind of KINDS) {
    edge += KIND_SHARE[kind]
    if (draw < edge) return kind
  }
  return 'summary'
}

type Variant = 'week' | 'calm' | 'down'

function outagesOf(variant: Variant): readonly Outage[] {
  if (variant === 'calm') return []
  if (variant === 'down') return [{ model: 'atlasLarge', from: WEEK_START, to: WEEK_END }]
  const from = WEEK_START + (2 * 24 + 14) * HOUR_MS
  return [{ model: 'atlasLarge', from, to: from + 3 * HOUR_MS }]
}

function build(variant: Variant): RouterWeek {
  const rng = seeded(41)
  const outages = outagesOf(variant)
  const weights = Array.from({ length: WEEK_HOURS }, (_, hour) => hourWeight(hour))
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  const requests: RouterRequest[] = []
  let doubleTimeoutSpent = false

  for (const [hour, weight] of weights.entries()) {
    const count = poisson(rng, (TOTAL * weight) / weightSum)
    for (let i = 0; i < count; i += 1) {
      const at = WEEK_START + hour * HOUR_MS + Math.floor(rng() * HOUR_MS)
      const kind = kindOf(rng)
      const first = FIRST_TRY[kind]
      const refused = outages.some((o) => o.model === first && at >= o.from && at < o.to)
      const timedOut = variant !== 'calm' && rng() < TIMEOUT_CHANCE[kind]
      const latency = (model: Model) => MEDIAN_MS[model] * Math.exp(0.35 * normal(rng))
      if (!refused && !timedOut) {
        requests.push({
          at,
          kind,
          served: first,
          triedFirst: null,
          latencyMs: Math.round(latency(first)),
        })
        continue
      }
      const secondDown = outages.some((o) => o.model === SECOND[kind] && at >= o.from && at < o.to)
      const served = secondDown ? SECOND_WHILE_DOWN[kind] : SECOND[kind]
      const wasted = refused ? 80 + rng() * 160 : 1_000 + rng() * 900
      const doubleTimeout = !refused && !doubleTimeoutSpent && kind === 'code'
      if (doubleTimeout) doubleTimeoutSpent = true
      requests.push({
        at,
        kind,
        served,
        triedFirst: first,
        latencyMs: doubleTimeout ? DOUBLE_TIMEOUT_MS : Math.round(wasted + latency(served)),
      })
    }
  }
  return {
    start: WEEK_START,
    end: WEEK_END,
    requests: requests.toSorted((a, b) => a.at - b.at),
    outages,
  }
}

const WEEKS: Readonly<Record<Variant, RouterWeek>> = {
  week: build('week'),
  calm: build('calm'),
  down: build('down'),
}

/** The week a `?fixture=` name picks: `calm`, `down`, else the week at rest. */
export function weekNamed(name: string | undefined): RouterWeek {
  if (name === 'calm') return WEEKS.calm
  if (name === 'down') return WEEKS.down
  return WEEKS.week
}

/** A week in which nothing reached the router. */
export const QUIET_WEEK: RouterWeek = { ...WEEKS.week, requests: [], outages: [] }
