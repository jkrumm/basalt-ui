/**
 * useAgentThreadRuns — the 2.0 runtime contract (V2-SPEC § 6, § 7): the `submitted → streaming`
 * edge, `ThreadRunState.error` (kept visible until the next send), `throttle`, and the `chat.turn`
 * telemetry event. Rendered WITHOUT a BasaltProvider on purpose: the hook must work outside one.
 */
import { describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { createRootRoute } from '@tanstack/react-router'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { BasaltProvider } from '../provider'
import { createBasaltRouter } from '../provider/create-router'
import type { BasaltEvent } from '../telemetry'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { ThreadRunState } from './use-agent-thread-runs'
import type { AgentOutcome, OutcomeResolver } from './outcome'
import type { AgentPart } from './parts'
import type { AgentThread, ThreadsStore } from './thread'
import type { AgentTransport } from './transport'

function createStore(): ThreadsStore<AgentPart> {
  let threads: AgentThread<AgentPart>[] = []
  const patch = (id: string, change: Partial<AgentThread<AgentPart>>): void => {
    threads = threads.map((thread) => (thread.id === id ? { ...thread, ...change } : thread))
  }
  return {
    get threads() {
      return threads
    },
    activeId: null,
    select() {},
    create() {
      const id = crypto.randomUUID()
      threads = [
        {
          id,
          messages: [],
          outcome: null,
          status: 'pending',
          read: false,
          createdAt: 0,
          updatedAt: 0,
        },
        ...threads,
      ]
      return id
    },
    appendMessage(id, message) {
      const thread = threads.find((t) => t.id === id)
      if (thread) patch(id, { messages: [...thread.messages, message] })
    },
    setOutcome(id, outcome) {
      patch(id, { outcome })
    },
    setStatus(id, status) {
      patch(id, { status })
    },
    setResumeToken() {},
    markRead() {},
    remove() {},
    clear() {},
    hydrated: true,
    error: undefined,
  }
}

const resolveOutcome: OutcomeResolver<AgentPart> = (): AgentOutcome => ({
  title: 'title',
  summary: 'summary',
  status: 'done',
})

function gate(): { promise: Promise<void>; open: () => void } {
  let open = (): void => {}
  const promise = new Promise<void>((resolve) => {
    open = resolve
  })
  return { promise, open }
}

const text = (id: string, chunk: string, offset = 0): AgentPart => ({
  id,
  type: 'text',
  text: chunk,
  offset,
})

describe('submitted → streaming', () => {
  test('a turn is `submitted` until its first content part, then `streaming`', async () => {
    const store = createStore()
    const id = store.create()
    const release = gate()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 's', type: 'start', runId: 'r', resumeToken: 'r' }
        await release.promise
        yield text('t', 'hi')
        await new Promise(() => {})
      },
    }
    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    act(() => result.current.start(id, 'hello'))
    expect(result.current.runs.get(id)).toEqual({ status: 'submitted', parts: [] })

    // The synthetic start part is not content: still submitted.
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.runs.get(id)?.status).toBe('submitted')

    await act(async () => {
      release.open()
    })
    await waitFor(() => expect(result.current.runs.get(id)?.status).toBe('streaming'))
    expect(result.current.runs.get(id)?.parts).toHaveLength(1)
    act(() => result.current.stop(id))
  })

  test('a source part alone does not end `submitted`', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'src', type: 'source', url: 'https://example.com' }
        await new Promise(() => {})
      },
    }
    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))
    act(() => result.current.start(id, 'hello'))
    await waitFor(() => expect(result.current.runs.get(id)?.parts).toHaveLength(1))
    expect(result.current.runs.get(id)?.status).toBe('submitted')
    act(() => result.current.stop(id))
  })
})

