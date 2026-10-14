/**
 * aiSdkTransport — failure surfaces (V2-SPEC § 6): an HTTP status, a mid-stream `error` chunk and a
 * malformed chunk all REJECT the stream (they used to end it as if the turn had completed), and
 * `toAgentError` maps each onto the closed `AgentError` union. Also pins the `{ transport }` form:
 * any `ChatTransport<UIMessage>` is used as-is.
 */
import { describe, expect, test } from 'bun:test'
import { JsonToSseTransformStream } from 'ai'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import { aiSdkTransport } from './ai-sdk-transport'
import { toAgentError } from './error'
import type { AgentPart } from './parts'

function sseResponse(chunks: unknown[], status = 200): Response {
  const source = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk as UIMessageChunk)
      controller.close()
    },
  })
  const body = source
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TextEncoderStream())
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } })
}

const asFetch = (impl: () => Promise<Response>): typeof fetch => impl as unknown as typeof fetch

async function failureOf(gen: AsyncGenerator<AgentPart>): Promise<unknown> {
  try {
    for await (const part of gen) void part
  } catch (error) {
    return error
  }
  throw new Error('expected the stream to reject')
}

describe('aiSdkTransport — failures reach the consumer', () => {
  test('a non-2xx response rejects with the status, mapped to kind "http"', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: asFetch(async () => new Response('nope', { status: 503 })),
    })
    const error = await failureOf(transport.stream('hi'))
    expect(toAgentError(error)).toEqual({ kind: 'http', status: 503 })
  })

  test('an `error` chunk rejects mid-stream, mapped to kind "server" with the errorText', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: asFetch(async () =>
        sseResponse([
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'par' },
          { type: 'error', errorText: 'model overloaded' },
        ]),
      ),
    })
    const seen: AgentPart[] = []
    const gen = transport.stream('hi')
    let error: unknown
    try {
      for await (const part of gen) seen.push(part)
    } catch (caught) {
      error = caught
    }
    expect(toAgentError(error)).toEqual({ kind: 'server', message: 'model overloaded' })
    // The parts that arrived before the failure were still delivered.
    expect(seen.some((p) => p.type === 'text')).toBe(true)
  })

  test('a chunk for an unopened part rejects, mapped to kind "stream" with chunkType and chunkId', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      fetch: asFetch(async () => sseResponse([{ type: 'text-delta', id: 'ghost', delta: 'x' }])),
    })
    const error = await failureOf(transport.stream('hi'))
    expect(toAgentError(error)).toEqual({
      kind: 'stream',
      chunkType: 'text-delta',
      chunkId: 'ghost',
    })
  })
})

