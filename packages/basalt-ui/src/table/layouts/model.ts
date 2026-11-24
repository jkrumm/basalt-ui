/**
 * The layouts of a table view, as pure values over the table model (docs/v3/concepts/data-table.md
 * section 3, Layouts). A list, a board and a gallery read the same rows, columns and card places the
 * table plans, so search, filters, sort, grouping and selection are one state whatever is drawn.
 *
 * Law:
 * - A card face is the plan's card places: the identity column is the title, then the subtitle,
 *   up to four badges, the value and the meta values, each the text its cell shows.
 * - A board stands on a `c.select` column: the view's grouping when it names one, else the first.
 *   Its columns are the select's options in order; a row whose value is no option is left out.
 * - A board column's total is the first visible column the view reduces, over that column's rows.
 */
import { aggregate } from '../parts/footer-model'
import type { KindSpec } from '../core/kinds-spec'
import type { ModelRow, TableModel } from '../use-data-table'
import type { CardSlot } from '../contract'

/** One value on a card: the column it comes from, its header and the text its cell shows. */
export type FaceValue<T> = { spec: KindSpec<T>; label: string; text: string }

/** What a card shows of one row; `badges` holds at most four values. */
export type CardFace<T> = {
  title: string
  subtitle: FaceValue<T> | undefined
  badges: readonly FaceValue<T>[]
  value: FaceValue<T> | undefined
  meta: readonly FaceValue<T>[]
}

const MAX_BADGES = 4

/** The text a cell shows: the first line of the search text (shown, then stored), the name of an entity. */
export function textOf<T>(
  spec: KindSpec<T>,
  row: T,
  model: Pick<TableModel<T>, 'format' | 'now'>,
): string {
  const raw = spec.value(row)
  // An entity's search leads with its sub line, a select's with the control's name: both show the value.
  if (spec.kind === 'entity' || spec.kind === 'select')
    return raw === null || raw === undefined ? '' : String(raw)
  return (spec.search?.(row, model.format, model.now) ?? '').split('\n')[0] ?? ''
}

/** The header a card value names its column by; a gallery fact drawn by its cell keeps the unit there. */
const labelOf = <T>(spec: KindSpec<T>): string => spec.header

/** The visible columns of the plan with their card place, in drawn order. */
export function placedColumns<T>(
  model: Pick<TableModel<T>, 'specs' | 'plan'>,
): readonly { spec: KindSpec<T>; place: CardSlot | 'kebab'; identity: boolean }[] {
  return model.specs.flatMap((spec, index) => {
    const planned = model.plan.columns[index]
    if (planned === undefined || !planned.visible || spec.kind === 'actions') return []
    return [{ spec, place: planned.place, identity: planned.identity }]
  })
}

/** The face of one row: the plan's card places filled with the text of its cells. */
export function cardFace<T>(
  model: Pick<TableModel<T>, 'specs' | 'plan' | 'format' | 'now'>,
  row: T,
  /** A column the surface already says (a board's axis is its column): left off the face. */
  skip?: string,
): CardFace<T> {
  let title = ''
  let subtitle: FaceValue<T> | undefined
  let value: FaceValue<T> | undefined
  const badges: FaceValue<T>[] = []
  const meta: FaceValue<T>[] = []
  for (const { spec, place, identity } of placedColumns(model)) {
    if (spec.id === skip) continue
    const shown = textOf(spec, row, model)
    // A money value carries the currency its header names, as the phone card does.
    const text =
      shown !== '' && spec.unit !== undefined && !identity ? `${shown} ${spec.unit}` : shown
    if (identity) {
      title = text
      // An entity's sub line (its search text leads with it) is the card's subtitle.
      const sub =
        spec.sub === true ? spec.search?.(row, model.format, model.now).split('\n') : undefined
      if (sub !== undefined && sub.length > 1 && sub[0] !== '' && subtitle === undefined)
        subtitle = { spec, label: labelOf(spec), text: sub[0]! }
      continue
    }
    if (text === '') continue
    const entry = { spec, label: labelOf(spec), text }
    if (place === 'subtitle' && subtitle === undefined) subtitle = entry
    else if (place === 'badge' && badges.length < MAX_BADGES) badges.push(entry)
    else if (place === 'value' && value === undefined) value = entry
    else if (place === 'meta' || place === 'edit') meta.push(entry)
  }
  return { title, subtitle, badges, value, meta }
}