describe('ThreadRunState.error', () => {
  const failing = (error: Error): AgentTransport<AgentPart, string> => ({
    async *stream() {
      yield text('t', 'partial')
      throw error
    },
  })

  test('a failed turn keeps its entry — error plus the parts so far — and raw onError still fires', async () => {
    const store = createStore()
    const id = store.create()
    const boom = Object.assign(new Error('Service Unavailable'), { statusCode: 503 })
    const raw: unknown[] = []
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: failing(boom),
        store,
        resolveOutcome,
        onError: ({ error }) => raw.push(error),
      }),
    )
    act(() => result.current.start(id, 'hello'))
    await waitFor(() => expect(result.current.runs.get(id)?.error).toBeDefined())

    const run = result.current.runs.get(id)
    expect(run?.error).toEqual({ kind: 'http', status: 503 })
    expect(run?.status).toBe('error')
    expect(run?.parts).toHaveLength(1)
    expect(store.threads[0]?.status).toBe('error')
    expect(raw).toEqual([boom])
  })

  test('the next send replaces the failed entry', async () => {
    const store = createStore()
    const id = store.create()
    let attempt = 0
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        attempt += 1
        if (attempt === 1) throw new Error('first fails')
        await new Promise(() => {})
        yield text('t', 'never')
      },
    }
    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))
    act(() => result.current.start(id, 'hello'))
    await waitFor(() => expect(result.current.runs.get(id)?.error).toBeDefined())

    act(() => result.current.retry(id))
    expect(result.current.runs.get(id)).toEqual({ status: 'submitted', parts: [] })
    act(() => result.current.stop(id))
  })

  test('stop() on a failed entry only dismisses it — the thread stays in error', async () => {
    const store = createStore()
    const id = store.create()
    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport: failing(new Error('x')), store, resolveOutcome }),
    )
    act(() => result.current.start(id, 'hello'))
    await waitFor(() => expect(result.current.runs.get(id)?.error).toBeDefined())

    act(() => result.current.stop(id))
    expect(result.current.runs.has(id)).toBe(false)
    expect(store.threads[0]?.status).toBe('error')
    // No 'stopped' assistant message was appended for the failed turn.
    expect(store.threads[0]?.messages.map((m) => m.role)).toEqual(['user'])
  })

  test('a failure before any content has an empty transcript', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      // oxlint-disable-next-line require-yield
      async *stream() {
        throw new Error('down')
      },
    }
    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))
    act(() => result.current.start(id, 'hello'))
    await waitFor(() => expect(result.current.runs.get(id)?.error).toBeDefined())
    expect(result.current.runs.get(id)).toEqual({
      status: 'error',
      parts: [],
      error: { kind: 'server', message: 'down' },
    })
  })
})

