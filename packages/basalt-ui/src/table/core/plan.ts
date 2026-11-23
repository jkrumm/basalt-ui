/**
 * The card and tier plan (docs/v3/concepts/data-table.md sections 5 and 6): pure and total. Every
 * column lands in exactly one card place; priorities are resolved deterministically; the tier
 * thresholds come from kind widths, never a measurement, so the server HTML already carries them.
 *
 * Card rules: the first `entity` is `title`, else the first column is promoted. A column that names
 * its card slot (`card` option) is placed before the ones left to a default, so `card: 'value'` wins
 * over an earlier column of the same kind. At most one each
 * of `title`, `subtitle`, `badge`, `value`; at most 2 `edit`; at most 6 `meta`; overflow goes to
 * `detail`. A column hidden by the display state is `hidden`. `actions` sits in the kebab.
 *
 * Priority rules: the identity column is priority 1 and pinned start. More than two priority-1
 * columns demote by declaration order (identity first), one dev warning, never a throw.
 *
 * Tier rules: `fullAt` is the smallest of `FULL_AT_STEPS` (40 px apart up to 800, with 700 between 680 and 720,
 * then 100 to 200 px apart) the visible widths fit and never below the card threshold; a sum above 1800 stays
 * reduced (`null`) with a dev warning. If priority 1+2 exceed 480 px the card or scroll threshold moves to 700
 * when they fit 700 px, else to 800; above 800 the trailing priority-2
 * columns demote to 3.
 */
import type { CardSlot, KindColumn, Priority } from '../contract'
import { specOf } from './kinds'
import { KIND_DEFAULTS } from './kinds-spec'
import type { CardPlace, KindName, KindSpec, Width } from './kinds-spec'

export const FULL_AT_STEPS = [
  480, 520, 560, 600, 640, 680, 700, 720, 760, 800, 900, 1000, 1100, 1200, 1300, 1440, 1600, 1800,
] as const
export type FullAt = (typeof FULL_AT_STEPS)[number]

/** Below this inline size the card (or scroll) tier applies: the smallest step priority 1+2 fit. */
export type ReducedFrom = 480 | 700 | 800

/** px per `ch` at the table's body size, the cell's inline padding, the icon column. S3 checks them. */
export const CH_PX = 8
export const CELL_PAD_PX = 24
export const ICON_COL_PX = 44
/** The tick column's width: the `<col>` a selectable table draws and the offset of the first pinned column. */
export const TICK_COL_PX = 40
/** The row-number column's width (`rowNumbers`): four tabular digits and the cell padding. */
export const ROW_NUMBER_COL_PX = 44
/**
 * The row-number column for its largest number as the cell prints it (`format.number`, so `1,000`
 * counts its separator): those characters at the body's `ch` and 8 px each side.
 */
export function rowNumberPx(largest: string): number {
  return Math.max(ROW_NUMBER_COL_PX, largest.length * CH_PX + 16)
}
/** The widest a reader may drag a column. */
export const RESIZE_MAX_PX = 960

/** The caps per card place; `detail` and `hidden` are unbounded. */
export const SLOT_CAPS: Readonly<Partial<Record<CardPlace, number>>> = {
  title: 1,
  subtitle: 1,
  badge: 1,
  value: 1,
  edit: 2,
  meta: 6,
}

/** What the plan needs of a column; a pure input, so tests can generate sets without React. */
export type PlanInput = Pick<
  KindSpec<unknown>,
  'id' | 'kind' | 'card' | 'priority' | 'width' | 'pin' | 'sub'
> & {
  /** The caller named a card slot (`card` option): placed before the columns left to a default. */
  cardFirst?: boolean
  /** Sized to its widest loaded value; the ch comes from `PlanOptions.contentCh`. */
  content?: { short?: { minCh: number; maxCh: number } }
}

