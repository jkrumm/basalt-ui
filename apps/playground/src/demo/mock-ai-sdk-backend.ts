/**
 * mock-ai-sdk-backend — an in-memory microcosm of a REAL resumable AI-SDK backend, keyed by chat
 * id, injected as `aiSdkTransport`'s `fetch` option (no real network, no dev-server route).
 *
 * The shape mirrors a real resumable-stream architecture:
 *   - a durable, append-only PER-CHAT-ID chunk buffer (`chunks: UIMessageChunk[]`) — Postgres/Redis
 *     in a real backend, an in-memory Map here, but the property that matters is the same: it is
 *     NOT tied to any particular open HTTP response.
 *   - a DETACHED generation function that keeps appending to that buffer over time, entirely
 *     independent of whether a client is currently connected to read it (decoupled generation —
 *     the property this whole demo exists to prove).
 *   - a "connect to this chat id's buffer" operation, used identically by a fresh POST (drain from
 *     the start, live-follow) and a reconnect GET (same: drain from the start, live-follow) — see
 *     the correction note below for why both start from index 0.
 *
 * CORRECTION FROM THE ORIGINAL BRIEF: a reconnect does NOT start "from the buffer's current
 * length." Verified against the shipped `ai@7.0.15` `HttpChatTransport`: `reconnectToStream` has no
 * `startIndex`/offset parameter, and this codebase's `aiSdkTransport.resume()` does not seed
 * `readUIMessageStream`'s `message` option with prior state (see ai-sdk-transport.ts) — its diff
 * loop always begins from `prev = undefined`. A real reload has no client-side partial message
 * either. So the ONLY way the client can reconstruct the full assistant message after a reload is
 * for the server to replay the ENTIRE buffered chunk history from index 0, then continue live —
 * exactly what a real resumable-stream backend does for a client with no prior state.
 *
 * NETWORK-DROP SIMULATION: once N chunks have been delivered to the chat's current live stream,
 * that stream is silently ABANDONED — never `close()`d or `error()`d. A clean close/error would
 * finalize the thread's status (to 'done'/'error') and clear its resumeToken before the user even
 * reloads, making the mount-time reconciliation path unreachable — defeating the point of this
 * demo. A raw hang is also the more realistic model of an actual dropped connection (most network
 * failures are silent, not a clean protocol-level error). The buffer keeps growing regardless.
 */
import type { UIMessageChunk } from 'ai'

// ── The mock API surface ─────────────────────────────────────────────────────

/** The (fake) endpoint aiSdkTransport POSTs new turns to; reconnects hit `${MOCK_API_PATH}/:chatId/stream`. */
export const MOCK_API_PATH = '/mock/ai-sdk-chat'

// ── Per-chat durable chunk buffer ─────────────────────────────────────────────

type ChatBuffer = {
  chunks: UIMessageChunk[]
  done: boolean
  listeners: Set<(chunk: UIMessageChunk) => void>
  doneListeners: Set<() => void>
}

const buffers = new Map<string, ChatBuffer>()

function getOrCreateBuffer(chatId: string): ChatBuffer {
  const existing = buffers.get(chatId)
  if (existing !== undefined) return existing
  const created: ChatBuffer = {
    chunks: [],
    done: false,
    listeners: new Set(),
    doneListeners: new Set(),
  }
  buffers.set(chatId, created)
  return created
}

function pushChunk(buf: ChatBuffer, chunk: UIMessageChunk): void {
  buf.chunks.push(chunk)
  buf.listeners.forEach((listener) => listener(chunk))
}

function markDone(buf: ChatBuffer): void {
  buf.done = true
  buf.doneListeners.forEach((listener) => listener())
  buf.doneListeners.clear()
}

/** Read-only snapshot for the debug panel — proves the buffer keeps growing after a drop. */
export function getBufferSnapshot(
  chatId: string,
): { chunkCount: number; done: boolean } | undefined {
  const buf = buffers.get(chatId)
  return buf === undefined ? undefined : { chunkCount: buf.chunks.length, done: buf.done }
}

