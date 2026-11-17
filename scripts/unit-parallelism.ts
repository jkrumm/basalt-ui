/** How many `bun test` processes scripts/unit-test.ts runs at once. */

/** One unit process's budget: the ts-morph files alone peak at 0.8 to 2.3 GiB, a 40-file chunk well under 1 GiB. */
export const PER_PROCESS_MIB = 1024

/** Beyond this the suite's longest process, not the cores, sets the wall time (measured 2026-11-17: 187 s at 6). */
export const MAX_PARALLEL = 8

/**
 * The factory's step host grants a step its cores and memory (`FACTORY_STEP_CORES`, `FACTORY_STEP_MEM_MIB`); the
 * suite sizes itself to the smaller of the two. Neither set (the mini, CI, a bare `make test`): serial, which is
 * what bounds the peak there. A value that is not a positive number counts as unset.
 */
export function parallelism(env: Readonly<Record<string, string | undefined>>): number {
  const grant = (key: string): number | null => {
    const value = Number(env[key])
    return Number.isFinite(value) && value >= 1 ? value : null
  }
  const cores = grant('FACTORY_STEP_CORES')
  const memory = grant('FACTORY_STEP_MEM_MIB')
  if (cores === null && memory === null) return 1
  const byCores = cores === null ? MAX_PARALLEL : Math.floor(cores)
  const byMemory = memory === null ? MAX_PARALLEL : Math.floor(memory / PER_PROCESS_MIB)
  return Math.max(1, Math.min(byCores, byMemory, MAX_PARALLEL))
}
