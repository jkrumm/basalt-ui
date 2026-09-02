/**
 * aiSdkTransport — an AgentTransport backed by Vercel AI SDK's native streaming + resumption
 * primitives (the `ai` npm package). This is the RECOMMENDED DEFAULT transport for LLM chat use
 * cases — edenTransport remains the zero-extra-dependency alternative (see agent/rules/basalt-agent.md).
 *
 * OPTIONAL PEER: `ai` is not a required dependency. Importing 'basalt-ui/agent' (and calling this
 * factory) does NOT eagerly resolve it — the package is loaded via a memoized dynamic import()
 * only when the first stream()/resume() call actually runs, mirroring the lazy-optional-peer
 * contract used by BasaltStickToBottom. Unlike that, there is no meaningful "plain text" fallback
 * for a missing transport: if 'ai' is not installed, the dynamic import
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
import { assertNever } from '../register'
import { mintMessageId, mintThreadId } from './id'
import { TERMINAL_TOOL_STATES } from './parts'
import type { AgentPart, AgentPartDraft } from './parts'
import type { ResumableAgentTransport } from './transport'

// ── ai (optional peer) — TYPE-ONLY imports, erased at runtime ────────────────
// verbatimModuleSyntax-safe: these never trigger a runtime resolution of 'ai'. The actual runtime
// access goes through the memoized `import('ai')` inside resolveAiSdk() below.
import type {
  DefaultChatTransport,
  DynamicToolUIPart,
  ToolUIPart,
  UIMessage,
  UIMessageChunk,
  readUIMessageStream,
} from 'ai'

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

export type AiSdkTransport<TPart = AgentPart> = ResumableAgentTransport<TPart, string> & {
  /**
   * Returns an AgentTransport bound to a stable chat id (e.g. a basalt-ui thread id) instead of
   * this transport's own fixed one. Use this for useAgentThreadRuns's per-thread transport-factory
   * form so each thread's turns share one continuous AI SDK chat session.
   */
  readonly forThread: (chatId: string) => ResumableAgentTransport<TPart, string>
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
 * returning zero or more new AgentPart drafts, each carrying a deterministic id.
 *
 * Index-addressed parts (text, reasoning, source) get `${chatId}#${index}` — stable across
 * replays of the same snapshot sequence, which is what lets `mergePart` rewrite instead of
 * duplicate on a resumed/replayed stream. text/reasoning also carry an authoritative `offset`
 * (the length of the previously-seen text for that part) so a full-length resend at offset 0
 * splices over the existing content instead of appending — the literal mechanism
 * `idempotentReplay: true` asserts.
 *
 * source-document, file, reasoning-file, data-*, step-start, and custom parts have no AgentPart
 * equivalent yet — deliberate v1 gap, skipped rather than inventing new variants.
 */
function diffPart(
  chatId: string,
  index: number,
  prevPart: AiPart | undefined,
  currPart: AiPart,
  toolStartTimes: Map<string, number>,
): AgentPartDraft[] {
  switch (currPart.type) {
    case 'text': {
      const prevText = prevPart?.type === 'text' ? prevPart.text : ''
      const delta = currPart.text.slice(prevText.length)
      return delta.length === 0
        ? []
        : [{ id: `${chatId}#${index}`, type: 'text', text: delta, offset: prevText.length }]
    }
    case 'reasoning': {
      const prevText = prevPart?.type === 'reasoning' ? prevPart.text : ''
      const delta = currPart.text.slice(prevText.length)
      return delta.length === 0
        ? []
        : [{ id: `${chatId}#${index}`, type: 'reasoning', text: delta, offset: prevText.length }]
    }
    case 'source-url': {
      // Emit once, the first time this part appears at this index.
      if (prevPart !== undefined) return []
      const source: AgentPartDraft = { id: `${chatId}#${index}`, type: 'source', url: currPart.url }
      return [currPart.title !== undefined ? { ...source, title: currPart.title } : source]
    }
    default:
      return isToolLikePart(currPart) ? diffToolPart(prevPart, currPart, toolStartTimes) : []
  }
}

/** True for a `tool-${name}` static part OR a `dynamic-tool` part — the two AI SDK shapes basalt
 * models as one `ToolCallPart`. `'dynamic-tool'` does NOT start with `'tool-'`, so this must be
 * its own check, not a `.startsWith('tool-')` alone (that silently drops every dynamic tool call). */
function isToolLikePart(part: AiPart): part is ToolUIPart | DynamicToolUIPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

/** Derives the tool's display name — mirrors AI SDK's own `getToolName`/`getStaticToolName`
 * runtime (reimplemented locally rather than value-imported, so this module never resolves 'ai'
 * at runtime; see the module docblock). Static tools carry their name only in the `tool-${name}`
 * discriminator; dynamic tools carry it in `toolName`. */
