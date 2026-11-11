/**
 * Cards contract: the public types of `StatCard`, `StatCell`, `DataPanel` and `KanbanCard`. Types
 * only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/charts-cards-kanban.md
 * section 4 (the `src/cards/contract.ts` block, plus the frame types it names).
 *
 * `./cards` never imports `./charts`, so the frame types `charts/contract.ts` also declares
 * (`Fact`, `FootFacts`, `FrameHead`, `LegendEntry`) are repeated here, structurally identical.
 */
import type { CardAction, FrameState } from '../core/phase'
import type { BoxSlot, ControlsSlot, Delta, IconComponent, MeterSpec, Status } from '../core/ports'

// ---- Frame types the sketch files under ports (absent from ports.ts) ----------------------

/** One labelled fact in a footer. `value` is data, never a node, so every card formats alike. */
export type Fact = { label: string; value: string | number }

/** Capped at 2; `null` drops one, so a conditional fact type-checks without a hole. */
export type FootFacts = readonly [Fact | null, (Fact | null)?]

/** The header every frame shares. */
export type FrameHead = { title: string; subtitle?: string; icon?: IconComponent; info?: string }

/** One menu entry: a link or a handler, never both. Minimal; the concept elides it. */
export type MenuAction = CardAction

/** A chip on a `KanbanCard`. Minimal; the concept elides it. */
export type CardChip = { label: string; icon?: IconComponent }

/** A legend entry; structurally the charts contract's `LegendEntry` (no `./charts` import). */
export type LegendEntry = {
  key: string
  label: string
  color: { light: string; dark: string }
  swatch?: 'solid' | 'dashed'
  failed?: boolean
}

// ---- Cards --------------------------------------------------------------------------------

/** A card is a link, a button or inert; never a link and a button at once. */
export type CardTarget =
  | { href: string; onSelect?: never }
  | { onSelect: () => void; href?: never }
  | { href?: never; onSelect?: never }

export type StatCardProps = CardTarget &
  FrameHead &
  FrameState & {
    /** `null` renders a muted dash: absent, never zero. */
    value: number | string | null
    unit?: string
    delta?: Delta
    /** The verdict home: dot plus word. A card never takes a hue. */
    status?: Status
    sub?: string
    /** Called only in `ready` and `stale`, in a fixed 72 px clipping box (plot 56 + label row 16). */
    chart?: BoxSlot
    footer?: FootFacts
    controls?: ControlsSlot
    menu?: readonly [MenuAction, MenuAction, ...MenuAction[]]
  }

export type StatRow = {
  label: string
  value: string | number
  delta?: Delta
  bar?: { value: number; max: number }
}

export type StatCellProps = CardTarget &
  FrameState & {
    label: string
    qualifier?: string
    info?: string
    value?: number | string | null
    unit?: string
    delta?: Delta
    status?: Status
    sub?: string
    srText?: string
    meter?: MeterSpec
    /** Called in a 28 px box. */
    chart?: BoxSlot
    rows?: readonly StatRow[]
  }

export type DataPanelProps = FrameHead &
  FrameState & {
    controls?: ControlsSlot
    toolbar?: ControlsSlot
    menu?: BoxSlot
    legend?: readonly LegendEntry[]
    /** Required: the loading card draws its final shape. */
    skeleton: { rows: number } | { height: number }
    /** Tables, lists and boards. A chart goes in `ChartCard`. */
    body: BoxSlot
  }

export type ColumnRef<C extends string> = {
  id: C
  label: string
  count: number
  disabled?: boolean
}

export type Move<C extends string> = { id: string; from: C; to: C; index: number }

export type KanbanCardProps<C extends string> = {
  id: string
  title: string
  href?: string
  age?: string
  meta?: readonly [string] | readonly [string, string]
  chips?: readonly [CardChip?, CardChip?, CardChip?, CardChip?]
  reason?: { icon?: IconComponent; text: string }
  status?: Status
  menu?: readonly MenuAction[]
  /** Required: no card exists without the non-drag path. `'static'` is a read-only board. */
  move:
    | 'static'
    | {
        column: ColumnRef<C>
        index: number
        columns: readonly ColumnRef<C>[]
        onMove: (m: Move<C>) => void
        dragging?: boolean
      }
}
