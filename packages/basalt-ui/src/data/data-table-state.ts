/**
 * `BasaltDataTable`'s state hooks — the table's own interactive state, the fold row disclosure, the
 * card projection and the row/card activation props. Internal to `./data/table`; nothing here is on a
 * published subpath.
 */
import type {
  ColumnFiltersState,
  ColumnPinningState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import { functionalUpdate } from '@tanstack/react-table'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMeasuredWidths } from '../common/use-measured-widths'
import { CONTAINER_CLASSES } from '../tokens/size-classes'
import classes from './data-table.module.css'

export const EMPTY_FOLD_SET: ReadonlySet<string> = new Set()

/**
 * Which rows have their fold disclosure open. `row.id` defaults to the row's index in `data` (no
 * `getRowId`) — stable across a client-side sort/filter/pagination, which reorder or subset the SAME
 * core rows. PRUNED rather than cleared on every `data` change: a non-memoized `data` prop (an inline
 * `.map()`, an unstable query result) hands a brand-new array of the SAME rows on every parent
 * re-render, and clearing on that reference alone collapsed every open disclosure the instant
 * anything upstream re-rendered.
 *
 * Pruning by ID ALONE is only safe with `getRowId` — a caller-declared identity that genuinely
 * survives a page turn or a refetch, so an id no longer present (a manual-pagination page turn, a
 * delete) still has to go, or a differently-shaped record seated at a reused id would silently read
 * as pre-expanded. Without `getRowId` the id IS the array index, and an index survives a refetch
 * trivially — it is still "0", "1", … even when every object behind it is a different record.
 * Keeping an expanded index across THAT would silently attach the old disclosure to a stranger's
 * row. So the index-id lane keeps a `prevData` snapshot and asks the narrower, correct question: is
 * the object AT this index still the same reference as last time? A non-memoized array of the SAME
 * rows answers yes at every index (the case above); a page turn or a refetch answers no.
 */
export function useRowDisclosure<T>({
  data,
  getRowId,
}: {
  data: readonly T[]
  getRowId: ((row: T, index: number) => string) | undefined
}): { expanded: ReadonlySet<string>; toggle: (rowId: string) => void } {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY_FOLD_SET)
  const toggle = useCallback((rowId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])
  const prevDataRef = useRef(data)
  useEffect(() => {
    const prevData = prevDataRef.current
    prevDataRef.current = data
    setExpanded((current) => {
      if (current.size === 0) return current
      const liveIds = getRowId && new Set(data.map((row, index) => getRowId(row, index)))
      const isLive = (id: string) => {
        if (liveIds) return liveIds.has(id)
        const index = Number(id)
        return data[index] !== undefined && data[index] === prevData[index]
      }
      const next = new Set([...current].filter(isLive))
      return next.size === current.size ? current : next
    })
  }, [data, getRowId])
  return { expanded, toggle }
}

/** `useState` whose every write also reports the settled value — the one shape sorting, the global
 * filter, the column filters and pagination all share. The callback runs inside the updater, so it
 * sees exactly the value TanStack applied. */
function useReportedState<S>(
  initial: S,
  onChange: ((next: S) => void) | undefined,
): [S, (updater: Updater<S>) => void] {
  const [value, setValue] = useState(initial)
  const update = useCallback(
    (updater: Updater<S>) => {
      setValue((prev) => {
        const next = functionalUpdate(updater, prev)
        onChange?.(next)
        return next
      })
    },
    [onChange],
  )
  return [value, update]
}

/** The `BasaltDataTableProps` fields `useDataTableState` reads — declared here rather than picked
 * off the props type, so the hook owns its contract and this module never imports the component. */
export type DataTableStateProps = {
  initialSorting?: SortingState | undefined
  onSortingChange?: ((sorting: SortingState) => void) | undefined
  initialGlobalFilter?: string | undefined
  onGlobalFilterChange?: ((value: string) => void) | undefined
  onColumnFiltersChange?: ((filters: ColumnFiltersState) => void) | undefined
  initialPagination?: PaginationState | undefined
  onPaginationChange?: ((pagination: PaginationState) => void) | undefined
  initialColumnPinning?: ColumnPinningState | undefined
  rowSelection?: RowSelectionState | undefined
  onRowSelectionChange?: ((selection: RowSelectionState) => void) | undefined
}