describe('stop() between a settle and its render', () => {
  // `runsRef` only mirrors the last flushed render, so right after a settle's `setRuns` it still
  // holds the live entry. These call stop() synchronously inside the settle's own callbacks.
  test('a turn that just completed: stop() adds no second assistant message', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'done')
        // Let the part's commit render, so the stale `runsRef` entry holds content stop() could persist.
        await new Promise((resolve) => setTimeout(resolve, 15))
      },
    }
    let stopOnSettle = (): void => {}
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport,
        store,
        resolveOutcome,
        // emitted synchronously right after the settle's setRuns, before any render
        telemetry: () => stopOnSettle(),
      }),
    )
    stopOnSettle = () => result.current.stop(id)
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    const roles = store.threads[0]?.messages.map((m) => `${m.role}:${m.finish ?? ''}`)
    expect(roles).toEqual(['user:', 'assistant:complete'])
    expect(result.current.runs.has(id)).toBe(false)
  })

  test('a turn that just failed: stop() keeps the thread in error and only dismisses the entry', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'partial')
        throw new Error('boom')
      },
    }
    let stopOnError = (): void => {}
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport,
        store,
        resolveOutcome,
        // fired synchronously right after the failure's setRuns, before any render
        onError: () => stopOnError(),
      }),
    )
    stopOnError = () => result.current.stop(id)
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('error'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(store.threads[0]?.status).toBe('error')
    expect(store.threads[0]?.outcome).toBeNull()
    expect(store.threads[0]?.messages.map((m) => m.role)).toEqual(['user'])
    expect(result.current.runs.has(id)).toBe(false)
  })

  test('two stop() calls in one tick persist a single "stopped" message', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'partial')
        await new Promise(() => {})
      },
    }
    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(result.current.runs.get(id)?.status).toBe('streaming'))

    act(() => {
      result.current.stop(id)
      result.current.stop(id)
    })
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(store.threads[0]?.messages.map((m) => `${m.role}:${m.finish ?? ''}`)).toEqual([
      'user:',
      'assistant:stopped',
    ])
  })

  test('stopAll() called from onError, before the failure renders, dismisses that entry', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      // oxlint-disable-next-line require-yield
      async *stream() {
        throw new Error('boom')
      },
    }
    let stopAllOnError = (): void => {}
    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome, onError: () => stopAllOnError() }),
    )
    stopAllOnError = () => result.current.stopAll()
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('error'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(result.current.runs.has(id)).toBe(false)
    expect(store.threads[0]?.status).toBe('error')
  })

  test('a failure after the final message landed keeps no parts, so nothing renders twice', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'answer')
      },
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport,
        store,
        resolveOutcome: async () => {
          throw new Error('resolver down')
        },
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(result.current.runs.get(id)?.status).toBe('error'))

    // The message is in the thread; the error entry must not repeat it as live parts.
    expect(store.threads[0]?.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(result.current.runs.get(id)?.parts).toEqual([])
    expect(result.current.runs.get(id)?.error).toEqual({ kind: 'server', message: 'resolver down' })
  })

  test('stopAll() dismisses failed entries too', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      // oxlint-disable-next-line require-yield
      async *stream() {
        throw new Error('boom')
      },
    }
    const { result } = renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(result.current.runs.get(id)?.status).toBe('error'))
    act(() => result.current.stopAll())
    expect(result.current.runs.has(id)).toBe(false)
    expect(store.threads[0]?.status).toBe('error')
  })
})

describe('throttle', () => {
  /** Streams `count` text deltas in a burst, then parks until released. */
  function burst(count: number, release: Promise<void>): AgentTransport<AgentPart, string> {
    return {
      async *stream() {
        let acc = ''
        for (let i = 0; i < count; i++) {
          yield text('t', 'x', acc.length)
          acc += 'x'
          // A macrotask per part, as a real network stream has: React batches same-tick commits.
          await new Promise((resolve) => setTimeout(resolve, 2))
        }
        await release
      },
    }
  }

  function observe(throttle: number, count: number, release: Promise<void>) {
    const store = createStore()
    const id = store.create()
    const seen: number[] = []
    const rendered = renderHook(() => {
      const hook = useAgentThreadRuns({
        transport: burst(count, release),
        store,
        resolveOutcome,
        throttle,
      })
      const length = hook.runs.get(id)?.parts[0] !== undefined ? textLength(hook.runs.get(id)) : -1
      if (length >= 0 && seen.at(-1) !== length) seen.push(length)
      return hook
    })
    return { ...rendered, id, store, seen }
  }

  function textLength(run: ThreadRunState | undefined): number {
    const part = run?.parts[0]
    return part?.type === 'text' ? part.text.length : -1
  }

  test('throttle 0 commits every part', async () => {
    const release = gate()
    const { result, id, seen } = observe(0, 5, release.promise)
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(seen.at(-1)).toBe(5))
    // Unthrottled, the commits are not collapsed into a single trailing one.
    expect(seen.length).toBeGreaterThan(2)
    act(() => result.current.stop(id))
  })

  test('a burst inside the window is batched: leading commit, then one trailing commit with the last part', async () => {
    const release = gate()
    const { result, id, seen } = observe(150, 6, release.promise)
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(seen.at(-1)).toBe(6))
    // The six deltas span a few ms, far inside the 150ms window: at most the leading commit, a
    // straggler and the trailing one — never one commit per part — and the last part is not lost.
    expect(seen.length).toBeLessThanOrEqual(3)
    act(() => result.current.stop(id))
  })

  test('the end of the stream flushes the trailing commit before the entry is settled', async () => {
    const store = createStore()
    const id = store.create()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'a')
        yield text('t', 'b', 1)
        yield text('t', 'c', 2)
      },
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome, throttle: 10_000 }),
    )
    act(() => result.current.start(id, 'go'))
    // A 10s window would otherwise hold the entry back; settle must not wait for it.
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    const assistant = store.threads[0]?.messages.find((m) => m.role === 'assistant')
    const part = assistant?.parts[0]
    expect(part?.type === 'text' ? part.text : '').toBe('abc')
    expect(result.current.runs.has(id)).toBe(false)
  })

  test('stop() persists the parts that arrived inside the throttle window', async () => {
    const release = gate()
    const { result, id, store, seen } = observe(10_000, 4, release.promise)
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(seen).toEqual([1]))
    // Let the remaining three deltas through the (uncommitted) accumulator.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
    })
    expect(seen).toEqual([1])

    act(() => result.current.stop(id))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    const stopped = store.threads[0]?.messages.find((m) => m.role === 'assistant')
    const part = stopped?.parts[0]
    expect(part?.type === 'text' ? part.text : '').toBe('xxxx')
    expect(stopped?.finish).toBe('stopped')
  })

  test('the submitted → streaming edge never waits on the window', async () => {
    const store = createStore()
    const id = store.create()
    const release = gate()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        // A source part takes the leading commit; the first content part must still land at once.
        yield { id: 'src', type: 'source', url: 'https://example.com' }
        yield text('t', 'hi')
        await release.promise
      },
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome, throttle: 10_000 }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(result.current.runs.get(id)?.status).toBe('streaming'))
    act(() => result.current.stop(id))
  })
})

