/**
 * ThreadsStoreAdapter — the async, server-backed seam behind ThreadsStore.
 *
 * `createThreadsStore` (./thread) is localStorage with silent ring-buffer caps. That is the right
 * default for a demo and the wrong one for a real transcript: a consumer whose threads live in
 * Postgres has, until now, had to fork the store outright. This module opens that seam.
 *
 * Three pieces:
 *   1. `ThreadsStoreAdapter` — the async contract a consumer implements against its own backend.
 *   2. `createAdapterThreadsStore` — wraps one into the SYNCHRONOUS `ThreadsStore` that every
 *      component in `basalt-ui/agent-chat` already takes. Optimistic local state, revalidate on
 *      success, roll back on rejection.
 *   3. `threadsStoreAdapterContract` — a test-runner-agnostic conformance suite the consumer runs
 *      against its own adapter. It ships in the published package, so it imports NO test framework.
 *
 * @example
 * import { createAdapterThreadsStore } from 'basalt-ui/agent'
 *
 * // Call once at module scope, exactly like createThreadsStore:
 * export const useThreads = createAdapterThreadsStore(postgresThreadsAdapter(api))
 *
 * // In a component — same shape as the localStorage store, plus hydrated/error:
 * const { threads, hydrated, error, create, appendMessage } = useThreads()
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { ChatMessage } from './history'
import { mintThreadId } from './id'
import type { AgentOutcome } from './outcome'
import type { AgentPart } from './parts'
import type { AgentThread, ThreadStatus, ThreadsStore } from './thread'

// ── ThreadsStoreAdapter ───────────────────────────────────────────────────────

/**
 * The async persistence contract behind a `ThreadsStore`. Every method may reject; the wrapping
 * store treats a rejection as "the optimistic edit did not happen" and rolls it back.
 *
 * Implement this against whatever owns the transcript (Postgres, an HTTP API, IndexedDB) and
 * verify it with `threadsStoreAdapterContract` — the suite pins the parts of the contract that
 * prose cannot enforce, chiefly `appendMessage`'s idempotency.
 *
 * ## What `createAdapterThreadsStore` guarantees you
 *
 * **Per-thread write ordering.** Writes carrying the same thread id reach this adapter strictly in
 * issue order, each one awaiting the previous, so a write that depends on a row existing is never
 * issued before that row's `createThread` has RESOLVED. This matters because the primary send path
 * is one synchronous block — `create()`, `select()`, `markRead()`, `appendMessage()`,
 * `setStatus()` — which without ordering would hand you three dependent writes against a row you
 * have not created yet. You therefore never have to tolerate (or invent an upsert for) an
 * out-of-order write. Writes for DIFFERENT thread ids stay concurrent and carry no ordering
 * guarantee relative to each other.
 *
 * ## What it requires of you
 *
 * **Read-after-write consistency on `listThreads`.** A `listThreads` STARTED after a write has
 * resolved must reflect that write. The store keeps a write's optimistic patch applied until such
 * a list lands, then drops it; an eventually-consistent backend (a stale read replica, a cached
 * list) will therefore flash the pre-write state back into the UI. `threadsStoreAdapterContract`
 * pins this.
 *
 * @example
 * const postgresThreadsAdapter = (api: Api): ThreadsStoreAdapter => ({
 *   listThreads: (signal) => api.threads.get({ fetch: { signal } }),
 *   loadThread: (id, signal) => api.threads({ id }).get({ fetch: { signal } }),
 *   createThread: ({ id, meta }) => api.threads.post({ id, meta }),
 *   // ...
 * })
 */
export type ThreadsStoreAdapter<TPart = AgentPart> = {
  /** All threads, NEWEST-FIRST (same ordering contract as `ThreadsStore.threads`). */
  readonly listThreads: (signal?: AbortSignal) => Promise<readonly AgentThread<TPart>[]>
  /** One thread by id, or `null` when it does not exist. Must not throw on an unknown id. */
  readonly loadThread: (id: string, signal?: AbortSignal) => Promise<AgentThread<TPart> | null>
  /**
   * Materialize a new thread under the CLIENT-MINTED `id`. The id is minted client-side because
   * `ThreadsStore.create()` returns synchronously — there is no await to hand a server id back
   * through. The created thread starts empty: `messages: []`, `outcome: null`,
   * `status: 'pending'`, `read: false`, with `createdAt`/`updatedAt` set.
   */
  readonly createThread: (i: {
    readonly id: string
    readonly meta?: Record<string, unknown>
  }) => Promise<void>
  /**
   * CONTRACT: idempotent on `message.id`. The id is client-minted and is the ONLY idempotency
   * key — a retried or double-fired write with the same id must be a no-op, not a second row.
   */
  readonly appendMessage: (i: {
    readonly threadId: string
    readonly message: ChatMessage<TPart>
  }) => Promise<void>
  readonly setStatus: (i: {
    readonly threadId: string
    readonly status: ThreadStatus
  }) => Promise<void>
  readonly setOutcome: (i: {
    readonly threadId: string
    readonly outcome: AgentOutcome
  }) => Promise<void>
  /** `token: undefined` CLEARS the token — the stored thread must then read `resumeToken` as absent. */
  readonly setResumeToken: (i: {
    readonly threadId: string
    readonly token: string | undefined
  }) => Promise<void>
  readonly markRead: (threadId: string) => Promise<void>
  /** Removing an unknown id is a no-op, not an error. */
  readonly removeThread: (threadId: string) => Promise<void>
}

