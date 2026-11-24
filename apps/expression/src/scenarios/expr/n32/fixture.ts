/**
 * The plan the page reads: open Issues across four projects, each queued, building or waiting on
 * other open Issues. The default fixture has one Issue that six others wait on, directly or
 * through others. Ids come from a seeded generator, so every run draws the same plan.
 */

export type IssueState = 'queued' | 'building' | 'waiting'

export type Issue = {
  id: string
  title: string
  project: string
  state: IssueState
  /** The ids of the open Issues this one waits on. */
  waitsOn: readonly string[]
  /** The first blocker's title and a count of the rest, for the table ("Move the series file +1"); a dash when nothing blocks it. */
  blockers: string
  /** Open Issues that wait on this one, directly or through others. */
  unblocks: number
}

type Draft = {
  key: string
  title: string
  project: string
  state: IssueState
  after: readonly string[]
}

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const STATE_ORDER: Record<IssueState, number> = { building: 0, queued: 1, waiting: 2 }

/** Numbers the drafts from the seed, derives each Issue's reach and sorts the most-unblocking first. */
function build(drafts: readonly Draft[], seed: number): Issue[] {
  const next = seeded(seed)
  let n = 1800
  const idOf = new Map<string, string>()
  for (const d of drafts) {
    n += 3 + Math.floor(next() * 40)
    idOf.set(d.key, String(n))
  }
  const dependents = new Map<string, string[]>()
  for (const d of drafts) {
    for (const k of d.after) dependents.set(k, [...(dependents.get(k) ?? []), d.key])
  }
  const reach = (key: string): Set<string> => {
    const seen = new Set<string>()
    const stack = [...(dependents.get(key) ?? [])]
    for (let k = stack.pop(); k !== undefined; k = stack.pop()) {
      if (seen.has(k)) continue
      seen.add(k)
      stack.push(...(dependents.get(k) ?? []))
    }
    return seen
  }
  const titleOf = new Map(drafts.map((d) => [d.key, d.title]))
  const issues = drafts.map((d): Issue => {
    const waitsOn = d.after.flatMap((k) => idOf.get(k) ?? [])
    const first = titleOf.get(d.after[0] ?? '')
    return {
      id: idOf.get(d.key) ?? d.key,
      title: d.title,
      project: d.project,
      state: d.state,
      waitsOn,
      blockers:
        first === undefined
          ? '\u2014'
          : first + (waitsOn.length > 1 ? ` +${waitsOn.length - 1}` : ''),
      unblocks: reach(d.key).size,
    }
  })
  return issues.sort(
    (a, b) =>
      b.unblocks - a.unblocks ||
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      a.id.localeCompare(b.id),
  )
}

const BASALT = 'basalt-ui'
const ARGO = 'argo'
const FACTORY = 'factory'
const ROLLHOOK = 'rollhook'

