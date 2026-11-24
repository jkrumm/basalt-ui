/**
 * Review fixture for the owner's question: which Specs and Reports came in this week, per project,
 * and which still wait for a verdict. About 40 artifacts over 14 days from one seeded generator,
 * a fixed clock, and a 24 hour default that gives a verdict to a document nobody answered.
 */

export type Kind = 'concept' | 'spec' | 'report'
export type Verdict = 'good' | 'changes' | 'none'

export type Artifact = {
  id: string
  project: string
  kind: Kind
  title: string
  submittedAt: number
  verdict: Verdict
  /** When the verdict was given; `null` while none is. */
  verdictAt: number | null
}

export const HOUR = 3_600_000
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY
/** The default gives `good` this long after submission to a document nobody answered. */
export const DEFAULT_AFTER = DAY
/** The fixed clock of every fixture: a Tuesday afternoon, UTC. */
export const NOW = Date.UTC(2026, 10, 17, 14, 0)

/** Every project the owner reviews for; the last one submitted nothing in the 14 days. */
export const PROJECTS = [
  'argo',
  'basalt-ui',
  'rollhook',
  'linewatch',
  'image-gen',
  'meteo',
  'weatherorb',
] as const

const ACTIVE = [
  ['argo', 3],
  ['basalt-ui', 3],
  ['rollhook', 2],
  ['linewatch', 2],
  ['image-gen', 1],
  ['meteo', 1],
] as const

const SPECS = [
  'Retry budget for the review queue',
  'Rollback path for a failed deploy',
  'Scenario registry per expression cycle',
  'Quota windows on the gateway',
  'Heartbeat for the weather poller',
  'Signed image URLs with an expiry',
  'Dark palette for the map layer',
  'Backoff for the line probe',
  'Pagination for the run history',
  'Offline cache for forecast tiles',
  'Cursor paging in the artifact list',
  'Idempotent deploy hooks',
  'Alert routing by project owner',
  'Token refresh without a reload',
  'Table export with the active filters',
  'Seeded fixtures for the playground',
  'Webhook signing for deploy events',
  'Per-project review rules',
  'Warm start for the forecast cache',
  'Pinned versions in the lockfile check',
  'Shared theme tokens for the map',
  'Retention for old artifacts',
  'A health check for the probe agent',
  'Dry-run mode for the deploy hook',
]

const REPORTS = [
  'Deploy timings, week 46',
  'Flaky tests in the table suite',
  'Gateway spend by purpose',
  'Probe misses on the backup path',
  'Review latency by project',
  'Build cache hit rate',
  'Bundle size after the token move',
  'Forecast model drift',
  'Shot findings from the last cycle',
  'Rollhook failures in staging',
  'Lint findings per package',
  'Image render times',
  'Queue depth over a busy day',
  'Cold start of the poller',
  'Accessibility audit of the shell',
  'Cost of the nightly eval',
  'Uptime of the status page',
  'Slowest queries in the run history',
  'Error budget for the gateway',
  'Memory use of the poller',
  'Coverage of the table kinds',
  'Review turnaround, last month',
  'Disk growth on the build host',
  'Wi-Fi drops by hour',
]

const CONCEPTS = [
  'A shared review inbox',
  'Weather without a map',
  'One status page for every project',
  'Owner digest at 08:00',
  'Templates for new projects',
  'Pinned forecasts per place',
  'A budget view for the gateway',
  'Release notes from commits',
  'Link previews for artifacts',
  'Quiet hours for alerts',
  'Compare two forecast models',
  'A read-only share link',
]

const LONG_TITLE =
  'Migrate the playground scenario registry to one route per expression cycle and retire the shot list'

/** mulberry32: a small seeded generator, so every build draws the same 14 days. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One document with the verdict history its age allows: an answer, or the default at 24 h. */
function decided(rand: () => number, base: Omit<Artifact, 'verdict' | 'verdictAt'>): Artifact {
  if (rand() < 0.28) {
    return { ...base, verdict: 'good', verdictAt: base.submittedAt + DEFAULT_AFTER }
  }
  const verdict: Verdict = rand() < 0.62 ? 'good' : 'changes'
  return { ...base, verdict, verdictAt: base.submittedAt + Math.round((1 + rand() * 21) * HOUR) }
}

