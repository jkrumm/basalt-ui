/**
 * aiSdkTransport — an AgentTransport backed by Vercel AI SDK's native streaming + resumption
 * primitives (the `ai` npm package). This is the RECOMMENDED DEFAULT transport for LLM chat use
 * cases — edenTransport remains the zero-extra-dependency alternative (see agent/rules/basalt-agent.md).
 *
 * OPTIONAL PEER: `ai` is not a required dependency. Importing 'basalt-ui/agent' (and calling this
 * factory) does NOT eagerly resolve it — the package is loaded via a memoized dynamic import()
 * only when the first stream()/resume() call actually runs, mirroring the lazy-optional-peer
 * contract used by StreamingMarkdown/BasaltStickToBottom. Unlike those, there is no meaningful
 * "plain text" fallback for a missing transport: if 'ai' is not installed, the dynamic import
 * rejects and the error propagates through the async generator to the consumer's EXISTING error
 * handling (useAgentStream sets status: 'error'; useAgentThreadRuns falls back to its
 * onFailureStatus) — no separate crash path is introduced.
 *
 * Install the optional peer:
 *   bun add ai
 *
 * WHY DIFFING IS NEEDED: AI SDK's `readUIMessageStream` yields the FULL accumulated `UIMessage`
 * snapshot (a growing `parts` array, with existing parts' content growing in place) on every
 * update — it is not itself a delta stream. basalt-ui's whole part-accumulation model
 * (useAgentStream / useAgentThreadRuns, and every consumer's own coalescing) is delta-based: many
 * small parts merged at render time. This module diffs consecutive snapshots and yields only the
 * new deltas as AgentParts, so nothing is double-rendered.
 *
 * CHAT ID BINDING: AI SDK's convention is that the chat id is known client-side before the
 * request (unlike a river/server-minted id) — `aiSdkTransport(options)` mints ONE stable chat id
 * at construction time, so the returned object is immediately usable with useAgentStream (a single
 * ongoing conversation). `.forThread(threadId)` returns a transport bound to an arbitrary
 * caller-supplied id instead — pass a basalt-ui thread id here to plug into
 * useAgentThreadRuns's per-thread transport-factory form, so a thread's turns (and its mount-time
 * resume) share one continuous AI SDK chat session:
 *
 * @example
 * import { useAgentStream, aiSdkTransport } from 'basalt-ui/agent'
 *
 * const transport = aiSdkTransport({ api: '/api/chat' })
 * const { parts, status, send } = useAgentStream({ transport })
 *
 * @example
 * import { useAgentThreadRuns, aiSdkTransport, createThreadsStore, heuristicOutcome } from 'basalt-ui/agent'
 *
 * const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })
 * const transport = aiSdkTransport({ api: '/api/chat' })
 * const { runs, start } = useAgentThreadRuns({
 *   transport: (threadId) => transport.forThread(threadId),
 *   store: useThreads(),
 *   resolveOutcome: heuristicOutcome,
 * })
 */
import type { AgentPart, SourcePart, ToolCallPart } from './parts'
import type { AgentTransport } from './transport'

// ── ai (optional peer) — TYPE-ONLY imports, erased at runtime ────────────────
// verbatimModuleSyntax-safe: these never trigger a runtime resolution of 'ai'. The actual runtime
// access goes through the memoized `import('ai')` inside resolveAiSdk() below.
import type { DefaultChatTransport, UIMessage, UIMessageChunk, readUIMessageStream } from 'ai'

/** The element type of an AI SDK UIMessage's `parts` array (defaults applied). */
type AiPart = UIMessage['parts'][number]

// ── AiSdkTransportOptions ─────────────────────────────────────────────────────

export type AiSdkTransportOptions = {
  /** The API URL AI SDK's transport POSTs new turns to and GETs reconnects from. */
  readonly api: string
  /** HTTP headers to send with every request. */
  readonly headers?: Record<string, string> | Headers
  /** The fetch credentials mode. Defaults to 'same-origin' (AI SDK's own default). */
  readonly credentials?: RequestCredentials
  /**
   * Custom fetch implementation — e.g. to scope requests to a mock backend in tests/playground,
   * or to add middleware. Defaults to the ambient `fetch` when omitted.
   */
  readonly fetch?: typeof globalThis.fetch
}

