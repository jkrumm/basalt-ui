/** The Issue behind expr-n47: timed events, three attempts with their sessions, and the waits between them. Pure data, no clock: every instant is a constant. */

export type Kind = 'work' | 'owner' | 'ci' | 'hold' | 'blocked' | 'event'
/** Which BarList row a step belongs to: the time before the first attempt, or one attempt. */
export type Group = 'queue' | 'a1' | 'a2' | 'a3'

export type Step = {
  id: string
  group: Group
  lane: string
  kind: Kind
  name: string
  /** What the step says beyond its name: a reason, a verdict. */
  detail: string | null
  start: Date
  /** `null` is a point event. */
  end: Date | null
  turns: number | null
  ktokens: number | null
  cost: number | null
}

export type Attempt = { group: Exclude<Group, 'queue'>; label: string; outcome: string }

export type IssueRecord = {
  id: string
  title: string
  steps: readonly Step[]
  attempts: readonly Attempt[]
  filedAt: Date
  /** The last instant on the page: the verification, or the clock when the Issue is still open. */
  endAt: Date
  shippedAt: Date | null
  /** The median filed-to-shipped time of the Issues around this one, the baseline of the hero. */
  medianMs: number
}

export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
const MEDIAN_MS = 9 * HOUR_MS + 20 * MINUTE_MS

const at = (day: number, hh: number, mm: number): Date => new Date(Date.UTC(2026, 10, day, hh, mm))

type Draft = Pick<Step, 'id' | 'group' | 'lane' | 'kind' | 'name'> & {
  start: Date
  end?: Date
  detail?: string
  session?: readonly [turns: number, ktokens: number, cost: number]
}

const step = (d: Draft): Step => ({
  id: d.id,
  group: d.group,
  lane: d.lane,
  kind: d.kind,
  name: d.name,
  detail: d.detail ?? null,
  start: d.start,
  end: d.end ?? null,
  turns: d.session?.[0] ?? null,
  ktokens: d.session?.[1] ?? null,
  cost: d.session?.[2] ?? null,
})

const A1 = 'Attempt 1'
const A2 = 'Attempt 2'
const A3 = 'Attempt 3'

const FILED: Draft = {
  id: 'filed',
  group: 'queue',
  lane: 'Issue',
  kind: 'event',
  name: 'Filed',
  start: at(16, 8, 40),
}

const FIRST_TWO: readonly Draft[] = [
  {
    id: 'queued',
    group: 'queue',
    lane: 'Issue',
    kind: 'hold',
    name: 'Queued',
    start: at(16, 8, 40),
    end: at(16, 11, 5),
  },
  {
    id: 'admitted',
    group: 'queue',
    lane: 'Issue',
    kind: 'event',
    name: 'Admitted',
    start: at(16, 11, 5),
  },
  {
    id: 'a1-lead',
    group: 'a1',
    lane: A1,
    kind: 'work',
    name: 'Lead session',
    start: at(16, 11, 12),
    end: at(16, 13, 5),
    session: [36, 1420, 5.1],
  },
  {
    id: 'a1-review',
    group: 'a1',
    lane: A1,
    kind: 'work',
    name: 'Review',
    detail: 'Sent back: no test for the migration',
    start: at(16, 13, 10),
    end: at(16, 13, 32),
    session: [12, 310, 1.05],
  },
  {
    id: 'a2-lead',
    group: 'a2',
    lane: A2,
    kind: 'work',
    name: 'Lead session',
    start: at(16, 13, 40),
    end: at(16, 15, 20),
    session: [44, 1880, 6.75],
  },
]

const BLOCK_REASON = 'The backfill drops the slug column prod still reads'

const ATTEMPTS: readonly Attempt[] = [
  { group: 'a1', label: A1, outcome: 'Sent back by review' },
  { group: 'a2', label: A2, outcome: 'Blocked on the owner' },
  { group: 'a3', label: A3, outcome: 'Shipped' },
]

const REST: IssueRecord = {
  id: '1842',
  title: 'Backfill export slugs',
  filedAt: at(16, 8, 40),
  endAt: at(17, 11, 52),
  shippedAt: at(17, 11, 31),
  medianMs: MEDIAN_MS,
  attempts: ATTEMPTS,
  steps: (
    [
      FILED,
      ...FIRST_TWO,
      {
        id: 'a2-blocked',
        group: 'a2',
        lane: A2,
        kind: 'blocked',
        name: 'Blocked on owner',
        detail: BLOCK_REASON,
        start: at(16, 15, 20),
        end: at(17, 8, 5),
      },
      {
        id: 'a3-lead',
        group: 'a3',
        lane: A3,
        kind: 'work',
        name: 'Lead session',
        start: at(17, 8, 10),
        end: at(17, 9, 35),
        session: [29, 1100, 3.9],
      },
      {
        id: 'a3-review',
        group: 'a3',
        lane: A3,
        kind: 'work',
        name: 'Review',
        start: at(17, 9, 38),
        end: at(17, 9, 55),
        session: [9, 240, 0.8],
      },
      {
        id: 'a3-owner',
        group: 'a3',
        lane: A3,
        kind: 'owner',
        name: 'Owner sign-off',
        start: at(17, 9, 55),
        end: at(17, 10, 12),
      },
      {
        id: 'a3-ci',
        group: 'a3',
        lane: A3,
        kind: 'ci',
        name: 'CI run',
        start: at(17, 10, 12),
        end: at(17, 10, 41),
      },
      {
        id: 'a3-window',
        group: 'a3',
        lane: A3,
        kind: 'hold',
        name: 'Merge window',
        start: at(17, 10, 41),
        end: at(17, 11, 30),
      },
      {
        id: 'shipped',
        group: 'a3',
        lane: 'Issue',
        kind: 'event',
        name: 'Shipped',
        start: at(17, 11, 31),
      },
      {
        id: 'verified',
        group: 'a3',
        lane: 'Issue',
        kind: 'event',
        name: 'Verified',
        start: at(17, 11, 52),
      },
    ] satisfies Draft[]
  ).map(step),
}

