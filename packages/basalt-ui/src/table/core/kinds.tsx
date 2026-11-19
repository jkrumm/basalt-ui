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
import type { DateStyle, Format } from '../../core/format'
import type { Box, Delta, IconComponent, NavTarget, Tone } from '../../core/ports'
import type { CardSlot, DateRangeLike, KindColumn, Priority, RowAction } from '../contract'
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
  WithIcon,
  dateLabel,
  deltaLabel,
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
  Width,
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
  /** An icon drawn before the header text (any component with the `IconComponent` shape). */
  headerIcon?: IconComponent
}

/**
 * A value cell's leading icon, per row (`status`, `boolean`, `date`, `relativeTime`), the same
 * option `entity` takes: a status icon takes the dot's place in its tone, a boolean icon the check
 * or cross, a date icon sits before the date.
 */
type CellIconOption<T> = {
  /** The cell's icon for this row: a status icon replaces the dot, a boolean icon the check or cross. */
  icon?: (row: T) => IconComponent | undefined
}

export type EntityOptions<T> = CommonOptions & {
  href?: (row: T) => string | NavTarget | undefined
  icon?: (row: T) => IconComponent | undefined
  sub?: (row: T) => string | null | undefined
  /** The name is a time or an id: drawn in the mono face with tabular numerals. */
  mono?: boolean | undefined
  /** The secondary text is a time or an id: drawn in the mono face with tabular numerals. */
  subMono?: boolean | undefined
  filter?: 'text'
  /**
   * `'content'` sizes the column to its widest loaded value, name or sub line (floor 18ch, cap
   * 40ch), instead of a flexible share of what the other columns leave.
   */
  width?: 'content'
}
export type TextOptions = CommonOptions & {
  filter?: 'text'
  /** The text of a stored value in the cell and the phone card; the stored value without an entry. Sort and search read the stored value. */
  labels?: Readonly<Record<string, string>>
}
/** A numeric kind's footer: client mode reduces the filtered rows, server mode reads `totals`. */
export type FooterOption = { footer?: Aggregate }
/**
 * A numeric column's range filter: `filter: 'range'` filters by a min and a max, and `bounds`
 * (the lowest and highest value the column can hold) adds a two-thumb slider over that scale.
 */
export type RangeFilterOptions = { filter?: 'range'; bounds?: readonly [number, number] }
/**
 * A date column's range filter: `filter: 'range'` with the day picker it draws, passed by value so
 * `./table` adds no peer (`DateRangePicker` from `basalt-ui/ui/date-picker`).
 */
export type DateFilterOptions =
  | { filter?: undefined; picker?: undefined }
  | { filter: 'range'; picker: DateRangeLike }
export type NumberOptions = CommonOptions &
  FooterOption &
  RangeFilterOptions & { unit?: string; digits?: number }
export type MoneyOptions = CommonOptions & FooterOption & RangeFilterOptions & { currency: string }
export type DateOptions<T = unknown> = CommonOptions &
  DateFilterOptions &
  CellIconOption<T> & { style?: DateStyle }
export type RelativeTimeOptions<T = unknown> = CommonOptions & DateFilterOptions & CellIconOption<T>
export type StatusOptions<O extends string = string, T = unknown> = CommonOptions &
  CellIconOption<T> & {
    options: readonly O[]
    /** The text of each option in the cell, the phone card and the column filter; the stored value without it. */
    labels?: Readonly<Record<O, string>>
    /** Receives the closed option union `options` declares, so a `Record<Option, Tone>` indexes without a cast. */
    tone?: (value: O) => Tone
    /** `'multi'` filters by a checklist of the options; the user can also rank them from the header. */
    filter?: 'multi'
  }
export type DeltaOptions = CommonOptions &
  RangeFilterOptions & {
    polarity: Delta['polarity']
    unit?: string
    /** A money change: `+€50.00` in the currency's own digits, like `c.money`; wins over `unit`. */
    currency?: string
  }
