/** Weekly lifting volume for expr-n20: 4 lifts by 16 weeks, tonnes by set type, three landmarks per lift. */

export type WeekRow = {
  /** Band key and label: `W1` to `W16`. */
  week: string
  /** The current week is partial: only the sets logged so far. */
  partial: boolean
  warmup: number
  work: number
  drop: number
  amrap: number
  total: number
}

export type Lift = {
  id: string
  name: string
  /** Minimum effective volume, tonnes a week. */
  mev: number
  typical: number
  /** Maximum recoverable volume, tonnes a week. */
  mrv: number
  weeks: readonly WeekRow[]
}

export const WEEKS = 16

type Base = {
  id: string
  name: string
  mev: number
  typical: number
  mrv: number
  /** Weeks 1 to 15 in tonnes, then the sets logged so far in week 16. */
  totals: readonly number[]
}

const BASES: readonly Base[] = [
  {
    id: 'bench',
    name: 'Bench press',
    mev: 6,
    typical: 9,
    mrv: 12,
    totals: [8.1, 8.6, 9.0, 8.4, 9.2, 9.6, 8.9, 9.4, 10.1, 9.0, 9.5, 9.8, 10.2, 9.6, 9.9, 4.1],
  },
  {
    id: 'squat',
    name: 'Back squat',
    mev: 8,
    typical: 12,
    mrv: 16,
    totals: [
      10.2, 11.1, 10.8, 12.0, 11.4, 12.6, 11.9, 12.3, 13.1, 12.2, 12.9, 13.4, 16.4, 16.9, 17.6, 8.4,
    ],
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    mev: 5,
    typical: 8,
    mrv: 11,
    totals: [7.4, 7.9, 8.2, 7.1, 8.4, 8.0, 8.8, 7.6, 8.3, 8.9, 8.1, 7.8, 8.5, 7.2, 6.9, 3.0],
  },
  {
    id: 'ohp',
    name: 'Overhead press',
    mev: 3,
    typical: 4.5,
    mrv: 6.5,
    totals: [4.2, 4.6, 4.4, 4.8, 5.0, 4.5, 4.7, 4.3, 4.9, 4.4, 4.0, 3.8, 3.9, 3.6, 3.4, 1.6],
  },
]

/** A small deterministic generator, so every build of the fixture is the same. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (v: number): number => Math.round(v * 100) / 100

function split(total: number, rand: () => number, week: string, partial: boolean): WeekRow {
  if (total === 0) return { week, partial, warmup: 0, work: 0, drop: 0, amrap: 0, total: 0 }
  const warmup = round(total * (0.1 + (rand() - 0.5) * 0.04))
  const drop = round(total * (0.08 + (rand() - 0.5) * 0.06))
  const amrap = round(total * (0.12 + (rand() - 0.5) * 0.06))
  return { week, partial, warmup, work: round(total - warmup - drop - amrap), drop, amrap, total }
}

/** Weeks an extra fixture overrides, by lift id: week index (0-based) to tonnes. */
const OVERRIDES: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<number, number>>>>>
> = {
  // A shoulder injury: the press is skipped in week 9 and again from week 12 on.
  zero: { ohp: { 8: 0, 11: 0, 12: 0, 13: 0, 14: 0 } },
  // A deadlift peak week at more than twice the maximum, then a deload that is still over.
  extreme: { deadlift: { 13: 24.6, 14: 12.4 } },
}

export function buildLifts(fixture: string | undefined): readonly Lift[] {
  const overrides = fixture === undefined ? undefined : OVERRIDES[fixture]
  return BASES.map((base, lift) => {
    const rand = seeded(1000 + lift)
    const weeks = base.totals.map((total, i) =>
      split(overrides?.[base.id]?.[i] ?? total, rand, `W${i + 1}`, i === WEEKS - 1),
    )
    return {
      id: base.id,
      name: base.name,
      mev: base.mev,
      typical: base.typical,
      mrv: base.mrv,
      weeks,
    }
  })
}
