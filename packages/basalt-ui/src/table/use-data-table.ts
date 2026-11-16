/**
 * `useDataTable`: the one hook that turns a column list, rows and a mode into the instance the
 * parts render (docs/v3/concepts/data-table.md sections 1 and 4). It owns the engine, the state
 * handle, the selection, the plan, the resolved phase and the row keyboard; the parts only draw.
 *
 * The instance is opaque to callers (`DataTableInstance`); the parts read the model behind it with
 * `modelOf`. Columns are plain per-render values: nothing here depends on their identity.
 */
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFormat } from '../core/format'
import type { Format } from '../core/format'
import { useMessages } from '../core/messages/use-messages'
import { table } from '../core/messages/table'
import { resolvePhase } from '../core/phase'
import type { Empty, ResolvedPhase } from '../core/phase'
import type { Box, DetailHost } from '../core/ports'
import type {
  BulkAction,
  DataTableInstance,
  KindColumn,
  TableEscape,
  Totals,
  UseDataTable,
  ViewStore,
} from './contract'
import { AutoDetail, detailTitle } from './parts/auto-detail'
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
  | { kind: 'row'; run: (row: T) => void }
  | { kind: 'detail'; render: (row: T, box: Box) => ReactNode }
  /** Neither `detail` nor `onRowActivate`: the row opens the sheet derived from its columns. */
  | { kind: 'auto' }

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
  /** Identity of a row, for the link to a chart's focus items. */
  getRowId: (row: T) => string
  /** A `ViewStore` the caller supplied; absent, the Views panel keeps the views on the device. */
  viewStore: ViewStore | undefined
  /**
   * The parts hand the detail host here; an activation shows into the latest one. `kind` names where
   * the host comes from (the caller's, the page's, the table's own sheet): a host of another kind
   * replaces the one the entry was shown in, so the entry is hidden there and shown again here.
   */
  setHost(host: DetailHost | undefined, kind: string): void
  /** Opens the sheet derived from the row's columns (the `table-expand` door). */
  openDetails(id: string): void
  /**
   * The own sheet closed: unsets the `detailState` field, when one is bound; a push field leaves the
   * close as its own history entry, so Back returns to the open record. `hostClosed` is a host that
   * closed on its own: it does the same once a row has shown in it.
   */
  closeDetail(hostClosed?: boolean): void
  /** The row whose detail is open (`detail`) or that the page named (`activeRowId`); the body marks it. */
  activeId: string | undefined
  /**
   * Whether each row carries the `table-expand` door: `onRowActivate` takes the tap, and a tier can
   * hide a column (priority 3, or a card `detail`), so the derived sheet needs its own way in.
   */
  expandable: boolean
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

/**
 * Stands in for an absent `detailState`, so `use()` is called on every render either way; the table
 * then remembers the row it opened in component state.
 */
const NO_DETAIL_STATE = {
  // oxlint-disable-next-line react/hook-use-state -- hands back the pair as the field handle's `use` does
  use: (): [string, (id: string) => void] => useState(''),
}

function filterFnOf(spec: KindSpec<never>) {
  return spec.filter === null
    ? {}
    : { filterFn: constructFilterFn(spec.filter === 'anyOf' ? 'anyOf' : 'contains') }
}

