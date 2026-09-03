/**
 * Compile-time proof that `BasaltDevDockProps.router` accepts a real TanStack `Router` class
 * instance with no cast. The prior structural stand-in (`{ __routerHasBeenSetup?: unknown } |
 * Record<string, unknown>`) failed TS weak-type detection against a class instance on both
 * branches — no property overlap on branch 1, no index signature on branch 2 — so argo had to
 * write `router={router as never}`. `router?: object` is the fix: any non-null object, including
 * one with no index signature, is assignable.
 */
import { describe, expect, test } from 'bun:test'
import type { BasaltDevDockProps } from './dev-dock'

function accept(router: BasaltDevDockProps['router']): BasaltDevDockProps['router'] {
  return router
}

// A structural stand-in for `@tanstack/react-router`'s `Router` — a class instance, so it has no
// index signature and no `__routerHasBeenSetup` field either.
class FakeRouter {
  subscribe(): void {}
}

accept(new FakeRouter())
accept({})
accept({ __routerHasBeenSetup: true })
// PROVES: a real router-shaped class instance is assignable to `router` with no cast.

describe('dev-dock.tsx (type-guard)', () => {
  test('is a compile-time-only fixture — see the assignments above', () => {
    expect(true).toBe(true)
  })
})
