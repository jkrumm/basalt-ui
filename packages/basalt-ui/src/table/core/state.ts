/**
 * Table state (docs/v3/concepts/data-table.md sections 1.4 and 6): one serialisable value,
 * `TableState = { v: 1, request, display }`, bound through a `StateHandle` (a URL field of
 * `field.composite(codec)` satisfies it) or, without a router, a memory handle.
 *
 * Law:
 * - `request` is the query key. `requestKey` is its identity, and `useTableState` hands out a
 *   `request` object that keeps its identity while only `display` moves, so a column toggle can
 *   never refetch.
 * - `display` is a device lane (`basalt:table:<id>`), never in the handle's value or the URL: a
 *   shared link does not force columns, and a URL handle needs no `display` to round-trip.
 * - A write that changes `q`, `filters`, `sort` or `pageSize` and names no page writes page 1 in the
 *   same write. `resetOn` does the same when its list changes, never at mount, and tells the
 *   caller to clear the selection.
 * - An out-of-range page corrects only once the count is known. While it is pending the page is
 *   kept, and the range text has no total (invariant I1: never "of N" for rows nobody has seen).
 * - The search draft debounces 250 ms and flushes on unmount (I18).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedCallback } from '../../core/debounce'
import { persisted } from '../../core/persisted'
import type { Mode, StateHandle, TableDisplay, TableRequest, TableState } from '../contract'

export const DEFAULT_PAGE_SIZE = 25
export const SEARCH_DEBOUNCE_MS = 250

// ---- Pure value helpers -------------------------------------------------------------------

/** The state of a table nobody has touched; `defaults` is the codec's (`sort`, `pageSize`, ...). */
export function createState(defaults?: Partial<TableRequest>): TableState {
  return {
    v: 1,
    request: {
      q: defaults?.q ?? '',
      filters: defaults?.filters ?? [],
      sort: defaults?.sort ?? [],
      page: defaults?.page ?? 1,
      pageSize: defaults?.pageSize ?? DEFAULT_PAGE_SIZE,
    },
    display: { visibility: {} },
  }
}

/** The part of a request that decides WHICH rows match: everything but the page. */
function scopeKey(r: TableRequest): string {
  return JSON.stringify([
    r.q,
    r.filters.map((f) => [f.id, f.op, [...f.values]]),
    r.sort.map((s) => [s.id, s.desc]),
    r.pageSize,
  ])
}

/** The identity of a request; equal keys are the same query. */
export function requestKey(r: TableRequest): string {
  return `${scopeKey(r)}@${r.page}`
}

/** Same rows matched, whatever the page: what an `all-matching` selection belongs to. */
export function sameScope(a: TableRequest, b: TableRequest): boolean {
  return a === b || scopeKey(a) === scopeKey(b)
}

export function sameRequest(a: TableRequest, b: TableRequest): boolean {
  return a === b || requestKey(a) === requestKey(b)
}

/**
 * Applies a request patch. Changing the scope (`q`, `filters`, `sort`, `pageSize`) without naming
 * a page writes page 1. Returns the SAME state object when nothing changed, so a no-op is no write.
 */
export function writeRequest(state: TableState, patch: Partial<TableRequest>): TableState {
  const merged: TableRequest = { ...state.request, ...patch }
  if (patch.page === undefined && scopeKey(merged) !== scopeKey(state.request)) merged.page = 1
  if (sameRequest(merged, state.request)) return state
  return { ...state, request: merged }
}

/** Page and rows the footer prints: `total` is absent while the count is unknown. */
export type RangeText = {
  /** `table.rowRange` ("1-25 of 120") or `table.rowRangeUnknown` ("1-25"). */
  key: 'table.rowRange' | 'table.rowRangeUnknown'
  /** 1-based, `0` when the page shows no rows. */
  from: number
  to: number
  total?: number
}

/** The rows a mode can count: client rows are known, server rows only once `rowCount` arrives. */
export function countOf(mode: Mode, clientCount?: number): number | undefined {
  if (mode.kind === 'client') return clientCount
  return 'rowCount' in mode ? mode.rowCount : undefined
}

export function pageCount(count: number | undefined, pageSize: number): number | undefined {
  if (count === undefined) return undefined
  return Math.max(1, Math.ceil(count / Math.max(1, pageSize)))
}

/** The page to show: out of range only corrects once `count` is known. */
export function correctedPage(page: number, count: number | undefined, pageSize: number): number {
  const last = pageCount(count, pageSize)
  const safe = Math.max(1, Math.trunc(page) || 1)
  return last === undefined ? safe : Math.min(safe, last)
}

/** What the footer says about the rows on screen; never "of N" without an N. */
export function describeRange(
  request: Pick<TableRequest, 'page' | 'pageSize'>,
  count: number | undefined,
  rowsOnPage: number,
): RangeText {
  if (rowsOnPage <= 0) {
    return count === undefined
      ? { key: 'table.rowRangeUnknown', from: 0, to: 0 }
      : { key: 'table.rowRange', from: 0, to: 0, total: count }
  }
  const from = (request.page - 1) * request.pageSize + 1
  const to = from + rowsOnPage - 1
  return count === undefined
    ? { key: 'table.rowRangeUnknown', from, to }
    : { key: 'table.rowRange', from, to, total: count }
}

