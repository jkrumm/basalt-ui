/** Open Issues of four projects and the Issues each waits on (scenario expr-n32). Authored, no clock, no random. */

export type IssueState = 'building' | 'queued' | 'waiting'

export type Issue = {
  id: number
  title: string
  project: string
  state: IssueState
  /** Ids of the open Issues this one waits on. */
  waitsOn: readonly number[]
}

/** An Issue with what the plan question reads off it. */
export type PlanIssue = Issue & {
  /** Issues that wait on it, directly or through others. */
  unblocks: number
  /** Issues that wait on it directly. */
  direct: number
  /** Ids it waits on besides the one it is listed under, as text; empty when none. */
  alsoWaitsOn: string
  /** Steps below its root blocker in the plan tree. */
  depth: number
  /** Position in the tree reading order. */
  order: number
}

export const STATE_LABELS: Readonly<Record<IssueState, string>> = {
  building: 'Building',
  queued: 'Queued',
  waiting: 'Waiting',
}

/** Fixture names this scenario knows. `idle`: nothing waits on anything. `pileup`: one Issue under all the others. */
export type PlanFixture = 'idle' | 'pileup'

export const isPlanFixture = (value: string | undefined): value is PlanFixture =>
  value === 'idle' || value === 'pileup'

const issue = (
  id: number,
  project: string,
  state: IssueState,
  title: string,
  waitsOn: readonly number[] = [],
): Issue => ({ id, title, project, state, waitsOn })

/** 25 open Issues. #1950 has six waiting on it: four directly, two through #1953 and #1955. */
const BASE: readonly Issue[] = [
  issue(1950, 'factory', 'building', 'Merge lock handoff'),
  issue(1953, 'factory', 'waiting', 'Queue edge validator', [1950]),
  issue(1955, 'factory', 'waiting', 'Plan row schema v2', [1950]),
  issue(1957, 'factory', 'waiting', 'Lead resume after reap', [1950]),
  issue(1959, 'factory', 'waiting', 'Signal dedupe window', [1950]),
  issue(1961, 'factory', 'waiting', 'Plan graph export', [1953]),
  issue(1963, 'factory', 'waiting', 'Edge diff in plan view', [1953, 1955]),
  issue(1966, 'factory', 'queued', 'Queue depth signal'),
  issue(1968, 'factory', 'queued', 'Deploy lock timeout'),
  issue(1944, 'basalt-ui', 'building', 'Shot gate for the keys frame'),
  issue(1946, 'basalt-ui', 'waiting', 'Series file guard', [1944]),
  issue(1948, 'basalt-ui', 'waiting', 'Chart state recipe', [1944, 1946]),
  issue(1951, 'basalt-ui', 'waiting', 'Table row focus map', [1946]),
  issue(1954, 'basalt-ui', 'queued', 'Label placement seam'),
  issue(1956, 'basalt-ui', 'waiting', 'Stacked BarList focus', [1954]),
  issue(1958, 'basalt-ui', 'waiting', 'Docs regen for focus', [1956, 1951]),
  issue(1941, 'argo', 'building', 'Move to the 3.x shell'),
  issue(1945, 'argo', 'waiting', 'Nav badges from the queue', [1941]),
  issue(1947, 'argo', 'waiting', 'Settings page forms', [1941]),
  issue(1949, 'argo', 'queued', 'Fleet board refresh'),
  issue(1960, 'argo', 'waiting', 'Weekly digest card', [1945, 1949, 1942]),
  issue(1942, 'rollhook', 'queued', 'Deploy webhook retry'),
  issue(1952, 'rollhook', 'waiting', 'Rollback marker', [1942]),
  issue(1964, 'rollhook', 'waiting', 'Health probe cut', [1952]),
  issue(1965, 'rollhook', 'building', 'Image prune job'),
]

function variant(fixture: PlanFixture | undefined): readonly Issue[] {
  if (fixture === 'idle') {
    return BASE.map((i) => ({
      ...i,
      state: i.state === 'waiting' ? 'queued' : i.state,
      waitsOn: [],
    }))
  }
  if (fixture === 'pileup') {
    // One chain: each Issue waits on the one before it, so the first has every other under it.
    const sorted = [...BASE].sort((a, b) => a.id - b.id)
    const root = sorted.find((i) => i.id === 1950)
    if (root === undefined) return BASE
    const chain = [root, ...sorted.filter((i) => i.id !== 1950)]
    return chain.map((i, n) => ({
      ...i,
      state: n === 0 ? 'building' : 'waiting',
      waitsOn: n === 0 ? [] : [chain[n - 1]?.id ?? 1950],
    }))
  }
  return BASE
}

/**
 * The plan as a tree in reading order: Issues that wait on nothing are the roots, ranked by how many
 * wait on them; each other Issue is listed once, under the first Issue it waits on.
 */
export function planIssues(fixture: PlanFixture | undefined): readonly PlanIssue[] {
  const issues = variant(fixture)
  const dependents = new Map<number, number[]>()
  for (const i of issues) {
    for (const on of i.waitsOn) dependents.set(on, [...(dependents.get(on) ?? []), i.id])
  }
  const reach = (id: number, seen: Set<number>): Set<number> => {
    for (const next of dependents.get(id) ?? []) {
      if (seen.has(next)) continue
      seen.add(next)
      reach(next, seen)
    }
    return seen
  }
  const unblocks = new Map(issues.map((i) => [i.id, reach(i.id, new Set()).size]))
  const rank = (a: Issue, b: Issue) =>
    (unblocks.get(b.id) ?? 0) - (unblocks.get(a.id) ?? 0) || a.id - b.id
  const childrenOf = (id: number) => issues.filter((i) => i.waitsOn[0] === id).sort(rank)
  const out: PlanIssue[] = []
  const walk = (i: Issue, depth: number) => {
    out.push({
      ...i,
      unblocks: unblocks.get(i.id) ?? 0,
      direct: dependents.get(i.id)?.length ?? 0,
      alsoWaitsOn: i.waitsOn
        .slice(1)
        .map((on) => `#${on}`)
        .join(', '),
      depth,
      order: out.length,
    })
    for (const child of childrenOf(i.id)) walk(child, depth + 1)
  }
  for (const root of issues.filter((i) => i.waitsOn.length === 0).sort(rank)) walk(root, 0)
  return out
}
