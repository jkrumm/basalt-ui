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
import type { AgentPart } from './parts'

// ── AgentTransport ────────────────────────────────────────────────────────────

/**
 * The injected transport seam. `stream(input, signal)` returns an async generator of parts.
 * Implement this interface for any backend — Eden, fetch-based SSE, AI SDK, or a mock.
 *
 * @example
 * // Minimal mock transport for tests / playground:
 * const mockTransport: AgentTransport = {
 *   async *stream(input) {
 *     yield { type: 'text', text: `Echo: ${input}` }
 *   },
 * }
 */
export type AgentTransport<TPart = AgentPart, TInput = string> = {
  stream: (input: TInput, signal?: AbortSignal) => AsyncGenerator<TPart>
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
 * @example
 * import { edenTransport, type AgentPart } from 'basalt-ui/agent'
 *
 * // api is the consumer's Eden treaty client (import from their own api-client module)
 * // The Eden call must forward `signal` so stop() aborts the in-flight request:
 * const transport = edenTransport<AgentPart>((input, signal) =>
 *   api.chat.post({ body: { message: input }, fetch: { signal } }),
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
): AgentTransport<TPart, TInput> {
  return {
    async *stream(input: TInput, signal?: AbortSignal): AsyncGenerator<TPart> {
      const { data, error } = await call(input, signal)
      if (error) throw error
      if (data === null) return
      yield* data
    },
  }
}
