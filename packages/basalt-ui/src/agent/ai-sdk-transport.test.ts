/**
 * aiSdkTransport — snapshot→delta diffing (text/reasoning/source/tool), deterministic id minting,
 * durationMs, signal-abort mid-stream, and deterministic chat-id binding via `.forThread()`.
 *
 * Scope: the diffing behaviour post-1.11.0's B2 rewrite — `diffToolPart` now models all seven
 * `UIToolInvocation` states (including `input-streaming`, the nested `approval` envelope, and
 * `output-denied`), mints deterministic ids (`${chatId}#${index}` for index-addressed parts,
 * `tool#${toolCallId}` for tool parts), carries an authoritative `offset` on every text/reasoning
 * delta, derives a dynamic tool's real name instead of the literal `'dynamic-tool'`, and does not
 * suppress a `preliminary: true` output-available refinement.
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
import { withPartIds } from './id'
import { mergePart } from './merge'
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

/** Strips a non-deterministic `durationMs` (wall-clock, so never equality-comparable) before an
 * exact `toEqual`, and separately asserts its type. */
function withoutDurationMs<T extends { durationMs?: number }>(part: T): Omit<T, 'durationMs'> {
  const { durationMs: _durationMs, ...rest } = part
  return rest
}

describe('aiSdkTransport — snapshot→delta diffing', () => {
  test('yields a synthesized start part first, with a deterministic id, then diffs text deltas across snapshots with an authoritative offset', async () => {
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
    expect(typeof (parts[0] as { id: string }).id).toBe('string')
    const textParts = parts.filter(
      (p): p is { id: string; type: 'text'; text: string; offset: number } => p.type === 'text',
    )
    // AI SDK's snapshot carries the FULL accumulated text at every write — the module's whole job
    // is re-deriving the two incremental deltas ('Hel' then 'lo') rather than replaying 'Hello'
    // twice or once whole. Both deltas share ONE id (the same message-part index) so mergePart
    // splices them into a single TextPart; `offset` is the length of the previously-seen text.
    expect(textParts.map((p) => p.text)).toEqual(['Hel', 'lo'])
    expect(textParts.map((p) => p.offset)).toEqual([0, 3])
    expect(new Set(textParts.map((p) => p.id)).size).toBe(1)
    expect(textParts.reduce((acc, p) => acc + p.text, '')).toBe('Hello')
  })

  // F1: withPartIds is only ever a normalizer for DRAFTS (id-less parts). aiSdkTransport mints its
  // own deterministic, content-stable ids for every part it yields (`${chatId}#${index}`,
  // `tool#${toolCallId}`, `${chatId}#start`), so wrapping its output in withPartIds must be a pure
  // no-op passthrough — proves the two hooks wiring withPartIds in unconditionally does not disturb
  // a transport that already identifies its own parts.
  test('withPartIds is a no-op over aiSdkTransport output — every part already carries a stable id', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hel' },
      { type: 'text-delta', id: 't1', delta: 'lo' },
      { type: 'text-end', id: 't1' },
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'search' },
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      { type: 'tool-output-available', toolCallId: 'call-1', output: { hits: 3 } },
    ]

    // Same transport instance for both sides — aiSdkTransport mints its chat id at CONSTRUCTION
    // time, so two separately-constructed transports would mint two different chat ids and
    // trivially fail to match on that alone, masking whether withPartIds itself changed anything.
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const direct = await collect(transport.stream('hi'))
    const wrapped = await collect(withPartIds('unrelated-run-id', transport.stream('hi')))

    expect(wrapped.map(withoutDurationMs)).toEqual(direct.map(withoutDurationMs))
    // Every part already had an id — withPartIds' counter never had anything id-less to stamp.
    expect(direct.every((part) => typeof (part as { id: string }).id === 'string')).toBe(true)
  })

  test('diffs reasoning deltas the same way as text, with the same id/offset mechanism', async () => {
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

    const reasoningParts = parts.filter((p) => p.type === 'reasoning') as {
      id: string
      text: string
      offset: number
    }[]
    expect(reasoningParts.map((p) => p.text)).toEqual(['thinking ', 'more'])
    expect(reasoningParts.map((p) => p.offset)).toEqual([0, 9])
    expect(new Set(reasoningParts.map((p) => p.id)).size).toBe(1)
  })

  test('emits a source part exactly once for a source-url chunk, with a deterministic id', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'source-url', sourceId: 's1', url: 'https://example.com', title: 'Example' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const sourceParts = parts.filter((p) => p.type === 'source')
    expect(sourceParts).toHaveLength(1)
    expect(sourceParts[0]).toMatchObject({
      type: 'source',
      url: 'https://example.com',
      title: 'Example',
    })
    expect(typeof (sourceParts[0] as { id: string }).id).toBe('string')
  })

  test('a tool call progresses input-streaming → input-available → output-available, one draft per state, addressed by tool#<toolCallId>', async () => {
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
    expect(toolParts.every((p) => (p as { id: string }).id === 'tool#call-1')).toBe(true)
    expect(toolParts.map(withoutDurationMs)).toEqual([
      {
        id: 'tool#call-1',
        type: 'tool',
        state: 'input-streaming',
        toolName: 'search',
        toolCallId: 'call-1',
      },
      {
        id: 'tool#call-1',
        type: 'tool',
        state: 'input-available',
        toolName: 'search',
        toolCallId: 'call-1',
        input: { q: 'x' },
      },
      {
        id: 'tool#call-1',
        type: 'tool',
        state: 'output-available',
        toolName: 'search',
        toolCallId: 'call-1',
        input: { q: 'x' },
        output: { hits: 3 },
      },
    ])
    // durationMs is only set once the call reaches a terminal state (output-available here).
    expect((toolParts[0] as { durationMs?: number }).durationMs).toBeUndefined()
    expect(typeof (toolParts.at(-1) as { durationMs?: number }).durationMs).toBe('number')
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
    // input-streaming once, input-available once (redundant resend deduped), output-available
    // once — three states, not four.
    expect(toolParts).toHaveLength(3)
  })

  test('a preliminary output-available result emits EVERY refinement, not just the first (bug: state-equality alone would freeze on the first snapshot)', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'search' },
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
      {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { hits: 1 },
        preliminary: true,
      },
      {
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: { hits: 5 },
        preliminary: true,
      },
      { type: 'tool-output-available', toolCallId: 'call-1', output: { hits: 5, done: true } },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const outputs = parts
      .filter((p) => p.type === 'tool' && p.state === 'output-available')
      .map((p) => (p as { output: unknown; preliminary?: boolean }).output)
    // All THREE refinements surfaced — a naive `prev.state === curr.state` dedup would have
    // dropped the second and third (state stays 'output-available' throughout).
    expect(outputs).toEqual([{ hits: 1 }, { hits: 5 }, { hits: 5, done: true }])
  })

  test('approval-requested → approval-responded carries the nested approval envelope through verbatim (isAutomatic and signature survive)', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'delete-file' },
      {
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'delete-file',
        input: { path: '/x' },
      },
      {
        type: 'tool-approval-request',
        approvalId: 'appr-1',
        toolCallId: 'call-1',
        isAutomatic: true,
        signature: 'sig-xyz',
      },
      {
        type: 'tool-approval-response',
        approvalId: 'appr-1',
        approved: true,
        reason: 'looks safe',
      },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const toolParts = parts.filter((p) => p.type === 'tool') as {
      state: string
      approval?: {
        id: string
        approved?: boolean
        reason?: string
        isAutomatic?: boolean
        signature?: string
      }
    }[]

    const requested = toolParts.find((p) => p.state === 'approval-requested')
    // signature only exists on the SDK's approval-requested envelope — this pins that OUR diffing
    // does not drop it (a flattened `approvalId`/`approved` shape, the spec's own error, would).
    expect(requested?.approval).toEqual({ id: 'appr-1', isAutomatic: true, signature: 'sig-xyz' })

    const responded = toolParts.find((p) => p.state === 'approval-responded')
    // AI SDK's OWN runtime carries `isAutomatic` forward into approval-responded but drops
    // `signature` there (verified against dist/index.js) — this is the SDK's behavior, not a bug
    // in this diffing layer; what this pins is that basalt passes whatever the SDK gives it
    // through unflattened, not that basalt itself re-adds a dropped field.
    expect(responded?.approval).toEqual({
      id: 'appr-1',
      approved: true,
      reason: 'looks safe',
      isAutomatic: true,
    })
  })

  test('output-denied is unambiguously terminal — no output, no errorText, just the explicit state + a settled durationMs', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-2', toolName: 'delete-file' },
      {
        type: 'tool-input-available',
        toolCallId: 'call-2',
        toolName: 'delete-file',
        input: { path: '/etc' },
      },
      { type: 'tool-approval-request', approvalId: 'appr-2', toolCallId: 'call-2' },
      { type: 'tool-approval-response', approvalId: 'appr-2', approved: false, reason: 'blocked' },
      { type: 'tool-output-denied', toolCallId: 'call-2' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const toolParts = parts.filter((p) => p.type === 'tool')
    const denied = toolParts.at(-1) as {
      state: string
      output?: unknown
      errorText?: unknown
      input: unknown
      approval?: unknown
      durationMs?: number
    }
    expect(denied.state).toBe('output-denied')
    expect('output' in denied).toBe(false)
    expect('errorText' in denied).toBe(false)
    expect(denied.input).toEqual({ path: '/etc' })
    expect(denied.approval).toEqual({ id: 'appr-2', approved: false, reason: 'blocked' })
    expect(typeof denied.durationMs).toBe('number')
  })

  // ToolCallPart's `output-error` state carries a dedicated `errorText` field (the SDK's own field
  // name — there is no field named `error` anywhere in the union). Stuffing the failure into
  // `output` is gone: `output-error` doesn't even have an `output` field to smuggle it through.
  test('output-error surfaces a dedicated `errorText` field, not `output`, with input carried forward', async () => {
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
    expect(withoutDurationMs(failed as { durationMs?: number })).toEqual({
      id: 'tool#call-1',
      type: 'tool',
      state: 'output-error',
      toolName: 'search',
      toolCallId: 'call-1',
      input: { q: 'x' },
      errorText: 'boom',
    })
    expect('output' in (failed as object)).toBe(false)
  })

  test('a dynamic tool call yields its REAL toolName, not the literal "dynamic-tool"', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'tool-input-start', toolCallId: 'call-4', toolName: 'custom-lookup', dynamic: true },
      {
        type: 'tool-input-available',
        toolCallId: 'call-4',
        toolName: 'custom-lookup',
        input: { id: 7 },
        dynamic: true,
      },
      { type: 'tool-output-available', toolCallId: 'call-4', output: { found: true } },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    })
    const parts = await collect(transport.stream('hi'))

    const toolParts = parts.filter((p) => p.type === 'tool') as { toolName: string; id: string }[]
    expect(toolParts.length).toBeGreaterThan(0)
    expect(toolParts.every((p) => p.toolName === 'custom-lookup')).toBe(true)
    expect(toolParts.every((p) => p.id === 'tool#call-4')).toBe(true)
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
    expect(firstDelta.value).toMatchObject({ type: 'text', text: 'a', offset: 0 })

    // Let AI SDK's background readUIMessageStream pump (kicked off inside diffChunkStream, and
    // NOT gated on our own reads) fully settle before aborting — this is inherent to the library,
    // not to the AgentTransport code under test: aborting while chunks are still in flight through
    // that pump races diffChunkStream's early return against the pump's own stream teardown. A
    // short real-time wait avoids exercising that unrelated race so this test isolates exactly
    // ai-sdk-transport.ts's `if (signal?.aborted) return`.
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

  test('.forThread(id) binds the StartPart runId/resumeToken/id deterministically to the given id', async () => {
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
      id: 'caller-supplied-thread-id#start',
      type: 'start',
      runId: 'caller-supplied-thread-id',
      resumeToken: 'caller-supplied-thread-id',
    })
    // Same across repeated turns on the same bound transport — the id is NOT re-minted per call.
    expect(second.value).toEqual(first.value)
  })

  test('two different .forThread() ids produce two different StartPart runIds/ids', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: () => {
        throw new Error('must not be called — only the first, pre-network yield is read')
      },
    })

    const a = await transport.forThread('thread-a').stream('hi').next()
    const b = await transport.forThread('thread-b').stream('hi').next()

    expect(a.value).toEqual({
      id: 'thread-a#start',
      type: 'start',
      runId: 'thread-a',
      resumeToken: 'thread-a',
    })
    expect(b.value).toEqual({
      id: 'thread-b#start',
      type: 'start',
      runId: 'thread-b',
      resumeToken: 'thread-b',
    })
  })
})

