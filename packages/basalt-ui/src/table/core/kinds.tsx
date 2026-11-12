/**
 * `col<T>()`: columns are kinds, not cell renderers (docs/v3/concepts/data-table.md sections 1.3
 * and 5). A kind constructor decides alignment, numerals, width, sort, filter, card slot and
 * default priority; the options carry data and closures only. The result is a branded
 * `KindColumn<T>`, so a raw TanStack column or a free `cell` is a type error, and an option a kind
 * does not take throws in dev naming the column (I16).
 *
 * Columns are plain per-render values: closures over app state are free and identity does not
 * matter. `c.codec` takes ids and kinds only, so it can sit at module scope.
 */
import type { ReactNode } from 'react'
import type { DateStyle } from '../../core/format'
import type { Box, Delta, IconComponent, Tone } from '../../core/ports'
import type { CardSlot, KindColumn, Priority, RowAction } from '../contract'
import { codec } from './kinds-codec'
import type { CodecKind, CodecOptions, TableSchema } from './kinds-codec'
import {
  Absent,
  BooleanCell,
  DateCell,
  DeltaCell,
  EntityCell,
  MeterCell,
  RelativeTimeCell,
  StatusCell,
  formatMoney,
  formatNumber,
  isAbsent,
} from './kinds-cells'
import { KIND_DEFAULTS, KIND_SPEC } from './kinds-spec'
import type {
  Aggregate,
  Align,
  BuiltColumn,
  CellEnv,
  FooterSpec,
  KindName,
  KindSpec,
  SelectEdit,
} from './kinds-spec'

export { checkSchema } from './kinds-codec'
export type { CodecKind, CodecOptions, TableSchema } from './kinds-codec'
export { engineColumn } from './kinds-engine'
export type { EngineColumn } from './kinds-engine'
export { specOf } from './kinds-spec'

// ---- Option types -------------------------------------------------------------------------

/** Keys of `T` whose value is assignable to `V` (absent allowed): the key is checked against the kind. */
export type KeysOf<T, V> = {
  [K in keyof T & string]-?: T[K] extends V | null | undefined ? K : never
}[keyof T & string]

/** Options every keyed kind takes. */
export type CommonOptions = {
  /** Header text. Default: the id in sentence case (`createdAt` is `Created at`). */
  header?: string
  /** Column id when it differs from the key (two columns over one field). */
  id?: string
  /** What survives a narrow tier: 1 always, 2 reduced and up, 3 full only. */
  priority?: Priority
  /** First choice of card slot; the kind's own order follows. */
  card?: CardSlot
  /** `false` turns sorting off for this column. */
  sortable?: false
}

export type EntityOptions<T> = CommonOptions & {
  href?: (row: T) => string | undefined
  icon?: (row: T) => IconComponent | undefined
  sub?: (row: T) => string | null | undefined
  filter?: 'text'
}
export type TextOptions = CommonOptions & { filter?: 'text' }
/** A numeric kind's footer: client mode reduces the filtered rows, server mode reads `totals`. */
export type FooterOption = { footer?: Aggregate }
export type NumberOptions = CommonOptions & FooterOption & { unit?: string; digits?: number }
export type MoneyOptions = CommonOptions & FooterOption & { currency: string }
export type DateOptions = CommonOptions & { style?: DateStyle }
export type StatusOptions = CommonOptions & {
  options: readonly string[]
  tone?: (value: string) => Tone
  filter?: 'multi'
}
export type DeltaOptions = CommonOptions & { polarity: Delta['polarity']; unit?: string }
export type MeterOptions = CommonOptions & { max?: number }
export type BooleanOptions = CommonOptions & { labels?: readonly [string, string] }
export type SparkOptions<T> = Omit<CommonOptions, 'id' | 'sortable'> & {
  label: string
  render: (row: T, box: Box) => ReactNode
}
export type SelectOptions<T> = CommonOptions & SelectEdit<T>
export type CustomOptions<T> = {
  header?: string
  render: (row: T, env: CellEnv) => ReactNode
  /** Required: the value the column sorts by. */
  sortValue: (row: T) => string | number | null | undefined
  /** Required: where the column sits in a card. */
  card: CardSlot
  /** Required: what survives a narrow tier. */
  priority: Priority
  /** Width in `ch`. Default 12. */
  width?: number
  align?: Align
}

