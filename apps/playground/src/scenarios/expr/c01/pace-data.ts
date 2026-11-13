/**
 * c01 fixture and model: a three-stage pipeline run against the best run.
 *
 * Authored, not generated: every number is a literal, "now" is the pinned `ELAPSED` seconds after a
 * pinned start instant, and nothing here reads a clock or a random source. The run is still going:
 * Build finished exactly on its best split (the zero delta), Test is running and already 94 s past
 * its best split (the extreme), Deploy has not started (the waiting case). `paceOf` also covers a
 * saved stage and a finished run; `pace-data.test.ts` pins those paths.
 */
import { durationClock } from 'basalt-ui/format'

export type Stage = { key: string; name: string; best: number }

/** The best split of each stage, in order, in seconds. */
export const STAGES: readonly Stage[] = [
  { key: 'build', name: 'Build', best: 142 },
  { key: 'test', name: 'Test', best: 318 },
  { key: 'deploy', name: 'Deploy', best: 96 },
]

export const RUN_LABEL = 'Run 482'
/** Pinned start of the run: 2026-11-13 14:22:31 UTC. */
export const RUN_START_MS = Date.UTC(2026, 10, 13, 14, 22, 31)
/** Splits of the finished stages, in order, in seconds. */
export const SPLITS: readonly number[] = [142]
/** Seconds since the start, at the pinned instant. */
export const ELAPSED = 554

export type StageStatus = 'done' | 'running' | 'waiting'

export type StageRow = {
  key: string
  name: string
  /** Position on the x scale: the stage's index. */
  index: number
  best: number
  /** The finished split, the running stage's time so far, or `null` for a stage not yet started. */
  actual: number | null
  status: StageStatus
  /** Actual minus best for a finished stage; `null` while running or waiting (no verdict yet). */
  delta: number | null
  /** Seconds a running stage is already past its best split; 0 otherwise. */
  over: number
}

