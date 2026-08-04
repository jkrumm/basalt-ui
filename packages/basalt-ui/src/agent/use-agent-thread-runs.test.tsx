/**
 * useAgentThreadRuns — concurrency, busy-thread no-op, finalize ordering, failure status, retry,
 * and (as of B2) the stop()/stopAll() lifecycle (partial-turn preservation, the idle no-op
 * guard, and the resolveOutcome-race fix).
 *
 * Scope: the multi-thread run manager AS THE PUBLIC API EXISTS TODAY. No mergePart/part ids/
 * offsets, no seven-state ToolCallPart, no ResumableAgentTransport/isResumable/idempotentReplay
 * beyond the plain optional `resume` already on AgentTransport, no ThreadsStoreAdapter — later
 * releases, not exercised here.
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
import type { AgentPart, AgentPartDraft } from './parts'
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
    // Always-hydrated, never-erroring — mirrors the localStorage-backed store's real values
    // (see ThreadsStore.hydrated/.error doc comments); this double is a synchronous in-memory
    // stand-in with no async load path to fail.
    hydrated: true,
    error: undefined,
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
        yield { id: 'p1', type: 'text', text: `done:${input}` }
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
        yield { id: 'p1', type: 'text', text: 'ok' }
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
        yield { id: 'p1', type: 'text', text: 'hi' }
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
        yield { id: 'p1', type: 'text', text: 'unreachable' }
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
        yield { id: 'p1', type: 'text', text: 'x' }
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
        yield { id: 'p1', type: 'text', text: `done:${input}` }
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

  // Pins the fix for a race in consumeAndFinalize's success path: it awaits resolveOutcome and
  // then writes setOutcome/setStatus, and now RE-CHECKS the supersede/abort guards after that
  // await (not just before it) before performing those writes. Without the recheck, a slow
  // resolveOutcome racing a stop() call would clobber stop()'s synchronous 'done' with whatever
  // the outcome resolved to once it finally settled.
  test('stop() during a slow resolveOutcome must not be clobbered by the outcome settling later', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    let releaseOutcome: (() => void) | undefined
    const slowResolveOutcome: OutcomeResolver<AgentPart> = () =>
      new Promise<AgentOutcome>((resolve) => {
        releaseOutcome = () => resolve({ title: 't', summary: 's', status: 'attention' })
      })

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'hi' }
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
      // The late resolveOutcome settling must not resurrect the thread past the 'done' stop()
      // already committed.
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })
  })
})

describe('useAgentThreadRuns — stop()/stopAll() lifecycle', () => {
  test('stop() mid-stream persists the accumulated parts as a finish: "stopped" assistant message', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const gate = deferred<void>()
    // Yields id-less drafts on purpose — the assertion below exists specifically to prove
    // withPartIds stamps the missing id as `${threadId}#0`, so the cast documents that the type
    // says AgentPart (identified) while this transport deliberately produces what the real
    // contract is AgentPartDraft (a transport is always permitted to omit id).
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { type: 'text', text: 'partial' } as AgentPartDraft as AgentPart
        await gate.promise
        yield { type: 'text', text: 'never arrives' } as AgentPartDraft as AgentPart
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'hi')
    })

    await waitFor(() => {
      expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
    })

    act(() => {
      result.current.stop(threadId)
    })

    const thread = store.threads.find((t) => t.id === threadId)
    expect(thread?.status).toBe('done')
    expect(thread?.messages).toHaveLength(2)
    const assistantMessage = thread?.messages[1]
    expect(assistantMessage?.role).toBe('assistant')
    expect(assistantMessage?.finish).toBe('stopped')
    // withPartIds stamps the missing id as `${threadId}#0` — the first (and only) id-less part
    // this run's generator yielded.
    expect(assistantMessage?.parts).toEqual([
      { id: `${threadId}#0`, type: 'text', text: 'partial' },
    ])
    // The run entry is torn down synchronously — no lingering 'streaming' indicator.
    expect(result.current.runs.has(threadId)).toBe(false)

    // Release the still-suspended (aborted, guard-caught) generator so it doesn't leak into the
    // next test.
    gate.resolve(undefined)
  })

  test('stop() does not double-append when the stream already fully arrived before stop() was called', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    let releaseOutcome: (() => void) | undefined
    const slowResolveOutcome: OutcomeResolver<AgentPart> = () =>
      new Promise<AgentOutcome>((resolve) => {
        releaseOutcome = () => resolve({ title: 't', summary: 's', status: 'done' })
      })

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'hi' }
      },
    }

    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome: slowResolveOutcome }),
    )

    act(() => {
      result.current.start(threadId, 'hi')
    })

    // Wait until consumeAndFinalize's own appendMessage has already landed (it happens BEFORE
    // its await on resolveOutcome) — this is the narrow window stop() can race without ever
    // being able to observe "not yet appended" (see finalizeStop's doc comment).
    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.messages.length).toBe(2)
    })

    act(() => {
      result.current.stop(threadId)
    })

    // Still exactly 2 messages (user + the ORIGINAL 'complete' assistant message) — stop() must
    // recognize the terminal message already landed and skip its own append rather than
    // duplicating it as a second 'stopped' message.
    const thread = store.threads.find((t) => t.id === threadId)
    expect(thread?.messages).toHaveLength(2)
    expect(thread?.messages[1]?.finish).toBe('complete')

    releaseOutcome?.()
  })

  test('stop() is a true no-op when threadId has no in-flight run', () => {
    const store = createTestThreadsStore()
    // No store.create() here on purpose — mirrors the "retry() is a no-op" test above: isolates
    // stop()'s own "nothing in flight" guard from the mount-reconcile effect's unrelated handling
    // of a freshly-created 'pending' thread.
    const threadId = crypto.randomUUID()

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'x' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.stop(threadId)
    })

    expect(store.threads).toEqual([])
  })

  // Pins the fix for the reference-equality hole: runsRef mirrors `runs` only as of the last
  // FLUSHED render (assigned during render, `:~355`), so a stop() landing inside the narrow
  // window between consumeAndFinalize's post-loop appendMessage and its `await resolveOutcome`
  // resolving could observe a STALE parts array (one delta behind) via runsRef — defeating the
  // old `lastMessage.parts === parts` guard and double-appending. This test lands stop()
  // deterministically inside that exact window (fired synchronously from inside the injected
  // resolveOutcome, itself called synchronously right after appendMessage, before any of the
  // hook's pending state updates can flush — flushing needs a macrotask, and nothing here crosses
  // one) rather than relying on timing luck, so it is a reliable regression guard for the fixed
  // marker-based mechanism, not just a one-off repro.
  test("stop() fired synchronously from inside resolveOutcome (before the final delta's render flushes) must not double-append", async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        // Distinct ids: mergePart addresses by id, and two parts sharing the (undefined) id would
        // splice into ONE entry instead of accumulating two — this test needs the SECOND delta to
        // produce a genuinely NEW array entry (and therefore a new `parts` array reference) to
        // exercise the race at all.
        yield { id: 'p1', type: 'text', text: 'first' }
        await gate.promise
        yield { id: 'p2', type: 'text', text: 'second' }
      },
    }

    const hookRef: { stop?: (id: string) => void } = {}
    let resolveCalls = 0
    const raceResolveOutcome: OutcomeResolver<AgentPart> = async () => {
      resolveCalls += 1
      // Fire stop() from inside the FIRST resolveOutcome call — synchronously, before this
      // function even returns its promise. Everything from the second delta's setRuns dispatch to
      // this point runs purely through microtasks (async-generator machinery + this direct call),
      // so no macrotask has elapsed and React's scheduler cannot have flushed that dispatch into
      // runsRef yet — this reliably lands stop() inside the race window.
      if (resolveCalls === 1) {
        hookRef.stop?.(threadId)
      }
      return { title: 't', summary: 's', status: 'done' }
    }

    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome: raceResolveOutcome }),
    )
    hookRef.stop = result.current.stop

    act(() => {
      result.current.start(threadId, 'hi')
    })

    // Let the FIRST delta's render flush — runsRef now mirrors a non-empty parts array
    // (['first']), which is what makes the eventual mismatch observable rather than vacuously
    // guarded by parts.length === 0.
    await waitFor(() => {
      expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
    })

    // Resolve the gate outside act() on purpose: this must not synchronously flush React state —
    // the whole point is to let the second delta, the loop exit, and appendMessage run purely as
    // microtask continuations, with stop() firing from inside resolveOutcome before any render for
    // the second delta occurs.
    gate.resolve(undefined)

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })

    const thread = store.threads.find((t) => t.id === threadId)
    const assistantMessages = thread?.messages.filter((m) => m.role === 'assistant') ?? []
    expect(assistantMessages).toHaveLength(1)
    // The surviving message must be the ORIGINAL 'complete' one with the full (['first','second'])
    // content — not a truncated 'stopped' message built from the stale ['first']-only parts.
    expect(assistantMessages[0]?.finish).toBe('complete')
    expect(assistantMessages[0]?.parts).toEqual([
      { id: 'p1', type: 'text', text: 'first' },
      { id: 'p2', type: 'text', text: 'second' },
    ])
  })

  // Pins the flip side of the marker fix: the marker must be cleared once a run concludes, or a
  // stale entry from an EARLIER finished run on the same thread would wrongly suppress a
  // legitimate append on a LATER run — a worse bug than the double-append this mechanism exists to
  // prevent.
  test('a stale marker from an earlier finished run must not suppress a legitimate later stop() append', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const inputs: string[] = []
    let gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        inputs.push(input)
        // Distinct ids: two id-less parts sharing the (undefined) id would silently splice into
        // ONE entry (the F1 bug) — turn 1's own "did these two deltas stay separate?" assertion
        // below is invisible otherwise, since it only checked assistant MESSAGE count, not parts.
        yield { id: `${input}-partial`, type: 'text', text: `${input}-partial` }
        await gate.promise
        yield { id: `${input}-final`, type: 'text', text: `${input}-final` }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    // Turn 1: runs to full completion (no stop()) so consumeAndFinalize's own success path sets
    // and then clears the marker for this thread.
    act(() => {
      result.current.start(threadId, 'first-turn')
    })
    gate.resolve(undefined)
    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })
    const turn1Assistant = store.threads
      .find((t) => t.id === threadId)
      ?.messages.filter((m) => m.role === 'assistant')
    expect(turn1Assistant).toHaveLength(1)
    // The two deltas landed as two SEPARATE parts, not spliced into one.
    expect(turn1Assistant?.[0]?.parts).toEqual([
      { id: 'first-turn-partial', type: 'text', text: 'first-turn-partial' },
      { id: 'first-turn-final', type: 'text', text: 'first-turn-final' },
    ])

    // Turn 2: a genuinely new run on the SAME thread, stopped mid-stream. If a stale marker from
    // turn 1 leaked, this stop() would be wrongly treated as "already persisted" and silently drop
    // the partial content instead of appending it.
    gate = deferred<void>()
    act(() => {
      result.current.retry(threadId)
    })
    expect(inputs).toEqual(['first-turn', 'first-turn'])

    await waitFor(() => {
      expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
    })

    act(() => {
      result.current.stop(threadId)
    })

    const thread = store.threads.find((t) => t.id === threadId)
    const assistantMessages = thread?.messages.filter((m) => m.role === 'assistant') ?? []
    expect(assistantMessages).toHaveLength(2)
    expect(assistantMessages[1]?.finish).toBe('stopped')
    expect(assistantMessages[1]?.parts).toEqual([
      { id: 'first-turn-partial', type: 'text', text: 'first-turn-partial' },
    ])

    gate.resolve(undefined)
  })

  test('stopAll() resolves every aborted thread instead of stranding them in "streaming"', async () => {
    const store = createTestThreadsStore()
    const threadA = store.create()
    const threadB = store.create()

    const gateA = deferred<void>()
    const gateB = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        if (input === 'a') {
          yield { id: 'p1', type: 'text', text: 'partial-a' }
          await gateA.promise
        } else {
          yield { id: 'p1', type: 'text', text: 'partial-b' }
          await gateB.promise
        }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadA, 'a')
      result.current.start(threadB, 'b')
    })

    await waitFor(() => {
      expect(result.current.runs.get(threadA)?.parts).toHaveLength(1)
      expect(result.current.runs.get(threadB)?.parts).toHaveLength(1)
    })

    act(() => {
      result.current.stopAll()
    })

    expect(store.threads.find((t) => t.id === threadA)?.status).toBe('done')
    expect(store.threads.find((t) => t.id === threadB)?.status).toBe('done')
    expect(result.current.runs.size).toBe(0)

    // Release the still-suspended (aborted, guard-caught) generators so they don't leak into the
    // next test.
    gateA.resolve(undefined)
    gateB.resolve(undefined)
  })

  // F4 regression: stop()'s no-op guard used to read runsRef, which only mirrors `runs` as of the
  // last FLUSHED RENDER. start() then stop() called in the SAME synchronous act() batch — e.g.
  // `onClick={() => { start(id, text); stop(id) }}` — never lets a render land in between, so
  // runsRef was still empty when stop() ran and it wrongly no-op'd: the controller was never
  // aborted, and a transport that only resolves on its AbortSignal firing would strand the thread
  // in 'streaming' forever (this is exactly what `stopAll()`'s own regression test above cannot
  // see — it deliberately `waitFor`s a render to flush before calling stopAll()).
  test('F4 regression: start() then stop() in the same synchronous tick must actually abort, not strand the thread in "streaming"', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    // Hangs until its AbortSignal fires — never resolves on its own. If stop()'s no-op guard skips
    // the abort, this generator never settles and the thread is stuck 'streaming' forever.
    const transport: AgentTransport<AgentPart, string> = {
      // oxlint-disable-next-line require-yield -- hangs until aborted; never has anything to yield
      async *stream(_input, signal) {
        await new Promise((resolve) => {
          signal?.addEventListener('abort', () => resolve(undefined))
        })
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'hi')
      result.current.stop(threadId)
    })

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })
    expect(result.current.runs.has(threadId)).toBe(false)
  })
})

describe('useAgentThreadRuns — F1 regression: id-less drafts within one run', () => {
  test('drafts of different types do not destroy each other — mergePart no longer sees undefined === undefined', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    // Yields id-less drafts on purpose — the whole point of this regression is that TWO drafts
    // (of different types, so a real bug wouldn't be "same id" but "no id at all") must not
    // collide via `undefined === undefined`. The cast documents that the type says AgentPart
    // (identified) while a transport is always permitted to omit id (AgentPartDraft).
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { type: 'text', text: 'Hi' } as AgentPartDraft as AgentPart
        yield {
          type: 'tool',
          toolCallId: 'c1',
          toolName: 'search',
          state: 'input-available',
          input: { q: 'x' },
        } as AgentPartDraft as AgentPart
        yield { type: 'text', text: 'Bye' } as AgentPartDraft as AgentPart
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'go')
    })

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })

    const assistantMessage = store.threads
      .find((t) => t.id === threadId)
      ?.messages.find((m) => m.role === 'assistant')
    expect(assistantMessage?.parts).toHaveLength(3)
    expect(assistantMessage?.parts.map((part) => part.type)).toEqual(['text', 'tool', 'text'])
  })
})

describe('useAgentThreadRuns — message-id minting under degraded crypto', () => {
  test('start() mints distinct message ids via crypto.getRandomValues when randomUUID is unavailable', async () => {
    const store = createTestThreadsStore()
    const threadA = store.create()
    const threadB = store.create()

    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        yield { id: 'p1', type: 'text', text: `done:${input}` }
      },
    }

    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
    })
    try {
      const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

      act(() => {
        result.current.start(threadA, 'input-a')
        result.current.start(threadB, 'input-b')
      })

      await waitFor(() => {
        expect(store.threads.find((t) => t.id === threadA)?.status).toBe('done')
        expect(store.threads.find((t) => t.id === threadB)?.status).toBe('done')
      })

      const allMessageIds = store.threads.flatMap((t) => t.messages.map((m) => m.id))
      expect(allMessageIds.length).toBeGreaterThan(0)
      expect(new Set(allMessageIds).size).toBe(allMessageIds.length)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }
  })

  test('start() THROWS on a host with no usable crypto at all, rather than silently minting a colliding message id', () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'unreachable' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      expect(() => {
        act(() => {
          result.current.start(threadId, 'hi')
        })
      }).toThrow(/idempotency key/)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }

    // The deliberate divergence documented on mintMessageId: throwing means the write never
    // happened at all (no half-appended message, no orphaned run entry) rather than silently
    // dropping content behind a colliding id.
    expect(store.threads.find((t) => t.id === threadId)?.messages).toHaveLength(0)
    expect(result.current.runs.has(threadId)).toBe(false)
  })
})

// A ThreadsStore double that delegates everything to a real test store EXCEPT appendMessage,
// which throws for messages matching `shouldThrow` — lets a test simulate consumer-adapter code
// (appendMessage) throwing without touching the shared createTestThreadsStore factory used by
// every other test in this file.
function wrapStoreWithThrowingAppend(
  store: ThreadsStore<AgentPart>,
  shouldThrow: (message: AgentThread<AgentPart>['messages'][number]) => boolean,
): ThreadsStore<AgentPart> {
  return {
    get threads() {
      return store.threads
    },
    get activeId() {
      return store.activeId
    },
    select: store.select,
    create: store.create,
    appendMessage(id, message) {
      if (shouldThrow(message)) {
        throw new Error('consumer appendMessage boom')
      }
      store.appendMessage(id, message)
    },
    setOutcome: store.setOutcome,
    setStatus: store.setStatus,
    setResumeToken: store.setResumeToken,
    markRead: store.markRead,
    remove: store.remove,
    clear: store.clear,
    hydrated: store.hydrated,
    error: store.error,
  }
}

/** As above, but for the settle half of `finalizeStop` — a consumer store whose `setStatus` throws
 * (a remote-backed adapter rejecting a thread removed mid-stream is the realistic shape). Narrowed
 * by `shouldThrow` because the hook ALSO calls `setStatus` from its mount-time orphan sweep, which
 * is a different call site with a different (non-wedge) failure mode. */
