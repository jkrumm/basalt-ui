/**
 * foreign.ts — the open half of the transcript's part-rendering registry.
 *
 * `AgentPart` (`./parts`) is a closed, exhaustively-switched union — adding a variant without
 * updating every consuming switch is a tsc error (`PartList`'s `assertNever` gate). A transport
 * that streams app-specific structured data (a chart spec, a progress ping) needs a part type
 * `AgentPart` will never carry — closing the union around it would defeat the whole point of the
 * gate. This file is the seam: `ForeignPart` describes what basalt does NOT know, `ConsumerPart`
 * resolves the augmented union a consumer registers via `declare module 'basalt-ui'`, and
 * `definePartRenderers` types an exhaustive renderer map against it. See
 * `agent-chat/thread-message.tsx`'s three-step resolution order for how this plugs into
 * `ThreadTranscript`: a consumer renderer wins first, `narrowAgentPart` routes the built-in six to
 * `PartList`'s own exhaustive switch second, and `fallbackRenderer` catches anything left.
 *
 * @example
 * // app-side: src/features/chat/parts.ts
 * type ChartPart = { type: 'data-chart'; id: string; spec: ChartSpec }
 * declare module 'basalt-ui' {
 *   interface BasaltRegister { parts: ChartPart }
 * }
 * export const chatRenderers = definePartRenderers({
 *   'data-chart': ({ part, settled }) => (settled ? <Chart spec={part.spec} /> : <ChartSkeleton />),
 * })
 */
import type { ReactNode } from 'react'
import type { BasaltRegister } from '../register'
import type { ChatMessage } from './history'
import type { AgentPart } from './parts'

// ── ForeignPart / TranscriptPart ──────────────────────────────────────────────

/** A part basalt does not know. NOT a member of AgentPart — the built-in union stays closed. */
export type ForeignPart = {
  readonly type: string
  readonly id: string
  readonly [k: string]: unknown
}

/** What a transcript actually holds — basalt's own six variants plus anything a consumer registers. */
export type TranscriptPart = AgentPart | ForeignPart

// ── ConsumerPart ───────────────────────────────────────────────────────────────
//
// JUDGMENT POINT — this is a sibling conditional, NOT a reuse of `register.ts`'s `Slot<K,
// Constraint>`, and deliberately so:
//
// `Slot<K, Constraint>` is built for MAP-shaped slots (series, commands, overlays,
// notifications): its un-augmented fallback is the never-keyed empty object `{}`, which is the
// correct zero for a MAP (`keyof {}` is `never`, so the derived key-union — e.g. `SeriesKey` — is
// `never` too). `parts` is UNION-shaped, not map-shaped: there is no key to look anything up by,
// the type itself IS the legal value set. So the un-augmented fallback here has to be `never`
// (the empty union), not `{}`.
//
// Concretely, reusing `Slot<'parts', ForeignPart>` would hand back `{}` when un-augmented (an
// empty object does not itself satisfy `ForeignPart`'s `{ type: string; id: string }` shape, but
// `Slot`'s fallback branch returns it unconditionally regardless of `Constraint`), and then
// `PartRenderers` below — which reads `ConsumerPart['type']` on the augmented branch and checks
// `[ConsumerPart] extends [never]` to pick between the two branches — would see a non-`never`,
// property-less `{}` and take the WRONG branch (or fail to compile the indexed access) even with
// zero augmentation, exactly the case that must compile cleanly. `Slot`'s fallback isn't a
// parameter (nor should it be — every existing map slot wants `{}`), so this is a sibling
// conditional purpose-built for a union slot, not a gap in `Slot` itself.
/** The consumer's registered foreign-part union, or `never` when un-augmented. */
export type ConsumerPart = BasaltRegister extends { parts: infer P extends ForeignPart } ? P : never

// ── PartRenderers ────────────────────────────────────────────────────────────

/**
 * Un-augmented: a loose string-keyed map (any renderer, any key — there is nothing to check
 * against). Augmented: a MISSING key is a tsc error (`definePartRenderers` requires the full
 * registered union), and each renderer's `part` is narrowed to exactly its variant. Same
 * bound-check mechanism as `SeriesKey` (`register.ts:26-58`), applied to a union instead of a map.
 *
 * NOT caught: a STALE (extra, unregistered) key. `<const T extends Constraint>` inference does
 * not excess-property-check an object-literal argument the way a direct assignment to a fixed
 * target type would (verified against this repo's tsc — see
 * `apps/playground/src/demo/agent-part-registry.type-guard.ts`'s Fixture 3) — an extra key
 * compiles as dead code rather than erroring. Catching it would need an `Exact<T, Shape>`-style
 * wrapper that departs from the `spec: T` "canonical token-factory contract" every other `defineX`
 * in this codebase follows verbatim; that trade was left as a documented gap rather than a one-off
 * factory shape.
 */
export type PartRenderers = [ConsumerPart] extends [never]
  ? Readonly<Record<string, PartRenderer<ForeignPart>>>
  : { readonly [K in ConsumerPart['type']]: PartRenderer<Extract<ConsumerPart, { type: K }>> }

/** Everything a foreign-part renderer needs beyond the part itself. */
export type PartRenderContext<TPart = ForeignPart> = {
  readonly part: TPart
  readonly messageId: string
  readonly partId: string
  /** false while this part belongs to the in-flight tail of a streaming turn. */
  readonly settled: boolean
  readonly role: ChatMessage['role']
}

export type PartRenderer<TPart = ForeignPart> = (ctx: PartRenderContext<TPart>) => ReactNode

/**
 * Canonical const-generic factory (`packages/basalt-ui/CLAUDE.md`, "Canonical token-factory
 * contract") — identity passthrough, exact-keyed return, no builder, no config bag. Mirrors
 * `defineSeries` (`tokens/index.ts:648-650`) and `defineNotifications`
 * (`notifications/define-notifications.ts:112-115`).
 *
 * @example
 * const chatRenderers = definePartRenderers({
 *   'data-chart': ({ part }) => <Chart spec={part.spec} />,
 * })
 */
export function definePartRenderers<const T extends PartRenderers>(map: T): T {
  return map
}

// ── narrowAgentPart ──────────────────────────────────────────────────────────

const AGENT_PART_TYPES: ReadonlySet<string> = new Set([
  'start',
  'text',
  'reasoning',
  'tool',
  'source',
  'error',
])

/**
 * Returns `part` as an `AgentPart` when its `type` is one of the six built-in variants, else
 * `null`. Deliberately NOT routed through `parseAgentPart`: that function is a VALIDATING parser
 * for untrusted wire data — it checks every field a variant requires (`runId`, `toolCallId`,
 * `approval`, ...) and would reject an already-well-typed in-memory `AgentPart` on shape grounds
 * if it doesn't happen to match the wire representation byte-for-byte. `narrowAgentPart` is the
 * cheap complement: a plain discriminator check on a value already known to be a `TranscriptPart`,
 * used purely to route rendering — it trusts the caller's typing rather than re-validating it.
 *
 * @example
 * const agentPart = narrowAgentPart(part)
 * if (agentPart !== null) return <PartList parts={[agentPart]} />
 */
export function narrowAgentPart(part: TranscriptPart): AgentPart | null {
  return AGENT_PART_TYPES.has(part.type) ? (part as AgentPart) : null
}
