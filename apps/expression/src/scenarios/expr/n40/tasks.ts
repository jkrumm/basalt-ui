/**
 * Task list fixture (scenario expr-n40): about 60 open tasks across five lists, tasks completed per
 * day for 30 days, one list with nothing due and a few tasks more than a month overdue. Every date
 * is a UTC day against a fixed today, and the creation dates come from a seeded generator, so a
 * shot is the same on every run.
 */

export const DAY = 86_400_000
/** Today at 00:00 UTC; the fixture's clock. */
export const TODAY = Date.UTC(2026, 10, 17)

export const LISTS = ['Work', 'Home', 'Errands', 'Admin', 'Reading'] as const
export type ListName = (typeof LISTS)[number]

export type TaskState = 'overdue' | 'today' | 'later' | 'none'

export type Task = {
  id: string
  title: string
  list: ListName
  /** 1 is the most urgent. */
  level: 1 | 2 | 3
  priority: string
  /** The due day as epoch ms, or null for a task with no date. */
  due: number | null
  created: number
  state: TaskState
  /** Whole days past the due date, for an overdue task only. */
  daysLate: number | null
  /** Tasks with the same due day stack: this one is the nth, from 1. */
  stack: number
}
export type DatedTask = Task & { due: number }
export const isDated = (t: Task): t is DatedTask => t.due !== null

/** A name of the `?fixture=` param: the rest state when absent or unknown. */
export type Variant = 'clear' | 'backlog' | undefined
export const variantOf = (fixture: string | undefined): Variant =>
  fixture === 'clear' || fixture === 'backlog' ? fixture : undefined

type Raw = readonly [title: string, list: ListName, level: 1 | 2 | 3, dueInDays: number | null]

const RAW: readonly Raw[] = [
  ['Reply to the audit questions', 'Work', 1, -47],
  ['Send the Q3 invoice batch', 'Work', 1, -4],
  ['Review the migration PR', 'Work', 1, 0],
  ['Draft the onboarding doc', 'Work', 2, -12],
  ['Book the offsite venue', 'Work', 2, 3],
  ['Update the runbook', 'Work', 3, 9],
  ['Prepare the sprint demo', 'Work', 2, 0],
  ['Reconcile the vendor invoices', 'Work', 2, -2],
  ['Write the incident summary', 'Work', 1, -1],
  ['Plan the Q1 roadmap', 'Work', 2, 14],
  ['Renew the staging certificates', 'Work', 1, 5],
  ['Collect interview scorecards', 'Work', 3, 2],
  ['Archive the old dashboards', 'Work', 3, null],
  ['Clean up the feature flags', 'Work', 3, 21],
  ['Refresh the team wiki', 'Work', 3, null],
  ['Fix the bathroom tap', 'Home', 2, -41],
  ['Service the boiler', 'Home', 1, -9],
  ['Repaint the hallway', 'Home', 3, 17],
  ['Replace the smoke alarm batteries', 'Home', 1, 0],
  ['Sort the cellar', 'Home', 3, null],
  ['Clean the gutters', 'Home', 2, -6],
  ['Order the kitchen filters', 'Home', 3, 6],
  ['Bleed the radiators', 'Home', 2, 1],
  ['Hang the shelves in the study', 'Home', 3, 12],
  ['Check the window seals', 'Home', 3, null],
  ['Book the chimney sweep', 'Home', 2, -3],
  ['Return the parcel to the depot', 'Errands', 2, -38],
  ['Collect the dry cleaning', 'Errands', 3, -2],
  ['Post the signed contract', 'Errands', 1, 0],
  ['Buy a birthday card', 'Errands', 2, 0],
  ['Pick up the prescription', 'Errands', 1, 1],
  ['Renew the bike lock', 'Errands', 3, 8],
  ['Drop off the donations', 'Errands', 3, null],
  ['Get passport photos', 'Errands', 2, -7],
  ['Buy printer paper', 'Errands', 3, 2],
  ['Collect the key copies', 'Errands', 3, 4],
  ['Return the library books', 'Errands', 2, -1],
  ['Pick up the tailored jacket', 'Errands', 3, 10],
  ['Buy a plant pot', 'Errands', 3, null],
  ['Exchange the shoes', 'Errands', 3, -15],
  ['Buy stamps', 'Errands', 3, 3],
  ['Order the replacement charger', 'Errands', 2, 5],
  ['Pick up the repaired watch', 'Errands', 3, 13],
  ['File the expense claim', 'Admin', 2, -22],
  ['Renew the car insurance', 'Admin', 1, 7],
  ['Submit the tax receipts', 'Admin', 1, 20],
  ['Update the address with the bank', 'Admin', 3, null],
  ['Cancel the unused subscriptions', 'Admin', 3, null],
  ['Book the dentist', 'Admin', 2, -5],
  ['Pay the parking fine', 'Admin', 1, 0],
  ['Renew the library card', 'Admin', 3, 28],
  ['Back up the photo archive', 'Admin', 3, null],
  ['Sign the lease addendum', 'Admin', 1, 11],
  ['Read the Rust async chapter', 'Reading', 3, null],
  ['Finish the compilers book', 'Reading', 3, null],
  ['Skim the design systems essay', 'Reading', 3, null],
  ['Read the climate report summary', 'Reading', 3, null],
  ['Catch up on the newsletter backlog', 'Reading', 3, null],
  ['Read the paper on CRDTs', 'Reading', 3, null],
  ['Finish the field guide', 'Reading', 3, null],
]