describe('chat.turn telemetry', () => {
  const okTransport: AgentTransport<AgentPart, string> = {
    async *stream() {
      yield { id: 's', type: 'start', runId: 'r', resumeToken: 'r' }
      yield text('t', 'hi')
      yield { id: 'r1', type: 'reasoning', text: 'hmm', offset: 0 }
    },
  }

  test('a settled turn emits one ok event with thread id, ttft, part count and the outcome status', async () => {
    const store = createStore()
    const id = store.create()
    const events: BasaltEvent[] = []
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: okTransport,
        store,
        resolveOutcome,
        telemetry: (event) => events.push(event),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(events).toHaveLength(1))

    const event = events[0]
    if (event?.type !== 'chat.turn' || event.failed) throw new Error('expected an ok chat.turn')
    expect(event.attributes['basalt.chat.thread_id']).toBe(id)
    expect(event.attributes['basalt.chat.parts']).toBe(2)
    expect(event.attributes['basalt.chat.status']).toBe('done')
    expect(event.attributes['basalt.chat.ttft_ms']).toBeGreaterThanOrEqual(0)
    expect(event.attributes['basalt.chat.ttft_ms']).toBeLessThanOrEqual(event.duration)
    expect(event.start).toBeGreaterThan(0)
    expect('exception.type' in event.attributes).toBe(false)
  })

  test('a failed turn emits the Err shape: exception.type and basalt.error.kind = the AgentError kind', async () => {
    const store = createStore()
    const id = store.create()
    const events: BasaltEvent[] = []
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'partial')
        throw Object.assign(new TypeError('Bad Gateway'), { statusCode: 502 })
      },
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport,
        store,
        resolveOutcome,
        telemetry: (event) => events.push(event),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(events).toHaveLength(1))

    const event = events[0]
    if (event?.type !== 'chat.turn' || !event.failed) throw new Error('expected an Err chat.turn')
    expect(event.attributes).toMatchObject({
      'basalt.chat.thread_id': id,
      'basalt.chat.parts': 1,
      'basalt.chat.status': 'error',
      'exception.type': 'TypeError',
      'basalt.error.kind': 'http',
    })
    expect(event.duration).toBeGreaterThanOrEqual(0)
    // Ids, counts and durations only — never the message.
    expect(JSON.stringify(event)).not.toContain('Bad Gateway')
  })

  test('ttft is measured at the submitted → streaming edge, not at settle', async () => {
    const store = createStore()
    const id = store.create()
    const events: BasaltEvent[] = []
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        await new Promise((resolve) => setTimeout(resolve, 40))
        yield text('t', 'hi')
        await new Promise((resolve) => setTimeout(resolve, 80))
      },
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport,
        store,
        resolveOutcome,
        telemetry: (event) => events.push(event),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(events).toHaveLength(1))
    const event = events[0]
    if (event?.type !== 'chat.turn' || event.failed) throw new Error('expected an ok chat.turn')
    const ttft = event.attributes['basalt.chat.ttft_ms']
    expect(ttft).toBeGreaterThanOrEqual(30)
    expect(event.duration - ttft).toBeGreaterThanOrEqual(60)
  })

  test('without a sink the turn settles normally and nothing is built', async () => {
    const store = createStore()
    const id = store.create()
    const { result } = renderHook(() =>
      useAgentThreadRuns({ transport: okTransport, store, resolveOutcome }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
  })

  test('a throwing sink never breaks the turn', async () => {
    const store = createStore()
    const id = store.create()
    let calls = 0
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: okTransport,
        store,
        resolveOutcome,
        telemetry: () => {
          calls += 1
          throw new Error('sink down')
        },
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(calls).toBe(1)
    expect(result.current.runs.has(id)).toBe(false)
  })

  test('a stopped turn emits nothing', async () => {
    const store = createStore()
    const id = store.create()
    const events: BasaltEvent[] = []
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield text('t', 'hi')
        await new Promise(() => {})
      },
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport,
        store,
        resolveOutcome,
        telemetry: (event) => events.push(event),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(result.current.runs.get(id)?.status).toBe('streaming'))
    act(() => result.current.stop(id))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(events).toEqual([])
  })
})