/** The column a board stands on: the view's grouping when it names an axis, else the first axis. */
export function boardAxis<T>(
  model: Pick<TableModel<T>, 'boardAxes' | 'groupBy' | 'state'>,
): string | undefined {
  const picked = model.state.display.groupBy ?? model.groupBy
  if (picked !== null && picked !== undefined && model.boardAxes.includes(picked)) return picked
  return model.boardAxes[0]
}

/** A pending move: the card shows in `to` at `index` until its commit settles or the data agrees. */
export type Pending = { to: string; index: number }

/** One board column: an option of the axis and its rows in body order, a moved card where it was dropped. */
export type BoardLane<T> = { id: string; label: string; rows: readonly ModelRow<T>[] }

/**
 * The rows of each option of `axis`, in body order. A pending move shows its card in its new column
 * at the index it was dropped at; a row whose value is no option sits in no column.
 */
export function boardLanes<T>(
  model: Pick<TableModel<T>, 'specs' | 'rows'>,
  axis: string,
  pending: ReadonlyMap<string, Pending>,
): readonly BoardLane<T>[] {
  const spec = model.specs.find((s) => s.id === axis)
  const options = spec?.edit?.options ?? spec?.options ?? []
  const lanes = new Map<string, ModelRow<T>[]>(options.map((option) => [option, []]))
  const moved: { row: ModelRow<T>; to: Pending }[] = []
  for (const row of model.rows) {
    const to = pending.get(row.id)
    if (to !== undefined) {
      moved.push({ row, to })
      continue
    }
    const raw = spec?.value(row.original)
    lanes.get(raw === null || raw === undefined ? '' : String(raw))?.push(row)
  }
  for (const { row, to } of moved) {
    const lane = lanes.get(to.to)
    lane?.splice(Math.min(to.index, lane.length), 0, row)
  }
  return options.map((option) => ({
    id: option,
    label: spec?.labels?.[option] ?? option,
    rows: lanes.get(option) ?? [],
  }))
}

/** The column whose reduce a board column's header totals: the first visible one the view reduces. */
export function totalColumn<T>(
  model: Pick<TableModel<T>, 'specs' | 'plan' | 'aggregateOf'>,
): KindSpec<T> | undefined {
  return placedColumns(model).find(
    ({ spec }) => spec.drawTotal !== undefined && model.aggregateOf(spec.id) !== undefined,
  )?.spec
}

/** A board column's total, as its footer writes it; `undefined` with nothing to reduce. */
export function laneTotal<T>(
  model: Pick<TableModel<T>, 'aggregateOf' | 'format' | 'now' | 'zone'>,
  spec: KindSpec<T> | undefined,
  rows: readonly ModelRow<T>[],
): string | undefined {
  if (spec === undefined || spec.drawTotal === undefined) return undefined
  const fn = model.aggregateOf(spec.id)
  if (fn === undefined) return undefined
  const value = aggregate(
    fn,
    rows.map((row) => row.original),
    spec.value,
  )
  if (value === null) return undefined
  const drawn = spec.drawTotal(value, {
    format: model.format,
    now: model.now,
    zone: model.zone,
    box: { height: 0, phase: 'ready' },
  })
  if (typeof drawn !== 'string' && typeof drawn !== 'number') return undefined
  return spec.unit === undefined ? String(drawn) : `${drawn} ${spec.unit}`
}
