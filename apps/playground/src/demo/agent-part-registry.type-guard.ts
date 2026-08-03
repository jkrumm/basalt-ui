// B2 lane 2: apps/playground/src/demo/agent-part-registry.type-guard.ts
//
// PROVES the augmented half of the open part-renderer registry (`definePartRenderers` /
// `ConsumerPart` / `PartRenderers`, packages/basalt-ui/src/agent/foreign.ts): once
// `BasaltRegister.parts` is augmented, `definePartRenderers` requires every registered key (a
// MISSING key is a tsc error) and narrows each renderer's `part` to exactly its own variant.
//
// A STALE (extra, unregistered) key is NOT caught here — verified empirically against this repo's
// tsc (6.0.3): excess-property checking, which is what would normally flag an extra object-literal
// key, does not fire at a `<const T extends Constraint>` call site the way it does for a literal
// assigned directly to a fixed target type. Fixture 3 below demonstrates this (a stale key
// compiles clean, not a `@ts-expect-error`) rather than asserting a directive that would itself be
// unused-and-therefore-erroring. See `foreign.ts`'s `PartRenderers` doc comment for the same
// correction, and the B2 lane-2 handover for why this was kept as a documented gap rather than
// papered over with a non-canonical factory signature (an `Exact<T, Shape>` wrapper would work,
// but breaks the "canonical token-factory contract"'s `spec: T` shape that every other `defineX`
// in this codebase — `defineSeries`, `defineNotifications`, `defineCommands` — follows verbatim).
//
// The UN-augmented half (a loose string-keyed map with zero augmentation) is proven instead in
// packages/basalt-ui/src/agent/foreign.test.ts, which compiles under basalt-ui's own tsconfig
// where `BasaltRegister` is never augmented. This file's `declare module 'basalt-ui'` block below
// is program-wide the instant it's part of this tsconfig's `src` glob — an un-augmented case
// cannot coexist with it inside the same compilation, so it isn't attempted here.
import { definePartRenderers } from 'basalt-ui/agent'

type ToolProgressPart = { type: 'data-toolProgress'; id: string; tool: string; message: string }
type ChartPart = {
  type: 'data-chart'
  id: string
  spec: { title: string; data: { label: string; value: number }[] }
}

declare module 'basalt-ui' {
  interface BasaltRegister {
    parts: ToolProgressPart | ChartPart
  }
}

// ── Fixture 1: exact registration compiles — no tsc error ────────────────────

export const registryRenderers = definePartRenderers({
  'data-toolProgress': ({ part }) => `${part.tool}: ${part.message}`,
  'data-chart': ({ part }) => part.spec.title,
})

// ── Fixture 2: omitting a registered key is a tsc error ──────────────────────

// @ts-expect-error 'data-chart' is missing — definePartRenderers requires every registered key.
export const missingKey = definePartRenderers({
  'data-toolProgress': ({ part }) => `${part.tool}: ${part.message}`,
})

// ── Fixture 3: a stale/unregistered key — documented gap, NOT a tsc error ────
//
// This is the one place this fixture diverges from AGENT-CHAT-SPEC.md's claim ("a stale key is a
// tsc error"): `const T extends Constraint` inference does not excess-property-check an object
// literal argument the way a direct assignment to a fixed target type would, so an extra key here
// compiles clean. No `@ts-expect-error` — asserting one would itself be a tsc error (an unused
// directive), which is exactly how this gap was found.

export const staleKey = definePartRenderers({
  'data-toolProgress': ({ part }) => `${part.tool}: ${part.message}`,
  'data-chart': ({ part }) => part.spec.title,
  'data-unknown': () => 'nope', // dead code, but NOT a compile error — see comment above
})

// ── Fixture 4: each renderer's `part` narrows to exactly its own variant ─────

export const narrowedRenderers = definePartRenderers({
  'data-toolProgress': ({ part }) => {
    // @ts-expect-error `part` here is ToolProgressPart, not ChartPart — `spec` doesn't exist on it.
    return part.spec
  },
  'data-chart': ({ part }) => {
    // @ts-expect-error `part` here is ChartPart, not ToolProgressPart — `tool` doesn't exist on it.
    return part.tool
  },
})

// PROVES: the augmented half of foreign.ts's registry is real — exhaustive (Fixture 2) and narrows
// per-variant (Fixture 4). It is NOT closed to stale keys (Fixture 3 above is the documented gap,
// not a refutation of it). This is the compile-time contract ThreadTranscript's `renderers` prop
// (thread-message.tsx) depends on, gap included.
