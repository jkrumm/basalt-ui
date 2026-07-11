// J.5 apps/playground/src/demo/agent-part.type-guard.ts
//
// PROVES: AgentPart exhaustiveness is enforced via assertNever — adding a variant without a case
// is a tsc error. Mirrors the asyncstate-fourth-variant.type-guard.ts mechanism (fixture J.4).
//
// The production path: PartList's switch ends with `default: return assertNever(part)` using the
// same mechanism — this fixture proves the gate works end-to-end at compile time.
import { assertNever } from 'basalt-ui'
import type { AgentPart } from 'basalt-ui/agent'

// ── Fixture 1: the known union is fully exhausted — no tsc error ─────────────

export function describeKnownPart(part: AgentPart): string {
  switch (part.type) {
    case 'start':
      return `[start] ${part.runId}`
    case 'text':
      return part.text
    case 'reasoning':
      return `[think] ${part.text}`
    case 'tool':
      return `[tool] ${part.toolName}`
    case 'source':
      return part.url
    case 'error':
      return `[err] ${part.message}`
    default:
      // All variants handled — `part` is `never` here, assertNever is valid.
      return assertNever(part)
  }
}

// ── Fixture 2: an extra variant without a case IS a tsc error ────────────────
//
// Extends AgentPart with a hypothetical 'thinking' variant that has no case below.
// The switch's default calls assertNever — tsc errors because `s` is not `never`
// (the 'thinking' variant is unhandled).

type ThinkingPart = { type: 'thinking'; text: string }
type ExtendedPart = AgentPart | ThinkingPart

export function describeExtended(part: ExtendedPart): string {
  switch (part.type) {
    case 'text':
      return part.text
    case 'reasoning':
      return `[think] ${part.text}`
    case 'tool':
      return `[tool] ${part.toolName}`
    case 'source':
      return part.url
    case 'error':
      return `[err] ${part.message}`
    default:
      // @ts-expect-error 'thinking' is unhandled — `part` is not `never`, assertNever rejects it
      return assertNever(part)
  }
}

// PROVES: basalt-ui/agent's AgentPart exhaustiveness is real — any unhandled variant is a
// tsc error via assertNever. This gates PartList's exhaustive switch enforcement.
