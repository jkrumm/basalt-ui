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
import type { ThreadRunState } from './use-agent-thread-runs'

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
  }
  records.set(threadId, record)
  return record
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
 * Decides `stop()` from the record, falling back to the rendered `entry` only when no record
 * exists (an unmount re-run — StrictMode, `<Activity>` — clears records while `runs` state
 * survives). A live `entry` with no record is a phantom nothing drives; it is settled once: the
 * tombstone this writes makes a second `stop()` in the same tick a no-op.
 */
export function planStop<TPart>(
  records: RunRecords<TPart>,
  threadId: string,
  entry: ThreadRunState<TPart> | undefined,
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
  runs: ReadonlyMap<string, ThreadRunState<TPart>>,
): string[] {
  const ids = new Set<string>()
  for (const [threadId, record] of records) if (record.ended === 'failed') ids.add(threadId)
  for (const [threadId, entry] of runs) if (entry.status === 'error') ids.add(threadId)
  return [...ids]
}

/** Drops the terminal records a render has already caught up with, so ids are not kept forever. */
export function sweepFlushed<TPart>(
  records: RunRecords<TPart>,
  runs: ReadonlyMap<string, ThreadRunState<TPart>>,
): void {
  for (const [threadId, record] of records) {
    if (record.ended === undefined) continue
    const shown = runs.get(threadId)
    const flushed = record.ended === 'failed' ? shown?.status === 'error' : shown === undefined
    if (flushed) records.delete(threadId)
  }
}
