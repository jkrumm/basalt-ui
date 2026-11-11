/**
 * The kind table of docs/v3/concepts/data-table.md section 5 as data: what each kind derives
 * (alignment, numerals, width, sort, card slot, default priority) and the shape every kind
 * column resolves to. `kinds.tsx` builds columns from it, `plan.ts` places them, the parts read
 * it. Types only plus one frozen table, no React.
 */
import type { ReactNode } from 'react'
import type { Format } from '../../core/format'
import type { Box, LinkComponent } from '../../core/ports'
import type { CardSlot, KindColumn, Priority, RowAction } from '../contract'
import type { SortFnName } from './features'

export type KindName =
  | 'entity'
  | 'text'
  | 'number'
  | 'money'
  | 'date'
  | 'relativeTime'
  | 'status'
  | 'delta'
  | 'meter'
  | 'boolean'
  | 'spark'
  | 'select'
  | 'actions'
  | 'custom'

/** Logical alignment of a column's header and cells (`start`/`end` follow the writing direction). */
export type Align = 'start' | 'end' | 'center'

/** `tabular` figures line up digit under digit; `proportional` is plain text. */
export type Numerals = 'tabular' | 'proportional'

/**
 * A kind's width: a fixed `ch` estimate, a flexible column with a `ch` floor that shares the rest,
 * or the icon column of `actions`. `plan.ts` turns it into pixels for the tier thresholds.
 */
export type Width = { ch: number; flex: boolean } | 'icon'

/** Where a column sits in the card projection: a `CardSlot`, or the card's kebab for `actions`. */
export type CardPlace = CardSlot | 'kebab'

/** What a cell renderer receives besides the row: the formatter, the clock, the box of a box slot. */
export type CellEnv = {
  format: Format
  /** Epoch ms for `relativeTime`; the parts pass one value per render so SSR and client agree. */
  now: number
  /** The box a `spark` draws in; the table owns its geometry. */
  box: Box
  /** Router link for `entity` `href`; a plain `<a>` without one. */
  Link?: LinkComponent
}

/** How a column sorts: a registered engine function, a comparator of two values, or not at all. */
export type SortRule = { fn: SortFnName } | { compare: (a: unknown, b: unknown) => number } | null

/** The edit of `c.select`: the cell editor itself lands with the parts (concept section 3). */
export type SelectEdit<T> = {
  label: (row: T) => string
  options: readonly string[]
  commit: (row: T, value: string) => unknown
}

/** Everything a kind decides for one column, resolved once when the column is built. */
export type KindSpec<T> = {
  id: string
  kind: KindName
  /** Header text; `money` and `number` with `unit` carry the unit here, never in the cell. */
  header: string
  /** The cell's raw value; `null` or `undefined` is absent and renders a muted dash. */
  value: (row: T) => unknown
  align: Align
  numerals: Numerals
  /** Only `text` wraps; every other cell holds one line, so widths are a plan, not a measurement. */
  wrap: boolean
  width: Width
  sort: SortRule
  filter: 'contains' | 'anyOf' | null
  /** Card slots in order of preference; `plan.ts` takes the first with room, then `detail`. */
  card: readonly CardPlace[]
  /** `null` for `actions`: never hidden by a tier. */
  priority: Priority | null
  pin: 'start' | 'end' | null
  /** `null` for `actions`, whose menu the parts render from `actions`. */
  render: ((row: T, env: CellEnv) => ReactNode) | null
  /** `status`: the closed option list (sort order and filter values). */
  options?: readonly string[]
  /** `actions`: the typed row actions. */
  actions?: readonly RowAction<T>[]
  /** `select`: the in-place edit. */
  edit?: SelectEdit<T>
}

/** Per-kind defaults, the section 5 table. Options may override `priority` and the first `card`. */
export type KindDefaults = {
  align: Align
  numerals: Numerals
  wrap: boolean
  width: Width
  sort: SortFnName | 'options' | 'declared' | null
  card: readonly CardPlace[]
  priority: Priority | null
}

export const KIND_DEFAULTS: Readonly<Record<KindName, KindDefaults>> = {
  entity: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 18, flex: true },
    sort: 'alphanumeric',
    card: ['title', 'subtitle', 'meta'],
    priority: 1,
  },
  text: {
    align: 'start',
    numerals: 'proportional',
    wrap: true,
    width: { ch: 16, flex: true },
    sort: 'alphanumeric',
    card: ['subtitle', 'meta'],
    priority: 2,
  },
  number: {
    align: 'end',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 10, flex: false },
    sort: 'basic',
    card: ['value', 'meta'],
    priority: 2,
  },
  money: {
    align: 'end',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'basic',
    card: ['value', 'meta'],
    priority: 1,
  },
  date: {
    align: 'start',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'datetime',
    card: ['meta'],
    priority: 3,
  },
  relativeTime: {
    align: 'start',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 10, flex: false },
    sort: 'datetime',
    card: ['meta'],
    priority: 3,
  },
  status: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'options',
    card: ['badge', 'meta'],
    priority: 2,
  },
  delta: {
    align: 'end',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 10, flex: false },
    sort: 'basic',
    card: ['meta'],
    priority: 3,
  },
  meter: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 14, flex: false },
    sort: 'basic',
    card: ['detail'],
    priority: 3,
  },
  boolean: {
    align: 'center',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 8, flex: false },
    sort: 'basic',
    card: ['meta'],
    priority: 3,
  },
  spark: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 20, flex: false },
    sort: null,
    card: ['detail'],
    priority: 2,
  },
  select: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 16, flex: false },
    sort: null,
    card: ['edit'],
    priority: 2,
  },
  actions: {
    align: 'end',
    numerals: 'proportional',
    wrap: false,
    width: 'icon',
    sort: null,
    card: ['kebab'],
    priority: null,
  },
  custom: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'declared',
    card: [],
    priority: null,
  },
}

/** The spec behind a built column; read through `specOf`, never off the object by a caller. */
export const KIND_SPEC: unique symbol = Symbol.for('basalt-ui.table.kind-spec')

/** The runtime shape of a kind column: the contract brand plus its spec under a symbol key. */
export type BuiltColumn<T> = KindColumn<T> & { readonly [KIND_SPEC]: KindSpec<T> }

/** Reads the spec behind a kind column; an object built by hand (no spec) throws. */
export function specOf<T>(column: KindColumn<T>): KindSpec<T> {
  const spec = (column as Partial<BuiltColumn<T>>)[KIND_SPEC]
  if (spec === undefined) {
    throw new Error(
      `basalt-ui/table: column "${String(column.id)}" was not built by col<T>(); use a kind constructor`,
    )
  }
  return spec
}
