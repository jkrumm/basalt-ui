/**
 * Remote test steps, last 7 days (scenario expr-n90): placements per step and kind, a daily split,
 * 240 pressure samples over the last 36 hours with a default baseline before the first day, and at
 * most one held step. Seeded and deterministic; `weekNamed` picks the `?fixture=` variant.
 */

export const KINDS = ['remote', 'room', 'faster', 'free', 'held'] as const
export type Kind = (typeof KINDS)[number]

export type Step = { id: string; counts: Readonly<Record<Kind, number>> }
export type Day = { at: Date; remote: number; back: number; total: number }
export type Sample = {
  at: Date
  /** Share of remote slots busy, 0 to 100. */
  pressure: number
  baseline: number
  /** One entry per run taken back for lack of remote room at this sample. */
  roomSteps: readonly string[]
}
export type Hold = { step: string; minutes: number; limit: number; disagreements: number }
export type Week = {
  steps: readonly Step[]
  days: readonly Day[]
  samples: readonly Sample[]
  hold: Hold | null
  prior: { total: number; remote: number; back: number }
  /** Samples under a first day of history carry the default baseline. */
  defaultUntil: Date
}

export const HOUR_MS = 3_600_000
const END = Date.UTC(2026, 10, 20, 18, 0)
const SAMPLE_COUNT = 240
const SAMPLE_MS = (36 * HOUR_MS) / SAMPLE_COUNT
const DAY_SAMPLES = 160
export const DEFAULT_BASELINE = 60

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Splits `total` over the weights, the remainders going to the largest fractions. */
function split(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (total * w) / sum)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { i } of order) {
    if (left <= 0) break
    out[i] = (out[i] ?? 0) + 1
    left -= 1
  }
  return out
}

type Shape = {
  scale: Record<Kind, number>
  held: number
  hold: Hold | null
  base: number
  burst: number
}

const SHAPES = {
  week: {
    scale: { remote: 1, room: 1, faster: 1, free: 1, held: 1 },
    held: 4,
    hold: { step: 'integration-api', minutes: 47, limit: 60, disagreements: 3 },
    base: 0.52,
    burst: 0.4,
  },
  calm: {
    scale: { remote: 1, room: 0, faster: 1, free: 1, held: 0 },
    held: 0,
    hold: null,
    base: 0.36,
    burst: 0,
  },
  crowded: {
    scale: { remote: 6, room: 9, faster: 4, free: 3, held: 5 },
    held: 22,
    hold: { step: 'integration-api', minutes: 190, limit: 60, disagreements: 3 },
    base: 0.93,
    burst: 0.1,
  },
} satisfies Record<string, Shape>

export type FixtureName = keyof typeof SHAPES
export const FIXTURE_NAMES = Object.keys(SHAPES) as readonly FixtureName[]

const BASE_STEPS: readonly { id: string; counts: Record<Kind, number> }[] = [
  { id: 'unit-core', counts: { remote: 96, free: 4, room: 6, faster: 3, held: 0 } },
  { id: 'unit-ui', counts: { remote: 88, free: 3, room: 9, faster: 2, held: 0 } },
  { id: 'integration-api', counts: { remote: 41, free: 2, room: 5, faster: 1, held: 0 } },
  { id: 'e2e-checkout', counts: { remote: 52, free: 1, room: 12, faster: 6, held: 0 } },
  { id: 'e2e-auth', counts: { remote: 47, free: 2, room: 14, faster: 4, held: 0 } },
  { id: 'lint-types', counts: { remote: 64, free: 6, room: 2, faster: 11, held: 0 } },
  { id: 'snapshot-visual', counts: { remote: 30, free: 2, room: 8, faster: 0, held: 0 } },
  { id: 'perf-bench', counts: { remote: 0, free: 0, room: 0, faster: 0, held: 0 } },
]

function stepsFor(shape: Shape): Step[] {
  return BASE_STEPS.map((s) => {
    const counts = { ...s.counts }
    for (const k of KINDS) counts[k] = Math.round(counts[k] * shape.scale[k])
    if (s.id === shape.hold?.step) counts.held = shape.held
    return { id: s.id, counts }
  })
}

