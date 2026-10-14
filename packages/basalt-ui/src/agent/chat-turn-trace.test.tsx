/**
 * Trace-context propagation for a chat turn (V2-SPEC § 7): a sink's `startChatTurn` contributes
 * `traceparent`/`tracestate` to that turn's chat request, `settle` closes the turn on every exit,
 * and a sink without the hook changes nothing on the wire.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { JsonToSseTransformStream } from 'ai'
import type { UIMessageChunk } from 'ai'
import { aiSdkTransport } from './ai-sdk-transport'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { AgentOutcome, OutcomeResolver } from './outcome'
import type { AgentPart } from './parts'
import type { AgentThread, ThreadsStore } from './thread'
import { beginRun } from './run-records'
import type { AgentStreamContext, AgentTransport } from './transport'
import type { BasaltEvent, ChatTurnEnd, ChatTurnTrace, Telemetry } from '../telemetry'

const TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

function sse(chunks: UIMessageChunk[]): Response {
  const source = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  const body = source
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream())
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

const CHUNKS: UIMessageChunk[] = [
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: 'hi' },
  { type: 'text-end', id: 't' },
]

/** A scripted fetch that records every outgoing request's headers. */
function recordingFetch(): { fetch: typeof fetch; seen: Headers[] } {
  const seen: Headers[] = []
  const impl = async (_input: unknown, init?: RequestInit): Promise<Response> => {
    seen.push(new Headers(init?.headers))
    return sse(CHUNKS)
  }
  return { fetch: impl as unknown as typeof fetch, seen }
}

async function drain(gen: AsyncGenerator<AgentPart>): Promise<void> {
  for await (const _ of gen) void _
}

describe('aiSdkTransport — ctx.headers', () => {
  test('ctx.headers reach the chat request and merge over the static headers', async () => {
    const { fetch, seen } = recordingFetch()
    const transport = aiSdkTransport({ api: '/api/chat', headers: { 'x-app': 'argo' }, fetch })
    await drain(
      transport.stream('hi', undefined, {
        messageId: 'm1',
        headers: { traceparent: TRACEPARENT, tracestate: 'vendor=1' },
      }),
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.get('traceparent')).toBe(TRACEPARENT)
    expect(seen[0]?.get('tracestate')).toBe('vendor=1')
    expect(seen[0]?.get('x-app')).toBe('argo')
  })

  test('without ctx.headers no trace header is added', async () => {
    const { fetch, seen } = recordingFetch()
    const transport = aiSdkTransport({ api: '/api/chat', fetch })
    await drain(transport.stream('hi', undefined, { messageId: 'm1' }))
    expect(seen[0]?.has('traceparent')).toBe(false)
    expect(seen[0]?.has('tracestate')).toBe(false)
  })
})

// ── the hook ──────────────────────────────────────────────────────────────────

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

/** A sink that logs its calls in order and hands out a fixed traceparent. */
function tracingSink(log: string[], extra: Partial<ChatTurnTrace> = {}): Telemetry {
  const sink = (event: BasaltEvent): void => {
    log.push(`event:${event.type}`)
  }
  return Object.assign(sink, {
    startChatTurn: ({ threadId, messageId }: { threadId: string; messageId: string }) => {
      log.push(`start:${threadId === '' ? '?' : 'thread'}:${messageId === '' ? '?' : 'msg'}`)
      return {
        headers: { traceparent: TRACEPARENT },
        settle: (end: ChatTurnEnd) => log.push(`settle:${end}`),
        ...extra,
      }
    },
  })
}

/** A transport that records the ctx it was given and then runs `body`. */
function spyTransport(
  ctxs: Array<AgentStreamContext | undefined>,
  body: () => AsyncGenerator<AgentPart>,
): AgentTransport<AgentPart, string> {
  return {
    stream(_input, _signal, ctx) {
      ctxs.push(ctx)
      return body()
    },
  }
}

const okBody = async function* (): AsyncGenerator<AgentPart> {
  yield { id: 't', type: 'text', text: 'hi', offset: 0 }
}

