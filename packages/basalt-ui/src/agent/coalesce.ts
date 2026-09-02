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
 * A settled tool part can arrive without a `toolCallId` at all — `approval-responded` plus the
 * three terminal states all carry it as optional (see `MaybeIdentified` in `parts.ts`).
 * `approval-responded` is where the WIRE itself omits it: the SDK's `tool-approval-response` chunk
 * carries no `toolCallId`, only `approval.id`, so it is resolved by reverse lookup on `approval.id`
 * instead — this maintains an `approvalId -> toolCallId` side index while folding and routes such a
 * part through it. A part resolvable by neither key is kept as-is rather than dropped; never
 * silently discard a part.
 *
 * The fold is strictly LEFT-TO-RIGHT with no backtracking: the side index only holds ids seen so
 * far, so an unidentified `approval-responded` arriving BEFORE its `approval-requested` stays its
 * own block and the later request opens a second one. That is deliberate, not an oversight —
 * reconciling backwards would let the request (the later arrival) win under the "later state wins"
 * rule and render an already-answered call as still pending, which is worse than two blocks in an
 * ordering the wire never produces.
 *
 * **This function never throws.** It is public, it runs on the render path, and it folds data that
 * came off a wire — so every anomaly (an unrecognized tool state, an unresolvable id) degrades to
 * "keep the part as it arrived", announced in dev, rather than aborting the render. A throw here
 * would turn one malformed chunk into a permanently dead transcript. Exhaustiveness over the tool
 * states is still enforced, but at COMPILE time only (see `mergeToolPart`'s default branch).
 *
 * @example
 * import { coalesceParts } from 'basalt-ui/agent'
 * <PartList parts={coalesceParts(parts)} />
 */
import type { AgentPart, ReasoningPart, TextPart, ToolCallPart } from './parts'
import { isDev } from '../common/is-dev'

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
  if (part.toolCallId !== undefined) return part.toolCallId
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
  if (part.toolCallId === undefined) return
  toolCallIdByApprovalId.set(approval.id, part.toolCallId)
}

/**
 * The later state always wins; `toolCallId`/`toolName`/`durationMs`/`providerExecuted` and `input`
 * from the earlier state survive a later state that omits them.
 *
 * The result is RECONSTRUCTED per `next.state`, building only the fields that state legally has —
 * never a blind `{ ...existing, ...next }` spread. A spread lets any field the next state does not
 * redeclare survive onto it: an `output-available` (with `output`, possibly `preliminary`) that
 * fails to `output-error` (which has no `output` key) would keep a stale `output` alongside
 * `errorText`, and a consumer branching on `output` before `errorText` renders a failed call as
 * successful. Only the fields listed above are carried; `output`, `errorText`, `rawInput`,
 * `preliminary` and `approval` come from `next` alone, so nothing from a prior state can leak into
 * a member that has no room for it. Reconstruction is exact enough that tsc proves each returned
 * member valid — there is deliberately no cast here.
 */
function mergeToolPart(existing: ToolCallPart, next: ToolCallPart): ToolCallPart {
  const existingInput = 'input' in existing ? existing.input : undefined
  const nextInput = 'input' in next ? next.input : undefined
  const input = nextInput !== undefined ? nextInput : existingInput
  const durationMs = next.durationMs ?? existing.durationMs
  const providerExecuted = next.providerExecuted ?? existing.providerExecuted
  // `toolCallId` is optional on the four settled states (see `MaybeIdentified` in parts.ts), so a
  // later part that arrived unidentified — resolved here through the approvalId side index — keeps
  // the identity an earlier state supplied instead of losing it on the way through the merge.
  const settledToolCallId = next.toolCallId ?? existing.toolCallId

  const common = {
    id: next.id,
    type: 'tool' as const,
    toolName: next.toolName.length > 0 ? next.toolName : existing.toolName,
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(providerExecuted !== undefined ? { providerExecuted } : {}),
  }

  switch (next.state) {
    case 'input-streaming':
      return {
        ...common,
        toolCallId: next.toolCallId,
        state: 'input-streaming',
        ...(input !== undefined ? { input } : {}),
      }
    case 'input-available':
      return { ...common, toolCallId: next.toolCallId, state: 'input-available', input }
    case 'approval-requested':
      return {
        ...common,
        toolCallId: next.toolCallId,
        state: 'approval-requested',
        input,
        approval: next.approval,
      }
    case 'approval-responded':
      return {
        ...common,
        ...(settledToolCallId !== undefined ? { toolCallId: settledToolCallId } : {}),
        state: 'approval-responded',
        input,
        approval: next.approval,
      }
    case 'output-available':
      return {
        ...common,
        ...(settledToolCallId !== undefined ? { toolCallId: settledToolCallId } : {}),
        state: 'output-available',
        input,
        output: next.output,
        ...(next.preliminary !== undefined ? { preliminary: next.preliminary } : {}),
        ...(next.approval !== undefined ? { approval: next.approval } : {}),
      }
    case 'output-error':
      return {
        ...common,
        ...(settledToolCallId !== undefined ? { toolCallId: settledToolCallId } : {}),
        state: 'output-error',
        errorText: next.errorText,
        ...(input !== undefined ? { input } : {}),
        ...(next.rawInput !== undefined ? { rawInput: next.rawInput } : {}),
        ...(next.approval !== undefined ? { approval: next.approval } : {}),
      }
    case 'output-denied':
      return {
        ...common,
        ...(settledToolCallId !== undefined ? { toolCallId: settledToolCallId } : {}),
        state: 'output-denied',
        input,
        approval: next.approval,
      }
    default: {
      // Exhaustive at COMPILE time, defensive at RUNTIME. Binding `next` at `never` keeps tsc's
      // guarantee — add a state to `ToolCallPart` without a case above and this line stops
      // compiling — but this branch must NOT throw. `coalesceParts` is public, runs on the render
      // path, and folds wire data: a throw would turn one transient wire anomaly into a
      // permanently dead transcript (the same trade `spliceText` makes in merge.ts, where an
      // out-of-range offset is clamped rather than thrown on). An unrecognized state therefore
      // falls back to the incoming part with only the whitelisted carry-over fields folded in —
      // nothing state-specific from `existing` can leak, because `common` is all that is merged.
      const unhandled: never = next
      // Widened back deliberately: control-flow analysis would keep an annotated const at `never`
      // and make every field read below a compile error, so the assertion is what makes the
      // runtime value usable. It asserts nothing tsc has not already proved on the line above.
      const fallback = unhandled as ToolCallPart
      if (isDev()) {
        console.warn(
          `[basalt] coalesceParts: unrecognized tool state ${JSON.stringify(fallback.state)} — kept, merged best-effort`,
        )
      }
      return { ...fallback, ...common }
    }
  }
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
