/**
 * The fleet's stand-in server: one team, six services, 90 days of deploys, seeded and deterministic
 * (a fixed clock and a fixed seed, so every run and every shot sees the same fleet). It answers like
 * a network: every call waits, the services list waits 700 ms the first time and 60 ms after, a
 * call armed with `failNext` rejects once, an unknown service id is a 404.
 */

export type Outcome = 'succeeded' | 'failed' | 'rolled-back'

export type Deploy = {
  id: string
  serviceId: string
  serviceName: string
  version: string
  author: string
  startedAt: number
  durationS: number
  outcome: Outcome
}

export type ServiceSummary = {
  id: string
  name: string
  owner: string
  deploys: number
  failures: number
  lastOutcome: Outcome
}

export type Day = { day: number; succeeded: number; failed: number; rolledBack: number }

export type Totals = { deploys: number; failed: number; rolledBack: number; medianS: number }

export type Overview = {
  days: readonly Day[]
  now: Totals
  prior: Totals
  services: number
  failing: number
}

export type Settings = {
  name: string
  slug: string
  zone: string
  autoDeploy: boolean
  rollout: 'rolling' | 'canary' | 'blue-green'
  parallel: number
  events: readonly string[]
  email: string
}

/** A dial the URL turns, so one state is reachable without a click: an empty fleet, or a server that is down. */
export type Dial = 'empty' | 'error' | undefined

export class ServerError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const DAY_MS = 86_400_000

/** The fixed clock of the fixture: 90 days end here. */
export const NOW = Date.UTC(2026, 10, 19, 12, 0)

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AUTHORS = ['Ada Okafor', 'Lin Wei', 'Marta Silva', 'Jonas Berg', 'Priya Nair'] as const

const SERVICES = [
  { id: 'checkout', name: 'Checkout', owner: 'Ada Okafor', perDay: 0.9, baseS: 240 },
  { id: 'search', name: 'Search', owner: 'Lin Wei', perDay: 0.7, baseS: 190 },
  { id: 'billing', name: 'Billing', owner: 'Marta Silva', perDay: 0.45, baseS: 330 },
  { id: 'auth', name: 'Auth', owner: 'Jonas Berg', perDay: 0.35, baseS: 150 },
  { id: 'notifications', name: 'Notifications', owner: 'Priya Nair', perDay: 0.55, baseS: 120 },
  { id: 'ledger', name: 'Ledger', owner: 'Marta Silva', perDay: 0.25, baseS: 420 },
] as const

function buildDeploys(): readonly Deploy[] {
  const rng = seeded(20261119)
  const all: Deploy[] = []
  for (const [serviceIndex, service] of SERVICES.entries()) {
    const made: Deploy[] = []
    for (let back = 89; back >= 0; back--) {
      const dayStart = NOW - back * DAY_MS
      const weekday = new Date(dayStart).getUTCDay()
      const weekend = weekday === 0 || weekday === 6
      const expected = service.perDay * (weekend ? 0.2 : 1.25)
      const count = Math.floor(expected) + (rng() < expected % 1 ? 1 : 0)
      for (let i = 0; i < count; i++) {
        const roll = rng()
        const outcome: Outcome = roll < 0.07 ? 'failed' : roll < 0.11 ? 'rolled-back' : 'succeeded'
        const hour = 7 + Math.floor(rng() * 10)
        const minute = Math.floor(rng() * 60)
        const day = new Date(dayStart)
        const startedAt = Date.UTC(
          day.getUTCFullYear(),
          day.getUTCMonth(),
          day.getUTCDate(),
          hour,
          minute,
        )
        if (startedAt > NOW) continue
        made.push({
          id: '',
          serviceId: service.id,
          serviceName: service.name,
          version: '',
          author: AUTHORS[Math.floor(rng() * AUTHORS.length)] ?? AUTHORS[0],
          startedAt,
          durationS: Math.round(
            service.baseS * (0.7 + rng() * 0.9) * (outcome === 'failed' ? 0.6 : 1),
          ),
          outcome,
        })
      }
    }
    // Versions climb with time; the newest deploy of Billing failed, every other service's latest succeeded.
    made.sort((a, b) => a.startedAt - b.startedAt)
    for (const [i, deploy] of made.entries()) {
      deploy.id = `${service.id}-${i + 1}`
      deploy.version = `v${2 + serviceIndex}.${Math.floor(i / 12) + 4}.${i % 12}`
    }
    const latest = made.at(-1)
    if (latest !== undefined) latest.outcome = service.id === 'billing' ? 'failed' : 'succeeded'
    all.push(...made)
  }
  return all.sort((a, b) => b.startedAt - a.startedAt)
}

