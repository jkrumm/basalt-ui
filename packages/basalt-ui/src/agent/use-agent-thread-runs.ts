/**
 * useAgentThreadRuns — concurrent multi-thread stream run manager.
 *
 * useAgentThreadRuns runs N CONCURRENT streams, one per thread id, so a user can fire many
 * short chats that each stream and resolve independently in the background. Each thread's
 * turn is appended to an injected ThreadsStore and distilled into an AgentOutcome via an
 * injected OutcomeResolver once the stream completes.
 *
 * Rules of hooks are satisfied: all hooks are called unconditionally at the top level of the
 * returned function; no conditional hook invocations.
 *
 * `transport` also accepts a per-thread factory — `(threadId) => AgentTransport` — resolved once
 * per thread id and cached: `transport: (threadId) => aiSdkTransport(opts).forThread(threadId)`.
 *
 * @example
 * import { useAgentThreadRuns, aiSdkTransport } from 'basalt-ui/agent'
 *
 * const transport = aiSdkTransport({ api: '/api/chat' })
 *
 * function ThreadFeed() {
 *   const store = useMyThreadsStore() // consumer-owned ThreadsStore
 *   const { runs, start, stop } = useAgentThreadRuns({
 *     transport,
 *     store,
 *     resolveOutcome, // your OutcomeResolver
 *   })
 *   const id = store.create()
 *   const status = runs.get(id)?.status // 'submitted' | 'streaming' | 'error' | undefined
 *   const isLive = status === 'submitted' || status === 'streaming'
 *   return (
 *     <div>
 *       <button onClick={() => start(id, 'Hello')}>Send</button>
 *       {isLive && <button onClick={() => stop(id)}>Stop</button>}
 *     </div>
 *   )
 * }
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatMessage } from './history'
import { toAgentError } from './error'
import type { AgentError } from './error'
import { mintMessageId, mintThreadId, withPartIds } from './id'
import { mergePart } from './merge'
import type { PartLike } from './merge'
import type { AgentOutcome, OutcomeResolver } from './outcome'
import { isStartPart } from './parts'
import type { AgentPart } from './parts'
import { createRunCommitter, isContentPart } from './run-committer'
import {
  beginRun,
  endRun,
  failedThreadIds,
  dismissRun,
  hasLiveRun,
  isLatestRun,
  isLive,
  planStopWithTombstone,
  sweepFlushed,
} from './run-records'
import type { RunRecord, RunRecords } from './run-records'
import type { AgentThread, LiveRunStatus, ThreadStatus, ThreadsStore } from './thread'
import { isResumable } from './transport'
import type { AgentTransport } from './transport'
import { TelemetryContext, createEmitter, errorName, now } from '../telemetry'
import type { BasaltEvent, Telemetry } from '../telemetry'

// ── ThreadRunState ────────────────────────────────────────────────────────────

/**
 * The stream state of a single thread's most recent turn, while it is in flight or has failed.
 *
 * `status` mirrors AI SDK's `ChatStatus`: `'submitted'` from send until the first content part
 * (text, reasoning or tool) arrives, then `'streaming'`, or `'error'` once the turn failed. A turn
 * that settles successfully (or is stopped) has its entry deleted from the `runs` map — the
 * outcome lives on the persisted `AgentThread` instead.
 *
 * A turn that FAILS keeps its entry — `status: 'error'`, `error` set, the parts received so far —
 * until the next `start()`/`retry()` on that thread replaces it or `stop()` dismisses it. So
 * `runs.has(id)` means "in flight or failed"; `run.status` alone says which, and
 * `liveStatus={runs.get(id)?.status}` is correct for the chat rows (`'error'` is not live).
 *
 * @example
 * const state: ThreadRunState = { status: 'streaming', parts: [{ type: 'text', text: 'Hi' }] }
 */
export type ThreadRunState<TPart = AgentPart> =
  | {
      /** `'submitted'` until the first content part arrives, then `'streaming'`. */
      readonly status: LiveRunStatus
      /** Accumulated parts from the current stream for this thread. */
      readonly parts: TPart[]
      readonly error?: undefined
    }
  | {
      readonly status: 'error'
      /**
       * The parts received before the failure. Empty when the turn's final message already landed
       * in the thread (a failure after `appendMessage`, e.g. in `resolveOutcome`), so the feed
       * never renders the same content twice.
       */
      readonly parts: TPart[]
      readonly error: AgentError
    }

// ── useAgentThreadRuns args ───────────────────────────────────────────────────

