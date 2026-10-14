/**
 * AgentTransport — the injected seam between useAgentThreadRuns and a concrete backend client.
 *
 * The one shipped transport is `aiSdkTransport`. The transport is
 * generic over the part type and input shape so consumers can extend AgentPart with domain-specific
 * variants while keeping the hook interface unchanged.
 *
 * Stream resumption is an OPTIONAL seam: a transport emits a StartPart at the top of a run
 * carrying an opaque `resumeToken`, and implements the optional `resume` method to reconnect a
 * run after a disconnect (reload, network drop). basalt-ui ships only the client-side interface —
 * a concrete resumable backend (e.g. Redis-backed) is the consumer's responsibility. Transports
 * that don't support resumption simply omit `resume`.
 *
 */
import type { AgentPartDraft } from './parts'

// ── AgentTransport ────────────────────────────────────────────────────────────

/**
 * The injected transport seam. `stream(input, signal, ctx)` returns an async generator of parts.
 * Implement this interface for any backend — fetch-based SSE, AI SDK, or a mock.
 *
 * The default `TPart` is `AgentPartDraft` (not `AgentPart`): transports yield DRAFTS — `id`
 * optional — and the consuming hooks (or `withPartIds`) normalize a draft into a fully-identified
 * part before it is ever accumulated. Pass an explicit `AgentPart` generic when a transport mints
 * its own ids directly (as `aiSdkTransport` does).
 *
 * `ctx.messageId`, when present, is the id `useAgentThreadRuns.start()` already minted for this
 * turn's user `ChatMessage` — the SAME idempotency key `appendMessage`/the backend's dedup keys off
 * of (see `mintMessageId`'s doc). A transport that mints its OWN wire-level message id independent
 * of that (as `aiSdkTransport` used to) forces the consumer to reconcile two ids for one turn; a
 * transport MAY use `ctx.messageId` as its outbound message id instead of minting a fresh one. The
 * param is optional and appended last so an existing two-arg transport keeps compiling unchanged —
 * only `useAgentThreadRuns.start()`/`retry()` pass it; a bare `stream(input, signal)` call (e.g.
 * a hand-rolled caller) omits it and a transport falls back to minting its own.
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
  stream: (
    input: TInput,
    signal?: AbortSignal,
    ctx?: { readonly messageId: string },
  ) => AsyncGenerator<TPart>
  /** Optional: resume a previously-started run from its resumeToken (see StartPart). Transports that don't support resumption simply omit this. */
  resume?: ((resumeToken: string, signal?: AbortSignal) => AsyncGenerator<TPart>) | undefined
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
