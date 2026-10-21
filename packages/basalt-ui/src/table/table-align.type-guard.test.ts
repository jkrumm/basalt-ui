/**
 * Compile-time regression guard for the feature set's `columnMeta: metaHelper<BasaltColumnMeta>()`
 * slot — absorbed from the playground's `data-table-align.type-guard.ts` (audit E §7) and the W1
 * spike's `table-v9.type-guard.ts`. Proves the ways a column can be named wrong are compile errors,
 * not silent left-alignment or a runtime `undefined`: the per-table slot closes `meta` WITHOUT a
 * global `declare module '@tanstack/react-table'` augmentation, so an unknown key trips the
 * excess-property check, a wrong value trips the union, and an unknown accessor key trips
 * `DeepKeys<Row>` — one `@ts-expect-error` per bad line, the same convention
 * `controls/actions.type-guard.test.ts` uses.
 */
import { describe, expect, test } from 'bun:test'
import { createColumnHelper } from './index'
import type { DataTableRowAction } from './index'

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
export const okKind = col.accessor('cost', {
  header: 'Cost (USD)',
  meta: { kind: 'money', currency: 'EUR', meterMax: 10, statusColor: (v) => String(v) },
})

export const typoKind = col.accessor('cost', {
  header: 'Cost',
  // @ts-expect-error `kinds` is not a ColumnMeta key
  meta: { kinds: 'money' },
})

export const badKindValue = col.accessor('cost', {
  header: 'Cost',
  // @ts-expect-error 'currency' is not a DataTableColumnKind — the seven kinds are a closed union
  meta: { kind: 'currency' },
})

export const unknownKey = [
  // @ts-expect-error 'nope' is not a DeepKeys<Row> — createColumnHelper<Row> rejects it
  col.accessor('nope', { header: 'Nope' }),
]
// PROVES: a misnamed alignment key or value, or an accessor naming a key off Row, fails tsc; a wrong VALUE reaching runtime throws.

describe('ColumnMeta.align (type-guard)', () => {
  test('is a compile-time-only fixture — see the @ts-expect-error directives above', () => {
    expect(true).toBe(true)
  })
})

describe('DataTableRowAction (type-guard)', () => {
  test('is importable from the barrel and types onClick by the row', () => {
    type ActionRow = { id: string }
    const ok: DataTableRowAction<ActionRow> = {
      key: 'delete',
      label: 'Delete',
      onClick: (row) => void row.id,
    }
    const bad: DataTableRowAction<ActionRow> = {
      key: 'x',
      label: 'X',
      // @ts-expect-error — onClick receives the row type, not a number
      onClick: (row: number) => void row,
    }
    void [ok, bad]
  })
})