describe('useAgentThreadRuns — chat turn trace', () => {
  test('a settled turn: start → request carries the traceparent → chat.turn → settle', async () => {
    const store = createStore()
    const id = store.create()
    const log: string[] = []
    const ctxs: Parameters<typeof spyTransport>[0] = []
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport(ctxs, okBody),
        store,
        resolveOutcome,
        telemetry: tracingSink(log),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(log).toContain('settle:settled'))

    expect(log).toEqual(['start:thread:msg', 'event:chat.turn', 'settle:settled'])
    expect(ctxs[0]?.headers).toEqual({ traceparent: TRACEPARENT })
  })

  test('tracestate rides along when the sink returns it', async () => {
    const store = createStore()
    const id = store.create()
    const ctxs: Parameters<typeof spyTransport>[0] = []
    const sink = tracingSink([], { headers: { traceparent: TRACEPARENT, tracestate: 'a=b' } })
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport(ctxs, okBody),
        store,
        resolveOutcome,
        telemetry: sink,
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(ctxs[0]?.headers).toEqual({ traceparent: TRACEPARENT, tracestate: 'a=b' })
  })

  test('a failed turn settles as failed, after its chat.turn event', async () => {
    const store = createStore()
    const id = store.create()
    const log: string[] = []
    const failing = async function* (): AsyncGenerator<AgentPart> {
      yield* okBody()
      throw new Error('boom')
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport([], failing),
        store,
        resolveOutcome,
        telemetry: tracingSink(log),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(log).toContain('settle:failed'))
    expect(log).toEqual(['start:thread:msg', 'event:chat.turn', 'settle:failed'])
  })

  test('a stopped turn emits no chat.turn but still settles, once', async () => {
    const store = createStore()
    const id = store.create()
    const log: string[] = []
    const hanging = async function* (): AsyncGenerator<AgentPart> {
      yield* okBody()
      await new Promise(() => {})
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport([], hanging),
        store,
        resolveOutcome,
        telemetry: tracingSink(log),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(result.current.runs.get(id)?.parts.length).toBe(1))
    act(() => result.current.stop(id))
    act(() => result.current.stop(id))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(log).toEqual(['start:thread:msg', 'settle:stopped'])
  })

  test('an unmount mid-turn settles as stopped', async () => {
    const store = createStore()
    const id = store.create()
    const log: string[] = []
    const hanging = async function* (): AsyncGenerator<AgentPart> {
      await new Promise(() => {})
      yield* okBody()
    }
    const { result, unmount } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport([], hanging),
        store,
        resolveOutcome,
        telemetry: tracingSink(log),
      }),
    )
    act(() => result.current.start(id, 'go'))
    unmount()
    expect(log).toEqual(['start:thread:msg', 'settle:stopped'])
  })

  test('a sink without the hook adds no headers and a bare ctx', async () => {
    const store = createStore()
    const id = store.create()
    const ctxs: Parameters<typeof spyTransport>[0] = []
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport(ctxs, okBody),
        store,
        resolveOutcome,
        telemetry: () => {},
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(Object.keys(ctxs[0] ?? {})).toEqual(['messageId'])
  })

  test('a throwing hook never breaks the turn or adds headers', async () => {
    const store = createStore()
    const id = store.create()
    const ctxs: Parameters<typeof spyTransport>[0] = []
    const startChatTurn = (): never => {
      throw new Error('sink bug')
    }
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport(ctxs, okBody),
        store,
        resolveOutcome,
        telemetry: Object.assign((): void => {}, { startChatTurn }),
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(ctxs[0]?.headers).toBeUndefined()
  })

  test('a malformed or empty traceparent sends no header but still settles', async () => {
    for (const traceparent of ['', 'not-a-traceparent']) {
      const store = createStore()
      const id = store.create()
      const log: string[] = []
      const ctxs: Parameters<typeof spyTransport>[0] = []
      const sink = tracingSink(log, { headers: { traceparent } })
      const { result } = renderHook(() =>
        useAgentThreadRuns({
          transport: spyTransport(ctxs, okBody),
          store,
          resolveOutcome,
          telemetry: sink,
        }),
      )
      act(() => result.current.start(id, 'go'))
      await waitFor(() => expect(log).toContain('settle:settled'))
      expect(ctxs[0]?.headers).toBeUndefined()
    }
  })

  test('a sink returning only settle (no headers) is untraced on the wire but still settles', async () => {
    const store = createStore()
    const id = store.create()
    const log: string[] = []
    const ctxs: Parameters<typeof spyTransport>[0] = []
    const sink = tracingSink(log, { headers: undefined })
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport(ctxs, okBody),
        store,
        resolveOutcome,
        telemetry: sink,
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(log).toContain('settle:settled'))
    expect(ctxs[0]?.headers).toBeUndefined()
  })

  test('a malformed tracestate is dropped, the traceparent kept', async () => {
    const store = createStore()
    const id = store.create()
    const ctxs: Parameters<typeof spyTransport>[0] = []
    const sink = tracingSink([], { headers: { traceparent: TRACEPARENT, tracestate: 'no equals' } })
    const { result } = renderHook(() =>
      useAgentThreadRuns({
        transport: spyTransport(ctxs, okBody),
        store,
        resolveOutcome,
        telemetry: sink,
      }),
    )
    act(() => result.current.start(id, 'go'))
    await waitFor(() => expect(store.threads[0]?.status).toBe('done'))
    expect(ctxs[0]?.headers).toEqual({ traceparent: TRACEPARENT })
  })
})

describe('beginRun — takeover', () => {
  test('a newer run settles the live previous run once as stopped; the new one settles later', () => {
    const records = new Map()
    const log: string[] = []
    beginRun(records, 't', new AbortController(), (end) => log.push(`A:${end}`))
    const b = beginRun(records, 't', new AbortController(), (end) => log.push(`B:${end}`))
    expect(log).toEqual(['A:stopped'])
    beginRun(records, 't', new AbortController())
    expect(log).toEqual(['A:stopped', 'B:stopped'])
    expect(b.superseded).toBe(true)
  })
})
