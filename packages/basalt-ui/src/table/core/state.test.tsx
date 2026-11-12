/**
 * Table state: the request is the query key, `resetOn` and scope changes write page 1 once, a page
 * out of range corrects only once the count is known (I1), the search draft flushes on unmount (I18).
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { StateHandle, TableState } from '../contract'
import {
  correctedPage,
  countOf,
  createState,
  describeRange,
  pageCount,
  requestKey,
  useSearchDraft,
  useTableState,
  writeRequest,
} from './state'
import type { TableStateOptions } from './state'

afterEach(cleanup)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A handle over `useState` that records every write, the way a URL field would navigate. */
function recordingHandle(initial: TableState) {
  const writes: TableState[] = []
  const handle: StateHandle<TableState> = {
    use() {
      const [value, setValue] = useState(initial)
      return [
        value,
        (next) => {
          writes.push(next)
          setValue(next)
        },
      ]
    },
  }
  return { handle, writes }
}

const onPage = (page: number): TableState => {
  const s = createState()
  return { ...s, request: { ...s.request, page } }
}

describe('writeRequest', () => {
  test('a scope change without a page writes page 1', () => {
    const s = onPage(3)
    expect(writeRequest(s, { q: 'acme' }).request.page).toBe(1)
    expect(writeRequest(s, { sort: [{ id: 'a', desc: true }] }).request.page).toBe(1)
    expect(writeRequest(s, { pageSize: 50 }).request.page).toBe(1)
    expect(
      writeRequest(s, { filters: [{ id: 'a', op: 'anyOf', values: ['x'] }] }).request.page,
    ).toBe(1)
  })

  test('an explicit page wins, and a page change alone keeps the scope', () => {
    expect(writeRequest(onPage(3), { q: 'x', page: 4 }).request.page).toBe(4)
    expect(writeRequest(onPage(3), { page: 5 }).request).toMatchObject({ page: 5, q: '' })
  })

  test('a write of the same value is the same state object', () => {
    const s = onPage(3)
    expect(writeRequest(s, { q: '' })).toBe(s)
    expect(writeRequest(s, { page: 3 })).toBe(s)
    expect(writeRequest(s, { filters: [] })).toBe(s)
  })

  test('requestKey names the query', () => {
    expect(requestKey(onPage(2).request)).not.toBe(requestKey(onPage(3).request))
    expect(requestKey(onPage(2).request)).toBe(requestKey(onPage(2).request))
  })
})

describe('counts and ranges (I1)', () => {
  test('countOf: client from rows, server from rowCount, cursor unknown', () => {
    expect(countOf({ kind: 'client' }, 12)).toBe(12)
    expect(countOf({ kind: 'server', rowCount: 99 })).toBe(99)
    expect(countOf({ kind: 'server', rowCount: undefined })).toBeUndefined()
    expect(countOf({ kind: 'server', cursor: { hasNext: true, fetchNext() {} } })).toBeUndefined()
  })

  test('the page count is unknown while the count is, and at least 1', () => {
    expect(pageCount(undefined, 25)).toBeUndefined()
    expect(pageCount(0, 25)).toBe(1)
    expect(pageCount(51, 25)).toBe(3)
  })

  test('correctedPage keeps the page while the count is pending', () => {
    expect(correctedPage(3, undefined, 25)).toBe(3)
    expect(correctedPage(3, 10, 25)).toBe(1)
    expect(correctedPage(3, 60, 25)).toBe(3)
    expect(correctedPage(0, 60, 25)).toBe(1)
  })

  test('an unknown total never prints "of N"', () => {
    const request = { page: 3, pageSize: 25 }
    expect(describeRange(request, undefined, 25)).toEqual({
      key: 'table.rowRangeUnknown',
      from: 51,
      to: 75,
    })
    expect(describeRange(request, undefined, 0)).toEqual({
      key: 'table.rowRangeUnknown',
      from: 0,
      to: 0,
    })
    expect(describeRange(request, 80, 5)).toEqual({
      key: 'table.rowRange',
      from: 51,
      to: 55,
      total: 80,
    })
    expect(describeRange({ page: 1, pageSize: 25 }, 0, 0).total).toBe(0)
  })
})

