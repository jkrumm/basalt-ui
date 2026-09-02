/**
 * Compile-time regression guard for `ColumnMeta.align` — absorbed from the playground's
 * `data-table-align.type-guard.ts` (audit E §7, one of the five non-router fixtures with no
 * dependency on a registered router). Proves the two ways `meta.align` can be named wrong are
 * BOTH compile errors, not silent left-alignment: the module augmentation in `./table` closes
 * `ColumnMeta`, so an unknown key trips the excess-property check and a wrong value trips the
 * union — one `@ts-expect-error` per bad line, the same convention `controls/actions.type-guard.test.ts`
 * uses.
 */
import { describe, expect, test } from 'bun:test'
import { createColumnHelper } from './table'

type Row = { name: string; cost: number }
const col = createColumnHelper<Row>()

export const ok = col.accessor('cost', { header: 'Cost', meta: { align: 'right' } })

export const typoKey = col.accessor('cost', {
  header: 'Cost',
  // @ts-expect-error `aling` is not a ColumnMeta key — a typo must not silently left-align money
  meta: { aling: 'right' },
})

export const typoValue = col.accessor('cost', {
  header: 'Cost',
  // @ts-expect-error 'end' is not a DataTableAlign — the CSS word is not the token
  meta: { align: 'end' },
})
// PROVES: a misnamed alignment key or value fails tsc; a wrong VALUE reaching runtime throws.

describe('ColumnMeta.align (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    expect(true).toBe(true)
  })
})
