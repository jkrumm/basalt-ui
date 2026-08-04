/**
 * ThreadsStoreAdapter — the shipped conformance suite run against a reference in-memory adapter,
 * plus the wrapping store's optimistic/rollback/hydration behaviour.
 *
 * Two distinct things are under test here and they are worth keeping apart:
 *   1. `threadsStoreAdapterContract` itself. Running it against a KNOWN-GOOD adapter proves the
 *      suite passes on a correct implementation; the deliberately-broken adapters below prove it
 *      actually FAILS on a wrong one (a green-on-everything contract is worse than none).
 *   2. `createAdapterThreadsStore`, which is where the async→sync bridge lives.
 *
 * Timing is driven by explicit deferreds rather than by racing the microtask queue: a gated
 * adapter call is guaranteed still in flight when the optimistic assertion runs, so "optimistic"
 * and "settled" are never the same instant by accident.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createAdapterThreadsStore, threadsStoreAdapterContract } from './adapter'
import type { ThreadsStoreAdapter } from './adapter'
import type { ChatMessage } from './history'
import type { AgentPart } from './parts'
import type { AgentThread } from './thread'

// ── reference in-memory adapter ───────────────────────────────────────────────

function createMemoryAdapter(): ThreadsStoreAdapter<AgentPart> {
  // Map insertion order is the creation order, so reversing it is a deterministic newest-first
  // — no reliance on Date.now() resolution, which collides for same-tick creates.
  const threads = new Map<string, AgentThread<AgentPart>>()

  function update(id: string, next: (thread: AgentThread<AgentPart>) => AgentThread<AgentPart>) {
    const thread = threads.get(id)
    if (thread === undefined) return
    threads.set(id, next(thread))
  }

  return {
    listThreads: async () => [...threads.values()].toReversed(),
    loadThread: async (id) => threads.get(id) ?? null,
    createThread: async ({ id, meta }) => {
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
      update(threadId, (thread) =>
        // The contract's central clause: message.id is the only idempotency key.
        thread.messages.some((m) => m.id === message.id)
          ? thread
          : { ...thread, messages: [...thread.messages, message], updatedAt: Date.now() },
      )
    },
    setStatus: async ({ threadId, status }) => {
      update(threadId, (thread) => ({ ...thread, status, updatedAt: Date.now() }))
    },
    setOutcome: async ({ threadId, outcome }) => {
      update(threadId, (thread) => ({ ...thread, outcome, updatedAt: Date.now() }))
    },
    setResumeToken: async ({ threadId, token }) => {
      update(threadId, (thread) => {
        const { resumeToken: _resumeToken, ...rest } = thread
        return {
          ...rest,
          ...(token !== undefined ? { resumeToken: token } : {}),
          updatedAt: Date.now(),
        }
      })
    },
    markRead: async (threadId) => {
      update(threadId, (thread) => ({ ...thread, read: true }))
    },
    removeThread: async (threadId) => {
      threads.delete(threadId)
    },
  }
}

function makeMessage(id: string): ChatMessage<AgentPart> {
  return {
    id,
    role: 'user',
    parts: [{ id: `${id}-p0`, type: 'text', text: id }],
    createdAt: Date.now(),
  }
}

type Deferred = {
  readonly promise: Promise<void>
  readonly resolve: () => void
  readonly reject: (cause: unknown) => void
}

/**
 * Drains the mutation → revalidate → emit chain inside act(). Needed wherever a write is NOT
 * gated by a deferred: its follow-up revalidate resolves a few microtasks later and would emit a
 * React update outside act(), which is a warning, not a failure — but a warning that would then
 * mask a real one.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

function deferred(): Deferred {
  let resolve!: () => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res()
    reject = rej
  })
  return { promise, resolve, reject }
}

// ── 1. the shipped contract, against the reference adapter ────────────────────

describe('threadsStoreAdapterContract', () => {
  for (const conformanceCase of threadsStoreAdapterContract(() => createMemoryAdapter())) {
    test(conformanceCase.name, async () => {
      await conformanceCase.run()
    })
  }

  test('exposes a stable, non-empty list of named cases', () => {
    const cases = threadsStoreAdapterContract(() => createMemoryAdapter())
    expect(cases.length).toBeGreaterThan(8)
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length)
  })

  test("the contract suite itself does not depend on crypto.randomUUID — it still runs to completion via the getRandomValues fallback (mintThreadId, since every id it mints here is a THREAD id, never appendMessage's idempotency key)", async () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
    })
    try {
      for (const conformanceCase of threadsStoreAdapterContract(() => createMemoryAdapter())) {
        await conformanceCase.run()
      }
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }
  })

  test('FAILS an adapter whose appendMessage is not idempotent on message.id', async () => {
    const cases = threadsStoreAdapterContract(() => {
      const memory = createMemoryAdapter()
      const seen = new Map<string, ChatMessage<AgentPart>[]>()
      return {
        ...memory,
        // The classic wrong implementation: an unconditional insert.
        appendMessage: async ({ threadId, message }) => {
          const list = seen.get(threadId) ?? []
          list.push(message)
          seen.set(threadId, list)
          await memory.appendMessage({ threadId, message: { ...message, id: crypto.randomUUID() } })
        },
      }
    })
    const idempotency = cases.find((c) => c.name.includes('idempotent'))
    expect(idempotency).toBeDefined()
    await expect(idempotency?.run()).rejects.toThrow(/idempotency key/)
  })

  test('FAILS an adapter whose listThreads serves a stale (pre-write) list', async () => {
    const cases = threadsStoreAdapterContract(() => {
      const memory = createMemoryAdapter()
      // A read replica one write behind — the failure mode the store's patch lifetime depends on
      // NOT happening, and one that only listThreads (never loadThread) exposes.
      let previous: readonly AgentThread<AgentPart>[] = []
      return {
        ...memory,
        listThreads: async (signal) => {
          const current = await memory.listThreads(signal)
          const stale = previous
          previous = current
          return stale
        },
      }
    })
    const readAfterWrite = cases.find((c) => c.name.includes('already resolved'))
    expect(readAfterWrite).toBeDefined()
    await expect(readAfterWrite?.run()).rejects.toThrow(/listThreads/)
  })

  test('FAILS an adapter whose loadThread throws instead of returning null', async () => {
    const cases = threadsStoreAdapterContract(() => ({
      ...createMemoryAdapter(),
      loadThread: async (id: string) => {
        throw new Error(`no such thread: ${id}`)
      },
    }))
    const missing = cases.find(
      (c) => c.name.includes('unknown id') && c.name.includes('loadThread'),
    )
    expect(missing).toBeDefined()
    await expect(missing?.run()).rejects.toThrow(/no such thread/)
  })
})

// ── 2. createAdapterThreadsStore ──────────────────────────────────────────────

describe('createAdapterThreadsStore', () => {
  test('hydrated goes false -> true once the first listThreads succeeds', async () => {
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      listThreads: async (signal) => {
        await gate.promise
        return memory.listThreads(signal)
      },
    })

    const { result } = renderHook(() => useThreads())

    // The load is still gated, so this is the pre-hydration state, not a race.
    expect(result.current.hydrated).toBe(false)
    expect(result.current.error).toBeUndefined()
    expect(result.current.threads).toEqual([])

    await act(async () => {
      gate.resolve()
      await gate.promise
    })

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })
    expect(result.current.error).toBeUndefined()
  })

  test('a failed initial load surfaces on error and leaves hydrated false', async () => {
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...createMemoryAdapter(),
      listThreads: async () => {
        throw new Error('list-boom')
      },
    })

    const { result } = renderHook(() => useThreads())

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    // The pair is the signal: !hydrated && error means "load failed", not "still loading".
    expect(result.current.hydrated).toBe(false)
    expect((result.current.error as Error).message).toBe('list-boom')
  })

  test('create() returns an id synchronously and the thread is visible before the write settles', async () => {
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      createThread: async (i) => {
        await gate.promise
        await memory.createThread(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create({ meta: { source: 'test' } })
    })

    expect(id).not.toBe('')
    // createThread has not resolved yet — this row exists only as an optimistic patch.
    expect(result.current.threads).toHaveLength(1)
    expect(result.current.threads[0]?.id).toBe(id)
    expect(result.current.threads[0]?.status).toBe('pending')
    expect(result.current.threads[0]?.meta?.['source']).toBe('test')
    expect(await memory.loadThread(id)).toBeNull()

    await act(async () => {
      gate.resolve()
      await gate.promise
    })

    await waitFor(async () => {
      expect(await memory.loadThread(id)).not.toBeNull()
    })
    // Still exactly one row after the patch was dropped in favour of the revalidated list —
    // this is what the patches' idempotency buys.
    await waitFor(() => {
      expect(result.current.threads).toHaveLength(1)
    })
    expect(result.current.error).toBeUndefined()
  })

  test('appendMessage is optimistic and survives a successful revalidate', async () => {
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      appendMessage: async (i) => {
        await gate.promise
        await memory.appendMessage(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await waitFor(async () => {
      expect(await memory.loadThread(id)).not.toBeNull()
    })

    act(() => {
      result.current.appendMessage(id, makeMessage('m-optimistic'))
    })

    // Visible immediately, while the adapter write is still gated.
    expect(result.current.threads[0]?.messages.map((m) => m.id)).toEqual(['m-optimistic'])

    await act(async () => {
      gate.resolve()
      await gate.promise
    })

    await waitFor(async () => {
      expect((await memory.loadThread(id))?.messages).toHaveLength(1)
    })
    // No duplicate frame: the patch stays applied across the revalidate, then is dropped.
    await waitFor(() => {
      expect(result.current.threads[0]?.messages.map((m) => m.id)).toEqual(['m-optimistic'])
    })
    expect(result.current.error).toBeUndefined()
  })

  test('a rejected appendMessage rolls the optimistic message back and records the error', async () => {
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      appendMessage: async () => {
        await gate.promise
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await waitFor(async () => {
      expect(await memory.loadThread(id)).not.toBeNull()
    })

    act(() => {
      result.current.appendMessage(id, makeMessage('m-doomed'))
    })
    expect(result.current.threads[0]?.messages).toHaveLength(1)

    await act(async () => {
      gate.reject(new Error('append-boom'))
      await gate.promise.catch(() => {})
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    expect((result.current.error as Error).message).toBe('append-boom')
    // Rolled back: the optimistic patch is gone and the backend never saw the row.
    expect(result.current.threads[0]?.messages).toHaveLength(0)
    expect((await memory.loadThread(id))?.messages).toHaveLength(0)
  })

  test('a rejected write rolls back only its own patch, not a concurrent one', async () => {
    const failing = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      setStatus: async (i) => {
        await failing.promise
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await waitFor(async () => {
      expect(await memory.loadThread(id)).not.toBeNull()
    })

    act(() => {
      result.current.setStatus(id, 'streaming') // gated, will reject
      result.current.markRead(id) // ungated, will succeed
    })
    expect(result.current.threads[0]?.status).toBe('streaming')
    expect(result.current.threads[0]?.read).toBe(true)

    await act(async () => {
      failing.reject(new Error('status-boom'))
      await failing.promise.catch(() => {})
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    // Per-patch rollback: the status reverts, the read flag beside it does not.
    expect(result.current.threads[0]?.status).toBe('pending')
    expect(result.current.threads[0]?.read).toBe(true)
  })

  // ── rolled-back create() and its dependent writes ───────────────────────────

  test('a rolled-back create surfaces its own error, not a cascade from the writes queued behind it', async () => {
    const calls: string[] = []
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      createThread: async () => {
        calls.push('createThread')
        throw new Error('create-boom')
      },
      // Mirrors the real finding: a real backend REJECTS a write against a row that was never
      // created, it does not silently no-op the way the permissive reference `memory` adapter
      // does — so these reproduce the exact "unknown thread" cascade from the console trace.
      markRead: async (id) => {
        calls.push('markRead')
        if ((await memory.loadThread(id)) === null)
          throw new Error(`markRead: unknown thread ${id}`)
        await memory.markRead(id)
      },
      appendMessage: async (i) => {
        calls.push('appendMessage')
        if ((await memory.loadThread(i.threadId)) === null) {
          throw new Error(`appendMessage: unknown thread ${i.threadId}`)
        }
        await memory.appendMessage(i)
      },
      setStatus: async (i) => {
        calls.push('setStatus')
        if ((await memory.loadThread(i.threadId)) === null) {
          throw new Error(`setStatus: unknown thread ${i.threadId}`)
        }
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    // Exactly the observed sequence: create() -> markRead() -> appendMessage() -> setStatus() in
    // one synchronous block, every dependent write chained behind the same rejected createThread.
    let id = ''
    act(() => {
      id = result.current.create()
      result.current.markRead(id)
      result.current.appendMessage(id, makeMessage('m-first'))
      result.current.setStatus(id, 'streaming')
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    await settle()

    // The surfaced error names the create, not one of the three cascade rejections that would
    // otherwise overwrite it in issue order.
    expect((result.current.error as Error).message).toBe('create-boom')
    // The dependent writes never reached the adapter at all — dropped, not run-and-failed.
    expect(calls).toEqual(['createThread'])
    // Rollback semantics are untouched: the thread is gone, both locally and server-side.
    expect(result.current.threads).toHaveLength(0)
    expect(await memory.loadThread(id)).toBeNull()
  })

  test('a rolled-back create does not stall or spoil the write queue for a different thread', async () => {
    const memory = createMemoryAdapter()
    const calls: string[] = []
    let createCalls = 0
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      createThread: async (i) => {
        createCalls += 1
        if (createCalls === 1) {
          calls.push('createThread:doomed')
          throw new Error('create-boom')
        }
        calls.push('createThread:healthy')
        await memory.createThread(i)
      },
      markRead: async (id) => {
        calls.push(`markRead:${id}`)
        await memory.markRead(id)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let doomed = ''
    let healthy = ''
    act(() => {
      doomed = result.current.create()
      result.current.markRead(doomed)
      healthy = result.current.create()
      result.current.markRead(healthy)
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    await waitFor(async () => {
      expect(await memory.loadThread(healthy)).not.toBeNull()
    })
    await settle()

    expect((result.current.error as Error).message).toBe('create-boom')
    // doomed's markRead was dropped; healthy's own write for a DIFFERENT thread ran normally.
    expect(calls).toEqual(['createThread:doomed', 'createThread:healthy', `markRead:${healthy}`])
    expect((await memory.loadThread(healthy))?.read).toBe(true)
    expect(await memory.loadThread(doomed)).toBeNull()
  })

  test('a genuine failure that arrives after a rolled-back create still surfaces', async () => {
    const memory = createMemoryAdapter()
    let createCalls = 0
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      createThread: async (i) => {
        createCalls += 1
        if (createCalls === 1) throw new Error('create-boom')
        await memory.createThread(i)
      },
      markRead: async () => {
        // A genuine, unrelated failure against a HEALTHY thread — not a cascade of the rollback.
        throw new Error('markRead-boom')
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    act(() => {
      result.current.create()
    })
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    expect((result.current.error as Error).message).toBe('create-boom')

    let healthy = ''
    act(() => {
      healthy = result.current.create()
    })
    await waitFor(async () => {
      expect(await memory.loadThread(healthy)).not.toBeNull()
    })

    act(() => {
      result.current.markRead(healthy)
    })

    await waitFor(() => {
      expect((result.current.error as Error).message).toBe('markRead-boom')
    })
  })

  test('a rolled-back create keeps dropping its thread’s writes after the queue drains', async () => {
    // The run's COMPLETION path (useAgentThreadRuns: appendMessage(assistant) -> setOutcome ->
    // setStatus -> setResumeToken) lands when the stream ends, long after the create's own
    // rollback has drained the per-thread chain. Those writes target the same rolled-back row, so
    // they are the same cascade as the synchronous send-path trio — just later. If the failed-id
    // record is cleared when the chain drains, the fix above covers the first ~200ms and then the
    // cascade returns at stream end, which is precisely when the user is looking at the thread.
    const calls: string[] = []
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      createThread: async () => {
        calls.push('createThread')
        throw new Error('create-boom')
      },
      appendMessage: async (i) => {
        calls.push('appendMessage')
        if ((await memory.loadThread(i.threadId)) === null) {
          throw new Error(`appendMessage: unknown thread ${i.threadId}`)
        }
        await memory.appendMessage(i)
      },
      setStatus: async (i) => {
        calls.push('setStatus')
        if ((await memory.loadThread(i.threadId)) === null) {
          throw new Error(`setStatus: unknown thread ${i.threadId}`)
        }
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    // Drain fully: the create's chain entry is gone by the time the completion writes arrive.
    await settle()
    await settle()
    expect((result.current.error as Error).message).toBe('create-boom')

    // The completion path fires now, against the row that was never materialized.
    act(() => {
      result.current.appendMessage(id, makeMessage('m-assistant'))
      result.current.setStatus(id, 'done')
    })
    await settle()
    await settle()

    expect(calls).toEqual(['createThread'])
    expect((result.current.error as Error).message).toBe('create-boom')
  })

  test('setResumeToken(undefined) clears the key through the adapter', async () => {
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>(memory)

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await waitFor(async () => {
      expect(await memory.loadThread(id)).not.toBeNull()
    })

    act(() => {
      result.current.setResumeToken(id, 'tok-1')
    })
    await waitFor(() => {
      expect(result.current.threads[0]?.resumeToken).toBe('tok-1')
    })

    act(() => {
      result.current.setResumeToken(id, undefined)
    })
    await waitFor(() => {
      expect(result.current.threads[0]?.resumeToken).toBeUndefined()
    })
    expect('resumeToken' in ((await memory.loadThread(id)) ?? {})).toBe(false)
  })

  test('remove clears activeId and deletes through the adapter; clear empties everything', async () => {
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>(memory)

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let first = ''
    let second = ''
    act(() => {
      first = result.current.create()
      second = result.current.create()
      result.current.select(first)
    })
    expect(result.current.activeId).toBe(first)
    await settle()

    act(() => {
      result.current.remove(first)
    })
    expect(result.current.activeId).toBeNull()
    await waitFor(async () => {
      expect(await memory.loadThread(first)).toBeNull()
    })
    expect(result.current.threads.map((t) => t.id)).toEqual([second])
    // Still null once the delete is CONFIRMED and its patch retires — the cleared selection is
    // committed with the patch, not merely simulated by it.
    await settle()
    expect(result.current.activeId).toBeNull()

    act(() => {
      result.current.clear()
    })
    expect(result.current.threads).toEqual([])
    await waitFor(async () => {
      expect(await memory.listThreads()).toHaveLength(0)
    })
  })

  test('two hook instances share one registry', async () => {
    const useThreads = createAdapterThreadsStore<AgentPart>(createMemoryAdapter())

    const a = renderHook(() => useThreads())
    const b = renderHook(() => useThreads())
    await waitFor(() => {
      expect(a.result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = a.result.current.create()
    })

    expect(b.result.current.threads.map((t) => t.id)).toEqual([id])
    await settle()
    expect(b.result.current.threads.map((t) => t.id)).toEqual([id])
  })

  test('unmounting aborts the in-flight load — the abort is not reported as an error', async () => {
    const gate = deferred()
    let observedSignal: AbortSignal | undefined
    let listCalls = 0
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      listThreads: async (signal) => {
        listCalls += 1
        if (listCalls > 1) {
          // The probe mount below must not settle a load of its own: a second result would
          // overwrite whatever the aborted first load left behind and hide the very thing this
          // test is looking at.
          return new Promise<never>(() => {})
        }
        observedSignal = signal
        await gate.promise
        signal?.throwIfAborted()
        return memory.listThreads(signal)
      },
    })

    const first = renderHook(() => useThreads())
    expect(first.result.current.hydrated).toBe(false)

    first.unmount()
    expect(observedSignal?.aborted).toBe(true)

    await act(async () => {
      gate.resolve()
      await gate.promise
    })

    // `first.result` is FROZEN after unmount (the subscription is gone), so asserting on it proves
    // nothing. Mount a fresh consumer instead: its first render reads the store's live snapshot,
    // which is where an abort mistakenly recorded as a failure would show up.
    const probe = renderHook(() => useThreads())
    // The abort rejection is swallowed: a cancelled load is not a store failure.
    expect(probe.result.current.error).toBeUndefined()
    expect(probe.result.current.hydrated).toBe(false)
    probe.unmount()
  })

  // ── write ordering ──────────────────────────────────────────────────────────

  test('writes for one thread reach the adapter in issue order, behind createThread', async () => {
    const created = deferred()
    const calls: string[] = []
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      createThread: async (i) => {
        calls.push('createThread')
        await created.promise
        await memory.createThread(i)
      },
      markRead: async (id) => {
        calls.push('markRead')
        await memory.markRead(id)
      },
      appendMessage: async (i) => {
        calls.push('appendMessage')
        await memory.appendMessage(i)
      },
      setStatus: async (i) => {
        calls.push('setStatus')
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    // Exactly what a "new thread + first message" does: one synchronous block issuing a create
    // plus three writes that depend on the row existing.
    let id = ''
    act(() => {
      id = result.current.create()
      result.current.select(id)
      result.current.markRead(id)
      result.current.appendMessage(id, makeMessage('m-first'))
      result.current.setStatus(id, 'streaming')
    })

    // createThread is still gated, so nothing that depends on the row may have been issued yet.
    await settle()
    expect(calls).toEqual(['createThread'])

    await act(async () => {
      created.resolve()
      await created.promise
    })
    await settle()

    expect(calls).toEqual(['createThread', 'markRead', 'appendMessage', 'setStatus'])
    const stored = await memory.loadThread(id)
    expect(stored?.read).toBe(true)
    expect(stored?.status).toBe('streaming')
    expect(stored?.messages.map((m) => m.id)).toEqual(['m-first'])
    expect(result.current.error).toBeUndefined()
  })

  test('writes for DIFFERENT threads are not serialized behind each other', async () => {
    const blocked = deferred()
    const seen: string[] = []
    let blockedId = ''
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      setStatus: async (i) => {
        seen.push(i.threadId)
        if (i.threadId === blockedId) await blocked.promise
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let a = ''
    let b = ''
    act(() => {
      a = result.current.create()
      b = result.current.create()
    })
    await settle()
    blockedId = a

    act(() => {
      result.current.setStatus(a, 'streaming') // blocked
      result.current.setStatus(b, 'streaming') // must not queue behind a
    })
    await settle()

    expect(seen).toEqual([a, b])
    expect((await memory.loadThread(b))?.status).toBe('streaming')
    expect((await memory.loadThread(a))?.status).toBe('pending')

    await act(async () => {
      blocked.resolve()
      await blocked.promise
    })
    await settle()
    expect((await memory.loadThread(a))?.status).toBe('streaming')
  })

  // ── patch lifetime ──────────────────────────────────────────────────────────

  test('a write that lands mid-load coalesces onto ONE follow-up and is not retired by that load', async () => {
    // Was: "a confirmed write stays visible when its revalidate is superseded by a later write".
    // Renamed and re-mechanized for the fix — revalidate() no longer aborts-and-restarts on every
    // write (that is the bug this run fixes: it starved every load under sustained writes), it
    // coalesces. The invariant under test is the same one the old name pinned (a write that lands
    // while a load is in flight must not be retired by THAT load — only by the one proven to have
    // started after it), just exercised through the new mechanism: one shared follow-up instead of
    // a second abort-and-restart.
    const memory = createMemoryAdapter()
    const gates: Deferred[] = []
    let gating = false
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      listThreads: async (signal) => {
        if (gating) {
          const gate = deferred()
          gates.push(gate)
          await gate.promise
        }
        return memory.listThreads(signal)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let a = ''
    let b = ''
    act(() => {
      a = result.current.create()
      b = result.current.create()
    })
    await settle()

    const read = (): boolean | undefined => result.current.threads.find((t) => t.id === a)?.read
    const status = (): string | undefined => result.current.threads.find((t) => t.id === b)?.status
    expect(read()).toBe(false)

    gating = true
    act(() => {
      result.current.markRead(a)
    })
    await settle()
    expect(gates).toHaveLength(1) // markRead's write started the only in-flight load

    act(() => {
      result.current.setStatus(b, 'streaming')
    })
    await settle()
    // The SECOND write does NOT start a second round trip — it coalesces onto a follow-up that
    // will run once the first load lands. This is the request-amplification fix: aborting and
    // restarting here (the old behaviour) is exactly what starves every load under sustained writes.
    expect(gates).toHaveLength(1)
    expect(read()).toBe(true)
    expect(status()).toBe('streaming')

    // The first load lands. It only proves markRead(a) — setStatus(b) arrived after it started, so
    // per the adapter's read-after-write clause this load is not evidence for it. Both values still
    // render correctly (the still-pending patch renders identically to a confirmed one), but the
    // coalesced follow-up must now start on its own — that is the proof b was not retired here.
    await act(async () => {
      gates[0]?.resolve()
      await gates[0]?.promise
    })
    await settle()
    expect(gates).toHaveLength(2) // the coalesced follow-up, started automatically on landing
    expect(read()).toBe(true)
    expect(status()).toBe('streaming')

    // The follow-up lands and actually proves setStatus(b); both effects are now confirmed and no
    // third round trip is issued.
    await act(async () => {
      gates[1]?.resolve()
      await gates[1]?.promise
    })
    await settle()
    expect(gates).toHaveLength(2)
    expect(read()).toBe(true)
    expect(status()).toBe('streaming')
    expect(result.current.error).toBeUndefined()
  })

  test('a genuinely superseded (forced) revalidate is discarded wholesale, not merely left unconfirmed', async () => {
    // Abort is still correct for revalidateOnFocus — this pins that a load force-superseded by it,
    // should it resolve anyway (a real fetch whose response arrives after cancellation), must have
    // ZERO effect on `base`, not just "not retire a patch". Proven by mutating the backend OUT OF
    // BAND between the two landings: only a load that reads AFTER that mutation can see it.
    const memory = createMemoryAdapter()
    const gates: Deferred[] = []
    let gating = false
    const useThreads = createAdapterThreadsStore<AgentPart>(
      {
        ...memory,
        listThreads: async (signal) => {
          if (gating) {
            const gate = deferred()
            gates.push(gate)
            await gate.promise
          }
          return memory.listThreads(signal)
        },
      },
      { revalidateOnFocus: true },
    )

    const { result, unmount } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let a = ''
    act(() => {
      a = result.current.create()
    })
    await settle()
    const status = (): string | undefined => result.current.threads.find((t) => t.id === a)?.status

    gating = true
    act(() => {
      result.current.markRead(a)
    })
    await settle()
    expect(gates).toHaveLength(1) // load #1, gated, in flight

    // A refocus genuinely supersedes: aborts load #1, starts a fresh load #2.
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await settle()
    expect(gates).toHaveLength(2)

    await act(async () => {
      gates[0]?.resolve()
      await gates[0]?.promise
    })
    await settle()
    // Load #1 resolved despite being superseded — the memory adapter here does not honor the
    // abort signal, matching a real fetch whose response arrives late. Its landing must be
    // discarded wholesale: mutate the backend now, out of band, bypassing the optimistic layer.
    await memory.setStatus({ threadId: a, status: 'error' })
    // If load #1's landing had touched `base` at all, this would already be irrelevant either way
    // (status is untouched by markRead's patch) — the real assertion is that it stays 'pending'
    // (the value at creation), proving base was never refreshed by the discarded load.
    expect(status()).toBe('pending')

    // The surviving load #2 lands and reads the CURRENT backend — which now includes the
    // out-of-band write — proving `base` reflects load #2, not the discarded load #1.
    await act(async () => {
      gates[1]?.resolve()
      await gates[1]?.promise
    })
    await settle()
    expect(status()).toBe('error')
    expect(result.current.threads.find((t) => t.id === a)?.read).toBe(true)
    expect(result.current.error).toBeUndefined()
    // revalidateOnFocus:true attaches a 'focus' listener to the shared window — unmount so it does
    // not stay live for every test that follows (several later tests dispatch 'focus').
    unmount()
  })

  // ── regression: the request-amplification / never-settles bug ───────────────

  test('a write storm against a slow listThreads completes both loads and retires every patch', async () => {
    // Regression for the finding: sustained writes each aborted-and-restarted revalidate(), so
    // under a slow listThreads no load ever survived long enough to land — base never refreshed
    // and pending patches never retired. Probe A: listThreads at 120ms, writes at 5ms, one
    // setStatus every 30ms for ~900ms → 32 loads started, 1 completed, 0 during the storm.
    const memory = createMemoryAdapter()
    const gates: Deferred[] = []
    let gating = false
    let listStarted = 0
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      listThreads: async (signal) => {
        listStarted += 1
        if (gating) {
          const gate = deferred()
          gates.push(gate)
          await gate.promise
        }
        return memory.listThreads(signal)
      },
    })

    const { result, unmount } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await settle()

    gating = true
    const beforeStorm = listStarted
    const STORM = 40
    // All against ONE thread, issued synchronously while the first follow-up load is gated — the
    // exact shape (a streaming append firing every few ms) that starved every load before the fix.
    act(() => {
      for (let i = 0; i < STORM; i += 1) {
        result.current.appendMessage(id, makeMessage(`m-${i}`))
      }
    })
    await settle()

    // Exactly one real round trip is in flight for the whole storm — nothing aborted it, nothing
    // restarted it.
    expect(listStarted).toBe(beforeStorm + 1)

    await act(async () => {
      gates[0]?.resolve()
      await gates[0]?.promise
    })
    await settle()
    // Landing starts the ONE coalesced follow-up for every write that arrived mid-flight.
    expect(listStarted).toBe(beforeStorm + 2)

    await act(async () => {
      gates[1]?.resolve()
      await gates[1]?.promise
    })
    await settle()
    // No third round trip — two loads accounted for the entire storm, not STORM of them.
    expect(listStarted).toBe(beforeStorm + 2)
    expect(result.current.threads.find((t) => t.id === id)?.messages).toHaveLength(STORM)

    // Prove every patch actually RETIRED — not merely "looks right because the backend already
    // agrees". Reset the backend for this thread OUT OF BAND, bypassing the optimistic layer
    // entirely, then force one more (ungated) revalidate. A patch still stuck in `pending` would
    // idempotently re-insert its message regardless of what the backend now says, masking the
    // reset; a fully drained store shows it immediately.
    await memory.removeThread(id)
    await memory.createThread({ id })
    gating = false
    act(() => {
      result.current.markRead(id)
    })
    await waitFor(() => {
      expect(result.current.threads.find((t) => t.id === id)?.messages).toHaveLength(0)
    })
    expect(result.current.error).toBeUndefined()
    unmount()
  })

  test('a large write burst issues O(1) list round-trips, not one per write', async () => {
    // Regression for the finding's request-amplification bound. Probe B: 800 appendMessage calls
    // against a no-op appendMessage (so anything visible is purely unretired optimistic state) →
    // 802 round trips started, 2 completed, 800 patches still resident. Fixed: at most 2, ever,
    // regardless of burst size.
    const memory = createMemoryAdapter()
    let listStarted = 0
    let gating = false
    let gate: Deferred | null = null
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      // No-op write: isolates the round-trip count from drain correctness (covered above).
      appendMessage: async () => {},
      listThreads: async (signal) => {
        listStarted += 1
        if (gating) {
          gate = deferred()
          await gate.promise
        }
        return memory.listThreads(signal)
      },
    })

    const { result, unmount } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await settle()

    gating = true
    const beforeStorm = listStarted
    const WRITES = 300
    act(() => {
      for (let i = 0; i < WRITES; i += 1) {
        result.current.appendMessage(id, makeMessage(`m-${i}`))
      }
    })
    await settle()

    const startedWhileGated = listStarted - beforeStorm
    // The bug: every write aborted-and-restarted its own listThreads — ~WRITES round trips (802
    // for 800 appends in the probe). Fixed: exactly the one already in flight.
    expect(startedWhileGated).toBe(1)
    expect(startedWhileGated).toBeLessThan(WRITES / 10)
    expect(result.current.threads.find((t) => t.id === id)?.messages).toHaveLength(WRITES)

    await act(async () => {
      gate?.resolve()
      await gate?.promise
    })
    await settle()
    // The single coalesced follow-up for the whole burst — total started is 2, never WRITES + 1.
    expect(listStarted - beforeStorm).toBe(2)
    unmount()
  })

  test('an unrelated select() does not re-stamp or re-identify a thread mid-write', async () => {
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      setStatus: async (i) => {
        await gate.promise
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await settle()

    act(() => {
      result.current.setStatus(id, 'streaming')
    })
    const optimistic = result.current.threads[0]
    expect(optimistic?.status).toBe('streaming')

    act(() => {
      result.current.select(id)
    })

    expect(result.current.activeId).toBe(id)
    // Re-applying the in-flight patch must be a genuine no-op: same timestamp AND same object,
    // or every list consumer's referential memoization is dead while any write is in flight.
    expect(result.current.threads[0]?.updatedAt).toBe(optimistic?.updatedAt)
    expect(result.current.threads[0]).toBe(optimistic)

    await act(async () => {
      gate.resolve()
      await gate.promise
    })
    await settle()
  })

  test('a patch stamps updatedAt once at issue time, not on every re-apply', async () => {
    // The identity memo above absorbs a re-apply over the SAME base; this pins the case it
    // cannot — a fresh list landing under a still-in-flight write, which re-runs `apply` for
    // real. A clock read inside `apply` would silently drift updatedAt forward there.
    const realNow = Date.now
    let clock = 1_000
    Date.now = (): number => clock
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      setStatus: async (i) => {
        await gate.promise
        await memory.setStatus(i)
      },
    })

    try {
      const { result } = renderHook(() => useThreads())
      await settle()
      expect(result.current.hydrated).toBe(true)

      let first = ''
      act(() => {
        first = result.current.create()
      })
      await settle()

      clock = 2_000
      act(() => {
        result.current.setStatus(first, 'streaming')
      })
      expect(result.current.threads[0]?.updatedAt).toBe(2_000)

      // A second thread's write lands a fresh list, so the in-flight patch is re-applied over a
      // DIFFERENT base array.
      clock = 3_000
      act(() => {
        result.current.create()
      })
      await settle()

      const stamped = result.current.threads.find((t) => t.id === first)
      expect(stamped?.status).toBe('streaming')
      expect(stamped?.updatedAt).toBe(2_000)
    } finally {
      Date.now = realNow
    }

    await act(async () => {
      gate.resolve()
      await gate.promise
    })
    await settle()
  })

  // ── remove / clear ──────────────────────────────────────────────────────────

  test('a rejected remove restores the row AND the selection', async () => {
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      removeThread: async (id) => {
        await gate.promise
        await memory.removeThread(id)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await settle()
    act(() => {
      result.current.select(id)
    })
    expect(result.current.activeId).toBe(id)

    act(() => {
      result.current.remove(id)
    })
    expect(result.current.threads).toHaveLength(0)
    expect(result.current.activeId).toBeNull()

    await act(async () => {
      gate.reject(new Error('remove-boom'))
      await gate.promise.catch(() => {})
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    // The selection is part of the optimistic edit, so it comes back with the row.
    expect(result.current.threads.map((t) => t.id)).toEqual([id])
    expect(result.current.activeId).toBe(id)
    await settle()
  })

  test('a partially failed clear() converges on the server instead of resurrecting deleted rows', async () => {
    const slow = deferred()
    const memory = createMemoryAdapter()
    let doomed = ''
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      removeThread: async (id) => {
        // The undeletable row rejects IMMEDIATELY while the other two are still in flight — the
        // exact shape that makes a `Promise.all` fan-out converge on a list it has already raced.
        if (id === doomed) throw new Error('remove-boom')
        await slow.promise
        await memory.removeThread(id)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let second = ''
    act(() => {
      result.current.create()
      second = result.current.create()
      result.current.create()
    })
    await settle()
    expect(result.current.threads).toHaveLength(3)
    doomed = second

    act(() => {
      result.current.clear()
    })
    expect(result.current.threads).toEqual([])

    // One delete has already rejected, but the others have not settled: nothing may be reported
    // or rolled back yet, or the convergence load races the deletes still in flight.
    await settle()
    expect(result.current.error).toBeUndefined()
    expect(result.current.threads).toEqual([])

    await act(async () => {
      slow.resolve()
      await slow.promise
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(AggregateError)
    })
    // Only the undeletable thread comes back. The two that really were deleted stay deleted.
    await waitFor(() => {
      expect(result.current.threads.map((t) => t.id)).toEqual([second])
    })
    expect((await memory.listThreads()).map((t) => t.id)).toEqual([second])
    expect(result.current.error).toBeInstanceOf(AggregateError)
  })

  test('a select() into a thread created after clear() survives the clear settling', async () => {
    // clear() removes the threads it captured at ISSUE time — a selection minted afterwards, into
    // a thread the clear never knew about, must come through unharmed both while the clear's
    // patch is still being re-applied and once it confirms and prune() folds it into activeId.
    const gate = deferred()
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      removeThread: async (id) => {
        await gate.promise
        await memory.removeThread(id)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    act(() => {
      result.current.create()
    })
    await settle()

    act(() => {
      result.current.clear()
    })
    expect(result.current.threads).toEqual([])
    expect(result.current.activeId).toBeNull()

    let fresh = ''
    act(() => {
      fresh = result.current.create()
      result.current.select(fresh)
    })
    expect(result.current.threads.map((t) => t.id)).toEqual([fresh])
    // Optimistic: the clear's applyActive is still being re-applied on top of this select.
    expect(result.current.activeId).toBe(fresh)

    await act(async () => {
      gate.resolve()
      await gate.promise
    })
    await settle()

    // Confirmed: clear()'s patch has retired and prune() folded its applyActive into the
    // committed activeId — the selection must still point at the thread that survived it.
    expect(result.current.activeId).toBe(fresh)
    expect(result.current.threads.map((t) => t.id)).toEqual([fresh])
  })

  // ── error latching ──────────────────────────────────────────────────────────

  test('a write queued behind a failure does not clear it; a later retry does', async () => {
    const gate = deferred()
    let statusCalls = 0
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      setStatus: async (i) => {
        statusCalls += 1
        if (statusCalls === 1) await gate.promise // rejects
        await memory.setStatus(i)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })

    let id = ''
    act(() => {
      id = result.current.create()
    })
    await settle()

    act(() => {
      result.current.setStatus(id, 'streaming') // will reject
      result.current.markRead(id) // issued BEFORE the failure, runs after it
    })

    await act(async () => {
      gate.reject(new Error('status-boom'))
      await gate.promise.catch(() => {})
    })
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })
    await settle()

    // markRead succeeded afterwards, but it was issued before the failure — it is not evidence
    // the failure is over, and must not swallow it.
    expect(result.current.threads[0]?.read).toBe(true)
    expect((result.current.error as Error).message).toBe('status-boom')

    // A retry issued after the failure IS evidence of recovery.
    act(() => {
      result.current.setStatus(id, 'streaming')
    })
    await waitFor(() => {
      expect(result.current.error).toBeUndefined()
    })
    expect((await memory.loadThread(id))?.status).toBe('streaming')
    await settle()
  })

  // ── revalidateOnFocus ───────────────────────────────────────────────────────

  test('revalidateOnFocus is off by default', async () => {
    let listCalls = 0
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>({
      ...memory,
      listThreads: async (signal) => {
        listCalls += 1
        return memory.listThreads(signal)
      },
    })

    const { result } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })
    const afterMount = listCalls

    window.dispatchEvent(new Event('focus'))
    await settle()

    expect(listCalls).toBe(afterMount)
  })

  test('revalidateOnFocus re-lists on focus and unsubscribes when the last consumer unmounts', async () => {
    let listCalls = 0
    const memory = createMemoryAdapter()
    const useThreads = createAdapterThreadsStore<AgentPart>(
      {
        ...memory,
        listThreads: async (signal) => {
          listCalls += 1
          return memory.listThreads(signal)
        },
      },
      { revalidateOnFocus: true },
    )

    const { result, unmount } = renderHook(() => useThreads())
    await waitFor(() => {
      expect(result.current.hydrated).toBe(true)
    })
    const afterMount = listCalls

    window.dispatchEvent(new Event('focus'))
    await settle()
    expect(listCalls).toBe(afterMount + 1)

    unmount()
    window.dispatchEvent(new Event('focus'))
    await settle()
    // The listener is removed with the last consumer — a background tab does not keep polling.
    expect(listCalls).toBe(afterMount + 1)
  })

  // ── id minting: create() outside a secure context ────────────────────────────

  test('create() mints distinct ids via crypto.getRandomValues when randomUUID is unavailable', async () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
    })
    try {
      const useThreads = createAdapterThreadsStore<AgentPart>(createMemoryAdapter())
      const { result, unmount } = renderHook(() => useThreads())
      await waitFor(() => {
        expect(result.current.hydrated).toBe(true)
      })

      let first = ''
      let second = ''
      act(() => {
        first = result.current.create()
        second = result.current.create()
      })

      expect(first).not.toBe('')
      expect(second).not.toBe('')
      expect(first).not.toBe(second)
      await settle()
      unmount()
    } finally {
      // Restore the real crypto so no later test in the process is affected.
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }
  })

  test('create() still mints distinct ids with no usable crypto at all (randomUUID and getRandomValues both absent)', async () => {
    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      const useThreads = createAdapterThreadsStore<AgentPart>(createMemoryAdapter())
      const { result, unmount } = renderHook(() => useThreads())
      await waitFor(() => {
        expect(result.current.hydrated).toBe(true)
      })

      let first = ''
      let second = ''
      act(() => {
        first = result.current.create()
        second = result.current.create()
      })

      expect(first).not.toBe('')
      expect(second).not.toBe('')
      expect(first).not.toBe(second)
      await settle()
      unmount()
    } finally {
      // Restore the real crypto so no later test in the process is affected.
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }
  })
})
