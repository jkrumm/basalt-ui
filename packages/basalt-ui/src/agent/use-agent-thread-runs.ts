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
import type { ChatMessage } from './history'
import type { AgentOutcome, OutcomeResolver } from './outcome'
import type { AgentPart } from './parts'
import type { AgentThread, ThreadsStore } from './thread'
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
  /** The injected transport seam — one stream per start() call. */
  readonly transport: AgentTransport<TPart, string>
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
  /** Abort the in-flight stream for `threadId` (no-op if idle). */
  readonly stop: (threadId: string) => void
  /** Abort every in-flight stream across all threads. */
  readonly stopAll: () => void
}

// ── defaults ──────────────────────────────────────────────────────────────────

/** Default toUserParts: wraps raw input in a single text part. */
function defaultToUserParts(input: string): AgentPart[] {
  return [{ type: 'text', text: input }]
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
export function useAgentThreadRuns<TPart = AgentPart>({
  transport,
  store,
  resolveOutcome,
  toUserParts,
}: UseAgentThreadRunsArgs<TPart>): UseAgentThreadRunsReturn<TPart> {
  const [runs, setRuns] = useState<Map<string, ThreadRunState<TPart>>>(new Map())

  // Refs: mutable per-render state that must not trigger re-renders.
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  // Caches the last user input per thread so retry() can replay a failed turn without the
  // caller having to hold onto (or re-collect) what was typed.
  const lastInputRef = useRef<Map<string, string>>(new Map())
  // Mirrors the latest store every render so completion callbacks (which fire long after the
  // render that started them) read the freshest threads rather than a stale closure.
  const storeRef = useRef(store)
  storeRef.current = store
  // The default only applies when TPart is the framework default AgentPart; custom part unions
  // must pass toUserParts explicitly. Cast is scoped to this one fallback assignment.
  const resolvedToUserParts =
    toUserParts ?? (defaultToUserParts as unknown as (input: string) => TPart[])
  const toUserPartsRef = useRef(resolvedToUserParts)
  toUserPartsRef.current = resolvedToUserParts

  // Abort every in-flight stream on unmount to stop the async generators.
  useEffect(
    () => () => {
      controllersRef.current.forEach((controller) => controller.abort())
    },
    [],
  )

  // Reconcile orphaned in-flight threads on mount: a persisted thread can be stuck 'pending' or
  // 'streaming' after a reload/remount, since controllersRef and `runs` both start empty — nothing
  // would otherwise resolve that skeleton. Mark any such thread 'interrupted' so the UI renders a
  // resend prompt instead of an unresolving skeleton. Mount-only by design (empty deps): this is a
  // one-time sweep of whatever was persisted when this manager first attaches, not a recurring
  // check — a thread only needs reconciling once per stale mount.
  useEffect(() => {
    for (const thread of storeRef.current.threads) {
      const orphaned =
        (thread.status === 'pending' || thread.status === 'streaming') &&
        !controllersRef.current.has(thread.id)
      if (orphaned) storeRef.current.setStatus(thread.id, 'interrupted')
    }
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

      // Non-awaited: this consumer runs in the background so start() returns immediately and
      // multiple threads can stream at once.
      void (async (): Promise<void> => {
        const parts: TPart[] = []
        try {
          for await (const part of transport.stream(input, controller.signal)) {
            // Guard: a newer call superseded this stream's controller for this thread, or it
            // was aborted — stop updating state.
            if (controllersRef.current.get(threadId) !== controller) return
            if (controller.signal.aborted) return
            parts.push(part)
            setRuns((prev) => {
              const next = new Map(prev)
              next.set(threadId, { status: 'streaming', parts: [...parts] })
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
          }
          storeRef.current.appendMessage(threadId, assistantMessage)

          const priorThread = storeRef.current.threads.find((thread) => thread.id === threadId)
          const snapshot = buildDoneSnapshot(priorThread, threadId, userMessage, assistantMessage)
          const outcome: AgentOutcome = await resolveOutcome(snapshot)

          storeRef.current.setOutcome(threadId, outcome)
          storeRef.current.setStatus(threadId, outcome.status)
          controllersRef.current.delete(threadId)
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
          storeRef.current.setStatus(threadId, 'error')
          controllersRef.current.delete(threadId)
          setRuns((prev) => {
            if (!prev.has(threadId)) return prev
            const next = new Map(prev)
            next.delete(threadId)
            return next
          })
        }
      })()
    },
    [transport, resolveOutcome],
  )

  const retry = useCallback(
    (threadId: string): void => {
      const input = lastInputRef.current.get(threadId)
      if (input === undefined) return
      start(threadId, input)
    },
    [start],
  )

  const stop = useCallback((threadId: string): void => {
    controllersRef.current.get(threadId)?.abort()
    controllersRef.current.delete(threadId)
    storeRef.current.setStatus(threadId, 'done')
    setRuns((prev) => {
      if (!prev.has(threadId)) return prev
      const next = new Map(prev)
      next.delete(threadId)
      return next
    })
  }, [])

  const stopAll = useCallback((): void => {
    controllersRef.current.forEach((controller) => controller.abort())
    controllersRef.current.clear()
    setRuns(new Map())
  }, [])

  return { runs, start, retry, stop, stopAll }
}