export type UseAgentThreadRunsArgs<TPart = AgentPart> = {
  /**
   * The injected transport seam — one stream per start() call. Either a single shared transport
   * (today's form — identical behavior across every thread), OR a factory that resolves one
   * transport PER thread id, called at most once per thread and cached thereafter. The factory
   * form is how a per-conversation transport (e.g. aiSdkTransport, which binds a stable chat id
   * per thread) plugs into the multi-thread manager:
   *
   * ```ts
   * transport: (threadId) => aiSdkTransport({ api: '/api/chat' }).forThread(threadId)
   * ```
   */
  readonly transport:
    | AgentTransport<TPart, string>
    | ((threadId: string) => AgentTransport<TPart, string>)
  /** The persisted multi-thread registry to append messages and status into. */
  readonly store: ThreadsStore<TPart>
  /** Distills a finished thread into a feed-ready AgentOutcome once a turn completes. */
  readonly resolveOutcome: OutcomeResolver<TPart>
  /**
   * Converts raw user input into the thread's part shape. Defaults to a single text part.
   * Required when TPart is not the default AgentPart union.
   */
  readonly toUserParts?: (input: string) => TPart[]
  /**
   * Called with the RAW thrown value when a turn's stream throws — never for the aborts this hook
   * issues itself (`stop()`, supersede, unmount). An abort that comes from elsewhere (the
   * transport, the network layer) is a failure and fires, as `kind: 'aborted'` on the run. Fires
   * from the SAME catch branch that sets `onFailureStatus` on the thread, so a caller wanting a
   * toast/notification for a genuine transport error (a 409/503/401, argo's hermes-chat S19) no
   * longer has to wrap every transport call in its own generator to intercept the throw — see
   * `consumeAndFinalize`'s catch block.
   */
  readonly onError?: (info: { readonly threadId: string; readonly error: unknown }) => void
  /**
   * Minimum ms between `runs` commits while a part stream is flowing — `useChat`'s stable
   * `throttle` semantics: the first part commits immediately, later parts within the window are
   * batched into one trailing commit. The `submitted → streaming` edge, a failure, the end of the
   * stream and `stop()` never wait on it, so no final part is lost. `0` (default) commits every
   * part.
   */
  readonly throttle?: number
  /**
   * Receives one `chat.turn` event when a turn completes or fails (V2-SPEC § 7); a `stop()`ped
   * turn emits nothing. Omitted, it defaults to the enclosing `BasaltProvider`'s `telemetry` sink,
   * and outside a provider nothing is delivered. A throwing sink never breaks the turn.
   */
  readonly telemetry?: Telemetry
}

// ── useAgentThreadRuns return type ────────────────────────────────────────────

export type UseAgentThreadRunsReturn<TPart = AgentPart> = {
  /** Live stream state per thread id, for threads with a run in progress or just completed. */
  readonly runs: ReadonlyMap<string, ThreadRunState<TPart>>
  /**
   * Start a new turn on `threadId`. No-op if that thread already has a stream in flight.
   *
   * @throws {Error} synchronously, before any state is touched, on a host with no usable
   * `crypto` at all (see `mintMessageId` in `./id.ts` — the id it mints here is the new user
   * ChatMessage's idempotency key, so it degrades to a throw rather than a silent collision).
   * This throw is a true no-op: it happens before `appendMessage`/`setStatus`/the run's
   * controller are registered, so nothing is left half-started — the thread is exactly as it was
   * before the call. A caller invoking `start` from an event handler on a target that must
   * tolerate this (very old WebViews, non-DOM SSR shims) should wrap the call in its own
   * try/catch; this rung is vanishingly rare in practice (see `mintMessageId`'s own doc).
   */
  readonly start: (threadId: string, input: string) => void
  /**
   * Replay the last user input sent on `threadId` (same code path as `start`). No-op if
   * `threadId` has never had a turn started, or already has one in flight.
   *
   * @throws {Error} same condition and same true-no-op guarantee as `start` — see its doc.
   */
  readonly retry: (threadId: string) => void
  /**
   * Abort the in-flight stream for `threadId`. A no-op when the thread has no live run and no
   * failed entry. Preserves whatever content
   * had already arrived: if the run had accumulated any parts, they're persisted as an assistant
   * ChatMessage with `finish: 'stopped'` (unless that message already landed — see finalizeStop),
   * then distilled into an outcome and the thread is settled to 'done'.
   *
   * A FAILED turn's entry (`status: 'error'`) has no controller: `stop()` just dismisses it and
   * leaves the thread's `'error'` status alone. A turn that has already settled is a no-op.
   *
   * Defense-in-depth: if `runs` reports `threadId` as live but no run record exists for it (a
   * phantom entry — not reachable via any path in this hook today, since the unmount-cleanup
   * effect and `finalizeStop` both tear down the records and `runs` together), `stop()` still
   * settles it, once, instead of silently no-opping forever.
   */
  readonly stop: (threadId: string) => void
  /**
   * Abort every in-flight stream across all threads, settling each the same way stop() would, and
   * dismiss every failed entry.
   */
  readonly stopAll: () => void
}

// ── defaults ──────────────────────────────────────────────────────────────────

/**
 * Default toUserParts: wraps raw input in a single text part. This part's id is a display/merge
 * identity WITHIN a message's own `parts` array — it is never the value `appendMessage` idempotes
 * on (that's the enclosing `ChatMessage.id`, minted separately by the caller) — so `mintThreadId`
 * is the right low-collision-cost helper here, not `mintMessageId`.
 */
function defaultToUserParts(input: string): AgentPart[] {
  return [{ id: mintThreadId(), type: 'text', text: input }]
}

/**
 * Build the 'done' AgentThread snapshot passed to resolveOutcome, from the freshest known
 * thread (read off the store ref) plus the two messages this turn just produced.
 */
