/**
 * V2-SPEC §3 (law C6): `PageBar.actions` is one primary then up to four more; `Section.actions`
 * holds at most three. Both are tuple types, so the budget is a tsc error, not a lint rule.
 */
import { expect, test } from 'bun:test'
import type { PageBarActions, SectionActions } from './actions'

const A = { key: 'a', label: 'A' } as const
const P = { key: 'p', label: 'P', primary: true } as const

export const ok1: PageBarActions = [P]
export const ok5: PageBarActions = [P, A, A, A, A]
// @ts-expect-error a sixth action
export const six: PageBarActions = [P, A, A, A, A, A]
// @ts-expect-error no primary
export const none: PageBarActions = []
// @ts-expect-error the first entry must be the primary
export const unflagged: PageBarActions = [A]
// @ts-expect-error a second primary
export const two: PageBarActions = [P, P]

export const s0: SectionActions = []
export const s3: SectionActions = [A, A, A]
// @ts-expect-error a fourth section action
export const s4: SectionActions = [A, A, A, A]

test('the tuple types compile', () => {
  expect([ok1, ok5, s0, s3].length).toBe(4)
})