/** The zero fixture: one attempt, no owner wait, no blocked time, and a review waived with no turns, tokens or cost. */
const CLEAN: IssueRecord = {
  id: '1851',
  title: 'Fix the export footer date',
  filedAt: at(16, 8, 40),
  endAt: at(16, 10, 49),
  shippedAt: at(16, 10, 31),
  medianMs: MEDIAN_MS,
  attempts: [{ group: 'a1', label: A1, outcome: 'Shipped on the first try' }],
  steps: (
    [
      FILED,
      {
        id: 'queued',
        group: 'queue',
        lane: 'Issue',
        kind: 'hold',
        name: 'Queued',
        start: at(16, 8, 40),
        end: at(16, 8, 52),
      },
      {
        id: 'admitted',
        group: 'queue',
        lane: 'Issue',
        kind: 'event',
        name: 'Admitted',
        start: at(16, 8, 52),
      },
      {
        id: 'a1-lead',
        group: 'a1',
        lane: A1,
        kind: 'work',
        name: 'Lead session',
        start: at(16, 8, 55),
        end: at(16, 9, 40),
        session: [14, 520, 1.8],
      },
      {
        id: 'a1-review',
        group: 'a1',
        lane: A1,
        kind: 'work',
        name: 'Review',
        detail: 'Waived: docs-only change',
        start: at(16, 9, 42),
        end: at(16, 9, 45),
        session: [0, 0, 0],
      },
      {
        id: 'a1-ci',
        group: 'a1',
        lane: A1,
        kind: 'ci',
        name: 'CI run',
        start: at(16, 9, 45),
        end: at(16, 10, 8),
      },
      {
        id: 'a1-window',
        group: 'a1',
        lane: A1,
        kind: 'hold',
        name: 'Merge window',
        start: at(16, 10, 8),
        end: at(16, 10, 30),
      },
      {
        id: 'shipped',
        group: 'a1',
        lane: 'Issue',
        kind: 'event',
        name: 'Shipped',
        start: at(16, 10, 31),
      },
      {
        id: 'verified',
        group: 'a1',
        lane: 'Issue',
        kind: 'event',
        name: 'Verified',
        start: at(16, 10, 49),
      },
    ] satisfies Draft[]
  ).map(step),
}

/** The extreme fixture: attempt 2 is still blocked nine days on, so one wait outweighs every other step 100 to 1. */
const STALLED_NOW = at(25, 10, 0)
const STALLED: IssueRecord = {
  id: '1842',
  title: 'Backfill export slugs',
  filedAt: at(16, 8, 40),
  endAt: STALLED_NOW,
  shippedAt: null,
  medianMs: MEDIAN_MS,
  attempts: ATTEMPTS.slice(0, 2),
  steps: (
    [
      FILED,
      ...FIRST_TWO,
      {
        id: 'a2-blocked',
        group: 'a2',
        lane: A2,
        kind: 'blocked',
        name: 'Blocked on owner',
        detail: BLOCK_REASON,
        start: at(16, 15, 20),
        end: STALLED_NOW,
      },
    ] satisfies Draft[]
  ).map(step),
}

/** The fixture a `?fixture=` name picks; an unknown name is the rest case. */
export function issueNamed(name: string | undefined): IssueRecord {
  if (name === 'clean') return CLEAN
  if (name === 'stalled') return STALLED
  return REST
}

/** `16 h 45 m`, `49 m`, `8 d 21 h`: the unit pair that reads at the size. */
export function span(ms: number): string {
  const total = Math.round(ms / MINUTE_MS)
  if (total < 60) return `${total} m`
  const h = Math.floor(total / 60)
  if (h >= 48) return `${Math.floor(h / 24)} d ${h % 24} h`
  const m = total % 60
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

export type PartKind = Exclude<Kind, 'event'>

export type TimeRow = {
  key: Group
  label: string
  outcome: string
  minutes: number
  parts: Record<PartKind, number>
}

const blank = (): Record<PartKind, number> => ({ work: 0, owner: 0, ci: 0, hold: 0, blocked: 0 })

/** Minutes per kind for the time before attempt 1 and for each attempt: where the time went. */
export function timeRows(issue: IssueRecord): TimeRow[] {
  const rows: TimeRow[] = [
    {
      key: 'queue',
      label: 'Before attempt 1',
      outcome: 'Queued for admission',
      minutes: 0,
      parts: blank(),
    },
    ...issue.attempts.map((a) => ({
      key: a.group,
      label: a.label,
      outcome: a.outcome,
      minutes: 0,
      parts: blank(),
    })),
  ]
  for (const s of issue.steps) {
    const row = rows.find((r) => r.key === s.group)
    if (row === undefined || s.end === null || s.kind === 'event') continue
    const minutes = Math.round((s.end.getTime() - s.start.getTime()) / MINUTE_MS)
    row.parts[s.kind] += minutes
    row.minutes += minutes
  }
  return rows
}