/** Days back from today within which each list's tasks were added: Errands keeps adding, Reading stopped. */
const ADDED_WITHIN: Record<ListName, readonly [recent: number, oldest: number]> = {
  Work: [10, 84],
  Home: [28, 84],
  Errands: [0, 70],
  Admin: [14, 84],
  Reading: [35, 84],
}

/** Mulberry32: a small seeded generator, so the creation dates never change. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** `clear` moves every date that is due or late into the next fortnight; `backlog` lets half of what is ahead slip and one task go 212 days. */
function dueIn(raw: Raw, index: number, variant: Variant): number | null {
  const days = raw[3]
  if (days === null) return null
  if (variant === 'clear') return days <= 0 ? 6 + (index % 8) : days
  if (variant !== 'backlog') return days
  if (index === 0) return -212
  return days > 0 && index % 2 === 0 ? -(days + 20 + (index % 17)) : days
}

function stateOf(due: number | null): TaskState {
  if (due === null) return 'none'
  if (due < TODAY) return 'overdue'
  return due === TODAY ? 'today' : 'later'
}

/** The open tasks, in reading order: by due day, the most urgent first, no date last. */
export function tasksOf(variant: Variant): readonly Task[] {
  const random = seeded(40)
  const made = RAW.map((raw, index): Task => {
    const [title, list, level] = raw
    const days = dueIn(raw, index, variant)
    const due = days === null ? null : TODAY + days * DAY
    const [recent, oldest] = ADDED_WITHIN[list]
    const skew = list === 'Errands' ? 1.6 : 1
    let ago = Math.round(recent + (oldest - recent) * random() ** skew)
    if (days !== null && days < 0) ago = Math.max(ago, -days + 1 + Math.floor(random() * 9))
    const state = stateOf(due)
    return {
      id: `t${String(index + 1).padStart(2, '0')}`,
      title,
      list,
      level,
      priority: `P${level}`,
      due,
      created: TODAY - ago * DAY,
      state,
      daysLate: due !== null && state === 'overdue' ? Math.round((TODAY - due) / DAY) : null,
      stack: 0,
    }
  })
  const order = (t: Task): number => t.due ?? Number.POSITIVE_INFINITY
  const sorted = made.toSorted((a, b) => {
    if (order(a) !== order(b)) return order(a) < order(b) ? -1 : 1
    return a.level - b.level || a.title.localeCompare(b.title)
  })
  // cycle-expression-10: a dot series has no stacking of equal x, so the nth task of a due day is the dot's y.
  const seen = new Map<number, number>()
  return sorted.map((t) => {
    if (t.due === null) return t
    const n = (seen.get(t.due) ?? 0) + 1
    seen.set(t.due, n)
    return { ...t, stack: n }
  })
}

export type Done = { day: number; done: number }

