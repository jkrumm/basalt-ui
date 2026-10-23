/**
 * The measured column fold and the pinning it feeds (`docs/CONTROLS-SPEC.md` §2, SPEC § 6.6 /
 * § 9.1): which columns fold off a compact table, which one pins when the folded table still
 * overflows, and the toggle, disclosure and sticky-cell props that draw both. `data-table.tsx`
 * composes them; nothing here knows the rest of the table.
 */
import { Text } from '@mantine/core'
import type {
  Cell,
  Column,
  ColumnDef,
  Row,
  RowData,
  Table as TanstackTable,
} from '@tanstack/react-table'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { HIT_COARSE } from '../common/hit-floor'
import { useMeasuredWidths } from '../common/use-measured-widths'
import { alpha, VX } from '../tokens'
import { CellContent } from './cell-kinds'
import { EMPTY_FOLD_SET } from './data-table-state'
import classes from './data-table.module.css'
import type { BasaltTableFeatures } from './table-features'

/** The column id TanStack will resolve internally for this raw def — explicit `id`, else the
 * accessor key string. */
export function columnDefId<T extends RowData>(
  column: ColumnDef<BasaltTableFeatures, T, unknown>,
): string | undefined {
  if (column.id !== undefined) return column.id
  return 'accessorKey' in column && typeof column.accessorKey === 'string'
    ? column.accessorKey
    : undefined
}

/**
 * Fold order for `meta.priority` — the FIRST id in the returned list folds first. Effective
 * priority is `meta.priority ?? declaredIndex`, so with no `meta.priority` set anywhere it is just
 * the column's position: the LAST declared column folds first, the zero-config default a bare
 * `<BasaltDataTable data columns />` needs. An explicit priority folds a HIGHER number before a
 * lower one; a tie folds in reverse declared order. A column with no resolvable id (an
 * `accessorFn` with no explicit `id`) is never a fold candidate — nothing downstream could
 * reliably re-identify it once hidden.
 */
export function foldOrder<T extends RowData>(
  columns: readonly ColumnDef<BasaltTableFeatures, T, unknown>[],
): string[] {
  return columns
    .map((column, index) => ({
      id: columnDefId(column),
      priority: column.meta?.priority ?? index,
      index,
    }))
    .filter((candidate): candidate is { id: string; priority: number; index: number } =>
      Boolean(candidate.id),
    )
    .toSorted((a, b) => b.priority - a.priority || b.index - a.index)
    .map((candidate) => candidate.id)
}

/** Marks a rendered data column header for `useColumnFold`'s width measurement — never read past
 * that hook, so it carries no styling and needs no CSS-module counterpart. */
export const FOLD_ID_ATTR = 'data-basalt-fold-id'
/** The same mark on the columns that are never folded but still take room — the checkbox and the
 * row-actions column — so their widths join the plan's overhead. */
export const FIXED_ID_ATTR = 'data-basalt-fixed-id'

/**
 * How many data columns the fold always leaves visible: the identifier plus its most important
 * value (SPEC § 6.6). A one-column table keeps its one.
 */
const FOLD_FLOOR = 2

const EMPTY_WIDTHS: ReadonlyMap<string, number> = new Map()

/** The auto-pinned identifier column's width floor, px, when its `columnDef.minSize` is unset. */
export const PIN_MIN_WIDTH = 120

/** The half pixel per measured width plus the room's own rounding — see {@link planColumnFold}. */
function roundingSlack(measured: number, fixedCount: number): number {
  return (measured + fixedCount + 1) / 2
}

/**
 * Pure decision: fold columns off the FRONT of `order` (already fold-first sorted) until the
 * still-unfolded ones — plus `overhead` (the columns excluded from candidacy altogether — pinned,
 * `enableHiding: false`, the checkbox and actions columns — which occupy room but can never fold)
 * and the disclosure toggle's own width, once anything is folded — fit `room`, or only
 * {@link FOLD_FLOOR} data columns remain (`fixedCount` of them are the excluded data columns).
 * A candidate with no measured width yet (never rendered) is skipped rather than folded blind,
 * since folding it would remove the one place its width could ever be read from.
 *
 * Every width is a rounded integer (`offsetWidth`, `clientWidth`), and a table that fills its
 * wrapper stretches its columns to sum to `room` exactly — so the rounded sum lands up to half a
 * pixel per column over it, and a table that fits folded a column on hydration (a server-painted
 * table whose cells then moved). The fit check forgives that rounding and nothing more: half a
 * pixel for each measured width (the foldable columns, `fixedCount` and `extraCount` — the
 * excluded data columns and the checkbox / actions ones `overhead` sums), plus half a pixel for
 * `room`'s own rounding (the `+ 1` in the slack).
 */
