/**
 * useAgentThreadRuns — concurrent multi-thread stream run manager.
 *
 * Unlike useAgentStream (ONE in-flight turn — a new send() aborts the previous one),
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
 * import { useAgentThreadRuns, createThreadsStore, edenTransport, heuristicOutcome } from 'basalt-ui/agent'
 *
 * const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })
 * const transport = edenTransport((input, signal) =>
 *   api.chat.post({ body: { message: input }, fetch: { signal } }),
 * )
 *
 * function ThreadFeed() {
 *   const store = useThreads()
 *   const { runs, start, stop } = useAgentThreadRuns({
 *     transport,
 *     store,
 *     resolveOutcome: heuristicOutcome,
 *   })
 *   const id = store.create()
 *   return (
 *     <div>
 *       <button onClick={() => start(id, 'Hello')}>Send</button>
 *       {runs.get(id)?.status === 'streaming' && <button onClick={() => stop(id)}>Stop</button>}
 *     </div>
 *   )
 * }
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatMessage } from './history'
import { mintMessageId, mintThreadId, withPartIds } from './id'
import { mergePart } from './merge'
import type { PartLike } from './merge'
import type { AgentOutcome, OutcomeResolver } from './outcome'
import { isStartPart } from './parts'
import type { AgentPart } from './parts'
import type { AgentThread, ThreadStatus, ThreadsStore } from './thread'
import { isResumable } from './transport'
import type { AgentTransport } from './transport'

// ── ThreadRunState ────────────────────────────────────────────────────────────

/**
 * The live stream state of a single thread's in-flight turn.
 *
 * A thread only has an entry in the `runs` map while its turn is actively streaming — once a
 * turn finishes (success or error), its entry is deleted from the map (the outcome lives on the
 * persisted `AgentThread` instead). So `status` only ever holds `'streaming'`; there is no
 * `'done'`/`'idle'`/`'error'` to observe here.
 *
 * @example
 * const state: ThreadRunState = { status: 'streaming', parts: [{ type: 'text', text: 'Hi' }] }
 */
