/** Open Issues of the factory pipeline (scenario expr-n02): a seeded, deterministic fixture. */

export const STAGES = [
  { key: 'queued', label: 'Queued', typical: 4 },
  { key: 'building', label: 'Building', typical: 1.5 },
  { key: 'review', label: 'Review', typical: 6 },
  { key: 'deploy', label: 'Deploy', typical: 0.5 },
  { key: 'verify', label: 'Verify', typical: 2 },
] as const

export type StageKey = (typeof STAGES)[number]['key']

/** An Issue is stuck once it has sat in its stage longer than this many times the stage's typical time. */
export const STUCK_AFTER = 2

export type Issue = {
  id: string
  title: string
  stage: StageKey
  stageLabel: string
  /** Hours the Issue has sat in its stage. */
  hours: number
  /** The typical hours of its stage. */
  typical: number
  /** `hours / typical`. */
  ratio: number
  stuck: boolean
  verdict: 'Stuck' | 'On pace'
}

/** How many Issues sit in each stage, and the multiples of typical the late ones among them stand at. */
const PLAN: Record<StageKey, { count: number; late: readonly number[] }> = {
  queued: { count: 8, late: [2.4, 3.6] },
  building: { count: 6, late: [2.7] },
  review: { count: 9, late: [2.2, 3.1, 4.6, 5.4] },
  deploy: { count: 3, late: [] },
  verify: { count: 4, late: [2.1] },
}

const TITLES = [
  'Retry the flaky deploy hook',
  'Split the billing export job',
  'Cache the plan lookup',
  'Drop the legacy webhook route',
  'Pin the runner image',
  'Add a timeout to the sync call',
  'Move session storage to Redis',
  'Fix the nightly report totals',
  'Rename the audit log columns',
  'Throttle the import queue',
  'Verify the backup restore',
  'Trim the build log output',
  'Handle empty review requests',
  'Upgrade the queue client',
  'Stop double-posting digests',
  'Add retries to the mailer',
  'Clear stale preview builds',
  'Show the owner on each Issue',
  'Fix the date shift in exports',
  'Batch the cache warm-up',
  'Guard the cron against overlap',
  'Move the feature flags to config',
  'Log the slow query sample',
  'Fix the broken tag filter',
  'Reduce the image build layers',
  'Rotate the deploy token',
  'Add health checks to workers',
  'Unblock the migration lock',
  'Speed up the lint step',
  'Collapse duplicate alerts',
]

/** mulberry32: the same seed gives the same Issues on every render. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** `late` replaces the plan's late multiples; a zero Issue just entered its stage. */
function build({
  late,
  zero,
}: {
  late: Partial<Record<StageKey, readonly number[]>>
  zero: boolean
}): Issue[] {
  const rand = seeded(2402)
  let n = 0
  const issues: Issue[] = []
  for (const stage of STAGES) {
    const plan = PLAN[stage.key]
    const lateOnes = late[stage.key] ?? plan.late
    for (let i = 0; i < plan.count; i++) {
      const isLate = i < lateOnes.length
      const multiple = isLate ? (lateOnes[i] ?? 0) : 0.1 + rand() * 1.3
      const justEntered = zero && stage.key === 'deploy' && i === 0
      const hours = justEntered ? 0 : Math.round(stage.typical * multiple * 10) / 10
      const ratio = hours / stage.typical
      const stuck = ratio > STUCK_AFTER
      issues.push({
        id: `#${2380 + n * 3 + Math.floor(rand() * 3)}`,
        title: TITLES[n] ?? 'Untitled',
        stage: stage.key,
        stageLabel: stage.label,
        hours,
        typical: stage.typical,
        ratio,
        stuck,
        verdict: stuck ? 'Stuck' : 'On pace',
      })
      n += 1
    }
  }
  return issues
}

/**
 * The fixture a `?fixture=` name picks. The rest state has a few Issues stuck and one that just
 * entered Deploy (0 h); `extreme` puts one Review Issue at 24 times typical; `calm` has none stuck.
 */
export function issuesFor(fixture: string | undefined): readonly Issue[] {
  if (fixture === 'extreme') return build({ late: { review: [23.8, 3.1, 4.6, 5.4] }, zero: true })
  if (fixture === 'calm') {
    return build({ late: { queued: [], building: [], review: [], verify: [] }, zero: true })
  }
  return build({ late: {}, zero: true })
}
