/**
 * Compile-time proof for F24: `cssVariablesResolver` is the resolver `BasaltProvider` exists to
 * install, and a consumer must not be able to silently override it via the passthrough
 * `MantineProviderProps` rest. `BasaltProviderProps` `Omit`s it from the accepted rest type, so
 * passing one directly is unwritable — proven here the same way `controls/actions.type-guard.test.ts`
 * pins law C6: one `@ts-expect-error` per bad line, proven by `tsc --noEmit`.
 */
import { describe, expect, test } from 'bun:test'
import { createRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { BasaltProviderProps } from './index'
import type { BasaltRouter } from './create-router'

function accept(props: BasaltProviderProps): BasaltProviderProps {
  return props
}

// ── Valid — must type-check with no error ─────────────────────────────────────

const router = {} as BasaltRouter
const children = null as ReactNode

accept({ router })
// Embedded mode: inside a router the app does not own, the subtree replaces `router`.
accept({ children })
accept({ children, spotlight: false })
accept({ router, telemetry: (e) => void e.type, fallback: (error) => String(error) })

// ── Invalid — must be a tsc error ──────────────────────────────────────────────

// @ts-expect-error one of `router` (mount) or `children` (embedded) is required.
accept({})

// @ts-expect-error a hand-built router (plain `createRouter`) lacks the `createBasaltRouter` brand —
// it would reach the provider without `context.queryClient` and basalt's router defaults.
accept({ router: {} as ReturnType<typeof createRouter> })

// @ts-expect-error a router to mount and a subtree are exclusive — never both.
accept({ router, children })

// @ts-expect-error `cssVariablesResolver` is Omitted from the accepted rest type (F24) — the
// resolver reaching MantineProvider must always be basalt's own, never a consumer's.
accept({ router, cssVariablesResolver: (() => ({})) as never })

describe('BasaltProviderProps (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directive above', () => {
    expect(true).toBe(true)
  })
})