describe('chat.turn through the real BasaltProvider', () => {
  const transport: AgentTransport<AgentPart, string> = {
    async *stream() {
      yield text('t', 'hi')
    },
  }

  function mountProbe(args: { telemetry?: (event: BasaltEvent) => void }) {
    const store = createStore()
    const id = store.create()
    const providerEvents: BasaltEvent[] = []
    let hook: ReturnType<typeof useAgentThreadRuns> | undefined
    function Probe(): ReactElement {
      const current = useAgentThreadRuns({
        transport,
        store,
        resolveOutcome,
        ...(args.telemetry !== undefined ? { telemetry: args.telemetry } : {}),
      })
      useEffect(() => {
        hook = current
      })
      return <div>probe</div>
    }
    const router = createBasaltRouter({ routeTree: createRootRoute({ component: Probe }) })
    render(<BasaltProvider router={router} telemetry={(event) => providerEvents.push(event)} />)
    return { store, id, providerEvents, start: () => hook?.start(id, 'go') }
  }

  test('with no `telemetry` arg the turn reaches the provider sink', async () => {
    const { store, id, providerEvents, start } = mountProbe({})
    await screen.findByText('probe')
    act(() => start())
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    const turns = providerEvents.filter((e) => e.type === 'chat.turn')
    expect(turns).toHaveLength(1)
    expect(turns[0]?.attributes).toMatchObject({ 'basalt.chat.thread_id': id })
  })

  test('an explicit `telemetry` arg wins over the provider sink', async () => {
    const own: BasaltEvent[] = []
    const { store, providerEvents, start } = mountProbe({ telemetry: (event) => own.push(event) })
    await screen.findByText('probe')
    act(() => start())
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(own.filter((e) => e.type === 'chat.turn')).toHaveLength(1)
    expect(providerEvents.filter((e) => e.type === 'chat.turn')).toHaveLength(0)
  })
})
