/**
 * Perf lane harness (quality-contract section 6): counts React commits through `<Profiler>`, never
 * milliseconds. A commit count is deterministic for a given tree and event sequence, so the gate
 * needs no retry rule; durations are recorded beside the counts and never asserted.
 *
 * `budget.json` is the committed ceiling file. A fixture with no entry is measured and written
 * (ceiling = measured + 5 %, rounded up to a whole commit); one with an entry is held to it. A raise
 * is a hand edit that needs a consumer outside argo (section 6), so there is no `--update` flag.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProfilerOnRenderCallback } from 'react'

export const BUDGET_FILE = join(import.meta.dirname, 'budget.json')

export type Budget = Record<string, { measured: number; ceiling: number }>

/** `measured + 5 %`, rounded up to a whole commit. */
export const ceilingOf = (measured: number): number => Math.ceil(measured * 1.05)

export function readBudget(): Budget {
  return existsSync(BUDGET_FILE) ? (JSON.parse(readFileSync(BUDGET_FILE, 'utf8')) as Budget) : {}
}

/** Appends the first measurement of `name`; an existing entry is never rewritten. Returns the ceiling. */
export function recordFirstMeasurement(name: string, measured: number): number {
  const budget = readBudget()
  const existing = budget[name]
  if (existing) return existing.ceiling
  const ceiling = ceilingOf(measured)
  const next: Budget = { ...budget, [name]: { measured, ceiling } }
  const sorted = Object.fromEntries(Object.entries(next).toSorted(([a], [b]) => a.localeCompare(b)))
  writeFileSync(BUDGET_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
  return ceiling
}

export type CommitCounter = {
  onRender: ProfilerOnRenderCallback
  /** Commits since the last `reset`. */
  count(): number
  /** Summed `actualDuration` since the last `reset`; recorded, never asserted. */
  ms(): number
  reset(): void
}

export function commitCounter(): CommitCounter {
  let commits = 0
  let ms = 0
  return {
    onRender: (_id, _phase, actualDuration) => {
      commits += 1
      ms += actualDuration
    },
    count: () => commits,
    ms: () => ms,
    reset: () => {
      commits = 0
      ms = 0
    },
  }
}

/** What a run reports to the evidence lane: `BASALT_PERF_OUT` names the JSON file it writes. */
export type PerfReport = Record<
  string,
  { commits: number; perUnit: number[]; ms: number; ceiling: number; firstMeasurement: boolean }
>
