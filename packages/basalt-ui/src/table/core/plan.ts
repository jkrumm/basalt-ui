/**
 * The card and tier plan (docs/v3/concepts/data-table.md sections 5 and 6): pure and total. Every
 * column lands in exactly one card place; priorities are resolved deterministically; the tier
 * thresholds come from kind widths, never a measurement, so the server HTML already carries them.
 *
 * Card rules: the first `entity` is `title`, else the first column is promoted. At most one each
 * of `title`, `subtitle`, `badge`, `value`; at most 2 `edit`; at most 6 `meta`; overflow goes to
 * `detail`. A column hidden by the display state is `hidden`. `actions` sits in the kebab.
 *
 * Priority rules: the identity column is priority 1 and pinned start. More than two priority-1
 * columns demote by declaration order (identity first), one dev warning, never a throw.
 *
 * Tier rules: `fullAt` is the smallest of 800, 1000, 1200, 1440, 1800 the visible widths fit; a sum
 * above 1800 stays reduced (`null`) with a dev warning. If priority 1+2 exceed 480 px the card or
 * scroll threshold moves to 800; above 800 the trailing priority-2 columns demote to 3.
 */
import type { CardSlot, KindColumn, Priority } from '../contract'
import { specOf } from './kinds'
import type { CardPlace, KindName, KindSpec, Width } from './kinds-spec'

export const FULL_AT_STEPS = [800, 1000, 1200, 1440, 1800] as const
export type FullAt = (typeof FULL_AT_STEPS)[number]

/** Below this inline size the card (or scroll) tier applies; 800 when priority 1+2 do not fit 480. */
export type ReducedFrom = 480 | 800

/** px per `ch` at the table's body size, the cell's inline padding, the icon column. S3 checks them. */
export const CH_PX = 8
export const CELL_PAD_PX = 24
export const ICON_COL_PX = 44

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
  'id' | 'kind' | 'card' | 'priority' | 'width' | 'pin'
>

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
  /** Dev warnings; default `console.warn` outside production. */
  warn?: (message: string) => void
}

export function widthPx(width: Width): number {
  return width === 'icon' ? ICON_COL_PX : width.ch * CH_PX + CELL_PAD_PX
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
  inputs.forEach((input, index) => {
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
  })
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
  const widths = inputs.map((c) => widthPx(c.width))

  const sum = (pick: (index: number) => boolean) =>
    widths.reduce(
      (total, width, index) => (visible[index] && pick(index) ? total + width : total),
      0,
    )
  const total = sum(() => true)
  const fullAt = fullAtFor(total)
  if (fullAt === null) {
    warn(
      `basalt-ui/table: visible columns need ${total}px, above 1800; the table stays in the reduced tier`,
    )
  }

  const narrow = (index: number) => {
    const p = priorities[index]
    return p === null || p === 1 || p === 2
  }
  let core = sum(narrow)
  const reducedFrom: ReducedFrom = core > 480 ? 800 : 480
  for (let index = inputs.length - 1; core > 800 && index >= 0; index -= 1) {
    if (priorities[index] !== 2 || !visible[index]) continue
    priorities[index] = 3
    demoted.push(inputs[index]!.id)
    core -= widths[index]!
  }

  const columns = inputs.map((c, index): PlannedColumn => ({
    id: c.id,
    kind: c.kind,
    place: places[index]!,
    priority: priorities[index]!,
    pin: index === identity ? 'start' : c.pin,
    identity: index === identity,
    visible: visible[index]!,
    widthPx: widths[index]!,
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
