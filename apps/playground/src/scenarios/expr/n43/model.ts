/** What the owner's page reads off the artifacts: this week's Specs and Reports, per project, by verdict. */
import { type Artifact, DAY, DEFAULT_AFTER, HOUR, NOW, PROJECTS, WEEK } from './fixture'

export const STATES = ['waiting', 'changes', 'good', 'byDefault'] as const
export type State = (typeof STATES)[number]

export const STATE_LABEL: Record<State, string> = {
  waiting: 'Waiting',
  changes: 'Changes',
  good: 'Looks good',
  byDefault: 'Looks good by default',
}

/** A Spec or a Report with its verdict state and how long it waited (or has waited so far). */
export type Doc = Omit<Artifact, 'kind'> & {
  kind: 'spec' | 'report'
  state: State
  waitHours: number
}

export type Summary = {
  total: number
  specs: number
  reports: number
  counts: Record<State, number>
  /** How many came in during the week before. */
  previous: number
  /** Came in per day over the 14 days, oldest first. */
  perDay: number[]
  /** How many waited at this time a week ago. */
  waitingAgo: number
  oldestWaitingH: number | null
  /** When the default gives its verdict to the document that waited longest. */
  nextDefaultAt: number | null
}

export type ProjectRow = Summary & { name: string }

export type Model = { docs: Doc[]; projects: ProjectRow[]; all: Summary }

function stateOf(a: Artifact): State {
  if (a.verdict === 'none') return 'waiting'
  if (a.verdict === 'changes') return 'changes'
  return a.verdictAt === a.submittedAt + DEFAULT_AFTER ? 'byDefault' : 'good'
}

function docOf(a: Artifact): Doc[] {
  if (a.kind === 'concept') return []
  const waitHours = Math.round(((a.verdictAt ?? NOW) - a.submittedAt) / HOUR)
  return [{ ...a, kind: a.kind, state: stateOf(a), waitHours }]
}

const reviewed = (artifacts: readonly Artifact[], project: string | null): Artifact[] =>
  artifacts.filter((a) => a.kind !== 'concept' && (project === null || a.project === project))

function summarise(artifacts: readonly Artifact[], project: string | null): Summary {
  const mine = reviewed(artifacts, project)
  const docs = mine.filter((a) => a.submittedAt > NOW - WEEK).flatMap(docOf)
  const counts: Record<State, number> = { waiting: 0, changes: 0, good: 0, byDefault: 0 }
  for (const d of docs) counts[d.state] += 1
  const waiting = docs.filter((d) => d.state === 'waiting').map((d) => d.submittedAt)
  const first = waiting.length === 0 ? null : Math.min(...waiting)
  const between = (from: number, to: number): number =>
    mine.filter((a) => a.submittedAt > from && a.submittedAt <= to).length
  const ago = NOW - WEEK
  return {
    total: docs.length,
    specs: docs.filter((d) => d.kind === 'spec').length,
    reports: docs.filter((d) => d.kind === 'report').length,
    counts,
    previous: between(NOW - 2 * WEEK, ago),
    perDay: Array.from({ length: 14 }, (_, i) =>
      between(NOW - (14 - i) * DAY, NOW - (13 - i) * DAY),
    ),
    waitingAgo: mine.filter(
      (a) => a.submittedAt <= ago && (a.verdictAt === null || a.verdictAt > ago),
    ).length,
    oldestWaitingH: first === null ? null : Math.floor((NOW - first) / HOUR),
    nextDefaultAt: first === null ? null : first + DEFAULT_AFTER,
  }
}

/** The documents that came in during the last 7 days, waiting first (closest to its default), then newest. */
export function modelOf(artifacts: readonly Artifact[]): Model {
  const docs = artifacts
    .filter((a) => a.submittedAt > NOW - WEEK)
    .flatMap(docOf)
    .sort((a, b) =>
      a.state === 'waiting' && b.state === 'waiting'
        ? a.submittedAt - b.submittedAt
        : Number(b.state === 'waiting') - Number(a.state === 'waiting') ||
          b.submittedAt - a.submittedAt,
    )
  const projects = PROJECTS.map((name): ProjectRow => ({
    name,
    ...summarise(artifacts, name),
  })).sort((a, b) => b.counts.waiting - a.counts.waiting || b.total - a.total)
  return { docs, projects, all: summarise(artifacts, null) }
}
