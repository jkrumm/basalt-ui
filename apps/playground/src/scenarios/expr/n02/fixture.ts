/** Seeded open-Issue fixture for the stuck-Issues page: stage, time in stage, typical time per stage. */

export const STAGES = ['queued', 'building', 'review', 'deploy', 'verify'] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_LABEL: Record<Stage, string> = {
  queued: 'Queued',
  building: 'Building',
  review: 'Review',
  deploy: 'Deploy',
  verify: 'Verify',
}

/** Typical time per stage, in hours. */
export const TYPICAL_HOURS: Record<Stage, number> = {
  queued: 2,
  building: 1.5,
  review: 10,
  deploy: 0.5,
  verify: 2,
}

/** An Issue is stuck once it sits past this multiple of its stage's typical time. */
export const STUCK_AT = 2

export type Issue = {
  id: string
  title: string
  stage: Stage
  /** 1-based position of the stage in the pipeline, the chart's x. */
  at: number
  hours: number
  typical: number
  /** `hours / typical`: how many typical stage times the Issue has sat. */
  ratio: number
}

export type Band = 'within' | 'over' | 'stuck'

export const bandOf = (issue: Issue): Band => {
  if (issue.ratio >= STUCK_AT) return 'stuck'
  return issue.ratio > 1 ? 'over' : 'within'
}

export type FixtureName = 'default' | 'extreme' | 'quiet'

/** Parses the raw `?fixture=` value; anything unknown is the default. */
export const fixtureName = (raw: string | undefined): FixtureName =>
  raw === 'extreme' || raw === 'quiet' ? raw : 'default'

const TITLES = [
  'Retry the webhook on a 502',
  'Paginate the run list',
  'Drop the stale lockfile check',
  'Pin the node image digest',
  'Cache the plan parse',
  'Fix the empty-diff comment',
  'Split the slow layout shard',
  'Rename the queue lane',
  'Guard the double merge',
  'Surface the deploy log tail',
  'Time out a hung verify probe',
  'Teach doctor the new peer',
  'Trim the status payload',
  'Stop re-running green rows',
  'Label the slot owner',
]

/** Open Issues per stage in the default fixture. */
const COUNTS: Record<Stage, number> = { queued: 6, building: 5, review: 12, deploy: 1, verify: 7 }

/** Mulberry32: a small deterministic generator, so every shot sees the same Issues. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** The ratio of one Issue: mostly under the typical time, a long tail past it. */
function ratioFor(name: FixtureName, stage: Stage, next: () => number): number {
  const base = 0.12 + next() ** 2 * 1.6
  if (name === 'quiet') return Math.min(base, 0.9)
  // the tail: review and verify collect the stuck ones
  const tail = stage === 'review' || stage === 'verify' ? 1.9 : 0.5
  return base + (next() > 0.6 ? next() * tail * 2 : 0)
}

export function buildIssues(name: FixtureName): Issue[] {
  const next = seeded(name === 'quiet' ? 7 : 31)
  let n = 1480
  const issues: Issue[] = []
  STAGES.forEach((stage, i) => {
    const count = name === 'quiet' ? Math.min(COUNTS[stage], 4) : COUNTS[stage]
    for (let k = 0; k < count; k += 1) {
      const typical = TYPICAL_HOURS[stage]
      const ratio = ratioFor(name, stage, next)
      issues.push({
        id: `ISS-${(n += 1 + Math.floor(next() * 5))}`,
        title: TITLES[Math.floor(next() * TITLES.length)] ?? TITLES[0] ?? '',
        stage,
        at: i + 1,
        hours: round1(ratio * typical),
        typical,
        ratio: round1(ratio * 10) / 10,
      })
    }
  })
  if (name === 'extreme') {
    // a verify probe nobody noticed: 3 days 8 hours against a 2 hour norm
    const hours = 80
    issues.push({
      id: 'ISS-1403',
      title: 'Verify probe waits on a retired URL',
      stage: 'verify',
      at: 5,
      hours,
      typical: TYPICAL_HOURS.verify,
      ratio: hours / TYPICAL_HOURS.verify,
    })
  }
  return issues.toSorted((a, b) => b.ratio - a.ratio)
}

/** `45m`, `6.5h`, `31h`, `3d 8h`: the clock form of `useFormat().duration` reads as a time of day. */
export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  if (hours < 10) return `${round1(hours)}h`
  if (hours < 48) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  const rest = Math.round(hours - days * 24)
  return rest === 0 ? `${days}d` : `${days}d ${rest}h`
}
