/**
 * AgentPart — the discriminated union describing all structured parts emitted by an agent stream.
 *
 * Exhaustiveness is enforced at every switch via assertNever (imported from '../register').
 * Adding a new variant without a matching case is a tsc error — see the fixture in
 * apps/playground/src/demo/agent-part.type-guard.ts.
 *
 * Eden #231 doctrine: the server-side Elysia route MUST declare `: AsyncGenerator<AgentPart>`
 * explicitly and carry NO t.Object/t.Union response schema. Validate at yield-time. See
 * agent/rules/basalt-agent.md for the full doctrine.
 *
 * @example
 * import type { AgentPart } from 'basalt-ui/agent'
 * function describe(p: AgentPart): string {
 *   switch (p.type) {
 *     case 'text':      return p.text
 *     case 'reasoning': return `[think] ${p.text}`
 *     case 'tool':      return `[tool] ${p.toolName}`
 *     case 'source':    return p.url
 *     case 'error':     return `[err] ${p.message}`
 *     default:          return assertNever(p)
 *   }
 * }
 */

// ── AgentPart discriminated union ────────────────────────────────────────────

/** A streamed text fragment from the assistant. */
export type TextPart = { readonly type: 'text'; readonly text: string }

/** An internal reasoning/thinking fragment (may be hidden in the UI). */
export type ReasoningPart = { readonly type: 'reasoning'; readonly text: string }

/**
 * A tool invocation — input is the parameters sent, output (optional) is the result once
 * the tool has completed. Streams arrive with output undefined; it may be appended later.
 */
export type ToolCallPart = {
  readonly type: 'tool'
  readonly toolName: string
  readonly input: unknown
  readonly output?: unknown
}

/** A cited source URL referenced by the assistant. */
export type SourcePart = { readonly type: 'source'; readonly url: string; readonly title?: string }

/** A fatal or recoverable error emitted in-stream by the agent. */
export type ErrorPart = { readonly type: 'error'; readonly message: string }

/**
 * The complete discriminated union of all structured agent stream parts.
 *
 * @example
 * const part: AgentPart = { type: 'text', text: 'Hello' }
 */
export type AgentPart = TextPart | ReasoningPart | ToolCallPart | SourcePart | ErrorPart