export type PlannedColumn = {
  id: string
  kind: KindName
  place: CardPlace
  /** `null` for `actions`: never hidden by a tier. */
  priority: Priority | null
  pin: 'start' | 'end' | null
  identity: boolean
  visible: boolean
  widthPx: number
  /**
   * A text-like column (title, text, link, person, tags) not resized by a reader and not sized to a short
   * value: it shares the free width of its table, from `widthPx` up to `capPx` (no cap in the reading look).
   */
  flex: boolean
  /** The widest a flexible column grows in px (`null`: no cap, or not flexible). The reading look has none: it fills its container. */
  capPx: number | null
  /**
   * Kept by `phone: 'columns'`: the identity, the card's `value`, its first `meta` and the actions.
   * Every other column leaves the phone row and stays in the row's details.
   */
  phoneKeep: boolean
  /** The caller asked for `card: 'detail'`: any other column in `detail` was left there by its kind or by a full slot. */
  cardDetail: boolean
}

export type TablePlan = {
  /** In declaration order. */
  columns: readonly PlannedColumn[]
  fullAt: FullAt | null
  reducedFrom: ReducedFrom
  /** Ids whose priority the plan lowered, in the order it lowered them. */
  demoted: readonly string[]
}

export type PlanOptions = {
  /** `display.visibility`: `false` hides a column. The identity column cannot be hidden. */
  visibility?: Readonly<Record<string, boolean>>
  /** The widest loaded value in `ch` of each `width: 'content'` column, by id. */
  contentCh?: Readonly<Record<string, number>>
  /** `display.widths`: the px a reader dragged a column to; it wins over the kind and the content width. */
  widths?: Readonly<Record<string, number>>
  /**
   * The grid look draws each column at its kind's roomier `gridCh`, never below its floor or its
   * content, and scrolls sideways instead of shrinking it.
   */
  look?: 'reading' | 'grid'
  /** Dev warnings; default `console.warn` outside production. */
  warn?: (message: string) => void
}

/** The bounds of a `width: 'content'` column in `ch`. */
export const CONTENT_MIN_CH = 18
export const CONTENT_MAX_CH = 40

export function widthPx(width: Width): number {
  return width === 'icon' ? ICON_COL_PX : width.ch * CH_PX + CELL_PAD_PX
}

/**
 * The px of a column sized to its loaded content, or `null` when it takes its kind width: no
 * `content`, or a `short` one (text) whose values are unloaded or too long to size a column to.
 */
function contentWidth(input: PlanInput, loaded: number | undefined): number | null {
  const content = input.content
  if (content === undefined) return null
  const ch = Math.ceil(loaded ?? 0)
  if (content.short !== undefined) {
    if (loaded === undefined || ch > content.short.maxCh) return null
    return widthPx({ ch: Math.max(content.short.minCh, ch), flex: false })
  }
  return widthPx({ ch: Math.min(CONTENT_MAX_CH, Math.max(CONTENT_MIN_CH, ch)), flex: false })
}

/** The width the grid look draws a column at: its kind's `gridCh`, never below its own floor. */
function gridWidthPx(input: PlanInput): number {
  const gridCh = KIND_DEFAULTS[input.kind].gridCh
  if (input.width === 'icon' || gridCh === null) return widthPx(input.width)
  return Math.max(widthPx(input.width), widthPx({ ch: gridCh, flex: false }))
}

/**
 * The widest a flexible column grows: its kind's `capCh` (twice that for a title with a sub line, the
 * wider text set smaller), never below the width it already has; `null` for a kind with no cap.
 */
function capWidthPx(input: PlanInput, floorPx: number): number | null {
  const capCh = KIND_DEFAULTS[input.kind].capCh
  if (capCh === null) return null
  const ch = input.kind === 'entity' && input.sub === true ? 2 * capCh : capCh
  return Math.max(floorPx, widthPx({ ch, flex: false }))
}

/** The narrowest a reader may drag a column of `kind`, in px. */
export function minWidthPx(kind: KindName): number {
  return KIND_DEFAULTS[kind].minCh * CH_PX + CELL_PAD_PX
}

