/** The study library behind scenario expr-n81: a seeded, deterministic fixture. */

export type Status = 'done' | 'learning' | 'notStarted'

export type Item = {
  id: string
  name: string
  status: Status
  /** 1 to 5, or null: not rated. */
  confidence: number | null
  /** A graded review exists; 4 items have one and no confidence. */
  graded: boolean
}
export type Session = { day: string; itemId: string }
export type Review = { itemId: string; dueOn: string }
export type Study = {
  today: string
  days: readonly string[]
  items: readonly Item[]
  sessions: readonly Session[]
  reviews: readonly Review[]
}

const TODAY = '2026-11-21'
const WINDOW_DAYS = 30
const SESSIONS = 60
const TOP_SESSIONS = 25
const DAY_MS = 86_400_000

const NAMES = [
  'Intervals',
  'Major scales',
  'Minor scales',
  'Triads',
  'Seventh chords',
  'Key signatures',
  'Circle of fifths',
  'Time signatures',
  'Note values',
  'Rests',
  'Dynamics',
  'Articulation',
  'Chord inversions',
  'Voice leading',
  'Cadences',
  'Modes',
  'Pentatonic scales',
  'Blues scale',
  'Transposition',
  'Syncopation',
  'Tuplets',
  'Compound meter',
  'Harmonic minor',
  'Melodic minor',
  'Secondary dominants',
  'Borrowed chords',
  'Suspensions',
  'Passing tones',
  'Neighbour tones',
  'Counterpoint',
  'Form and phrase',
  'Sonata form',
  'Rondo form',
  'Twelve-bar blues',
  'Chord symbols',
  'Roman numerals',
  'Figured bass',
  'Ear training',
  'Sight reading',
  'Polyrhythm',
]

/** Per status: the confidence of each item in turn; null is a graded review with no confidence. */
const DONE: readonly (number | null)[] = [4, 4, 4, 3, 3, 3, 3, 2, 2, 1, null, null]
const LEARNING: readonly (number | null)[] = [3, 3, 2, 2, 2, 1, 1, null, null]
const NOT_STARTED = 19

/** An index of the learning items holds the most sessions. */
const TOP_NAME = 'Voice leading'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const shiftDay = (day: string, by: number): string => isoDay(Date.parse(day) + by * DAY_MS)

const dayKeys = (): string[] =>
  Array.from({ length: WINDOW_DAYS }, (_, i) => shiftDay(TODAY, i - (WINDOW_DAYS - 1)))

function makeItems(): Item[] {
  const rows: Omit<Item, 'id' | 'name'>[] = [
    ...DONE.map((confidence) => ({ status: 'done' as const, confidence, graded: true })),
    ...LEARNING.map((confidence) => ({ status: 'learning' as const, confidence, graded: true })),
    ...Array.from({ length: NOT_STARTED }, () => ({
      status: 'notStarted' as const,
      confidence: null,
      graded: false,
    })),
  ]
  return rows.map((row, i) => ({
    ...row,
    id: `i${String(i + 1).padStart(2, '0')}`,
    name: NAMES[i] ?? `Item ${i + 1}`,
  }))
}

function makeSessions(items: readonly Item[], days: readonly string[]): Session[] {
  const rand = mulberry32(81)
  const started = items.filter((i) => i.status !== 'notStarted')
  const top = started.find((i) => i.name === TOP_NAME)
  if (top === undefined) return []
  const others = started.filter((i) => i.id !== top.id)
  // Later days weigh more, so practice builds up over the window.
  const weights = days.map((_, i) => 0.35 + (i / (days.length - 1)) * 1.65)
  const total = weights.reduce((sum, w) => sum + w, 0)
  const pickDay = (): string => {
    let at = rand() * total
    for (const [i, w] of weights.entries()) {
      at -= w
      if (at <= 0) return days[i] ?? TODAY
    }
    return days.at(-1) ?? TODAY
  }
  const order = Array.from({ length: SESSIONS }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const a = order[i] ?? 0
    order[i] = order[j] ?? 0
    order[j] = a
  }
  const isTop = new Set(order.slice(0, TOP_SESSIONS))
  return Array.from({ length: SESSIONS }, (_, k) => {
    const other = others[Math.floor(rand() * others.length)] ?? top
    return { day: pickDay(), itemId: isTop.has(k) ? top.id : other.id }
  }).sort((a, b) => a.day.localeCompare(b.day))
}

function makeBusy(): Study {
  const items = makeItems()
  const days = dayKeys()
  const named = (name: string): string => items.find((i) => i.name === name)?.id ?? ''
  return {
    today: TODAY,
    days,
    items,
    sessions: makeSessions(items, days),
    // Two reviews past due and one not yet due.
    reviews: [
      { itemId: named('Triads'), dueOn: shiftDay(TODAY, -4) },
      { itemId: named('Cadences'), dueOn: shiftDay(TODAY, -2) },
      { itemId: named('Modes'), dueOn: shiftDay(TODAY, 3) },
    ],
  }
}

/** A fresh library: every item not started, no session, no review. */
function makeFresh(): Study {
  const items = makeItems().map((i) => ({
    ...i,
    status: 'notStarted' as const,
    confidence: null,
    graded: false,
  }))
  return { today: TODAY, days: dayKeys(), items, sessions: [], reviews: [] }
}

const BUSY: Study = makeBusy()
const FRESH: Study = makeFresh()

/** `?fixture=` names this scenario knows. */
export function studyFor(fixture: string | undefined, empty: boolean): Study {
  return empty || fixture === 'fresh' ? FRESH : BUSY
}