// ── AiSdkTransport ─────────────────────────────────────────────────────────────

export type AiSdkTransport<TPart = AgentPart> = AgentTransport<TPart, string> & {
  /**
   * Returns an AgentTransport bound to a stable chat id (e.g. a basalt-ui thread id) instead of
   * this transport's own fixed one. Use this for useAgentThreadRuns's per-thread transport-factory
   * form so each thread's turns share one continuous AI SDK chat session.
   */
  readonly forThread: (chatId: string) => AgentTransport<TPart, string>
}

// ── Lazy, memoized 'ai' resolution ────────────────────────────────────────────

/** Everything resolved from the dynamically-imported 'ai' module, memoized per aiSdkTransport() call. */
type ResolvedAiSdk = {
  readonly httpTransport: DefaultChatTransport<UIMessage>
  readonly readUIMessageStream: typeof readUIMessageStream
}

/**
 * Builds the lazy resolver for one aiSdkTransport() call: the dynamic import() AND the constructed
 * DefaultChatTransport are memoized here (module-stable per call, not per stream()/resume() call),
 * so repeated turns across any chat id reuse the same underlying HTTP transport.
 */
function createAiSdkResolver(options: AiSdkTransportOptions): () => Promise<ResolvedAiSdk> {
  let resolved: Promise<ResolvedAiSdk> | undefined
  return function resolveAiSdk(): Promise<ResolvedAiSdk> {
    resolved ??= import('ai').then(
      ({ DefaultChatTransport: DefaultChatTransportCtor, readUIMessageStream: read }) => ({
        httpTransport: new DefaultChatTransportCtor<UIMessage>({
          api: options.api,
          ...(options.headers !== undefined ? { headers: options.headers } : {}),
          ...(options.credentials !== undefined ? { credentials: options.credentials } : {}),
          ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
        }),
        readUIMessageStream: read,
      }),
    )
    return resolved
  }
}

// ── Snapshot diffing: UIMessage → AgentPart deltas ────────────────────────────

/**
 * Diffs one AI SDK part (by array index) against its previous snapshot at that same index,
 * returning zero or more new AgentPart deltas.
 *
 * source-document, file, reasoning-file, data-*, step-start, custom, and dynamic-tool parts have
 * no AgentPart equivalent yet — deliberate v1 gap, skipped rather than inventing new variants.
 */
function diffPart(prevPart: AiPart | undefined, currPart: AiPart): AgentPart[] {
  switch (currPart.type) {
    case 'text': {
      const prevText = prevPart?.type === 'text' ? prevPart.text : ''
      const delta = currPart.text.slice(prevText.length)
      return delta.length === 0 ? [] : [{ type: 'text', text: delta }]
    }
    case 'reasoning': {
      const prevText = prevPart?.type === 'reasoning' ? prevPart.text : ''
      const delta = currPart.text.slice(prevText.length)
      return delta.length === 0 ? [] : [{ type: 'reasoning', text: delta }]
    }
    case 'source-url': {
      // Emit once, the first time this part appears at this index.
      if (prevPart !== undefined) return []
      const source: SourcePart = { type: 'source', url: currPart.url }
      return [currPart.title !== undefined ? { ...source, title: currPart.title } : source]
    }
    default:
      return currPart.type.startsWith('tool-') ? diffToolPart(prevPart, currPart) : []
  }
}

/**
 * Minimal structural shape read off a `tool-${name}` UIMessagePart. Cast to this (rather than
 * AI SDK's own generic ToolUIPart<TOOLS>) because we diff by raw `type`/`state` string comparison,
 * not by a caller-supplied tool registry.
 */
type ToolLike = {
  readonly type: string
  readonly toolCallId: string
  readonly state: string
  readonly input?: unknown
  readonly output?: unknown
  readonly errorText?: string
}