const DEPLOYS = buildDeploys()

const SETTINGS_SEED: Settings = {
  name: 'Platform team',
  slug: 'platform',
  zone: 'Europe/Berlin',
  autoDeploy: true,
  rollout: 'rolling',
  parallel: 2,
  events: ['deploy-failed', 'rolled-back'],
  email: 'platform-oncall@example.com',
}

let settings: Settings | null = SETTINGS_SEED
let servicesCalls = 0
let armed = false

const later = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Every call waits, then fails when the dial or an armed `failNext` says so. */
async function call(dial: Dial, ms = 120): Promise<void> {
  await later(ms)
  if (dial === 'error') throw new ServerError(503, 'The fleet server did not answer.')
  if (!armed) return
  armed = false
  throw new ServerError(503, 'The fleet server did not answer.')
}

function totals(deploys: readonly Deploy[]): Totals {
  const sorted = deploys.map((d) => d.durationS).sort((a, b) => a - b)
  return {
    deploys: deploys.length,
    failed: deploys.filter((d) => d.outcome === 'failed').length,
    rolledBack: deploys.filter((d) => d.outcome === 'rolled-back').length,
    medianS: sorted[Math.floor(sorted.length / 2)] ?? 0,
  }
}

function inWindow(from: number, to: number): readonly Deploy[] {
  return DEPLOYS.filter((d) => d.startedAt >= from && d.startedAt < to)
}

function summary(service: (typeof SERVICES)[number]): ServiceSummary {
  const own = DEPLOYS.filter((d) => d.serviceId === service.id)
  return {
    id: service.id,
    name: service.name,
    owner: service.owner,
    deploys: own.length,
    failures: own.filter((d) => d.outcome !== 'succeeded').length,
    lastOutcome: own[0]?.outcome ?? 'succeeded',
  }
}

export const server = {
  /** Arms the next call, whichever it is, to fail once. */
  failNext(): void {
    armed = true
  },

  async overview({ days, dial }: { days: number; dial: Dial }): Promise<Overview> {
    await call(dial)
    if (dial === 'empty') {
      return {
        days: [],
        now: { deploys: 0, failed: 0, rolledBack: 0, medianS: 0 },
        prior: { deploys: 0, failed: 0, rolledBack: 0, medianS: 0 },
        services: 0,
        failing: 0,
      }
    }
    const end = Math.floor(NOW / DAY_MS) * DAY_MS + DAY_MS
    const start = end - days * DAY_MS
    const buckets: Day[] = Array.from({ length: days }, (_, i) => {
      const from = start + i * DAY_MS
      const own = inWindow(from, from + DAY_MS)
      return {
        day: from,
        succeeded: own.filter((d) => d.outcome === 'succeeded').length,
        failed: own.filter((d) => d.outcome === 'failed').length,
        rolledBack: own.filter((d) => d.outcome === 'rolled-back').length,
      }
    })
    return {
      days: buckets,
      now: totals(inWindow(start, end)),
      prior: totals(inWindow(start - days * DAY_MS, start)),
      services: SERVICES.length,
      failing: SERVICES.filter((s) => summary(s).lastOutcome !== 'succeeded').length,
    }
  },

  /** The first call answers in about 700 ms, every later one in 60. */
  async services({ dial }: { dial: Dial }): Promise<readonly ServiceSummary[]> {
    servicesCalls += 1
    await call(dial, servicesCalls === 1 ? 700 : 60)
    return dial === 'empty' ? [] : SERVICES.map(summary)
  },

  /** Deploys, newest first: one service's, or the whole fleet's when no id is given. */
  async deploys({
    serviceId,
    dial,
  }: {
    serviceId: string
    dial: Dial
  }): Promise<readonly Deploy[]> {
    await call(dial, 80)
    if (dial === 'empty') return []
    if (serviceId === '') return DEPLOYS
    if (!SERVICES.some((s) => s.id === serviceId)) {
      throw new ServerError(404, `No service has the id "${serviceId}".`)
    }
    return DEPLOYS.filter((d) => d.serviceId === serviceId)
  },

  async settings({ dial }: { dial: Dial }): Promise<Settings | null> {
    await call(dial)
    return dial === 'empty' ? null : settings
  },

  async saveSettings(patch: Partial<Settings>): Promise<Settings> {
    await call(undefined, 400)
    settings = { ...(settings ?? SETTINGS_SEED), ...patch }
    return settings
  },

  /** The team's defaults, for a team that has no settings yet. */
  async createSettings(): Promise<Settings> {
    await call(undefined, 300)
    settings = SETTINGS_SEED
    return settings
  },
}