function buildDoneSnapshot<TPart>(
  priorThread: AgentThread<TPart> | undefined,
  threadId: string,
  userMessage: ChatMessage<TPart>,
  assistantMessage: ChatMessage<TPart>,
): AgentThread<TPart> {
  const updatedAt = Date.now()
  if (priorThread === undefined) {
    return {
      id: threadId,
      messages: [userMessage, assistantMessage],
      outcome: null,
      status: 'done',
      read: false,
      createdAt: userMessage.createdAt,
      updatedAt,
    }
  }
  return {
    ...priorThread,
    messages: [...priorThread.messages, assistantMessage],
    status: 'done',
    updatedAt,
  }
}

/**
 * Consumes an in-flight (or resumed) generator for one thread, accumulating parts into `runs`,
 * skipping StartParts (recording their resumeToken via setResumeToken instead of rendering them),
 * and finalizing into a persisted assistant ChatMessage + distilled AgentOutcome once the stream
 * completes. Shared by both start() (a fresh turn) and the mount-time resume path (reconnecting
 * an orphaned thread) so the ~40-line accumulate/finalize/error logic exists exactly once.
 *
 * `onFailureStatus` is the ThreadStatus to set when the generator throws (excluding the aborts
 * this hook issues itself — stop(), supersede, unmount — which are always a no-op; an abort from
 * elsewhere is a failure): start() passes 'error' (today's behavior for a fresh turn that fails);
 * the resume path passes 'interrupted' (a failed resume falls back to the same terminal state a
 * non-resumable orphaned thread already lands in).
 */
async function consumeAndFinalize<TPart extends PartLike>(args: {
  threadId: string
  record: RunRecord<TPart>
  generator: AsyncGenerator<TPart>
  userMessage: ChatMessage<TPart>
  recordsRef: MutableRefObject<RunRecords<TPart>>
  storeRef: MutableRefObject<ThreadsStore<TPart>>
  resolveOutcome: OutcomeResolver<TPart>
  setRuns: Dispatch<SetStateAction<Map<string, ThreadRunState<TPart>>>>
  onFailureStatus: ThreadStatus
  throttle: number
  emit: Telemetry
  onError?: (info: { readonly threadId: string; readonly error: unknown }) => void
}): Promise<void> {
  const {
    threadId,
    record,
    generator,
    userMessage,
    recordsRef,
    storeRef,
    resolveOutcome,
    setRuns,
    onFailureStatus,
    throttle,
    emit,
    onError,
  } = args
  const { controller } = record
  const live = (): boolean => isLive(recordsRef.current, threadId, controller)
  const owns = (): boolean => isLatestRun(record)
  let parts: TPart[] = []
  const startedAt = now()
  let firstContentAt: number | undefined
  // Every commit re-checks run ownership: a trailing timer that fires after stop()/unmount/a newer
  // run took the thread over must not resurrect or clobber its `runs` entry.
  const committer = createRunCommitter<TPart>(throttle, (committed, status) => {
    if (!live()) return
    setRuns((prev) => {
      const next = new Map(prev)
      next.set(threadId, { status, parts: committed })
      return next
    })
  })
  try {
    for await (const part of generator) {
      // Guard: the run ended (stop(), unmount) or a newer run replaced its record — stop updating
      // state. Deliberately NOT a `runs` teardown site: a mismatch is ambiguous between "aborted
      // and nothing replaced it" and "a newer run (a mount-reconcile resume on the SAME threadId)
      // is live in `runs` right now", and only the ender can tell which; stop() and the unmount
      // cleanup tear `runs` down synchronously with the end, before a newer run can exist.
      if (!live()) return
      if (isStartPart(part)) {
        storeRef.current.setResumeToken(threadId, part.resumeToken)
        continue
      }
      // mergePart REWRITES an existing id in place (never mutates `parts` — reassigns to the new
      // array it returns), so the local accumulator and the rendered `runs` snapshot below stay
      // identical: a replayed/resumed delta rewrites its part instead of duplicating it.
      parts = mergePart(parts, part)
      record.parts = parts
      // The submitted → streaming edge commits at once (it is the TTFT mark and must not wait on
      // the throttle window); later parts ride the throttle.
      const firstContent = firstContentAt === undefined && isContentPart(part)
      if (firstContent) firstContentAt = now()
      committer.push(parts, firstContentAt === undefined ? 'submitted' : 'streaming', firstContent)
    }
    // The throttle's trailing commit: the last parts must reach `runs` before the settle below.
    committer.flush()
    // Only proceed if this stream is still the current one.
    if (!live()) return

    const assistantMessage: ChatMessage<TPart> = {
      // appendMessage's idempotency key — mintMessageId, never mintThreadId (see that helper's
      // doc): a collided id here would silently drop this message, not merge a duplicate thread.
      id: mintMessageId(),
      role: 'assistant',
      parts,
      createdAt: Date.now(),
      finish: 'complete',
    }
    storeRef.current.appendMessage(threadId, assistantMessage)
    // The terminal-append fact for THIS run, on its record: stop() reads it to avoid a second
    // message, and the failure path reads it to avoid re-rendering the landed content as live.
    record.appended = true

    const priorThread = storeRef.current.threads.find((thread) => thread.id === threadId)
    const snapshot = buildDoneSnapshot(priorThread, threadId, userMessage, assistantMessage)
    record.resolving = true
    let outcome: AgentOutcome
    try {
      outcome = await resolveOutcome(snapshot)
    } finally {
      // Settled either way: the record may now be swept once a render shows its outcome.
      record.resolving = false
    }

    // Re-check: resolveOutcome above is the only await in this success path. If stop() ran while
    // it was pending, stop() already settled the thread to 'done' (appending nothing: the message
    // had landed) and deliberately did NOT call resolveOutcome a second time; this result is the
    // one outcome of the turn, so it is recorded here. Any other end (unmount, a newer run)
    // leaves the thread to whoever ended it.
    if (!live()) {
      // Only while no newer run has taken the thread: a stale resolver must not overwrite it.
      if (record.ended === 'stopped' && record.appended && owns()) {
        storeRef.current.setOutcome(threadId, outcome)
      }
      return
    }

    storeRef.current.setOutcome(threadId, outcome)
    storeRef.current.setStatus(threadId, outcome.status)
    storeRef.current.setResumeToken(threadId, undefined)
    endRun(record, 'settled')
    setRuns((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Map(prev)
      next.delete(threadId)
      return next
    })
    emit(
      buildTurnEvent({
        threadId,
        startedAt,
        firstContentAt,
        partCount: parts.length,
        status: outcome.status,
      }),
    )
  } catch (err) {
    // Guard: the run ended (stop(), unmount — which abort the controller, so their AbortError lands
    // here) or a newer stream took the thread over. Only an abort from somewhere else gets past.
    if (!live()) {
      // A resolveOutcome that stop() handed the outcome to and that then REJECTED: the stopped turn
      // stays 'done', but the failure still reaches the caller (raw, like any other).
      if (record.ended === 'stopped' && record.appended) onError?.({ threadId, error: err })
      return
    }
    const agentError = toAgentError(err)
    // The turn's final message already landed in the thread (resolveOutcome or a store call failed
    // AFTER appendMessage): the feed renders it from the thread, so the error entry keeps no parts.
    const messageLanded = record.appended
    endRun(record, 'failed')
    storeRef.current.setStatus(threadId, onFailureStatus)
    // The failed entry stays visible, with the error and the parts received so far, until the next
    // start()/retry() on this thread replaces it or stop() dismisses it.
    const failedParts = messageLanded ? [] : parts
    setRuns((prev) => {
      const next = new Map(prev)
      next.set(threadId, { status: 'error', parts: failedParts, error: agentError })
      return next
    })
    emit(
      buildTurnEvent({
        threadId,
        startedAt,
        firstContentAt,
        partCount: parts.length,
        status: onFailureStatus,
        failure: { error: err, agentError },
      }),
    )
    onError?.({ threadId, error: err })
  } finally {
    committer.cancel()
  }
}

