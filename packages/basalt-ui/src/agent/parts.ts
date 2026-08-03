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
 * Part identity: every variant carries a stable `id` (see `PartBase`). Transports are permitted to
 * yield a DRAFT — `id` omitted — via `AgentPartDraft`; the consuming hooks (or `withPartIds`)
 * normalize a draft into a fully-identified part before it is ever accumulated. `parseAgentPart`
 * validates the FULL (identified) shape — a draft is a separate, narrower concern.
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

// ── Part identity ─────────────────────────────────────────────────────────────

/** Every AgentPart variant carries a stable id — the addressing key for `mergePart`/`coalesceParts`. */
type PartBase = { readonly id: string }

// ── AgentPart discriminated union ────────────────────────────────────────────

/**
 * Emitted once at stream start, carrying the run id and an opaque token a transport can use to
 * resume this run after a disconnect. Not renderable content — UI code should treat it as a
 * no-op signal, not conversation content.
 */
export type StartPart = PartBase & {
  readonly type: 'start'
  readonly runId: string
  readonly resumeToken?: string
}

/**
 * A streamed text fragment from the assistant. `offset` is the character position of this delta
 * inside its part (undefined = append at the tail) — the mechanism `mergePart` uses to splice a
 * replayed delta in place rather than duplicating it.
 */
export type TextPart = PartBase & {
  readonly type: 'text'
  readonly text: string
  readonly offset?: number
}

/** An internal reasoning/thinking fragment (may be hidden in the UI). Same `offset` mechanism as TextPart. */
export type ReasoningPart = PartBase & {
  readonly type: 'reasoning'
  readonly text: string
  readonly offset?: number
}

// ── ToolCallPart — mirrors AI SDK v7's UIToolInvocation ─────────────────────
//
// Verified against installed ai@7.0.16 / 7.0.18 (byte-identical .d.ts). Seven states, no
// 'running' ('input-available' IS the running state — input complete, no output yet).
//
// The nested `approval` shape mirrors the SDK exactly (`{ id, approved?, reason?, isAutomatic?,
// signature? }`) rather than flattening to `approvalId`/`approved`/`reason` — flattening would
// silently drop `isAutomatic`/`signature`.
//
// `toolName` is NOT a field on the SDK's UIToolInvocation — for static tools it lives in the part
// discriminator `tool-${NAME}`. It IS a required field here (ours, not the SDK's) because the chip
// needs it; a transport mapping from the SDK must DERIVE it from the discriminator, not read it off
// the invocation.

/** The nested approval envelope — mirrors the SDK's shape verbatim, never flattened. */
type ToolApproval = {
  readonly id: string
  readonly approved?: boolean
  readonly reason?: string
  readonly isAutomatic?: boolean
  readonly signature?: string
}

type ToolCallBase = PartBase & {
  readonly type: 'tool'
  /** Required on all seven states (was optional — see parts.ts history). */
  readonly toolCallId: string
  readonly toolName: string
  /** Wall-clock time from first sighting of this toolCallId to its terminal state. */
  readonly durationMs?: number
  readonly providerExecuted?: boolean
}

export type ToolCallPart =
  | (ToolCallBase & { readonly state: 'input-streaming'; readonly input?: unknown })
  | (ToolCallBase & { readonly state: 'input-available'; readonly input: unknown })
  | (ToolCallBase & {
      readonly state: 'approval-requested'
      readonly input: unknown
      readonly approval: ToolApproval & { readonly approved?: never; readonly reason?: never }
    })
  | (ToolCallBase & {
      readonly state: 'approval-responded'
      readonly input: unknown
      readonly approval: ToolApproval & { readonly approved: boolean }
    })
  | (ToolCallBase & {
      readonly state: 'output-available'
      readonly input: unknown
      readonly output: unknown
      readonly preliminary?: boolean
      readonly approval?: ToolApproval & { readonly approved?: true }
    })
  | (ToolCallBase & {
      readonly state: 'output-error'
      readonly input?: unknown
      /** The SDK's field name — there is no field named `error` anywhere in the union. */
      readonly errorText: string
      /** The only place the raw, un-parsed input survives — what lets a UI render a call whose input never validated. */
      readonly rawInput?: unknown
      readonly approval?: ToolApproval & { readonly approved?: true }
    })
  | (ToolCallBase & {
      readonly state: 'output-denied'
      readonly input: unknown
      readonly approval: ToolApproval & { readonly approved: false }
    })

