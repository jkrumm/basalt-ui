/**
 * coalesceParts — merges a rendered-turn's parts array for display.
 *
 * Merges consecutive `text`+`text` and `reasoning`+`reasoning` parts (streamed answers arrive as
 * many small fragments; this renders a streaming reply as one flowing block instead of a stack of
 * fragments). Merges `tool` parts BY `toolCallId` regardless of adjacency — the AI SDK re-emits a
 * tool call's `input-available` then `output-available` as two separate parts, not necessarily
 * adjacent once other parts interleave; without this rule a UI renders two stacked tool blocks for
 * one call. The later state always wins; the merged part keeps the position of its FIRST
 * occurrence (stable ordering); and an `input` (or `toolName`) supplied by an earlier state
 * survives a later state that omits it — `tool-output-available` carries only `output` on the
 * wire, the SDK re-supplies `input` by reading it back off the stored invocation, and a merge that
 * replaces wholesale rather than accumulating would lose it outright.
 *
 * `approval`-bearing responses can arrive without a usable `toolCallId` (the SDK resolves them by
 * reverse lookup on `approval.id` instead) — this maintains an `approvalId -> toolCallId` side
 * index while folding and routes such a part through it. A part resolvable by neither key is kept
 * as-is rather than dropped; never silently discard a part.
 *
 * @example
 * import { coalesceParts } from 'basalt-ui/agent'
 * <PartList parts={coalesceParts(parts)} />
 */
import type { AgentPart, ReasoningPart, TextPart, ToolCallPart } from './parts'

type TextLike = TextPart | ReasoningPart

function isTextLikeType(type: AgentPart['type']): type is TextLike['type'] {
  return type === 'text' || type === 'reasoning'
}

/** Resolves a usable toolCallId for `part`, either off the part itself or (for an approval-bearing
 * part missing one) via the approvalId -> toolCallId side index built while folding. */
function resolveToolCallId(
  part: ToolCallPart,
  toolCallIdByApprovalId: Map<string, string>,
): string | undefined {
  if (typeof part.toolCallId === 'string' && part.toolCallId.length > 0) return part.toolCallId
  const approval = 'approval' in part ? part.approval : undefined
  return approval !== undefined ? toolCallIdByApprovalId.get(approval.id) : undefined
}

/** Registers this part's approval.id -> toolCallId mapping (when both are known) so a later
 * approval-bearing part missing its own toolCallId can still resolve to the right tool call. */
function registerApprovalIndex(
  part: ToolCallPart,
  toolCallIdByApprovalId: Map<string, string>,
): void {
  const approval = 'approval' in part ? part.approval : undefined
  if (approval === undefined) return
  if (typeof part.toolCallId !== 'string' || part.toolCallId.length === 0) return
  toolCallIdByApprovalId.set(approval.id, part.toolCallId)
}

/** The later state always wins; `input`/`toolName` from the earlier state survive a later state
 * that omits them. */
function mergeToolPart(existing: ToolCallPart, next: ToolCallPart): ToolCallPart {
  const existingInput = 'input' in existing ? existing.input : undefined
  const nextInput = 'input' in next ? next.input : undefined
  const input = nextInput !== undefined ? nextInput : existingInput
  const toolName = next.toolName.length > 0 ? next.toolName : existing.toolName

  return {
    ...existing,
    ...next,
    toolName,
    ...(input !== undefined ? { input } : {}),
  } as ToolCallPart
}

export function coalesceParts<TPart extends AgentPart>(parts: readonly TPart[]): TPart[] {
  const out: TPart[] = []
  const toolIndexByCallId = new Map<string, number>()
  const toolCallIdByApprovalId = new Map<string, string>()

  for (const part of parts) {
    if (isTextLikeType(part.type)) {
      const last = out[out.length - 1]
      if (last !== undefined && last.type === part.type) {
        const merged = {
          ...part,
          text: (last as unknown as TextLike).text + (part as unknown as TextLike).text,
        }
        out[out.length - 1] = merged as TPart
        continue
      }
      out.push(part)
      continue
    }

    if (part.type === 'tool') {
      const toolPart = part as unknown as ToolCallPart
      registerApprovalIndex(toolPart, toolCallIdByApprovalId)
      const resolvedCallId = resolveToolCallId(toolPart, toolCallIdByApprovalId)

      if (resolvedCallId === undefined) {
        // Unresolvable by either key — never silently discard.
        out.push(part)
        continue
      }

      const existingIndex = toolIndexByCallId.get(resolvedCallId)
      if (existingIndex === undefined) {
        toolIndexByCallId.set(resolvedCallId, out.length)
        out.push(part)
        continue
      }

      const existing = out[existingIndex] as unknown as ToolCallPart
      out[existingIndex] = mergeToolPart(existing, toolPart) as unknown as TPart
      continue
    }

    out.push(part)
  }

  return out
}
