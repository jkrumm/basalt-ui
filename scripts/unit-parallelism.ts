/** How many `bun test` processes scripts/unit-test.ts runs at once. */

/** One unit process's budget: the ts-morph files alone peak at 0.8 to 2.3 GiB, a 40-file chunk well under 1 GiB. */
const PER_PROCESS_MIB = 1024

/**
 * The width measured on the step host (2026-11-17: 187 s at 6, peak 3.9 GiB). The cap also bounds the worst case: the
 * eight HEAVY files start first, so a wider grant would run more of them at once than a 6 GiB grant is sized for.
 */
export const MAX_PARALLEL = 6

/** What a step peaks at before the throughput loop reads it as over budget (project.yaml `budgets.peak`, 2048 MiB when unset). */
export const DEFAULT_PEAK_MIB = 2048

/**
 * The most resident memory the processes of one run may hold together, by their estimated cost. A grant is a ceiling
 * for the host, this is the step's own budget: 6 processes in parallel held 3.9 GiB where one at a time holds 1.7.
 * `UNIT_PEAK_MIB` overrides it (the CI unit job, which has its own 16 GiB runner and no peak budget).
 */
export function peakBudgetMib(env: Readonly<Record<string, string | undefined>>): number {
  const value = Number(env.UNIT_PEAK_MIB)
  return Number.isFinite(value) && value >= 1 ? value : DEFAULT_PEAK_MIB
}

/**
 * The next group to start: the first pending one whose estimated cost fits beside what already runs. One group always
 * starts alone, whatever it costs, so a run cannot stall. Returns its index in `pending`, or null to wait.
 */
export function pickNext(input: {
  pending: readonly number[]
  runningMib: number
  budgetMib: number
  running: number
}): number | null {
  if (input.pending.length === 0) return null
  if (input.running === 0) return 0
  const fit = input.pending.findIndex((cost) => input.runningMib + cost <= input.budgetMib)
  return fit === -1 ? null : fit
}

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