/**
 * Finalizes a stop() call for `threadId` — the counterpart to consumeAndFinalize's success path,
 * reused so the persist/settle/resolve sequence exists exactly once. `parts` is the accumulated
 * (possibly partial) content read out of the run's `ThreadRunState` at the moment stop() was
 * called; the caller has already ended the run's record and aborted its controller before
 * invoking this. `alreadyAppended` is read by the caller (stop()) off the record's `appended` flag
 * — an explicit marker rather than an inferred comparison. `outcomeInFlight` is the record's
 * `resolving` flag: `consumeAndFinalize`'s own `resolveOutcome` is pending and records the
 * outcome, so this function must not resolve a second time.
 *
 * Ordering / the append-failure guard: the append is attempted FIRST (so a successful stop still
 * reads as 'done' with its partial content intact — this is the common case and the one that
 * matters most), but it is wrapped in its own try/catch that CANNOT prevent the terminal
 * transition below it. This is deliberate, not incidental: by the time this function runs, `stop()`
 * has already ended the run's record (see `stop()`'s own doc),
 * so a second `stop()` call is unconditionally a no-op regardless of what happens here — if the
 * append (or `mintMessageId`, which now also throws on rung 3 — see `./id.ts`) throws and nothing
 * downstream ran, the thread would be wedged at 'streaming' FOREVER with no way for the user to
 * clear it. That is exactly the standing invariant this layer forbids (see this hook's module
 * doc / the render-path degrade rule), so it must not depend on the append succeeding. The
 * alternative ordering — set status/teardown first, append after — was considered and rejected:
 * it would mark the thread 'done' before the content the user is about to lose is even attempted,
 * which is a strictly worse failure mode for the (overwhelmingly common) success path than this
 * try/catch is for the (vanishingly rare) failure path.
 *
 * On an append failure, status becomes 'error' instead of 'done' — mirroring
 * `consumeAndFinalize`'s own catch path (`onFailureStatus`), which is the existing precedent for
 * "the persist step failed, tell the user" in this file — and `resolveOutcome` is skipped
 * entirely, again matching that catch path: there is no complete/consistent snapshot worth
 * distilling into an outcome when the turn's own final message never made it into the store.
 *
 * `setStatus`/`setResumeToken` are guarded for the SAME reason, and this is not belt-and-braces:
 * they are consumer code exactly as `appendMessage` is (an adapter over a
 * remote backend, a store that rejects a threadId removed mid-stream), and guarding only the
 * append leaves the identical wedge one line further down. The single thing that must ALWAYS run
 * is the `setRuns` teardown — that entry is the HOOK'S OWN state, it is what `runs.get(threadId)`
 * reports to the UI as "a turn is in flight", and by this point `stop()` has already ENDED the
 * run's record, so no later `stop()` can ever reach here again to clean it up. A
 * throw above it therefore strands a phantom run for the lifetime of the hook. Each store call
 * gets its OWN try so a failing `setStatus` cannot also skip clearing the resume token — a
 * surviving token is separately harmful (it is what a later resume replays from).
 */
