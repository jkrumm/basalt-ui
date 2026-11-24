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
  CountdownCell,
  DateCell,
  DeltaCell,
  EntityCell,
  FigureCell,
  LampCell,
  LinkCell,
  MeterCell,
  SparkTotalCell,
  StackedMeterCell,
  WithAge,
  linkLabel,
  PeopleCell,
  PersonCell,
  QuietText,
  RelativeTimeCell,
  StatusCell,
  TagsCell,
  WithIcon,
  dateLabel,
  deltaLabel,
  formatMoney,
  durationText,
  formatNumber,
  isAbsent,
  toInstant,
} from './kinds-cells'
import { KIND_DEFAULTS, KIND_SPEC } from './kinds-spec'
import { KIND_ICONS } from './kind-icons'
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
  /**
   * The icon drawn before the header text (any component with the `IconComponent` shape), where header
   * icons are on (the grid look, or `headerIcons: true`). Every kind but `custom` and `actions` has its own
   * by default; `false` draws none.
   */
  headerIcon?: IconComponent | false
  /** What the column answers, one or two sentences: one mark after the header label opens it as a hint. */
  help?: string
}

/**
 * A quiet second value after a cell's first (`number`, `status`): an instant drawn as its age
 * (`3 hr`, `2.1 days`) in a slot of its own width, so the first values line up down the column.
 * `label` names it for assistive tech (`Open since` is heard as `Open since 3 hours ago`).
 */
export type AgeOption<T> = {
  age?: { at: (row: T) => string | number | Date | null | undefined; label?: string }
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
  /** A logo or photo URL drawn as a 16 px face before the name (initials while it loads or when absent); wins over `icon`. */
  image?: (row: T) => string | null | undefined
  /** `'object'` (default) is a rounded square for a company or logo; `'person'` a circle. */
  imageShape?: 'person' | 'object'
  /** A short reference (`INV-0042`) in muted mono beside the name. */
  ref?: (row: T) => string | null | undefined
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
  /** A muted one-line preview: secondary ink, truncated, never wrapped. */
  quiet?: boolean
}

/** A typed leading icon: `type` names the row's kind, `icons` draws it; a kind with no icon shows none. */
export type TitleOptions<T, K extends string> = Omit<EntityOptions<T>, 'icon' | 'image'> & {
  type: (row: T) => K
  icons: Readonly<Record<K, IconComponent>>
}
export type PersonOptions<T> = CommonOptions & {
  /** The face's image URL; initials show while it loads or when absent. */
  avatar?: (row: T) => string | null | undefined
  /** Muted text after the name: a job title, a team. */
  role?: (row: T) => string | null | undefined
  href?: (row: T) => string | NavTarget | undefined
  /** `'multi'` filters by a checklist of the names the rows hold. */
  filter?: 'multi'
}
export type PeopleOptions<T> = CommonOptions & {
  /** The face's image URL of one name. */
  avatar?: (name: string, row: T) => string | null | undefined
  /** Faces shown before the `+N`. Default 4. */
  max?: number
  filter?: 'multi'
}
export type TagsOptions = CommonOptions & {
  /** The text of a stored tag; the tag itself without an entry. */
  labels?: Readonly<Record<string, string>>
  /** The chip's tone, from the status tone map. Default neutral. */
  tone?: (tag: string) => Tone
  /** An icon drawn before the chip's text, per tag. */
  icon?: (tag: string) => IconComponent | undefined
  /** `'multi'` filters by a checklist of the tags the rows hold; a row passes on any of its tags. */
  filter?: 'multi'
}
/**
 * A date as its distance from today. Thresholds are days: the text is `bad` at or below `bad`
 * (default -1: overdue), `warn` at or below `warn`, plain above, and the date itself once the
 * distance passes `horizon` (default 60).
 */
export type CountdownOptions = CommonOptions &
  DateFilterOptions & { bad?: number; warn?: number; horizon?: number }
