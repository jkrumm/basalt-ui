/**
 * Shell cycle 5 (docs/v3/cycles/shell-5.md), copied from cycle 4: the stand-in server for the fleet app. Fixture, not
 * glue: six services, ninety days of deploys each, generated from a fixed seed so every shot and
 * every run of the keyboard pass sees the same rows.
 *
 * `services()` answers in 700 ms the first time and 120 ms after (a warm HTTP cache), so the
 * router's pending screen shows on the first visit only. `breakNextLoad()` makes the next call
 * throw, which is how the overview's "Simulate outage" action reaches the route error screen.
 */

export const TEAMS = ['payments', 'platform', 'growth'] as const
export type Team = (typeof TEAMS)[number]
export const TEAM_LABELS: Record<Team, string> = {
  payments: 'Payments',
  platform: 'Platform',
  growth: 'Growth',
}

export type Health = 'healthy' | 'degraded' | 'down'
export type Outcome = 'success' | 'failed' | 'rolled-back'

export type Deploy = {
  id: string
  service: string
  version: string
  author: string
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  outcome: Outcome
  durationS: number
}

export type Service = {
  id: string
  name: string
  team: Team
  health: Health
  region: string
  owner: string
  deploys: readonly Deploy[]
}

const SPECS: readonly Omit<Service, 'deploys'>[] = [
  {
    id: 'checkout',
    name: 'Checkout',
    team: 'payments',
    health: 'healthy',
    region: 'eu-central',
    owner: 'Ada',
  },
  {
    id: 'billing',
    name: 'Billing',
    team: 'payments',
    health: 'degraded',
    region: 'eu-central',
    owner: 'Lin',
  },
  {
    id: 'ledger',
    name: 'Ledger',
    team: 'payments',
    health: 'healthy',
    region: 'us-east',
    owner: 'Ada',
  },
  {
    id: 'auth',
    name: 'Auth',
    team: 'platform',
    health: 'healthy',
    region: 'eu-west',
    owner: 'Kai',
  },
  {
    id: 'notify',
    name: 'Notify',
    team: 'platform',
    health: 'down',
    region: 'us-east',
    owner: 'Noor',
  },
  {
    id: 'search',
    name: 'Search',
    team: 'growth',
    health: 'healthy',
    region: 'eu-west',
    owner: 'Sam',
  },
]

const AUTHORS = ['Ada', 'Lin', 'Kai', 'Noor', 'Sam', 'Mo'] as const
const TODAY = Date.UTC(2026, 10, 14)
const DAY_MS = 86_400_000

/** A small deterministic PRNG (mulberry32), so the fixture is the same on every load. */
function prng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function isoDay(daysAgo: number): string {
  return new Date(TODAY - daysAgo * DAY_MS).toISOString().slice(0, 10)
}

function deploysOf(service: Omit<Service, 'deploys'>, index: number): Deploy[] {
  const random = prng(index + 7)
  const out: Deploy[] = []
  let minor = 0
  for (let ago = 89; ago >= 0; ago -= 1) {
    const count = Math.floor(random() * 3)
    for (let n = 0; n < count; n += 1) {
      minor += 1
      const roll = random()
      out.push({
        id: `${service.id}-${String(out.length + 1).padStart(3, '0')}`,
        service: service.id,
        version: `v${Math.floor(minor / 40) + 1}.${minor % 40}.0`,
        author: AUTHORS[Math.floor(random() * AUTHORS.length)] ?? 'Ada',
        date: isoDay(ago),
        outcome: roll < 0.08 ? 'failed' : roll < 0.12 ? 'rolled-back' : 'success',
        durationS: 40 + Math.floor(random() * 260),
      })
    }
  }
  return out.toReversed()
}

export const SERVICES: readonly Service[] = SPECS.map((spec, index) => ({
  ...spec,
  deploys: deploysOf(spec, index),
}))

const later = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let warm = false
let broken = false

export const fleetApi = {
  async services(): Promise<readonly Service[]> {
    await later(warm ? 120 : 700)
    warm = true
    if (broken) {
      broken = false
      throw new Error('The fleet API did not answer (simulated outage).')
    }
    return SERVICES
  },
  breakNextLoad(): void {
    broken = true
  },
}
