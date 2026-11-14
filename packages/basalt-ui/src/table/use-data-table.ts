/**
 * `useDataTable`: the one hook that turns a column list, rows and a mode into the instance the
 * parts render (docs/v3/concepts/data-table.md sections 1 and 4). It owns the engine, the state
 * handle, the selection, the plan, the resolved phase and the row keyboard; the parts only draw.
 *
 * The instance is opaque to callers (`DataTableInstance`); the parts read the model behind it with
 * `modelOf`. Columns are plain per-render values: nothing here depends on their identity.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFormat } from '../core/format'
import type { Format } from '../core/format'
import { useMessages } from '../core/messages/use-messages'
import { table } from '../core/messages/table'
import { resolvePhase } from '../core/phase'
import type { Empty, ResolvedPhase } from '../core/phase'
import type { Box, DetailHost } from '../core/ports'
import type { BulkAction, DataTableInstance, KindColumn, Totals, UseDataTable } from './contract'
import { bodyItems, toggled } from './parts/group-row-model'
import type { BodyItem } from './parts/group-row-model'
import { tableEngine } from './core/features'
import { constructFilterFn, toColumnFilters } from './core/filters'
import { useRowKeyboard } from './core/keyboard'
import type { RowKeyboard } from './core/keyboard'
import { engineColumn } from './core/kinds-engine'
import { specOf } from './core/kinds-spec'
import type { KindSpec } from './core/kinds-spec'
import { planTable } from './core/plan'
import type { TablePlan } from './core/plan'
import { useSelection } from './core/selection'
import type { SelectionApi } from './core/selection'
import { countOf, useTableState } from './core/state'
import type { TableStateApi } from './core/state'

const MODEL: unique symbol = Symbol.for('basalt-ui.table.model')

const NO_ROWS: readonly never[] = []

/** A page row: the id a tick follows and the value the kinds draw. */
export type ModelRow<T> = { id: string; original: T }

export type Activation<T> =
  | { kind: 'none' }
  | { kind: 'row'; run: (row: T) => void }
  | { kind: 'detail'; render: (row: T, box: Box) => ReactNode }

export type SortDirection = 'asc' | 'desc' | 'none'

/** Everything the parts read of a table; built by `useDataTable`, never by a caller. */
export type TableModel<T> = {
  id: string
  label: string
  specs: readonly KindSpec<T>[]
  plan: TablePlan
  rows: readonly ModelRow<T>[]
  /** What the body draws in order: the rows, or group rows with the rows of open groups. */
  items: readonly BodyItem<T>[]
  /** The declared grouping (client mode only); `summary` is the group row's box slot. */
  group: { spec: KindSpec<T>; summary?: (rows: readonly T[], box: Box) => ReactNode } | undefined
  toggleGroup(value: string): void
  server: boolean
  /** Client: every row matching the request (all pages), what the footer reduces. */
  matched: readonly T[]
  /** Server: the footer values the server computed for this request. */
  totals: Totals | undefined
  phase: ResolvedPhase
  /** Skeleton rows of a loading table: the rows it last showed, else the default of `phases.tsx`. */
  skeletonRows: number | undefined
  /** Rows matching the request, `undefined` while unknown. */
  count: number | undefined
  pager: 'pages' | 'more' | 'none'
  /** What a narrow table becomes (default `cards`) and the width it does so below. */
  phone: 'cards' | 'scroll'
  cardsBelow: 'regular' | 'wide' | 'always'
  /** Present on a cursor table: the pager's `Load more` reads it. */
  cursor: { hasNext: boolean; fetchNext(): void } | undefined
  state: TableStateApi
  selection: SelectionApi<T> | undefined
  /** The bulk bar's inputs: the declared actions, the all-matching opt-in and the loaded rows. */
  bulk: { actions: readonly BulkAction<T>[]; selectAll: boolean; data: readonly T[] } | undefined
  activation: Activation<T>
  keyboard: RowKeyboard
  /** The parts hand the detail host here; an activation shows into the latest one. */
  setHost(host: DetailHost | undefined): void
  format: Format
  /** One clock value per render so server and client agree on a relative time. */
  now: number
  sortOf(id: string): SortDirection
  toggleSort(id: string): void
}

type Built<T> = DataTableInstance<T> & { readonly [MODEL]: TableModel<T> }

