/**
 * Cards contract: the public types of `StatCard`, `StatCell`, `DataPanel` and `KanbanCard`. Types
 * only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/charts-cards-kanban.md
 * section 4 (the `src/cards/contract.ts` block, plus the frame types it names).
 *
 * `./cards` never imports `./charts`; the frame types both contracts name (`Fact`, `FootFacts`,
 * `FrameHead`) are declared once in `core/phase.ts`. `LegendEntry` is still repeated here,
 * structurally identical.
 */
import type { Fact, FootFacts, FrameHead, FrameState, Menu, MenuEntry } from '../core/phase'
import type {
  BoxSlot,
  ControlsSlot,
  Delta,
  IconComponent,
  MeterSpec,
  NavTarget,
  Status,
} from '../core/ports'

// ---- Frame types the sketch files under ports (absent from ports.ts) ----------------------

export type { Fact, FootFacts, FrameHead, Menu, MenuEntry }

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
  | { href: string | NavTarget; onClick?: never }
  | { onClick: () => void; href?: never }
  | { href?: never; onClick?: never }

export type StatCardProps = CardTarget &
  FrameHead &
  FrameState & {
    /** `null` renders a muted dash: absent, never zero. */
    value: number | string | null
    unit?: string
    /** A change against a period; `value` prints as given, so pass `'+12%'`, never the fraction 0.12. */
    delta?: Delta
    /** The verdict home: dot plus word. A card never takes a hue. */
    status?: Status
    sub?: string
    /** Called only in `ready` and `stale`, in a fixed 72 px clipping box (plot 56 + label row 16). */
    chart?: BoxSlot
    /** The three labels under the chart (start, middle, end), drawn in the 16 px row so the slot draws the plot alone. */
    xLabels?: readonly [string, string, string]
    footer?: FootFacts
    controls?: ControlsSlot<'widget'>
    menu?: Menu
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
    /** The series colour of the mark this figure reads, drawn as a dot before the label. */
    swatch?: { light: string; dark: string }
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
    controls?: ControlsSlot<'widget'>
    toolbar?: ControlsSlot<'widget'>
    menu?: Menu
    legend?: readonly LegendEntry[]
    /** Required: the loading card draws its final shape. */
    bodySize: { rows: number } | { height: number }
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
  href?: string | NavTarget
  age?: string
  meta?: readonly [string] | readonly [string, string]
  chips?: readonly [CardChip?, CardChip?, CardChip?, CardChip?]
  reason?: { icon?: IconComponent; text: string }
  status?: Status
  /** Entries after the move rows the card always offers, so one entry is enough. */
  menu?: readonly MenuEntry[]
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