export type Col<T> = {
  entity(key: KeysOf<T, string>, o?: EntityOptions<T>): KindColumn<T>
  text(key: KeysOf<T, string>, o?: TextOptions): KindColumn<T>
  number(key: KeysOf<T, number>, o?: NumberOptions): KindColumn<T>
  money(key: KeysOf<T, number>, o: MoneyOptions): KindColumn<T>
  date(key: KeysOf<T, string | number | Date>, o?: DateOptions): KindColumn<T>
  relativeTime(key: KeysOf<T, string | number | Date>, o?: CommonOptions): KindColumn<T>
  status(key: KeysOf<T, string>, o: StatusOptions): KindColumn<T>
  delta(key: KeysOf<T, number>, o: DeltaOptions): KindColumn<T>
  meter(key: KeysOf<T, number>, o?: MeterOptions): KindColumn<T>
  boolean(key: KeysOf<T, boolean>, o?: BooleanOptions): KindColumn<T>
  spark(id: string, o: SparkOptions<T>): KindColumn<T>
  select(key: KeysOf<T, string>, o: SelectOptions<T>): KindColumn<T>
  actions(actions: readonly RowAction<T>[], o?: { header?: string }): KindColumn<T>
  /** The one counted escape: must declare `sortValue`, `card` and `priority`. */
  custom(id: string, o: CustomOptions<T>): KindColumn<T>
  codec<const M extends Readonly<Record<string, CodecKind>>>(
    kinds: M,
    o?: CodecOptions,
  ): TableSchema<M>
}

// ---- Dev validation -----------------------------------------------------------------------

const COMMON = ['header', 'id', 'priority', 'card', 'sortable'] as const

/** Allowed and required option keys per kind; anything else throws in dev naming the column. */
const OPTION_KEYS: Readonly<
  Record<KindName, { allowed: readonly string[]; required: readonly string[] }>
> = {
  entity: { allowed: [...COMMON, 'href', 'icon', 'sub', 'filter'], required: [] },
  text: { allowed: [...COMMON, 'filter'], required: [] },
  number: { allowed: [...COMMON, 'unit', 'digits', 'footer'], required: [] },
  money: { allowed: [...COMMON, 'currency', 'footer'], required: ['currency'] },
  date: { allowed: [...COMMON, 'style'], required: [] },
  relativeTime: { allowed: COMMON, required: [] },
  status: { allowed: [...COMMON, 'options', 'tone', 'filter'], required: ['options'] },
  delta: { allowed: [...COMMON, 'polarity', 'unit'], required: ['polarity'] },
  meter: { allowed: [...COMMON, 'max'], required: [] },
  boolean: { allowed: [...COMMON, 'labels'], required: [] },
  spark: {
    allowed: ['header', 'priority', 'card', 'label', 'render'],
    required: ['label', 'render'],
  },
  select: {
    allowed: [...COMMON, 'label', 'options', 'commit'],
    required: ['label', 'options', 'commit'],
  },
  actions: { allowed: ['header'], required: [] },
  custom: {
    allowed: ['header', 'render', 'sortValue', 'card', 'priority', 'width', 'align'],
    required: ['render', 'sortValue', 'card', 'priority'],
  },
}

const CARD_SLOTS: readonly CardSlot[] = [
  'title',
  'subtitle',
  'badge',
  'value',
  'meta',
  'edit',
  'detail',
  'hidden',
]

/** Closed values a wrong literal can still reach at runtime (`as` casts, untyped callers). */
const OPTION_VALUES: Readonly<Record<string, readonly unknown[]>> = {
  priority: [1, 2, 3],
  card: CARD_SLOTS,
  sortable: [false],
  polarity: ['up-good', 'up-bad', 'neutral'],
  align: ['start', 'end', 'center'],
  style: ['short', 'long', 'month', 'weekday'],
  footer: ['sum', 'mean', 'min', 'max', 'count'],
}

/** The footer spec of a numeric kind, or nothing when the column declares no `footer`. */
function footerOf<T>(
  fn: Aggregate | undefined,
  draw: FooterSpec['draw'],
): { spec?: Partial<KindSpec<T>> } {
  return fn === undefined ? {} : { spec: { footer: { fn, draw } } }
}

const FILTER_VALUES: Partial<Record<KindName, readonly string[]>> = {
  entity: ['text'],
  text: ['text'],
  status: ['multi'],
}

function fail(kind: KindName, id: string, message: string): never {
  throw new Error(`basalt-ui/table: c.${kind}('${id}') ${message}`)
}

