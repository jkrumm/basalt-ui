/** Seeded triage fixture for c13: 30 days, five auto-closing sources, one escalation count. */

export type SourceKey = 'edr' | 'email' | 'identity' | 'siem' | 'cloud'

export const SOURCES: readonly { key: SourceKey; label: string }[] = [
  { key: 'edr', label: 'Endpoint (EDR)' },
  { key: 'email', label: 'Email gateway' },
  { key: 'identity', label: 'Identity provider' },
  { key: 'siem', label: 'SIEM rules' },
  { key: 'cloud', label: 'Cloud posture' },
]

export type Day = {
  date: Date
  closed: number
  escalated: number
  bySource: Readonly<Record<SourceKey, number>>
}

/** `default` has an outage (zero) and three spikes; `quiet` has no escalation; `surge` one extreme day. */
export type FixtureName = 'default' | 'quiet' | 'surge'

const FIXTURE_NAMES: readonly FixtureName[] = ['default', 'quiet', 'surge']

export const resolveFixture = (raw: string | undefined): FixtureName =>
  FIXTURE_NAMES.find((n) => n === raw) ?? 'default'

const DAY_MS = 86_400_000
const START = Date.UTC(2026, 9, 17)
const DAYS = 30

/** mulberry32: a small seeded generator, so every build draws the same month. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE: Readonly<Record<SourceKey, number>> = {
  edr: 168,
  email: 122,
  identity: 74,
  siem: 51,
  cloud: 33,
}

/** Day indexes with extra escalations in the default month: Nov 3, Nov 4 and Nov 11. */
const SPIKES: Readonly<Record<number, number>> = { 17: 96, 18: 63, 25: 112 }

export function buildDays(name: FixtureName): readonly Day[] {
  const next = rng(1313)
  return Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(START + i * DAY_MS)
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
    const load = weekend ? 0.55 : 1
    const draw = (key: SourceKey): number => {
      const outage = key === 'cloud' && name !== 'quiet' && (i === 8 || i === 9)
      const dead = key === 'cloud' && name === 'quiet' && i < 3
      return outage || dead ? 0 : Math.round(BASE[key] * load * (0.85 + next() * 0.3))
    }
    const bySource = {
      edr: draw('edr'),
      email: draw('email'),
      identity: draw('identity'),
      siem: draw('siem'),
      cloud: draw('cloud'),
    }
    const closed = SOURCES.reduce((sum, { key }) => sum + bySource[key], 0)
    const noise = Math.round((weekend ? 22 : 40) + next() * 14)
    const extra = name === 'default' ? (SPIKES[i] ?? 0) : name === 'surge' && i === 25 ? 570 : 0
    return { date, closed, escalated: name === 'quiet' ? 0 : noise + extra, bySource }
  })
}

export const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = sorted.length >> 1
  if (sorted.length === 0) return 0
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** A spike is a day at 1.8x the median or more; a month with no escalation has none. */
export const SPIKE_FACTOR = 1.8

export const isSpike = (d: Day, base: number): boolean =>
  d.escalated > 0 && d.escalated >= base * SPIKE_FACTOR

/** The closed-without-a-person share over the 30 days before this window: the delta's baseline. */
export const PRIOR_SHARE = 0.84
