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
import { withPartIds } from './id'
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
}

// ── useAgentThreadRuns return type ────────────────────────────────────────────

export type UseAgentThreadRunsReturn<TPart = AgentPart> = {
  /** Live stream state per thread id, for threads with a run in progress or just completed. */
  readonly runs: ReadonlyMap<string, ThreadRunState<TPart>>
  /** Start a new turn on `threadId`. No-op if that thread already has a stream in flight. */
  readonly start: (threadId: string, input: string) => void
  /**
   * Replay the last user input sent on `threadId` (same code path as `start`). No-op if
   * `threadId` has never had a turn started, or already has one in flight.
   */
  readonly retry: (threadId: string) => void
  /**
   * Abort the in-flight stream for `threadId` (no-op if idle). Preserves whatever content had
   * already arrived: if the run had accumulated any parts, they're persisted as an assistant
   * ChatMessage with `finish: 'stopped'` (unless that message already landed — see finalizeStop),
   * then distilled into an outcome and the thread is settled to 'done'.
   */
  readonly stop: (threadId: string) => void
  /** Abort every in-flight stream across all threads, settling each the same way stop() would. */
  readonly stopAll: () => void
}

// ── defaults ──────────────────────────────────────────────────────────────────

/** Default toUserParts: wraps raw input in a single text part. */
function defaultToUserParts(input: string): AgentPart[] {
  return [{ id: crypto.randomUUID(), type: 'text', text: input }]
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
  } = args
  let parts: TPart[] = []
  try {
    for await (const part of generator) {
      // Guard: a newer call superseded this stream's controller for this thread, or it
      // was aborted — stop updating state.
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
      id: crypto.randomUUID(),
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
 * Ordering: the append, forcing status to 'done', clearing the resume token, and tearing down the
 * run entry ALL happen synchronously (this function's body runs synchronously up to its one
 * `await`) — status is never derived from the resolved outcome, so it doesn't need to wait on one,
 * matching useAgentStream's stop(), which settles 'done' immediately rather than blocking on async
 * work. Only `setOutcome` — which genuinely needs the resolved value — happens after the await.
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

  if (!alreadyAppended && parts.length > 0) {
    const stoppedMessage: ChatMessage<TPart> = {
      id: crypto.randomUUID(),
      role: 'assistant',
      parts,
      createdAt: Date.now(),
      finish: 'stopped',
    }
    storeRef.current.appendMessage(threadId, stoppedMessage)
  }

  storeRef.current.setStatus(threadId, 'done')
  storeRef.current.setResumeToken(threadId, undefined)
  setRuns((prev) => {
    if (!prev.has(threadId)) return prev
    const next = new Map(prev)
    next.delete(threadId)
    return next
  })

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
}: UseAgentThreadRunsArgs<TPart>): UseAgentThreadRunsReturn<TPart> {
  const [runs, setRuns] = useState<Map<string, ThreadRunState<TPart>>>(new Map())
  // Mirrors the latest `runs` state every render so stop() (a plain callback, not a render) can
  // synchronously read a thread's accumulated parts without going through an async setState
  // updater — same mirroring pattern as storeRef/transportRef below.
  const runsRef = useRef(runs)
  runsRef.current = runs

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
  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort())
      controllersRef.current.clear()
      appendedRef.current.clear()
    },
    [],
  )

  // Reconcile orphaned in-flight threads on mount: a persisted thread can be stuck 'pending' or
  // 'streaming' after a reload/remount, since controllersRef and `runs` both start empty — nothing
  // would otherwise resolve that skeleton. If the transport supports resumption and the thread has
  // a resumeToken (from a StartPart emitted before the disconnect) plus a user message to resume
  // from, attempt to reconnect the run instead. Any other case — no resume(), no resumeToken, no
  // user message, or the resume itself failing — falls back to 'interrupted' so the UI renders a
  // resend prompt instead of an unresolving skeleton (today's behavior, unchanged as the fallback
  // path). Mount-only by design (empty deps): this is a one-time sweep of whatever was persisted
  // when this manager first attaches, not a recurring check — a thread only needs reconciling once
  // per stale mount.
  useEffect(() => {
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
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(
    (threadId: string, input: string): void => {
      // Ignore a second concurrent turn on the SAME thread; different threads run concurrently.
      if (controllersRef.current.has(threadId)) return

      lastInputRef.current.set(threadId, input)

      const userMessage: ChatMessage<TPart> = {
        id: crypto.randomUUID(),
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
        generator: withPartIds(threadId, resolvedTransport.stream(input, controller.signal)),
        userMessage,
        controllersRef,
        appendedRef,
        storeRef,
        resolveOutcome,
        setRuns,
        onFailureStatus: 'error',
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
      if (controller === undefined) return

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
