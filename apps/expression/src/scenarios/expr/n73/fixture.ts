/**
 * The review queue of one learner: about 500 items, a confidence step for each learned one, a due
 * date and an interval for every item that has started, and about 1,300 session timestamps. Seeded
 * and deterministic; `now` is a fixed instant, never the clock. Three variants by name: the default
 * (31 due, the slipped share just under 20 percent), `over` (52 due, the share past the limit) and
 * `clear` (nothing due, the next item two days away).
 */

export const DAY = 86_400_000
export const TODAY = Date.UTC(2026, 10, 20)

/** Confidence steps 0 to 5, in order. */
export const STEP_NAMES = ['Unrated', 'Forgotten', 'Shaky', 'Partial', 'Solid', 'Fluent'] as const
export const SLIPPED_STEPS: readonly number[] = [1, 2]
/** The limit the question names: the slipped share of learned items stays under it. */
export const SLIP_LIMIT = 0.2

export type ItemState = 'learned' | 'progress' | 'new'
export type Item = {
  id: string
  deck: string
  state: ItemState
  /** Confidence step of a learned item; `null` for one not yet learned. */
  step: number | null
  /** Due day (UTC midnight, epoch ms) of an item that has started; `null` for one not started. */
  due: number | null
  /** Days between reviews of an item that has started. */
  interval: number | null
}

export type FixtureName = 'default' | 'over' | 'clear'
export type Fixture = { items: readonly Item[]; sessions: readonly number[] }

const DECKS = ['Basics', 'Travel', 'Work', 'Grammar', 'Idioms', 'Numbers'] as const

type Plan = {
  /** Learned items per confidence step. */
  learned: readonly number[]
  /** Learned items due now per step. */
  dueLearned: readonly number[]
  /** Items in progress that are due now. */
  dueProgress: number
}

const PLANS: Record<FixtureName, Plan> = {
  default: {
    learned: [0, 9, 17, 41, 49, 24],
    dueLearned: [0, 6, 9, 5, 3, 1],
    dueProgress: 7,
  },
  over: {
    learned: [0, 21, 24, 38, 38, 19],
    dueLearned: [0, 16, 12, 7, 4, 1],
    dueProgress: 12,
  },
  clear: {
    learned: [0, 9, 17, 41, 49, 24],
    dueLearned: [0, 0, 0, 0, 0, 0],
    dueProgress: 0,
  },
}

const TOTAL = 500
const IN_PROGRESS = 46
/** The longest wait of the queue: one fluent item reviewed 180 days ago. */
const LONG_INTERVAL = 180
const SESSION_COUNT = 1300
/** The last session was this many days before `TODAY`. */
const IDLE_DAYS = 6

/** mulberry32: the same seed always draws the same stream. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a === undefined || b === undefined) continue
    out[i] = b
    out[j] = a
  }
  return out
}

const between = (rand: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rand() * (hi - lo + 1))

/** Review interval in days for a learned item: it grows with the step. */
function intervalFor(step: number, rand: () => number): number {
  if (step <= 1) return 1
  if (step === 2) return between(rand, 2, 3)
  if (step === 3) return between(rand, 4, 8)
  if (step === 4) return between(rand, 9, 30)
  return between(rand, 31, 90)
}

const idOf = (n: number): string => `Q-${String(n).padStart(4, '0')}`

function buildItems(plan: Plan): Item[] {
  const rand = seeded(73)
  const order = shuffled(
    Array.from({ length: TOTAL }, (_, i) => i + 1),
    rand,
  )
  const learnedCount = plan.learned.reduce((a, b) => a + b, 0)
  const learnedIds = order.slice(0, learnedCount)
  const progressIds = order.slice(learnedCount, learnedCount + IN_PROGRESS)
  const items = new Map<number, Item>()
  for (const n of order.slice(learnedCount + IN_PROGRESS)) {
    items.set(n, {
      id: idOf(n),
      deck: DECKS[n % DECKS.length] ?? 'Basics',
      state: 'new',
      step: null,
      due: null,
      interval: null,
    })
  }
  const deckOf = (n: number): string => DECKS[n % DECKS.length] ?? 'Basics'
  const wait = (): number => Math.floor(rand() * 6)

  let cursor = 0
  let longGiven = false
  plan.learned.forEach((count, step) => {
    const dueHere = plan.dueLearned[step] ?? 0
    for (let k = 0; k < count; k++) {
      const n = learnedIds[cursor++]
      if (n === undefined) continue
      const isDue = k < dueHere
      const long = step === 5 && !longGiven && (isDue || plan.dueProgress === 0)
      if (long) longGiven = true
      const interval = long ? LONG_INTERVAL : intervalFor(step, rand)
      const overdue = long ? 2 : wait()
      const ahead = long ? 47 : 1 + Math.floor(rand() * Math.min(interval, 40))
      items.set(n, {
        id: idOf(n),
        deck: deckOf(n),
        state: 'learned',
        step,
        due: TODAY + (isDue ? -overdue : ahead) * DAY,
        interval,
      })
    }
  })
  progressIds.forEach((n, k) => {
    const isDue = k < plan.dueProgress
    items.set(n, {
      id: idOf(n),
      deck: deckOf(n),
      state: 'progress',
      step: null,
      due: TODAY + (isDue ? -wait() : 1 + Math.floor(rand() * 3)) * DAY,
      interval: between(rand, 1, 3),
    })
  })
  return [...items.entries()].sort(([a], [b]) => a - b).map(([, item]) => item)
}

