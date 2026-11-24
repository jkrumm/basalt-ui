/**
 * Cards contract: the public types of `StatCard`, `StatCell`, `DataPanel` and `KanbanCard`. Types
 * only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/charts-cards-kanban.md
 * section 4 (the `src/cards/contract.ts` block, plus the frame types it names).
 *
 * `./cards` never imports `./charts`; the frame types both contracts name (`Fact`, `FootFacts`,
 * `FrameHead`, `LegendEntry`) are declared once in `core/phase.ts`.
 */
import type {
  Fact,
  FootFacts,
  FrameHead,
  FrameState,
  CardMenu,
  LegendEntry,
  MenuEntry,
} from '../core/phase'
import type {
  BoxSlot,
  ControlsSlot,
  Delta,
  IconComponent,
  MeterSpec,
  NavTarget,
  Verdict,
} from '../core/ports'

// ---- Frame types the sketch files under ports (absent from ports.ts) ----------------------

export type { Fact, FootFacts, FrameHead, CardMenu, LegendEntry, MenuEntry }

/** A chip on a `KanbanCard`. Minimal; the concept elides it. */
export type CardChip = { label: string; icon?: IconComponent }

// ---- Cards --------------------------------------------------------------------------------

/** A card is a link, a button or inert; never a link and a button at once. */
export type CardTarget =
  | { href: string | NavTarget; onClick?: never }
  | { onClick: () => void; href?: never }
  | { href?: never; onClick?: never }

/** An `undefined` field is an absent one, so a maybe-value passes straight. */
export type StatCardProps = CardTarget &
  FrameHead &
  FrameState & {
    /** `null` renders a muted dash: absent, never zero. */
    value: number | string | null
    unit?: string | undefined
    /** A change against a period; `value` prints as given, so pass `'+12%'`, never the fraction 0.12. */
    delta?: Delta | undefined
    /** The verdict home: dot plus word. A card never takes a hue. */
    status?: Verdict | undefined
    sub?: string | undefined
    /** The sub line is a time or an id: drawn in the mono face with tabular numerals. */
    subMono?: boolean | undefined
    /** Called only in `ready` and `stale`, in a fixed clipping box of `chartHeight` (72 px: plot 56 + label row 16). */
    chart?: BoxSlot | undefined
    /** The chart box's height in px, default 72. A one-line chart (a `Meter`, about 20 px) passes its own, so the card has no empty band; every phase holds the one height. */
    chartHeight?: number | undefined
    /** The three labels under the chart (start, middle, end), drawn in the 16 px row so the slot draws the plot alone. */
    xLabels?: readonly [string, string, string] | undefined
    footer?: FootFacts | undefined
    controls?: ControlsSlot<'widget'> | undefined
    menu?: CardMenu | undefined
  }

export type StatRow = {
  label: string
  value: string | number
  delta?: Delta
  bar?: { value: number; max: number }
  /** The value is a time or an id: drawn in the mono face with tabular numerals. */
  mono?: boolean | undefined
}

/** An `undefined` field is an absent one, so a maybe-value passes straight. */
export type StatCellProps = CardTarget &
  FrameState & {
    label: string
    /** A glyph before the label, drawn in the caption's muted ink. */
    icon?: IconComponent | undefined
    /** The series colour of the mark this figure reads, drawn as a dot before the label. */
    swatch?: { light: string; dark: string } | undefined
    qualifier?: string | undefined
    info?: string | undefined
    value?: number | string | null | undefined
    unit?: string | undefined
    delta?: Delta | undefined
    status?: Verdict | undefined
    sub?: string | undefined
    /** The sub line is a time or an id: drawn in the mono face with tabular numerals. */
    subMono?: boolean | undefined
    srText?: string | undefined
    meter?: MeterSpec | undefined
    /** Called in a 28 px box. */
    chart?: BoxSlot | undefined
    rows?: readonly StatRow[] | undefined
  }

export type DataPanelProps = FrameHead &
  FrameState & {
    controls?: ControlsSlot<'widget'>
    toolbar?: ControlsSlot<'widget'>
    menu?: CardMenu
    legend?: readonly LegendEntry[]
    /**
     * Required: the loading card draws its final shape. `cardHeight` is the px of one phone card of the `rows` body
     * (default 74, the phone list row with its Details door; pass 66 for a list without one, or the row height of a table that
     * stays rows on a phone), so a loading frame under `@regular` ends where the loaded list does.
     */
    bodySize: { rows: number; cardHeight?: number | undefined } | { height: number }
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
  status?: Verdict
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
