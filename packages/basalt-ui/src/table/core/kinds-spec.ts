/**
 * The kind table of docs/v3/concepts/data-table.md section 5 as data: what each kind derives
 * (alignment, numerals, width, sort, card slot, default priority) and the shape every kind
 * column resolves to. `kinds.tsx` builds columns from it, `plan.ts` places them, the parts read
 * it. Types only plus one frozen table, no React.
 */
import type { ReactNode } from 'react'
import type { Format } from '../../core/format'
import type { Box, IconComponent, Tone } from '../../core/ports'
import type {
  Aggregate,
  CardSlot,
  DateRangeLike,
  KindColumn,
  Priority,
  RowAction,
} from '../contract'
import type { SortFnName } from './features'

export type KindName =
  | 'entity'
  | 'person'
  | 'tags'
  | 'countdown'
  | 'link'
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

/** The kinds whose value is a date: a range filter compares calendar days and a group is one day. */
export const isDayKind = (kind: string): boolean =>
  kind === 'date' || kind === 'relativeTime' || kind === 'countdown'

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
  /** Epoch ms for `relativeTime` and `countdown`; the parts pass one value per render so SSR and client agree. */
  now: number
  /** The IANA zone a `countdown` counts calendar days in, `'host'` for the runtime's; absent reads UTC. */
  zone?: string | undefined
  /** The box a `spark` draws in; the table owns its geometry. */
  box: Box
}

/** How a column sorts: a registered engine function, a comparator of two values, or not at all. */
export type SortRule = { fn: SortFnName } | { compare: (a: unknown, b: unknown) => number } | null

/** The edit of `c.select`: the cell editor itself lands with the parts (concept section 3). */
export type SelectEdit<T> = {
  label: (row: T) => string
  options: readonly string[]
  commit: (row: T, value: string) => unknown
}

/** The reduce a column's footer and group rows print (concept section 3, Footer). */
export type { Aggregate }

/** A numeric column's footer: the reduce and how its result reads in this kind. */
export type FooterSpec = {
  fn: Aggregate
  draw: (value: number, env: CellEnv) => ReactNode
}

/** Everything a kind decides for one column, resolved once when the column is built. */
export type KindSpec<T> = {
  id: string
  kind: KindName
  /** Header text; `money` and `number` with `unit` carry the unit here, never in the cell. */
  header: string
  /** An icon drawn before the header text. */
  headerIcon?: IconComponent
  /** What the column answers: one mark after the header label opens it as a hint. */
  help?: string
  /**
   * `number` with a trend arrow, an age or both after the figure: the header ends where the figures
   * end, over the figure and not over the slots after it.
   */
  trail?: 'trend' | 'age' | 'both'
  /** The cell's raw value; `null` or `undefined` is absent and renders a muted dash. */
  value: (row: T) => unknown
  align: Align
  numerals: Numerals
  /** Only `text` wraps; every other cell holds one line, so widths are a plan, not a measurement. */
  wrap: boolean
  width: Width
  sort: SortRule
  filter: 'contains' | 'anyOf' | 'range' | null
  /** Card slots in order of preference; `plan.ts` takes the first with room, then `detail`. */
  card: readonly CardPlace[]
  /** The caller named a card slot: the plan places this column before the ones left to a default. */
  cardFirst?: boolean
  /**
   * `entity` with `width: 'content'`: sized to its widest loaded value (`measure`, in `ch`). A `text`
   * column carries `short` too: it takes that width only while the widest value stays within
   * `maxCh`, never below `minCh` (its header), and otherwise stays a flexible column. With no loaded rows
   * (loading, empty, error) the column takes its kind width, so a head sized to content moves when rows arrive.
   */
  content?: { measure: (row: T) => number; short?: { minCh: number; maxCh: number } }
  /** `entity` with a sub line under its name: the title column may grow wider before the filler column takes the rest. */
  sub?: boolean
  /**
   * The text the table's search reads in client mode: what the cell shows (a status label, a
   * formatted number or date) and the stored value. Absent on `spark` and `actions`, which search
   * never reads.
   */
  search?: (row: T, format: Format, now: number) => string
  /** `null` for `actions`: never hidden by a tier. */
  priority: Priority | null
  pin: 'start' | 'end' | null
  /** `null` for `actions`, whose menu the parts render from `actions`. */
  render: ((row: T, env: CellEnv) => ReactNode) | null
  /** `status`: the closed option list (sort order and filter values). */
  options?: readonly string[]
  /** `status`: the text drawn for an option value (cell, card, filter); absent, the value itself. */
  labels?: Readonly<Record<string, string>>
  /** `status`, `tags`: the tone of an option's dot or chip, drawn in its filter list and its order list too. */
  tone?: (value: string) => Tone
  /** `actions`: the typed row actions. */
  actions?: readonly RowAction<T>[]
  /** `select`: the in-place edit. */
  edit?: SelectEdit<T>
  /** `money`: the currency code, which the card tier prints after the value (the header is hidden there). */
  unit?: string
  /** `number`, `money`: the footer reduce. */
  footer?: FooterSpec
  /**
   * `number`, `money`: how a reduced number reads in this kind, for a footer or group reduce a
   * reader picked on a column that declares none.
   */
  drawTotal?: (value: number, env: CellEnv) => ReactNode
  /** A numeric range filter's scale: the editor adds a two-thumb slider over it. */
  bounds?: readonly [number, number]
  /** `date`, `relativeTime` with a range filter: the from-to day picker its editor draws. */
  picker?: DateRangeLike
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
  /** Whether a reader may group the rows by this column: its values are a few repeated categories. */
  groupable: boolean
  /** The narrowest a reader may drag the column, in `ch` (the cell padding comes on top). */
  minCh: number
  /**
   * The width the grid look draws the column at, in `ch`, never below its floor: the grid scrolls
   * sideways instead of shrinking a column to its content. `null` keeps the floor (`custom`, `actions`).
   */
  gridCh: number | null
  /**
   * A text-like column (title, text, link, person, tags) of the grid look shares the free width of its table
   * up to this many `ch`; the reading look has no cap and fills its container. `null`: figures, dates and
   * marks keep their width.
   */
  capCh: number | null
}

