/**
 * The 2.x invariants that the v3 core state flips (Issue t1b, docs/v3/concepts/data-table.md
 * section 8; evidence: docs/v3/evidence/self-table-data.md). They were `test.failing` until this
 * Issue; each is now a plain test.
 *
 *   I1   server mode resolves sort, filter and total; never "of N" for unseen rows   core/state
 *   I3   controlled selection: the caller is the only writer, no mirrored copy       core/selection
 *   I4   selection is keyed by getRowId, surviving a re-sort                         core/selection
 *   I10  active row: tabIndex 0, Enter only, never role=button, nested controls ignored   core/keyboard
 *   I17  facet filters match the exact string; a bad column id throws                core/filters
 *   I18  global search debounces 250 ms and flushes on unmount                       core/state
 *
 * `DataTable` and its parts arrive with the parts Issue (t2), so these drive the same core modules
 * the parts compose, through a small table in this file and the public DOM. When the parts land
 * the flipper there re-points `renderTable` at the real table; the assertions stay.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Selection, StateHandle, TableState } from '../contract'
import { rowMatches } from '../core/filters'
import { useRowKeyboard } from '../core/keyboard'
import { useSelection } from '../core/selection'
import { createState, describeRange, useSearchDraft, useTableState } from '../core/state'
import { ROWS } from './harness'
import type { Row } from './harness'

afterEach(cleanup)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const COLUMNS = new Set(['name', 'amount', 'state'])
const getRowId = (r: Row): string => r.id

function Subject(props: {
  rows?: readonly Row[]
  rowCount?: number | undefined
  page?: number
  selectable?: boolean
  controlled?: { value: Selection; onChange(next: Selection): void }
  onBulk?: (rows: readonly Row[]) => void
  onRowActivate?: (row: Row) => void
  filters?: TableState['request']['filters']
  reverse?: boolean
}): ReactNode {
  const { rows = ROWS, rowCount, page = 1, filters = [] } = props
  const handle: StateHandle<TableState> = {
    use: () => {
      const s = createState()
      return [{ ...s, request: { ...s.request, page, filters } }, () => undefined]
    },
  }
  const t = useTableState({ id: 'inv', handle, count: rowCount })
  const shown = (props.reverse ? rows.toReversed() : [...rows]).filter((r) =>
    rowMatches(t.request.filters, { getValue: (id) => r[id as keyof Row] }, COLUMNS),
  )
  const selection = useSelection<Row>({
    getRowId,
    request: t.request,
    controlled: props.controlled,
  })
  const kb = useRowKeyboard({
    rowIds: shown.map(getRowId),
    onActivate: props.onRowActivate
      ? (id) => props.onRowActivate?.(shown.find((r) => r.id === id) as Row)
      : undefined,
    onToggle: props.selectable ? selection.toggle : undefined,
  })
  const range = describeRange(t.request, rowCount, shown.length)
  return (
    <div>
      <p>
        {range.key === 'table.rowRange'
          ? `${range.from}-${range.to} of ${range.total}`
          : `${range.from}-${range.to}`}
      </p>
      {selection.count > 0 && props.onBulk ? (
        <button type="button" onClick={() => props.onBulk?.(selection.rows(shown))}>
          Act
        </button>
      ) : null}
      <table>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id} {...kb.rowProps(r.id)}>
              <td>{r.name}</td>
              <td>{r.state}</td>
              {props.selectable ? (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`tick ${r.name}`}
                    checked={selection.isSelected(r.id)}
                    onChange={() => selection.toggle(r.id)}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

describe('core state invariants', () => {
  test('I1 a server table with an unknown total prints no "of N"', () => {
    const { container } = render(<Subject rowCount={undefined} page={3} />)
    expect(container.textContent).not.toMatch(/\bof \d+/)
    expect(container.textContent).toContain('51-53')
  })

  test('I1 a known total prints it, once', () => {
    const { container } = render(<Subject rowCount={3} />)
    expect(container.textContent).toContain('1-3 of 3')
  })

  test('I3 one tick selects one row: the caller map is the only writer, no mirrored copy', () => {
    const onBulk = mock((_rows: readonly Row[]) => undefined)
    const onChange = mock((_next: Selection) => undefined)
    function Caller(): ReactNode {
      const [value, setValue] = useState<Selection>({ kind: 'ids', ids: [] })
      return (
        <Subject
          selectable
          onBulk={onBulk}
          controlled={{
            value,
            onChange: (next) => {
              onChange(next)
              setValue(next)
            },
          }}
        />
      )
    }
    const { container } = render(<Caller />)
    expect(screen.queryByRole('button', { name: 'Act' })).toBeNull()
    fireEvent.click(container.querySelector('tbody input[type="checkbox"]') as HTMLElement)
    expect(container.querySelectorAll('tbody input[type="checkbox"]:checked')).toHaveLength(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Act' }))
    expect(onBulk.mock.calls[0]?.[0]).toHaveLength(1)
  })

  test('I3 uncontrolled, one tick is also one row', () => {
    const onBulk = mock((_rows: readonly Row[]) => undefined)
    const { container } = render(<Subject selectable onBulk={onBulk} />)
    fireEvent.click(container.querySelector('tbody input[type="checkbox"]') as HTMLElement)
    expect(container.querySelectorAll('tbody input[type="checkbox"]:checked')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Act' }))
    expect(onBulk.mock.calls[0]?.[0]).toHaveLength(1)
  })

  test('I4 the ticked row stays the same row after a re-sort', () => {
    const { container, rerender } = render(<Subject selectable />)
    const ticked = () =>
      container.querySelector('tbody input[type="checkbox"]:checked')?.closest('tr')?.textContent
    fireEvent.click(
      container.querySelector('tbody tr:first-child input[type="checkbox"]') as HTMLElement,
    )
    const before = ticked()
    expect(before).toContain('Project 10')
    rerender(<Subject selectable reverse />)
    expect(container.querySelector('tbody tr:first-child')?.textContent).not.toContain('Project 10')
    expect(ticked()).toBe(before)
  })

  test('I10 an activatable row is focusable, not a button, and fires on Enter only', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    const { container } = render(<Subject onRowActivate={onRowActivate} selectable />)
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

  test('I17 a facet filter matches the whole value, not a substring', () => {
    const { container } = render(
      <Subject filters={[{ id: 'state', op: 'anyOf', values: ['Eng'] }]} />,
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(container.querySelector('tbody tr')?.textContent).toContain('Project 2')
  })

  test('I17 a filter on a column the table lacks throws', () => {
    const quiet = mock(() => undefined)
    const spy = console.error
    console.error = quiet
    try {
      expect(() =>
        render(<Subject filters={[{ id: 'ghost', op: 'anyOf', values: ['x'] }]} />),
      ).toThrow(/"ghost"/)
    } finally {
      console.error = spy
    }
  })

  test('I18 a pending search keystroke still reaches state on unmount', async () => {
    let latest: { q: string } | undefined
    function Box(): ReactNode {
      const draft = useSearchDraft('', (q) => {
        latest = { q }
      })
      return (
        <input
          role="searchbox"
          value={draft.draft}
          onChange={(e) => draft.change(e.target.value)}
        />
      )
    }
    const { unmount } = render(<Box />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abc' } })
    unmount()
    await act(() => sleep(300))
    expect(latest?.q).toBe('abc')
  })
})
