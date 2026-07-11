/**
 * createThreadsStore — persisted, ring-buffered multi-thread registry on createPersistedState.
 *
 * Mirrors createChatHistoryStore's shape but one level up: instead of a single message list,
 * this tracks many AgentThreads (each carrying its own message list plus a distilled
 * AgentOutcome for feed rendering). Threads are stored NEWEST-FIRST so index 0 is always the
 * most recent. Both threads and each thread's messages are ring-buffered independently.
 *
 * SSR-safe: the underlying createPersistedState handles the server snapshot (returns initial).
 * Cross-tab: the 'storage' event propagates changes to other tabs automatically.
 *
 * @example
 * import { createThreadsStore } from 'basalt-ui/agent'
 *
 * // Call once at module scope with a stable key:
 * const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })
 *
 * // In a component:
 * function ThreadFeed() {
 *   const { threads, activeId, select, create } = useThreads()
 *   // ...
 * }
 */
import { useCallback, useRef } from 'react'
import { createPersistedState } from '../state'
import type { ChatMessage } from './history'
import type { AgentOutcome } from './outcome'
import type { AgentPart } from './parts'

// ── ThreadStatus ──────────────────────────────────────────────────────────────

/**
 * The lifecycle status of a single thread.
 *
 * `'interrupted'` is a terminal-until-resent state: reconciled onto any thread found still
 * `'pending'`/`'streaming'` when `useAgentThreadRuns` mounts with no live run for it (e.g. after a
 * reload mid-stream) — see `useAgentThreadRuns`'s mount-reconciliation effect.
 *
 * This is one of THREE overlapping status-shaped unions in the agent layer: `StreamStatus`
 * (single-turn stream lifecycle, `./use-agent-stream`), this `ThreadStatus` (persisted thread
 * lifecycle), and `AgentOutcome['status']` (`./outcome` — the terminal `'done' | 'attention' |
 * 'error'` subset of this union, once a turn has settled). Vocabulary note: `StreamStatus`'s
 * `'idle'` (no turn in flight) corresponds to this union's `'pending'` (thread created, no turn
 * started yet) — the literal rename is intentionally deferred, see `AgentOutcome['status']`'s doc.
 */
export type ThreadStatus = 'pending' | 'streaming' | 'done' | 'attention' | 'error' | 'interrupted'

// ── AgentThread ───────────────────────────────────────────────────────────────

/**
 * A single conversation thread: its messages, a distilled AgentOutcome for feed rendering
 * (null until resolved), lifecycle status, read/unread state, and timestamps.
 *
 * @example
 * const thread: AgentThread = {
 *   id: crypto.randomUUID(),
 *   messages: [],
 *   outcome: null,
 *   status: 'pending',
 *   read: false,
 *   createdAt: Date.now(),
 *   updatedAt: Date.now(),
 * }
 */
export type AgentThread<TPart = AgentPart> = {
  readonly id: string
  readonly messages: ChatMessage<TPart>[]
  readonly outcome: AgentOutcome | null
  readonly status: ThreadStatus
  readonly read: boolean
  readonly createdAt: number
  readonly updatedAt: number
  /**
   * Set when the current/most recent run emitted a StartPart with a resumeToken; used by
   * useAgentThreadRuns to attempt resumption after a disconnected reload. Cleared once the run
   * finalizes.
   */
  readonly resumeToken?: string
  /**
   * Freeform consumer metadata (e.g. `{ source: 'sidebar' }`, `{ model: 'gpt-5' }`) — set once at
   * `create()` time and otherwise opaque to this store. Intentionally untyped: the framework has
   * no opinion on what a consumer wants to stash per thread, and adding a `TMeta` generic here
   * would ripple through `AgentThread<TPart>`, `ThreadsStore<TPart>`, `useAgentThreadRuns`, and
   * every component that renders a thread. Consumers narrow at the read site instead, e.g.:
   *
   * ```ts
   * const model = thread.meta?.model as string | undefined
   * ```
   *
   * Revisit trigger: promote this to a `TMeta` generic only once a real consumer needs typed,
   * validated meta (not just a documented convention) — don't add the generic speculatively.
   */
  readonly meta?: Record<string, unknown>
}

// ── createThreadsStore options ────────────────────────────────────────────────

export type ThreadsStoreOptions = {
  /** localStorage key (namespaced as `basalt:<key>`). Stable — changes key lose history. */
  readonly key: string
  /** Envelope version. Increment when the AgentThread shape changes to clear old data. */
  readonly version: number
  /**
   * Maximum number of threads to retain. Oldest threads (end of the newest-first array) are
   * dropped when exceeded.
   * @default 50
   */
  readonly maxThreads?: number
  /**
   * Maximum number of messages to retain per thread. Oldest messages are dropped when exceeded.
   * @default 100
   */
  readonly maxMessagesPerThread?: number
}

// ── Return type of the factory hook ──────────────────────────────────────────

export type ThreadsStore<TPart = AgentPart> = {
  /** All retained threads, newest first. */
  readonly threads: AgentThread<TPart>[]
  /** The currently selected thread id, or null when none is selected. */
  readonly activeId: string | null
  /** Select a thread as active (or clear the selection with null). */
  readonly select: (id: string | null) => void
  /** Create a new thread, prepend it, and return its id. Does not change activeId. */
  readonly create: (opts?: { readonly meta?: Record<string, unknown> }) => string
  /** Append a message to a thread. Trims to maxMessagesPerThread (ring-buffer: drops oldest). */
  readonly appendMessage: (id: string, message: ChatMessage<TPart>) => void
  /** Set a thread's distilled outcome. Bumps updatedAt. */
  readonly setOutcome: (id: string, outcome: AgentOutcome) => void
  /** Set a thread's lifecycle status. Bumps updatedAt. */
  readonly setStatus: (id: string, status: ThreadStatus) => void
  /** Set (or clear, with undefined) a thread's resume token. Bumps updatedAt. */
  readonly setResumeToken: (id: string, token: string | undefined) => void
  /** Mark a thread as read. */
  readonly markRead: (id: string) => void
  /** Remove a thread. Clears activeId if it pointed at the removed thread. */
  readonly remove: (id: string) => void
  /** Remove all threads and clear the active selection. */
  readonly clear: () => void
}

