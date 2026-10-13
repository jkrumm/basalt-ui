/**
 * Compile-time proof for F24: `cssVariablesResolver` is the resolver `BasaltProvider` exists to
 * install, and a consumer must not be able to silently override it via the passthrough
 * `MantineProviderProps` rest. `BasaltProviderProps` `Omit`s it from the accepted rest type, so
 * passing one directly is unwritable — proven here the same way `controls/actions.type-guard.test.ts`
 * pins law C6: one `@ts-expect-error` per bad line, proven by `tsc --noEmit`.
 */
import { describe, expect, test } from 'bun:test'
import type { BasaltProviderProps } from './index'

function accept(props: BasaltProviderProps): BasaltProviderProps {
  return props
}

// ── Valid — must type-check with no error ─────────────────────────────────────

const router = {} as BasaltProviderProps['router']

accept({ router })
accept({ router, telemetry: (e) => void e.type, fallback: (error) => String(error) })

// ── Invalid — must be a tsc error ──────────────────────────────────────────────

// @ts-expect-error `router` is required — the provider mounts it (V2-SPEC § 2).
accept({})

// @ts-expect-error `children` is gone: the provider mounts the router, not a subtree.
accept({ router, children: null })

// @ts-expect-error `cssVariablesResolver` is Omitted from the accepted rest type (F24) — the
// resolver reaching MantineProvider must always be basalt's own, never a consumer's.
accept({ router, cssVariablesResolver: (() => ({})) as never })

describe('BasaltProviderProps (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directive above', () => {
    expect(true).toBe(true)
  })
})
