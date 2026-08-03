/**
 * in-memory-adapter — a `ThreadsStoreAdapter` implementation backing the `/threads-adapter`
 * playground gate demo (basalt-ui 1.12.0 — `ThreadsStoreAdapter` + `createAdapterThreadsStore` +
 * `threadsStoreAdapterContract`).
 *
 * Stands in for a real server (Postgres, an HTTP API): an in-memory `Map`, an artificial
 * round-trip `latencyMs` on every call so hydration/optimistic-append/rollback are all visible
 * instead of instantaneous, and — for the controllable variant only — an `armFailure()` escape
 * hatch that forces exactly the NEXT write to reject, so a human can trigger a rollback on demand.
 *
 * Two factories, not one, so the plain one handed to `threadsStoreAdapterContract` is exactly a
 * `ThreadsStoreAdapter` with nothing extra bolted on (the contract's `makeAdapter` return type is
 * checked structurally) — `createControllableInMemoryAdapter` is the interactive demo's own
 * superset.
 */
import type { AgentPart, AgentThread, ThreadsStoreAdapter } from 'basalt-ui/agent'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type InMemoryAdapterOptions = {
  /** @default 400 */
  readonly latencyMs?: number
}

function maybeFail(shouldFail: () => boolean, onFail: () => void, operation: string): void {
  if (!shouldFail()) return
  onFail()
  throw new Error(`Simulated failure: ${operation}`)
}

function buildAdapter(
  latencyMs: number,
  shouldFail: () => boolean,
  onFail: () => void,
): ThreadsStoreAdapter<AgentPart> {
  const threads = new Map<string, AgentThread<AgentPart>>()

  function requireThread(id: string, operation: string): AgentThread<AgentPart> {
    const thread = threads.get(id)
    if (thread === undefined) throw new Error(`${operation}: unknown thread ${id}`)
    return thread
  }

  return {
    listThreads: async () => {
      await sleep(latencyMs)
      return [...threads.values()].toSorted((a, b) => b.createdAt - a.createdAt)
    },

    loadThread: async (id) => {
      await sleep(latencyMs)
      return threads.get(id) ?? null
    },

    createThread: async ({ id, meta }) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'createThread')
      const now = Date.now()
      threads.set(id, {
        id,
        messages: [],
        outcome: null,
        status: 'pending',
        read: false,
        createdAt: now,
        updatedAt: now,
        ...(meta !== undefined ? { meta } : {}),
      })
    },

    appendMessage: async ({ threadId, message }) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'appendMessage')
      const thread = requireThread(threadId, 'appendMessage')
      if (thread.messages.some((m) => m.id === message.id)) return
      threads.set(threadId, {
        ...thread,
        messages: [...thread.messages, message],
        updatedAt: Date.now(),
      })
    },

    setStatus: async ({ threadId, status }) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'setStatus')
      const thread = requireThread(threadId, 'setStatus')
      threads.set(threadId, { ...thread, status, updatedAt: Date.now() })
    },

    setOutcome: async ({ threadId, outcome }) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'setOutcome')
      const thread = requireThread(threadId, 'setOutcome')
      threads.set(threadId, { ...thread, outcome, updatedAt: Date.now() })
    },

    setResumeToken: async ({ threadId, token }) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'setResumeToken')
      const thread = requireThread(threadId, 'setResumeToken')
      const { resumeToken: _drop, ...rest } = thread
      threads.set(threadId, {
        ...rest,
        ...(token !== undefined ? { resumeToken: token } : {}),
        updatedAt: Date.now(),
      })
    },

    markRead: async (threadId) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'markRead')
      const thread = requireThread(threadId, 'markRead')
      threads.set(threadId, { ...thread, read: true })
    },

    removeThread: async (threadId) => {
      await sleep(latencyMs)
      maybeFail(shouldFail, onFail, 'removeThread')
      threads.delete(threadId)
    },
  }
}

/** A fresh, empty in-memory adapter — no failure control. What `threadsStoreAdapterContract`'s
 * `makeAdapter` returns for each independent case. */
export function createInMemoryAdapter(
  opts: InMemoryAdapterOptions = {},
): ThreadsStoreAdapter<AgentPart> {
  return buildAdapter(
    opts.latencyMs ?? 400,
    () => false,
    () => {},
  )
}

export type ControllableAdapter = {
  readonly adapter: ThreadsStoreAdapter<AgentPart>
  /** Forces the NEXT write (any method except `listThreads`/`loadThread`) to reject, once. */
  readonly armFailure: () => void
}

/** The interactive demo's adapter — same behaviour as `createInMemoryAdapter`, plus `armFailure()`
 * so a human can trigger a rollback on demand. */
export function createControllableInMemoryAdapter(
  opts: InMemoryAdapterOptions = {},
): ControllableAdapter {
  let failNext = false
  const adapter = buildAdapter(
    opts.latencyMs ?? 400,
    () => failNext,
    () => {
      failNext = false
    },
  )
  return {
    adapter,
    armFailure: () => {
      failNext = true
    },
  }
}
