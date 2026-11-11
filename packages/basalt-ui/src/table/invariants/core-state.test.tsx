/**
 * Pinned 2.x invariants that the v3 core state flips (Issue t1b, docs/v3/concepts/data-table.md
 * section 8; evidence: docs/v3/evidence/self-table-data.md). Each is `test.failing` until the
 * flipper lands; the flipper turns it into a plain `test`.
 *
 *   I1   server mode resolves sort, filter and total; never "of N" for unseen rows   t1b
 *   I3   controlled selection: the caller is the only writer, no mirrored copy       t1b
 *   I4   selection is keyed by getRowId, surviving a re-sort                         t1b
 *   I10  active row: tabIndex 0, Enter only, never role=button, nested controls ignored   t1b
 *   I17  facet filters match the exact string; a bad column id throws                t1b
 *   I18  global search debounces 250 ms and flushes on unmount                       t1b
 */
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderTable } from './harness'
import type { Row } from './harness'

afterEach(cleanup)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('core state invariants', () => {
  // 2.x: data-table.tsx:880-896,1117-1215
  test.failing('I1 a server table with an unknown total prints no "of N"', () => {
    const { container } = renderTable({ mode: { kind: 'server', rowCount: undefined } })
    expect(container.textContent).not.toMatch(/\bof \d+/)
  })

  // 2.x: data-table-state.ts:101-121
  test.failing(
    'I3 one tick selects one row: the caller map is the only writer, no mirrored copy',
    () => {
      const onBulk = mock((_rows: readonly Row[]) => undefined)
      const { container } = renderTable({
        selection: { bulk: [{ key: 'x', label: 'Act', onClick: onBulk }] },
      })
      expect(screen.queryByRole('button', { name: 'Act' })).toBeNull()
      fireEvent.click(container.querySelector('tbody input[type="checkbox"]') as HTMLElement)
      expect(container.querySelectorAll('tbody input[type="checkbox"]:checked')).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Act' }))
      expect(onBulk.mock.calls[0]?.[0]).toHaveLength(1)
    },
  )

  // 2.x: data-table.tsx:790-799
  test.failing('I4 the ticked row stays the same row after a re-sort', () => {
    const { container } = renderTable({
      selection: { bulk: [{ key: 'x', label: 'Act', onClick: () => undefined }] },
    })
    const ticked = () =>
      container.querySelector('tbody input[type="checkbox"]:checked')?.closest('tr')?.textContent
    fireEvent.click(
      container.querySelector('tbody tr:first-child input[type="checkbox"]') as HTMLElement,
    )
    const before = ticked()
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(ticked()).toBe(before)
  })

  // 2.x: data-table-state.ts:208-229
  test.failing('I10 an activatable row is focusable, not a button, and fires on Enter only', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    const { container } = renderTable({ onRowActivate })
    const row = container.querySelector('tbody tr[data-activatable]') as HTMLElement
    expect(row.getAttribute('tabindex')).toBe('0')
    expect(row.getAttribute('role')).not.toBe('button')
    fireEvent.keyDown(row, { key: ' ' })
    expect(onRowActivate).not.toHaveBeenCalled()
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowActivate).toHaveBeenCalledTimes(1)
    const nested = row.querySelector('button, input, a') as HTMLElement | null
    if (nested) fireEvent.keyDown(nested, { key: 'Enter', bubbles: true })
    expect(onRowActivate).toHaveBeenCalledTimes(1)
  })

  // 2.x: data-table.tsx:225-330
  test.failing('I17 a facet filter matches the whole value, not a substring', () => {
    const { container } = renderTable()
    fireEvent.click(screen.getByRole('button', { name: /State/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Eng' }))
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  // 2.x: data-table.tsx:1104,1349-1353
  test.failing('I18 a pending search keystroke still reaches state on unmount', async () => {
    let latest: { q: string } | undefined
    const state = {
      use: () =>
        [
          {
            v: 1 as const,
            request: { q: '', filters: [], sort: [], page: 0, pageSize: 25 },
            display: { visibility: {} },
          },
          (s: { request: { q: string } }) => {
            latest = { q: s.request.q }
          },
        ] as never,
    }
    const { unmount } = renderTable({ state })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abc' } })
    unmount()
    await act(() => sleep(300))
    expect(latest?.q).toBe('abc')
  })
})