export const KIND_DEFAULTS: Readonly<Record<KindName, KindDefaults>> = {
  person: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 18, flex: true },
    sort: 'alphanumeric',
    card: ['subtitle', 'meta'],
    priority: 2,
    groupable: true,
    minCh: 8,
    gridCh: 24,
    capCh: 28,
  },
  tags: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 20, flex: true },
    sort: 'alphanumeric',
    card: ['meta'],
    priority: 3,
    groupable: true,
    minCh: 8,
    gridCh: 26,
    capCh: 32,
  },
  countdown: {
    align: 'start',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 14, flex: false },
    sort: 'datetime',
    card: ['meta'],
    priority: 2,
    groupable: true,
    minCh: 8,
    gridCh: 16,
    capCh: null,
  },
  link: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 20, flex: true },
    sort: 'alphanumeric',
    card: ['meta'],
    priority: 3,
    groupable: false,
    minCh: 8,
    gridCh: 26,
    capCh: 36,
  },
  entity: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 18, flex: true },
    sort: 'alphanumeric',
    card: ['title', 'subtitle', 'meta'],
    priority: 1,
    groupable: true,
    minCh: 8,
    gridCh: 30,
    capCh: 40,
  },
  text: {
    align: 'start',
    numerals: 'proportional',
    wrap: true,
    width: { ch: 16, flex: true },
    sort: 'alphanumeric',
    card: ['subtitle', 'meta'],
    priority: 2,
    groupable: true,
    minCh: 6,
    gridCh: 30,
    capCh: 48,
  },
  number: {
    align: 'end',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 10, flex: false },
    sort: 'basic',
    card: ['value', 'meta'],
    priority: 2,
    groupable: false,
    minCh: 4,
    gridCh: 14,
    capCh: null,
  },
  money: {
    align: 'end',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'basic',
    card: ['value', 'meta'],
    priority: 1,
    groupable: false,
    minCh: 6,
    gridCh: 16,
    capCh: null,
  },
  date: {
    align: 'start',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'datetime',
    card: ['meta'],
    priority: 3,
    groupable: true,
    minCh: 8,
    gridCh: 16,
    capCh: null,
  },
  relativeTime: {
    align: 'start',
    numerals: 'tabular',
    wrap: false,
    // The longest English phrase, `30 minutes ago`, is 14 characters; a fixed column cuts it at less.
    width: { ch: 14, flex: false },
    sort: 'datetime',
    card: ['meta'],
    priority: 3,
    groupable: false,
    minCh: 8,
    gridCh: 16,
    capCh: null,
  },
  status: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'options',
    card: ['badge', 'meta'],
    priority: 2,
    groupable: true,
    minCh: 6,
    gridCh: 18,
    capCh: null,
  },
  delta: {
    align: 'end',
    numerals: 'tabular',
    wrap: false,
    width: { ch: 14, flex: false },
    sort: 'basic',
    card: ['meta'],
    priority: 3,
    groupable: false,
    minCh: 6,
    gridCh: 16,
    capCh: null,
  },
  meter: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 14, flex: false },
    sort: 'basic',
    card: ['meta'],
    priority: 3,
    groupable: false,
    minCh: 8,
    gridCh: 18,
    capCh: null,
  },
  boolean: {
    align: 'center',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 8, flex: false },
    sort: 'basic',
    card: ['meta'],
    priority: 3,
    groupable: true,
    minCh: 3,
    gridCh: 10,
    capCh: null,
  },
  spark: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 22, flex: false },
    sort: null,
    card: ['detail'],
    priority: 2,
    groupable: false,
    minCh: 10,
    gridCh: 24,
    capCh: null,
  },
  select: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 16, flex: false },
    sort: null,
    card: ['edit'],
    priority: 2,
    groupable: true,
    minCh: 8,
    gridCh: 20,
    capCh: null,
  },
  actions: {
    align: 'end',
    numerals: 'proportional',
    wrap: false,
    width: 'icon',
    sort: null,
    card: ['kebab'],
    priority: null,
    groupable: false,
    minCh: 0,
    gridCh: null,
    capCh: null,
  },
  custom: {
    align: 'start',
    numerals: 'proportional',
    wrap: false,
    width: { ch: 12, flex: false },
    sort: 'declared',
    card: [],
    priority: null,
    groupable: false,
    minCh: 4,
    gridCh: null,
    capCh: null,
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
