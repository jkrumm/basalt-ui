/**
 * aiSdkTransport — snapshot→delta diffing (text/reasoning/source/tool), signal-abort mid-stream,
 * and deterministic chat-id binding via `.forThread()`.
 *
 * Scope: the diffing behaviour post-1.11.0's seven-state `ToolCallPart` — `diffToolPart` now tags
 * every emitted tool delta with its real `state` and, for a failed call, a dedicated `errorText`
 * field (never `output`, which the corrected type doesn't carry on `output-error`). What is still
 * OUT of scope here (deliberately, a later brief's own "B2" rewrite of this transport): swallowing
 * `input-streaming`, deriving the SDK's nested `approval` envelope, `durationMs`, and per-state
 * modeling of `approval-requested`/`approval-responded`/`output-denied` — those states still pass
 * through flat (see `diffToolPart`'s own comment). No `id` is minted by this transport yet either
 * (`useAgentStream`/`useAgentThreadRuns` don't normalize drafts through `withPartIds` yet) — the
 * yielded objects have no `id` key at runtime, which is why every `toEqual` below omits it.
 *
 * Driving `aiSdkTransport` through a scripted HTTP response — the only way to exercise its public
 * stream()/resume() diffing at all, since the diffing internals are not exported — requires a real
 * web-streams `TransformStream` for `ai`'s HTTP transport and `eventsource-parser` to construct
 * internally (`DefaultChatTransport.processResponseStream`, `EventSourceParserStream`). The DOM
 * harness (`tests/setup/dom.ts`, preloaded once per `bun test` process) restores the native
 * web-stream classes after happy-dom registration, so a plain static `import` here is safe
 * regardless of file/module evaluation order.
 */
import { describe, expect, test } from 'bun:test'
import { JsonToSseTransformStream } from 'ai'
import { aiSdkTransport } from './ai-sdk-transport'
import type { UIMessageChunk } from 'ai'
import type { AgentPart } from './parts'

/**
 * Builds a fetch-compatible Response whose body is the given low-level UIMessageChunks, SSE-
 * encoded exactly as AI SDK's own `DefaultChatTransport` expects (real `JsonToSseTransformStream`,
 * not a hand-rolled encoding) so this exercises the real parse/diff pipeline end to end.
 */
function scriptedResponse(chunks: UIMessageChunk[]): Response {
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

/** Drains an aiSdkTransport `.stream()`/`.resume()` async generator into a plain array. */
async function collect(gen: AsyncGenerator<AgentPart>): Promise<AgentPart[]> {
  const parts: AgentPart[] = []
  for await (const part of gen) parts.push(part)
  return parts
}

describe('aiSdkTransport — snapshot→delta diffing', () => {
  test('yields a synthesized start part first, then diffs text deltas across snapshots', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hel' },
      { type: 'text-delta', id: 't1', delta: 'lo' },
      { type: 'text-end', id: 't1' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    expect(parts[0]?.type).toBe('start')
    const textParts = parts.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    // AI SDK's snapshot carries the FULL accumulated text at every write — the module's whole job
    // is re-deriving the two incremental deltas ('Hel' then 'lo') rather than replaying 'Hello'
    // twice or once whole.
    expect(textParts).toEqual([
      { type: 'text', text: 'Hel' },
      { type: 'text', text: 'lo' },
    ])
    expect(textParts.reduce((acc, p) => acc + p.text, '')).toBe('Hello')
  })

  test('diffs reasoning deltas the same way as text', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'thinking ' },
      { type: 'reasoning-delta', id: 'r1', delta: 'more' },
      { type: 'reasoning-end', id: 'r1' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const reasoningParts = parts.filter((p) => p.type === 'reasoning')
    expect(reasoningParts).toEqual([
      { type: 'reasoning', text: 'thinking ' },
      { type: 'reasoning', text: 'more' },
    ])
  })

  test('emits a source part exactly once for a source-url chunk', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'source-url', sourceId: 's1', url: 'https://example.com', title: 'Example' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const sourceParts = parts.filter((p) => p.type === 'source')
    expect(sourceParts).toEqual([{ type: 'source', url: 'https://example.com', title: 'Example' }])
  })

  test('a tool call progresses input-available → output-available with the accumulated output', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'search' },
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      { type: 'tool-output-available', toolCallId: 'call-1', output: { hits: 3 } },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const toolParts = parts.filter((p) => p.type === 'tool')
    // input-streaming is never emitted (deliberate v1 simplification) — only input-available then
    // output-available surface, one AgentPart each.
    expect(toolParts).toEqual([
      {
        type: 'tool',
        state: 'input-available',
        toolName: 'search',
        toolCallId: 'call-1',
        input: { q: 'x' },
      },
      {
        type: 'tool',
        state: 'output-available',
        toolName: 'search',
        toolCallId: 'call-1',
        input: { q: 'x' },
        output: { hits: 3 },
      },
    ])
  })

  test('a repeated chunk carrying the SAME tool state is deduped — nothing new to report', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'search' },
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      // Redundant re-send of the identical input-available state — must not double-emit.
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      { type: 'tool-output-available', toolCallId: 'call-1', output: { hits: 3 } },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const toolParts = parts.filter((p) => p.type === 'tool')
    expect(toolParts).toHaveLength(2) // input-available once, output-available once — not three
  })

  // ToolCallPart's `output-error` state carries a dedicated `errorText` field (the SDK's own field
  // name — there is no field named `error` anywhere in the union). Stuffing the failure into
  // `output` is gone: `output-error` doesn't even have an `output` field to smuggle it through.
  test('output-error surfaces a dedicated `errorText` field, not `output`', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'search' },
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      { type: 'tool-output-error', toolCallId: 'call-1', errorText: 'boom' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const toolParts = parts.filter((p) => p.type === 'tool')
    const failed = toolParts.at(-1)
    expect(failed).toEqual({
      type: 'tool',
      state: 'output-error',
      toolName: 'search',
      toolCallId: 'call-1',
      input: { q: 'x' },
      errorText: 'boom',
    })
  })
})