// ── Network-drop simulation ───────────────────────────────────────────────────

// ~40% into the full ~80-chunk sequence for this demo's fixed scenario — lands mid-way through the
// final answer paragraph, well after the intro/tool-call/source chunks have already rendered, so
// the interruption is visually obvious (a paragraph stops mid-sentence) rather than instant.
const DROP_AFTER_CHUNKS = 32

type DropState = { armed: boolean }
const dropStates = new Map<string, DropState>()

function armDrop(chatId: string): void {
  dropStates.set(chatId, { armed: true })
}

/** Consumes the drop-arm for `chatId` the moment it fires — a chat drops at most once. */
function shouldDropNow(chatId: string, deliveredCount: number): boolean {
  const state = dropStates.get(chatId)
  if (state === undefined || !state.armed || deliveredCount < DROP_AFTER_CHUNKS) return false
  state.armed = false
  return true
}

// ── Detached generation ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const DELTA_DELAY = 26

/** Splits text into word-sized deltas (keeping whitespace attached) — a real token-by-token feed. */
function textDeltas(text: string): string[] {
  const pieces = text.match(/\S+\s*/g) ?? [text]
  const out: string[] = []
  for (let i = 0; i < pieces.length; i += 2) {
    out.push(pieces.slice(i, i + 2).join(''))
  }
  return out
}

const ANSWER_TEXT =
  `Based on what the docs say, the client never needs to replay history manually — a resumable ` +
  `backend keeps one durable, append-only log per chat id, and reconnecting is just "attach and ` +
  `replay from the start." That single property is what makes a browser reload recoverable: the ` +
  `generation itself never depended on any particular open connection, so a dropped tab is just a ` +
  `missed delivery, not a lost turn.\n\n` +
  `A few things worth remembering:\n\n` +
  `- The buffer is the source of truth, not the live HTTP response.\n` +
  `- A resumed client has no partial state, so replay must start from the very first chunk.\n` +
  `- Only the FIRST live connection for a turn is ever interrupted in this demo — the resumed one ` +
  `always runs to completion.\n`

/**
 * Kicks off a DETACHED generation for one turn — appends chunks to `chatId`'s buffer over time.
 * Not awaited by callers: the buffer keeps growing whether or not any client is still listening.
 */
async function runGeneration(chatId: string, input: string): Promise<void> {
  const buf = getOrCreateBuffer(chatId)
  const introId = crypto.randomUUID()
  const toolCallId = crypto.randomUUID()
  const answerId = crypto.randomUUID()

  pushChunk(buf, { type: 'start' })
  pushChunk(buf, { type: 'start-step' })

  pushChunk(buf, { type: 'text-start', id: introId })
  for (const delta of textDeltas(
    `Looking into "${input}" — checking the docs before answering.\n\n`,
  )) {
    await sleep(DELTA_DELAY)
    pushChunk(buf, { type: 'text-delta', id: introId, delta })
  }
  pushChunk(buf, { type: 'text-end', id: introId })

  await sleep(DELTA_DELAY * 3)
  pushChunk(buf, {
    type: 'tool-input-available',
    toolCallId,
    toolName: 'search_docs',
    input: { query: input, limit: 3 },
  })
  await sleep(DELTA_DELAY * 5)
  pushChunk(buf, {
    type: 'tool-output-available',
    toolCallId,
    output: { hits: [{ id: 'stream-resumption', score: 0.95 }] },
  })

  await sleep(DELTA_DELAY * 2)
  pushChunk(buf, {
    type: 'source-url',
    sourceId: crypto.randomUUID(),
    url: 'https://basalt-ui.com/docs/agent/resumption',
    title: 'Stream resumption doctrine',
  })

  pushChunk(buf, { type: 'text-start', id: answerId })
  for (const delta of textDeltas(ANSWER_TEXT)) {
    await sleep(DELTA_DELAY)
    pushChunk(buf, { type: 'text-delta', id: answerId, delta })
  }
  pushChunk(buf, { type: 'text-end', id: answerId })

  pushChunk(buf, { type: 'finish-step' })
  pushChunk(buf, { type: 'finish' })
  markDone(buf)
}