/** Reads the model behind an instance; an object not made by `useDataTable` throws. */
export function modelOf<T>(instance: DataTableInstance<T>): TableModel<T> {
  const model = (instance as Partial<Built<T>>)[MODEL]
  if (model === undefined) {
    throw new Error('basalt-ui/table: `table` was not made by useDataTable()')
  }
  return model
}

const MINUTE = 60_000

function filterFnOf(spec: KindSpec<never>) {
  return spec.filter === null
    ? {}
    : { filterFn: constructFilterFn(spec.filter === 'anyOf' ? 'anyOf' : 'contains') }
}

/**
 * The table's state, engine, selection and phase in one call. Hand the result to `DataTable` or
 * to the parts.
 *
 * @useWhen a page shows rows with sort, filter, paging or selection as a v3 table
 * @neverWhen the rows are static with no behaviour (use `ui/table`)
 *
 * @example
 * const c = col<Order>()
 * const t = useDataTable({
 *   id: 'orders',
 *   label: 'Orders',
 *   columns: [c.entity('customer'), c.money('total', { currency: 'EUR' })],
 *   data: query.data,
 *   phase: query,
 *   getRowId: (o) => o.id,
 *   mode: { kind: 'client' },
 * })
 */
export function useDataTable<T>(options: UseDataTable<T>): DataTableInstance<T> {
  const { mode, getRowId, columns } = options
  const t = useMessages(table)
  const format = useFormat()
  const server = mode.kind === 'server'
  const pager = options.pager ?? (!server ? 'none' : 'cursor' in mode ? 'more' : 'pages')
  const paged = pager !== 'none' && !(server && 'cursor' in mode)

  const [now] = useState(() => Math.floor(Date.now() / MINUTE) * MINUTE)
  const specs = columns.map((column: KindColumn<T>) => specOf(column))
  const known = new Set(specs.map((spec) => spec.id))

  const clearRef = useRef<() => void>(() => undefined)
  const [clientCount, setClientCount] = useState<number | undefined>(undefined)
  const state = useTableState({
    id: options.id,
    handle: options.state,
    count: server ? countOf(mode) : clientCount,
    paged,
    resetOn: options.resetOn,
    onReset: () => clearRef.current(),
  })
  const { request, display } = state

  const selection = useSelection<T>({ getRowId, request })
  useEffect(() => {
    clearRef.current = selection.clear
  })

  const visibilityKey = JSON.stringify(display.visibility)
  const shapeKey = specs
    .map(
      (s) =>
        `${s.id}:${s.kind}:${s.priority}:${JSON.stringify(s.width)}:${s.pin}:${s.card.join('/')}`,
    )
    .join('|')
  const plan = usePlan(columns, shapeKey + visibilityKey, display.visibility)

  const data = (options.data ?? NO_ROWS) as T[]
  const engine = tableEngine.useAppTable({
    columns: specs.map((spec) => ({
      ...engineColumn(spec as KindSpec<unknown>),
      ...filterFnOf(spec as KindSpec<never>),
    })) as never,
    data,
    getRowId,
    state: {
      sorting: request.sort,
      columnFilters: toColumnFilters(request.filters, known),
      globalFilter: request.q,
      pagination: { pageIndex: Math.max(0, request.page - 1), pageSize: request.pageSize },
    },
    manualSorting: server,
    manualFiltering: server,
    manualPagination: server || !paged,
    ...(server && 'rowCount' in mode && mode.rowCount !== undefined
      ? { rowCount: mode.rowCount }
      : {}),
  } as never)

  const rows: ModelRow<T>[] = engine
    .getRowModel()
    .rows.map((row: { id: string; original: unknown }) => ({
      id: row.id,
      original: row.original as T,
    }))
  const matched: readonly T[] = server
    ? rows.map((row) => row.original)
    : (engine.getPrePaginatedRowModel() as { rows: { original: unknown }[] }).rows.map(
        (row) => row.original as T,
      )
  const matching = server ? undefined : matched.length
  if (!server && matching !== clientCount) setClientCount(matching)

  const [lastRows, setLastRows] = useState<number | undefined>(undefined)
  if (options.data !== undefined && rows.length > 0 && rows.length !== lastRows) {
    setLastRows(rows.length)
  }

  const group = groupOf(options.group, specs, server)
  const items = bodyItems(rows, group?.spec, display.collapsed, matched)

  const filtering = request.q !== '' || request.filters.length > 0
  const settled = options.data !== undefined
  const empty: Empty | null =
    settled && rows.length === 0
      ? {
          cause: filtering ? t('table.noMatches') : t('table.empty'),
          ...(filtering && {
            filtered: { reset: () => state.setRequest({ q: '', filters: [] }) },
          }),
        }
      : null
  const phase = resolvePhase({
    phase: options.phase ?? (settled ? undefined : 'loading'),
    empty,
  })

  const host = useRef<DetailHost | undefined>(undefined)
  const byId = new Map(rows.map((row) => [row.id, row.original] as const))
  const activation: Activation<T> =
    options.detail !== undefined
      ? { kind: 'detail', render: options.detail }
      : options.onRowActivate !== undefined
        ? { kind: 'row', run: options.onRowActivate }
        : { kind: 'none' }

  const activate = (id: string): void => {
    const row = byId.get(id)
    if (row === undefined) return
    if (activation.kind === 'row') activation.run(row)
    else if (activation.kind === 'detail') {
      const { render } = activation
      host.current?.show({
        title: options.label,
        body: (box) => render(row, box),
      })
    }
  }
  const keyboard = useRowKeyboard({
    rowIds: items.flatMap((item) => (item.type === 'row' ? [item.row.id] : [])),
    onActivate: activation.kind === 'none' ? undefined : activate,
    onToggle: options.selection === undefined ? undefined : selection.toggle,
    onClear: options.selection === undefined ? undefined : selection.clear,
  })

  const model: TableModel<T> = {
    id: options.id,
    label: options.label,
    specs,
    plan,
    rows,
    items,
    group,
    toggleGroup(value) {
      state.setDisplay({ collapsed: toggled(display.collapsed, value) })
    },
    server,
    matched,
    totals: mode.kind === 'server' && 'totals' in mode ? mode.totals : undefined,
    phase,
    skeletonRows: lastRows,
    count: server ? countOf(mode) : matching,
    pager,
    phone: options.phone ?? 'cards',
    cardsBelow: options.cardsBelow ?? 'regular',
    cursor: server && 'cursor' in mode ? mode.cursor : undefined,
    state,
    selection: options.selection === undefined ? undefined : selection,
    bulk:
      options.selection === undefined
        ? undefined
        : {
            actions: options.selection.bulk,
            selectAll: options.selection.selectAll === true,
            data,
          },
    activation,
    keyboard,
    setHost(next) {
      host.current = next
    },
    format,
    now,
    sortOf(id) {
      const entry = request.sort.find((s) => s.id === id)
      return entry === undefined ? 'none' : entry.desc ? 'desc' : 'asc'
    },
    toggleSort(id) {
      const current = request.sort.find((s) => s.id === id)
      state.setRequest({
        sort:
          current === undefined ? [{ id, desc: false }] : current.desc ? [] : [{ id, desc: true }],
      })
    },
  }
  return { __brand: 'DataTableInstance', [MODEL]: model } as Built<T>
}

/**
 * The declared grouping resolved against the columns. A server table never groups (the type
 * already refuses it; grouping needs every row); an unknown column throws naming it.
 */
function groupOf<T>(
  group: UseDataTable<T>['group'],
  specs: readonly KindSpec<T>[],
  server: boolean,
): TableModel<T>['group'] {
  if (group === undefined || server) return undefined
  const spec = specs.find((s) => s.id === group.by)
  if (spec === undefined) {
    throw new Error(
      `basalt-ui/table: group.by "${group.by}" is not a column; use one of ${specs.map((s) => s.id).join(', ')}`,
    )
  }
  return { spec, ...(group.summary !== undefined && { summary: group.summary }) }
}

/** The plan, recomputed only when a column's shape or the visibility changes (one dev warning each). */
function usePlan<T>(
  columns: readonly KindColumn<T>[],
  key: string,
  visibility: Record<string, boolean>,
): TablePlan {
  // oxlint-disable-next-line react/exhaustive-deps -- `key` IS the shape of `columns` and `visibility`
  return useMemo(() => planTable(columns, { visibility }), [key])
}