function wrapStoreWithThrowingSetStatus(
  store: ThreadsStore<AgentPart>,
  shouldThrow: (status: AgentThread<AgentPart>['status']) => boolean,
): ThreadsStore<AgentPart> {
  return {
    get threads() {
      return store.threads
    },
    get activeId() {
      return store.activeId
    },
    select: store.select,
    create: store.create,
    appendMessage: store.appendMessage,
    setOutcome: store.setOutcome,
    setStatus(id, status) {
      if (shouldThrow(status)) throw new Error('consumer setStatus boom')
      store.setStatus(id, status)
    },
    setResumeToken: store.setResumeToken,
    markRead: store.markRead,
    remove: store.remove,
    clear: store.clear,
    hydrated: store.hydrated,
    error: store.error,
  }
}

describe('useAgentThreadRuns — finalizeStop must reach a terminal state no matter what', () => {
  test('stop() on a host with no usable crypto still reaches a terminal status and clears the run entry (was: wedged at "streaming" forever)', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'partial' }
        await gate.promise
        yield { id: 'p2', type: 'text', text: 'never arrives' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'hi')
    })

    await waitFor(() => {
      expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
    })

    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      act(() => {
        result.current.stop(threadId)
      })

      const thread = store.threads.find((t) => t.id === threadId)
      // Before the fix: mintMessageId's throw escaped finalizeStop entirely, so setStatus/setRuns
      // never ran and this stayed 'streaming' forever.
      expect(thread?.status).toBe('error')
      // The stopped message never minted an id, so appendMessage was never even attempted —
      // only the original user message is present.
      expect(thread?.messages).toHaveLength(1)
      expect(result.current.runs.has(threadId)).toBe(false)

      // A second stop() must not be the user's only recourse — and it isn't: controllersRef
      // already had this threadId deleted before finalizeStop ever ran, so this is an ordinary
      // no-op, not a retry of the failed append.
      act(() => {
        result.current.stop(threadId)
      })
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('error')
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }

    gate.resolve(undefined)
  })

  test("stop() reaches a terminal status and clears the run entry even when the consumer's appendMessage throws (was: wedged at 'streaming' forever)", async () => {
    const baseStore = createTestThreadsStore()
    const threadId = baseStore.create()
    const store = wrapStoreWithThrowingAppend(
      baseStore,
      (message) => message.role === 'assistant' && message.finish === 'stopped',
    )

    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'partial' }
        await gate.promise
        yield { id: 'p2', type: 'text', text: 'never arrives' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'hi')
    })

    await waitFor(() => {
      expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
    })

    act(() => {
      result.current.stop(threadId)
    })

    const thread = store.threads.find((t) => t.id === threadId)
    expect(thread?.status).toBe('error')
    // Only the user message — the consumer's appendMessage rejected the stopped message.
    expect(thread?.messages).toHaveLength(1)
    expect(result.current.runs.has(threadId)).toBe(false)

    // A second stop() remains a true no-op — not the user's only recourse.
    act(() => {
      result.current.stop(threadId)
    })
    expect(store.threads.find((t) => t.id === threadId)?.status).toBe('error')

    gate.resolve(undefined)
  })

  test("stop() clears the hook's own run entry even when the consumer's setStatus throws (the second half of the same wedge)", async () => {
    const baseStore = createTestThreadsStore()
    const threadId = baseStore.create()
    const store = wrapStoreWithThrowingSetStatus(baseStore, (status) => status === 'done')

    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'partial' }
        await gate.promise
        yield { id: 'p2', type: 'text', text: 'never arrives' }
      },
    }

    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => {
      result.current.start(threadId, 'hi')
    })

    await waitFor(() => {
      expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
    })

    act(() => {
      result.current.stop(threadId)
    })

    // The store's own status is whatever the throwing adapter left it as — unrecoverable from
    // here. What IS this hook's to guarantee is that `runs` no longer reports an in-flight turn:
    // that entry is the hook's own state and nothing later can ever clear it (stop() already
    // deleted the thread from controllersRef), so a throw above the teardown stranded it forever.
    expect(result.current.runs.has(threadId)).toBe(false)
    // The partial content still landed — the append runs before the settle.
    expect(store.threads.find((t) => t.id === threadId)?.messages).toHaveLength(2)

    act(() => {
      result.current.stop(threadId)
    })
    expect(result.current.runs.has(threadId)).toBe(false)

    gate.resolve(undefined)
  })

  test('stop() still succeeds via crypto.getRandomValues when randomUUID is unavailable (rung 2 — the rung that matters in practice)', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'partial' }
        await gate.promise
        yield { id: 'p2', type: 'text', text: 'never arrives' }
      },
    }

    const originalCrypto = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
    })
    try {
      const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

      act(() => {
        result.current.start(threadId, 'hi')
      })

      await waitFor(() => {
        expect(result.current.runs.get(threadId)?.parts).toHaveLength(1)
      })

      act(() => {
        result.current.stop(threadId)
      })

      const thread = store.threads.find((t) => t.id === threadId)
      expect(thread?.status).toBe('done')
      expect(thread?.messages).toHaveLength(2)
      expect(thread?.messages[1]?.finish).toBe('stopped')
      expect(result.current.runs.has(threadId)).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true })
    }

    gate.resolve(undefined)
  })
})