async function finalizeStop<TPart extends PartLike>(args: {
  threadId: string
  parts: TPart[]
  alreadyAppended: boolean
  /** `consumeAndFinalize`'s own `resolveOutcome` is pending and will record the outcome. */
  outcomeInFlight: boolean
  /** The stopped run's record: held `resolving` while this function's own resolver is pending. */
  record: RunRecord<TPart>
  storeRef: MutableRefObject<ThreadsStore<TPart>>
  resolveOutcome: OutcomeResolver<TPart>
  setRuns: Dispatch<SetStateAction<Map<string, ThreadRunState<TPart>>>>
  onError?: (info: { readonly threadId: string; readonly error: unknown }) => void
}): Promise<void> {
  const {
    threadId,
    parts,
    alreadyAppended,
    outcomeInFlight,
    record,
    onError,
    storeRef,
    resolveOutcome,
    setRuns,
  } = args

  let appendFailed = false
  if (!alreadyAppended && parts.length > 0) {
    try {
      const stoppedMessage: ChatMessage<TPart> = {
        // Same idempotency-key reasoning as consumeAndFinalize's assistantMessage — mintMessageId.
        // This can throw on rung 3 (no usable crypto — see ./id.ts) just like appendMessage
        // (consumer code) can throw for its own reasons; both are caught below so neither can
        // wedge the thread — see this function's doc.
        id: mintMessageId(),
        role: 'assistant',
        parts,
        createdAt: Date.now(),
        finish: 'stopped',
      }
      storeRef.current.appendMessage(threadId, stoppedMessage)
    } catch {
      appendFailed = true
    }
  }

  let settleFailed = appendFailed
  try {
    storeRef.current.setStatus(threadId, appendFailed ? 'error' : 'done')
  } catch {
    settleFailed = true
  }
  try {
    storeRef.current.setResumeToken(threadId, undefined)
  } catch {
    settleFailed = true
  }

  // Unconditional — the one step that cannot be allowed to be skipped. See this function's doc.
  setRuns((prev) => {
    if (!prev.has(threadId)) return prev
    const next = new Map(prev)
    next.delete(threadId)
    return next
  })

  // No outcome to resolve for a turn whose own terminal message never landed, or whose settle
  // never took — see this function's doc on why this mirrors consumeAndFinalize's catch path.
  if (settleFailed || outcomeInFlight) return

  const snapshot = storeRef.current.threads.find((thread) => thread.id === threadId)
  if (snapshot === undefined) return
  // Held `resolving` like consumeAndFinalize's own call: `sweepFlushed` keeps the record while the
  // resolver is pending, so a later start() still supersedes it and a stale outcome is dropped.
  record.resolving = true
  try {
    const outcome: AgentOutcome = await resolveOutcome(snapshot)
    if (isLatestRun(record)) storeRef.current.setOutcome(threadId, outcome)
  } catch (error) {
    // `stop()` calls this with `void`: a rejection must reach the caller, not become unhandled.
    // The stopped turn stays 'done'.
    onError?.({ threadId, error })
  } finally {
    record.resolving = false
  }
}

/** The `chat.turn` event for a turn that completed (`failure` absent) or failed. */
function buildTurnEvent(args: {
  threadId: string
  startedAt: number
  firstContentAt: number | undefined
  partCount: number
  status: ThreadStatus
  failure?: { readonly error: unknown; readonly agentError: AgentError }
}): BasaltEvent {
  const { threadId, startedAt, firstContentAt, partCount, status, failure } = args
  const endedAt = now()
  const base = {
    start: startedAt,
    duration: endedAt - startedAt,
  }
  const attributes = {
    'basalt.chat.thread_id': threadId,
    'basalt.chat.ttft_ms': (firstContentAt ?? endedAt) - startedAt,
    'basalt.chat.parts': partCount,
    'basalt.chat.status': status,
  }
  if (failure === undefined) return { ...base, type: 'chat.turn', failed: false, attributes }
  return {
    ...base,
    type: 'chat.turn',
    failed: true,
    attributes: {
      ...attributes,
      'exception.type': errorName(failure.error),
      'basalt.error.kind': failure.agentError.kind,
    },
  }
}

// ── useAgentThreadRuns ────────────────────────────────────────────────────────

/**
 * Manages N concurrent streaming agent turns — one per thread id — over an injected
 * AgentTransport and ThreadsStore. Starting a turn on a thread that already has one in
 * flight is a no-op; different threads stream fully concurrently.
 *
 * @example
 * const { runs, start, stop, stopAll } = useAgentThreadRuns({ transport, store, resolveOutcome })
 * start(threadA, 'Summarize this PR')
 * start(threadB, 'What changed in the last release?')
 * // both stream concurrently; runs.get(threadA) / runs.get(threadB) update independently
 */
