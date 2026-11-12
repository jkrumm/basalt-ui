/**
 * `filterOnCell` is typed per kind: `true` on `text`, `entity` and `status`, an error on any other.
 * Checked by `tsc`, run by `make check`; this file executes nothing.
 */
import type { CellFilterOption } from './cell-filter'

// The kinds that can filter by their cell value.
export const text: CellFilterOption<'text'> = { filterOnCell: true }
export const entity: CellFilterOption<'entity'> = { filterOnCell: true }
export const status: CellFilterOption<'status'> = { filterOnCell: true }
export const off: CellFilterOption<'text'> = {}

// `money` has no `f.<col>` in grammar v1, so `filterOnCell: true` is a type error.
// @ts-expect-error -- a money cell is not filterable
export const money: CellFilterOption<'money'> = { filterOnCell: true }

// @ts-expect-error -- a number cell is not filterable
export const number: CellFilterOption<'number'> = { filterOnCell: true }

// @ts-expect-error -- a boolean cell is not filterable
export const boolean: CellFilterOption<'boolean'> = { filterOnCell: true }

// A non-filterable kind takes no `filterOnCell` at all, so `false` is not a spelling of "off" either.
export const none: CellFilterOption<'money'> = {}