const DEFAULT: readonly Draft[] = [
  {
    key: 'r',
    title: 'Move the series colors into the token layer',
    project: BASALT,
    state: 'queued',
    after: [],
  },
  {
    key: 'a',
    title: 'Re-derive the chart ramps from the token layer',
    project: BASALT,
    state: 'waiting',
    after: ['r'],
  },
  {
    key: 'b',
    title: 'Port the argo charts to the token series',
    project: ARGO,
    state: 'waiting',
    after: ['r'],
  },
  {
    key: 'c',
    title: 'Drop the legacy bridge from the shell',
    project: BASALT,
    state: 'waiting',
    after: ['r'],
  },
  {
    key: 'd',
    title: 'Ship the argo dashboard on the new ramps',
    project: ARGO,
    state: 'waiting',
    after: ['a'],
  },
  {
    key: 'e',
    title: "Retire argo's local series file",
    project: ARGO,
    state: 'waiting',
    after: ['b'],
  },
  {
    key: 'f',
    title: 'Publish the release notes for the token layer',
    project: BASALT,
    state: 'waiting',
    after: ['a', 'c'],
  },
  {
    key: 's',
    title: 'Cache the plan query in the factory lead',
    project: FACTORY,
    state: 'building',
    after: [],
  },
  {
    key: 'g',
    title: 'Show queue age on the factory board',
    project: FACTORY,
    state: 'waiting',
    after: ['s'],
  },
  {
    key: 'h',
    title: 'Alert when a queued Issue is older than a day',
    project: FACTORY,
    state: 'waiting',
    after: ['g'],
  },
  {
    key: 'i',
    title: 'Stop the lead re-reading the plan on every signal',
    project: FACTORY,
    state: 'waiting',
    after: ['s'],
  },
  {
    key: 't',
    title: 'Split the deploy lock by repo',
    project: ROLLHOOK,
    state: 'building',
    after: [],
  },
  {
    key: 'k',
    title: 'Deploy two repos at once',
    project: ROLLHOOK,
    state: 'waiting',
    after: ['t'],
  },
  {
    key: 'l',
    title: 'Report lock wait time per deploy',
    project: ROLLHOOK,
    state: 'waiting',
    after: ['k'],
  },
  {
    key: 'u',
    title: 'Fix the nightly backup pruning',
    project: ROLLHOOK,
    state: 'queued',
    after: [],
  },
  {
    key: 'm',
    title: 'Verify a restore from the pruned backup',
    project: ROLLHOOK,
    state: 'waiting',
    after: ['u'],
  },
  {
    key: 'v',
    title: 'Page the owner when pruning removes a day',
    project: ROLLHOOK,
    state: 'waiting',
    after: ['u'],
  },
  { key: 'x', title: 'Bump the test runner in argo', project: ARGO, state: 'queued', after: [] },
  {
    key: 'tb',
    title: 'Run the argo suite in two shards',
    project: ARGO,
    state: 'waiting',
    after: ['x'],
  },
  { key: 'y', title: 'Audit the cron schedule', project: FACTORY, state: 'queued', after: [] },
  {
    key: 'sb',
    title: 'Move the stale-signal sweep to the audited schedule',
    project: FACTORY,
    state: 'waiting',
    after: ['y'],
  },
  {
    key: 'z',
    title: 'Fix the focus ring on the table header',
    project: BASALT,
    state: 'building',
    after: [],
  },
  { key: 'p', title: 'Trim the shot cache', project: FACTORY, state: 'building', after: [] },
  { key: 'q', title: 'Document the lock order', project: FACTORY, state: 'queued', after: [] },
  {
    key: 'w',
    title: 'Add a retry to the webhook receiver',
    project: ROLLHOOK,
    state: 'queued',
    after: [],
  },
]

/** Nothing waits: every open Issue can start, so the reach of each is zero. */
const CLEAR: readonly Draft[] = DEFAULT.map((d) => ({
  ...d,
  state: d.state === 'waiting' ? 'queued' : d.state,
  after: [],
}))

const TOPICS = [
  'Rename the lead worktrees',
  'Cut the board query to one round trip',
  'Show blockers on the Issue page',
  'Sort the queue by what it unblocks',
  'Move the lock table to its own store',
  'Retry a failed deploy hook once',
  'Print the plan edges in the CLI',
  'Fold the two signal feeds into one',
  'Skip the build when only docs changed',
  'Name the owner on a waiting Issue',
  'Stop re-running green checks after a rebase',
  'Group the board by project',
]

/** One Issue that nearly everything waits on: 24 of 25 wait on it, on every path. */
function pileup(): Draft[] {
  const next = seeded(7)
  const projects = [BASALT, ARGO, FACTORY, ROLLHOOK]
  const waiting: Draft[] = Array.from({ length: 24 }, (_, i) => ({
    key: 'w' + i,
    title: (TOPICS[i % TOPICS.length] ?? 'Follow-up') + (i >= TOPICS.length ? ', part two' : ''),
    project: projects[Math.floor(next() * projects.length)] ?? BASALT,
    state: 'waiting',
    after: i < 10 ? ['root'] : ['w' + Math.floor(next() * i)],
  }))
  return [
    {
      key: 'root',
      title:
        "Replace the gateway's per-tenant rate limiter with the shared token bucket before any consumer upgrades",
      project: FACTORY,
      state: 'queued',
      after: [],
    },
    ...waiting,
  ]
}

/** The plan for a `?fixture=` name: `clear` (nothing waits), `pileup` (24 Issues behind one), else the default. */
export function planOf(fixture: string | undefined): Issue[] {
  if (fixture === 'clear') return build(CLEAR, 11)
  if (fixture === 'pileup') return build(pileup(), 23)
  return build(DEFAULT, 11)
}