/** A dragged width held between the kind's minimum and `RESIZE_MAX_PX`, in whole px. */
export function clampWidth(kind: KindName, px: number): number {
  return Math.round(Math.min(RESIZE_MAX_PX, Math.max(minWidthPx(kind), px)))
}

/** Whether a reader may drag the column's edge: every column but the icon column of `actions`. */
export function isResizable(input: Pick<PlanInput, 'width'>): boolean {
  return input.width !== 'icon'
}

/** The px a reader set for the column, held to its bounds, or `null` when none (or it cannot resize). */
function resizedWidth(input: PlanInput, set: number | undefined): number | null {
  if (set === undefined || !Number.isFinite(set) || !isResizable(input)) return null
  return clampWidth(input.kind, set)
}

function defaultWarn(message: string): void {
  if (process.env.NODE_ENV === 'production') return
  // eslint-disable-next-line no-console -- dev-only diagnostic
  console.warn(message)
}

/** The identity column: the first `entity`, else the first column that is not `actions`. */
function identityIndex(inputs: readonly PlanInput[]): number {
  const entity = inputs.findIndex((c) => c.kind === 'entity')
  if (entity !== -1) return entity
  return inputs.findIndex((c) => c.kind !== 'actions')
}

/** The kinds that answer with a drawn mark, not a plain value: they keep a card slot first. */
const MARKED_KINDS: ReadonlySet<KindName> = new Set(['meter', 'delta', 'status'])
const marked = (input: PlanInput): boolean => MARKED_KINDS.has(input.kind)

function placeCards(
  inputs: readonly PlanInput[],
  identity: number,
  visible: readonly boolean[],
): CardPlace[] {
  const used = new Map<CardPlace, number>()
  const take = (place: CardPlace): boolean => {
    const cap = SLOT_CAPS[place]
    const count = used.get(place) ?? 0
    if (cap !== undefined && count >= cap) return false
    used.set(place, count + 1)
    return true
  }
  const places: CardPlace[] = inputs.map(() => 'detail')
  if (identity !== -1) {
    take('title')
    places[identity] = 'title'
  }
  const place = (input: PlanInput, index: number): void => {
    if (index === identity) return
    if (!visible[index]) {
      places[index] = 'hidden'
      return
    }
    if (input.kind === 'actions') {
      places[index] = 'kebab'
      return
    }
    const wanted = input.card.filter((p): p is CardSlot => p !== 'title' && p !== 'kebab')
    places[index] = wanted.find(take) ?? 'detail'
  }
  // A slot the caller named is theirs before any default is read; of the rest, a column that draws a
  // meter, a delta or a status is placed ahead of plain text and numbers, so a full slot costs the
  // plain column its place. Declaration order only breaks ties among columns of the same standing.
  inputs.forEach((input, index) => input.cardFirst === true && place(input, index))
  inputs.forEach((input, index) => input.cardFirst !== true && marked(input) && place(input, index))
  inputs.forEach(
    (input, index) => input.cardFirst !== true && !marked(input) && place(input, index),
  )
  return places
}

function resolvePriorities(
  inputs: readonly PlanInput[],
  identity: number,
): { priorities: (Priority | null)[]; demoted: string[] } {
  const priorities = inputs.map((c, index): Priority | null =>
    c.kind === 'actions' ? null : index === identity ? 1 : (c.priority ?? 2),
  )
  const order =
    identity === -1
      ? [...inputs.keys()]
      : [identity, ...[...inputs.keys()].filter((i) => i !== identity)]
  const demoted: string[] = []
  let kept = 0
  for (const index of order) {
    if (priorities[index] !== 1) continue
    if (kept < 2) {
      kept += 1
      continue
    }
    priorities[index] = 2
    demoted.push(inputs[index]!.id)
  }
  return { priorities, demoted }
}

/** The card threshold for a priority 1+2 width: the smallest step it fits, 800 above 700. */
function reducedFromOf(core: number): ReducedFrom {
  if (core <= 480) return 480
  return core <= 700 ? 700 : 800
}

function fullAtFor(total: number): FullAt | null {
  return FULL_AT_STEPS.find((step) => total <= step) ?? null
}

