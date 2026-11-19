/** Four pings-per-minute probes along a household's line path, plus what the page reads from them. */

export const HOPS = ['router', 'gateway', 'resolver', 'far'] as const
export type HopKey = (typeof HOPS)[number]

export const HOP_LABEL: Record<HopKey, string> = {
  router: 'Router',
  gateway: 'Provider gateway',
  resolver: 'Public resolver',
  far: 'Far server',
}

/** The short names a zone or a readout uses. */
export const HOP_SHORT: Record<HopKey, string> = {
  router: 'Router',
  gateway: 'Gateway',
  resolver: 'Resolver',
  far: 'Far server',
}

export type Segment = 'home' | 'provider' | 'far-end'

const SEGMENT_OF: Record<HopKey, Segment> = {
  router: 'home',
  gateway: 'provider',
  resolver: 'far-end',
  far: 'far-end',
}

export const PINGS_PER_MINUTE = 5

export type Probe = {
  sent: number
  received: number
  medianMs: number | null
  maxMs: number | null
  jitterMs: number | null
}

export type Minute = { at: Date } & Record<HopKey, Probe>

type Outage = { hop: HopKey; startMinute: number; minutes: number }

type Config = {
  outages: readonly Outage[]
  /** Minutes the router's median is stretched to a congested wireless link. */
  congestion: { from: number; to: number; medianMs: number } | null
  /** One slow reply on the far server, an extreme the table's max must show true. */
  slowReply: { minute: number; ms: number } | null
}

const at = (h: number, m: number): number => h * 60 + m

const FIXTURES: Record<string, Config> = {
  default: {
    outages: [
      { hop: 'gateway', startMinute: at(2, 14), minutes: 4 },
      { hop: 'far', startMinute: at(13, 5), minutes: 3 },
      { hop: 'gateway', startMinute: at(19, 41), minutes: 6 },
    ],
    congestion: null,
    slowReply: { minute: at(21, 7), ms: 1840 },
  },
  /** No minute lost every packet: the zero case. */
  clean: { outages: [], congestion: null, slowReply: null },
  /** The router itself drops, and its wireless link crawls for 45 minutes: the extreme case. */
  home: {
    outages: [
      { hop: 'router', startMinute: at(7, 30), minutes: 9 },
      { hop: 'router', startMinute: at(20, 10), minutes: 5 },
    ],
    congestion: { from: at(20, 0), to: at(20, 45), medianMs: 420 },
    slowReply: { minute: at(20, 22), ms: 3150 },
  },
}

const BASE_MEDIAN: Record<HopKey, number> = { router: 1.1, gateway: 7.5, resolver: 14, far: 41 }
const BASE_JITTER: Record<HopKey, number> = { router: 0.3, gateway: 1.4, resolver: 2.5, far: 4.5 }
/** Chance a minute drops one ping with no outage. */
const STRAY_LOSS: Record<HopKey, number> = { router: 0, gateway: 0.004, resolver: 0.008, far: 0.02 }

const DAY_START = Date.UTC(2026, 10, 16)
const MINUTES = 24 * 60

/** Mulberry32: a small seeded generator, so every load draws the same day. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number): number => Math.round(n * 10) / 10

export function buildDay(fixture: string | undefined): readonly Minute[] {
  const config = (fixture === undefined ? undefined : FIXTURES[fixture]) ?? FIXTURES['default']
  if (config === undefined) return []
  const rand = seeded(26)
  const lostOnOutage = (hop: HopKey, minute: number): boolean =>
    config.outages.some((o) => {
      if (minute < o.startMinute || minute >= o.startMinute + o.minutes) return false
      // An outage at a hop takes every hop behind it too.
      return HOPS.indexOf(hop) >= HOPS.indexOf(o.hop)
    })

  return Array.from({ length: MINUTES }, (_, minute): Minute => {
    const hour = minute / 60
    const evening = hour >= 19 && hour < 23 ? 1 : 0
    const probe = (hop: HopKey): Probe => {
      const jitter = BASE_JITTER[hop] * (1 + 0.5 * evening) * (0.7 + 0.6 * rand())
      const roll = rand()
      const spike = rand() < 0.012 ? 2 + 4 * rand() : 1
      if (lostOnOutage(hop, minute)) {
        return {
          sent: PINGS_PER_MINUTE,
          received: 0,
          medianMs: null,
          maxMs: null,
          jitterMs: null,
        }
      }
      const strayed = roll < STRAY_LOSS[hop]
      const received = strayed ? PINGS_PER_MINUTE - 1 : PINGS_PER_MINUTE
      const congested =
        hop === 'router' &&
        config.congestion !== null &&
        minute >= config.congestion.from &&
        minute < config.congestion.to
      const lift = hop === 'gateway' || hop === 'far' ? 1 + 0.25 * evening : 1
      const median = congested
        ? (config.congestion?.medianMs ?? 0) * (0.6 + 0.8 * rand())
        : BASE_MEDIAN[hop] * lift * (0.97 + 0.06 * rand())
      let max = median + jitter * (2 + 3 * rand()) * spike
      if (hop === 'far' && config.slowReply?.minute === minute) max = config.slowReply.ms
      return {
        sent: PINGS_PER_MINUTE,
        received,
        medianMs: round(median),
        maxMs: round(max),
        jitterMs: round(jitter),
      }
    }
    return {
      at: new Date(DAY_START + minute * 60_000),
      router: probe('router'),
      gateway: probe('gateway'),
      resolver: probe('resolver'),
      far: probe('far'),
    }
  })
}

export type HopStats = {
  key: HopKey
  sent: number
  received: number
  lost: number
  medianMs: number | null
  maxMs: number | null
  jitterMs: number | null
  /** Longest run of minutes in which this hop answered nothing. */
  longestGap: number
  /** Minutes this hop answered nothing while every hop before it answered. */
  ownGapMinutes: number
}

