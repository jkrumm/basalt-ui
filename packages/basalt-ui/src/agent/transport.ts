/**
 * AgentTransport — the injected seam between useAgentStream and a concrete backend client.
 *
 * The default transport path is Eden-native typed streaming (zero extra deps). The transport is
 * generic over the part type and input shape so consumers can extend AgentPart with domain-specific
 * variants while keeping the hook interface unchanged.
 *
 * Eden #231 doctrine (critical): applying a t.Object/t.Union response schema to an Elysia
 * `async function*` stream route collapses the streamed union to `any` in Eden Treaty. The
 * server handler MUST declare `: AsyncGenerator<AgentPart>` explicitly and carry NO response
 * schema. See agent/rules/basalt-agent.md for the full rationale and mitigation.
 *
 * Stream resumption is an OPTIONAL seam: a transport emits a StartPart at the top of a run
 * carrying an opaque `resumeToken`, and implements the optional `resume` method to reconnect a
 * run after a disconnect (reload, network drop). basalt-ui ships only the client-side interface —
 * a concrete resumable backend (e.g. Redis-backed) is the consumer's responsibility. Transports
 * that don't support resumption simply omit `resume`.
 *
 * @example
 * // Server-side Elysia route (consumer's app — NOT basalt-ui):
 * app.post('/chat', async function* ({ body }): AsyncGenerator<AgentPart> {
 *   yield { type: 'text', text: 'Hello' }
 *   yield { type: 'text', text: ' world' }
 * })
 *
 * // Client-side wiring:
 * import { edenTransport } from 'basalt-ui/agent'
 * const transport = edenTransport<AgentPart>((input, signal) =>
 *   api.chat.post({ body: { message: input }, fetch: { signal } }),
 * )
 */
import type { AgentPart, AgentPartDraft } from './parts'

// ── AgentTransport ────────────────────────────────────────────────────────────

/**
 * The injected transport seam. `stream(input, signal)` returns an async generator of parts.
 * Implement this interface for any backend — Eden, fetch-based SSE, AI SDK, or a mock.
 *
 * The default `TPart` is `AgentPartDraft` (not `AgentPart`): transports yield DRAFTS — `id`
 * optional — and the consuming hooks (or `withPartIds`) normalize a draft into a fully-identified
 * part before it is ever accumulated. Pass an explicit `AgentPart` generic when a transport mints
 * its own ids directly (as `aiSdkTransport` does).
 *
 * @example
 * // Minimal mock transport for tests / playground:
 * const mockTransport: AgentTransport = {
 *   async *stream(input) {
 *     yield { type: 'text', text: `Echo: ${input}` }
 *   },
 * }
 */
export type AgentTransport<TPart = AgentPartDraft, TInput = string> = {
  stream: (input: TInput, signal?: AbortSignal) => AsyncGenerator<TPart>
  /** Optional: resume a previously-started run from its resumeToken (see StartPart). Transports that don't support resumption simply omit this. */
  resume?: (resumeToken: string, signal?: AbortSignal) => AsyncGenerator<TPart>
}

// ── ResumableAgentTransport ───────────────────────────────────────────────────

/**
 * A transport whose replay is safe to run over an already-rendered turn. Implementing `resume`
 * alone is no longer enough: `idempotentReplay: true` is a literal-typed assertion that every
 * text/reasoning part this transport emits carries an authoritative `offset`, so mergePart
 * rewrites instead of appending.
 */
export type ResumableAgentTransport<TPart = AgentPartDraft, TInput = string> = AgentTransport<
  TPart,
  TInput
> & {
  readonly resume: (resumeToken: string, signal?: AbortSignal) => AsyncGenerator<TPart>
  readonly idempotentReplay: true
}