describe('aiSdkTransport — deterministic ids and replay idempotency', () => {
  test('the same snapshot sequence produces the same ids twice', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hello' },
      { type: 'text-end', id: 't1' },
      { type: 'tool-input-start', toolCallId: 'call-1', toolName: 'search' },
      { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'search', input: { q: 'x' } },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    }).forThread('thread-x')

    const firstIds = (await collect(transport.stream('hi'))).map((p) => (p as { id: string }).id)
    const secondIds = (await collect(transport.stream('hi'))).map((p) => (p as { id: string }).id)

    expect(secondIds).toEqual(firstIds)
    expect(firstIds).toEqual(['thread-x#start', 'thread-x#0', 'tool#call-1', 'tool#call-1'])
  })

  test('replaying the identical delta sequence through mergePart converges — it does not double the parts array (the defect this lane exists to make impossible)', async () => {
    const chunks: UIMessageChunk[] = [
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hel' },
      { type: 'text-delta', id: 't1', delta: 'lo' },
      { type: 'text-end', id: 't1' },
    ]
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: async () => scriptedResponse(chunks),
    }).forThread('thread-x')

    const firstPass = await collect(transport.stream('hi'))
    let parts: AgentPart[] = []
    for (const part of firstPass) parts = mergePart(parts, part)
    const afterFirstPass = parts
    expect(afterFirstPass).toHaveLength(2) // start + one merged text part

    // Simulate a resume()/replay that re-diffs the SAME chunk sequence from scratch (a fresh
    // diffChunkStream call starts `prev = undefined` again, so the first snapshot it sees carries
    // the FULL accumulated text at offset 0 — exactly what a real reconnectToStream reconnect
    // looks like). Same bound transport (same chatId) ⇒ identical ids.
    const secondPass = await collect(transport.stream('hi'))
    for (const part of secondPass) parts = mergePart(parts, part)

    expect(parts).toEqual(afterFirstPass)
    expect(parts).toHaveLength(2)
    const merged = parts.find((p) => p.type === 'text') as { text: string }
    expect(merged.text).toBe('Hello')

    // What this guards against: naive array-append accumulation (`[...prev, part]`, this lane's
    // predecessor) would have appended the second pass's deltas onto the first pass's, doubling
    // (and garbling) the rendered text instead of converging.
    const naiveAppendTextParts = [...firstPass, ...secondPass].filter((p) => p.type === 'text')
    expect(naiveAppendTextParts.length).toBeGreaterThan(
      parts.filter((p) => p.type === 'text').length,
    )
  })
})