describe('useTableState', () => {
  const opts = (patch: Partial<TableStateOptions>): TableStateOptions => ({
    id: 'state-t',
    ...patch,
  })

  test('without a handle it holds its own state and needs no router', () => {
    const { result } = renderHook(() => useTableState(opts({})))
    act(() => result.current.setRequest({ page: 4 }))
    expect(result.current.request.page).toBe(4)
    act(() => result.current.setRequest({ q: 'acme' }))
    expect(result.current.request).toMatchObject({ q: 'acme', page: 1 })
  })

  test('?page=3 with the count pending keeps page 3 and writes nothing', () => {
    const { handle, writes } = recordingHandle(onPage(3))
    const { result, rerender } = renderHook((p: TableStateOptions) => useTableState(p), {
      initialProps: opts({ handle, count: undefined }),
    })
    rerender(opts({ handle, count: undefined }))
    expect(result.current.request.page).toBe(3)
    expect(writes).toHaveLength(0)
    expect(describeRange(result.current.request, undefined, 25).key).toBe('table.rowRangeUnknown')
  })

  test('once the count is known an out-of-range page corrects, in one write', () => {
    const { handle, writes } = recordingHandle(onPage(3))
    const { result, rerender } = renderHook((p: TableStateOptions) => useTableState(p), {
      initialProps: opts({ handle, count: undefined }),
    })
    rerender(opts({ handle, count: 10 }))
    rerender(opts({ handle, count: 10 }))
    expect(result.current.request.page).toBe(1)
    expect(writes).toHaveLength(1)
  })

  test('an in-range page is left alone, and a cursor table has no page to correct', () => {
    const a = recordingHandle(onPage(3))
    renderHook(() => useTableState(opts({ handle: a.handle, count: 60 })))
    expect(a.writes).toHaveLength(0)
    const b = recordingHandle(onPage(3))
    renderHook(() => useTableState(opts({ handle: b.handle, count: 10, paged: false })))
    expect(b.writes).toHaveLength(0)
  })

  test('a resetOn change on page 3 writes page 1 once and clears the selection once', () => {
    const { handle, writes } = recordingHandle(onPage(3))
    const onReset = mock(() => undefined)
    const { result, rerender } = renderHook((p: TableStateOptions) => useTableState(p), {
      initialProps: opts({ handle, resetOn: ['2025-01'], onReset }),
    })
    expect(writes).toHaveLength(0)
    expect(onReset).not.toHaveBeenCalled()
    rerender(opts({ handle, resetOn: ['2025-02'], onReset }))
    rerender(opts({ handle, resetOn: ['2025-02'], onReset }))
    expect(result.current.request.page).toBe(1)
    expect(writes).toHaveLength(1)
    expect(writes[0]?.request.page).toBe(1)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  test('a fresh array with the same members is no change', () => {
    const { handle, writes } = recordingHandle(onPage(3))
    const onReset = mock(() => undefined)
    const { rerender } = renderHook((p: TableStateOptions) => useTableState(p), {
      initialProps: opts({ handle, resetOn: ['a', 1], onReset }),
    })
    rerender(opts({ handle, resetOn: ['a', 1], onReset }))
    expect(writes).toHaveLength(0)
    expect(onReset).not.toHaveBeenCalled()
  })

  test('on page 1 a resetOn change writes nothing but still clears the selection', () => {
    const { handle, writes } = recordingHandle(onPage(1))
    const onReset = mock(() => undefined)
    const { rerender } = renderHook((p: TableStateOptions) => useTableState(p), {
      initialProps: opts({ handle, resetOn: ['a'], onReset }),
    })
    rerender(opts({ handle, resetOn: ['b'], onReset }))
    expect(writes).toHaveLength(0)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  test('a display toggle never moves the request identity and never writes the handle', () => {
    const { handle, writes } = recordingHandle(onPage(2))
    const { result } = renderHook(() => useTableState(opts({ id: 'state-display', handle })))
    const before = result.current.request
    act(() => result.current.setDisplay({ visibility: { note: false } }))
    expect(result.current.display.visibility).toEqual({ note: false })
    expect(result.current.state.display.visibility).toEqual({ note: false })
    expect(result.current.request).toBe(before)
    expect(writes).toHaveLength(0)
  })

  test('writes in one tick compose', () => {
    const { handle, writes } = recordingHandle(onPage(1))
    const { result } = renderHook(() => useTableState(opts({ handle })))
    act(() => {
      result.current.setRequest({ q: 'a' })
      result.current.setRequest({ sort: [{ id: 'x', desc: true }] })
    })
    expect(result.current.request).toMatchObject({ q: 'a', sort: [{ id: 'x', desc: true }] })
    expect(writes).toHaveLength(2)
  })
})

describe('useSearchDraft', () => {
  test('a keystroke shows at once and reaches q after 250 ms', async () => {
    const setQ = mock((_q: string) => undefined)
    const { result } = renderHook(() => useSearchDraft('', setQ))
    act(() => result.current.change('abc'))
    expect(result.current.draft).toBe('abc')
    expect(setQ).not.toHaveBeenCalled()
    await act(() => sleep(300))
    expect(setQ).toHaveBeenCalledTimes(1)
    expect(setQ).toHaveBeenCalledWith('abc')
  })

  test('a pending keystroke is flushed on unmount (I18)', async () => {
    const setQ = mock((_q: string) => undefined)
    const { result, unmount } = renderHook(() => useSearchDraft('', setQ))
    act(() => result.current.change('abc'))
    unmount()
    expect(setQ).toHaveBeenCalledWith('abc')
    await act(() => sleep(300))
    expect(setQ).toHaveBeenCalledTimes(1)
  })

  test('commit writes now, clear empties q and drops the pending phrase', async () => {
    const setQ = mock((_q: string) => undefined)
    const { result } = renderHook(() => useSearchDraft('', setQ))
    act(() => result.current.change('ab'))
    act(() => result.current.commit())
    expect(setQ).toHaveBeenLastCalledWith('ab')
    act(() => result.current.change('abc'))
    act(() => result.current.clear())
    expect(result.current.draft).toBe('')
    expect(setQ).toHaveBeenLastCalledWith('')
    await act(() => sleep(300))
    expect(setQ).toHaveBeenLastCalledWith('')
    expect(setQ).toHaveBeenCalledTimes(2)
  })

  test('a q that changes under the box replaces the draft and cancels the pending phrase', async () => {
    const setQ = mock((_q: string) => undefined)
    const { result, rerender } = renderHook(({ q }) => useSearchDraft(q, setQ), {
      initialProps: { q: 'old' },
    })
    act(() => result.current.change('typed'))
    rerender({ q: 'from-view' })
    expect(result.current.draft).toBe('from-view')
    await act(() => sleep(300))
    expect(setQ).not.toHaveBeenCalled()
  })

  test('its own echo does not reset the draft typed since', async () => {
    const setQ = mock((_q: string) => undefined)
    const { result, rerender } = renderHook(({ q }) => useSearchDraft(q, setQ), {
      initialProps: { q: '' },
    })
    act(() => result.current.change('a'))
    await act(() => sleep(300))
    act(() => result.current.change('ab'))
    rerender({ q: 'a' })
    expect(result.current.draft).toBe('ab')
  })
})