export type ToolCallState = ToolCallPart['state']

/** The three states a tool call can never leave — see `isToolCallSettled`. */
export const TERMINAL_TOOL_STATES = ['output-available', 'output-error', 'output-denied'] as const

/** True once a tool call has reached one of `TERMINAL_TOOL_STATES` — no further state transition. */
export function isToolCallSettled(part: ToolCallPart): boolean {
  return (TERMINAL_TOOL_STATES as readonly ToolCallState[]).includes(part.state)
}

/** A cited source URL referenced by the assistant. */
export type SourcePart = PartBase & {
  readonly type: 'source'
  readonly url: string
  readonly title?: string
}

/** A fatal or recoverable error emitted in-stream by the agent. */
export type ErrorPart = PartBase & { readonly type: 'error'; readonly message: string }

/**
 * The complete discriminated union of all structured agent stream parts.
 *
 * @example
 * const part: AgentPart = { id: 'p1', type: 'text', text: 'Hello' }
 */
export type AgentPart = StartPart | TextPart | ReasoningPart | ToolCallPart | SourcePart | ErrorPart

// ── AgentPartDraft — what a transport is allowed to yield ────────────────────

/**
 * An AgentPart with `id` optional — the shape a transport is allowed to yield. The naked type
 * parameter (not `AgentPart extends unknown ? ... : never` written some other way) is deliberate:
 * it makes the conditional type distribute over the AgentPart union member-by-member, so
 * `Drafted<AgentPart>` is `Drafted<StartPart> | Drafted<TextPart> | ...` rather than one flattened
 * (and wrong) shape.
 */
export type Drafted<T> = T extends unknown ? Omit<T, 'id'> & { readonly id?: string } : never
export type AgentPartDraft = Drafted<AgentPart>

// ── parseAgentPart ───────────────────────────────────────────────────────────

/**
 * Runtime type-narrowing guard: validates an unknown value against the AgentPart discriminated
 * union and returns the narrowed type or null when validation fails. Validates the FULL
 * (identified) shape — an `id`-less draft is a separate concern handled by `withPartIds`.
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
  if (typeof obj['id'] !== 'string') return null
  const id = obj['id']

  switch (obj['type']) {
    case 'start':
      if (typeof obj['runId'] !== 'string') return null
      return {
        id,
        type: 'start',
        runId: obj['runId'],
        ...(typeof obj['resumeToken'] === 'string' ? { resumeToken: obj['resumeToken'] } : {}),
      }
    case 'text':
      if (typeof obj['text'] !== 'string') return null
      return {
        id,
        type: 'text',
        text: obj['text'],
        ...(typeof obj['offset'] === 'number' ? { offset: obj['offset'] } : {}),
      }
    case 'reasoning':
      if (typeof obj['text'] !== 'string') return null
      return {
        id,
        type: 'reasoning',
        text: obj['text'],
        ...(typeof obj['offset'] === 'number' ? { offset: obj['offset'] } : {}),
      }
    case 'tool':
      return parseToolCallPart(id, obj)
    case 'source':
      if (typeof obj['url'] !== 'string') return null
      return {
        id,
        type: 'source',
        url: obj['url'],
        ...(typeof obj['title'] === 'string' ? { title: obj['title'] } : {}),
      }
    case 'error':
      if (typeof obj['message'] !== 'string') return null
      return { id, type: 'error', message: obj['message'] }
    default:
      return null
  }
}

/** Validates the state-discriminated `tool` part shape. Rejects the pre-1.11.0 flat shape
 * (`{type:'tool', output}` with no `state`) and any unrecognized `state` value. */
