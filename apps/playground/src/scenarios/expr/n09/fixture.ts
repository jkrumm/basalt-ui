/** The factory schedule: 15 jobs, a fixed clock, and the fixture names `?fixture=` knows. */

export const NOW = Date.UTC(2026, 10, 16, 9, 0, 0)
export const HORIZON_MS = 24 * 3_600_000

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export type Horizon = 'next' | 'soon' | 'later'

export type Job = {
  id: string
  name: string
  repo: string
  recurrence: string
  nextRun: number
  /** Minutes from the fixture clock: the chart's x. */
  minutes: number
  /** 1-based place in the run order: the chart's y. */
  order: number
  horizon: Horizon
}

type Seed = readonly [name: string, repo: string, recurrence: string, inMs: number]

const BASE: readonly Seed[] = [
  ['queue-drain', 'factory', 'Every 5 min', 3 * MIN],
  ['uptime-probe', 'vps', 'Every 15 min', 11 * MIN],
  ['cache-prune', 'basalt-ui', 'Hourly', 26 * MIN],
  ['rollhook-health', 'rollhook', 'Every 30 min', 41 * MIN],
  ['linewatch-speedtest', 'linewatch', 'Every 2 h', 95 * MIN],
  ['vault-sync', 'brain', 'Every 4 h', 3 * HOUR + 10 * MIN],
  ['image-gc', 'image-share', 'Daily 02:00', 17 * HOUR],
  ['db-backup', 'homelab-private', 'Daily 03:30', 18 * HOUR + 30 * MIN],
  ['weather-ingest', 'meteo', 'Every 6 h', 5 * HOUR + 40 * MIN],
  ['digest-mail', 'argo', 'Daily 07:00', 22 * HOUR],
  ['dependency-audit', 'basalt-ui', 'Weekly, Mon 06:00', DAY + 21 * HOUR],
  ['release-notes-draft', 'factory', 'Weekly, Fri 16:00', 4 * DAY + 7 * HOUR],
  ['log-archive', 'vps', 'Monthly, 1st 01:00', 14 * DAY + 16 * HOUR],
  ['cert-renewal-check', 'rollhook', 'Monthly, 1st 04:00', 14 * DAY + 19 * HOUR],
  ['license-audit', 'homelab-private', 'Quarterly, 1 Jan 00:00', 45 * DAY + 15 * HOUR],
]

/** `quiet`: nothing falls inside 24 h, so the zero. `extreme`: a job 8 s out and one 400 days out. */
const QUIET: readonly Seed[] = BASE.map(([name, repo, recurrence, inMs]) => [
  name,
  repo,
  recurrence,
  inMs < DAY ? inMs + DAY : inMs,
])
const EXTREME: readonly Seed[] = [
  ['hourly-reconciliation-of-every-tenant-billing-ledger', 'homelab-private', 'Every 1 h', 8_000],
  ...BASE.slice(1, 14),
  ['legacy-key-rotation-reminder', 'vps', 'Yearly, 1 Jan 00:00', 400 * DAY],
]

const SEEDS: Record<string, readonly Seed[]> = { quiet: QUIET, extreme: EXTREME }

export function jobsFor(fixture: string | undefined): Job[] {
  const seeds = (fixture === undefined ? undefined : SEEDS[fixture]) ?? BASE
  return seeds
    .toSorted((a, b) => a[3] - b[3])
    .map(([name, repo, recurrence, inMs], i) => ({
      id: `${repo}/${name}`,
      name,
      repo,
      recurrence,
      nextRun: NOW + inMs,
      minutes: inMs / MIN,
      order: i + 1,
      horizon: i === 0 ? 'next' : inMs <= HORIZON_MS ? 'soon' : 'later',
    }))
}
