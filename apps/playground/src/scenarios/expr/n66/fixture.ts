/** The reading year of scenario expr-n66: seeded, so every build and every shot draws the same books. */

export type Book = {
  id: string
  title: string
  /** `null` is a book with no page count. */
  pages: number | null
  seconds: number
  finished: Date
  sitting: boolean
}

export type BacklogBook = { id: string; title: string; genre: string }

export type InProgress = { id: string; title: string; page: number; pages: number }

export type ReadingYear = {
  books: readonly Book[]
  backlog: readonly BacklogBook[]
  reading: readonly InProgress[]
}

export type Genre = { name: string; count: number }

const GENRES = ['Fantasy', 'Crime', 'Sci-fi', 'History', 'Essays', 'Other'] as const

const TITLES = [
  'The Salt Road',
  'A Winter of Small Fires',
  'Ledger of Tides',
  'Quiet Machines',
  'The Cartographer’s Daughter',
  'Ash and Orchard',
  'Notes from the Harbour',
  'The Long Index',
  'The Lighthouse Letter',
  'Paper Kingdoms',
  'What the Ferryman Knew',
  'Glass Season',
  'The Lamp-Lighter’s Case',
  'Salt, Smoke and Iron',
  'Hollow Meridian',
  'The Weather Archive',
  'A Map of Small Hours',
  'Orchard of Wires',
  'The Last Telegram',
  'Winter Under Glass',
  'The Tin Cathedral',
  'Songs for a Slow River',
  'Borrowed Light',
  'The Harbour Clerk',
] as const

const WORDS_A = ['Silent', 'Copper', 'Northern', 'Hidden', 'Paper', 'Bitter', 'Gilded', 'Distant']
const WORDS_B = ['Orchard', 'Signal', 'Harbour', 'Archive', 'Lantern', 'Crown', 'Station', 'Garden']

const SITTING_INDEX = 8
const NO_PAGES_INDEX = 10
const SLOW_INDEX = 3
const EXTREME_INDEX = 17
const DAY_MS = 86_400_000

/** A small seeded generator (mulberry32): the same seed always gives the same sequence. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeBooks(): Book[] {
  const next = seeded(66)
  const start = Date.UTC(2026, 0, 7)
  return TITLES.map((title, i) => {
    const finished = new Date(start + Math.round((i * 13.6 + next() * 6 - 3) * DAY_MS))
    const base = i < 12 ? 31 : 38
    const pace = Math.min(56, Math.max(18, base + (next() - 0.5) * 18))
    const pages = Math.round((180 + next() * 420) / 4) * 4
    const id = `book-${String(i + 1).padStart(2, '0')}`
    if (i === SITTING_INDEX) {
      return { id, title, pages: 112, seconds: 6480, finished, sitting: true }
    }
    if (i === NO_PAGES_INDEX) {
      return { id, title, pages: null, seconds: 9 * 3600 + 12 * 60, finished, sitting: false }
    }
    if (i === SLOW_INDEX) {
      return {
        id,
        title,
        pages: 540,
        seconds: Math.round((540 / 15.5) * 3600),
        finished,
        sitting: false,
      }
    }
    return {
      id,
      title,
      pages,
      seconds: Math.round((pages / pace) * 3600),
      finished,
      sitting: false,
    }
  })
}

function makeBacklog(counts: readonly number[]): BacklogBook[] {
  const next = seeded(660)
  const rows: BacklogBook[] = []
  GENRES.forEach((genre, g) => {
    for (let k = 0; k < (counts[g] ?? 0); k += 1) {
      const a = WORDS_A[Math.floor(next() * WORDS_A.length)] ?? ''
      const b = WORDS_B[Math.floor(next() * WORDS_B.length)] ?? ''
      rows.push({
        id: `backlog-${String(rows.length + 1).padStart(2, '0')}`,
        title: `${a} ${b}`,
        genre,
      })
    }
  })
  return rows
}

const READING: readonly InProgress[] = [
  { id: 'reading-1', title: 'The Orchard Ledger', page: 187, pages: 301 },
  { id: 'reading-2', title: 'Field Notes on Weather', page: 41, pages: 232 },
]

const BASE_COUNTS = [19, 14, 11, 8, 5, 3]
const EXTREME_COUNTS = [51, 3, 2, 2, 1, 1]
const IDLE_COUNTS = [21, 15, 12, 8, 0, 4]

export const EMPTY_YEAR: ReadingYear = { books: [], backlog: [], reading: [] }

/** The year a `?fixture=` name asks for; an unknown name draws the base year. */
export function yearFor(fixture: string | undefined): ReadingYear {
  const books = makeBooks()
  if (fixture === 'extreme') {
    return {
      books: books.map((b, i) => (i === EXTREME_INDEX ? { ...b, pages: 128, seconds: 1380 } : b)),
      backlog: makeBacklog(EXTREME_COUNTS),
      reading: READING,
    }
  }
  if (fixture === 'idle') return { books, backlog: makeBacklog(IDLE_COUNTS), reading: [] }
  return { books, backlog: makeBacklog(BASE_COUNTS), reading: READING }
}

/** Pages per hour; `null` for a book with no page count or no reading time. */
export function paceOf(book: Book): number | null {
  if (book.pages === null || book.seconds <= 0) return null
  return book.pages / (book.seconds / 3600)
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((x, y) => x - y)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return hi
  return ((sorted[mid - 1] ?? hi) + hi) / 2
}

export function genresOf(backlog: readonly BacklogBook[]): Genre[] {
  return GENRES.map((name) => ({
    name,
    count: backlog.filter((b) => b.genre === name).length,
  })).sort((x, y) => {
    if (x.name === 'Other') return 1
    if (y.name === 'Other') return -1
    return y.count - x.count
  })
}
