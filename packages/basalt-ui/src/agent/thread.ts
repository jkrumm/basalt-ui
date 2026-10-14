/** AgentThread / ThreadsStore — the thread contract a consumer-owned store implements. */
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
 * (single-turn stream lifecycle, below), this `ThreadStatus`
 * (persisted thread lifecycle), and `AgentOutcome['status']` (`./outcome` — the terminal `'done' | 'attention' |
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
  /**
   * Whether `threads` reflects the backing store yet. Always `true` for a synchronous store;
   * meaningful only for an async, server-backed store, where it stays `false` until the first
   * `listThreads` SUCCEEDS. Pair it with `error` — `!hydrated && error !== undefined` is a
   * failed load, `!hydrated && error === undefined` is still loading.
   *
   * Gating an empty state on this is the CALLER's job when rendering `ThreadFeed`, so an async
   * store never flashes "no threads yet" before it actually knows.
   */
  readonly hydrated: boolean
  /**
   * The most recent persistence failure, or `undefined`. Always `undefined` for a synchronous
   * local store, which has no failure the caller can act on. An async store surfaces the rejected
   * load/write here after rolling its optimistic edit back.
   */
  readonly error: unknown
}

/**
 * The live status of one in-flight stream, as the chat rows render it. `'submitted'` is a turn
 * sent but not yet producing content: the chat rows treat it as live (Stop shows, the composer is
 * gated) exactly like `'streaming'`.
 */
export type StreamStatus = 'idle' | 'submitted' | 'streaming' | 'done' | 'error'