function deriveToolName(part: ToolUIPart | DynamicToolUIPart): string {
  return part.type === 'dynamic-tool' ? part.toolName : part.type.split('-').slice(1).join('-')
}

/** The `{ output, preliminary }` snapshot of an `output-available` tool part, or undefined for
 * any other state. */
function outputSnapshot(
  part: ToolUIPart | DynamicToolUIPart,
): { readonly output: unknown; readonly preliminary: boolean | undefined } | undefined {
  return part.state === 'output-available'
    ? { output: part.output, preliminary: part.preliminary }
    : undefined
}

/**
 * True when `curr` reports nothing new relative to `prev` — same state AND (for output-available)
 * the same output/preliminary content. A `preliminary: true` result streams several
 * output-available snapshots with the SAME `state` but a MUTATING `output`; naive state-equality
 * would freeze on the first snapshot and drop every refinement. Content (not reference) equality:
 * each snapshot from `readUIMessageStream` is a fresh `structuredClone`, so `===` on nested output
 * objects would never match even when genuinely unchanged.
 */
function isSameToolState(
  prev: ToolUIPart | DynamicToolUIPart,
  curr: ToolUIPart | DynamicToolUIPart,
): boolean {
  if (prev.state !== curr.state) return false
  const prevOutput = outputSnapshot(prev)
  const currOutput = outputSnapshot(curr)
  if (prevOutput === undefined || currOutput === undefined) return true
  return (
    JSON.stringify(prevOutput.output) === JSON.stringify(currOutput.output) &&
    prevOutput.preliminary === currOutput.preliminary
  )
}

/**
 * Diffs one tool part across the seven-state `UIToolInvocation` union into a `ToolCallPart` draft,
 * addressed by `tool#${toolCallId}` — stable across every state transition of one call, so
 * `mergePart` rewrites the same part in place rather than stacking one entry per state.
 *
 * `durationMs` is basalt's own field (the SDK doesn't provide one): wall-clock from this
 * toolCallId's first sighting (recorded in `toolStartTimes`, scoped to ONE stream() / resume()
 * call — never module-global, so two concurrent threads never share timings) to a terminal state.
 */