function parseToolCallPart(id: string, obj: Record<string, unknown>): ToolCallPart | null {
  if (typeof obj['toolCallId'] !== 'string') return null
  if (typeof obj['toolName'] !== 'string') return null
  if (typeof obj['state'] !== 'string') return null

  const { toolCallId, toolName } = obj as { toolCallId: string; toolName: string }
  const common = {
    id,
    type: 'tool' as const,
    toolCallId,
    toolName,
    ...(typeof obj['durationMs'] === 'number' ? { durationMs: obj['durationMs'] } : {}),
    ...(typeof obj['providerExecuted'] === 'boolean'
      ? { providerExecuted: obj['providerExecuted'] }
      : {}),
  }

  switch (obj['state']) {
    case 'input-streaming':
      return {
        ...common,
        state: 'input-streaming',
        ...('input' in obj ? { input: obj['input'] } : {}),
      }
    case 'input-available':
      if (!('input' in obj)) return null
      return { ...common, state: 'input-available', input: obj['input'] }
    case 'approval-requested': {
      if (!('input' in obj)) return null
      const approval = parseApproval(obj['approval'])
      // The type declares this state's approval as `{ approved?: never; reason?: never }` — a
      // request that already carries a verdict or a reason is a contradiction, not a pending
      // request, so reject it rather than silently casting past the invariant.
      if (approval === null || approval.approved !== undefined || approval.reason !== undefined) {
        return null
      }
      return {
        ...common,
        state: 'approval-requested',
        input: obj['input'],
        approval: approval as ToolApproval & { approved?: never; reason?: never },
      }
    }
    case 'approval-responded': {
      if (!('input' in obj)) return null
      const approval = parseApproval(obj['approval'])
      if (approval === null || typeof approval.approved !== 'boolean') return null
      return {
        ...common,
        state: 'approval-responded',
        input: obj['input'],
        approval: approval as ToolApproval & { approved: boolean },
      }
    }
    case 'output-denied': {
      if (!('input' in obj)) return null
      const approval = parseApproval(obj['approval'])
      if (approval === null || approval.approved !== false) return null
      return {
        ...common,
        state: 'output-denied',
        input: obj['input'],
        approval: approval as ToolApproval & { approved: false },
      }
    }
    case 'output-available': {
      if (!('input' in obj)) return null
      if (!('output' in obj)) return null
      const approval = obj['approval'] === undefined ? null : parseApproval(obj['approval'])
      // The type declares this state's approval as `{ approved?: true }` — output present
      // alongside `approved: false` is a denial masquerading as a result, not a valid "approved"
      // carry-through. A present-but-malformed approval is rejected the same way (not silently
      // dropped), matching output-denied/approval-responded's precedent above.
      if (obj['approval'] !== undefined && (approval === null || approval.approved === false)) {
        return null
      }
      return {
        ...common,
        state: 'output-available',
        input: obj['input'],
        output: obj['output'],
        ...(typeof obj['preliminary'] === 'boolean' ? { preliminary: obj['preliminary'] } : {}),
        ...(approval !== null ? { approval: approval as ToolApproval & { approved?: true } } : {}),
      }
    }
    case 'output-error': {
      if (typeof obj['errorText'] !== 'string') return null
      const approval = obj['approval'] === undefined ? null : parseApproval(obj['approval'])
      // Same invariant as output-available above: an error carrying `approved: false` is a
      // denial, not an error whose approval "happens to carry through".
      if (obj['approval'] !== undefined && (approval === null || approval.approved === false)) {
        return null
      }
      return {
        ...common,
        state: 'output-error',
        errorText: obj['errorText'],
        ...('input' in obj ? { input: obj['input'] } : {}),
        ...('rawInput' in obj ? { rawInput: obj['rawInput'] } : {}),
        ...(approval !== null ? { approval: approval as ToolApproval & { approved?: true } } : {}),
      }
    }
    default:
      return null
  }
}

/** Validates the nested `approval` envelope. Returns null when absent/malformed. */
function parseApproval(raw: unknown): ToolApproval | null {
  if (raw === null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (typeof obj['id'] !== 'string') return null
  return {
    id: obj['id'],
    ...(typeof obj['approved'] === 'boolean' ? { approved: obj['approved'] } : {}),
    ...(typeof obj['reason'] === 'string' ? { reason: obj['reason'] } : {}),
    ...(typeof obj['isAutomatic'] === 'boolean' ? { isAutomatic: obj['isAutomatic'] } : {}),
    ...(typeof obj['signature'] === 'string' ? { signature: obj['signature'] } : {}),
  }
}

// ── isStartPart ──────────────────────────────────────────────────────────────

/** Type guard: narrows an unknown value to StartPart. */
export function isStartPart(part: unknown): part is StartPart {
  return typeof part === 'object' && part !== null && (part as { type?: unknown }).type === 'start'
}