describe('aiSdkTransport — signal.aborted stops the yield', () => {
  test('once the caller aborts, no further parts are yielded even though more remain', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'a' },
      { type: 'text-delta', id: 't1', delta: 'b' },
      { type: 'text-end', id: 't1' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const controller = new AbortController()
    const gen = transport.stream('hi', controller.signal)

    const start = await gen.next()
    expect(start.value).toMatchObject({ type: 'start' })
    const firstDelta = await gen.next()
    expect(firstDelta.value).toEqual({ type: 'text', text: 'a' })

    // Let AI SDK's background readUIMessageStream pump (kicked off inside diffChunkStream, and
    // NOT gated on our own reads) fully settle before aborting — this is inherent to the library,
    // not to the AgentTransport code under test: aborting while chunks are still in flight through
    // that pump races diffChunkStream's early return against the pump's own stream teardown. A
    // short real-time wait avoids exercising that unrelated race so this test isolates exactly
    // ai-sdk-transport.ts:218's `if (signal?.aborted) return`.
    await new Promise((resolve) => setTimeout(resolve, 100))

    controller.abort()
    const afterAbort = await gen.next()
    expect(afterAbort.done).toBe(true)
    expect(afterAbort.value).toBeUndefined()
  })
})

describe('aiSdkTransport — deterministic chat-id binding', () => {
  test('the fixed (non-forThread) transport mints its chat id ONCE, stable across repeated stream() calls', async () => {
    // Never actually reached — the synthesized StartPart is yielded before any fetch call, so a
    // generator that never advances past its first `.next()` never touches the network.
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: () => {
        throw new Error('must not be called — only the first, pre-network yield is read')
      },
    })

    const first = await transport.stream('a').next()
    const second = await transport.stream('b').next()
    expect(first.value).toEqual(second.value)
    expect((first.value as { runId: string }).runId).toBe((second.value as { runId: string }).runId)
  })

  test('.forThread(id) binds the StartPart runId/resumeToken deterministically to the given id', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: () => {
        throw new Error('must not be called — only the first, pre-network yield is read')
      },
    })
    const bound = transport.forThread('caller-supplied-thread-id')

    const first = await bound.stream('first turn').next()
    const second = await bound.stream('second turn').next()

    expect(first.value).toEqual({
      type: 'start',
      runId: 'caller-supplied-thread-id',
      resumeToken: 'caller-supplied-thread-id',
    })
    // Same across repeated turns on the same bound transport — the id is NOT re-minted per call.
    expect(second.value).toEqual(first.value)
  })

  test('two different .forThread() ids produce two different StartPart runIds', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: () => {
        throw new Error('must not be called — only the first, pre-network yield is read')
      },
    })

    const a = await transport.forThread('thread-a').stream('hi').next()
    const b = await transport.forThread('thread-b').stream('hi').next()

    expect(a.value).toEqual({ type: 'start', runId: 'thread-a', resumeToken: 'thread-a' })
    expect(b.value).toEqual({ type: 'start', runId: 'thread-b', resumeToken: 'thread-b' })
  })
})