/** Tasks completed on each of the 30 days up to yesterday: quiet weekends, one clear-out day of 15. */
export function completedPerDay(): readonly Done[] {
  const random = seeded(4040)
  return Array.from({ length: 30 }, (_, i) => {
    const ago = 30 - i
    const day = TODAY - ago * DAY
    const weekend = [0, 6].includes(new Date(day).getUTCDay())
    const done = weekend ? (random() < 0.6 ? 0 : 1) : 2 + Math.floor(random() * 6)
    return { day, done: ago === 13 ? 15 : done }
  })
}

export type WeekPoint = { at: number; counts: Record<ListName, number> }

/** Weekly points over 12 weeks to today: how many still-open tasks each list had by the day they were added. */
export function backlogByWeek(tasks: readonly Task[]): readonly WeekPoint[] {
  return Array.from({ length: 13 }, (_, i) => {
    const at = TODAY - (12 - i) * 7 * DAY
    const countOf = (list: ListName): number =>
      tasks.filter((t) => t.list === list && t.created <= at).length
    return {
      at,
      counts: {
        Work: countOf('Work'),
        Home: countOf('Home'),
        Errands: countOf('Errands'),
        Admin: countOf('Admin'),
        Reading: countOf('Reading'),
      },
    }
  })
}

export type Summary = {
  open: number
  overdue: number
  overOneMonth: number
  /** Days the oldest overdue task is late. */
  oldestLate: number
  overdueFirst: number
  today: number
  todayFirst: number
  tomorrow: number
  nextWeek: number
  afterNextWeek: number
  undated: number
  /** Lists whose tasks all have no due date. */
  listsWithNothingDue: readonly ListName[]
}

const countWhere = (tasks: readonly Task[], keep: (t: Task) => boolean): number =>
  tasks.filter(keep).length

export function summaryOf(tasks: readonly Task[]): Summary {
  const daysAhead = (t: Task): number => (t.due === null ? Number.NaN : (t.due - TODAY) / DAY)
  return {
    open: tasks.length,
    overdue: countWhere(tasks, (t) => t.state === 'overdue'),
    overOneMonth: countWhere(tasks, (t) => (t.daysLate ?? 0) > 30),
    oldestLate: Math.max(0, ...tasks.map((t) => t.daysLate ?? 0)),
    overdueFirst: countWhere(tasks, (t) => t.state === 'overdue' && t.level === 1),
    today: countWhere(tasks, (t) => t.state === 'today'),
    todayFirst: countWhere(tasks, (t) => t.state === 'today' && t.level === 1),
    tomorrow: countWhere(tasks, (t) => daysAhead(t) === 1),
    nextWeek: countWhere(tasks, (t) => daysAhead(t) >= 1 && daysAhead(t) <= 7),
    afterNextWeek: countWhere(tasks, (t) => daysAhead(t) > 7),
    undated: countWhere(tasks, (t) => t.due === null),
    listsWithNothingDue:
      tasks.length === 0
        ? []
        : LISTS.filter((list) => tasks.every((t) => t.list !== list || t.due === null)),
  }
}

export type Pace = {
  /** Mean tasks done a day over the 30 days. */
  perDay: number
  /** The last 15 days against the 15 before, per day. */
  change: number
  idleDays: number
  busiest: Done
}

export function paceOf(done: readonly Done[]): Pace {
  const mean = (rows: readonly Done[]): number =>
    rows.reduce((sum, d) => sum + d.done, 0) / Math.max(1, rows.length)
  const busiest = done.reduce(
    (best, d) => (d.done > best.done ? d : best),
    done[0] ?? { day: TODAY, done: 0 },
  )
  return {
    perDay: mean(done),
    change: mean(done.slice(15)) - mean(done.slice(0, 15)),
    idleDays: done.filter((d) => d.done === 0).length,
    busiest,
  }
}

export type Leader = { list: ListName; now: number; gain: number }

/** The list that added the most still-open tasks over the last four weeks. */
export function leaderOf(weeks: readonly WeekPoint[]): Leader {
  const last = weeks.at(-1)
  const before = weeks.at(-5)
  if (last === undefined || before === undefined) return { list: LISTS[0], now: 0, gain: 0 }
  const gains = LISTS.map((list) => ({
    list,
    now: last.counts[list],
    gain: last.counts[list] - before.counts[list],
  }))
  return gains.reduce(
    (best, g) => (g.gain > best.gain ? g : best),
    gains[0] ?? { list: LISTS[0], now: 0, gain: 0 },
  )
}
