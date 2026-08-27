/**
 * Compile-time proof that law C6's "exactly one primary" is a TYPE fact, not a runtime check.
 *
 * `ActionGroupProps.primary` is singular, so a second one is unwritable: an array is rejected, and
 * a duplicate object key is a tsc error in its own right. This mirrors the
 * `apps/playground/src/*.type-guard.ts` convention (one `@ts-expect-error` per bad line, proven by
 * `tsc --noEmit`) but lives beside the type, exactly as `agent-chat/virtualize.type-guard.test.ts`
 * does — and for the same packaging reason: a bare `*.type-guard.ts` under `src/` would be picked
 * up by tsup's build glob and ship an unused fixture, while `*.test.ts` is excluded from it.
 */
import { describe, expect, test } from 'bun:test'
import type { ActionGroupProps, BarAction, GlobalAction } from './actions'

function accept(props: ActionGroupProps): ActionGroupProps {
  return props
}

function acceptAction(action: BarAction): BarAction {
  return action
}

function acceptGlobal(action: GlobalAction): GlobalAction {
  return action
}

// ── Valid — must type-check with no error ─────────────────────────────────────

accept({})
accept({ primary: { key: 'a', label: 'A' } })
accept({ primary: { key: 'a', label: 'A' }, secondary: [{ key: 'b', label: 'B' }] })
accept({ secondary: [{ key: 'm', kind: 'menu', label: 'Export as', items: [] }] })
accept({ primary: { key: 'c', kind: 'custom', node: null } })
acceptAction({ key: 'a', label: 'A', mobile: 'hidden', danger: true })
acceptGlobal({ key: 'g', node: null, mobile: 'bar' })

// ── Invalid — each MUST be a tsc error, one directive per bad line ────────────

const TWO: BarAction[] = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
]
// @ts-expect-error a SECOND primary is unwritable: `primary` is one action, never a list
accept({ primary: TWO })
// @ts-expect-error `secondary` is the list; a single action is not one
accept({ secondary: { key: 'b', label: 'B' } })
// @ts-expect-error a `kind: 'menu'` group has no mobile placement — it always folds
acceptAction({ key: 'm', kind: 'menu', label: 'M', items: [], mobile: 'bar' })
// @ts-expect-error a `kind: 'custom'` action carries a node, never a label
acceptAction({ key: 'c', kind: 'custom', node: null, label: 'C' })
// @ts-expect-error `label` is required on a button-shaped action
acceptAction({ key: 'a' })
// @ts-expect-error 'sheet' is not a mobile placement
acceptAction({ key: 'a', label: 'A', mobile: 'sheet' })
// @ts-expect-error a GlobalAction is data, not a bare node
acceptGlobal({ node: null })

describe('ActionGroupProps (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    // No runtime behavior to assert: the proof is that this file type-checks at all. A single
    // trivial assertion keeps this a normal bun:test file rather than an empty-suite oddity.
    expect(true).toBe(true)
  })
})
