/**
 * The per-thread run lifecycle of `useAgentThreadRuns`, in ONE record per thread id.
 *
 * The hook used to keep a run's controller, live parts, "final message landed" flag and how it
 * ended in four parallel maps, written at different places, and `runs` (React state, which only
 * mirrors the last flushed render) was consulted for the rest. Every drift between those was a
 * bug: `stop()` deciding from a stale `runs`, a second `stop()` appending twice. Here a run is
 * begun, ended and swept through three functions, so the pieces change together.
 *
 * A record is LIVE while `ended === undefined`; `ended` is written synchronously where a run stops
 * being driven, long before the `setRuns` it queues renders. That window is what the record
 * covers: it outlives the run only until a render shows the outcome (`sweepFlushed`).
 */

/** The part of a rendered `runs` entry this module reads. */
type RenderedRun<TPart> = { readonly status: string; readonly parts: TPart[] }

export type RunEnd = 'settled' | 'failed' | 'stopped'

export type RunRecord<TPart> = {
  readonly controller: AbortController
  /** The unthrottled accumulator; `runs` may lag it by one throttle window. Emptied when the run ends. */
  parts: TPart[]
  /** The turn's terminal assistant message is in the thread. */
  appended: boolean
  /** `consumeAndFinalize`'s own `resolveOutcome` is in flight. */
  resolving: boolean
  ended: RunEnd | undefined
  /** A newer run began on the same thread (set by `beginRun` on the record it replaces). */
  superseded: boolean
  /** The turn's telemetry `settle`, run once by `settleTrace`. */
  settle: ((end: RunEnd) => void) | undefined
}

export type RunRecords<TPart> = Map<string, RunRecord<TPart>>

/** Registers a live run for `threadId`, replacing whatever record the previous run left. */
export function beginRun<TPart>(
  records: RunRecords<TPart>,
  threadId: string,
  controller: AbortController,
): RunRecord<TPart> {
  const record: RunRecord<TPart> = {
    controller,
    parts: [],
    appended: false,
    resolving: false,
    ended: undefined,
    superseded: false,
    settle: undefined,
  }
  const previous = records.get(threadId)
  if (previous !== undefined) previous.superseded = true
  records.set(threadId, record)
  return record
}

/** Runs the turn's telemetry `settle` once; a throwing consumer hook never breaks the run. */
export function settleTrace<TPart>(record: RunRecord<TPart>, end: RunEnd): void {
  const { settle } = record
  record.settle = undefined
  try {
    settle?.(end)
  } catch {
    // a throwing sink must never break the app (§ 7 delivery rules)
  }
}

/** Marks a run as no longer driven and drops the content it held. */
export function endRun<TPart>(record: RunRecord<TPart>, reason: RunEnd): void {
  record.ended = reason
  record.parts = []
}

/** True while `controller`'s run is still the thread's live one. */
export function isLive<TPart>(
  records: RunRecords<TPart>,
  threadId: string,
  controller: AbortController,
): boolean {
  const record = records.get(threadId)
  return record?.controller === controller && record.ended === undefined
}

/** What `stop(threadId)` must do. */
export type StopPlan<TPart> =
  | { readonly kind: 'noop' }
  /** A failed run: only its error entry goes. */
  | { readonly kind: 'dismiss' }
  /** A live run: abort it, persist its parts, settle the thread. */
  | { readonly kind: 'stop'; readonly record: RunRecord<TPart>; readonly parts: TPart[] }

/**
 * True while `threadId` has a live (not yet ended) run.
 */
export function hasLiveRun<TPart>(records: RunRecords<TPart>, threadId: string): boolean {
  const record = records.get(threadId)
  return record !== undefined && record.ended === undefined
}

/**
 * Decides `stop()` from the record, falling back to the rendered `entry` only when no record
 * exists (an unmount re-run — StrictMode, `<Activity>` — clears records while `runs` state
 * survives). A live `entry` with no record is a phantom nothing drives; it is settled once: the
 * ended tombstone record this WRITES (the side effect in the name) makes a second `stop()` in the
 * same tick a no-op.
 */
export function planStopWithTombstone<TPart>(
  records: RunRecords<TPart>,
  threadId: string,
  entry: RenderedRun<TPart> | undefined,
): StopPlan<TPart> {
  const record = records.get(threadId)
  if (record !== undefined) {
    if (record.ended === undefined) return { kind: 'stop', record, parts: record.parts }
    return record.ended === 'failed' ? { kind: 'dismiss' } : { kind: 'noop' }
  }
  if (entry === undefined) return { kind: 'noop' }
  if (entry.status === 'error') return { kind: 'dismiss' }
  const tombstone = beginRun(records, threadId, new AbortController())
  endRun(tombstone, 'stopped')
  return { kind: 'stop', record: tombstone, parts: entry.parts }
}

/** Thread ids whose failed entry `stopAll()` must dismiss: the records AND what `runs` shows. */
export function failedThreadIds<TPart>(
  records: RunRecords<TPart>,
  runs: ReadonlyMap<string, RenderedRun<TPart>>,
): string[] {
  const ids = new Set<string>()
  for (const [threadId, record] of records) if (record.ended === 'failed') ids.add(threadId)
  for (const [threadId, entry] of runs) if (entry.status === 'error') ids.add(threadId)
  return [...ids]
}

/**
 * A failed entry was dismissed: its record has nothing left to cover. (`sweepFlushed` cannot tell
 * "dismissed" from "not rendered yet", so the dismissal itself drops it.)
 */
export function dismissRun<TPart>(records: RunRecords<TPart>, threadId: string): void {
  if (records.get(threadId)?.ended === 'failed') records.delete(threadId)
}

/** True unless a newer run has taken the thread over since `record` began. */
export function isLatestRun<TPart>(record: RunRecord<TPart>): boolean {
  return !record.superseded
}

/** Drops the terminal records a render has already caught up with, so ids are not kept forever. */
export function sweepFlushed<TPart>(
  records: RunRecords<TPart>,
  runs: ReadonlyMap<string, RenderedRun<TPart>>,
): void {
  for (const [threadId, record] of records) {
    // A pending resolver still reports to its record (superseded-ness included): keep it.
    if (record.ended === undefined || record.resolving) continue
    const shown = runs.get(threadId)
    const flushed = record.ended === 'failed' ? shown?.status === 'error' : shown === undefined
    if (flushed) records.delete(threadId)
  }
}