function diffToolPart(prevPart: AiPart | undefined, currPart: AiPart): AgentPart[] {
  const curr = currPart as unknown as ToolLike
  // Deliberate v1 simplification: never emit on 'input-streaming' (partial/DeepPartial input) —
  // wait for at least 'input-available' so the consumer isn't flooded with incomplete fragments.
  if (curr.state === 'input-streaming') return []

  const prev =
    prevPart !== undefined && prevPart.type === currPart.type
      ? (prevPart as unknown as ToolLike)
      : undefined
  // Already emitted this exact state for this tool call index — nothing new to report.
  if (prev?.state === curr.state) return []

  const toolName = curr.type.slice('tool-'.length)
  const base: ToolCallPart = {
    type: 'tool',
    toolName,
    toolCallId: curr.toolCallId,
    input: curr.input,
  }
  if (curr.state === 'output-available') return [{ ...base, output: curr.output }]
  // output-error: still surface it as a tool part rather than silently dropping the failure — the
  // error text becomes the output payload since ToolCallPart has no dedicated error field.
  if (curr.state === 'output-error') return [{ ...base, output: { error: curr.errorText } }]
  return [base]
}

/** Diffs every index of one UIMessage snapshot against the previous snapshot. */
function diffMessage(prev: UIMessage | undefined, curr: UIMessage): AgentPart[] {
  const deltas: AgentPart[] = []
  curr.parts.forEach((part, i) => {
    deltas.push(...diffPart(prev?.parts[i], part))
  })
  return deltas
}

/**
 * Reads a raw UIMessageChunk stream through readUIMessageStream and yields only the new deltas
 * between consecutive UIMessage snapshots, cast to TPart (this transport only ever constructs the
 * built-in AgentPart variants, so TPart must be — or be assignable from — AgentPart for a
 * meaningful result; same documented-cast convention as useAgentThreadRuns' defaultToUserParts).
 *
 * `resume()`'s underlying reconnectToStream call has no AbortSignal parameter in the current AI
 * SDK API (unlike sendMessages), so we can't cancel the in-flight fetch directly — checking
 * `signal.aborted` here at least stops yielding further deltas to an aborted caller promptly.
 */
async function* diffChunkStream<TPart>(
  chunkStream: ReadableStream<UIMessageChunk>,
  readStream: typeof readUIMessageStream,
  signal?: AbortSignal,
): AsyncGenerator<TPart> {
  let prev: UIMessage | undefined
  for await (const curr of readStream<UIMessage>({ stream: chunkStream })) {
    if (signal?.aborted) return
    for (const part of diffMessage(prev, curr)) {
      yield part as TPart
    }
    prev = curr
  }
}

// ── aiSdkTransport ─────────────────────────────────────────────────────────────

/**
 * Wraps AI SDK's `DefaultChatTransport` + `readUIMessageStream` into an AgentTransport.
 *
 * The returned object is immediately usable with useAgentStream (one fixed, stable chat id for
 * the whole conversation). Call `.forThread(threadId)` to get a transport bound to a different
 * (caller-supplied) chat id — the per-thread form for useAgentThreadRuns.
 *
 * @example
 * const transport = aiSdkTransport<AgentPart>({ api: '/api/chat' })
 * const { send, parts, status } = useAgentStream({ transport })
 */
export function aiSdkTransport<TPart = AgentPart>(
  options: AiSdkTransportOptions,
): AiSdkTransport<TPart> {
  const resolveAiSdk = createAiSdkResolver(options)

  function makeTransport(chatId: string): AgentTransport<TPart, string> {
    return {
      async *stream(input: string, signal?: AbortSignal): AsyncGenerator<TPart> {
        // Synthesized locally, first — we already know the chat id client-side, so there is no
        // need to wait on the server to hand us a run id (unlike a river-style protocol).
        yield { type: 'start', runId: chatId, resumeToken: chatId } as TPart

        const { httpTransport, readUIMessageStream: readStream } = await resolveAiSdk()
        const userMessage: UIMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: input }],
        }
        const chunkStream = await httpTransport.sendMessages({
          chatId,
          messages: [userMessage],
          trigger: 'submit-message',
          messageId: undefined,
          abortSignal: signal,
        })
        yield* diffChunkStream<TPart>(chunkStream, readStream, signal)
      },
      async *resume(resumeToken: string, signal?: AbortSignal): AsyncGenerator<TPart> {
        const { httpTransport, readUIMessageStream: readStream } = await resolveAiSdk()
        const chunkStream = await httpTransport.reconnectToStream({ chatId: resumeToken })
        if (chunkStream === null) return
        yield* diffChunkStream<TPart>(chunkStream, readStream, signal)
      },
    }
  }

  const fixedChatId = crypto.randomUUID()
  return {
    ...makeTransport(fixedChatId),
    forThread: (chatId: string) => makeTransport(chatId),
  }
}