export function useAgentThreadRuns<TPart extends PartLike = AgentPart>({
  transport,
  store,
  resolveOutcome,
  toUserParts,
  onError,
  throttle = 0,
  telemetry,
}: UseAgentThreadRunsArgs<TPart>): UseAgentThreadRunsReturn<TPart> {
  const [runs, setRuns] = useState<Map<string, ThreadRunState<TPart>>>(new Map())
  // Mirrors the latest `runs` state every render so stop() (a plain callback, not a render) can
  // synchronously read a thread's accumulated parts without going through an async setState
  // updater — same mirroring pattern as storeRef/transportRef below.
  const runsRef = useRef(runs)
  runsRef.current = runs
  // Mirrors the latest onError every render (same pattern as storeRef/transportRef) so a stale
  // closure from an earlier render never fires instead of the consumer's current callback.
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  // Same for the telemetry sink, read at emit time so an inline function never re-subscribes.
  const providerSink = useContext(TelemetryContext)
  const telemetryRef = useRef(telemetry ?? providerSink)
  telemetryRef.current = telemetry ?? providerSink
  const throttleRef = useRef(throttle)
  throttleRef.current = throttle
  // One record per thread id holds the run's lifecycle — controller, unthrottled parts, whether its
  // terminal message landed, how it ended — written together through `./run-records` (see there for
  // why these are not separate maps). A run is live while its record's `ended` is undefined.
  const recordsRef = useRef<RunRecords<TPart>>(new Map())
  // Caches the last user input per thread so retry() can replay a failed turn without the
  // caller having to hold onto (or re-collect) what was typed.
  const lastInputRef = useRef<Map<string, string>>(new Map())
  // Mirrors the latest store every render so completion callbacks (which fire long after the
  // render that started them) read the freshest threads rather than a stale closure.
  const storeRef = useRef(store)
  storeRef.current = store
  // Mirrors the latest transport prop every render (same pattern as storeRef) so
  // resolveTransport() always reads the freshest value, whether it's a plain object or a factory.
  const transportRef = useRef(transport)
  transportRef.current = transport
  // Per-thread transport cache, only populated when `transport` is a factory: resolved (and
  // memoized) the first time a thread needs one, in either start() or the mount-time resume
  // effect, then reused for every subsequent call on that same thread id.
  const transportsRef = useRef<Map<string, AgentTransport<TPart, string>>>(new Map())
  // The default only applies when TPart is the framework default AgentPart; custom part unions
  // must pass toUserParts explicitly. Cast is scoped to this one fallback assignment.
  const resolvedToUserParts =
    toUserParts ?? (defaultToUserParts as unknown as (input: string) => TPart[])
  const toUserPartsRef = useRef(resolvedToUserParts)
  toUserPartsRef.current = resolvedToUserParts

  // Stable over the sink ref, so an inline `telemetry` function never changes what `start` closes over.
  const emitTelemetry = useMemo<Telemetry>(
    () => createEmitter((event) => telemetryRef.current?.(event)),
    [],
  )

  // Resolves the transport for `threadId`: the shared object as-is for the plain-object form
  // (unchanged behavior), or the factory's result — resolved once per thread id and cached in
  // transportsRef thereafter — for the factory form. Not itself memoized (cheap to recreate each
  // render); correctness comes from always reading transportRef/transportsRef, not from stability.
  const resolveTransport = (threadId: string): AgentTransport<TPart, string> => {
    const currentTransport = transportRef.current
    if (typeof currentTransport !== 'function') return currentTransport
    const cached = transportsRef.current.get(threadId)
    if (cached !== undefined) return cached
    const resolved = currentTransport(threadId)
    transportsRef.current.set(threadId, resolved)
    return resolved
  }

  // Abort every in-flight stream on unmount to stop the async generators. Also clears the map —
  // leaving aborted records behind would make the mount-reconcile effect below see a live run
  // for a thread whose only consumer was just aborted,
  // skipping the orphan-resume path and wedging the thread in 'streaming' forever. Reachable
  // whenever this fiber's effects re-run without the fiber itself unmounting (React 19 StrictMode
  // double-invoke; `<Activity>` hide/show) — see this hook's `@example`-adjacent doc / the F3 note.
  //
  // Also tears down the matching `runs` entries — the F3 fix above stopped this from wedging
  // the run records/the *persisted* thread status, but left `runs` (this hook's own transient
  // state) untouched, and on a re-run-without-unmount the component (and its `runs` state) survive
  // this cleanup. Without this, the entry the aborted controller was updating stays in `runs`
  // reporting `status: 'streaming'` forever: the mount-reconcile effect below DOES correctly settle
  // the persisted thread (to a resumed run, or to 'interrupted' if not resumable), but a consumer
  // deriving "is this thread live" from `runs.has(id)` — the whole reason `runs` exists — keeps
  // seeing a phantom in-flight turn no controller is driving anymore, and `stop()` on it was a
  // permanent no-op (no live record left to abort) — see `stop()`'s own doc. Scoped to
  // exactly the threadIds this pass is aborting (not a blind `runs.clear()`): the mount-reconcile
  // effect below runs AFTER this cleanup completes, in the same synchronous commit — StrictMode's
  // dev-only double-invoke and `<Activity>` hide/show both destroy-then-recreate EVERY mount effect
  // on this fiber together, in declaration order, regardless of each effect's own dep array (this
  // one stays `[]`; the reconcile effect below is `[store.hydrated]` as of R3 — the double-invoke
  // guarantee is about the mount/unmount CYCLE, not per-effect dep memoization) — a resumable
  // thread's reconcile pass registers a FRESH
  // controller and a fresh `runs` entry there, and this teardown must never clobber that. It
  // can't: by the time this cleanup runs, nothing has created a NEW entry for these threadIds yet
  // (that only happens in the reconcile effect, still to come), so scoping to the ids this pass is
  // itself aborting is exact, not merely defensive.
  useEffect(
    () => () => {
      const abortedThreadIds: string[] = []
      for (const [threadId, record] of recordsRef.current) {
        if (record.ended !== undefined) continue
        abortedThreadIds.push(threadId)
        record.controller.abort()
      }
      recordsRef.current.clear()
      if (abortedThreadIds.length === 0) return
      setRuns((prev) => {
        let next: Map<string, ThreadRunState<TPart>> | undefined
        for (const threadId of abortedThreadIds) {
          if (!prev.has(threadId)) continue
          next ??= new Map(prev)
          next.delete(threadId)
        }
        return next ?? prev
      })
    },
    [],
  )

  // Once a render shows a run's outcome, its terminal record has done its job (covering the window
  // before that render); drop it so thread ids are not retained for the life of the hook.
  useEffect(() => {
    sweepFlushed(recordsRef.current, runs)
  })

  // Reconcile orphaned in-flight threads once the store is HYDRATED: a persisted thread can be
  // stuck 'pending' or 'streaming' after a reload/remount, since the run records and `runs` both
  // start empty — nothing would otherwise resolve that skeleton. If the transport supports
  // resumption and the thread has a resumeToken (from a StartPart emitted before the disconnect)
  // plus a user message to resume from, attempt to reconnect the run instead. Any other case — no
  // resume(), no resumeToken, no user message, or the resume itself failing — falls back to
  // 'interrupted' so the UI renders a resend prompt instead of an unresolving skeleton (today's
  // behavior, unchanged as the fallback path).
  //
  // R3: keyed on `store.hydrated` rather than a bare `[]`-dep effect. `ThreadsStore.hydrated` is
  // always `true` for the localStorage store (createPersistedState resolves synchronously), so this
  // still fires on the very first commit for every consumer that predates this change — no behavior
  // change there. It only matters for an ASYNC store (`createAdapterThreadsStore`): with `[]`, this
  // ran on mount while `store.threads` was still the adapter's empty pre-load snapshot, so every
  // orphaned thread from a previous session was invisible to the sweep — reconcile-after-reload was
  // silently dead for exactly the store shape (server-backed, paginated) that most needs it. Firing
  // again when `hydrated` flips true re-sweeps against the now-real `storeRef.current.threads`.
  //
  // Deliberately NO separate "has this already run" ref here — the sweep is naturally idempotent:
  // a thread only qualifies as orphaned while its status is 'pending'/'streaming' AND it has no
  // live controller, and this effect's own first pass either moves the status off that pair
  // ('interrupted', or eventually 'done'/'error' once the resumed/started run settles) or registers
  // a controller for it synchronously (before the first `await`) — so a second invocation with the
  // SAME `store.hydrated` value (including React 19 StrictMode's dev-only double-invoke of every
  // mount effect, and an `<Activity>` hide/show — see use-agent-thread-runs.wedge.test.tsx) finds
  // nothing left to reconcile except whatever its own sibling invocation genuinely orphaned by
  // aborting an in-flight controller, which is exactly the case that file's (b)/(c) tests require
  // resume() to fire again for. An explicit "ran once" ref would suppress that second, legitimate
  // sweep and reintroduce the F3 wedge for `store.hydrated`-keyed remounts.
  useEffect(() => {
    if (!store.hydrated) return
    for (const thread of storeRef.current.threads) {
      const orphaned =
        (thread.status === 'pending' || thread.status === 'streaming') &&
        !hasLiveRun(recordsRef.current, thread.id)
      if (!orphaned) continue

      const resumeToken = thread.resumeToken
      const lastUserMessage = thread.messages.filter((message) => message.role === 'user').at(-1)
      const resolvedTransport = resolveTransport(thread.id)

      // isResumable requires BOTH `resume` and the literal `idempotentReplay: true` assertion —
      // a transport with `resume` alone is not enough (see ResumableAgentTransport's doc).
      if (
        !isResumable(resolvedTransport) ||
        resumeToken === undefined ||
        lastUserMessage === undefined
      ) {
        storeRef.current.setStatus(thread.id, 'interrupted')
        continue
      }
      const resume = resolvedTransport.resume

      const controller = new AbortController()
      const record = beginRun(recordsRef.current, thread.id, controller)
      setRuns((prev) => {
        const next = new Map(prev)
        next.set(thread.id, { status: 'submitted', parts: [] })
        return next
      })

      void consumeAndFinalize({
        threadId: thread.id,
        record,
        // Namespaced by thread.id (stable across a thread's whole lifetime, including this
        // resume) rather than per-call — see withPartIds' own doc for why this is NOT a replay-
        // convergence guarantee on its own: it only protects against two id-less drafts within
        // ONE generator colliding (the F1 bug). A transport whose resume() needs genuine replay
        // safety must assert `idempotentReplay: true` AND mint its own content-stable ids (as
        // aiSdkTransport does) — withPartIds is then a no-op passthrough for it, not the mechanism
        // providing that safety.
        generator: withPartIds(thread.id, resume(resumeToken, controller.signal)),
        userMessage: lastUserMessage,
        recordsRef,
        storeRef,
        resolveOutcome,
        setRuns,
        onFailureStatus: 'interrupted',
        throttle: throttleRef.current,
        emit: emitTelemetry,
        onError: (info) => onErrorRef.current?.(info),
      })
    }
    // Only `store.hydrated` — every other read in this body goes through a ref (storeRef,
    // resolveTransport→transportRef/transportsRef, resolveOutcome closed over from the hook's own
    // args) precisely so this effect's re-run trigger is `hydrated` alone. See the doc above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated])

  const start = useCallback(
    (threadId: string, input: string): void => {
      // Ignore a second concurrent turn on the SAME thread; different threads run concurrently.
      if (hasLiveRun(recordsRef.current, threadId)) return

      lastInputRef.current.set(threadId, input)

      const userMessage: ChatMessage<TPart> = {
        // Same idempotency-key reasoning as consumeAndFinalize's assistantMessage — mintMessageId.
        id: mintMessageId(),
        role: 'user',
        parts: toUserPartsRef.current(input),
        createdAt: Date.now(),
      }
      storeRef.current.appendMessage(threadId, userMessage)
      storeRef.current.setStatus(threadId, 'streaming')
      setRuns((prev) => {
        const next = new Map(prev)
        next.set(threadId, { status: 'submitted', parts: [] })
        return next
      })

      const controller = new AbortController()
      const record = beginRun(recordsRef.current, threadId, controller)
      const resolvedTransport = resolveTransport(threadId)

      // Non-awaited: this consumer runs in the background so start() returns immediately and
      // multiple threads can stream at once.
      void consumeAndFinalize({
        threadId,
        record,
        // Namespaced by threadId — same choice, same caveat, as the mount-time resume call above.
        // ctx.messageId is this turn's OWN idempotency key (userMessage.id, just minted above) —
        // a transport that accepts it (aiSdkTransport) mints its wire-level message with the SAME
        // id instead of a second, unrelated one (R1 — see AgentTransport.stream's doc).
        generator: withPartIds(
          threadId,
          resolvedTransport.stream(input, controller.signal, { messageId: userMessage.id }),
        ),
        userMessage,
        recordsRef,
        storeRef,
        resolveOutcome,
        setRuns,
        onFailureStatus: 'error',
        throttle: throttleRef.current,
        emit: emitTelemetry,
        onError: (info) => onErrorRef.current?.(info),
      })
    },
    [emitTelemetry, resolveOutcome],
  )

  const retry = useCallback(
    (threadId: string): void => {
      const input = lastInputRef.current.get(threadId)
      if (input === undefined) return
      start(threadId, input)
    },
    [start],
  )

  const dismiss = useCallback((threadId: string): void => {
    dismissRun(recordsRef.current, threadId)
    setRuns((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Map(prev)
      next.delete(threadId)
      return next
    })
  }, [])

  const stop = useCallback(
    (threadId: string): void => {
      // Decided from the run's record, which start() writes synchronously — NOT from `runsRef`,
      // which only mirrors the last flushed render. `onClick={() => { start(id, text); stop(id) }}`
      // has a live record but no rendered entry yet, and a settle's `setRuns` leaves the entry
      // visible to `runsRef` until the next render; reading `runs` here stranded the first and
      // double-appended the second. `planStop` falls back to the rendered entry only when no
      // record exists.
      const plan = planStopWithTombstone(
        recordsRef.current,
        threadId,
        runsRef.current.get(threadId),
      )
      if (plan.kind === 'noop') return
      if (plan.kind === 'dismiss') {
        dismiss(threadId)
        return
      }
      const { record, parts } = plan
      // Capture before endRun empties the record.
      const { appended, resolving } = record
      endRun(record, 'stopped')
      record.controller.abort()
      void finalizeStop({
        threadId,
        parts,
        alreadyAppended: appended,
        outcomeInFlight: resolving,
        record,
        storeRef,
        resolveOutcome,
        setRuns,
        onError: (info) => onErrorRef.current?.(info),
      })
    },
    [dismiss, resolveOutcome],
  )

  const stopAll = useCallback((): void => {
    for (const [threadId, record] of Array.from(recordsRef.current)) {
      if (record.ended === undefined) stop(threadId)
    }
    // Failed entries have no live run. Sweep the records AND what `runs` shows: an unmount re-run
    // (StrictMode, `<Activity>`) clears the records while the failed entries survive.
    for (const threadId of failedThreadIds(recordsRef.current, runsRef.current)) stop(threadId)
  }, [stop])

  return { runs, start, retry, stop, stopAll }
}
