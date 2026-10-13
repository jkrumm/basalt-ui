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
import { resolveRowHeight } from './virtualize'
import type { RowHeightProps, VirtualizeProps } from './virtualize'

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

// ── B3 — RowHeightProps widens ONLY the `height`-without-`virtualize` branch ──────────────────
// `ThreadFeedRow`'s own contract (RowHeightProps) allows what VirtualizeProps forbids above —
// `height` with no `virtualize` — while keeping the virtualized branch identical.

function acceptRowHeight(props: RowHeightProps): RowHeightProps {
  return props
}

acceptRowHeight({})
acceptRowHeight({ virtualize: false })
// The one combination VirtualizeProps' own type-guard rejects at line 35 above — RowHeightProps
// widens exactly this.
acceptRowHeight({ virtualize: false, height: 400 })
acceptRowHeight({ height: 400 })
acceptRowHeight({ virtualize: true, height: 400 })
acceptRowHeight({ virtualize: { overscan: 3 }, height: 400 })

// @ts-expect-error `height` is still required when `virtualize: true` — B3 does not touch this half
acceptRowHeight({ virtualize: true })

describe('resolveRowHeight (B3)', () => {
  test('virtualize: true|VirtualizeOptions resolves to the "virtualized" branch, unchanged from resolveVirtualize', () => {
    expect(resolveRowHeight({ virtualize: true, height: 400 })).toEqual({
      kind: 'virtualized',
      virtualize: { options: {}, height: 400 },
    })
    expect(resolveRowHeight({ virtualize: { overscan: 3 }, height: '50vh' })).toEqual({
      kind: 'virtualized',
      virtualize: { options: { overscan: 3 }, height: '50vh' },
    })
  })

  test('height alone (no virtualize) resolves to the new "bounded" branch', () => {
    expect(resolveRowHeight({ height: 300 })).toEqual({ kind: 'bounded', height: 300 })
    expect(resolveRowHeight({ virtualize: false, height: '50%' })).toEqual({
      kind: 'bounded',
      height: '50%',
    })
  })

  test('neither height nor virtualize resolves to "content-sized"', () => {
    expect(resolveRowHeight({})).toEqual({ kind: 'content-sized' })
    expect(resolveRowHeight({ virtualize: false })).toEqual({ kind: 'content-sized' })
  })
})
