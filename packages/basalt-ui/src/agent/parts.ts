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
 *     case 'start':     return `[start] ${p.runId}`
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

/**
 * Emitted once at stream start, carrying the run id and an opaque token a transport can use to
 * resume this run after a disconnect. Not renderable content — UI code should treat it as a
 * no-op signal, not conversation content.
 */
export type StartPart = {
  readonly type: 'start'
  readonly runId: string
  readonly resumeToken?: string
}

/** A streamed text fragment from the assistant. */
export type TextPart = { readonly type: 'text'; readonly text: string }

/** An internal reasoning/thinking fragment (may be hidden in the UI). */
export type ReasoningPart = { readonly type: 'reasoning'; readonly text: string }

/**
 * A tool invocation — input is the parameters sent, output (optional) is the result once
 * the tool has completed. Streams arrive with output undefined; it may be appended later.
 *
 * `toolCallId` (optional) identifies the specific invocation when a transport's wire format
 * carries one (e.g. AI SDK's `ToolUIPart`) — useful for consumer-side coalescing of a tool call's
 * input/output pair by id rather than by array position.
 */
export type ToolCallPart = {
  readonly type: 'tool'
  readonly toolName: string
  readonly input: unknown
  readonly output?: unknown
  readonly toolCallId?: string
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
export type AgentPart = StartPart | TextPart | ReasoningPart | ToolCallPart | SourcePart | ErrorPart

// ── parseAgentPart ───────────────────────────────────────────────────────────

/**
 * Runtime type-narrowing guard: validates an unknown value against the AgentPart discriminated
 * union and returns the narrowed type or null when validation fails.
 *
 * @example
 * const raw = JSON.parse(line)
 * const part = parseAgentPart(raw)
 * if (part !== null) handlePart(part)
 */
export function parseAgentPart(raw: unknown): AgentPart | null {
  if (raw === null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj['type'] !== 'string') return null

  switch (obj['type']) {
    case 'start':
      if (typeof obj['runId'] !== 'string') return null
      return {
        type: 'start',
        runId: obj['runId'],
        ...(typeof obj['resumeToken'] === 'string' ? { resumeToken: obj['resumeToken'] } : {}),
      }
    case 'text':
      if (typeof obj['text'] !== 'string') return null
      return { type: 'text', text: obj['text'] }
    case 'reasoning':
      if (typeof obj['text'] !== 'string') return null
      return { type: 'reasoning', text: obj['text'] }
    case 'tool':
      if (typeof obj['toolName'] !== 'string') return null
      if (!('input' in obj)) return null
      return {
        type: 'tool',
        toolName: obj['toolName'],
        input: obj['input'],
        ...(obj['output'] !== undefined ? { output: obj['output'] } : {}),
        ...(typeof obj['toolCallId'] === 'string' ? { toolCallId: obj['toolCallId'] } : {}),
      }
    case 'source':
      if (typeof obj['url'] !== 'string') return null
      return {
        type: 'source',
        url: obj['url'],
        ...(typeof obj['title'] === 'string' ? { title: obj['title'] } : {}),
      }
    case 'error':
      if (typeof obj['message'] !== 'string') return null
      return { type: 'error', message: obj['message'] }
    default:
      return null
  }
}

// ── isStartPart ──────────────────────────────────────────────────────────────

/** Type guard: narrows an unknown value to StartPart. */
export function isStartPart(part: unknown): part is StartPart {
  return typeof part === 'object' && part !== null && (part as { type?: unknown }).type === 'start'
}