/**
 * Type guard: true when `t` both implements `resume` AND has explicitly asserted
 * `idempotentReplay: true`. A transport with `resume` but no `idempotentReplay` is NOT resumable
 * — the mount-time reconcile in `useAgentThreadRuns` falls back to `'interrupted'` for it rather
 * than risk duplicating already-rendered content.
 *
 * @example
 * if (isResumable(transport)) {
 *   for await (const part of transport.resume(resumeToken)) { ... }
 * }
 */
export function isResumable<TPart, TInput>(
  t: AgentTransport<TPart, TInput>,
): t is ResumableAgentTransport<TPart, TInput> {
  return (
    typeof t.resume === 'function' &&
    (t as Partial<ResumableAgentTransport<TPart, TInput>>).idempotentReplay === true
  )
}

// ── edenTransport ─────────────────────────────────────────────────────────────

/**
 * Wraps a consumer's Eden async-generator call into an AgentTransport.
 *
 * The `call` parameter is the typed Eden client method — e.g. `api.chat.post`. Eden Treaty
 * resolves the streaming route as `AsyncGenerator<TPart>` when the server handler carries the
 * correct explicit return type annotation (no response schema — see Eden #231 doctrine).
 *
 * `stream(input, signal)` awaits the call, asserts no error, then yields from the data generator.
 * The optional AbortSignal is forwarded to the fetch layer via the `fetch: { signal }` option in
 * the Eden call (the consumer must pass it through — see example).
 *
 * The optional second argument, `resumeCall`, mirrors `call`'s shape but takes a `resumeToken`
 * instead of the original input — e.g. `api.chat.resume.post`. When provided, the returned
 * transport gets a `resume` method built the same way as `stream`. When omitted, the returned
 * object has NO `resume` key at all (not `resume: undefined`) — consumers that don't wire a
 * resumable backend get a transport that behaves exactly as before.
 *
 * `resumeCall` alone does NOT make the transport resumable per `isResumable` — pass
 * `{ idempotentReplay: true }` as the third argument to opt in EXPLICITLY once the server-side
 * `resumeCall` route is verified to re-emit every text/reasoning delta with an authoritative
 * `offset` (never a bare append). This is an opt-in, not an inference: a `resumeCall` whose deltas
 * aren't offset-accurate would double-render on replay if treated as resumable.
 *
 * @example
 * import { edenTransport, type AgentPart } from 'basalt-ui/agent'
 *
 * // api is the consumer's Eden treaty client (import from their own api-client module)
 * // The Eden call must forward `signal` so stop() aborts the in-flight request:
 * const transport = edenTransport<AgentPart>(
 *   (input, signal) => api.chat.post({ body: { message: input }, fetch: { signal } }),
 *   (resumeToken, signal) => api.chat.resume.post({ body: { resumeToken }, fetch: { signal } }),
 *   { idempotentReplay: true },
 * )
 *
 * // Wire into useAgentStream:
 * const { send, stop, parts, status } = useAgentStream({ transport })
 */
export function edenTransport<TPart = AgentPart, TInput = string>(
  call: (
    input: TInput,
    signal?: AbortSignal,
  ) => Promise<{ data: AsyncGenerator<TPart> | null; error: unknown }>,
  resumeCall?: (
    resumeToken: string,
    signal?: AbortSignal,
  ) => Promise<{ data: AsyncGenerator<TPart> | null; error: unknown }>,
  options?: { readonly idempotentReplay?: true },
): AgentTransport<TPart, TInput> | ResumableAgentTransport<TPart, TInput> {
  const stream = async function* (input: TInput, signal?: AbortSignal): AsyncGenerator<TPart> {
    const { data, error } = await call(input, signal)
    if (error) throw error
    if (data === null) return
    yield* data
  }

  if (resumeCall === undefined) return { stream }

  const resume = async function* (
    resumeToken: string,
    signal?: AbortSignal,
  ): AsyncGenerator<TPart> {
    const { data, error } = await resumeCall(resumeToken, signal)
    if (error) throw error
    if (data === null) return
    yield* data
  }

  if (options?.idempotentReplay !== true) return { stream, resume }
  return { stream, resume, idempotentReplay: true }
}