// ── SSE wire framing ──────────────────────────────────────────────────────────

const SSE_HEADERS: Record<string, string> = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no',
}

const sseEncoder = new TextEncoder()

function sseBytes(chunk: UIMessageChunk): Uint8Array {
  return sseEncoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
}

/**
 * Connects a fresh ReadableStream to `chatId`'s buffer: drains everything buffered so far (from
 * the very start — see the correction note at the top of this file), then live-follows new pushes
 * until generation finishes. Used identically for a fresh POST and a reconnect GET.
 *
 * Applies the network-drop simulation: once DROP_AFTER_CHUNKS chunks have passed through, this
 * stream is abandoned (listeners removed, controller left open forever — never closed or errored).
 */
function connectSseStream(chatId: string): ReadableStream<Uint8Array> {
  const buf = getOrCreateBuffer(chatId)
  let delivered = 0
  let onChunk: ((chunk: UIMessageChunk) => void) | undefined
  let onDone: (() => void) | undefined

  function cleanup(): void {
    if (onChunk !== undefined) buf.listeners.delete(onChunk)
    if (onDone !== undefined) buf.doneListeners.delete(onDone)
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      /** Delivers one chunk; returns true when the drop simulation just abandoned the stream. */
      function deliver(chunk: UIMessageChunk): boolean {
        controller.enqueue(sseBytes(chunk))
        delivered += 1
        if (shouldDropNow(chatId, delivered)) {
          cleanup()
          return true
        }
        return false
      }

      for (const chunk of buf.chunks) {
        if (deliver(chunk)) return
      }
      if (buf.done) {
        controller.close()
        return
      }

      onChunk = (chunk) => {
        deliver(chunk)
      }
      onDone = () => {
        controller.close()
        cleanup()
      }
      buf.listeners.add(onChunk)
      buf.doneListeners.add(onDone)
    },
    cancel() {
      cleanup()
    },
  })
}

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { status: 200, headers: SSE_HEADERS })
}

// ── The injectable fetch ──────────────────────────────────────────────────────

type SendMessagesBody = {
  readonly id: string
  readonly messages: ReadonlyArray<{
    readonly parts: ReadonlyArray<{ type: string; text?: string }>
  }>
}

function requestPath(input: RequestInfo | URL): string {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(raw, window.location.origin).pathname
}

function textOfLastMessage(body: SendMessagesBody): string {
  const lastMessage = body.messages.at(-1)
  if (lastMessage === undefined) return ''
  return lastMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
}

/**
 * Builds the mock `fetch` implementation to pass as `aiSdkTransport({ fetch: ... })`. Scoped
 * entirely to `MOCK_API_PATH` — never touches global `fetch` or any real network.
 */
export function createMockAiSdkFetch(): typeof fetch {
  return async function mockAiSdkFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const method = init?.method ?? 'GET'
    const path = requestPath(input)

    if (method === 'POST' && path === MOCK_API_PATH) {
      const body = JSON.parse(String(init?.body ?? '{}')) as SendMessagesBody
      armDrop(body.id)
      void runGeneration(body.id, textOfLastMessage(body))
      return sseResponse(connectSseStream(body.id))
    }

    if (method === 'GET' && path.startsWith(`${MOCK_API_PATH}/`) && path.endsWith('/stream')) {
      const chatId = path.slice(MOCK_API_PATH.length + 1, -'/stream'.length)
      if (!buffers.has(chatId)) {
        // No known buffer for this chat id — nothing to resume (matches the real API's 204 contract).
        return new Response(null, { status: 204 })
      }
      return sseResponse(connectSseStream(chatId))
    }

    throw new Error(`mock-ai-sdk-backend: unhandled request ${method} ${path}`)
  }
}
