/**
 * Selection: ids survive sort, page and refetch by `getRowId`; `all-matching` carries the excluded
 * ids and belongs to its request; the union reads the same everywhere.
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Selection, TableRequest } from '../contract'
import {
  EMPTY_SELECTION,
  isSelected,
  reconcile,
  selectAllMatching,
  selectedCount,
  selectedRows,
  toggleRow,
  toggleRows,
  useSelection,
} from './selection'
import { createState } from './state'

afterEach(cleanup)

type Row = { id: string; name: string }
const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id, name: `name-${id}` }))
const getRowId = (r: Row): string => r.id
const request = (patch: Partial<TableRequest> = {}): TableRequest => ({
  ...createState().request,
  ...patch,
})

describe('ids', () => {
  test('a tick is a row id, so it follows the row through a re-sort', () => {
    const asLoaded = rows('a', 'b', 'c')
    const picked = toggleRow(EMPTY_SELECTION, 'b')
    expect(selectedRows(picked, asLoaded, getRowId).map(getRowId)).toEqual(['b'])
    const reSorted = asLoaded.toReversed()
    expect(selectedRows(picked, reSorted, getRowId).map(getRowId)).toEqual(['b'])
  })

  test('ids of rows that are not loaded stay: other page, refetch in flight', () => {
    const picked = toggleRows(EMPTY_SELECTION, ['a', 'b'])
    expect(selectedCount(picked)).toBe(2)
    expect(selectedRows(picked, rows('c', 'd'), getRowId)).toEqual([])
    expect(selectedRows(picked, rows('b', 'x'), getRowId).map(getRowId)).toEqual(['b'])
    expect(selectedCount(picked)).toBe(2)
  })

  test('toggling twice is the empty selection, without duplicates on the way', () => {
    const once = toggleRow(EMPTY_SELECTION, 'a')
    expect(toggleRow(once, 'a')).toEqual(EMPTY_SELECTION)
    expect(toggleRows(once, ['a', 'b', 'a'])).toEqual({ kind: 'ids', ids: ['a', 'b'] })
  })

  test('the header tick selects the page, and unticks it when all of it is ticked', () => {
    const some = toggleRow(EMPTY_SELECTION, 'a')
    const all = toggleRows(some, ['a', 'b'])
    expect(all).toEqual({ kind: 'ids', ids: ['a', 'b'] })
    expect(toggleRows(all, ['a', 'b'])).toEqual(EMPTY_SELECTION)
    expect(toggleRows(all, ['b', 'c'])).toEqual({ kind: 'ids', ids: ['a', 'b', 'c'] })
    expect(toggleRows(all, [])).toBe(all)
  })
})

describe('all-matching', () => {
  const req = request({ q: 'acme', page: 2 })
  const all = selectAllMatching(req, 120)

  test('every row but the excluded ones', () => {
    expect(all).toMatchObject({ kind: 'all-matching', excluded: [], count: 120 })
    expect(isSelected(all, 'anything')).toBe(true)
    const minusTwo = toggleRow(toggleRow(all, 'a'), 'b')
    expect(minusTwo).toMatchObject({ excluded: ['a', 'b'] })
    expect(isSelected(minusTwo, 'a')).toBe(false)
    expect(isSelected(minusTwo, 'c')).toBe(true)
    expect(selectedCount(minusTwo)).toBe(118)
  })

  test('ticking an excluded row takes it back out of the list', () => {
    const back = toggleRow(toggleRow(all, 'a'), 'a')
    expect(back).toMatchObject({ kind: 'all-matching', excluded: [] })
  })

  test('the header tick moves a page in and out of excluded', () => {
    const off = toggleRows(all, ['a', 'b'])
    expect(off).toMatchObject({ excluded: ['a', 'b'] })
    expect(toggleRows(off, ['a', 'b'])).toMatchObject({ excluded: [] })
  })

  test('excluding every row is the empty selection; zero matches select nothing', () => {
    const three = selectAllMatching(req, 2)
    expect(toggleRows(three, ['a', 'b'])).toEqual(EMPTY_SELECTION)
    expect(selectAllMatching(req, 0)).toEqual(EMPTY_SELECTION)
  })

  test('selectedRows takes the loaded rows that are not excluded', () => {
    const minusB = toggleRow(all, 'b')
    expect(selectedRows(minusB, rows('a', 'b', 'c'), getRowId).map(getRowId)).toEqual(['a', 'c'])
  })

  test('it belongs to its request: another q, filter or sort empties it, a page change does not', () => {
    expect(reconcile(all, request({ q: 'acme', page: 5 }))).toBe(all)
    expect(reconcile(all, request({ q: 'other' }))).toEqual(EMPTY_SELECTION)
    expect(reconcile(all, request({ q: 'acme', sort: [{ id: 'a', desc: false }] }))).toEqual(
      EMPTY_SELECTION,
    )
    const ids: Selection = { kind: 'ids', ids: ['a'] }
    expect(reconcile(ids, request({ q: 'other' }))).toBe(ids)
  })

  test('the union: ids, then all-matching, then back to ids, reads one way', () => {
    const picked = toggleRows(EMPTY_SELECTION, ['a', 'b'])
    expect(selectedCount(picked)).toBe(2)
    const widened = selectAllMatching(req, 120)
    expect(isSelected(widened, 'a')).toBe(true)
    expect(isSelected(widened, 'zzz')).toBe(true)
    const narrowed = toggleRows(EMPTY_SELECTION, ['a'])
    expect(isSelected(narrowed, 'zzz')).toBe(false)
  })
})

describe('useSelection', () => {
  test('keeps one copy and ticks one row per click', () => {
    const { result } = renderHook(() => useSelection<Row>({ getRowId, request: request() }))
    act(() => result.current.toggle('a'))
    expect(result.current.selection).toEqual({ kind: 'ids', ids: ['a'] })
    expect(result.current.count).toBe(1)
    expect(result.current.isSelected('a')).toBe(true)
    expect(result.current.rows(rows('a', 'b')).map(getRowId)).toEqual(['a'])
    act(() => result.current.clear())
    expect(result.current.count).toBe(0)
  })

  test('controlled, the caller is the only writer: no mirrored copy (I3)', () => {
    const onChange = mock((_next: Selection) => undefined)
    const value: Selection = { kind: 'ids', ids: ['a'] }
    const { result, rerender } = renderHook(
      ({ v }: { v: Selection }) =>
        useSelection<Row>({ getRowId, request: request(), controlled: { value: v, onChange } }),
      { initialProps: { v: value } },
    )
    act(() => result.current.toggle('b'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'ids', ids: ['a', 'b'] })
    // The caller did not move: the hook still shows the caller's value, not its own idea of it.
    expect(result.current.selection).toBe(value)
    rerender({ v: { kind: 'ids', ids: ['z'] } })
    expect(result.current.selection).toEqual({ kind: 'ids', ids: ['z'] })
  })

  test('an all-matching selection is cleared when the request changes under it', () => {
    const { result, rerender } = renderHook(
      ({ r }: { r: TableRequest }) => useSelection<Row>({ getRowId, request: r }),
      { initialProps: { r: request({ q: 'a' }) } },
    )
    act(() => result.current.selectAllMatching(40))
    expect(result.current.count).toBe(40)
    rerender({ r: request({ q: 'a', page: 3 }) })
    expect(result.current.count).toBe(40)
    rerender({ r: request({ q: 'b' }) })
    expect(result.current.count).toBe(0)
    rerender({ r: request({ q: 'a' }) })
    expect(result.current.count).toBe(0)
  })
})
