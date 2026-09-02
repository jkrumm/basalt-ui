/**
 * useAgentThreadRuns — mount-time reconcile ("resume orphaned threads after a reload") coverage.
 *
 * The mount-reconcile effect (empty deps — a one-time sweep of whatever the store held when this
 * manager first attaches) treats any persisted 'pending' or 'streaming' thread with no live
 * controller as orphaned, and either attempts `transport.resume(resumeToken, signal)` (when the
 * transport is RESUMABLE per `isResumable` — `resume` AND the literal `idempotentReplay: true`
 * assertion, a resumeToken is present, and there's a last user message to attribute the resumed
 * turn to) or falls back straight to 'interrupted'. `resume` alone is NOT enough post-B2 — see the
 * dedicated "resume() present but no idempotentReplay" test below.
 *
 * The F3 wedge (StrictMode/`<Activity>` re-running this same effect on the SAME fiber) has its
 * own file: `use-agent-thread-runs.wedge.test.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { AgentThread, ThreadsStore } from './thread'
import type { AgentTransport, ResumableAgentTransport } from './transport'
import type { AgentPart } from './parts'
import type { ChatMessage } from './history'
import type { AgentOutcome } from './outcome'

// ── test-only ThreadsStore double — see use-agent-thread-runs.wedge.test.tsx for the rationale ──
function createTestThreadsStore(initial: AgentThread<AgentPart>[]): ThreadsStore<AgentPart> {
  let threads = initial
  let activeId: string | null = null
  return {
    get threads() {
      return threads
    },
    get activeId() {
      return activeId
    },
    select(id) {
      activeId = id
    },
    create(opts) {
      const id = crypto.randomUUID()
      const now = Date.now()
      const thread: AgentThread<AgentPart> = {
        id,
        messages: [],
        outcome: null,
        status: 'pending',
        read: false,
        createdAt: now,
        updatedAt: now,
        ...(opts?.meta !== undefined ? { meta: opts.meta } : {}),
      }
      threads = [thread, ...threads]
      return id
    },
    appendMessage(id, message) {
      threads = threads.map((thread) =>
        thread.id === id
          ? { ...thread, messages: [...thread.messages, message], updatedAt: Date.now() }
          : thread,
      )
    },
    setOutcome(id, outcome) {
      threads = threads.map((thread) =>
        thread.id === id ? { ...thread, outcome, updatedAt: Date.now() } : thread,
      )
    },
    setStatus(id, status) {
      threads = threads.map((thread) =>
        thread.id === id ? { ...thread, status, updatedAt: Date.now() } : thread,
      )
    },
    setResumeToken(id, token) {
      threads = threads.map((thread) => {
        if (thread.id !== id) return thread
        const { resumeToken: _resumeToken, ...rest } = thread
        return {
          ...rest,
          ...(token !== undefined ? { resumeToken: token } : {}),
          updatedAt: Date.now(),
        }
      })
    },
    markRead(id) {
      threads = threads.map((thread) => (thread.id === id ? { ...thread, read: true } : thread))
    },
    remove(id) {
      threads = threads.filter((thread) => thread.id !== id)
      if (activeId === id) activeId = null
    },
    clear() {
      threads = []
      activeId = null
    },
    // Always-hydrated, never-erroring — mirrors the localStorage-backed store's real values
    // (see ThreadsStore.hydrated/.error doc comments); this double is a synchronous in-memory
    // stand-in with no async load path to fail.
    hydrated: true,
    error: undefined,
  }
}

function makeStreamingThread(
  overrides: Partial<AgentThread<AgentPart>> = {},
): AgentThread<AgentPart> {
  const now = Date.now()
  const userMessage: ChatMessage<AgentPart> = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ id: 'seed-user-part', type: 'text', text: 'hello' }],
    createdAt: now,
  }
  return {
    id: crypto.randomUUID(),
    messages: [userMessage],
    outcome: null,
    status: 'streaming',
    read: false,
    createdAt: now,
    updatedAt: now,
    resumeToken: 'resume-token',
    ...overrides,
  }
}

const resolveOutcome = (): AgentOutcome => ({ title: 'title', summary: 'summary', status: 'done' })

describe('useAgentThreadRuns — mount-time reconcile', () => {
  test('no resume() on the transport → falls back to interrupted', async () => {
    const thread = makeStreamingThread()
    const store = createTestThreadsStore([thread])

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      // no `resume` key at all
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('interrupted')
    })
  })

  test('no resumeToken on the persisted thread → falls back to interrupted, even with a resumable transport', async () => {
    // exactOptionalPropertyTypes forbids `resumeToken: undefined` as an override — build the
    // thread directly, simply omitting the key, to represent "never had a resumeToken".
    const now = Date.now()
    const userMessage: ChatMessage<AgentPart> = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ id: 'seed-user-part', type: 'text', text: 'hello' }],
      createdAt: now,
    }
    const thread: AgentThread<AgentPart> = {
      id: crypto.randomUUID(),
      messages: [userMessage],
      outcome: null,
      status: 'streaming',
      read: false,
      createdAt: now,
      updatedAt: now,
    }
    const store = createTestThreadsStore([thread])

    let resumeCalls = 0
    const transport: ResumableAgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('interrupted')
    })
    expect(resumeCalls).toBe(0)
  })

  test('no last user message on the persisted thread → falls back to interrupted, even with a resumable transport + token', async () => {
    const thread = makeStreamingThread({ messages: [] })
    const store = createTestThreadsStore([thread])

    let resumeCalls = 0
    const transport: ResumableAgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('interrupted')
    })
    expect(resumeCalls).toBe(0)
  })

  test('resume() present but WITHOUT idempotentReplay → still falls back to interrupted (resume alone is not enough post-B2)', async () => {
    const thread = makeStreamingThread()
    const store = createTestThreadsStore([thread])

    let resumeCalls = 0
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
      // deliberately NO idempotentReplay: true
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('interrupted')
    })
    expect(resumeCalls).toBe(0)
  })

  test('resumable transport + token + last user message → resume() is called exactly once, with that token', async () => {
    const thread = makeStreamingThread({ resumeToken: 'the-exact-token' })
    const store = createTestThreadsStore([thread])

    const resumeArgs: string[] = []
    const transport: ResumableAgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume(token) {
        resumeArgs.push(token)
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('done')
    })
    expect(resumeArgs).toEqual(['the-exact-token'])
  })

  test('a failed resume() falls back to interrupted via onFailureStatus, not error', async () => {
    const thread = makeStreamingThread()
    const store = createTestThreadsStore([thread])

    const transport = {
      async *stream() {},
      // oxlint-disable-next-line require-yield
      async *resume() {
        throw new Error('resume failed')
      },
      idempotentReplay: true as const,
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('interrupted')
    })
  })

  test('a "pending" (never-started) thread with no live controller is also swept by reconcile', async () => {
    // Not covered by "streaming" scenarios above: reconcile's orphan check is
    // `status === 'pending' || status === 'streaming'`, so a thread that was created but never
    // started is reconciled the same way on the very next mount.
    const now = Date.now()
    const pendingThread: AgentThread<AgentPart> = {
      id: crypto.randomUUID(),
      messages: [],
      outcome: null,
      status: 'pending',
      read: false,
      createdAt: now,
      updatedAt: now,
    }
    const store = createTestThreadsStore([pendingThread])

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === pendingThread.id)?.status).toBe('interrupted')
    })
  })
})

// ── R3 — the reconcile effect keyed on `store.hydrated` ──────────────────────────────────────
//
// The bare `[]`-dep effect above ran once, at mount, over whatever `store.threads` held AT THAT
// INSTANT. For `createAdapterThreadsStore` (an async, server-backed store), that instant is BEFORE
// the first `listThreads` resolves — `store.threads` is still the adapter's empty pre-load
// snapshot, `store.hydrated` is `false`, and the effect never runs again once hydration completes,
// so a thread orphaned by a reload/remount was invisible to the sweep for the store shape that most
// needs it (S16 in the maturation doc). This double models exactly that shape: `hydrated`/`threads`
// start empty/false and only "arrive" on a later render, mimicking the adapter's async load.
describe('useAgentThreadRuns — reconcile effect keyed on store.hydrated (R3)', () => {
  test('an async store: hydrated flips true AFTER mount → the reconcile sweep still runs against the newly-loaded threads', async () => {
    const now = Date.now()
    const userMessage: ChatMessage<AgentPart> = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ id: 'seed-user-part', type: 'text', text: 'hello' }],
      createdAt: now,
    }
    const orphanedThread: AgentThread<AgentPart> = {
      id: crypto.randomUUID(),
      messages: [userMessage],
      outcome: null,
      status: 'streaming',
      read: false,
      createdAt: now,
      updatedAt: now,
      resumeToken: 'async-resume-token',
    }

    // Mutable closure state the store's getters read — mimics an adapter store whose `threads`/
    // `hydrated` only reflect the real data once its first `listThreads` resolves.
    let hydrated = false
    let threads: AgentThread<AgentPart>[] = []

    const store: ThreadsStore<AgentPart> = {
      get threads() {
        return threads
      },
      activeId: null,
      select() {},
      create() {
        return crypto.randomUUID()
      },
      appendMessage() {},
      setOutcome(id, outcome) {
        threads = threads.map((thread) => (thread.id === id ? { ...thread, outcome } : thread))
      },
      setStatus(id, status) {
        threads = threads.map((thread) => (thread.id === id ? { ...thread, status } : thread))
      },
      setResumeToken(id, token) {
        threads = threads.map((thread) => {
          if (thread.id !== id) return thread
          const { resumeToken: _resumeToken, ...rest } = thread
          return { ...rest, ...(token !== undefined ? { resumeToken: token } : {}) }
        })
      },
      markRead() {},
      remove() {},
      clear() {},
      get hydrated() {
        return hydrated
      },
      error: undefined,
    }

    const resumeArgs: string[] = []
    const transport: ResumableAgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume(token) {
        resumeArgs.push(token)
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }

    const { rerender } = renderHook(
      ({ store: currentStore }: { store: ThreadsStore<AgentPart> }) =>
        useAgentThreadRuns({ transport, store: currentStore, resolveOutcome }),
      { initialProps: { store } },
    )

    // Nothing to reconcile at mount — `store.hydrated` is false and `store.threads` is still the
    // adapter's empty pre-load snapshot, exactly like `createAdapterThreadsStore` before its first
    // `listThreads` resolves.
    expect(resumeArgs).toEqual([])
    expect(store.threads).toEqual([])

    // Hydration "arrives": the real threads (including the orphaned streaming one) land, and
    // `hydrated` flips true — the same shape as the adapter's load resolving.
    threads = [orphanedThread]
    hydrated = true
    rerender({ store })

    await waitFor(() => {
      expect(store.threads.find((thread) => thread.id === orphanedThread.id)?.status).toBe('done')
    })
    expect(resumeArgs).toEqual(['async-resume-token'])
  })
})