export function planColumnFold(input: {
  room: number
  toggleWidth: number
  overhead: number
  /** How many excluded DATA columns `overhead` sums: they count toward the floor and the slack. */
  fixedCount?: number
  /** How many non-data columns (checkbox, actions) `overhead` sums: the slack only. */
  extraCount?: number
  order: readonly string[]
  widths: ReadonlyMap<string, number>
}): ReadonlySet<string> {
  const { room, toggleWidth, overhead, fixedCount = 0, extraCount = 0, order, widths } = input
  const known = order.filter((id) => widths.has(id))
  const slack = roundingSlack(known.length, fixedCount + extraCount)
  let unfolded = overhead + known.reduce((sum, id) => sum + (widths.get(id) ?? 0), 0)
  const folded = new Set<string>()
  for (const id of known) {
    // Never fold below the floor — a table with every column folded has no row identifier left to
    // read at all, which is worse than the horizontal scroll this exists to avoid; one with only
    // the identifier left hides every value. With no explicit `meta.priority` the survivors are
    // `order`'s LAST ids, which `foldOrder`'s own doc pins as the FIRST declared columns (the
    // last-declared one folds first).
    if (known.length - folded.size + fixedCount <= FOLD_FLOOR) break
    const withToggle = unfolded + (folded.size > 0 ? toggleWidth : 0)
    if (withToggle <= room + slack) break
    folded.add(id)
    unfolded -= widths.get(id) ?? 0
  }
  return folded
}

/**
 * Whether what `planColumnFold` left still overflows `room` — the signal to pin the first column
 * and scroll the rest. Computed from the cached NATURAL widths, never the painted ones: pinning
 * caps the identifier's width, and reading that back would unpin the table the moment the cap made
 * it fit, then pin it again at the next measure.
 */
function foldOverflows(input: {
  room: number
  toggleWidth: number
  overhead: number
  fixedCount: number
  extraCount: number
  order: readonly string[]
  widths: ReadonlyMap<string, number>
  folded: ReadonlySet<string>
}): boolean {
  const { room, toggleWidth, overhead, fixedCount, extraCount, order, widths, folded } = input
  const known = order.filter((id) => widths.has(id))
  const kept = known.filter((id) => !folded.has(id))
  const total =
    overhead +
    kept.reduce((sum, id) => sum + (widths.get(id) ?? 0), 0) +
    (folded.size > 0 ? toggleWidth : 0)
  return total > room + roundingSlack(known.length, fixedCount + extraCount)
}

/** The first opaque background up the tree — what a pinned cell must paint to be indistinguishable
 * from the cells it covers, whatever surface the table sits on (a card, the page). */
function surfaceBehind(el: Element): string {
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor
    // theme-allow raw-color-fn — compares a computed value to the browser's own "transparent"
    if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
  }
  return ''
}

/**
 * The general-case measured fold. Reacting to `useMeasuredContainment`'s boolean fit directly
 * (fold one, remeasure, maybe unfold) would oscillate, because folding changes the very box being
 * measured. Instead this reads each candidate `<th data-basalt-fold-id>`'s width once, while it is
 * visible, caches it, and decides analytically (`planColumnFold`). `useMeasuredWidths` owns the
 * cache and the wrapper-vs-table observer that `controls/actions.tsx`'s fold shares.
 */