export type ThreadRunState<TPart = AgentPart> = {
  /** Always `'streaming'` — see the type doc for why no other status is reachable here. */
  readonly status: 'streaming'
  /** Accumulated parts from the current stream for this thread. */
  readonly parts: TPart[]
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
   * Called when a turn's stream throws — never for an `AbortError` (an intentional stop()/
   * supersede, not a failure worth surfacing). Fires from the SAME catch branch that sets
   * `onFailureStatus` on the thread, so a caller wanting a toast/notification for a genuine
   * transport error (a 409/503/401, argo's hermes-chat S19) no longer has to wrap every transport
   * call in its own generator to intercept the throw — see `consumeAndFinalize`'s catch block.
   */
  readonly onError?: (info: { readonly threadId: string; readonly error: unknown }) => void
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
   * Abort the in-flight stream for `threadId` (true no-op only if BOTH `controllersRef` and
   * `runs` have nothing for it — i.e. the thread genuinely isn't live). Preserves whatever content
   * had already arrived: if the run had accumulated any parts, they're persisted as an assistant
   * ChatMessage with `finish: 'stopped'` (unless that message already landed — see finalizeStop),
   * then distilled into an outcome and the thread is settled to 'done'.
   *
   * Defense-in-depth: if `runs` reports `threadId` as `'streaming'` but no controller is
   * registered for it (a phantom entry — not reachable via any path in this hook today, since the
   * unmount-cleanup effect and `finalizeStop` both tear down `controllersRef` and `runs` together,
   * but guarded against here so nothing in this file can EVER wedge a thread the UI shows as live
   * with no way to reach a terminal state), `stop()` still settles it instead of silently
   * no-opping forever.
   */
  readonly stop: (threadId: string) => void
  /** Abort every in-flight stream across all threads, settling each the same way stop() would. */
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
 * `onFailureStatus` is the ThreadStatus to set when the generator throws (excluding AbortError,
 * which is always a no-op): start() passes 'error' (today's behavior for a fresh turn that fails);
 * the resume path passes 'interrupted' (a failed resume falls back to the same terminal state a
 * non-resumable orphaned thread already lands in).
 */
async function consumeAndFinalize<TPart extends PartLike>(args: {
  threadId: string
  controller: AbortController
  generator: AsyncGenerator<TPart>
  userMessage: ChatMessage<TPart>
  controllersRef: MutableRefObject<Map<string, AbortController>>
  appendedRef: MutableRefObject<Map<string, AbortController>>
  storeRef: MutableRefObject<ThreadsStore<TPart>>
  resolveOutcome: OutcomeResolver<TPart>
  setRuns: Dispatch<SetStateAction<Map<string, ThreadRunState<TPart>>>>
  onFailureStatus: ThreadStatus
  onError?: (info: { readonly threadId: string; readonly error: unknown }) => void
}): Promise<void> {
  const {
    threadId,
    controller,
    generator,
    userMessage,
    controllersRef,
    appendedRef,
    storeRef,
    resolveOutcome,
    setRuns,
    onFailureStatus,
    onError,
  } = args
  let parts: TPart[] = []
  try {
    for await (const part of generator) {
      // Guard: a newer call superseded this stream's controller for this thread, or it
      // was aborted — stop updating state.
      //
      // Deliberately NOT a `runs` teardown site (considered and rejected): `controllersRef`
      // mismatch here is ambiguous between "this run was aborted and nothing replaced it" and "a
      // newer run (a mount-reconcile resume, keyed by the SAME threadId) has already taken over
      // and is live in `runs` right now". Only the first case should ever clear `runs[threadId]`,
      // and only the abort's OWN originator can tell the two apart without a race — the unmount-
      // cleanup effect (see its doc) does that teardown synchronously, in the same tick as the
      // abort, before any newer run could exist to be confused with. If this guard also deleted
      // `runs[threadId]`, a superseding resume's fresh entry would be clobbered out from under it
      // by its OWN predecessor's late-settling loop iteration — reintroducing a wedge instead of
      // fixing one. `stop()`'s own abort path has the same property (finalizeStop's teardown runs
      // synchronously before `stop()` returns, never racing a subsequent call).
      if (controllersRef.current.get(threadId) !== controller) return
      if (controller.signal.aborted) return
      if (isStartPart(part)) {
        storeRef.current.setResumeToken(threadId, part.resumeToken)
        continue
      }
      // mergePart REWRITES an existing id in place (never mutates `parts` — reassigns to the new
      // array it returns), so the local accumulator and the rendered `runs` snapshot below stay
      // identical: a replayed/resumed delta rewrites its part instead of duplicating it.
      parts = mergePart(parts, part)
      setRuns((prev) => {
        const next = new Map(prev)
        next.set(threadId, { status: 'streaming', parts })
        return next
      })
    }
    // Only proceed if this stream is still the current one and wasn't aborted.
    if (controllersRef.current.get(threadId) !== controller || controller.signal.aborted) {
      return
    }

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
    // Record the terminal-append fact for THIS run (identified by `controller`, mirroring
    // controllersRef's own per-thread/per-run keying) — see appendedRef's doc on why this, and not
    // array-reference equality, is what finalizeStop checks.
    appendedRef.current.set(threadId, controller)

    const priorThread = storeRef.current.threads.find((thread) => thread.id === threadId)
    const snapshot = buildDoneSnapshot(priorThread, threadId, userMessage, assistantMessage)
    const outcome: AgentOutcome = await resolveOutcome(snapshot)

    // Re-check: resolveOutcome above is the only await in this function's success path, and
    // stop() may have run while it was pending — aborting the controller, appending its own
    // 'stopped' message only if appendedRef didn't already carry this run's marker (see
    // finalizeStop), and already forcing the thread to 'done'. Without this recheck, a slow
    // resolveOutcome settling AFTER stop() has already finalized the thread would silently
    // overwrite that outcome with whatever THIS call resolved to.
    if (controllersRef.current.get(threadId) !== controller || controller.signal.aborted) {
      return
    }

    storeRef.current.setOutcome(threadId, outcome)
    storeRef.current.setStatus(threadId, outcome.status)
    storeRef.current.setResumeToken(threadId, undefined)
    controllersRef.current.delete(threadId)
    appendedRef.current.delete(threadId)
    setRuns((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Map(prev)
      next.delete(threadId)
      return next
    })
  } catch (err) {
    // Ignore abort errors — they are intentional (stop() was called or superseded).
    if (err instanceof Error && err.name === 'AbortError') return
    // Guard: don't corrupt state if a newer stream has taken over this thread.
    if (controllersRef.current.get(threadId) !== controller) return
    // Guard: don't overwrite a user-cancelled state if the signal was aborted.
    if (controller.signal.aborted) return
    storeRef.current.setStatus(threadId, onFailureStatus)
    controllersRef.current.delete(threadId)
    appendedRef.current.delete(threadId)
    setRuns((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Map(prev)
      next.delete(threadId)
      return next
    })
    onError?.({ threadId, error: err })
  }
}

/**
 * Finalizes a stop() call for `threadId` — the counterpart to consumeAndFinalize's success path,
 * reused so the persist/settle/resolve sequence exists exactly once. `parts` is the accumulated
 * (possibly partial) content read out of the run's `ThreadRunState` at the moment stop() was
 * called; the caller has already aborted the controller and cleared `controllersRef` before
 * invoking this. `alreadyAppended` is precomputed by the caller (stop()) from `appendedRef` — see
 * that ref's doc for why this is an explicit marker rather than an inferred comparison.
 *
 * Ordering / the append-failure guard: the append is attempted FIRST (so a successful stop still
 * reads as 'done' with its partial content intact — this is the common case and the one that
 * matters most), but it is wrapped in its own try/catch that CANNOT prevent the terminal
 * transition below it. This is deliberate, not incidental: by the time this function runs, `stop()`
 * has already deleted `threadId` from `controllersRef` and `appendedRef` (see `stop()`'s own doc),
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
 * they are consumer code exactly as `appendMessage` is (a `createThreadsStore` adapter over a
 * remote backend, a store that rejects a threadId removed mid-stream), and guarding only the
 * append leaves the identical wedge one line further down. The single thing that must ALWAYS run
 * is the `setRuns` teardown — that entry is the HOOK'S OWN state, it is what `runs.get(threadId)`
 * reports to the UI as "a turn is in flight", and by this point `stop()` has already deleted the
 * thread from `controllersRef`, so no later `stop()` can ever reach here again to clean it up. A
 * throw above it therefore strands a phantom run for the lifetime of the hook. Each store call
 * gets its OWN try so a failing `setStatus` cannot also skip clearing the resume token — a
 * surviving token is separately harmful (it is what a later resume replays from).
 */
async function finalizeStop<TPart extends PartLike>(args: {
  threadId: string
  parts: TPart[]
  alreadyAppended: boolean
  storeRef: MutableRefObject<ThreadsStore<TPart>>
  resolveOutcome: OutcomeResolver<TPart>
  setRuns: Dispatch<SetStateAction<Map<string, ThreadRunState<TPart>>>>
}): Promise<void> {
  const { threadId, parts, alreadyAppended, storeRef, resolveOutcome, setRuns } = args

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
  if (settleFailed) return

  const snapshot = storeRef.current.threads.find((thread) => thread.id === threadId)
  if (snapshot === undefined) return
  const outcome: AgentOutcome = await resolveOutcome(snapshot)
  storeRef.current.setOutcome(threadId, outcome)
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

  // Refs: mutable per-render state that must not trigger re-renders.
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  // Explicit single-writer marker: has THIS run's terminal assistant message already been
  // appended? Keyed the same way as controllersRef (threadId -> the specific run's controller),
  // set by consumeAndFinalize the instant it appends, and cleared on every path that ends a run
  // (normal completion, the error path, stop(), and unmount) — same lifecycle discipline as
  // controllersRef, deliberately, since that's the existing coordination channel between
  // consumeAndFinalize and stop()/finalizeStop.
  //
  // This replaces an earlier reference-equality check (`lastMessage.parts === parts`) that
  // compared the array runsRef mirrors against the array the message actually persisted. That
  // comparison implicitly depended on THREE things staying true at once: the run-state mirror not
  // re-copying `parts` on every delta, the accumulator reassigning (never mutating) `parts`, and —
  // the one that actually broke it — React's flush timing: runsRef is only updated during a
  // render (`runsRef.current = runs`, assigned unconditionally on every render, not in an effect),
  // so a setRuns dispatch that hasn't yet flushed into a render leaves runsRef holding an EARLIER
  // parts array. A stop() landing between consumeAndFinalize's post-loop appendMessage and its
  // `await resolveOutcome` resolving could observe exactly that staleness and defeat the
  // reference-equality guard, double-appending — see the regression test with "resolveOutcome"
  // in its name. Keying by controller identity (an AbortController, freshly minted per run) makes
  // a false-positive match across two different runs on the same thread structurally
  // impossible — no render, no array-copy semantics, no accumulator-reassignment assumption is
  // load-bearing anymore.
  const appendedRef = useRef<Map<string, AbortController>>(new Map())
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
  // leaving aborted entries behind would make the mount-reconcile effect below see a
  // `controllersRef.current.has(id)` of `true` for a thread whose only consumer was just aborted,
  // skipping the orphan-resume path and wedging the thread in 'streaming' forever. Reachable
  // whenever this fiber's effects re-run without the fiber itself unmounting (React 19 StrictMode
  // double-invoke; `<Activity>` hide/show) — see this hook's `@example`-adjacent doc / the F3 note.
  //
  // Also tears down the matching `runs` entries — the F3 fix above stopped this from wedging
  // `controllersRef`/the *persisted* thread status, but left `runs` (this hook's own transient
  // state) untouched, and on a re-run-without-unmount the component (and its `runs` state) survive
  // this cleanup. Without this, the entry the aborted controller was updating stays in `runs`
  // reporting `status: 'streaming'` forever: the mount-reconcile effect below DOES correctly settle
  // the persisted thread (to a resumed run, or to 'interrupted' if not resumable), but a consumer
  // deriving "is this thread live" from `runs.has(id)` — the whole reason `runs` exists — keeps
  // seeing a phantom in-flight turn no controller is driving anymore, and `stop()` on it was a
  // permanent no-op (nothing left in `controllersRef` to abort) — see `stop()`'s own doc. Scoped to
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
      const abortedThreadIds = Array.from(controllersRef.current.keys())
      controllersRef.current.forEach((controller) => controller.abort())
      controllersRef.current.clear()
      appendedRef.current.clear()
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

  // Reconcile orphaned in-flight threads once the store is HYDRATED: a persisted thread can be
  // stuck 'pending' or 'streaming' after a reload/remount, since controllersRef and `runs` both
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
        !controllersRef.current.has(thread.id)
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
      controllersRef.current.set(thread.id, controller)
      setRuns((prev) => {
        const next = new Map(prev)
        next.set(thread.id, { status: 'streaming', parts: [] })
        return next
      })

      void consumeAndFinalize({
        threadId: thread.id,
        controller,
        // Namespaced by thread.id (stable across a thread's whole lifetime, including this
        // resume) rather than per-call — see withPartIds' own doc for why this is NOT a replay-
        // convergence guarantee on its own: it only protects against two id-less drafts within
        // ONE generator colliding (the F1 bug). A transport whose resume() needs genuine replay
        // safety must assert `idempotentReplay: true` AND mint its own content-stable ids (as
        // aiSdkTransport does) — withPartIds is then a no-op passthrough for it, not the mechanism
        // providing that safety.
        generator: withPartIds(thread.id, resume(resumeToken, controller.signal)),
        userMessage: lastUserMessage,
        controllersRef,
        appendedRef,
        storeRef,
        resolveOutcome,
        setRuns,
        onFailureStatus: 'interrupted',
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
      if (controllersRef.current.has(threadId)) return

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
        next.set(threadId, { status: 'streaming', parts: [] })
        return next
      })

      const controller = new AbortController()
      controllersRef.current.set(threadId, controller)
      const resolvedTransport = resolveTransport(threadId)

      // Non-awaited: this consumer runs in the background so start() returns immediately and
      // multiple threads can stream at once.
      void consumeAndFinalize({
        threadId,
        controller,
        // Namespaced by threadId — same choice, same caveat, as the mount-time resume call above.
        // ctx.messageId is this turn's OWN idempotency key (userMessage.id, just minted above) —
        // a transport that accepts it (aiSdkTransport) mints its wire-level message with the SAME
        // id instead of a second, unrelated one (R1 — see AgentTransport.stream's doc).
        generator: withPartIds(
          threadId,
          resolvedTransport.stream(input, controller.signal, { messageId: userMessage.id }),
        ),
        userMessage,
        controllersRef,
        appendedRef,
        storeRef,
        resolveOutcome,
        setRuns,
        onFailureStatus: 'error',
        onError: (info) => onErrorRef.current?.(info),
      })
    },
    [resolveOutcome],
  )

  const retry = useCallback(
    (threadId: string): void => {
      const input = lastInputRef.current.get(threadId)
      if (input === undefined) return
      start(threadId, input)
    },
    [start],
  )

  const stop = useCallback(
    (threadId: string): void => {
      const controller = controllersRef.current.get(threadId)
      // No in-flight run for this thread — true no-op, matching this hook's stop() JSDoc. Decided
      // from controllersRef, NOT runsRef: controllersRef is written synchronously by start() (line
      // ~509, before consumeAndFinalize is even invoked), while runsRef only mirrors `runs` as of
      // the last FLUSHED RENDER (`runsRef.current = runs`, assigned during render, above). A
      // start() immediately followed by stop() in the same synchronous tick/act() batch — e.g.
      // `onClick={() => { start(id, text); stop(id) }}` — has controllersRef already populated but
      // runsRef still holding the PREVIOUS render's (empty) map. Gating on runsRef here would read
      // `undefined`, wrongly treat this as a no-op, leave the controller registered and never
      // abort it — stranding the run in 'streaming' (see the F4 regression test).
      if (controller === undefined) {
        // No controller — but if `runs` still reports this thread as live, that's a phantom entry
        // (see this hook's `stop()` JSDoc): nothing is driving it, and with no controller to key
        // off of, this is the only remaining path that can ever settle it. Not reachable via any
        // path in THIS file today (the unmount-cleanup effect and finalizeStop both tear down
        // `controllersRef` and `runs` in the same synchronous step — see their docs), but a true
        // no-op here would mean "the UI shows this thread streaming forever, and Stop can never
        // clear it" the instant that invariant is ever broken by a future change. Settle it via the
        // same finalizeStop() the normal path uses, so there is still exactly one teardown routine
        // for "a run is ending" regardless of how it got here.
        if (!runsRef.current.has(threadId)) return
        const parts = runsRef.current.get(threadId)?.parts ?? []
        const alreadyAppended = appendedRef.current.has(threadId)
        appendedRef.current.delete(threadId)
        void finalizeStop({ threadId, parts, alreadyAppended, storeRef, resolveOutcome, setRuns })
        return
      }

      controllersRef.current.delete(threadId)
      // Read the accumulated parts straight out of the live run entry (runsRef mirrors `runs` as of
      // the last flushed render) — falls back to [] for the same synchronous start()-then-stop()
      // case above, where no render has flushed yet; finalizeStop already treats an empty `parts`
      // as "nothing to persist".
      const parts = runsRef.current.get(threadId)?.parts ?? []

      controller.abort()

      // Was THIS run's terminal message already appended by consumeAndFinalize's own success path
      // (it can race this call — see appendedRef's doc)? Matched by controller identity, not by
      // comparing `parts` against anything React-observed, so this is correct regardless of
      // whether runsRef has flushed the latest delta yet.
      const alreadyAppended = appendedRef.current.get(threadId) === controller
      appendedRef.current.delete(threadId)

      void finalizeStop({ threadId, parts, alreadyAppended, storeRef, resolveOutcome, setRuns })
    },
    [resolveOutcome],
  )

  const stopAll = useCallback((): void => {
    for (const threadId of Array.from(controllersRef.current.keys())) {
      stop(threadId)
    }
  }, [stop])

  return { runs, start, retry, stop, stopAll }
}