/**
 * The table's state, engine, selection and phase in one call. Hand the result to `DataTable` or
 * to the parts. A narrow table becomes cards: `phone` defaults to `'cards'` (`'scroll'` pins the
 * name and scrolls sideways) and `cardsBelow` to `'regular'` (480 px of the table's own width, 800 px
 * when its priority 1 and 2 columns need more; `'wide'` is always 800, `'always'` never shows a
 * table). The tiers live in `basalt-ui/table.css`, which `basalt()` imports for any module that imports
 * `basalt-ui/table`; an app without the plugin imports it beside `basalt-ui/table`.
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

  // A fixed clock wins; otherwise the minute, floored so server and client agree, ticking once a minute.
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / MINUTE))
  useEffect(() => {
    if (options.now !== undefined) return
    const id = setInterval(() => setMinute(Math.floor(Date.now() / MINUTE)), MINUTE)
    return () => clearInterval(id)
  }, [options.now])
  const now = options.now ?? minute * MINUTE
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
  const contentCh = contentWidths(specs, options.data)
  const plan = usePlan(
    columns,
    shapeKey + visibilityKey + JSON.stringify(contentCh),
    display.visibility,
    contentCh,
  )

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
  const pageFiltered = options.empty?.filtered
  const empty: Empty | null =
    settled && rows.length === 0
      ? filtering
        ? {
            cause: pageFiltered
              ? (options.empty?.cause ?? t('table.noMatches'))
              : t('table.noMatches'),
            filtered: {
              reset: () => {
                state.setRequest({ q: '', filters: [] })
                pageFiltered?.reset()
              },
            },
          }
        : {
            cause: options.empty?.cause ?? t('table.empty'),
            ...(options.empty?.action && { action: options.empty.action }),
            ...(pageFiltered && { filtered: pageFiltered }),
          }
      : null
  const phase = resolvePhase({
    phase: options.phase ?? (settled ? undefined : 'loading'),
    empty,
  })

  const host = useRef<DetailHost | undefined>(undefined)
  const hostKind = useRef<string | null>(null)
  const byId = new Map(rows.map((row) => [row.id, row.original] as const))
  const activation: Activation<T> =
    options.detail !== undefined
      ? { kind: 'detail', render: options.detail }
      : options.onRowActivate !== undefined
        ? { kind: 'row', run: options.onRowActivate }
        : { kind: 'auto' }

  const showAuto = (id: string): void => {
    const row = byId.get(id)
    if (row === undefined) return
    host.current?.show({
      title: detailTitle(model, row),
      body: (box) => createElement(AutoDetail<T>, { model, row, box }),
    })
  }
  const showDetail = (row: T): void => {
    if (activation.kind !== 'detail') return
    const { render } = activation
    host.current?.show({
      title: options.detailTitle?.(row) ?? options.label,
      body: (box) => render(row, box),
    })
  }
  // The `detailState` field: the id of the open row. `NO_DETAIL_STATE` keeps the hook order fixed.
  const detailState = options.detailState
  const [openId, setOpenId] = (detailState ?? NO_DETAIL_STATE).use()
  const shownFor = useRef<string | null>(null)
  const activate = (id: string): void => {
    const row = byId.get(id)
    if (row === undefined) return
    if (activation.kind === 'row') activation.run(row)
    else if (activation.kind === 'auto') showAuto(id)
    else if (activation.kind === 'detail') {
      if (detailState !== undefined) shownFor.current = id
      setOpenId(id)
      showDetail(row)
    }
  }
  // Shows the record a field names: its loaded row, else `detailById`'s body.
  const showField = (id: string): void => {
    const row = matched.find((r) => getRowId(r) === id)
    const { detailById } = options
    if (row !== undefined) showDetail(row)
    else if (detailById !== undefined)
      host.current?.show({ title: options.label, body: (box) => detailById(id, box) })
  }
  // The field is the source of truth: a name that arrives from the URL opens its row once the rows
  // load, and a field that goes unset (Back, `clear()`) closes the sheet the table opened. A name no
  // loaded row has opens `detailById`'s body once the query settled, or is cleared with a dev warning.
  useEffect(() => {
    if (detailState === undefined) return
    if (!openId) {
      if (shownFor.current === null) return
      shownFor.current = null
      host.current?.hide()
      return
    }
    if (shownFor.current === openId) return
    // `matched` is every row the request matches (all pages of a client table), so a row off the
    // current page still opens its `detail`.
    const row = matched.find((r) => getRowId(r) === openId)
    const { detailById } = options
    if (row === undefined) {
      if (phase.tag !== 'ready' && phase.tag !== 'empty') return
      if (detailById === undefined) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console -- dev-only diagnostic
          console.warn(
            `basalt-ui/table: "${options.id}" detailState names "${openId}", no loaded row; cleared. Pass detailById to open it.`,
          )
        }
        detailState.clear({ replace: true })
        return
      }
    }
    if (host.current === undefined) return
    shownFor.current = openId
    showField(openId)
  })
  const keyboard = useRowKeyboard({
    rowIds: items.flatMap((item) => (item.type === 'row' ? [item.row.id] : [])),
    onActivate: activate,
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
    getRowId,
    viewStore: options.views?.store,
    setHost(next, kind) {
      const previous = host.current
      host.current = next
      if (hostKind.current !== kind) {
        hostKind.current = kind
        // The page's aside mounts after the table's first render, so a deep link can show in the
        // table's own sheet first; the entry moves to the host that took over. This runs from the
        // parts' effect, which a host change reaches while the table's own effect does not.
        const shown = shownFor.current
        if (previous !== undefined && next !== undefined && shown !== null) {
          previous.hide()
          showField(shown)
        }
      }
    },
    openDetails: showAuto,
    closeDetail(hostClosed) {
      // `shownFor` keeps the closed id until the field reads empty, so a render that lands before
      // the field clears cannot reopen the sheet the user just closed. A host that closed on its
      // own clears the field only once a row has shown in it (a deep link that has not shown yet
      // keeps its id); the call comes on every render of the body.
      if (!hostClosed || shownFor.current !== null) detailState?.clear()
      if (detailState === undefined && openId) setOpenId('')
    },
    activeId: activation.kind === 'detail' ? openId : options.activeRowId,
    expandable:
      activation.kind === 'row' &&
      plan.columns.some(
        (column) => column.visible && (column.priority === 3 || column.place === 'detail'),
      ),
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
  const escape: TableEscape<T> = {
    rows,
    matched,
    columns: plan.columns.flatMap((planned, index) => {
      const spec = specs[index]
      return planned.visible && spec !== undefined && spec.kind !== 'actions'
        ? [{ id: spec.id, header: spec.header, value: spec.value }]
        : []
    }),
  }
  return { __brand: 'DataTableInstance', table: escape, [MODEL]: model } as Built<T>
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

/** Rows read when sizing a `width: 'content'` column; a longer list is sampled from its head. */
const CONTENT_SAMPLE = 1000

/** The widest loaded value in `ch` of each `width: 'content'` column, by id; `{}` when none. */
function contentWidths<T>(
  specs: readonly KindSpec<T>[],
  data: readonly T[] | undefined,
): Record<string, number> {
  const widths: Record<string, number> = {}
  if (data === undefined) return widths
  for (const spec of specs) {
    if (spec.content === undefined) continue
    let widest = 0
    for (const row of data.slice(0, CONTENT_SAMPLE))
      widest = Math.max(widest, spec.content.measure(row))
    widths[spec.id] = widest
  }
  return widths
}

/** The plan, recomputed only when a column's shape, the visibility or a content width changes (one dev warning each). */
function usePlan<T>(
  columns: readonly KindColumn<T>[],
  key: string,
  visibility: Record<string, boolean>,
  contentCh: Record<string, number>,
): TablePlan {
  // oxlint-disable-next-line react/exhaustive-deps -- `key` IS the shape of `columns`, `visibility` and `contentCh`
  return useMemo(() => planTable(columns, { visibility, contentCh }), [key])
}
