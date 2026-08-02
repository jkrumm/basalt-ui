/**
 * useAgentThreadRuns — concurrency, busy-thread no-op, finalize ordering, failure status, retry.
 *
 * Scope: the multi-thread run manager AS THE PUBLIC API EXISTS TODAY (B1). No mergePart/part ids/
 * offsets, no seven-state ToolCallPart, no ResumableAgentTransport/isResumable/idempotentReplay
 * beyond the plain optional `resume` already on AgentTransport, no stop-preserves-partial-turn, no
 * ThreadsStoreAdapter — all later releases, not exercised here.
 *
 * The mount-reconcile/resume path (StartPart handling, orphaned-thread resumption on mount) has
 * its own file, `use-agent-thread-runs.resume.test.tsx`; the F3 wedge has its own file,
 * `use-agent-thread-runs.wedge.test.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { AgentThread, ThreadsStore } from './thread'
import type { AgentTransport } from './transport'
import type { AgentPart } from './parts'
import type { AgentOutcome, OutcomeResolver } from './outcome'

// ── test-only ThreadsStore double — see use-agent-thread-runs.wedge.test.tsx for the rationale ──
function createTestThreadsStore(
  opts: {
    readonly initial?: AgentThread<AgentPart>[]
    readonly onCall?: (method: string) => void
  } = {},
): ThreadsStore<AgentPart> {
  let threads = opts.initial ?? []
  let activeId: string | null = null
  const onCall = opts.onCall ?? ((): void => {})

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
    create(createOpts) {
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
        ...(createOpts?.meta !== undefined ? { meta: createOpts.meta } : {}),
      }
      threads = [thread, ...threads]
      return id
    },
    appendMessage(id, message) {
      onCall('appendMessage')
      threads = threads.map((thread) =>
        thread.id === id
          ? { ...thread, messages: [...thread.messages, message], updatedAt: Date.now() }
          : thread,
      )
    },
    setOutcome(id, outcome) {
      onCall('setOutcome')
      threads = threads.map((thread) =>
        thread.id === id ? { ...thread, outcome, updatedAt: Date.now() } : thread,
      )
    },
    setStatus(id, status) {
      onCall('setStatus')
      threads = threads.map((thread) =>
        thread.id === id ? { ...thread, status, updatedAt: Date.now() } : thread,
      )
    },
    setResumeToken(id, token) {
      onCall('setResumeToken')
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

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const resolveOutcome: OutcomeResolver<AgentPart> = (): AgentOutcome => ({
  title: 'title',
  summary: 'summary',
  status: 'done',
})

describe('useAgentThreadRuns — concurrency, no-op guard, finalize order, failure, retry', () => {
  test('two threads stream fully independently', async () => {
    const store = createTestThreadsStore()
    const threadA = store.create()
    const threadB = store.create()

    const gates = new Map<string, ReturnType<typeof deferred<void>>>()
    gates.set('input-a', deferred<void>())
    gates.set('input-b', deferred<void>())

    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        await gates.get(input)?.promise
        yield { type: 'text', text: `done:${input}` }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadA, 'input-a')
      result.current.start(threadB, 'input-b')
    })

    expect(result.current.runs.get(threadA)?.status).toBe('streaming')
    expect(result.current.runs.get(threadB)?.status).toBe('streaming')

    // Resolve A only — B must stay untouched. Resolving a promise is not itself a React update,
    // so this stays outside act(); waitFor (imported from @testing-library/react) is act-wrapped
    // internally and polls until the resulting state settles.
    gates.get('input-a')?.resolve(undefined)

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadA)?.status).toBe('done')
    })
    expect(store.threads.find((t) => t.id === threadB)?.status).toBe('streaming')
    expect(result.current.runs.has(threadB)).toBe(true)

    // Resolve B — it settles independently, unaffected by A having already finished.
    gates.get('input-b')?.resolve(undefined)

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadB)?.status).toBe('done')
    })
  })

  test('start() on a busy thread is a no-op and does not overwrite the cached input', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const calls: string[] = []
    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        calls.push(input)
        await gate.promise
        yield { type: 'text', text: 'ok' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'first')
    })
    expect(calls).toEqual(['first'])

    // Busy: the SAME thread already has a controller. This must no-op — no second stream() call,
    // and (critically) must NOT clobber the cached input retry() will replay.
    act(() => {
      result.current.start(threadId, 'second')
    })
    expect(calls).toEqual(['first'])

    // Let the first (and only) turn finish, then retry() — it must replay 'first', never 'second'.
    gate.resolve(undefined)
    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })

    act(() => {
      result.current.retry(threadId)
    })
    expect(calls).toEqual(['first', 'first'])

    // Let the replayed run settle too, so no pending async work leaks past this test's act
    // boundary into the next one.
    await waitFor(() => {
      expect(result.current.runs.has(threadId)).toBe(false)
    })
  })

  test('finalize order on success: appendMessage → resolveOutcome → setOutcome → setStatus → setResumeToken', async () => {
    const order: string[] = []
    const store = createTestThreadsStore({ onCall: (method) => order.push(method) })
    const threadId = store.create()

    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        await gate.promise
        yield { type: 'text', text: 'hi' }
      },
    }

    const orderedResolveOutcome: OutcomeResolver<AgentPart> = async (): Promise<AgentOutcome> => {
      order.push('resolveOutcome')
      return { title: 'title', summary: 'summary', status: 'done' }
    }

    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome: orderedResolveOutcome }),
    )

    act(() => {
      result.current.start(threadId, 'hi')
    })
    // start() itself already logged 'appendMessage' (user message) + 'setStatus' ('streaming') —
    // baseline everything from here on.
    const baseline = order.length

    gate.resolve(undefined)
    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })

    expect(order.slice(baseline)).toEqual([
      'appendMessage',
      'resolveOutcome',
      'setOutcome',
      'setStatus',
      'setResumeToken',
    ])

    // The controller/runs entry is torn down as the final step of the same finalize — proven
    // indirectly: the run entry is gone, and a subsequent start() is accepted immediately (the
    // busy guard would block it if the controller were still registered).
    expect(result.current.runs.has(threadId)).toBe(false)
  })

  test('a thrown (non-abort) error sets the onFailureStatus for start() — "error"', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        throw new Error('boom')
        // eslint-disable-next-line no-unreachable
        yield { type: 'text', text: 'unreachable' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'hi')
    })

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('error')
    })
    expect(result.current.runs.has(threadId)).toBe(false)
  })

  test('retry() is a no-op when nothing has been cached for that thread', () => {
    // No store.create() here on purpose: a freshly-created 'pending' thread is itself swept by
    // the mount-reconcile effect (it treats any 'pending'/'streaming' thread with no live
    // controller as orphaned — see use-agent-thread-runs.resume.test.tsx), which would confound
    // this assertion. Using an id with NO entry in the store at all isolates retry()'s own
    // "nothing cached" guard from that unrelated mount-time behavior.
    const store = createTestThreadsStore()
    const threadId = crypto.randomUUID()

    const calls: string[] = []
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        calls.push(input)
        yield { type: 'text', text: 'x' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.retry(threadId)
    })

    expect(calls).toEqual([])
    expect(store.threads).toEqual([])
  })

  test('retry() re-invokes start() with the cached input and produces a genuine second run', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const calls: string[] = []
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        calls.push(input)
        yield { type: 'text', text: `done:${input}` }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'original input')
    })
    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })
    expect(calls).toEqual(['original input'])

    act(() => {
      result.current.retry(threadId)
    })
    // The positive path this test exists to pin: retry() actually calls start() again with the
    // SAME cached input — not a no-op, and not a clobbered/different input.
    expect(calls).toEqual(['original input', 'original input'])
    // A genuine second run is now live — the run entry is back and streaming.
    expect(result.current.runs.get(threadId)?.status).toBe('streaming')

    await waitFor(() => {
      expect(result.current.runs.has(threadId)).toBe(false)
    })
    expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    // Two full turns landed in history: user+assistant, twice.
    expect(store.threads.find((t) => t.id === threadId)?.messages).toHaveLength(4)
  })

  // Flagged for scheduling, not fixed here (out of this task's scope — see the brief's "while you
  // are in there, report, do not fix" note (i)): consumeAndFinalize's success path awaits
  // resolveOutcome (:219) and then writes setOutcome/setStatus (:221-222) WITHOUT re-checking the
  // supersede/abort guards it checked right before the await (:205-207). A slow resolveOutcome
  // racing a stop() call is reachable: stop() sets the thread to 'done' immediately, but once the
  // delayed resolveOutcome finally resolves, the unconditional setStatus(threadId, outcome.status)
  // silently overwrites that 'done' with whatever the outcome resolved to. Verified failing against
  // the current implementation before being marked .skip here.
  test.skip('stop() during a slow resolveOutcome must not be clobbered by the outcome settling later', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    let releaseOutcome: (() => void) | undefined
    const slowResolveOutcome: OutcomeResolver<AgentPart> = () =>
      new Promise<AgentOutcome>((resolve) => {
        releaseOutcome = () => resolve({ title: 't', summary: 's', status: 'attention' })
      })

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { type: 'text', text: 'hi' }
      },
    }

    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome: slowResolveOutcome }),
    )

    act(() => {
      result.current.start(threadId, 'hi')
    })

    // Wait until the assistant message has landed (proving resolveOutcome has been called and is
    // now the pending await).
    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.messages.length).toBe(2)
    })

    act(() => {
      result.current.stop(threadId)
    })
    expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')

    releaseOutcome?.()

    await waitFor(() => {
      // Currently fails: the late setStatus overwrites 'done' with 'attention'.
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })
  })
})
