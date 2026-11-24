/** What the page reads off one router week: the hours, the kinds, the first-try models and the latency. */
import {
  FIRST_TRY,
  HOUR_MS,
  KINDS,
  KIND_NAMES,
  MODELS,
  MODEL_NAMES,
  WEEK_HOURS,
} from './router-week'
import type { Kind, Model, RouterWeek } from './router-week'

/** The models some kind is tried on first, in the order of `MODELS`: the series of the fallback chart. */
export const FIRST_MODELS: readonly Model[] = MODELS.filter((model) =>
  KINDS.some((kind) => FIRST_TRY[kind] === model),
)

export type Hour = {
  at: Date
  requests: number
  fallbacks: number
  /** Fallbacks by the model tried first. */
  from: Record<Model, number>
}

export type KindRow = {
  kind: Kind
  requests: number
  /** Requests by the model that served them, keyed by model. */
  parts: Readonly<Record<string, number>>
  top: Model
  topShare: number
}

export type ModelRow = {
  model: Model
  name: string
  /** The kinds this model is tried on first. */
  leads: string
  requests: number
  fellBack: number
  /** Percent of the requests tried on it. */
  rate: number
}

export type Summary = {
  requests: number
  fallbacks: number
  /** Fraction of requests that fell back. */
  rate: number
  /** The rate over the hours with every model available; null when no such hour. */
  rateElsewhere: number | null
  hours: readonly Hour[]
  /** The hour with the highest fallback rate: the mark the chart labels. */
  worst: Hour | null
  /** What a fallback adds to the median latency; null without a fallback. */
  addedMs: number | null
  /** The slowest request that fell back; null without a fallback. */
  slowestMs: number | null
  /** The median requests in an hour that had any: what one request weighs in a bar. */
  typicalHour: number
  kinds: readonly KindRow[]
  models: readonly ModelRow[]
  /** The model that was unavailable, if any. */
  down: Model | undefined
  /** Hours the model was unavailable. */
  downHours: number
  downFrom: Date | undefined
  downTo: Date | undefined
}

const zeroByModel = (): Record<Model, number> => ({
  atlasLarge: 0,
  atlasFast: 0,
  novaCode: 0,
  lumenEmbed: 0,
  lumenLite: 0,
})

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2
}

export function summarize(week: RouterWeek): Summary {
  const hours: Hour[] = Array.from({ length: WEEK_HOURS }, (_, h) => ({
    at: new Date(week.start + h * HOUR_MS),
    requests: 0,
    fallbacks: 0,
    from: zeroByModel(),
  }))
  const byKind = new Map<Kind, Record<Model, number>>(KINDS.map((kind) => [kind, zeroByModel()]))
  const firstTryMs: number[] = []
  const fellBackMs: number[] = []

  for (const r of week.requests) {
    const hour = hours[Math.floor((r.at - week.start) / HOUR_MS)]
    if (hour !== undefined) {
      hour.requests += 1
      if (r.triedFirst !== null) {
        hour.fallbacks += 1
        hour.from[r.triedFirst] += 1
      }
    }
    const served = byKind.get(r.kind)
    if (served !== undefined) served[r.served] += 1
    if (r.triedFirst === null) {
      firstTryMs.push(r.latencyMs)
      continue
    }
    fellBackMs.push(r.latencyMs)
  }

  const requests = week.requests.length
  const fallbacks = fellBackMs.length
  const outage = week.outages[0]
  const unavailable = (hour: Hour) =>
    week.outages.some((o) => o.from < hour.at.getTime() + HOUR_MS && o.to > hour.at.getTime())
  const elsewhere = hours.filter((hour) => !unavailable(hour))
  const elsewhereRequests = elsewhere.reduce((sum, hour) => sum + hour.requests, 0)
  const elsewhereFallbacks = elsewhere.reduce((sum, hour) => sum + hour.fallbacks, 0)

  const kinds: KindRow[] = KINDS.map((kind) => {
    const parts = byKind.get(kind) ?? zeroByModel()
    const total = MODELS.reduce((sum, model) => sum + parts[model], 0)
    const top = MODELS.reduce(
      (best, model) => (parts[model] > parts[best] ? model : best),
      FIRST_TRY[kind],
    )
    return { kind, requests: total, parts, top, topShare: total === 0 ? 0 : parts[top] / total }
  }).toSorted((a, b) => b.requests - a.requests)

  const models: ModelRow[] = FIRST_MODELS.map((model) => {
    const led = KINDS.filter((kind) => FIRST_TRY[kind] === model)
    const tried = kinds
      .filter((row) => led.includes(row.kind))
      .reduce((sum, row) => sum + row.requests, 0)
    const fellBack = hours.reduce((sum, hour) => sum + hour.from[model], 0)
    return {
      model,
      name: MODEL_NAMES[model],
      leads: led.map((kind) => KIND_NAMES[kind]).join(', '),
      requests: tried,
      fellBack,
      rate: tried === 0 ? 0 : (fellBack / tried) * 100,
    }
  })

  return {
    requests,
    fallbacks,
    rate: requests === 0 ? 0 : fallbacks / requests,
    rateElsewhere: elsewhereRequests === 0 ? null : elsewhereFallbacks / elsewhereRequests,
    hours,
    worst: hours.reduce<Hour | null>((best, hour) => {
      if (hour.fallbacks === 0) return best
      if (best === null) return hour
      return hour.fallbacks / hour.requests > best.fallbacks / best.requests ? hour : best
    }, null),
    addedMs: fallbacks === 0 ? null : (median(fellBackMs) ?? 0) - (median(firstTryMs) ?? 0),
    slowestMs: fallbacks === 0 ? null : Math.max(...fellBackMs),
    typicalHour:
      median(hours.filter((hour) => hour.requests > 0).map((hour) => hour.requests)) ?? 0,
    kinds,
    models,
    down: outage?.model,
    downHours: week.outages.reduce((sum, o) => sum + (o.to - o.from) / HOUR_MS, 0),
    downFrom: outage === undefined ? undefined : new Date(outage.from),
    downTo: outage === undefined ? undefined : new Date(outage.to),
  }
}