// ── createAdapterThreadsStore ─────────────────────────────────────────────────

export type AdapterThreadsStoreOptions = {
  /**
   * Re-list threads whenever the window regains focus. Off by default — a background tab that
   * refocuses should not surprise a consumer with a network round-trip it did not ask for.
   * @default false
   */
  readonly revalidateOnFocus?: boolean
}

/**
 * An optimistic patch over the last-confirmed server list.
 *
 * Every patch MUST be idempotent: on a successful write the patch stays applied while the
 * follow-up `listThreads` lands, so it is briefly re-applied on top of a server list that already
 * contains its effect. `appendMessage`'s patch therefore appends-if-absent, `create`'s
 * prepends-if-absent, and the setters are plain assignments. Without that property the store
 * would double-render a message for one frame after every successful append.
 *
 * Idempotent means TIME-INDEPENDENT too: a patch is re-applied on every store event, including
 * ones it has nothing to do with (a `select()` while a write is in flight), so it must never read
 * the clock inside `apply`. Each action captures `Date.now()` once, at issue time, and closes over
 * it — otherwise an unrelated `select()` would re-stamp `updatedAt`. `apply` is additionally
 * memoized on input identity (see `memoizeApply`) so re-application is referentially stable and
 * cannot defeat a consumer's `React.memo`/`useMemo` over `threads`.
 */
type ThreadPatch<TPart> = {
  readonly apply: (threads: readonly AgentThread<TPart>[]) => AgentThread<TPart>[]
  /**
   * The patch's effect on the LOCAL selection, when it has one (`remove`/`clear`). Kept in the
   * patch rather than assigned eagerly so it rolls back with the rows on a rejection.
   */
  readonly applyActive?: (activeId: string | null) => string | null
  /**
   * The load sequence number that must land in `base` before this patch may be dropped, or `null`
   * while the write is still in flight. See `prune` — this is the whole "no gap" invariant.
   */
  confirmSeq: number | null
}

/**
 * Wraps an async `ThreadsStoreAdapter` into the synchronous `ThreadsStore` every component takes.
 *
 * Call this ONCE per module (not inside a component), exactly like `createThreadsStore`. All
 * components calling the returned hook share one registry, backed by `useSyncExternalStore`.
 *
 * Semantics:
 * - **Optimistic.** Every mutation applies locally first, so `create()` can return an id
 *   synchronously and the UI never waits on a round-trip.
 * - **Ordered per thread.** Writes for one thread id reach the adapter in issue order, each
 *   awaiting the previous — so the dependent writes of a `create()`-then-send land after
 *   `createThread` has resolved. Different threads stay concurrent. See `ThreadsStoreAdapter`.
 * - **Revalidate on success, coalesced.** When a write resolves the store re-lists; the patch is
 *   dropped only once a list has actually refreshed the confirmed base, so server-side derivations
 *   win over the local guess with no gap in between. Writes that resolve while a list is already in
 *   flight share ONE follow-up instead of each restarting it, so a burst of writes costs at most
 *   two round trips (the in-flight one, plus one follow-up), not one per write — see `revalidate`.
 * - **Roll back on rejection.** A rejected write's patch is discarded, the rejection is surfaced
 *   on `error`, and the store re-lists to converge on whatever the server really did. Patches are
 *   tracked individually, so a failing write rolls back only itself and not whatever else was in
 *   flight beside it. A rejected `create()` additionally drops every later single-thread write for
 *   that id (`markRead`/`appendMessage`/`setStatus`/… — both the ones chained directly behind it and
 *   the run's completion writes at stream end) instead of letting each fail independently against a
 *   row that no longer exists — see `failedCreateIds`. Without that, the create's own error is
 *   overwritten by a run of "unknown thread" rejections that name nothing a caller can act on.
 * - **`hydrated` means "a `listThreads` has succeeded"**, not "a load has been attempted". A
 *   store that is `!hydrated` with a non-undefined `error` failed to load; check both.
 * - **`error` latches the most recent failure until something disproves it.** A successful
 *   `listThreads` clears a LOAD failure; it leaves a WRITE failure alone, since a working list is
 *   no evidence the rejected write landed. A write clears a latched write failure only if it was
 *   issued after that failure (a retry) — never the writes that were already queued behind it.
 *
 * `select` is local-only — which thread is active is UI state, not something the adapter owns.
 * `clear()` maps onto `removeThread` for each known thread, since the adapter has no bulk delete.
 *
 * @example
 * export const useThreads = createAdapterThreadsStore(myAdapter, { revalidateOnFocus: true })
 */
