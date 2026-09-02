/**
 * Compile-time regression guards for `register.ts` — absorbed from two of the playground's five
 * non-router type-guard fixtures (audit E §7): `asyncstate-fourth-variant.type-guard.ts` (J.4) and
 * `register-augments-nothing.type-guard.ts` (J.1). `register-augments-all.type-guard.ts` (J.2)
 * stays in the app — it needs a REAL `declare module 'basalt-ui' { interface BasaltRegister }`
 * augmentation resolving through the package's own name, which nothing else in this package's own
 * test suite does (every internal test imports relatively, never as `from 'basalt-ui'`).
 */
import { describe, expect, test } from 'bun:test'
import { assertNever } from './register'
import type { AsyncState, Slot } from './register'

// ── J.4 — AsyncState exhaustiveness via assertNever ──────────────────────────────────────────────

type Extended = AsyncState<number> | { status: 'refreshing'; data: number }

export function render(s: Extended): string {
  switch (s.status) {
    case 'idle':
      return 'idle'
    case 'loading':
      return 'loading'
    case 'success':
      return String(s.data)
    case 'error':
      return String(s.error)
    default:
      // @ts-expect-error 'refreshing' is unhandled — `s` is not `never`, assertNever rejects it
      return assertNever(s)
  }
}
// PROVES: adding a variant without a case is a tsc error via assertNever.

// ── J.1 — an un-augmented Slot defaults to the never-keyed empty object ─────────────────────────

type Empty = Slot<'nonexistent', Record<string, unknown>>

export function f1(): keyof Empty {
  // @ts-expect-error keyof {} is `never` — a string key is NOT assignable, proving {} (keyof→never),
  // NOT Record<string,never> (keyof→string).
  return 'anyKey'
}
// PROVES: an un-augmented slot defaults to never-keyed {}. Locks the {} vs Record<string,never> footgun.

describe('register.ts (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    expect(true).toBe(true)
  })
})