export type Gap = { start: Date; end: Date; minutes: number; firstHop: HopKey }

export type Analysis = {
  hops: readonly HopStats[]
  gaps: readonly Gap[]
  /** The segment where total loss starts; null when no minute lost every packet. */
  segment: Segment | null
  culprit: HopKey | null
  culpritMinutes: number
  longestGap: Gap | null
}

const lostAll = (p: Probe): boolean => p.received === 0

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid]
  const lo = sorted[mid - 1]
  if (hi === undefined) return null
  return sorted.length % 2 === 1 || lo === undefined ? hi : round((lo + hi) / 2)
}

const nums = (values: readonly (number | null)[]): number[] =>
  values.filter((v): v is number => v !== null)

export function analyse(rows: readonly Minute[]): Analysis {
  const hops = HOPS.map((key): HopStats => {
    const probes = rows.map((m) => m[key])
    let longestGap = 0
    let run = 0
    for (const p of probes) {
      run = lostAll(p) ? run + 1 : 0
      longestGap = Math.max(longestGap, run)
    }
    const upstream = HOPS.slice(0, HOPS.indexOf(key))
    const ownGapMinutes = rows.filter(
      (m) => lostAll(m[key]) && upstream.every((u) => !lostAll(m[u])),
    ).length
    const sent = probes.reduce((s, p) => s + p.sent, 0)
    const received = probes.reduce((s, p) => s + p.received, 0)
    const jitters = nums(probes.map((p) => p.jitterMs))
    const maxes = nums(probes.map((p) => p.maxMs))
    return {
      key,
      sent,
      received,
      lost: sent - received,
      // The median of the per-minute medians: a minute's pings are not kept.
      medianMs: median(nums(probes.map((p) => p.medianMs))),
      maxMs: maxes.length === 0 ? null : Math.max(...maxes),
      jitterMs:
        jitters.length === 0 ? null : round(jitters.reduce((s, j) => s + j, 0) / jitters.length),
      longestGap,
      ownGapMinutes,
    }
  })

  const gaps: Gap[] = []
  let open: { from: number; firstHop: HopKey } | null = null
  const close = (to: number): void => {
    if (open === null) return
    const start = rows[open.from]
    const last = rows[to - 1]
    if (start !== undefined && last !== undefined) {
      gaps.push({
        start: start.at,
        end: new Date(last.at.getTime() + 60_000),
        minutes: to - open.from,
        firstHop: open.firstHop,
      })
    }
    open = null
  }
  rows.forEach((m, i) => {
    const first = HOPS.find((h) => lostAll(m[h]))
    if (first === undefined) return close(i)
    if (open === null) open = { from: i, firstHop: first }
    else if (HOPS.indexOf(first) < HOPS.indexOf(open.firstHop)) open.firstHop = first
  })
  close(rows.length)

  const culpritStats = hops.reduce<HopStats | null>(
    (best, h) => (h.ownGapMinutes > (best?.ownGapMinutes ?? 0) ? h : best),
    null,
  )
  const longestGap = gaps.reduce<Gap | null>(
    (best, g) => (g.minutes > (best?.minutes ?? 0) ? g : best),
    null,
  )
  return {
    hops,
    gaps,
    segment: culpritStats === null ? null : SEGMENT_OF[culpritStats.key],
    culprit: culpritStats?.key ?? null,
    culpritMinutes: culpritStats?.ownGapMinutes ?? 0,
    longestGap,
  }
}

export const ANSWER: Record<Segment | 'none', string> = {
  home: 'Breaks at home',
  provider: 'Breaks at the provider',
  'far-end': 'Breaks at the far end',
  none: 'No break on the path',
}

/** Total-loss minutes the day before, per fixture: the baseline the answer's delta reads against. */
const PREVIOUS_LOST: Record<string, number> = { default: 2, clean: 0, home: 4 }
export const previousLost = (fixture: string | undefined): number =>
  (fixture === undefined ? undefined : PREVIOUS_LOST[fixture]) ?? PREVIOUS_LOST['default'] ?? 0

export type EveningRise = { hop: HopKey; ms: number }

/** Each hop's median round trip from 19:00 to 23:00 less the rest of the day, largest first. */
export function eveningRises(rows: readonly Minute[]): readonly EveningRise[] {
  const evening = (m: Minute): boolean => m.at.getUTCHours() >= 19 && m.at.getUTCHours() < 23
  return HOPS.map((hop) => {
    const pick = (inEvening: boolean): number | null =>
      median(nums(rows.filter((m) => evening(m) === inEvening).map((m) => m[hop].medianMs)))
    const a = pick(true)
    const b = pick(false)
    return { hop, ms: a === null || b === null ? 0 : round(a - b) }
  }).sort((x, y) => y.ms - x.ms)
}