export function createAdapterThreadsStore<TPart = AgentPart>(
  adapter: ThreadsStoreAdapter<TPart>,
  opts?: AdapterThreadsStoreOptions,
): () => ThreadsStore<TPart> {
  const revalidateOnFocus = opts?.revalidateOnFocus ?? false

  type Snapshot = {
    readonly threads: AgentThread<TPart>[]
    readonly activeId: string | null
    readonly hydrated: boolean
    readonly error: unknown
  }

  const EMPTY: AgentThread<TPart>[] = []
  // Stable identity for the SSR snapshot — useSyncExternalStore requires getServerSnapshot to be
  // referentially stable across calls or React loops on it.
  const SERVER_SNAPSHOT: Snapshot = {
    threads: EMPTY,
    activeId: null,
    hydrated: false,
    error: undefined,
  }

  /** Last confirmed server list. Optimistic patches are layered on top, never merged into it. */
  let base: AgentThread<TPart>[] = EMPTY
  /**
   * The `loadSeq` of the `listThreads` that produced the current `base`. Patch lifetime is keyed
   * to this number rather than to "a revalidate returned" — see `prune`.
   */
  let baseSeq = 0
  /** Confirmed selection. The patched value (see `applyActive`) is what the snapshot exposes. */
  let activeId: string | null = null
  let hydrated = false
  let error: unknown
  /**
   * Bumped on every failure. A write clears `error` only when this token still matches the value
   * it captured at ISSUE time — i.e. only when the write was issued AFTER the latched failure
   * happened. Without that, the writes queued behind a failing one (the send path issues four in
   * one block) would clear the failure the consumer never got to see; with it, a genuine retry
   * still clears it.
   */
  let errorToken = 0
  /**
   * Whether the latched `error` came from a WRITE. A successful `listThreads` is evidence the load
   * path works, not that the rejected write landed — so it clears a load error and leaves a write
   * error alone.
   */
  let errorFromWrite = false
  const pending: ThreadPatch<TPart>[] = []
  let snapshot: Snapshot = SERVER_SNAPSHOT

  const listeners = new Set<() => void>()

  function recompute(): void {
    let threads: AgentThread<TPart>[] = base
    let active = activeId
    for (const patch of pending) {
      threads = patch.apply(threads)
      if (patch.applyActive !== undefined) active = patch.applyActive(active)
    }
    snapshot = { threads, activeId: active, hydrated, error }
    for (const listener of listeners) listener()
  }

  /**
   * Memoizes a patch's `apply` on INPUT IDENTITY. `recompute` re-runs the whole pending stack on
   * every store event, so without this an unrelated `select()` would mint fresh thread objects for
   * every in-flight write and defeat referential-equality memoization downstream. Sound because
   * `apply` is pure: the actions capture their timestamp at issue time, never inside `apply`.
   */
  function memoizeApply(apply: ThreadPatch<TPart>['apply']): ThreadPatch<TPart>['apply'] {
    let lastIn: readonly AgentThread<TPart>[] | undefined
    let lastOut: AgentThread<TPart>[] | undefined
    return (threads): AgentThread<TPart>[] => {
      if (lastOut !== undefined && threads === lastIn) return lastOut
      lastIn = threads
      lastOut = apply(threads)
      return lastOut
    }
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return (): void => {
      listeners.delete(listener)
    }
  }

  function getSnapshot(): Snapshot {
    return snapshot
  }

  function getServerSnapshot(): Snapshot {
    return SERVER_SNAPSHOT
  }

  // ── revalidation ────────────────────────────────────────────────────────────

  let loadController: AbortController | null = null
  let loadSeq = 0
  /**
   * A follow-up load already earmarked to start the moment the in-flight one finishes, or `null`
   * when none is queued. See `revalidate` — this is the coalescing slot every write-triggered
   * revalidate() call shares while a load is in flight, instead of each minting (and aborting) its
   * own. INVARIANT: non-null only while a load is in flight (`loadController !== null`) — every
   * place that ends the in-flight load (a landing, in `startLoad`'s `finally`; a forced supersede,
   * in `forceRevalidate`; unmount, in `release`) also clears this, so a stale seq can never be
   * handed out to a write that arrives after the load it was queued behind is long gone.
   */
  let queuedSeq: number | null = null

  /**
   * Drops every patch whose proving load has landed in `base`.
   *
   * INVARIANT: apart from a rollback, this is the ONLY place a patch is ever dropped — a patch
   * outlives its write until a `listThreads` ISSUED AFTER that write resolved has actually
   * refreshed `base`. Dropping on "some revalidate returned" is not enough: with two writes in
   * flight (the normal case on the send path) the earlier revalidate is SUPERSEDED and returns
   * without touching `base`, so dropping there would blank the confirmed write's effect out of
   * the UI for the whole of the surviving round-trip. Because `loadSeq` is global and monotonic,
   * `baseSeq >= confirmSeq` proves the landed list was started after the write resolved, and
   * `ThreadsStoreAdapter`'s read-after-write clause makes that list contain the write.
   */
  function prune(): void {
    const kept: ThreadPatch<TPart>[] = []
    for (const patch of pending) {
      if (patch.confirmSeq !== null && patch.confirmSeq <= baseSeq) {
        // Retiring a confirmed patch COMMITS its local-only effect: the rows come back from the
        // server, but the selection does not, so dropping a confirmed `remove`/`clear` without
        // folding `applyActive` in would resurrect a selection pointing at a deleted thread.
        if (patch.applyActive !== undefined) activeId = patch.applyActive(activeId)
        continue
      }
      kept.push(patch)
    }
    if (kept.length !== pending.length) pending.splice(0, pending.length, ...kept)
  }

  /**
   * Runs one `listThreads` tagged with `seq` and installs it as `base` unless something has
   * superseded it in the meantime (`forceRevalidate` swapping `loadController` out from under it).
   * On landing (success, failure, or discard), starts the coalesced follow-up in `queuedSeq` — if
   * any writes arrived while this load was in flight, exactly one more load runs for all of them.
   */
  function startLoad(seq: number): void {
    const controller = new AbortController()
    loadController = controller
    void (async (): Promise<void> => {
      try {
        const next = await adapter.listThreads(controller.signal)
        // A forced revalidate replaced `loadController` while this was in flight — stale, ignore.
        if (loadController !== controller) return
        base = [...next]
        baseSeq = seq
        hydrated = true
        // A working list says nothing about a rejected WRITE — see `errorFromWrite`.
        if (!errorFromWrite) error = undefined
        prune()
        recompute()
      } catch (cause) {
        // An abort is a deliberate cancellation (unmount, or a forced supersede) — not a store
        // error; nor is a stale rejection landing after something else already replaced us.
        if (controller.signal.aborted || loadController !== controller) return
        error = cause
        errorToken += 1
        errorFromWrite = false
        recompute()
      } finally {
        if (loadController === controller) {
          loadController = null
          if (queuedSeq !== null) {
            const next = queuedSeq
            queuedSeq = null
            startLoad(next)
          }
        }
      }
    })()
  }

  /**
   * Requests a revalidate and returns the seq of the load that will PROVE it — the load a caller
   * must wait for (`baseSeq >= this seq`) before treating its write as confirmed, per `ThreadPatch`.
   *
   * COALESCES rather than restarts. A `listThreads` already in flight started before this call, so
   * per `ThreadsStoreAdapter`'s read-after-write clause it is not guaranteed to reflect a write
   * that only just resolved — aborting it and starting an identical one is therefore not a
   * shortcut, and under back-to-back writes (a streaming append firing every few ms) it means NO
   * load ever survives long enough to land: `base` never refreshes and no patch ever retires (this
   * was the bug). Instead, while a load is in flight, every caller shares the ONE follow-up load
   * already earmarked to start the instant the in-flight one finishes (`queuedSeq`) — that
   * follow-up necessarily starts after every write that arrived while the in-flight load was
   * running, so a single round trip proves all of them at once.
   */
  function revalidate(): number {
    if (loadController !== null) {
      queuedSeq ??= ++loadSeq
      return queuedSeq
    }
    const seq = ++loadSeq
    startLoad(seq)
    return seq
  }

  /**
   * Like `revalidate`, but ABORTS an in-flight load instead of coalescing behind it — for the two
   * cases that genuinely want the freshest list right now rather than whatever the in-flight load
   * happens to land: the initial mount (via `revalidate`, where nothing is in flight yet so the two
   * are equivalent) and `revalidateOnFocus`. Drops any coalesced follow-up too: the fresh load this
   * starts necessarily begins after every write that follow-up would have proven, so `baseSeq`
   * still ends up `>=` their `confirmSeq` once it lands — `prune`'s check was always `>=`, not `==`.
   */
  function forceRevalidate(): number {
    loadController?.abort()
    queuedSeq = null
    const seq = ++loadSeq
    startLoad(seq)
    return seq
  }

  // ── per-thread write ordering ───────────────────────────────────────────────

  /**
   * Tail of the in-flight write chain per thread id. `ThreadsStore`'s send path issues
   * `create` → `markRead` → `appendMessage` → `setStatus` in ONE synchronous block, so without a
   * chain a server-backed adapter would get three writes against a row whose `createThread` has
   * not resolved yet, reject them, and roll the user's own message back out of the transcript.
   */
  const chains = new Map<string, Promise<void>>()

  /**
   * Thread ids whose `createThread` has rejected and been rolled back. The send path issues
   * `create()` → `markRead()` → `appendMessage()` → `setStatus()` in one synchronous block, all
   * chained behind the same per-thread queue above — so when `createThread` rejects, the three
   * dependent writes queued right behind it are guaranteed to reach the adapter next, each against
   * a row that was never materialized. Left alone, each of those independently rejects with its own
   * "unknown thread" error and overwrites the one that actually explains what happened (the
   * create's), so the user ends up staring at the last cascade error instead of the root cause.
   *
   * Recording the id here lets `mutate` recognize a single-thread write against a rolled-back
   * create and drop it silently instead of running a doomed commit — see `mutate`'s `isCreate`
   * guard.
   *
   * Entries are NEVER removed, deliberately. The cascade is not confined to the synchronous block:
   * `useAgentThreadRuns`' COMPLETION path (`appendMessage(assistant)` → `setOutcome` → `setStatus`
   * → `setResumeToken`) fires when the stream ends, long after this thread's write chain has
   * drained — same rolled-back row, same "unknown thread" rejections, and landing at exactly the
   * moment the user is watching the thread. Clearing the entry when the chain drains would fix the
   * first few hundred milliseconds and hand the cascade straight back at stream end. Retaining it
   * is safe and bounded: `create()` always mints its own id (`mintThreadId`, never caller-supplied),
   * so an id in here can never be re-created and the set only grows by one per FAILED create in a
   * session.
   */
  const failedCreateIds = new Set<string>()

  /** `task` must never reject, so a failed write cannot poison the chain behind it. */
  function enqueue(threadIds: readonly string[], task: () => Promise<void>): void {
    const ids = [...new Set(threadIds)]
    const prior = ids.map((id) => chains.get(id)).filter((p): p is Promise<void> => p !== undefined)
    const after = prior.length === 0 ? Promise.resolve() : Promise.all(prior).then(() => undefined)
    const run = after.then(task)
    for (const id of ids) chains.set(id, run)
    void run.finally(() => {
      // Only the tail clears its own entry, so a later write chained behind it is not orphaned.
      // `failedCreateIds` is deliberately NOT cleared here — see its doc.
      for (const id of ids) if (chains.get(id) === run) chains.delete(id)
    })
  }

  // ── optimistic mutation pipeline ────────────────────────────────────────────

  function drop(patch: ThreadPatch<TPart>): void {
    const index = pending.indexOf(patch)
    if (index !== -1) pending.splice(index, 1)
  }

  function mutate(i: {
    /** Threads this write touches — its ordering key(s). Empty only for a `clear()` of nothing. */
    readonly threadIds: readonly string[]
    readonly apply: ThreadPatch<TPart>['apply']
    readonly applyActive?: (activeId: string | null) => string | null
    readonly commit: () => Promise<void>
    /**
     * True only for `create()`'s own write. On rejection, marks its thread id as failed so the
     * dependent writes chained behind it in the same synchronous send-path block recognize the row
     * was rolled back — see `failedCreateIds`.
     */
    readonly isCreate?: boolean
  }): void {
    const patch: ThreadPatch<TPart> = {
      apply: memoizeApply(i.apply),
      ...(i.applyActive !== undefined ? { applyActive: i.applyActive } : {}),
      confirmSeq: null,
    }
    pending.push(patch)
    const tokenAtIssue = errorToken
    recompute()
    enqueue(i.threadIds, async (): Promise<void> => {
      // A single-thread write against a create that already rolled back cannot succeed — the row
      // was never materialized, and running it only manufactures a second "unknown thread" error
      // that would bury the create's own. This covers both the writes chained directly behind the
      // create and the run's later completion writes (see `failedCreateIds`). Scoped to
      // single-thread writes deliberately:
      // `clear()`'s multi-id commit already has its own per-id fan-out (`Promise.allSettled`) and
      // `removeThread` is contractually a no-op on an unknown id anyway, so folding this check into
      // a multi-id write would risk dropping legitimate deletes for OTHER, healthy threads in the
      // same batch just because one id in it happened to be orphaned.
      const [soleThreadId] = i.threadIds
      if (
        !i.isCreate &&
        i.threadIds.length === 1 &&
        soleThreadId !== undefined &&
        failedCreateIds.has(soleThreadId)
      ) {
        drop(patch)
        recompute()
        return
      }
      try {
        await i.commit()
      } catch (cause) {
        if (i.isCreate) for (const threadId of i.threadIds) failedCreateIds.add(threadId)
        // Roll back: discard THIS patch only, leaving any other in-flight patch applied.
        drop(patch)
        error = cause
        errorToken += 1
        errorFromWrite = true
        recompute()
        // Converge on the server: a rejection does not say how much of the write landed (a
        // partially-applied `clear()` fan-out, a write whose response was lost), and rolling back
        // to a stale `base` would resurrect rows that really were deleted.
        revalidate()
        return
      }
      // Only a write issued AFTER the latched failure is evidence of recovery — see `errorToken`.
      if (errorFromWrite && errorToken === tokenAtIssue) {
        error = undefined
        errorFromWrite = false
        recompute()
      }
      // Keep the patch applied ACROSS the revalidate; `prune` drops it once that list has actually
      // refreshed `base`. Dropping on return would flash the pre-mutation state. This is why every
      // patch has to be idempotent.
      patch.confirmSeq = revalidate()
    })
  }

  /** Rewrites one thread in place, preserving order; a no-op when the id is unknown. */
  function patchThread(
    id: string,
    update: (thread: AgentThread<TPart>) => AgentThread<TPart>,
  ): ThreadPatch<TPart>['apply'] {
    return (threads): AgentThread<TPart>[] =>
      threads.map((thread) => (thread.id === id ? update(thread) : thread))
  }

  // ── mount lifecycle (shared across every component using the hook) ──────────

  let mounted = 0

  function onFocus(): void {
    // A refocus genuinely wants the freshest list now, not whatever a stale in-flight load lands.
    forceRevalidate()
  }

  function retain(): void {
    mounted += 1
    if (mounted !== 1) return
    revalidate()
    if (revalidateOnFocus && typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus)
    }
  }

  function release(): void {
    mounted -= 1
    if (mounted !== 0) return
    loadController?.abort()
    loadController = null
    // Nothing is left to prove it, and a stale seq handed to a future write would let that write's
    // patch retire prematurely the moment ANY later load lands — see the `queuedSeq` invariant.
    queuedSeq = null
    if (revalidateOnFocus && typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocus)
    }
  }

  // ── actions (factory-scope, hence referentially stable across renders) ──────

  function select(id: string | null): void {
    activeId = id
    recompute()
  }

  function create(createOpts?: { readonly meta?: Record<string, unknown> }): string {
    // Client-minted: `create()` is synchronous, so there is no await to carry a server id back.
    const id = mintThreadId()
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
    mutate({
      threadIds: [id],
      apply: (threads) => (threads.some((t) => t.id === id) ? [...threads] : [thread, ...threads]),
      isCreate: true,
      commit: () =>
        adapter.createThread({
          id,
          ...(createOpts?.meta !== undefined ? { meta: createOpts.meta } : {}),
        }),
    })
    return id
  }

  function appendMessage(id: string, message: ChatMessage<TPart>): void {
    // Captured at ISSUE time, never read inside `apply` — see ThreadPatch. Same for every setter
    // below.
    const now = Date.now()
    mutate({
      threadIds: [id],
      apply: patchThread(id, (thread) =>
        thread.messages.some((m) => m.id === message.id)
          ? thread
          : { ...thread, messages: [...thread.messages, message], updatedAt: now },
      ),
      commit: () => adapter.appendMessage({ threadId: id, message }),
    })
  }

  function setOutcome(id: string, outcome: AgentOutcome): void {
    const now = Date.now()
    mutate({
      threadIds: [id],
      apply: patchThread(id, (thread) => ({ ...thread, outcome, updatedAt: now })),
      commit: () => adapter.setOutcome({ threadId: id, outcome }),
    })
  }

  function setStatus(id: string, status: ThreadStatus): void {
    const now = Date.now()
    mutate({
      threadIds: [id],
      apply: patchThread(id, (thread) => ({ ...thread, status, updatedAt: now })),
      commit: () => adapter.setStatus({ threadId: id, status }),
    })
  }

  function setResumeToken(id: string, token: string | undefined): void {
    const now = Date.now()
    mutate({
      threadIds: [id],
      apply: patchThread(id, (thread) => {
        // exactOptionalPropertyTypes: drop the key entirely to clear it rather than assigning
        // `resumeToken: undefined` (same idiom as thread.ts).
        const { resumeToken: _resumeToken, ...rest } = thread
        return {
          ...rest,
          ...(token !== undefined ? { resumeToken: token } : {}),
          updatedAt: now,
        }
      }),
      commit: () => adapter.setResumeToken({ threadId: id, token }),
    })
  }

  function markRead(id: string): void {
    mutate({
      threadIds: [id],
      // Identity-preserving when the server already agrees — markRead does not bump updatedAt.
      apply: patchThread(id, (thread) => (thread.read ? thread : { ...thread, read: true })),
      commit: () => adapter.markRead(id),
    })
  }

  function remove(id: string): void {
    mutate({
      threadIds: [id],
      apply: (threads) => threads.filter((thread) => thread.id !== id),
      // Inside the patch, so a rejected delete restores the SELECTION along with the row. Written
      // as a conditional clear rather than a flat `null` so a `select()` issued while the delete
      // is in flight survives the patch being re-applied on top of it.
      applyActive: (active) => (active === id ? null : active),
      commit: () => adapter.removeThread(id),
    })
  }

  function clear(): void {
    // The adapter has no bulk delete, so clear() fans out over the threads we currently know
    // about. Threads created concurrently by another tab survive — they are picked up by the
    // revalidate that follows.
    const ids = snapshot.threads.map((thread) => thread.id)
    const clearedIds = new Set(ids)
    mutate({
      threadIds: ids,
      apply: () => [],
      // Same idiom as remove(): only null a selection pointing at one of the threads THIS clear
      // captured, so a select() issued while the clear is in flight — e.g. into a thread created
      // concurrently by create() — survives the patch being re-applied on top of it.
      applyActive: (active) => (active !== null && clearedIds.has(active) ? null : active),
      commit: async (): Promise<void> => {
        // allSettled, not all: `all` rejects on the FIRST failure while the other deletes are
        // still in flight, so the convergence load would race them and re-list rows that were
        // about to disappear. Settling everything first makes the follow-up list authoritative.
        const results = await Promise.allSettled(ids.map((id) => adapter.removeThread(id)))
        const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        if (failures.length === 0) return
        throw new AggregateError(
          failures.map((f): unknown => f.reason),
          `removeThread rejected for ${failures.length} of ${ids.length} threads`,
        )
      },
    })
  }

  return function useAdapterThreadsStore(): ThreadsStore<TPart> {
    const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

    useEffect(() => {
      retain()
      return (): void => {
        release()
      }
    }, [])

    return {
      threads: current.threads,
      activeId: current.activeId,
      hydrated: current.hydrated,
      error: current.error,
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

// ── threadsStoreAdapterContract ───────────────────────────────────────────────

/** One conformance case. `run` rejects with a plain Error describing the violation. */
export type ThreadsStoreAdapterContractCase = {
  readonly name: string
  readonly run: () => Promise<void>
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`ThreadsStoreAdapter contract: ${message}`)
}

function message<TPart>(id: string): ChatMessage<TPart> {
  // `parts: []` keeps the suite fully generic — there is no way to mint a TPart from here, and
  // the contract is about ROW IDENTITY (the id), not part payloads.
  return { id, role: 'user', parts: [], createdAt: Date.now() }
}

/**
 * A test-runner-agnostic conformance suite for a `ThreadsStoreAdapter` implementation.
 *
 * This ships in the published package, so it deliberately imports NO test framework and depends
 * on no assertion library — each case throws a plain `Error`. Drive it from whatever runner the
 * consumer uses.
 *
 * `makeAdapter` is called ONCE PER CASE and must hand back a fresh, empty backend: the cases are
 * independent and none of them cleans up after itself.
 *
 * @example
 * import { threadsStoreAdapterContract } from 'basalt-ui/agent'
 *
 * for (const c of threadsStoreAdapterContract(() => postgresThreadsAdapter(freshDb()))) {
 *   test(c.name, () => c.run())
 * }
 */
export function threadsStoreAdapterContract<TPart>(
  makeAdapter: () => ThreadsStoreAdapter<TPart> | Promise<ThreadsStoreAdapter<TPart>>,
): readonly ThreadsStoreAdapterContractCase[] {
  function define(
    name: string,
    run: (adapter: ThreadsStoreAdapter<TPart>) => Promise<void>,
  ): ThreadsStoreAdapterContractCase {
    return {
      name,
      run: async (): Promise<void> => {
        await run(await makeAdapter())
      },
    }
  }

  async function loadOrThrow(
    adapter: ThreadsStoreAdapter<TPart>,
    id: string,
  ): Promise<AgentThread<TPart>> {
    const thread = await adapter.loadThread(id)
    assert(thread !== null, `loadThread('${id}') returned null for a thread that was created`)
    return thread
  }

  return [
    define('createThread then listThreads returns the thread with empty defaults', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      const threads = await a.listThreads()
      const found = threads.filter((t) => t.id === id)
      assert(found.length === 1, `listThreads returned ${found.length} threads for one create`)
      const thread = found[0]
      assert(thread !== undefined, 'listThreads entry was undefined')
      assert(thread.messages.length === 0, 'a new thread must start with no messages')
      assert(thread.outcome === null, "a new thread's outcome must be null")
      assert(thread.status === 'pending', `a new thread's status must be 'pending'`)
      assert(thread.read === false, 'a new thread must be unread')
      assert(typeof thread.createdAt === 'number', 'createdAt must be a number')
      assert(typeof thread.updatedAt === 'number', 'updatedAt must be a number')
    }),

    define('createThread persists meta', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id, meta: { source: 'contract' } })
      const thread = await loadOrThrow(a, id)
      assert(thread.meta?.['source'] === 'contract', 'meta did not round-trip')
    }),

    define('loadThread returns null for an unknown id', async (a) => {
      const thread = await a.loadThread(mintThreadId())
      assert(thread === null, 'loadThread must return null (not throw, not undefined) when absent')
    }),

    define('appendMessage is idempotent on message.id', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      const msg = message<TPart>('contract-msg-1')
      await a.appendMessage({ threadId: id, message: msg })
      await a.appendMessage({ threadId: id, message: msg })
      const thread = await loadOrThrow(a, id)
      assert(
        thread.messages.length === 1,
        `appending the same message.id twice produced ${thread.messages.length} rows — the id is the only idempotency key`,
      )
      assert(thread.messages[0]?.id === 'contract-msg-1', 'the retained message has the wrong id')
    }),

    define('appendMessage preserves order for distinct ids', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      await a.appendMessage({ threadId: id, message: message<TPart>('contract-msg-1') })
      await a.appendMessage({ threadId: id, message: message<TPart>('contract-msg-2') })
      const thread = await loadOrThrow(a, id)
      assert(
        thread.messages.map((m) => m.id).join(',') === 'contract-msg-1,contract-msg-2',
        'messages must read back oldest-first in append order',
      )
    }),

    define('setStatus round-trips', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      await a.setStatus({ threadId: id, status: 'streaming' })
      assert((await loadOrThrow(a, id)).status === 'streaming', "status did not become 'streaming'")
      await a.setStatus({ threadId: id, status: 'error' })
      assert((await loadOrThrow(a, id)).status === 'error', "status did not become 'error'")
    }),

    define('setOutcome round-trips', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      const outcome: AgentOutcome = { title: 'Title', summary: 'Summary', status: 'done' }
      await a.setOutcome({ threadId: id, outcome })
      const thread = await loadOrThrow(a, id)
      assert(thread.outcome?.title === 'Title', 'outcome.title did not round-trip')
      assert(thread.outcome?.summary === 'Summary', 'outcome.summary did not round-trip')
      assert(thread.outcome?.status === 'done', 'outcome.status did not round-trip')
    }),

    define('setResumeToken round-trips and clears with undefined', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      await a.setResumeToken({ threadId: id, token: 'tok-1' })
      assert((await loadOrThrow(a, id)).resumeToken === 'tok-1', 'resumeToken did not round-trip')
      await a.setResumeToken({ threadId: id, token: undefined })
      assert(
        (await loadOrThrow(a, id)).resumeToken === undefined,
        'setResumeToken(undefined) must CLEAR the token',
      )
    }),

    define('markRead marks the thread read', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      assert((await loadOrThrow(a, id)).read === false, 'a new thread must start unread')
      await a.markRead(id)
      assert((await loadOrThrow(a, id)).read === true, 'markRead did not set read')
    }),

    define('listThreads reflects a write that has already resolved', async (a) => {
      // The store keeps a write's optimistic patch applied until a listThreads STARTED after that
      // write resolved lands in the confirmed base. An eventually-consistent list (a stale read
      // replica, a cached response) breaks that and flashes the pre-write state back into the UI.
      const id = mintThreadId()
      await a.createThread({ id })
      await a.appendMessage({ threadId: id, message: message<TPart>('contract-msg-raw') })
      await a.setStatus({ threadId: id, status: 'streaming' })
      const found = (await a.listThreads()).find((t) => t.id === id)
      assert(found !== undefined, 'listThreads omitted a thread created before the call')
      assert(
        found.status === 'streaming',
        'listThreads returned a STALE status — a list started after a write resolves must reflect it',
      )
      assert(
        found.messages.length === 1,
        `listThreads returned a STALE message list (${found.messages.length} rows) — a list started after a write resolves must reflect it`,
      )
    }),

    define(
      'dependent writes issued straight after createThread resolves are honoured',
      async (a) => {
        // The store serializes writes per thread id, so this exact sequence — the send path's
        // create-then-first-message — is what a real adapter receives. Each write must find the row.
        const id = mintThreadId()
        await a.createThread({ id })
        await a.markRead(id)
        await a.appendMessage({ threadId: id, message: message<TPart>('contract-msg-dep') })
        await a.setStatus({ threadId: id, status: 'streaming' })
        const thread = await loadOrThrow(a, id)
        assert(thread.read === true, 'markRead did not apply to a just-created thread')
        assert(
          thread.messages.length === 1,
          `appendMessage did not apply to a just-created thread (${thread.messages.length} rows)`,
        )
        assert(thread.status === 'streaming', 'setStatus did not apply to a just-created thread')
      },
    ),

    define('removeThread removes the thread', async (a) => {
      const id = mintThreadId()
      await a.createThread({ id })
      await a.removeThread(id)
      assert(await a.loadThread(id).then((t) => t === null), 'loadThread must be null after remove')
      const threads = await a.listThreads()
      assert(!threads.some((t) => t.id === id), 'listThreads still contains the removed thread')
    }),

    define('removeThread of an unknown id does not throw', async (a) => {
      await a.removeThread(mintThreadId())
    }),
  ]
}
