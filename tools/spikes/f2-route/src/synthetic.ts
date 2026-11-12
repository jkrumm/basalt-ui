/**
 * Synthetic data and a fake transport. The shapes follow argo's strength endpoints (a `{ data,
 * error }` envelope, per-lift series, workouts with sets); every value is generated from a seeded
 * generator, nothing is copied from a consumer.
 */

export const EXERCISES = ['bench_press', 'deadlift', 'squat', 'pull_ups'] as const
export type ExerciseKey = (typeof EXERCISES)[number]

export const EXERCISE_LABEL: Record<ExerciseKey, string> = {
  bench_press: 'Bench press',
  deadlift: 'Deadlift',
  squat: 'Squat',
  pull_ups: 'Pull-ups',
}

export type Envelope<T> = { data: T; error: null } | { data: null; error: Error }

export type SetRow = {
  set_number: number
  set_type: 'warmup' | 'work' | 'amrap'
  weight_kg: number
  reps: number
}
export type WorkoutRow = {
  id: number
  date: string
  exercise_id: ExerciseKey
  sets: SetRow[]
  estimated_1rm: number | null
  total_volume: number
}
export type SparkRow = {
  exercise_id: ExerciseKey
  e1rm: number[]
  volume: number[]
  inol: number[]
  /** %/month, null when the lift has no fit. */
  vel: number | null
  /** No scored session in the trend window. */
  stale: boolean
}
export type HeroRow = { exercise_id: ExerciseKey; e1rm: number; deltaPct: number; sessions: number }

/** Mulberry32: the same stream on every run, so the shots are reproducible. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BASE: Record<ExerciseKey, number> = {
  bench_press: 92,
  deadlift: 148,
  squat: 124,
  pull_ups: 28,
}
const DAY = 86_400_000
const ANCHOR = Date.UTC(2026, 10, 9)

const iso = (t: number): string => new Date(t).toISOString().slice(0, 10)

function makeWorkouts(): WorkoutRow[] {
  const r = rng(7)
  const rows: WorkoutRow[] = []
  let id = 1
  for (let d = 0; d < 96; d += 3) {
    const exercise = EXERCISES[(d / 3) % EXERCISES.length] as ExerciseKey
    const top =
      Math.round((BASE[exercise] * (0.78 + (96 - d) / -400 + 0.2 + r() * 0.03)) / 2.5) * 2.5
    const sets: SetRow[] = [
      { set_number: 1, set_type: 'warmup', weight_kg: Math.round(top * 0.5), reps: 8 },
      ...Array.from({ length: 3 + Math.floor(r() * 2) }, (_, i) => ({
        set_number: i + 2,
        set_type: 'work' as const,
        weight_kg: top,
        reps: 5 - (i > 2 ? 1 : 0),
      })),
    ]
    const work = sets.filter((s) => s.set_type === 'work')
    const volume = work.reduce((a, s) => a + s.weight_kg * s.reps, 0)
    rows.push({
      id: id++,
      date: iso(ANCHOR - d * DAY),
      exercise_id: exercise,
      sets,
      estimated_1rm: Math.round(top * (1 + 5 / 30) * 10) / 10,
      total_volume: volume,
    })
  }
  return rows
}

const WORKOUTS = makeWorkouts()

function series(seed: number, n: number, start: number, slope: number, noise: number): number[] {
  const r = rng(seed)
  return Array.from(
    { length: n },
    (_, i) => Math.round((start + slope * i + (r() - 0.5) * noise) * 100) / 100,
  )
}

const SPARKS: SparkRow[] = EXERCISES.map((id, i) => ({
  exercise_id: id,
  e1rm: series(11 + i, 18, BASE[id] * 1.1, 0.35 + i * 0.1, 3),
  volume: series(21 + i, 10, 2.2 + i * 0.6, 0.12, 0.8),
  inol: series(31 + i, 15, 0.7, 0.01, 0.35),
  vel: [1.4, 0.3, -0.8, null][i] ?? null,
  stale: id === 'pull_ups',
}))

const HEROES: HeroRow[] = EXERCISES.map((id, i) => ({
  exercise_id: id,
  e1rm: Math.round(BASE[id] * 1.18 * 10) / 10,
  deltaPct: [3.2, 0.6, -1.4, 0][i] ?? 0,
  sessions: 9 + i,
}))

const ok = async <T>(data: T, delay = 40): Promise<Envelope<T>> => {
  await new Promise((resolve) => setTimeout(resolve, delay))
  return { data, error: null }
}

/** What the window and exercises params narrow; the shape of argo's `WindowQuerySchema`. */
export type StrengthParams = {
  window?: string | undefined
  from?: string | undefined
  to?: string | undefined
  exercises?: string | undefined
}

const only = <T extends { exercise_id: string }>(rows: T[], p: StrengthParams): T[] => {
  const keep = (p.exercises ?? EXERCISES.join(',')).split(',')
  return rows.filter((r) => keep.includes(r.exercise_id))
}

export const fakeApi = {
  heroes: (p: StrengthParams) => ok(only(HEROES, p)),
  sparklines: (p: StrengthParams) => ok(only(SPARKS, p)),
  workouts: (p: { page: number; limit: number }) =>
    ok({ total: WORKOUTS.length, data: WORKOUTS.slice((p.page - 1) * p.limit, p.page * p.limit) }),
}
