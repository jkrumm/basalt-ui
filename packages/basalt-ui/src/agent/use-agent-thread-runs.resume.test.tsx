/**
 * useAgentThreadRuns — mount-time reconcile ("resume orphaned threads after a reload") coverage.
 *
 * The mount-reconcile effect (empty deps — a one-time sweep of whatever the store held when this
 * manager first attaches) treats any persisted 'pending' or 'streaming' thread with no live
 * controller as orphaned, and either attempts `transport.resume(resumeToken, signal)` (when the
 * transport supports it, a resumeToken is present, and there's a last user message to attribute
 * the resumed turn to) or falls back straight to 'interrupted'.
 *
 * The F3 wedge (StrictMode/`<Activity>` re-running this same effect on the SAME fiber) has its
 * own file: `use-agent-thread-runs.wedge.test.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { renderHook, waitFor } from '@testing-library/react'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { AgentThread, ThreadsStore } from './thread'
import type { AgentTransport } from './transport'
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
  }
}

function makeStreamingThread(
  overrides: Partial<AgentThread<AgentPart>> = {},
): AgentThread<AgentPart> {
  const now = Date.now()
  const userMessage: ChatMessage<AgentPart> = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
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
      parts: [{ type: 'text', text: 'hello' }],
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
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        yield { type: 'text', text: 'resumed' }
      },
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
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        yield { type: 'text', text: 'resumed' }
      },
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
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume(token) {
        resumeArgs.push(token)
        yield { type: 'text', text: 'resumed' }
      },
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

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      // oxlint-disable-next-line require-yield
      async *resume() {
        throw new Error('resume failed')
      },
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