const sameList = (a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean =>
  a === b ||
  (a !== undefined &&
    b !== undefined &&
    a.length === b.length &&
    a.every((v, i) => Object.is(v, b[i])))

// ---- Handles ------------------------------------------------------------------------------

/** A handle over component state, for a table with no router (`state` omitted). */
export function useMemoryHandle(defaults?: Partial<TableRequest>): StateHandle<TableState> {
  const [value, setValue] = useState(() => createState(defaults))
  return useMemo(
    () => ({ use: () => [value, setValue] as [TableState, (next: TableState) => void] }),
    [value],
  )
}

const EMPTY_DISPLAY: TableDisplay = { visibility: {} }

/** The device lane of a table's display: `basalt:table:<id>`, SSR-safe through `persisted`. */
function displayStore(id: string) {
  return persisted<TableDisplay>(`table:${id}`, { version: 1, initial: EMPTY_DISPLAY })
}

// ---- The hook -----------------------------------------------------------------------------

export type TableStateOptions = {
  id: string
  /** The caller's handle; a memory handle without one. */
  handle?: StateHandle<TableState> | undefined
  /** The codec's defaults, for the memory handle's first state. */
  defaults?: Partial<TableRequest> | undefined
  /** Rows matching the current request; `undefined` while it is pending or for a cursor table. */
  count?: number | undefined
  /** `false` for a cursor table: there is no page to correct. */
  paged?: boolean | undefined
  /** Values owned by the page; a change writes page 1 and calls `onReset`. Not read at mount. */
  resetOn?: readonly unknown[] | undefined
  /** Called once per `resetOn` change; the table clears its selection here. */
  onReset?: (() => void) | undefined
}

export type TableStateApi = {
  state: TableState
  /** Keeps its identity while only `display` changes: the query key. */
  request: TableRequest
  display: TableDisplay
  setRequest(patch: Partial<TableRequest>): void
  setDisplay(patch: Partial<TableDisplay>): void
}

export function useTableState(options: TableStateOptions): TableStateApi {
  const own = useMemoryHandle(options.defaults)
  const [value, setValue] = (options.handle ?? own).use()
  const store = useMemo(() => displayStore(options.id), [options.id])
  const [display, writeDisplay] = store.use()

  // Writes in one tick compose: each starts from the previous write, not from the last render.
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  })
  const write = (next: TableState): void => {
    if (next === latest.current) return
    latest.current = next
    setValue(next)
  }

  const key = requestKey(value.request)
  // oxlint-disable-next-line react/exhaustive-deps -- `key` IS the request's identity
  const request = useMemo(() => value.request, [key])

  const prevResetOn = useRef(options.resetOn)
  useEffect(() => {
    const before = prevResetOn.current
    prevResetOn.current = options.resetOn
    if (options.resetOn === undefined || sameList(before, options.resetOn)) return
    options.onReset?.()
    write(writeRequest(latest.current, { page: 1 }))
  })

  useEffect(() => {
    if (options.paged === false || options.count === undefined) return
    const page = correctedPage(request.page, options.count, request.pageSize)
    if (page !== request.page) write(writeRequest(latest.current, { page }))
  })

  return {
    state: { ...value, request, display },
    request,
    display,
    setRequest: (patch) => write(writeRequest(latest.current, patch)),
    setDisplay: (patch) => writeDisplay((prev) => ({ ...prev, ...patch })),
  }
}

// ---- The search draft ---------------------------------------------------------------------

export type SearchDraft = {
  /** What the box shows. */
  draft: string
  /** A keystroke: shown at once, written to `q` after the debounce. */
  change(value: string): void
  /** Writes the pending phrase now (Enter, blur). */
  commit(): void
  /** Empties the box and `q` at once, dropping any pending phrase. */
  clear(): void
}

/**
 * The box's text, debounced into `q`. A pending phrase is flushed on unmount, so a keystroke typed
 * just before navigation still lands (I18). A `q` that changes under the box (a reset, an applied
 * view) replaces the draft and cancels the pending phrase.
 */
export function useSearchDraft(
  q: string,
  setQ: (q: string) => void,
  ms: number = SEARCH_DEBOUNCE_MS,
): SearchDraft {
  const [draft, setDraft] = useState(q)
  const written = useRef(q)
  const write = useDebouncedCallback((next: string) => {
    written.current = next
    setQ(next)
  }, ms)

  useEffect(() => {
    if (q === written.current) return
    write.cancel()
    written.current = q
    setDraft(q)
  }, [q, write])

  return {
    draft,
    change(next) {
      setDraft(next)
      write.call(next)
    },
    commit: () => write.flush(),
    clear() {
      write.cancel()
      written.current = ''
      setDraft('')
      setQ('')
    },
  }
}