function generate(): Artifact[] {
  const rand = seeded(262)
  const weighted = (): string => {
    const total = ACTIVE.reduce((sum, [, w]) => sum + w, 0)
    let at = rand() * total
    for (const [name, w] of ACTIVE) {
      at -= w
      if (at < 0) return name
    }
    return ACTIVE[0][0]
  }
  const titles = { spec: [...SPECS], report: [...REPORTS], concept: [...CONCEPTS] }
  const take = (kind: Kind): string => {
    const list = titles[kind]
    const [title] = list.splice(Math.floor(rand() * list.length), 1)
    return title ?? 'Untitled'
  }

  // Thirty-six documents older than a day, spread over the 14 days.
  const older: Artifact[] = Array.from({ length: 36 }, (_, i) => {
    const age = DAY + rand() * 13 * DAY
    const r = rand()
    const kind: Kind = r < 0.2 ? 'concept' : r < 0.65 ? 'spec' : 'report'
    return decided(rand, {
      id: `a-${i}`,
      project: weighted(),
      kind,
      title: take(kind),
      submittedAt: Math.round((NOW - age) / 60_000) * 60_000,
    })
  })

  // The last day is placed by hand: two Specs and a Report wait, one Spec has changes asked,
  // a Concept waits too (it is not part of the question).
  const hand = (
    n: number,
    ageH: number,
    project: string,
    kind: Kind,
    title: string,
    verdict: Verdict,
    answerH: number | null,
  ): Artifact => ({
    id: `h-${n}`,
    project,
    kind,
    title,
    submittedAt: NOW - ageH * HOUR,
    verdict,
    verdictAt: answerH === null ? null : NOW - (ageH - answerH) * HOUR,
  })
  const lastDay: Artifact[] = [
    hand(0, 2, 'argo', 'spec', LONG_TITLE, 'none', null),
    hand(1, 5, 'linewatch', 'concept', take('concept'), 'none', null),
    hand(2, 7, 'argo', 'report', take('report'), 'none', null),
    hand(3, 13, 'basalt-ui', 'spec', take('spec'), 'changes', 4),
    hand(4, 19, 'rollhook', 'report', take('report'), 'none', null),
  ]
  return [...older, ...lastDay].sort((a, b) => b.submittedAt - a.submittedAt)
}

const BASE = generate()

/** Twelve Specs and Reports from one run of an agent, ten of them waiting. */
function burst(): Artifact[] {
  const rand = seeded(7)
  return Array.from({ length: 12 }, (_, i): Artifact => {
    const ageH = 1 + i * 1.6
    const submittedAt = Math.round((NOW - ageH * HOUR) / 60_000) * 60_000
    const base = {
      id: `b-${i}`,
      project: 'image-gen',
      kind: i % 3 === 0 ? ('report' as const) : ('spec' as const),
      title: `Render path ${i + 1} for the image pipeline`,
      submittedAt,
    }
    if (i === 8 || i === 10) {
      return {
        ...base,
        verdict: 'changes',
        verdictAt: submittedAt + Math.round((1 + rand()) * HOUR),
      }
    }
    return { ...base, verdict: 'none', verdictAt: null }
  })
}

/** Everything answered: a waiting document gets its verdict an hour or two after it came in. */
function cleared(): Artifact[] {
  return BASE.map((a) =>
    a.verdict === 'none'
      ? {
          ...a,
          verdict: 'good',
          verdictAt: a.submittedAt + Math.min(2 * HOUR, Math.round((NOW - a.submittedAt) / 2)),
        }
      : a,
  )
}

/** Nothing came in this week; last week's documents stay. */
function quiet(): Artifact[] {
  return BASE.filter((a) => a.submittedAt <= NOW - WEEK)
}

export function fixtureFor(name: string | undefined): Artifact[] {
  if (name === 'clear') return cleared()
  if (name === 'burst') return [...burst(), ...BASE].sort((a, b) => b.submittedAt - a.submittedAt)
  if (name === 'quiet') return quiet()
  return BASE
}