export function useColumnFold(input: {
  active: boolean
  order: readonly string[]
  /**
   * Columns excluded from fold candidacy altogether (pinned, or `enableHiding: false`) — they are
   * never in `order`, but they still occupy room, and their measured widths (carried in the same
   * sweep as every eligible column's) become fixed overhead against the fold baseline.
   */
  fixedIds: readonly string[]
  /** The checkbox / actions columns: never folded, never data, but they take room all the same. */
  extraIds: readonly string[]
  /** Every pin CANDIDATE in declared order: the caller's columns minus any it pinned itself. */
  pinCandidates: readonly string[]
  /** False when the caller pinned a start column itself: an explicit pin wins, nothing auto-pins. */
  allowPin: boolean
  /**
   * The body holds no rows (loading, empty, error): its widths are header-only and narrower than
   * the loaded table's, so they never overwrite what a loaded table already measured — the states
   * keep the loaded fold instead of unfolding a column the rows would fold again.
   */
  headerOnly: boolean
  /** The rows the body renders right now: a filter that matches nothing leaves a header-only body too. */
  renderedRows: RefObject<number>
}): {
  wrapperRef: RefObject<HTMLDivElement | null>
  folded: ReadonlySet<string>
  /** The column pinned to the start edge because the floor-folded table still overflows. */
  pinId: string | undefined
  /** Whether the table is wider than its container right now — i.e. whether the scroller scrolls. */
  overflowing: boolean
  /** The last natural width of every column the sweep has seen, read by the loading skeleton's grid. */
  widths: ReadonlyMap<string, number>
} {
  const { active, order, fixedIds, extraIds, pinCandidates, allowPin, headerOnly, renderedRows } =
    input
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [folded, setFolded] = useState<ReadonlySet<string>>(EMPTY_FOLD_SET)
  const [pinId, setPinId] = useState<string | undefined>(undefined)
  const [overflowing, setOverflowing] = useState(false)
  const [measuredWidths, setMeasuredWidths] = useState<ReadonlyMap<string, number>>(EMPTY_WIDTHS)
  const latest = useRef({ order, fixedIds, extraIds, pinCandidates, allowPin, headerOnly })
  // The pin the LAST measure decided, written inside `onMeasure` itself: a measure that runs again
  // before React commits the state must still see which column the previous one pinned.
  const decidedPin = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    latest.current = { order, fixedIds, extraIds, pinCandidates, allowPin, headerOnly }
    // A deactivated hook decided nothing: the next activation starts from no pin.
    if (!active || order.length === 0) decidedPin.current = undefined
  })
  if ((!active || order.length === 0) && (folded.size > 0 || pinId !== undefined)) {
    setFolded(EMPTY_FOLD_SET)
    setPinId(undefined)
    setOverflowing(false)
  }

  const { remeasure } = useMeasuredWidths({
    resolveRoot: () => wrapperRef.current,
    signature: `${order.join('|')}::${fixedIds.join('|')}::${extraIds.join('|')}`,
    enabled: active && order.length > 0,
    // The table too, not only the wrapper: a re-measured column set moves its min-content width
    // while the wrapper's own box never changes.
    extra: (root) => [root.querySelector('table')],
    onMeasure: (root, boxes) => {
      const current = latest.current
      for (const cell of root.querySelectorAll<HTMLElement>(
        `[${FOLD_ID_ATTR}], [${FIXED_ID_ATTR}]`,
      )) {
        const id = cell.getAttribute(FOLD_ID_ATTR) ?? cell.getAttribute(FIXED_ID_ATTR)
        if (id === null || cell.offsetWidth === 0) continue
        // The pinned column's painted width is the capped one, and a header-only body's is the
        // narrow one: either way the natural width already cached stays.
        const keepCached =
          (id === decidedPin.current || current.headerOnly || renderedRows.current === 0) &&
          boxes.current.has(id)
        if (!keepCached)
          boxes.current.set(id, { width: cell.offsetWidth, height: cell.offsetHeight })
      }
      const room = root.clientWidth
      // A zero reading is an un-laid-out ancestor, not a table with no room — the same guard
      // `useMeasuredContainment` runs against the aside animating in from 0.
      if (room === 0) return
      // The pinned identifier's cap and the disclosure row's sticky width both read the room, and
      // a pinned cell paints the surface the table sits on.
      root.style.setProperty('--basalt-table-room', `${room}px`)
      const surface = surfaceBehind(root)
      if (surface !== '') root.style.setProperty('--basalt-table-surface', surface)
      const widths = new Map([...boxes.current].map(([id, box]) => [id, box.width]))
      setMeasuredWidths((prev) =>
        prev.size === widths.size && [...widths].every(([id, width]) => prev.get(id) === width)
          ? prev
          : widths,
      )
      const overhead = [...current.fixedIds, ...current.extraIds].reduce(
        (sum, id) => sum + (widths.get(id) ?? 0),
        0,
      )
      const plan = {
        room,
        // The disclosure toggle is a fixed icon-button cell matched to the coarse hit floor, so it
        // reads as one more `--vx-hit` control rather than a narrower afterthought.
        toggleWidth: HIT_COARSE,
        overhead,
        fixedCount: current.fixedIds.length,
        extraCount: current.extraIds.length,
        order: current.order,
        widths,
      }
      const next = planColumnFold(plan)
      setFolded((prev) =>
        prev.size === next.size && [...prev].every((id) => next.has(id)) ? prev : next,
      )
      const nextPin =
        current.allowPin && foldOverflows({ ...plan, folded: next })
          ? current.pinCandidates.find((id) => !next.has(id))
          : undefined
      decidedPin.current = nextPin
      setPinId(nextPin)
      const table = root.querySelector('table')
      setOverflowing(table !== null && table.offsetWidth > room)
    },
  })

  // The surface a pinned cell paints is read from the page, so a scheme flip must re-read it.
  const remeasureRef = useRef(remeasure)
  useLayoutEffect(() => {
    remeasureRef.current = remeasure
  })
  useLayoutEffect(() => {
    if (!active || typeof MutationObserver === 'undefined') return
    const root = document.documentElement
    let scheme = root.getAttribute('data-mantine-color-scheme')
    let frame = 0
    const observer = new MutationObserver(() => {
      const next = root.getAttribute('data-mantine-color-scheme')
      if (next === scheme) return
      scheme = next
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => remeasureRef.current())
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-mantine-color-scheme'] })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [active])

  return {
    wrapperRef,
    folded: active ? folded : EMPTY_FOLD_SET,
    pinId: active ? pinId : undefined,
    overflowing: active && overflowing,
    widths: measuredWidths,
  }
}

// ── Sticky cells ──────────────────────────────────────────────────────────────

/** What every sticky cell of a render shares — built once, read by each header, skeleton and body
 * site through {@link pinnedCellProps} so none of them can drift. */
export type PinContext<T extends RowData> = {
  table: TanstackTable<BasaltTableFeatures, T>
  /** The room the fold toggle column takes ahead of the first start-pinned cell; 0 without one. */
  startOffset: number
  /** The auto-pinned identifier: content width bounded by `autoPinMinWidth` and the `.pinnedFluid` cap. */
  autoPinId: string | undefined
  autoPinMinWidth: number | undefined
}

/** `getStart` / `getAfter` sum `getSize()`, so a sticky cell states its width in px and the offsets
 * stay true. The panel is only the fallback: the surface behind the table is measured, unless a sticky
 * header paints its own fill, which `--basalt-pin-fill` hands the header's pinned cells. */
const STICKY_BASE: CSSProperties = {
  position: 'sticky',
  zIndex: 1,
  backgroundColor: `var(--basalt-pin-fill, var(--basalt-table-surface, ${VX.surface.panel}))`,
}

/**
 * The class and inline style of one column's cell when it pins (`{}` when it does not): the opaque
 * sticky base with the row's own tint layered over it (`.pinnedLayer`), the logical inset of its
 * start/end offset (`dir=rtl` mirrors it) and, on the edge cell touching the scrolling center, the
 * hairline shadow (a physical offset, which does not mirror). The auto-pinned column takes its
 * content width, not the fixed `getSize()` — a 150px default would waste a 360px table's room on a
 * short date.
 */
export function pinnedCellProps<T extends RowData>(
  ctx: PinContext<T>,
  column: Column<BasaltTableFeatures, T, unknown>,
): { className?: string; style?: CSSProperties } {
  const pinned = column.getIsPinned()
  if (!pinned) return {}
  const fluid = column.id === ctx.autoPinId && ctx.autoPinMinWidth !== undefined
  const size = column.getSize()
  const shared: CSSProperties = {
    ...STICKY_BASE,
    ...(fluid
      ? { minWidth: ctx.autoPinMinWidth }
      : { width: size, minWidth: size, maxWidth: size }),
  }
  const className = fluid ? `${classes.pinnedLayer} ${classes.pinnedFluid}` : classes.pinnedLayer
  if (pinned === 'start') {
    const isEdge = column.getPinnedIndex() === ctx.table.getStartLeafColumns().length - 1
    return {
      className,
      style: {
        ...shared,
        insetInlineStart: column.getStart('start') + ctx.startOffset,
        boxShadow: isEdge ? `4px 0 6px -4px ${alpha(VX.ink, 0.18)}` : undefined,
      },
    }
  }
  const isEdge = column.getPinnedIndex() === 0
  return {
    className,
    style: {
      ...shared,
      insetInlineEnd: column.getAfter('end'),
      boxShadow: isEdge ? `-4px 0 6px -4px ${alpha(VX.ink, 0.18)}` : undefined,
    },
  }
}

/** The fold toggle column's cell: one `HIT_COARSE` px wide, and sticky at the start edge — the same
 * base, unit and layer as a pinned column — whenever a start pin follows it. */
export function foldToggleCellProps<T extends RowData>(
  ctx: PinContext<T>,
): { className: string; style: CSSProperties } {
  const sticky = ctx.startOffset > 0
  return {
    className: sticky ? `${classes.foldToggleCell} ${classes.pinnedLayer}` : classes.foldToggleCell,
    style: {
      width: HIT_COARSE,
      minWidth: HIT_COARSE,
      maxWidth: HIT_COARSE,
      ...(sticky && { ...STICKY_BASE, insetInlineStart: 0 }),
    },
  }
}

// ── Disclosure ────────────────────────────────────────────────────────────────

/** A folded column's name for the toggle, the header count and the disclosure row: its own header
 * when that is a non-empty string, else the column id — a function/`ReactNode` header has no header
 * CONTEXT to render with here (this is a body row, not the `<thead>`). */
export function columnLabel<T extends RowData>(
  column: Column<BasaltTableFeatures, T, unknown>,
): string {
  const header = column.columnDef.header
  return typeof header === 'string' && header.trim() !== '' ? header : column.id
}

/** One row's folded columns as label/value pairs, directly under it. `row.getAllCells()` returns
 * every leaf cell regardless of visibility (unlike `getVisibleCells()`), so a folded column's own
 * `cell` renderer still draws here exactly as it would in the `<td>` it no longer occupies. */
export function RowDisclosure<T extends RowData>({
  row,
  folded,
}: {
  row: Row<BasaltTableFeatures, T>
  folded: ReadonlySet<string>
}): ReactNode {
  const cells: Cell<BasaltTableFeatures, T, unknown>[] = row
    .getAllCells()
    .filter((cell) => folded.has(cell.column.id))
  return (
    <div className={classes.foldDisclosure}>
      {cells.map((cell) => (
        <div key={cell.id} className={classes.foldDisclosureRow}>
          <Text className={classes.foldDisclosureLabel}>{columnLabel(cell.column)}</Text>
          <div className={classes.foldDisclosureValue}>
            <CellContent cell={cell} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The count word of a fold label, singular for one: "column", or "col" for the tight visible header. */
function foldNoun(count: number, short: boolean): string {
  const noun = short ? 'col' : 'column'
  return count === 1 ? noun : `${noun}s`
}

/** "2 more columns: C, D" — the folded columns, counted and named. */
export function foldedSummary(count: number, label: string): string {
  return `${count} more ${foldNoun(count, false)}: ${label}`
}

/** The header cell above the toggles: a micro count of what folded. The screen-reader span is the one
 * accessible label (F102 — a hidden column must be announced, not merely reachable); the visible
 * `+N cols` is a hidden duplicate whose `title` is the sighted hover hint. A bare `+N` read as an
 * unexplained figure at 390, so the word rides with it — in the sans micro face, which keeps
 * "+4 cols" inside the 44px toggle cell (the mono face did not). */
export function FoldHeaderLabel({
  count,
  foldedLabel,
}: {
  count: number
  foldedLabel: string
}): ReactNode {
  const summary = foldedSummary(count, foldedLabel)
  return (
    <span className={classes.foldCount}>
      <span aria-hidden title={summary}>
        +{count} {foldNoun(count, true)}
      </span>
      <span className={classes.srOnly}>{summary}</span>
    </span>
  )
}

/** The per-row expand/collapse control the fold column renders — a ghost chevron whose accessible
 * name says WHAT folded ("Show Volume, Duration"), its 44px hit area carried by the hit overlay
 * (`docs/CONTROLS-SPEC.md` §2; basalt ships no icon set, so the chevron is inline). */
export function FoldToggle({
  expanded,
  controlsId,
  foldedLabel,
  onToggle,
}: {
  expanded: boolean
  controlsId: string
  foldedLabel: string
  onToggle: () => void
}): ReactNode {
  return (
    <button
      type="button"
      className={classes.foldToggle}
      data-basalt-hit
      aria-expanded={expanded}
      aria-controls={controlsId}
      aria-label={`${expanded ? 'Hide' : 'Show'} ${foldedLabel}`}
      // A row carrying `onRowActivate` reads a bubbled click as "activate the row" — the toggle
      // would open/close its disclosure AND fire the row's own action underneath it.
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      <svg
        className={classes.foldChevron}
        data-expanded={expanded ? 'true' : 'false'}
        viewBox="0 0 16 16"
        aria-hidden
        focusable="false"
      >
        <path d="M5.5 3.5 10.5 8l-5 4.5" />
      </svg>
    </button>
  )
}
