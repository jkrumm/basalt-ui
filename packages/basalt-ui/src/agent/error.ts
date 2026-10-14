/**
 * AgentError — the closed, serializable shape of a failed turn (V2-SPEC § 6).
 *
 * `useAgentThreadRuns({ onError })` keeps the raw thrown value; `ThreadRunState.error` and the
 * `chat.turn` telemetry carry this union instead, so a consumer switches on `kind` rather than
 * parsing an error body. Classification is duck-typed on purpose: this module must never resolve
 * the optional `ai` peer at runtime.
 */

/**
 * - `http`: the chat endpoint answered with a non-2xx `status` (AI SDK's `APICallError`).
 * - `stream`: the UI-message stream was malformed (AI SDK's `UIMessageStreamError`).
 * - `server`: an `error` chunk arrived mid-stream, or any other failure; `message` is the server's
 *   `errorText` or the thrown error's message.
 * - `aborted`: the request was aborted by something other than `stop()`.
 */
export type AgentError =
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'stream'; readonly chunkType: string; readonly chunkId: string }
  | { readonly kind: 'server'; readonly message: string }
  | { readonly kind: 'aborted' }

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' ? field : undefined
}

/** Maps whatever a transport threw onto the closed `AgentError` union. */
export function toAgentError(error: unknown): AgentError {
  // By name, not `instanceof Error`: a `fetch` abort is a DOMException, which is not an Error.
  if (stringField(error, 'name') === 'AbortError') return { kind: 'aborted' }
  const status =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)['statusCode']
      : undefined
  if (typeof status === 'number') return { kind: 'http', status }
  const chunkType = stringField(error, 'chunkType')
  const chunkId = stringField(error, 'chunkId')
  if (chunkType !== undefined && chunkId !== undefined)
    return { kind: 'stream', chunkType, chunkId }
  return { kind: 'server', message: stringField(error, 'message') ?? String(error) }
}
