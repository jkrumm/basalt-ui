/**
 * Compile-time guards of `col<T>()`: a raw column or a free `cell` is not a `KindColumn`, a key is
 * checked against the kind's value type, and `custom` must declare its three fields. One
 * `@ts-expect-error` per bad line; tsc is the test, the runtime body only keeps bun from skipping.
 */
import { describe, expect, test } from 'bun:test'
import type { KindColumn, UseDataTable } from '../contract'
import { col } from './kinds'

type Row = { id: string; name: string; amount: number; at: string; active: boolean }
const c = col<Row>()

export const ok: readonly KindColumn<Row>[] = [
  c.entity('name'),
  c.money('amount', { currency: 'EUR' }),
  c.relativeTime('at'),
  c.boolean('active'),
  c.custom('score', { render: () => null, sortValue: (r) => r.amount, card: 'meta', priority: 3 }),
]

export const raw: readonly KindColumn<Row>[] = [
  // @ts-expect-error a raw TanStack column is not a KindColumn
  { accessorKey: 'name', header: 'Name' },
]

export const rawInOptions: Pick<UseDataTable<Row>, 'columns'> = {
  // @ts-expect-error a raw column cannot reach useDataTable's columns
  columns: [{ id: 'name', cell: () => 'x' }],
}

// @ts-expect-error a free `cell` is not an option of any kind
export const freeCell = () => c.text('name', { cell: () => 'x' })

// @ts-expect-error money takes a number key; `name` is a string
export const wrongKey = () => c.money('name', { currency: 'EUR' })

// @ts-expect-error a key off Row is refused
export const unknownKey = () => c.text('nope')

// @ts-expect-error money needs its currency (the unit lands in the header)
export const noCurrency = () => c.money('amount', {})

// @ts-expect-error alignment is derived from the kind, never an option
export const align = () => c.money('amount', { currency: 'EUR', align: 'start' })

// @ts-expect-error custom must declare sortValue
export const noSortValue = () => c.custom('x', { render: () => null, card: 'meta', priority: 3 })

// @ts-expect-error custom must declare card and priority
export const noCard = () => c.custom('x', { render: () => null, sortValue: () => 0 })

// @ts-expect-error a codec names kinds only, never options or closures
export const codecClosure = () => c.codec({ amount: { kind: 'money' } })

// @ts-expect-error actions has no value in state, so a codec cannot name it
export const codecActions = () => c.codec({ actions: 'actions' })

describe('col<T>() (type-guard)', () => {
  test('is a compile-time fixture: see the @ts-expect-error directives above', () => {
    expect(ok).toHaveLength(5)
  })
})
