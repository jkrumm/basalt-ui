/** The reading log for expr-n25: 25 books, a yearly goal, dated and deterministic (no clock, no random). */

export type BookStatus = 'want' | 'reading' | 'read'

export type Book = {
  id: string
  title: string
  author: string
  status: BookStatus
  pages: number
  pagesRead: number
  /** ISO day, or null for a book not started. */
  started: string | null
  /** ISO day of the last page read: the finish day of a read book. */
  lastRead: string | null
  finished: string | null
}

export type ReadingLog = { goal: number; today: Date; books: readonly Book[] }

/** The fixed "today" of every fixture, so a shot is the same shot. */
const TODAY = new Date(Date.UTC(2026, 10, 17))

/** A started book with no page in this many days has stalled. */
export const STALL_DAYS = 21

const FINISHED: readonly (readonly [string, string, string, number, string, string])[] = [
  ['Piranesi', 'Susanna Clarke', '2026-01-03', 272, '2026-01-12', 'f1'],
  ['The Overstory', 'Richard Powers', '2026-01-13', 502, '2026-01-29', 'f2'],
  ['Braiding Sweetgrass', 'Robin Wall Kimmerer', '2026-02-01', 391, '2026-02-14', 'f3'],
  ['Station Eleven', 'Emily St. John Mandel', '2026-02-16', 333, '2026-03-02', 'f4'],
  ['Pachinko', 'Min Jin Lee', '2026-03-03', 496, '2026-03-21', 'f5'],
  ['Klara and the Sun', 'Kazuo Ishiguro', '2026-03-23', 303, '2026-04-05', 'f6'],
  ['The Dispossessed', 'Ursula K. Le Guin', '2026-04-06', 387, '2026-04-22', 'f7'],
  ['Hamnet', "Maggie O'Farrell", '2026-04-26', 305, '2026-05-09', 'f8'],
  ['The Remains of the Day', 'Kazuo Ishiguro', '2026-05-12', 258, '2026-05-30', 'f9'],
  ['Gilead', 'Marilynne Robinson', '2026-06-02', 247, '2026-06-14', 'f10'],
  ['A Gentleman in Moscow', 'Amor Towles', '2026-06-15', 462, '2026-07-03', 'f11'],
  ['The Left Hand of Darkness', 'Ursula K. Le Guin', '2026-07-05', 304, '2026-07-19', 'f12'],
  ['Circe', 'Madeline Miller', '2026-07-21', 393, '2026-08-02', 'f13'],
  ['Stoner', 'John Williams', '2026-08-04', 278, '2026-08-24', 'f14'],
  ['Small Things Like These', 'Claire Keegan', '2026-09-01', 116, '2026-09-13', 'f15'],
  ['The Buried Giant', 'Kazuo Ishiguro', '2026-09-14', 345, '2026-09-27', 'f16'],
  ['Rabbit, Run', 'John Updike', '2026-09-30', 255, '2026-10-09', 'f17'],
  ['Wolf Hall', 'Hilary Mantel', '2026-10-10', 604, '2026-10-21', 'f18'],
]

/** Extra finishes that carry the `done` fixture past the goal. */
const EXTRA_FINISHED: typeof FINISHED = [
  ['Middlemarch', 'George Eliot', '2026-02-20', 880, '2026-03-15', 'x1'],
  ['Lincoln in the Bardo', 'George Saunders', '2026-04-01', 343, '2026-04-12', 'x2'],
  ['Annihilation', 'Jeff VanderMeer', '2026-05-01', 195, '2026-05-06', 'x3'],
  ['Normal People', 'Sally Rooney', '2026-06-20', 266, '2026-06-27', 'x4'],
  ['The Remains', 'Mary Doria Russell', '2026-08-10', 431, '2026-08-19', 'x5'],
  ['Foster', 'Claire Keegan', '2026-10-22', 88, '2026-10-24', 'x6'],
  ['Convenience Store Woman', 'Sayaka Murata', '2026-10-25', 163, '2026-10-27', 'x7'],
  ['Giovanni’s Room', 'James Baldwin', '2026-11-03', 169, '2026-11-08', 'x8'],
]

/** `[title, author, pages, pagesRead, started, lastRead]`: three untouched for weeks, two live. */
const READING: readonly (readonly [string, string, number, number, string, string, string])[] = [
  ['Gravity’s Rainbow', 'Thomas Pynchon', 776, 96, '2026-09-12', '2026-09-29', 'r1'],
  ['The Years', 'Annie Ernaux', 240, 118, '2026-10-01', '2026-10-14', 'r2'],
  ['Blood Meridian', 'Cormac McCarthy', 337, 61, '2026-10-20', '2026-10-26', 'r3'],
  ['Demon Copperhead', 'Barbara Kingsolver', 548, 304, '2026-10-28', '2026-11-12', 'r4'],
  ['Sea of Tranquility', 'Emily St. John Mandel', 255, 211, '2026-11-09', '2026-11-16', 'r5'],
]

const WANT: readonly (readonly [string, string, number, string])[] = [
  ['The Rings of Saturn', 'W. G. Sebald', 296, 'w1'],
  ['Austerlitz', 'W. G. Sebald', 298, 'w2'],
]

const finishedBook = ([title, author, start, pages, end, id]: (typeof FINISHED)[number]): Book => ({
  id,
  title,
  author,
  status: 'read',
  pages,
  pagesRead: pages,
  started: start,
  lastRead: end,
  finished: end,
})

const readingBook = ([
  title,
  author,
  pages,
  pagesRead,
  start,
  last,
  id,
]: (typeof READING)[number]): Book => ({
  id,
  title,
  author,
  status: 'reading',
  pages,
  pagesRead,
  started: start,
  lastRead: last,
  finished: null,
})

const wantBook = ([title, author, pages, id]: (typeof WANT)[number]): Book => ({
  id,
  title,
  author,
  status: 'want',
  pages,
  pagesRead: 0,
  started: null,
  lastRead: null,
  finished: null,
})

/**
 * The reading log for a `?fixture=` name.
 * - rest (default): 18 of 24 books read, 3 behind an even pace, 3 of 5 started books stalled.
 * - `zero`: nothing finished all year, every started book untouched for weeks.
 * - `done`: 26 books read, past the goal of 24; the two started books are live.
 */
export function readingLog(fixture: string | undefined): ReadingLog {
  const want = WANT.map(wantBook)
  if (fixture === 'zero') {
    const stale = READING.map((r): (typeof READING)[number] => [
      r[0],
      r[1],
      r[2],
      r[3],
      r[4],
      '2026-10-02',
      r[6],
    ])
    return { goal: 24, today: TODAY, books: [...stale.map(readingBook), ...want] }
  }
  if (fixture === 'done') {
    return {
      goal: 24,
      today: TODAY,
      books: [
        ...[...FINISHED, ...EXTRA_FINISHED].map(finishedBook),
        ...READING.slice(3).map(readingBook),
        ...want,
      ],
    }
  }
  return {
    goal: 24,
    today: TODAY,
    books: [...FINISHED.map(finishedBook), ...READING.map(readingBook), ...want],
  }
}