function pressureOf(shape: Shape, rng: () => number): number[] {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const day = 0.14 * Math.sin(2 * Math.PI * (i / DAY_SAMPLES - 0.2))
    const burst =
      shape.burst * (Math.exp(-(((i - 70) / 12) ** 2)) + Math.exp(-(((i - 200) / 10) ** 2)))
    const v = shape.base + (shape.burst === 0 ? 0.3 : 1) * day + burst + (rng() - 0.5) * 0.08
    return Math.round(Math.min(1, Math.max(0.12, v)) * 100)
  })
}

export function weekNamed(name: string | undefined): Week {
  const shape: Shape = SHAPES[FIXTURE_NAMES.find((n) => n === name) ?? 'week']
  const rng = mulberry32(90)
  const steps = stepsFor(shape)

  const days: { at: Date; remote: number; back: number; total: number }[] = Array.from(
    { length: 7 },
    (_, d) => ({ at: new Date(END - (6 - d) * 24 * HOUR_MS), remote: 0, back: 0, total: 0 }),
  )
  for (const step of steps) {
    for (const k of KINDS) {
      const parts = split(
        step.counts[k],
        Array.from({ length: 7 }, () => 0.6 + rng()),
      )
      parts.forEach((n, d) => {
        const day = days[d]
        if (day === undefined) return
        day.total += n
        if (k === 'remote') day.remote += n
        if (k === 'room' || k === 'faster' || k === 'free') day.back += n
      })
    }
  }

  const pressure = pressureOf(shape, rng)
  const peaks = pressure.flatMap((p, i) => (p >= 88 ? [i] : []))
  const roomSteps: string[][] = pressure.map(() => [])
  steps.forEach((step, s) => {
    const inWindow = Math.round(step.counts.room * (shape.base > 0.9 ? 0.1 : 0.3))
    for (let k = 0; k < inWindow && peaks.length > 0; k++) {
      const at = peaks[(s * 7 + k * 3) % peaks.length] ?? 0
      roomSteps[at]?.push(step.id)
    }
  })

  let sum = 0
  const samples: Sample[] = pressure.map((p, i) => {
    sum += p
    return {
      at: new Date(END - (SAMPLE_COUNT - 1 - i) * SAMPLE_MS),
      pressure: p,
      baseline: i < DAY_SAMPLES ? DEFAULT_BASELINE : Math.round(sum / (i + 1)),
      roomSteps: roomSteps[i] ?? [],
    }
  })

  const total = steps.reduce((n, s) => n + KINDS.reduce((m, k) => m + s.counts[k], 0), 0)
  const remote = steps.reduce((n, s) => n + s.counts.remote, 0)
  const room = steps.reduce((n, s) => n + s.counts.room, 0)
  return {
    steps,
    days,
    samples,
    hold: shape.hold,
    prior: {
      total: Math.round(total * 0.95),
      remote: Math.round(remote * 1.01),
      back: Math.round(
        (room + steps.reduce((n, s) => n + s.counts.faster + s.counts.free, 0)) * 0.82,
      ),
    },
    defaultUntil: new Date(END - (SAMPLE_COUNT - DAY_SAMPLES) * SAMPLE_MS),
  }
}

export type Summary = {
  total: number
  remote: number
  room: number
  faster: number
  free: number
  held: number
  back: number
  share: number
  priorShare: number
  priorBack: number
  peak: number
  peakAt: Date
  baseline: number
}

export function summarize(week: Week): Summary {
  const sum = (k: Kind): number => week.steps.reduce((n, s) => n + s.counts[k], 0)
  const remote = sum('remote')
  const room = sum('room')
  const faster = sum('faster')
  const free = sum('free')
  const held = sum('held')
  const total = remote + room + faster + free + held
  const top = week.samples.reduce<Sample | undefined>(
    (a, b) => (a === undefined || b.pressure > a.pressure ? b : a),
    undefined,
  )
  return {
    total,
    remote,
    room,
    faster,
    free,
    held,
    back: room + faster + free,
    share: total === 0 ? 0 : remote / total,
    priorBack: week.prior.back,
    priorShare: week.prior.total === 0 ? 0 : week.prior.remote / week.prior.total,
    peak: top?.pressure ?? 0,
    peakAt: top?.at ?? week.defaultUntil,
    baseline: week.samples.at(-1)?.baseline ?? DEFAULT_BASELINE,
  }
}