/** The table's own interactive state and the TanStack `on*Change` handlers that write it — every
 * piece uncontrolled with an optional change callback, except row selection, which is controlled
 * whenever `rowSelection` is passed. */
export function useDataTableState(props: DataTableStateProps, defaultPageSize: number) {
  const { rowSelection, onRowSelectionChange } = props
  const [sorting, onSortingChange] = useReportedState(
    props.initialSorting ?? [],
    props.onSortingChange,
  )
  const [globalFilter, onGlobalFilterChange] = useReportedState(
    props.initialGlobalFilter ?? '',
    props.onGlobalFilterChange,
  )
  const [columnFilters, onColumnFiltersChange] = useReportedState<ColumnFiltersState>(
    [],
    props.onColumnFiltersChange,
  )
  const [pagination, onPaginationChange] = useReportedState(
    props.initialPagination ?? { pageIndex: 0, pageSize: defaultPageSize },
    props.onPaginationChange,
  )
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    props.initialColumnPinning ?? {},
  )
  // Uncontrolled by default; `rowSelection`, when passed, is the truth and this only mirrors it so
  // the updater below has a base to apply against.
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      // CONTROLLED: the caller's map is the base AND the only writer. Mirroring it into state too
      // would leave a copy that the caller never moves, and that stale copy becomes the selection
      // the moment `rowSelection` goes back to `undefined` — plus every tick would render twice for
      // one change. Report the next map and let the caller own it.
      if (rowSelection !== undefined) {
        onRowSelectionChange?.(functionalUpdate(updater, rowSelection))
        return
      }
      setInternalRowSelection((prev) => {
        const next = functionalUpdate(updater, prev)
        onRowSelectionChange?.(next)
        return next
      })
    },
    [rowSelection, onRowSelectionChange],
  )

  return {
    sorting,
    onSortingChange,
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    columnPinning,
    onColumnPinningChange: setColumnPinning,
    rowSelection: rowSelection ?? internalRowSelection,
    onRowSelectionChange: handleRowSelectionChange,
  }
}

/** Whether the table renders as `renderCard` projections: its own root measured below the `regular`
 * container class. A zero width is an un-laid-out ancestor, not a narrow table, so it moves nothing
 * — the default (and the SSR answer) is the table. The root's width never depends on which body it
 * holds, so the swap cannot oscillate. */
export function useCardProjection(enabled: boolean): {
  rootRef: RefObject<HTMLDivElement | null>
  cards: boolean
} {
  const rootRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useMeasuredWidths({
    resolveRoot: () => rootRef.current,
    signature: '',
    enabled,
    onMeasure: (root) => {
      if (root.clientWidth === 0) return
      const next = root.clientWidth < CONTAINER_CLASSES.regular
      setNarrow((current) => (current === next ? current : next))
    },
  })
  return { rootRef, cards: enabled && narrow }
}

/** Click + Enter activation, shared by a row and its card. Enter only: Space is the browser's own
 * page-scroll on a focused non-button, and stealing it from a keyboard reader moving down a long
 * table costs more than the second activation key buys. */
export function activationProps<T>(onRowActivate: ((row: T) => void) | undefined, row: T) {
  if (onRowActivate === undefined) return undefined
  return {
    className: classes.activatable,
    'data-activatable': true,
    tabIndex: 0,
    onClick: () => onRowActivate(row),
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Enter') return
      // Only the element's own Enter. A cell or card may hold a button, a link or the selection
      // checkbox, and keydown bubbles — so without this an Enter on a nested control fired that
      // control AND opened the row's detail behind it.
      if (event.target !== event.currentTarget) return
      event.preventDefault()
      onRowActivate(row)
    },
  }
}
