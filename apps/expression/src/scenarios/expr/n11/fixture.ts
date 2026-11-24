/** Seeded course catalogue for expr-n11: about 20 courses, most not started. */

export type Course = {
  id: string
  title: string
  /** 1 (intro) to 5 (expert). */
  difficulty: 1 | 2 | 3 | 4 | 5
  lessonsDone: number
  lessonsTotal: number
  /** Share of lessons done, 0 to 100: derived once so the meter column and the sort agree. */
  progress: number
}

type Seed = readonly [title: string, difficulty: Course['difficulty'], done: number, total: number]

const CATALOGUE: readonly Seed[] = [
  ['Intro to Spreadsheets', 1, 12, 12],
  ['Typography Basics', 1, 0, 8],
  ['Plain-Language Writing', 1, 5, 14],
  ['Version Control in Practice', 2, 9, 18],
  ['Data Cleaning with SQL', 2, 0, 16],
  ['Sketching for Designers', 2, 0, 10],
  ['Statistics Without Tears', 3, 7, 24],
  ['Web Accessibility', 3, 0, 20],
  ['Product Analytics', 3, 0, 15],
  ['Negotiation Skills', 3, 0, 9],
  ['Systems Thinking', 3, 0, 12],
  ['Database Design', 4, 3, 30],
  ['Distributed Systems', 4, 0, 36],
  ['Machine Learning Foundations', 4, 0, 40],
  ['Compilers and Interpreters', 5, 0, 48],
  ['Cryptography Engineering', 5, 0, 32],
  ['Advanced Econometrics', 5, 0, 26],
  ['Operating System Internals', 5, 0, 44],
  ['Embedded Firmware', 4, 0, 22],
  ['Technical Leadership', 2, 0, 11],
]

const toCourse = ([title, difficulty, lessonsDone, lessonsTotal]: Seed, index: number): Course => ({
  id: `course-${index + 1}`,
  title,
  difficulty,
  lessonsDone,
  lessonsTotal,
  // one lesson of 240 still reads as started, never 0
  progress: lessonsDone === 0 ? 0 : Math.max(1, Math.round((lessonsDone / lessonsTotal) * 100)),
})

/** Started courses first by progress, then the rest by difficulty: the order a learner reads the page in. */
function byRelevance(rows: readonly Course[]): Course[] {
  return rows.toSorted(
    (a, b) =>
      Number(b.lessonsDone > 0) - Number(a.lessonsDone > 0) ||
      b.progress - a.progress ||
      a.difficulty - b.difficulty ||
      a.title.localeCompare(b.title),
  )
}

const REST = byRelevance(CATALOGUE.map(toCourse))

/** Nothing started: every `lessonsDone` is 0. */
const NONE_STARTED = byRelevance(CATALOGUE.map(([t, d, , n], i) => toCourse([t, d, 0, n], i)))

/** The extremes: one finished course, one barely begun (1 of 240), one with a single lesson. */
const EXTREMES = byRelevance(
  CATALOGUE.map((seed, i) => {
    const [title, difficulty, , total] = seed
    if (i === 0) return toCourse([title, difficulty, total, total], i)
    if (i === 14) return toCourse([title, difficulty, 1, 240], i)
    if (i === 1) return toCourse([title, difficulty, 0, 1], i)
    return toCourse(seed, i)
  }),
)

const FIXTURES = {
  'none-started': NONE_STARTED,
  extremes: EXTREMES,
} as const satisfies Record<string, readonly Course[]>

export function coursesFor(fixture: string | undefined): readonly Course[] {
  if (fixture === 'none-started') return FIXTURES['none-started']
  if (fixture === 'extremes') return FIXTURES.extremes
  return REST
}