export type LinkOptions<T> = CommonOptions & {
  /** A record link or in-app path; without it the value's own URL or address is the destination. */
  href?: (row: T) => string | NavTarget | undefined
  /** What is printed for the row; without it the value minus its scheme. */
  label?: (row: T) => string | null | undefined
  icon?: (row: T) => IconComponent | undefined
  filter?: 'text'
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
/**
 * A figure against the value before it: an arrow up, down or flat (a change within `flat`, a share
 * of the value before, default 0.1), toned good or bad by `better`, with the comparison in words
 * for assistive tech and on hover (`down from 4.2 hr the 7 days before`, `against` the last words).
 */
export type TrendOption<T> = {
  before: (row: T) => number | null | undefined
  better: 'lower' | 'higher'
  flat?: number
  against?: string
}
export type NumberOptions<T = unknown> = CommonOptions &
  FooterOption &
  RangeFilterOptions &
  AgeOption<T> & {
    unit?: string
    digits?: number
    /** The value is a span in this unit, written in its one largest unit: `30 min`, `1.4 hr`, `2 days`. */
    duration?: 'ms' | 's'
    trend?: TrendOption<T>
    /**
     * The whole the value is a part of: the cell writes `11/12`, sorts and range-filters by the share
     * (0 to 1), and takes no `footer`. A row whose whole is absent or zero draws the dash.
     */
    of?: (row: T) => number | null | undefined
    /** With `of`: a share below this is drawn in the warn ink (`1`: anything under full). */
    warnBelow?: number
    /** With `of`: a share below this is drawn in the bad ink. */
    badBelow?: number
  }
export type MoneyOptions = CommonOptions &
  FooterOption &
  RangeFilterOptions & {
    currency: string
    /** Fraction digits of the figure (`0` writes whole euros); default: the currency's own (2 for EUR, 0 for JPY). */
    digits?: number
  }
export type DateOptions<T = unknown> = CommonOptions &
  DateFilterOptions &
  CellIconOption<T> & {
    style?: DateStyle
    /** The date is an id-like time: drawn in the mono face with tabular numerals, in the cell and on its phone card line. Default: the body face with tabular numerals, like a date elsewhere on the page. */
    mono?: boolean | undefined
  }
export type RelativeTimeOptions<T = unknown> = CommonOptions &
  DateFilterOptions &
  CellIconOption<T> & {
    /** The relative time is an id-like time: drawn in the mono face with tabular numerals, in the cell and on its phone card line. Default: the body face with tabular numerals. */
    mono?: boolean | undefined
  }
export type StatusOptions<O extends string = string, T = unknown> = CommonOptions &
  CellIconOption<T> & {
    options: readonly O[]
    /** The text of each option in the cell, the phone card and the column filter; the stored value without it. */
    labels?: Readonly<Record<O, string>>
    /** Receives the closed option union `options` declares, so a `Record<Option, Tone>` indexes without a cast. */
    tone?: (value: O) => Tone
    /** `'multi'` filters by a checklist of the options; the user can also rank them from the header. */
    filter?: 'multi'
    /** The toned dot alone, its word for assistive tech and on hover: a column of states read by color at a glance. */
    lamp?: boolean
  } & AgeOption<T>
export type DeltaOptions = CommonOptions &
  RangeFilterOptions & {
    polarity: Delta['polarity']
    unit?: string
    /** A money change: `+€50.00` in the currency's own digits, like `c.money`; wins over `unit`. */
    currency?: string
  }
/** One toned part of a stacked meter: its name (heard and shown on hover with its count) and its count. */
export type MeterSegment<T> = {
  label: string
  tone: Tone
  value: (row: T) => number | null | undefined
}
/**
 * `max` is the scale, the same for every row or one per row (a plan's rows, a host's seats). With
 * `segments` the key is the total, drawn beside one track of toned parts. `fraction` writes the
 * readout as `455/472`. A per-row `max` sorts and range-filters by the share (0 to 1);
 * `filter: 'range'` otherwise filters over the meter's own scale, 0 to `max`.
 */
export type MeterOptions<T = unknown> = CommonOptions & {
  max?: number | ((row: T) => number | null | undefined)
  segments?: readonly MeterSegment<T>[]
  fraction?: boolean
  filter?: 'range'
}
/**
 * A share from 0 to 1 drawn as a thin bar with its percent label. `footer` reduces the shares of the
 * filtered rows (`mean` is the usual one); `filter: 'range'` filters in percent, 0 to 100.
 */
export type ProgressOptions<T = unknown> = CommonOptions &
  FooterOption & {
    /** The bar's fill tone for one row's share (0 to 1). Default neutral. */
    tone?: (value: number, row: T) => Tone
    filter?: 'range'
  }
/** `filter: 'multi'` filters by Yes or No (the two `labels`). */
export type BooleanOptions<T = unknown> = CommonOptions &
  CellIconOption<T> & {
    labels?: readonly [string, string]
    filter?: 'multi'
  }
export type SparkOptions<T> = Omit<CommonOptions, 'id' | 'sortable'> & {
  label: string
  render: (row: T, box: Box) => ReactNode
  /** The line's total, drawn beside it: the column then sorts by it. */
  value?: (row: T) => number | null | undefined
}
export type SelectOptions<T> = CommonOptions & SelectEdit<T> & { filter?: 'multi' }
type CustomBase<T> = {
  header?: string
  /** An icon drawn before the header text. */
  headerIcon?: IconComponent
  /** What the column answers: one mark after the header label opens it as a hint. */
  help?: string
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

/**
 * `search` is the text the table search and the card read for the column, and what `filter: 'text'`
 * matches; a `custom` without it is searched by its sort value, as before.
 */
type CustomSearch<T> =
  | {
      search: (row: T) => string | null | undefined
      /** A text filter over `search`. */
      filter?: 'text'
    }
  | { search?: undefined; filter?: undefined }

export type CustomOptions<T> = CustomBase<T> & CustomSearch<T>

export type Col<T> = {
  entity(key: KeysOf<T, string>, o?: EntityOptions<T>): KindColumn<T>
  /** An entity whose leading icon is picked per row from a typed map, for records of mixed kinds in one list. */
  title<const K extends string>(key: KeysOf<T, string>, o: TitleOptions<T, K>): KindColumn<T>
  /** A face and a name, with an optional muted role. */
  person(key: KeysOf<T, string>, o?: PersonOptions<T>): KindColumn<T>
  /** Several people as overlapping faces. */
  people(key: KeysOf<T, readonly string[]>, o?: PeopleOptions<T>): KindColumn<T>
  /** Chips on one line, a `+N` for the ones that do not fit. */
  tags(key: KeysOf<T, readonly string[]>, o?: TagsOptions): KindColumn<T>
  /** A date as `26 days late` or `in 4 days`, toned by declared thresholds. */
  countdown(key: KeysOf<T, string | number | Date>, o?: CountdownOptions): KindColumn<T>
  /** A URL, an address or a record link as quiet text. */
  link(key: KeysOf<T, string>, o?: LinkOptions<T>): KindColumn<T>
  text(key: KeysOf<T, string>, o?: TextOptions): KindColumn<T>
  number(key: KeysOf<T, number>, o?: NumberOptions<T>): KindColumn<T>
  money(key: KeysOf<T, number>, o: MoneyOptions): KindColumn<T>
  date(key: KeysOf<T, string | number | Date>, o?: DateOptions<T>): KindColumn<T>
  relativeTime(key: KeysOf<T, string | number | Date>, o?: RelativeTimeOptions<T>): KindColumn<T>
  status<const O extends string>(key: KeysOf<T, string>, o: StatusOptions<O, T>): KindColumn<T>
  delta(key: KeysOf<T, number>, o: DeltaOptions): KindColumn<T>
  meter(key: KeysOf<T, number>, o?: MeterOptions<T>): KindColumn<T>
  /** A share from 0 to 1 as a thin bar with its percent label. */
  progress(key: KeysOf<T, number>, o?: ProgressOptions<T>): KindColumn<T>
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

const COMMON = ['header', 'id', 'priority', 'card', 'sortable', 'headerIcon', 'help'] as const

/** Allowed and required option keys per kind; anything else throws in dev naming the column. */
const OPTION_KEYS: Readonly<
  Record<KindName, { allowed: readonly string[]; required: readonly string[] }>
> = {
  entity: {
    allowed: [
      ...COMMON,
      'href',
      'icon',
      'image',
      'imageShape',
      'ref',
      'sub',
      'mono',
      'subMono',
      'filter',
      'width',
    ],
    required: [],
  },
  person: {
    allowed: [...COMMON, 'avatar', 'role', 'href', 'max', 'filter'],
    required: [],
  },
  tags: { allowed: [...COMMON, 'labels', 'tone', 'filter', 'icon'], required: [] },
  countdown: {
    allowed: [...COMMON, 'bad', 'warn', 'horizon', 'filter', 'picker'],
    required: [],
  },
  link: { allowed: [...COMMON, 'href', 'label', 'icon', 'filter'], required: [] },
  text: { allowed: [...COMMON, 'filter', 'labels', 'quiet'], required: [] },
  number: {
    allowed: [
      ...COMMON,
      'unit',
      'digits',
      'footer',
      'filter',
      'bounds',
      'duration',
      'trend',
      'of',
      'warnBelow',
      'badBelow',
      'age',
    ],
    required: [],
  },
  money: {
    allowed: [...COMMON, 'currency', 'digits', 'footer', 'filter', 'bounds'],
    required: ['currency'],
  },
  date: { allowed: [...COMMON, 'style', 'filter', 'picker', 'icon', 'mono'], required: [] },
  relativeTime: { allowed: [...COMMON, 'filter', 'picker', 'icon', 'mono'], required: [] },
  status: {
    allowed: [...COMMON, 'options', 'labels', 'tone', 'filter', 'icon', 'lamp', 'age'],
    required: ['options'],
  },
  delta: {
    allowed: [...COMMON, 'polarity', 'unit', 'currency', 'filter', 'bounds'],
    required: ['polarity'],
  },
  meter: { allowed: [...COMMON, 'max', 'segments', 'fraction', 'filter'], required: [] },
  progress: { allowed: [...COMMON, 'tone', 'footer', 'filter'], required: [] },
  boolean: { allowed: [...COMMON, 'labels', 'filter', 'icon'], required: [] },
  spark: {
    allowed: ['header', 'priority', 'card', 'label', 'render', 'headerIcon', 'help', 'value'],
    required: ['label', 'render'],
  },
  select: {
    allowed: [...COMMON, 'label', 'options', 'commit', 'filter'],
    required: ['label', 'options', 'commit'],
  },
  actions: { allowed: ['header'], required: [] },
  custom: {
    allowed: [
      'header',
      'headerIcon',
      'help',
      'render',
      'sortValue',
      'card',
      'priority',
      'width',
      'align',
      'search',
      'filter',
    ],
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
  style: ['short', 'long', 'month', 'weekday', 'day'],
  footer: ['sum', 'mean', 'min', 'max', 'count'],
  imageShape: ['person', 'object'],
  duration: ['ms', 's'],
  lamp: [true, false],
  fraction: [true, false],
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
  person: ['multi'],
  tags: ['multi'],
  countdown: ['range'],
  link: ['text'],
  text: ['text'],
  status: ['multi'],
  select: ['multi'],
  boolean: ['multi'],
  number: ['range'],
  money: ['range'],
  delta: ['range'],
  meter: ['range'],
  progress: ['range'],
  custom: ['text'],
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
  if (
    (kind === 'date' || kind === 'relativeTime' || kind === 'countdown') &&
    given['filter'] === 'range'
  ) {
    if (typeof given['picker'] !== 'function') {
      fail(
        kind,
        id,
        'has filter: "range" and needs the option "picker" (DateRangePicker from basalt-ui/ui/date-picker)',
      )
    }
  }
  if (given['of'] !== undefined) {
    if (given['footer'] !== undefined)
      fail(kind, id, 'has "of" and takes no "footer": a sum of shares is no total')
    if (given['duration'] !== undefined)
      fail(kind, id, 'has "of" and "duration": a fraction is a count of a count')
  } else if (given['warnBelow'] !== undefined || given['badBelow'] !== undefined) {
    fail(
      kind,
      id,
      'has "warnBelow" or "badBelow" and needs "of": the thresholds are shares of a whole',
    )
  }
  if (kind === 'custom' && given['filter'] === 'text' && given['search'] === undefined)
    fail(kind, id, 'has filter: "text" and needs the option "search" (the text the filter matches)')
  if (given['segments'] !== undefined && given['fraction'] === true)
    fail(kind, id, 'has "segments" and "fraction": a stacked meter writes its total')
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
  text?: (value: unknown, row: T, format: Format, now: number) => string
  /** Renders even when the value is absent (`spark`, `custom`). */
  always?: boolean
  extra?: Partial<KindSpec<T>>
}

/**
 * Room beside a header's text in `ch`: one state mark (the sort arrow or the filter mark) and its gap.
 * With the icon's room that is the 5 ch a header kept before it lost its standing controls, so floors
 * and tiers hold; a column both sorted and filtered may trim its label (its `title` shows it whole).
 */
const HEADER_CHROME_CH = 2
/** A header asks for floor room up to this many `ch`; a longer one truncates (its title shows it whole). */
const HEADER_MAX_CH = 24
/** A header icon's room in `ch`: 16 px and its 6 px gap. Counted whether or not the table draws icons (`headerIcons` is read at draw time), so a floor never depends on the table. */
const HEADER_ICON_CH = 3
/** A header's help mark: 24 px and its gap, in `ch`. */
const HEADER_HELP_CH = 3
/** The age slot after a cell's first value: 60 px and its gap, in `ch`. */
const AGE_CH = 8
/** A trend arrow after a figure: 14 px and its gap, in `ch`. */
const TREND_CH = 3
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
  const icon =
    common.headerIcon === false ? undefined : (common.headerIcon ?? KIND_ICONS[b.kind] ?? undefined)
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
    ...(icon !== undefined && { headerIcon: icon }),
    ...(common.help !== undefined && { help: common.help }),
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
  // A header keeps room for its icon and its state marks, so neither ever cuts its label.
  const chrome =
    HEADER_CHROME_CH +
    (spec.headerIcon === undefined ? 0 : HEADER_ICON_CH) +
    (spec.help === undefined ? 0 : HEADER_HELP_CH)
  if (chrome !== HEADER_CHROME_CH) spec.width = floorOf(spec.width, b.header, chrome)
  const column: BuiltColumn<T> = { __brand: 'KindColumn', id: b.id, [KIND_SPEC]: spec }
  return column
}

/** The search text of a row: what the cell shows, then the stored value, one per line. */
function searchOf<T>(b: Base<T>): (row: T, format: Format, now: number) => string {
  return (row, format, now) => {
    const value = b.value(row)
    if (isAbsent(value)) return ''
    // An invalid Date draws the dash in its cell; its stored text is empty here, never a throw.
    const raw =
      value instanceof Date
        ? Number.isNaN(value.getTime())
          ? ''
          : value.toISOString()
        : String(value)
    const shown = b.text?.(value, row, format, now)
    return shown === undefined || shown === '' ? raw : `${shown}\n${raw}`
  }
}

/** A date value as its cell writes it, and its ISO day, so `2026-11-03` finds a timestamp too. */
function dateText(value: unknown, format: Format, style: DateStyle): string {
  const label = dateLabel(value, format, style)
  return label === null ? '' : `${label.text}\n${label.iso.slice(0, 10)}`
}

/** A share as a percent, rounded past float noise so a range end of `70` matches `0.7`. */
const toPercent = (share: number): number => Math.round(share * 1e8) / 1e6

/** A meter's readout as a fraction of its scale: `455/472`. */
const meterFraction = (format: Format, value: number, of: number): string =>
  `${format.number(value)}/${format.number(of)}`

/** A maybe-null string as the optional string a cell prop takes. */
const hold = (value: string | null | undefined): string | undefined => value ?? undefined

/** Two list cells by their entries read as one line, so the first name decides. */
function compareLists(a: unknown, b: unknown): number {
  return listLine(a).localeCompare(listLine(b))
}

const listLine = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v ?? ''))

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
 * The column factory, typed by the row. Call it at module scope; it carries `T` and nothing else. The
 * column plan is silent in a production build, so know its three rules: more than two priority 1 columns
 * demote to 2 by declaration order, the identity column first; a visible width sum above 1800 px stays
 * reduced, so priority 3 never shows; and above 800 px of priority 1 and 2 the trailing priority 2
 * columns demote to 3. Dev builds warn; `basalt-ui shot detect` names a column hidden at 1800 px or
 * missing from every phone card (`craft-6/hidden-column`).
 *
 * @useWhen declaring the columns of a v3 data table: each column is a kind (`entity`, `money`, `status`, ...)
 * @neverWhen the table is static with no sort, filter, page or selection (use `ui/table`), or a cell needs free markup (`custom` is the one counted escape)
 *
 * @example
 * const c = col<Booking>()
 * const columns = [c.entity('payee', { header: 'Payee' }), c.money('amount', { currency: 'EUR' })]
 */
export function col<T>(): Col<T> {
  const columns: Col<T> = {
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
            image={
              o?.image === undefined
                ? undefined
                : { src: hold(o.image(row)), shape: o.imageShape ?? 'object' }
            }
            id={hold(o?.ref?.(row))}
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
                    String(read<T>(key)(row) ?? '').length +
                      (o.icon === undefined && o.image === undefined ? 0 : 3) +
                      ((o.ref?.(row)?.length ?? -1) + 1),
                    o.sub?.(row)?.length ?? 0,
                  ),
              },
            }),
          },
        },
      ),
    title: <const K extends string>(key: KeysOf<T, string>, o: TitleOptions<T, K>) => {
      const { type, icons, ...entity } = o
      return columns.entity(key, { ...entity, icon: (row: T) => icons[type(row)] })
    },
    person: (key, o) =>
      keyed<T>(
        'person',
        key,
        o,
        (v, row) => (
          <PersonCell
            name={String(v)}
            src={hold(o?.avatar?.(row))}
            role={hold(o?.role?.(row))}
            href={o?.href?.(row)}
          />
        ),
        {
          text: (_v, row) => o?.role?.(row) ?? '',
          spec: {
            ...(o?.role !== undefined && {
              width: floorOf({ ch: 28, flex: false }, humanize(o?.id ?? key)),
            }),
            filter: o?.filter === 'multi' ? 'anyOf' : null,
          },
        },
      ),
    people: (key, o) => {
      const header = o?.header ?? humanize(o?.id ?? key)
      return keyed<T>(
        'person',
        key,
        o,
        (v, row) => (
          <PeopleCell
            label={header}
            max={o?.max ?? 4}
            people={(v as readonly string[]).map((name) => {
              const src = o?.avatar?.(name, row)
              return src === null || src === undefined ? { name } : { name, src }
            })}
          />
        ),
        {
          spec: {
            sort: { compare: compareLists },
            filter: o?.filter === 'multi' ? 'anyOf' : null,
          },
        },
      )
    },
    tags: (key, o) =>
      keyed<T>(
        'tags',
        key,
        o,
        (v) => (
          <TagsCell
            tags={v as readonly string[]}
            labels={o?.labels}
            tone={o?.tone}
            icon={o?.icon}
          />
        ),
        {
          text: (v) => (v as readonly string[]).map((tag) => o?.labels?.[tag] ?? tag).join('\n'),
          spec: {
            sort: { compare: compareLists },
            ...(o?.labels !== undefined && { labels: o.labels }),
            ...(o?.tone !== undefined && { tone: o.tone }),
            filter: o?.filter === 'multi' ? 'anyOf' : null,
          },
        },
      ),
    countdown: (key, o) => {
      const limits = { bad: o?.bad ?? -1, warn: o?.warn, horizon: o?.horizon ?? 60 }
      return keyed<T>(
        'countdown',
        key,
        o,
        (v, _row, env) => (
          <CountdownCell
            value={v}
            format={env.format}
            now={env.now}
            zone={env.zone}
            limits={limits}
          />
        ),
        {
          text: (v, _row, format) => dateText(v, format, 'short'),
          spec: dateFilter<T>(o),
        },
      )
    },
    link: (key, o) =>
      keyed<T>(
        'link',
        key,
        o,
        (v, row) => (
          <LinkCell
            text={String(v)}
            label={hold(o?.label?.(row))}
            href={o?.href?.(row)}
            icon={o?.icon?.(row)}
          />
        ),
        {
          text: (_v, row) => o?.label?.(row) ?? '',
          spec: {
            filter: o?.filter === 'text' ? 'contains' : null,
            // sized to its widest loaded URL: a link cut short is a link that cannot be read
            content: {
              measure: (row: T) =>
                (o?.label?.(row) ?? linkLabel(String(read<T>(key)(row) ?? ''))).length +
                (o?.icon === undefined ? 0 : 2),
            },
          },
        },
      ),
    text: (key, o) =>
      keyed<T>(
        'text',
        key,
        o,
        (v) =>
          o?.quiet === true ? (
            <QuietText text={o?.labels?.[String(v)] ?? String(v)} />
          ) : (
            (o?.labels?.[String(v)] ?? String(v))
          ),
        {
          text: (v) => o?.labels?.[String(v)] ?? '',
          spec: {
            // a preview wants the room the other columns leave
            ...(o?.quiet === true && { wrap: false, width: { ch: 32, flex: true } }),
            filter: o?.filter === 'text' ? 'contains' : null,
            content: {
              measure: (row: T) => {
                const value = read<T>(key)(row)
                return isAbsent(value) ? 1 : (o?.labels?.[String(value)] ?? String(value)).length
              },
              short: {
                // the header's own floor, with room for its icon and state marks as floorOf gives it
                minCh:
                  Math.min(
                    HEADER_MAX_CH,
                    (o?.header ?? humanize(o?.id ?? key)).length + HEADER_CHROME_CH,
                  ) + (o?.headerIcon === false ? 0 : HEADER_ICON_CH),
                maxCh: SHORT_TEXT_MAX_CH,
              },
            },
          },
        },
      ),
    number: (key, o) => {
      const scale = o?.duration === 's' ? 1000 : 1
      const write = (format: Format, v: number): string =>
        o?.duration === undefined
          ? formatNumber(format, v, o?.digits)
          : durationText(format, v * scale)
      const whole = o?.of
      const part = read<T>(key)
      const wholeOf = (row: T): number | null => {
        const value = whole?.(row)
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
      }
      const shareOf = (row: T): number | null => {
        const value = part(row)
        const of = wholeOf(row)
        return typeof value === 'number' && of !== null ? value / of : null
      }
      const toneOf = (share: number): Tone =>
        o?.badBelow !== undefined && share < o.badBelow
          ? 'bad'
          : o?.warnBelow !== undefined && share < o.warnBelow
            ? 'warn'
            : 'neutral'
      const fractionText = (format: Format, v: number, of: number): string =>
        `${formatNumber(format, v, o?.digits)}/${formatNumber(format, of, o?.digits)}`
      const header = withUnit(o?.header ?? humanize(o?.id ?? key), o?.unit)
      const slotted = o?.trend !== undefined || o?.age !== undefined
      // the figure's own room (a fraction is `455/472`), then a slot each for the arrow and the age
      const ch =
        (whole === undefined ? 10 : 7) +
        (o?.trend === undefined ? 0 : TREND_CH) +
        (o?.age === undefined ? 0 : AGE_CH)
      /** The slots after the figure; a value of `null` keeps them empty. */
      const slots = (row: T, env: CellEnv, value: number | null) => ({
        trend:
          o?.trend === undefined
            ? undefined
            : {
                value,
                spec: {
                  before: o.trend.before(row),
                  better: o.trend.better,
                  flat: o.trend.flat ?? 0.1,
                  against: o.trend.against,
                  write: (n: number) => write(env.format, n),
                },
              },
        age:
          o?.age === undefined
            ? undefined
            : { at: value === null ? null : o.age.at(row), label: o.age.label },
      })
      const draw = (v: unknown, row: T, env: CellEnv): ReactNode => {
        const of = wholeOf(row)
        const present =
          typeof v === 'number' && Number.isFinite(v) && (whole === undefined || of !== null)
        if (!present) {
          // A figure with trailing slots keeps them when absent, so its dash sits under the figures.
          if (!slotted) return isAbsent(v) || typeof v === 'number' ? <Absent /> : String(v)
          return (
            <FigureCell
              text={<Absent />}
              {...slots(row, env, null)}
              format={env.format}
              now={env.now}
            />
          )
        }
        const { trend, age } = slots(row, env, v)
        if (whole !== undefined && of !== null) {
          return (
            <FigureCell
              text={fractionText(env.format, v, of)}
              fraction={{ part: v, whole: of }}
              tone={toneOf(v / of)}
              trend={trend}
              age={age}
              format={env.format}
              now={env.now}
            />
          )
        }
        const text = write(env.format, v)
        if (!slotted) return text
        return <FigureCell text={text} trend={trend} age={age} format={env.format} now={env.now} />
      }
      return keyed<T>('number', key, o, draw, {
        header: (h) => withUnit(h, o?.unit),
        text: (v, row, format) => {
          if (typeof v !== 'number') return ''
          const of = wholeOf(row)
          return whole === undefined
            ? write(format, v)
            : of === null
              ? ''
              : fractionText(format, v, of)
        },
        spec: {
          ...(slotted && {
            render: (row: T, env: CellEnv) => draw(part(row), row, env),
            trail: o?.trend === undefined ? 'age' : o?.age === undefined ? 'trend' : 'both',
          }),
          ...(whole !== undefined && { value: shareOf }),
          ...((slotted || whole !== undefined) && { width: floorOf({ ch, flex: false }, header) }),
          drawTotal: (v, env) => write(env.format, v),
          ...footerOf<T>(o?.footer, (v, env) => write(env.format, v)).spec,
          ...rangeFilter<T>(o),
        },
      })
    },
    money: (key, o) =>
      keyed<T>(
        'money',
        key,
        o,
        (v, _row, env) =>
          typeof v === 'number' ? formatMoney(env.format, v, o.currency, o.digits) : String(v),
        {
          header: (h) => withUnit(h, o?.currency),
          text: (v, _row, format) =>
            typeof v === 'number' ? formatMoney(format, v, o.currency, o.digits) : '',
          spec: {
            unit: o.currency,
            drawTotal: (v, env) => formatMoney(env.format, v, o.currency, o.digits),
            ...footerOf<T>(o?.footer, (v, env) => formatMoney(env.format, v, o.currency, o.digits))
              .spec,
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
            <DateCell
              value={v}
              format={env.format}
              style={o?.style ?? 'short'}
              mono={o?.mono === true}
            />
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
            <RelativeTimeCell value={v} format={env.format} now={env.now} mono={o?.mono === true} />
          </WithIcon>
        ),
        {
          // what the cell shows (`3 days ago`, at the table's clock) and the date it stands for
          text: (v, _row, format, now) => {
            const instant = toInstant(v)
            const relative = instant === null ? '' : format.relative(instant, now)
            return `${relative}\n${dateText(v, format, 'long')}`
          },
          spec: dateFilter<T>(o),
        },
      ),
    status: <const O extends string>(key: KeysOf<T, string>, o: StatusOptions<O, T>) =>
      keyed<T>(
        'status',
        key,
        o,
        // A cell holds the stored value, which the column's `options` name as a closed list.
        (v, row, env) => {
          const word = o.labels?.[String(v) as O] ?? String(v)
          const tone = o.tone?.(String(v) as O) ?? 'neutral'
          const age = o.age === undefined ? undefined : { at: o.age.at(row), label: o.age.label }
          if (o.lamp === true)
            return <LampCell value={word} tone={tone} age={age} format={env.format} now={env.now} />
          const cell = <StatusCell value={word} tone={tone} icon={o.icon?.(row)} />
          return age === undefined ? (
            cell
          ) : (
            <WithAge age={age} format={env.format} now={env.now}>
              {cell}
            </WithAge>
          )
        },
        {
          text: (v) => o.labels?.[String(v) as O] ?? '',
          spec: {
            // The options are a closed list, so the widest word is known before a row loads.
            width: floorOf(
              {
                // a lamp is its dot alone; an age takes its own slot after the state
                ch:
                  (o?.lamp === true
                    ? STATUS_DOT_CH
                    : Math.max(
                        0,
                        ...(o?.options ?? []).map(
                          (option) =>
                            (o?.labels?.[option] ?? option).length +
                            STATUS_DOT_CH +
                            (o?.icon === undefined ? 0 : STATUS_ICON_EXTRA_CH),
                        ),
                      )) + (o?.age === undefined ? 0 : AGE_CH),
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
            // a zero change draws the dash, so it has no shown text
            typeof v === 'number' && v !== 0 ? deltaLabel(format, v, o.unit, o.currency) : '',
          spec: rangeFilter<T>(o),
        },
      ),
    meter: (key, o) => {
      const id = o?.id ?? key
      const label = o?.header ?? humanize(id)
      const max = o?.max
      const perRow = typeof max === 'function'
      const maxOf = (row: T): number | null => {
        const value = typeof max === 'function' ? max(row) : (max ?? 1)
        return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
      }
      const raw = read<T>(key)
      const shareOf = (row: T): number | null => {
        const value = raw(row)
        const of = maxOf(row)
        return typeof value === 'number' && of !== null ? value / of : null
      }
      const segments = o?.segments
      return keyed<T>(
        'meter',
        key,
        o,
        (v, row, env) => {
          if (typeof v !== 'number') return String(v)
          if (segments !== undefined) {
            return (
              <StackedMeterCell
                label={label}
                total={v}
                max={maxOf(row) ?? v}
                format={env.format}
                parts={segments.map((segment) => {
                  const value = segment.value(row)
                  return {
                    label: segment.label,
                    tone: segment.tone,
                    value: typeof value === 'number' && Number.isFinite(value) ? value : 0,
                  }
                })}
              />
            )
          }
          const of = maxOf(row)
          if (of === null) return <Absent />
          return (
            <MeterCell
              label={label}
              value={v}
              max={of}
              write={o?.fraction === true ? (n) => meterFraction(env.format, n, of) : undefined}
            />
          )
        },
        {
          ...(o?.fraction === true && {
            text: (v: unknown, row: T, format: Format) => {
              const of = maxOf(row)
              return typeof v === 'number' && of !== null ? meterFraction(format, v, of) : ''
            },
          }),
          spec: {
            ...(perRow && { value: shareOf }),
            // a track keeps room beside a readout of one figure (a total) or of two (a fraction)
            ...((segments !== undefined || o?.fraction === true) && {
              width: floorOf({ ch: segments === undefined ? 13 : 14, flex: false }, label),
            }),
            ...(o?.filter === 'range' &&
              rangeFilter<T>({
                filter: 'range',
                bounds: [0, perRow ? 1 : typeof max === 'number' ? max : 1],
              })),
          },
        },
      )
    },
    progress: (key, o) => {
      const part = read<T>(key)
      const label = o?.header ?? humanize(o?.id ?? key)
      // the sort, range filter and footers read the share in percent; the cell reads the share
      const percentOf = (row: T): number | null => {
        const share = part(row)
        return typeof share === 'number' && Number.isFinite(share) ? toPercent(share) : null
      }
      return keyed<T>(
        'progress',
        key,
        o,
        (v, row, env) => {
          if (typeof v !== 'number' || !Number.isFinite(v)) return <Absent />
          const text = env.format.percent(v)
          return (
            <MeterCell
              label={label}
              value={Math.min(1, Math.max(0, v))}
              max={1}
              tone={o?.tone?.(v, row)}
              write={() => text}
            />
          )
        },
        {
          text: (v, _row, format) =>
            typeof v === 'number' && Number.isFinite(v) ? format.percent(v) : '',
          spec: {
            value: percentOf,
            ...(o?.filter === 'range' && { filter: 'range' as const, bounds: [0, 100] as const }),
            drawTotal: (v, env) => env.format.percent(v / 100),
            ...footerOf<T>(o?.footer, (v, env) => env.format.percent(v / 100)).spec,
          },
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
      const total = o.value
      const header = o?.header ?? o.label
      return build<T>({
        kind: 'spark',
        id,
        header,
        value: total ?? (() => undefined),
        common: o,
        always: true,
        draw: (_v, row, env) => {
          const line = o.render(row, env.box)
          if (total === undefined) return line
          const value = total(row)
          return (
            <SparkTotalCell
              spark={line}
              total={
                typeof value === 'number' && Number.isFinite(value) ? (
                  env.format.number(value)
                ) : (
                  <Absent />
                )
              }
            />
          )
        },
        // the total is the line's figure: the column sorts by it
        ...(total !== undefined && {
          extra: { sort: { fn: 'basic' }, width: floorOf({ ch: 20, flex: false }, header) },
        }),
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
      const text = o.search
      const readText = text === undefined ? undefined : (row: T): string => text(row) ?? ''
      return build<T>({
        kind: 'custom',
        id,
        header: o?.header ?? humanize(id),
        value: (row) => o.sortValue(row),
        always: true,
        draw: (_v, row, env) => o.render(row, env),
        extra: {
          ...(o.headerIcon !== undefined && { headerIcon: o.headerIcon }),
          ...(o.help !== undefined && { help: o.help }),
          ...(readText !== undefined && { search: readText }),
          ...(readText !== undefined &&
            o.filter === 'text' && { filter: 'contains' as const, filterText: readText }),
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
  return columns
}
