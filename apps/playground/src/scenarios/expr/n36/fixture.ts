/** Fifteen open merge requests, seeded and fixed: the same shot every run. */

export const VIEWER = 'jk'

/** The fixed clock the ages count back from (epoch ms, 2026-11-17 08:00 UTC). */
export const NOW = Date.UTC(2026, 10, 17, 8, 0, 0)

export type Pipeline = 'passed' | 'failed' | 'running'

export type MergeRequest = {
  id: string
  title: string
  author: string
  reviewers: readonly string[]
  approvedBy: readonly string[]
  needed: number
  pipeline: Pipeline
  ageHours: number
}

const mr = (
  n: number,
  title: string,
  author: string,
  ageHours: number,
  pipeline: Pipeline,
  needed: number,
  reviewers: readonly string[],
  approvedBy: readonly string[] = [],
): MergeRequest => ({
  id: `!${n}`,
  title,
  author,
  reviewers,
  approvedBy,
  needed,
  pipeline,
  ageHours,
})

const OPEN: readonly MergeRequest[] = [
  mr(
    391,
    'Retry webhook deliveries with backoff',
    'priya',
    504,
    'passed',
    2,
    [VIEWER, 'theo'],
    ['theo'],
  ),
  mr(447, 'Cache the nav manifest at build time', 'maya', 52, 'passed', 2, [VIEWER, 'luca']),
  mr(452, 'Fix the off-by-one in the pager total', 'dana', 27, 'running', 1, [VIEWER]),
  mr(455, 'Move the session store to Redis', 'theo', 6, 'passed', 2, [VIEWER, 'luca'], ['luca']),
  mr(458, 'Add CSV export to the billing table', 'sofia', 2, 'failed', 1, [VIEWER]),
  mr(433, 'Split the auth middleware', VIEWER, 121, 'failed', 2, ['maya', 'priya'], ['maya']),
  mr(441, 'Drop the legacy invoice route', VIEWER, 74, 'passed', 2, ['maya', 'ben'], ['maya']),
  mr(449, 'Typed search params for filters', VIEWER, 20, 'running', 2, ['dana', 'theo']),
  mr(457, 'Bump the TanStack packages', VIEWER, 3, 'passed', 2, ['dana', 'luca'], ['dana', 'luca']),
  mr(420, 'Rework the onboarding emails', 'ben', 168, 'passed', 2, ['maya', 'luca'], ['maya']),
  mr(436, 'Rate-limit the export endpoint', 'luca', 96, 'failed', 2, ['dana', 'priya']),
  mr(
    444,
    'Upgrade Playwright to the latest minor',
    'maya',
    40,
    'passed',
    2,
    ['ben', 'dana'],
    ['ben', 'dana'],
  ),
  mr(450, 'Paginate the audit log', 'priya', 14, 'running', 2, ['maya', 'ben']),
  mr(453, 'Localise the invoice PDF', 'dana', 8, 'passed', 1, ['theo'], ['theo']),
  mr(456, 'Trim the bundle manifest', 'theo', 1, 'running', 1, ['sofia']),
]

export type Dataset = {
  rows: readonly MergeRequest[]
  /** How many merge requests waited on the viewer yesterday: the baseline of the headline. */
  waitingYesterday: number
}

/** Every review the viewer owes is given and every own merge request is green and approved. */
function quiet(rows: readonly MergeRequest[]): readonly MergeRequest[] {
  return rows.map((row) => {
    if (row.author === VIEWER) {
      return { ...row, pipeline: 'passed', approvedBy: row.reviewers }
    }
    if (row.reviewers.includes(VIEWER)) return { ...row, approvedBy: [...row.approvedBy, VIEWER] }
    return row
  })
}

/** `fixture` names: `quiet` is the zero case, nothing waits on the viewer and nothing of theirs is stuck. */
export function dataset(fixture: string | undefined): Dataset {
  if (fixture === 'quiet') return { rows: quiet(OPEN), waitingYesterday: 2 }
  return { rows: OPEN, waitingYesterday: 3 }
}