function diffToolPart(
  prevPart: AiPart | undefined,
  currPart: ToolUIPart | DynamicToolUIPart,
  toolStartTimes: Map<string, number>,
): AgentPartDraft[] {
  if (!toolStartTimes.has(currPart.toolCallId)) {
    toolStartTimes.set(currPart.toolCallId, Date.now())
  }

  const prev = prevPart !== undefined && isToolLikePart(prevPart) ? prevPart : undefined
  if (prev !== undefined && isSameToolState(prev, currPart)) return []

  const settled = (TERMINAL_TOOL_STATES as readonly string[]).includes(currPart.state)
  const durationMs = settled
    ? Date.now() - (toolStartTimes.get(currPart.toolCallId) ?? Date.now())
    : undefined

  const base = {
    id: `tool#${currPart.toolCallId}`,
    type: 'tool' as const,
    toolCallId: currPart.toolCallId,
    toolName: deriveToolName(currPart),
    ...(currPart.providerExecuted !== undefined
      ? { providerExecuted: currPart.providerExecuted }
      : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  }

  switch (currPart.state) {
    case 'input-streaming':
      return [
        {
          ...base,
          state: 'input-streaming',
          ...(currPart.input !== undefined ? { input: currPart.input } : {}),
        },
      ]
    case 'input-available':
      return [{ ...base, state: 'input-available', input: currPart.input }]
    case 'approval-requested':
      return [
        {
          ...base,
          state: 'approval-requested',
          input: currPart.input,
          approval: currPart.approval,
        },
      ]
    case 'approval-responded':
      return [
        {
          ...base,
          state: 'approval-responded',
          input: currPart.input,
          approval: currPart.approval,
        },
      ]
    case 'output-available':
      return [
        {
          ...base,
          state: 'output-available',
          input: currPart.input,
          output: currPart.output,
          ...(currPart.preliminary !== undefined ? { preliminary: currPart.preliminary } : {}),
          ...(currPart.approval !== undefined ? { approval: currPart.approval } : {}),
        },
      ]
    case 'output-error': {
      // rawInput only exists on the static ToolUIPart variant — a DynamicToolUIPart's output-error
      // has no such field at all, so this must be read defensively behind the type discriminant.
      const rawInput = currPart.type === 'dynamic-tool' ? undefined : currPart.rawInput
      return [
        {
          ...base,
          state: 'output-error',
          ...(currPart.input !== undefined ? { input: currPart.input } : {}),
          errorText: currPart.errorText,
          ...(rawInput !== undefined ? { rawInput } : {}),
          ...(currPart.approval !== undefined ? { approval: currPart.approval } : {}),
        },
      ]
    }
    case 'output-denied':
      return [
        { ...base, state: 'output-denied', input: currPart.input, approval: currPart.approval },
      ]
    default:
      return assertNever(currPart)
  }
}

/** Diffs every index of one UIMessage snapshot against the previous snapshot. */
function diffMessage(
  chatId: string,
  prev: UIMessage | undefined,
  curr: UIMessage,
  toolStartTimes: Map<string, number>,
): AgentPartDraft[] {
  const deltas: AgentPartDraft[] = []
  curr.parts.forEach((part, i) => {
    deltas.push(...diffPart(chatId, i, prev?.parts[i], part, toolStartTimes))
  })
  return deltas
}

/**
 * Reads a raw UIMessageChunk stream through readUIMessageStream and yields only the new deltas
 * between consecutive UIMessage snapshots, cast to TPart (this transport only ever constructs the
 * built-in AgentPart variants, so TPart must be — or be assignable from — AgentPart for a
 * meaningful result; same documented-cast convention as useAgentThreadRuns' defaultToUserParts).
 *
 * `chatId` is the id-namespace for this diff pass — the caller's chat id on stream(), the
 * resumeToken (which IS the chat id, see the module docblock's CHAT ID BINDING note) on resume() —
 * so index-addressed ids line up with the original run's ids across a reconnect.
 *
 * A fresh `toolStartTimes` map is scoped to ONE diffChunkStream call (one stream()/resume()
 * invocation), never shared across calls or threads.
 *
 * `resume()`'s underlying reconnectToStream call has no AbortSignal parameter in the current AI
 * SDK API (unlike sendMessages), so we can't cancel the in-flight fetch directly — checking
 * `signal.aborted` here at least stops yielding further deltas to an aborted caller promptly.
 */
async function* diffChunkStream<TPart>(
  chatId: string,
  chunkStream: ReadableStream<UIMessageChunk>,
  readStream: typeof readUIMessageStream,
  signal?: AbortSignal,
): AsyncGenerator<TPart> {
  let prev: UIMessage | undefined
  const toolStartTimes = new Map<string, number>()
  for await (const curr of readStream<UIMessage>({ stream: chunkStream })) {
    if (signal?.aborted) return
    for (const part of diffMessage(chatId, prev, curr, toolStartTimes)) {
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

  function makeTransport(chatId: string): ResumableAgentTransport<TPart, string> {
    return {
      // Every text/reasoning delta this transport emits carries an authoritative `offset` (see
      // diffPart), so a replayed run rewrites in place instead of duplicating — the literal
      // condition this assertion stands for.
      idempotentReplay: true,
      async *stream(
        input: string,
        signal?: AbortSignal,
        ctx?: { readonly messageId: string },
      ): AsyncGenerator<TPart> {
        // Synthesized locally, first — we already know the chat id client-side, so there is no
        // need to wait on the server to hand us a run id (unlike a river-style protocol).
        yield { id: `${chatId}#start`, type: 'start', runId: chatId, resumeToken: chatId } as TPart

        const { httpTransport, readUIMessageStream: readStream } = await resolveAiSdk()
        const userMessage: UIMessage = {
          // This id is what AI SDK's own backend persistence/dedup keys turns hang off — the same
          // idempotency-key cost as basalt's own ChatMessage.id (see mintMessageId's doc). Prefer
          // the caller's OWN idempotency key (ctx.messageId — the id useAgentThreadRuns.start()
          // already minted for this turn's ChatMessage) so the two never diverge for one turn; only
          // a caller that omits ctx (useAgentStream, a hand-rolled stream() call) falls back to
          // minting a fresh one here.
          id: ctx?.messageId ?? mintMessageId(),
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
        yield* diffChunkStream<TPart>(chatId, chunkStream, readStream, signal)
      },
      async *resume(resumeToken: string, signal?: AbortSignal): AsyncGenerator<TPart> {
        const { httpTransport, readUIMessageStream: readStream } = await resolveAiSdk()
        const chunkStream = await httpTransport.reconnectToStream({ chatId: resumeToken })
        if (chunkStream === null) return
        // resumeToken IS the chat id (see CHAT ID BINDING above) — reusing it as the id-namespace
        // here keeps replayed index-addressed ids identical to the ones the original run minted.
        yield* diffChunkStream<TPart>(resumeToken, chunkStream, readStream, signal)
      },
    }
  }

  // Client-side conversation namespace, not an idempotency key — a collision here would merge two
  // conversations' index-addressed part ids, the same low collision cost `mintThreadId` covers.
  const fixedChatId = mintThreadId()
  return {
    ...makeTransport(fixedChatId),
    forThread: (chatId: string) => makeTransport(chatId),
  }
}