export type Pace = {
  rows: StageRow[]
  /** Seconds gained (negative) or lost (positive) over the finished stages. */
  committed: number
  /** The committed delta plus any overrun of the running stage past its own best split. */
  live: number
  running: StageRow | undefined
  bestTotal: number
  started: boolean
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

export function paceOf(stages: readonly Stage[], splits: readonly number[], elapsed: number): Pace {
  const finishedTotal = sum(splits)
  const rows = stages.map((stage, index): StageRow => {
    const base = { key: stage.key, name: stage.name, index, best: stage.best }
    const split = splits[index]
    if (split !== undefined) {
      return { ...base, actual: split, status: 'done', delta: split - stage.best, over: 0 }
    }
    if (index === splits.length && elapsed > 0) {
      const actual = Math.max(0, elapsed - finishedTotal)
      return {
        ...base,
        actual,
        status: 'running',
        delta: null,
        over: Math.max(0, actual - stage.best),
      }
    }
    return { ...base, actual: null, status: 'waiting', delta: null, over: 0 }
  })
  const committed = sum(rows.map((r) => r.delta ?? 0))
  return {
    rows,
    committed,
    live: committed + sum(rows.map((r) => r.over)),
    running: rows.find((r) => r.status === 'running'),
    bestTotal: sum(stages.map((s) => s.best)),
    started: elapsed > 0,
  }
}

export const PACE = paceOf(STAGES, SPLITS, ELAPSED)

/** The seconds a stage costs against its best split so far: its finished delta or its live overrun. */
export const costOf = (row: StageRow): number => row.delta ?? row.over

/** A plain verdict naming the stage that costs the most and what the others did. */
export function verdictOf(pace: Pace): string {
  const costly = pace.rows.filter((r) => costOf(r) > 0).toSorted((a, b) => costOf(b) - costOf(a))[0]
  const saved = pace.rows
    .filter((r) => (r.delta ?? 0) < 0)
    .toSorted((a, b) => costOf(a) - costOf(b))[0]
  const matched = pace.rows.filter((r) => r.delta === 0)
  const parts = [
    costly === undefined ? undefined : `${costly.name} is costing the most.`,
    saved === undefined ? undefined : `${saved.name} saved ${durationClock(-costOf(saved))}.`,
    matched.length === 0
      ? undefined
      : `${matched.map((r) => r.name).join(' and ')} matched its best split.`,
  ].filter((p): p is string => p !== undefined)
  if (parts.length > 0) return parts.join(' ')
  return pace.started ? 'Every stage so far is on its best split.' : 'No stage has started.'
}

/** `+1:23` / `−0:11` (a true minus); zero is `0:00`. */
// cycle-expression-1: no signed duration formatter in basalt-ui/format (`duration` clamps negatives to zero)
export const signedClock = (seconds: number): string =>
  seconds === 0 ? durationClock(0) : `${seconds < 0 ? '−' : '+'}${durationClock(Math.abs(seconds))}`

/** `HH:MM` UTC of the run's start; a fixed read, so platform ICU cannot shift it. */
export const RUN_START_LABEL = new Date(RUN_START_MS).toISOString().slice(11, 16)

export type SegmentKind = 'base' | 'live' | 'lost' | 'saved' | 'ghost'
export type Segment = { kind: SegmentKind; from: number; to: number }

/**
 * The time bar of one stage as stacked spans from zero. A finished stage is its base up to the
 * smaller of split and best, then the time lost (above best) or saved (the gap to best). A running
 * stage is live up to its best split, then lost past it; under its best the rest is a ghost. A
 * waiting stage is only the ghost of its best split.
 */
export function segmentsOf(row: StageRow): Segment[] {
  const { best, actual } = row
  if (actual === null) return [{ kind: 'ghost', from: 0, to: best }]
  if (row.status === 'running') {
    return actual > best
      ? [
          { kind: 'live', from: 0, to: best },
          { kind: 'lost', from: best, to: actual },
        ]
      : [
          { kind: 'live', from: 0, to: actual },
          { kind: 'ghost', from: actual, to: best },
        ]
  }
  const low = Math.min(actual, best)
  const tail: Segment[] =
    actual > best
      ? [{ kind: 'lost', from: best, to: actual }]
      : actual < best
        ? [{ kind: 'saved', from: actual, to: best }]
        : []
  return [{ kind: 'base', from: 0, to: low }, ...tail]
}

/** The figure printed above a stage's bar. */
export function labelOf(row: StageRow): string {
  if (row.status === 'waiting') return 'waiting'
  if (row.status === 'running') {
    return row.over > 0 ? `${signedClock(row.over)} live` : `${durationClock(row.actual ?? 0)} live`
  }
  return signedClock(row.delta ?? 0)
}

/** The stage-by-stage sum behind the headline, e.g. `Test +01:34 · Build 00:00`. */
export const sumOf = (pace: Pace): string =>
  pace.rows
    .filter((r) => costOf(r) !== 0 || r.status === 'done')
    .map((r) => `${r.name} ${signedClock(costOf(r))}`)
    .join(' \u00b7 ')

export type PathPart = { value: number; label: string; forecast?: boolean }

/**
 * The run laid end to end: what each stage has taken so far, then what is left of the best splits
 * as a forecast (a waiting stage whole, a running stage under its best the rest of it). `projected`
 * is where the run finishes if everything still to run goes at its best.
 */
export function pathOf(pace: Pace): { parts: PathPart[]; projected: number } {
  const parts = pace.rows.flatMap((r): PathPart[] => {
    const taken = r.actual === null ? [] : [{ value: r.actual, label: r.name }]
    const left =
      r.actual === null
        ? r.best
        : Math.max(0, r.best - (r.status === 'running' ? r.actual : r.best))
    return [...taken, ...(left > 0 ? [{ value: left, label: r.name, forecast: true }] : [])]
  })
  return { parts, projected: parts.reduce((a, p) => a + p.value, 0) }
}