function validate(kind: KindName, id: string, options: object | undefined): void {
  if (process.env.NODE_ENV === 'production') return
  const { allowed, required } = OPTION_KEYS[kind]
  const given = (options ?? {}) as Record<string, unknown>
  for (const key of Object.keys(given)) {
    if (!allowed.includes(key)) {
      fail(kind, id, `got unknown option "${key}"; it takes ${allowed.join(', ')}`)
    }
    const value = given[key]
    if (value === undefined) continue
    const closed = key === 'filter' ? FILTER_VALUES[kind] : OPTION_VALUES[key]
    if (closed !== undefined && !closed.includes(value)) {
      fail(
        kind,
        id,
        `got ${key}=${JSON.stringify(value)}; expected one of ${closed.map((v) => JSON.stringify(v)).join(', ')}`,
      )
    }
  }
  for (const key of required) {
    if (given[key] === undefined) fail(kind, id, `needs the option "${key}"`)
  }
}

// ---- Building -----------------------------------------------------------------------------

/** `createdAt` and `created_at` read `Created at`. */
export function humanize(id: string): string {
  const words = id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The unit belongs in the header: `Amount (EUR)`. A header that already names it is kept. */
export function withUnit(header: string, unit: string | undefined): string {
  if (unit === undefined || unit === '' || header.includes(unit)) return header
  return `${header} (${unit})`
}

type Base<T> = {
  kind: KindName
  id: string
  header: string
  value: (row: T) => unknown
  common?: CommonOptions | undefined
  draw: ((value: unknown, row: T, env: CellEnv) => ReactNode) | null
  /** Renders even when the value is absent (`spark`, `custom`). */
  always?: boolean
  extra?: Partial<KindSpec<T>>
}

function build<T>(b: Base<T>): KindColumn<T> {
  const defaults = KIND_DEFAULTS[b.kind]
  const common = b.common ?? {}
  const sort =
    common.sortable === false || defaults.sort === null || defaults.sort === 'declared'
      ? null
      : defaults.sort === 'options'
        ? { compare: byOption(b.extra?.options ?? []) }
        : { fn: defaults.sort }
  const draw = b.draw
  const render =
    draw === null
      ? null
      : b.always === true
        ? (row: T, env: CellEnv) => draw(undefined, row, env)
        : (row: T, env: CellEnv) => {
            const value = b.value(row)
            return isAbsent(value) ? <Absent /> : draw(value, row, env)
          }
  const spec: KindSpec<T> = {
    id: b.id,
    kind: b.kind,
    header: b.header,
    value: b.value,
    align: defaults.align,
    numerals: defaults.numerals,
    wrap: defaults.wrap,
    width: defaults.width,
    sort,
    filter: null,
    card: common.card === undefined ? defaults.card : [common.card, ...defaults.card],
    priority: common.priority ?? defaults.priority,
    pin: b.kind === 'actions' ? 'end' : null,
    render,
    ...b.extra,
  }
  const column: BuiltColumn<T> = { __brand: 'KindColumn', id: b.id, [KIND_SPEC]: spec }
  return column
}

function byOption(options: readonly string[]): (a: unknown, b: unknown) => number {
  const rank = (v: unknown) => {
    const index = options.indexOf(String(v))
    return index === -1 ? options.length : index
  }
  return (a, b) => rank(a) - rank(b)
}

const read =
  <T,>(key: string) =>
  (row: T): unknown =>
    (row as Record<string, unknown>)[key]

function keyed<T>(
  kind: KindName,
  key: string,
  o: CommonOptions | undefined,
  draw: Base<T>['draw'],
  extra?: { header?: (base: string) => string; spec?: Partial<KindSpec<T>> },
): KindColumn<T> {
  const id = o?.id ?? key
  validate(kind, id, o)
  const base = o?.header ?? humanize(id)
  return build<T>({
    kind,
    id,
    header: extra?.header?.(base) ?? base,
    value: read<T>(key),
    common: o,
    draw,
    ...(extra?.spec === undefined ? {} : { extra: extra.spec }),
  })
}

/**
 * The column factory, typed by the row. Call it at module scope; it carries `T` and nothing else.
 *
 * @useWhen declaring the columns of a v3 data table: each column is a kind (`entity`, `money`, `status`, ...)
 * @neverWhen the table is static with no sort, filter, page or selection (use `ui/table`), or a cell needs free markup (`custom` is the one counted escape)
 *
 * @example
 * const c = col<Booking>()
 * const columns = [c.entity('payee', { header: 'Payee' }), c.money('amount', { currency: 'EUR' })]
 */
export function col<T>(): Col<T> {
  return {
    entity: (key, o) =>
      keyed<T>(
        'entity',
        key,
        o,
        (v, row, env) => (
          <EntityCell
            value={String(v)}
            href={o?.href?.(row)}
            icon={o?.icon?.(row)}
            sub={o?.sub?.(row) ?? undefined}
            Link={env.Link}
          />
        ),
        { spec: { filter: o?.filter === 'text' ? 'contains' : null } },
      ),
    text: (key, o) =>
      keyed<T>('text', key, o, (v) => String(v), {
        spec: { filter: o?.filter === 'text' ? 'contains' : null },
      }),
    number: (key, o) =>
      keyed<T>(
        'number',
        key,
        o,
        (v, _row, env) =>
          typeof v === 'number' ? formatNumber(env.format, v, o?.digits) : String(v),
        {
          header: (h) => withUnit(h, o?.unit),
          ...footerOf<T>(o?.footer, (v, env) => formatNumber(env.format, v, o?.digits)),
        },
      ),
    money: (key, o) =>
      keyed<T>(
        'money',
        key,
        o,
        (v, _row, env) =>
          typeof v === 'number' ? formatMoney(env.format, v, o.currency) : String(v),
        {
          header: (h) => withUnit(h, o?.currency),
          ...footerOf<T>(o?.footer, (v, env) => formatMoney(env.format, v, o.currency)),
        },
      ),
    date: (key, o) =>
      keyed<T>('date', key, o, (v, _row, env) => (
        <DateCell value={v} format={env.format} style={o?.style ?? 'short'} />
      )),
    relativeTime: (key, o) =>
      keyed<T>('relativeTime', key, o, (v, _row, env) => (
        <RelativeTimeCell value={v} format={env.format} now={env.now} />
      )),
    status: (key, o) =>
      keyed<T>(
        'status',
        key,
        o,
        (v) => <StatusCell value={String(v)} tone={o.tone?.(String(v)) ?? 'neutral'} />,
        { spec: { options: o?.options ?? [], filter: o?.filter === 'multi' ? 'anyOf' : null } },
      ),
    delta: (key, o) =>
      keyed<T>('delta', key, o, (v, _row, env) =>
        typeof v === 'number' ? (
          <DeltaCell value={v} polarity={o.polarity} format={env.format} unit={o.unit} />
        ) : (
          String(v)
        ),
      ),
    meter: (key, o) => {
      const id = o?.id ?? key
      return keyed<T>('meter', key, o, (v) =>
        typeof v === 'number' ? (
          <MeterCell label={o?.header ?? humanize(id)} value={v} max={o?.max ?? 1} />
        ) : (
          String(v)
        ),
      )
    },
    boolean: (key, o) =>
      keyed<T>('boolean', key, o, (v) => (
        <BooleanCell value={v === true} labels={o?.labels ?? ['Yes', 'No']} />
      )),
    spark: (id, o) => {
      validate('spark', id, o)
      return build<T>({
        kind: 'spark',
        id,
        header: o?.header ?? o.label,
        value: () => undefined,
        common: o,
        always: true,
        draw: (_v, row, env) => o.render(row, env.box),
      })
    },
    select: (key, o) =>
      keyed<T>('select', key, o, (v) => String(v), {
        spec: { edit: { label: o?.label, options: o?.options ?? [], commit: o?.commit } },
      }),
    actions: (actions, o) => {
      validate('actions', 'actions', o)
      return build<T>({
        kind: 'actions',
        id: 'actions',
        header: o?.header ?? 'Actions',
        value: () => undefined,
        draw: null,
        extra: { actions },
      })
    },
    custom: (id, o) => {
      validate('custom', id, o)
      const width = o?.width ?? KIND_DEFAULTS.custom.width
      return build<T>({
        kind: 'custom',
        id,
        header: o?.header ?? humanize(id),
        value: (row) => o.sortValue(row),
        always: true,
        draw: (_v, row, env) => o.render(row, env),
        extra: {
          sort: { fn: 'basic' },
          card: [o.card],
          priority: o.priority,
          align: o.align ?? 'start',
          width: typeof width === 'number' ? { ch: width, flex: false } : width,
        },
      })
    },
    codec: (kinds, o) => codec(kinds, o),
  }
}