describe('aiSdkTransport — { transport } form', () => {
  function fakeChatTransport(chunks: unknown[]): {
    transport: ChatTransport<UIMessage>
    sent: Array<Parameters<ChatTransport<UIMessage>['sendMessages']>[0]>
    reconnects: string[]
  } {
    const sent: Array<Parameters<ChatTransport<UIMessage>['sendMessages']>[0]> = []
    const reconnects: string[] = []
    const stream = (): ReadableStream<UIMessageChunk> =>
      new ReadableStream<UIMessageChunk>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk as UIMessageChunk)
          controller.close()
        },
      })
    return {
      sent,
      reconnects,
      transport: {
        async sendMessages(options) {
          sent.push(options)
          return stream()
        },
        async reconnectToStream(options) {
          reconnects.push(options.chatId)
          return stream()
        },
      },
    }
  }

  const textChunks = [
    { type: 'text-start', id: 't1' },
    { type: 'text-delta', id: 't1', delta: 'ok' },
    { type: 'text-end', id: 't1' },
  ]

  test('stream() sends through the given transport, bound to the thread id and message id', async () => {
    const fake = fakeChatTransport(textChunks)
    const transport = aiSdkTransport({ transport: fake.transport }).forThread('thread-1')
    const parts: AgentPart[] = []
    for await (const part of transport.stream('hello', undefined, { messageId: 'm-1' })) {
      parts.push(part)
    }
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0]).toMatchObject({
      chatId: 'thread-1',
      trigger: 'submit-message',
      messages: [{ id: 'm-1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
    })
    expect(parts.filter((p) => p.type === 'text').map((p) => (p as { text: string }).text)).toEqual(
      ['ok'],
    )
  })

  test('resume() reconnects through the given transport with the resume token as chat id', async () => {
    const fake = fakeChatTransport(textChunks)
    const transport = aiSdkTransport({ transport: fake.transport })
    const parts: AgentPart[] = []
    for await (const part of transport.resume('tok-9')) parts.push(part)
    expect(fake.reconnects).toEqual(['tok-9'])
    expect(parts.some((p) => p.type === 'text')).toBe(true)
  })

  test('the caller AbortSignal reaches sendMessages and reconnectToStream as abortSignal', async () => {
    const signals: Array<AbortSignal | undefined> = []
    const pending = (): ReadableStream<UIMessageChunk> => new ReadableStream<UIMessageChunk>({})
    const transport = aiSdkTransport({
      transport: {
        async sendMessages(options) {
          signals.push(options.abortSignal)
          return pending()
        },
        async reconnectToStream(options) {
          signals.push(options.abortSignal)
          return pending()
        },
      },
    })
    const controller = new AbortController()
    const send = transport.stream('hi', controller.signal)
    await send.next() // start part
    void send.next().catch(() => {})
    const resume = transport.resume('tok', controller.signal)
    void resume.next().catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(signals).toHaveLength(2)
    expect(signals.every((signal) => signal === controller.signal)).toBe(true)
  })

  test('`transport: undefined` falls back to the HTTP form', async () => {
    const transport = aiSdkTransport({
      api: '/api/chat',
      transport: undefined,
      fetch: asFetch(async () => new Response('nope', { status: 500 })),
    })
    expect(toAgentError(await failureOf(transport.stream('hi')))).toEqual({
      kind: 'http',
      status: 500,
    })
  })

  test('a custom transport that rejects surfaces its error unchanged', async () => {
    const boom = Object.assign(new Error('socket closed'), { statusCode: 502 })
    const transport = aiSdkTransport({
      transport: {
        async sendMessages() {
          throw boom
        },
        async reconnectToStream() {
          return null
        },
      },
    })
    const error = await failureOf(transport.stream('hi'))
    expect(error).toBe(boom)
    expect(toAgentError(error)).toEqual({ kind: 'http', status: 502 })
  })
})

describe('toAgentError', () => {
  test('an AbortError is "aborted" — including a DOMException, which is not an Error', () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(toAgentError(abort)).toEqual({ kind: 'aborted' })
    // A browser's DOMException is not an Error in every engine; model it as a bare named object.
    expect(toAgentError({ name: 'AbortError', message: 'The operation was aborted.' })).toEqual({
      kind: 'aborted',
    })
    expect(toAgentError(new DOMException('The operation was aborted.', 'AbortError'))).toEqual({
      kind: 'aborted',
    })
  })

  test('anything else is "server" with its message', () => {
    expect(toAgentError(new TypeError('Failed to fetch'))).toEqual({
      kind: 'server',
      message: 'Failed to fetch',
    })
    expect(toAgentError({ message: 'plain object' })).toEqual({
      kind: 'server',
      message: 'plain object',
    })
  })

  test('non-object throws are stringified', () => {
    expect(toAgentError('plain')).toEqual({ kind: 'server', message: 'plain' })
    expect(toAgentError(null)).toEqual({ kind: 'server', message: 'null' })
    expect(toAgentError(undefined)).toEqual({ kind: 'server', message: 'undefined' })
    expect(toAgentError(42)).toEqual({ kind: 'server', message: '42' })
  })

  test('a non-numeric statusCode or a half-formed stream error does not match http / stream', () => {
    expect(toAgentError(Object.assign(new Error('x'), { statusCode: '503' }))).toEqual({
      kind: 'server',
      message: 'x',
    })
    expect(toAgentError(Object.assign(new Error('y'), { chunkType: 'text-delta' }))).toEqual({
      kind: 'server',
      message: 'y',
    })
  })

  test('statusCode wins over a stream-shaped error', () => {
    const both = Object.assign(new Error('z'), { statusCode: 500, chunkType: 't', chunkId: 'i' })
    expect(toAgentError(both)).toEqual({ kind: 'http', status: 500 })
  })
})