// ── createThreadsStore ────────────────────────────────────────────────────────

/**
 * Creates a stable persisted multi-thread hook for the given key + version.
 *
 * Call this ONCE per module (not inside a component). The returned hook can be called in any
 * component that needs access to the same thread registry. All instances sharing the same key
 * stay in sync across tabs via the 'storage' event.
 *
 * @example
 * // src/chat/threads.ts — ONE stable creation per key:
 * export const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })
 *
 * // In a component:
 * const { threads, activeId, select, create, appendMessage } = useThreads()
 * const id = create({ meta: { source: 'sidebar' } })
 * appendMessage(id, { id: crypto.randomUUID(), role: 'user', parts: [...], createdAt: Date.now() })
 */
export function createThreadsStore<TPart = AgentPart>(
  opts: ThreadsStoreOptions,
): () => ThreadsStore<TPart> {
  const maxThreads = opts.maxThreads ?? 50
  const maxMessages = opts.maxMessagesPerThread ?? 100

  type Persisted = { threads: AgentThread<TPart>[]; activeId: string | null }

  const usePersistedThreads = createPersistedState<Persisted>({
    key: opts.key,
    version: opts.version,
    initial: { threads: [], activeId: null },
  })

  return function useThreadsStore(): ThreadsStore<TPart> {
    const [state, setState] = usePersistedThreads()

    // Ref mirrors the latest committed value so that two synchronous action calls in one
    // render cycle accumulate correctly. createPersistedState's setter is a whole-value setter
    // (not a functional updater), so the second call would otherwise overwrite the first.
    const ref = useRef(state)
    ref.current = state

    const commit = useCallback(
      (next: Persisted): void => {
        ref.current = next // sync so a second action in the same tick sees the update
        setState(next)
      },
      [setState],
    )

    const select = useCallback(
      (id: string | null): void => {
        commit({ ...ref.current, activeId: id })
      },
      [commit],
    )

    const create = useCallback(
      (createOpts?: { readonly meta?: Record<string, unknown> }): string => {
        const id = crypto.randomUUID()
        const now = Date.now()
        const thread: AgentThread<TPart> = {
          id,
          messages: [],
          outcome: null,
          status: 'pending',
          read: false,
          createdAt: now,
          updatedAt: now,
          ...(createOpts?.meta !== undefined ? { meta: createOpts.meta } : {}),
        }
        const threads = [thread, ...ref.current.threads]
        // Ring-buffer: drop the oldest threads (the tail) when over maxThreads.
        const trimmed = threads.length > maxThreads ? threads.slice(0, maxThreads) : threads
        commit({ ...ref.current, threads: trimmed })
        return id
      },
      [commit],
    )

    const appendMessage = useCallback(
      (id: string, message: ChatMessage<TPart>): void => {
        const threads = ref.current.threads.map((thread) => {
          if (thread.id !== id) return thread
          const messages = [...thread.messages, message]
          // Ring-buffer: trim to maxMessages, dropping oldest entries first.
          const trimmed =
            messages.length > maxMessages ? messages.slice(messages.length - maxMessages) : messages
          return { ...thread, messages: trimmed, updatedAt: Date.now() }
        })
        commit({ ...ref.current, threads })
      },
      [commit],
    )

    const setOutcome = useCallback(
      (id: string, outcome: AgentOutcome): void => {
        const threads = ref.current.threads.map((thread) =>
          thread.id === id ? { ...thread, outcome, updatedAt: Date.now() } : thread,
        )
        commit({ ...ref.current, threads })
      },
      [commit],
    )

    const setStatus = useCallback(
      (id: string, status: ThreadStatus): void => {
        const threads = ref.current.threads.map((thread) =>
          thread.id === id ? { ...thread, status, updatedAt: Date.now() } : thread,
        )
        commit({ ...ref.current, threads })
      },
      [commit],
    )

    const setResumeToken = useCallback(
      (id: string, token: string | undefined): void => {
        const threads = ref.current.threads.map((thread) => {
          if (thread.id !== id) return thread
          // exactOptionalPropertyTypes: drop the key entirely to clear it rather than assigning
          // `resumeToken: undefined` (which the optional-but-not-nullable type disallows).
          const { resumeToken: _resumeToken, ...rest } = thread
          return {
            ...rest,
            ...(token !== undefined ? { resumeToken: token } : {}),
            updatedAt: Date.now(),
          }
        })
        commit({ ...ref.current, threads })
      },
      [commit],
    )

    const markRead = useCallback(
      (id: string): void => {
        const threads = ref.current.threads.map((thread) =>
          thread.id === id ? { ...thread, read: true } : thread,
        )
        commit({ ...ref.current, threads })
      },
      [commit],
    )

    const remove = useCallback(
      (id: string): void => {
        const threads = ref.current.threads.filter((thread) => thread.id !== id)
        const activeId = ref.current.activeId === id ? null : ref.current.activeId
        commit({ threads, activeId })
      },
      [commit],
    )

    const clear = useCallback((): void => {
      commit({ threads: [], activeId: null })
    }, [commit])

    return {
      threads: state.threads,
      activeId: state.activeId,
      select,
      create,
      appendMessage,
      setOutcome,
      setStatus,
      setResumeToken,
      markRead,
      remove,
      clear,
    }
  }
}