/** About 1,300 sessions over the year before the last one, which stands `IDLE_DAYS` before today. */
function buildSessions(): number[] {
  const rand = seeded(1300)
  const last = TODAY - IDLE_DAYS * DAY
  const out: number[] = [last + 18 * 3_600_000 + 30 * 60_000]
  while (out.length < SESSION_COUNT) {
    const day = last - Math.floor(rand() * 365) * DAY
    out.push(day + Math.floor(rand() * 24 * 60) * 60_000)
  }
  return out.sort((a, b) => a - b).filter((t) => t <= last + DAY - 1)
}

function fixtureOf(name: string | undefined): Fixture {
  const key: FixtureName = name === 'over' || name === 'clear' ? name : 'default'
  return { items: buildItems(PLANS[key]), sessions: buildSessions() }
}

const isDue = (item: Item): boolean => item.due !== null && item.due <= TODAY
const overdueDays = (item: Item): number =>
  item.due === null ? 0 : Math.max(0, Math.round((TODAY - item.due) / DAY))

export type StepRow = { step: number; name: string; count: number; due: number; slipped: boolean }

/** Learned items per confidence step, every step present, empty ones at 0. */
function stepRows(items: readonly Item[]): StepRow[] {
  return STEP_NAMES.map((name, step) => {
    const learned = items.filter((i) => i.step === step)
    return {
      step,
      name,
      count: learned.length,
      due: learned.filter(isDue).length,
      slipped: SLIPPED_STEPS.includes(step),
    }
  })
}

/** The due items, the longest overdue first. */
function dueItems(items: readonly Item[]): Item[] {
  return items
    .filter(isDue)
    .sort((a, b) => overdueDays(b) - overdueDays(a) || a.id.localeCompare(b.id))
}

/** Sessions per day for the `days` days ending today, oldest first. */
function sessionsPerDay(sessions: readonly number[], days: number): number[] {
  const counts = Array.from({ length: days }, () => 0)
  for (const t of sessions) {
    const idx = days - 1 - (TODAY / DAY - Math.floor(t / DAY))
    if (idx >= 0 && idx < days) counts[idx] = (counts[idx] ?? 0) + 1
  }
  return counts
}

/** Median whole days between two consecutive days that hold a session. */
export function usualGapDays(sessions: readonly number[]): number {
  const days = [...new Set(sessions.map((t) => Math.floor(t / DAY)))].sort((a, b) => a - b)
  const gaps = days.slice(1).map((d, i) => d - (days[i] ?? d))
  const sorted = gaps.sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export type DueRow = {
  id: string
  deck: string
  confidence: string
  step: number | null
  overdue: number
  interval: number
  due: number
}

/** Everything the page reads, built once per variant so every array keeps its identity across renders. */
export type View = Fixture & {
  steps: readonly StepRow[]
  dueRows: readonly DueRow[]
  daily: readonly { value: number; at: number }[]
}

const SESSION_WINDOW = 56
const VIEWS = new Map<string, View>()

/** The cached view of a variant name, or of the empty queue (a learner with nothing yet). */
export function viewOf(name: string | undefined, empty: boolean): View {
  const key = empty ? 'empty' : name === 'over' || name === 'clear' ? name : 'default'
  const hit = VIEWS.get(key)
  if (hit !== undefined) return hit
  const { items, sessions } = empty ? { items: [], sessions: [] } : fixtureOf(name)
  const view: View = {
    items,
    sessions,
    steps: stepRows(items),
    dueRows: dueItems(items).map((i) => ({
      id: i.id,
      deck: i.deck,
      confidence: i.step === null ? 'In progress' : (STEP_NAMES[i.step] ?? 'Unrated'),
      step: i.step,
      overdue: overdueDays(i),
      interval: i.interval ?? 0,
      due: i.due ?? TODAY,
    })),
    daily: sessionsPerDay(sessions, SESSION_WINDOW).map((value, i) => ({
      value,
      at: TODAY - (SESSION_WINDOW - 1 - i) * DAY,
    })),
  }
  VIEWS.set(key, view)
  return view
}
