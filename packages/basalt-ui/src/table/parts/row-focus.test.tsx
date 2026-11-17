/**
 * `DataTable focus`: a row maps to its chart-focus item by `getRowId`, pointing at a row or moving
 * the row keyboard onto it sets the shared focus, an item focused elsewhere marks only its row.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { useChartFocus } from '../../charts/focus'
import { installLayoutDoubles, restoreLayoutDoubles } from '../../page/page.test-support'
import { col } from '../core/kinds'
import { useMemoryHandle } from '../core/state'
import { useDataTable } from '../use-data-table'
import { DataTable } from './data-table'

beforeEach(installLayoutDoubles)
afterEach(() => {
  cleanup()
  restoreLayoutDoubles()
})

type Row = { id: string; name: string }
const ROWS: Row[] = [
  { id: 'a', name: 'Charlie' },
  { id: 'b', name: 'Alpha' },
  { id: 'c', name: 'Bravo' },
]

const seen: { handle?: ReturnType<typeof useChartFocus<Row>> } = {}
/** Holds the latest handle for the test body, after each commit. */
const keep = (focus: ReturnType<typeof useChartFocus<Row>>): void => {
  seen.handle = focus
}

function Subject({ withFocus = true }: { withFocus?: boolean }): ReactElement {
  const focus = useChartFocus(ROWS, { announce: (d) => d.name })
  useEffect(() => keep(focus))
  const c = col<Row>()
  const state = useMemoryHandle()
  const t = useDataTable<Row>({
    id: 'row-focus-test',
    label: 'Rows',
    columns: [c.text('name', { header: 'Name' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    state,
    onRowActivate: () => undefined,
  })
  return (
    <div data-index={focus.index ?? ''}>
      <DataTable table={t} {...(withFocus && { focus })} />
    </div>
  )
}

const bodyRows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('tbody tr')]
const focused = (): (string | null)[] =>
  bodyRows().map((tr) => (tr.hasAttribute('data-focused') ? tr.textContent : null))

describe('DataTable focus', () => {
  test('pointing at a row sets its item index, whatever the sort', () => {
    render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Name' }))
    expect(bodyRows().map((tr) => tr.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie'])
    fireEvent.pointerEnter(bodyRows()[0] as HTMLElement)
    expect(seen.handle?.index).toBe(1)
    expect(focused()).toEqual(['Alpha', null, null])
  })

  test('a focus set elsewhere marks only its row and dims the others, until it clears', () => {
    render(<Subject />)
    const dimmed = (): boolean[] => bodyRows().map((tr) => tr.hasAttribute('data-dimmed'))
    expect(dimmed()).toEqual([false, false, false])
    act(() => seen.handle?.set(2))
    expect(focused()).toEqual([null, null, 'Bravo'])
    expect(dimmed()).toEqual([true, true, false])
    expect(bodyRows().every((tr) => tr.hasAttribute('data-chart-mark'))).toBe(true)
    act(() => seen.handle?.set(null))
    expect(dimmed()).toEqual([false, false, false])
  })

  test('row DOM focus sets the item; leaving the rows or the table clears it', () => {
    render(<Subject />)
    act(() => bodyRows()[1]?.focus())
    expect(seen.handle?.index).toBe(1)
    fireEvent.pointerLeave(document.querySelector('tbody') as HTMLElement, { pointerType: 'mouse' })
    expect(seen.handle?.index).toBeNull()
    act(() => bodyRows()[2]?.focus())
    expect(seen.handle?.index).toBe(2)
    act(() => bodyRows()[2]?.blur())
    expect(seen.handle?.index).toBeNull()
  })

  test('without a focus no row carries the attribute and a hover changes nothing', () => {
    render(<Subject withFocus={false} />)
    fireEvent.pointerEnter(bodyRows()[0] as HTMLElement)
    expect(focused()).toEqual([null, null, null])
    expect(seen.handle?.index).toBeNull()
  })
})
