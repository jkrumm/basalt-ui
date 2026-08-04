/**
 * Compile-time proof that `VirtualizeProps` actually rejects the invalid `virtualize`/`height`
 * combinations (not just documentation).
 *
 * This mirrors the `apps/playground/src/*.type-guard.ts` convention (one `@ts-expect-error` per bad
 * line, proven by CI's `tsc --noEmit`) but lives HERE, beside the type, rather than in the
 * playground app. `VirtualizeProps` IS public now (re-exported type-only from the agent-chat barrel
 * and the root), so a playground fixture would also work — this stays put because a source-relative
 * import proves the union at its definition, before the build, and needs no rebuild to stay honest.
 * A co-located `.type-guard.ts` file under `src/` would get picked up by tsup's
 * `src/**\/*.{ts,tsx}` build glob and ship an unused fixture in the published package; naming it
 * `*.test.ts` excludes it from that glob (tsup.config.ts excludes `src/**\/*.test.{ts,tsx}`) while
 * this package's own `tsc --noEmit` (and `bun test`, which type-checks test files per the repo
 * convention) still verifies it.
 */
import { describe, expect, test } from 'bun:test'
import type { VirtualizeProps } from './virtualize'

function accept(props: VirtualizeProps): VirtualizeProps {
  return props
}

// ── Valid combinations — must type-check with no error ────────────────────────

accept({})
accept({ virtualize: false })
accept({ virtualize: true, height: 400 })
accept({ virtualize: true, height: '100%' })
accept({ virtualize: { overscan: 3 }, height: 400 })
accept({ virtualize: { estimateSize: 72 }, height: '50vh' })

// ── Invalid combinations — each MUST be a tsc error, one directive per bad line ─

// @ts-expect-error `height` is forbidden when `virtualize` is false
accept({ virtualize: false, height: 400 })
// @ts-expect-error `height` is required when `virtualize: true`
accept({ virtualize: true })
// @ts-expect-error `height` is required when `virtualize` is a VirtualizeOptions object
accept({ virtualize: { overscan: 2 } })
// @ts-expect-error `height` is forbidden when `virtualize` is omitted (defaults to the `false` branch)
accept({ height: 400 })

describe('VirtualizeProps (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    // No runtime behavior to assert: the proof is that this file type-checks at all. A single
    // trivial assertion keeps this a normal bun:test file rather than an empty-suite oddity.
    expect(true).toBe(true)
  })
})