/** `filter: 'range'` filters by a min and a max over the meter's own scale, 0 to `max`. */
export type MeterOptions = CommonOptions & { max?: number; filter?: 'range' }
/** `filter: 'multi'` filters by Yes or No (the two `labels`). */
export type BooleanOptions<T = unknown> = CommonOptions &
  CellIconOption<T> & {
    labels?: readonly [string, string]
    filter?: 'multi'
  }
export type SparkOptions<T> = Omit<CommonOptions, 'id' | 'sortable'> & {
  label: string
  render: (row: T, box: Box) => ReactNode
}
export type SelectOptions<T> = CommonOptions & SelectEdit<T> & { filter?: 'multi' }
export type CustomOptions<T> = {
  header?: string
  /** An icon drawn before the header text. */
  headerIcon?: IconComponent
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
  date(key: KeysOf<T, string | number | Date>, o?: DateOptions<T>): KindColumn<T>
  relativeTime(key: KeysOf<T, string | number | Date>, o?: RelativeTimeOptions<T>): KindColumn<T>
  status<const O extends string>(key: KeysOf<T, string>, o: StatusOptions<O, T>): KindColumn<T>
  delta(key: KeysOf<T, number>, o: DeltaOptions): KindColumn<T>
  meter(key: KeysOf<T, number>, o?: MeterOptions): KindColumn<T>
  boolean(key: KeysOf<T, boolean>, o?: BooleanOptions<T>): KindColumn<T>
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

const COMMON = ['header', 'id', 'priority', 'card', 'sortable', 'headerIcon'] as const

/** Allowed and required option keys per kind; anything else throws in dev naming the column. */
const OPTION_KEYS: Readonly<
  Record<KindName, { allowed: readonly string[]; required: readonly string[] }>
> = {
  entity: {
    allowed: [...COMMON, 'href', 'icon', 'sub', 'mono', 'subMono', 'filter', 'width'],
    required: [],
  },
  text: { allowed: [...COMMON, 'filter', 'labels'], required: [] },
  number: { allowed: [...COMMON, 'unit', 'digits', 'footer', 'filter', 'bounds'], required: [] },
  money: {
    allowed: [...COMMON, 'currency', 'footer', 'filter', 'bounds'],
    required: ['currency'],
  },
  date: { allowed: [...COMMON, 'style', 'filter', 'picker', 'icon'], required: [] },
  relativeTime: { allowed: [...COMMON, 'filter', 'picker', 'icon'], required: [] },
  status: {
    allowed: [...COMMON, 'options', 'labels', 'tone', 'filter', 'icon'],
    required: ['options'],
  },
  delta: {
    allowed: [...COMMON, 'polarity', 'unit', 'currency', 'filter', 'bounds'],
    required: ['polarity'],
  },
  meter: { allowed: [...COMMON, 'max', 'filter'], required: [] },
  boolean: { allowed: [...COMMON, 'labels', 'filter', 'icon'], required: [] },
  spark: {
    allowed: ['header', 'priority', 'card', 'label', 'render', 'headerIcon'],
    required: ['label', 'render'],
  },
  select: {
    allowed: [...COMMON, 'label', 'options', 'commit', 'filter'],
    required: ['label', 'options', 'commit'],
  },
  actions: { allowed: ['header'], required: [] },
  custom: {
    allowed: ['header', 'headerIcon', 'render', 'sortValue', 'card', 'priority', 'width', 'align'],
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
  select: ['multi'],
  boolean: ['multi'],
  number: ['range'],
  money: ['range'],
  delta: ['range'],
  meter: ['range'],
  date: ['range'],
  relativeTime: ['range'],
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
  if ((kind === 'date' || kind === 'relativeTime') && given['filter'] === 'range') {
    if (typeof given['picker'] !== 'function') {
      fail(
        kind,
        id,
        'has filter: "range" and needs the option "picker" (DateRangePicker from basalt-ui/ui/date-picker)',
      )
    }
  }
  const bounds = given['bounds']
  if (bounds !== undefined) {
    const ok =
      Array.isArray(bounds) &&
      bounds.length === 2 &&
      bounds.every((b) => typeof b === 'number' && Number.isFinite(b)) &&
      (bounds[0] as number) < (bounds[1] as number)
    if (!ok)
      fail(
        kind,
        id,
        `got bounds=${JSON.stringify(bounds)}; expected [lowest, highest] with lowest below highest`,
      )
  }
}

/** The spec fields of a numeric range filter (`bounds` only with `filter: 'range'`). */
function rangeFilter<T>(o: RangeFilterOptions | undefined): Partial<KindSpec<T>> {
  if (o?.filter !== 'range') return {}
  return { filter: 'range', ...(o.bounds !== undefined && { bounds: o.bounds }) }
}

/** The spec fields of a date range filter: the operator and the picker its editor draws. */
function dateFilter<T>(o: DateFilterOptions | undefined): Partial<KindSpec<T>> {
  return o?.filter === 'range' ? { filter: 'range', picker: o.picker } : {}
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
  /** What the cell shows of a present value, for search; the stored value is searched beside it. */
  text?: (value: unknown, row: T, format: Format) => string
  /** Renders even when the value is absent (`spark`, `custom`). */
  always?: boolean
  extra?: Partial<KindSpec<T>>
}

/** Room beside a header's text in `ch`: the sort mark, the gap and the column menu button. */
const HEADER_CHROME_CH = 5
/** A header asks for floor room up to this many `ch`; a longer one truncates (its title shows it whole). */
const HEADER_MAX_CH = 24
/** A filterable header's extra room in `ch`: the filter button (24 px) it shows at rest. */
const FILTER_MARK_CH = 3
/** A header icon's room in `ch`: 14 px and its gap. */
const HEADER_ICON_CH = 2
/** A status icon is wider than the dot it replaces by this many `ch`. */
const STATUS_ICON_EXTRA_CH = 1

/** A `text` column whose widest loaded value is at most this many `ch` sizes to it; a longer one stays flexible. */
const SHORT_TEXT_MAX_CH = 24

/** The dot and its gap beside a status word, in `ch` (8 px dot, 6 px gap, at 8 px a `ch`). */
const STATUS_DOT_CH = 2

/** A column's floor counts its own header, unit suffix included, so a roomy row shows it whole. */
function floorOf(width: Width, header: string, chrome: number = HEADER_CHROME_CH): Width {
  if (width === 'icon') return width
  const want = Math.min(HEADER_MAX_CH + chrome - HEADER_CHROME_CH, header.length + chrome)
  return want > width.ch ? { ...width, ch: want } : width
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
    ...(common.headerIcon !== undefined && { headerIcon: common.headerIcon }),
    ...(b.kind !== 'spark' && b.kind !== 'actions' && { search: searchOf(b) }),
    value: b.value,
    align: defaults.align,
    numerals: defaults.numerals,
    wrap: defaults.wrap,
    width: floorOf(defaults.width, b.header),
    sort,
    filter: null,
    card: common.card === undefined ? defaults.card : [common.card, ...defaults.card],
    ...(common.card !== undefined && { cardFirst: true }),
    priority: common.priority ?? defaults.priority,
    pin: b.kind === 'actions' ? 'end' : null,
    render,
    ...b.extra,
  }
  // A header keeps room for its icon and its filter button, so no control ever cuts its label.
  const chrome =
    HEADER_CHROME_CH +
    (spec.headerIcon === undefined ? 0 : HEADER_ICON_CH) +
    (spec.filter === null ? 0 : FILTER_MARK_CH)
  if (chrome !== HEADER_CHROME_CH) spec.width = floorOf(spec.width, b.header, chrome)
  const column: BuiltColumn<T> = { __brand: 'KindColumn', id: b.id, [KIND_SPEC]: spec }
  return column
}

/** The search text of a row: what the cell shows, then the stored value, one per line. */
function searchOf<T>(b: Base<T>): (row: T, format: Format) => string {
  return (row, format) => {
    const value = b.value(row)
    if (isAbsent(value)) return ''
    // An invalid Date draws the dash in its cell; its stored text is empty here, never a throw.
    const raw =
      value instanceof Date
        ? Number.isNaN(value.getTime())
          ? ''
          : value.toISOString()
        : String(value)
    const shown = b.text?.(value, row, format)
    return shown === undefined || shown === '' ? raw : `${shown}\n${raw}`
  }
}

/** A date value as its cell writes it, and its ISO day, so `2026-11-03` finds a timestamp too. */
function dateText(value: unknown, format: Format, style: DateStyle): string {
  const label = dateLabel(value, format, style)
  return label === null ? '' : `${label.text}\n${label.iso.slice(0, 10)}`
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
  extra?: {
    header?: (base: string) => string
    spec?: Partial<KindSpec<T>>
    text?: Base<T>['text']
  },
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
    ...(extra?.text !== undefined && { text: extra.text }),
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
        (v, row) => (
          <EntityCell
            value={String(v)}
            href={o?.href?.(row)}
            icon={o?.icon?.(row)}
            sub={o?.sub?.(row) ?? undefined}
            mono={o?.mono === true}
            subMono={o?.subMono === true}
          />
        ),
        {
          text: (_v, row) => o?.sub?.(row) ?? '',
          spec: {
            filter: o?.filter === 'text' ? 'contains' : null,
            ...(o?.sub !== undefined && { sub: true }),
            ...(o?.width === 'content' && {
              content: {
                measure: (row: T) =>
                  Math.max(
                    String(read<T>(key)(row) ?? '').length + (o.icon === undefined ? 0 : 3),
                    o.sub?.(row)?.length ?? 0,
                  ),
              },
            }),
          },
        },
      ),
    text: (key, o) =>
      keyed<T>('text', key, o, (v) => o?.labels?.[String(v)] ?? String(v), {
        text: (v) => o?.labels?.[String(v)] ?? '',
        spec: {
          filter: o?.filter === 'text' ? 'contains' : null,
          content: {
            measure: (row: T) => {
              const value = read<T>(key)(row)
              return isAbsent(value) ? 1 : (o?.labels?.[String(value)] ?? String(value)).length
            },
            short: {
              minCh: Math.min(
                HEADER_MAX_CH,
                (o?.header ?? humanize(o?.id ?? key)).length + HEADER_CHROME_CH,
              ),
              maxCh: SHORT_TEXT_MAX_CH,
            },
          },
        },
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
          text: (v, _row, format) =>
            typeof v === 'number' ? formatNumber(format, v, o?.digits) : '',
          spec: {
            ...footerOf<T>(o?.footer, (v, env) => formatNumber(env.format, v, o?.digits)).spec,
            ...rangeFilter<T>(o),
          },
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
          text: (v, _row, format) =>
            typeof v === 'number' ? formatMoney(format, v, o.currency) : '',
          spec: {
            unit: o.currency,
            ...footerOf<T>(o?.footer, (v, env) => formatMoney(env.format, v, o.currency)).spec,
            ...rangeFilter<T>(o),
          },
        },
      ),
    date: (key, o) =>
      keyed<T>(
        'date',
        key,
        o,
        (v, row, env) => (
          <WithIcon icon={o?.icon?.(row)}>
            <DateCell value={v} format={env.format} style={o?.style ?? 'short'} />
          </WithIcon>
        ),
        {
          text: (v, _row, format) => dateText(v, format, o?.style ?? 'short'),
          spec: dateFilter<T>(o),
        },
      ),
    relativeTime: (key, o) =>
      keyed<T>(
        'relativeTime',
        key,
        o,
        (v, row, env) => (
          <WithIcon icon={o?.icon?.(row)}>
            <RelativeTimeCell value={v} format={env.format} now={env.now} />
          </WithIcon>
        ),
        { text: (v, _row, format) => dateText(v, format, 'long'), spec: dateFilter<T>(o) },
      ),
    status: <const O extends string>(key: KeysOf<T, string>, o: StatusOptions<O, T>) =>
      keyed<T>(
        'status',
        key,
        o,
        // A cell holds the stored value, which the column's `options` name as a closed list.
        (v, row) => (
          <StatusCell
            value={o.labels?.[String(v) as O] ?? String(v)}
            tone={o.tone?.(String(v) as O) ?? 'neutral'}
            icon={o.icon?.(row)}
          />
        ),
        {
          text: (v) => o.labels?.[String(v) as O] ?? '',
          spec: {
            // The options are a closed list, so the widest word is known before a row loads.
            width: floorOf(
              {
                ch: Math.max(
                  0,
                  ...(o?.options ?? []).map(
                    (option) =>
                      (o?.labels?.[option] ?? option).length +
                      STATUS_DOT_CH +
                      (o?.icon === undefined ? 0 : STATUS_ICON_EXTRA_CH),
                  ),
                ),
                flex: false,
              },
              o?.header ?? humanize(o?.id ?? key),
            ),
            options: o?.options ?? [],
            ...(o?.labels !== undefined && { labels: o.labels }),
            ...(o?.tone !== undefined && { tone: o.tone as (value: string) => Tone }),
            filter: o?.filter === 'multi' ? 'anyOf' : null,
          },
        },
      ),
    delta: (key, o) =>
      keyed<T>(
        'delta',
        key,
        o,
        (v, _row, env) =>
          typeof v === 'number' ? (
            <DeltaCell
              value={v}
              polarity={o.polarity}
              format={env.format}
              unit={o.unit}
              currency={o.currency}
            />
          ) : (
            String(v)
          ),
        {
          text: (v, _row, format) =>
            typeof v === 'number' ? deltaLabel(format, v, o.unit, o.currency) : '',
          spec: rangeFilter<T>(o),
        },
      ),
    meter: (key, o) => {
      const id = o?.id ?? key
      return keyed<T>(
        'meter',
        key,
        o,
        (v) =>
          typeof v === 'number' ? (
            <MeterCell label={o?.header ?? humanize(id)} value={v} max={o?.max ?? 1} />
          ) : (
            String(v)
          ),
        {
          spec:
            o?.filter === 'range'
              ? rangeFilter<T>({ filter: 'range', bounds: [0, o.max ?? 1] })
              : {},
        },
      )
    },
    boolean: (key, o) => {
      const [yes, no] = o?.labels ?? ['Yes', 'No']
      return keyed<T>(
        'boolean',
        key,
        o,
        (v, row) => <BooleanCell value={v === true} labels={[yes, no]} icon={o?.icon?.(row)} />,
        {
          text: (v) => (v === true ? yes : no),
          spec:
            o?.filter === 'multi'
              ? { filter: 'anyOf', options: ['true', 'false'], labels: { true: yes, false: no } }
              : {},
        },
      )
    },
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
        text: (_v, row) => o.label(row),
        spec: {
          edit: { label: o?.label, options: o?.options ?? [], commit: o?.commit },
          ...(o?.filter === 'multi' && { filter: 'anyOf', options: o.options }),
        },
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
          ...(o.headerIcon !== undefined && { headerIcon: o.headerIcon }),
          sort: { fn: 'basic' },
          card: [o.card],
          cardFirst: true,
          priority: o.priority,
          align: o.align ?? 'start',
          width: typeof width === 'number' ? { ch: width, flex: false } : width,
        },
      })
    },
    codec: (kinds, o) => codec(kinds, o),
  }
}