/** The plan over pure inputs, in declaration order. Deterministic: same input, same plan. */
export function planInputs(inputs: readonly PlanInput[], options: PlanOptions = {}): TablePlan {
  const warn = options.warn ?? defaultWarn
  const identity = identityIndex(inputs)
  const visible = inputs.map(
    (c, index) => index === identity || options.visibility?.[c.id] !== false,
  )
  const places = placeCards(inputs, identity, visible)
  const { priorities, demoted } = resolvePriorities(inputs, identity)
  if (demoted.length > 0) {
    warn(
      `basalt-ui/table: more than two priority-1 columns; ${demoted.join(', ')} demoted to 2 by declaration order`,
    )
  }
  // A width the reader set wins; a resized flexible column is fixed at it, the filler takes the rest.
  const resized = inputs.map((c) => resizedWidth(c, options.widths?.[c.id]))
  const content = inputs.map((c) => contentWidth(c, options.contentCh?.[c.id]))
  const grid = options.look === 'grid'
  // The pinned identity keeps its floor: the room it holds over the sideways scroll is room every other
  // column loses (at 390 a 30 ch title left a scrolled column 46 px).
  const widths = inputs.map(
    (c, index) =>
      resized[index] ??
      Math.max(content[index] ?? widthPx(c.width), grid && index !== identity ? gridWidthPx(c) : 0),
  )
  // A short text column sized to its values is a category: it keeps that width like a figure.
  const flexible = inputs.map(
    (c, index) =>
      resized[index] === null &&
      c.width !== 'icon' &&
      c.width.flex &&
      !(content[index] !== null && c.content?.short !== undefined),
  )

  const sum = (pick: (index: number) => boolean) =>
    widths.reduce(
      (total, width, index) => (visible[index] && pick(index) ? total + width : total),
      0,
    )
  const total = sum(() => true)
  const narrow = (index: number) => {
    const p = priorities[index]
    return p === null || p === 1 || p === 2
  }
  let core = sum(narrow)
  const reducedFrom = reducedFromOf(core)
  // Priority 3 shows from the smallest step every visible column fits, and never while the table is
  // still cards or a scroll: the card threshold is the floor.
  const fullAt = fullAtFor(Math.max(total, reducedFrom))
  if (fullAt === null) {
    warn(
      `basalt-ui/table: visible columns need ${total}px, above 1800; the table stays in the reduced tier`,
    )
  }

  for (let index = inputs.length - 1; core > 800 && index >= 0; index -= 1) {
    if (priorities[index] !== 2 || !visible[index]) continue
    priorities[index] = 3
    demoted.push(inputs[index]!.id)
    core -= widths[index]!
  }

  const firstValue = places.findIndex((p, index) => p === 'value' && visible[index])
  // `phone: 'columns'` keeps one meta column: the first that draws a mark, else the first.
  const metas = places.flatMap((p, index) => (p === 'meta' && visible[index] ? [index] : []))
  const firstMeta = metas.find((index) => marked(inputs[index]!)) ?? metas[0] ?? -1
  const columns = inputs.map((c, index): PlannedColumn => ({
    id: c.id,
    kind: c.kind,
    place: places[index]!,
    priority: priorities[index]!,
    pin: index === identity ? 'start' : c.pin,
    identity: index === identity,
    visible: visible[index]!,
    widthPx: widths[index]!,
    flex: flexible[index]!,
    capPx: flexible[index] && grid ? capWidthPx(c, widths[index]!) : null,
    cardDetail: c.cardFirst === true && c.card[0] === 'detail',
    phoneKeep:
      index === identity ||
      places[index] === 'kebab' ||
      index === firstValue ||
      index === firstMeta,
  }))
  return { columns, fullAt, reducedFrom, demoted }
}

/** The plan of a table's kind columns. */
export function planTable<T>(
  columns: readonly KindColumn<T>[],
  options: PlanOptions = {},
): TablePlan {
  return planInputs(
    columns.map((column) => specOf(column) as PlanInput),
    options,
  )
}
