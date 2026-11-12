/**
 * Declared grouping (docs/v3/issues/g3/v3-table-t4-virtual.json): one group row per value with its
 * count, collapse hides the group's rows and writes `display.collapsed`, a footer column reduces
 * per group, `summary` gets the group's rows in a box, and the row keyboard skips collapsed rows.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { Box } from '../../core/ports'
import type { StateHandle, TableState, UseDataTable } from '../contract'
import { col } from '../core/kinds'
import { specOf } from '../core/kinds-spec'
import { DataTable } from './data-table'
import { bodyItems, groupKey, toggled } from './group-row-model'
import { useDataTable } from '../use-data-table'

type Row = { id: string; room: string; floor: string; done: number }

const ROWS: Row[] = [
  { id: 'a', room: 'Kitchen', floor: 'Floor 2', done: 4 },
  { id: 'b', room: 'Hall', floor: 'Floor 1', done: 1 },
  { id: 'c', room: 'Bath', floor: 'Floor 2', done: 5 },
  { id: 'd', room: 'Study', floor: 'Floor 2', done: 2 },
  { id: 'e', room: 'Porch', floor: 'Floor 1', done: 3 },
]

const STATE: TableState = {
  v: 1,
  request: { q: '', filters: [], sort: [], page: 1, pageSize: 25 },
  display: { visibility: {} },
}

const written: TableState[] = []

function handleOf(initial: TableState): StateHandle<TableState> {
  return {
    use() {
      const [value, setValue] = useState(initial)
      return [
        value,
        (next: TableState) => {
          written.push(next)
          setValue(next)
        },
      ]
    },
  }
}

function Subject({
  id: fixedId,
  summary,
  state = STATE,
  onRowActivate,
}: {
  id?: string
  summary?: (rows: readonly Row[], box: Box) => ReactNode
  state?: TableState
  onRowActivate?: (row: Row) => void
}): ReactElement {
  const [ownId] = useState(() => `g-${Math.random()}`)
  const id = fixedId ?? ownId
  const c = col<Row>()
  const t = useDataTable<Row>({
    id,
    label: 'Rooms',
    columns: [c.entity('room'), c.text('floor'), c.number('done', { footer: 'sum' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    state: handleOf(state),
    group: { by: 'floor', ...(summary !== undefined && { summary }) },
    ...(onRowActivate !== undefined && { onRowActivate }),
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

const groupRows = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('tbody tr[data-group]'),
]
const dataRows = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('tbody tr:not([data-group])')].map(
    (tr) => tr.querySelector('[data-kind="entity"]')?.textContent ?? '',
  )

const toggleOf = (value: string): HTMLElement => {
  const button = screen
    .getAllByRole('button')
    .find((b) => b.closest('[data-slot="table-group"]') !== null && b.textContent?.includes(value))
  if (button === undefined) throw new Error(`no toggle for ${value}`)
  return button
}

afterEach(() => {
  cleanup()
  written.length = 0
})

describe('bodyItems', () => {
  test('groups in first-seen order and keeps the row order inside a group', () => {
    const c = col<Row>()
    const by = specOf(c.text('floor'))
    const rows = ROWS.map((original) => ({ id: original.id, original }))
    const items = bodyItems(rows, by, ['Floor 1'])
    expect(items.map((i) => i.key)).toEqual([
      groupKey('Floor 2'),
      'a',
      'c',
      'd',
      groupKey('Floor 1'),
    ])
    expect(toggled(['Floor 1'], 'Floor 1')).toEqual([])
    expect(toggled(undefined, 'Floor 2')).toEqual(['Floor 2'])
  })
})

describe('GroupRow', () => {
  test('one group row per value with its count, above its rows', () => {
    const { container } = render(<Subject />)
    const groups = groupRows(container)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.textContent).toContain('Floor 2')
    expect(groups[0]?.textContent).toContain('3 rows')
    expect(groups[1]?.textContent).toContain('2 rows')
    expect(dataRows(container)).toEqual(['Kitchen', 'Bath', 'Study', 'Hall', 'Porch'])
  })

  test('a footer column reduces over the group, the table footer over every row', () => {
    const { container } = render(<Subject />)
    const [floor2, floor1] = groupRows(container)
    expect(floor2?.querySelector('[data-kind="number"]')?.textContent).toBe('11')
    expect(floor1?.querySelector('[data-kind="number"]')?.textContent).toBe('4')
    expect(container.querySelector('tfoot [data-kind="number"] dd')?.textContent).toBe('15')
  })

  test('collapse hides the rows of its group and never touches the request', async () => {
    const { container } = render(<Subject />)
    const before = written.length
    await act(async () => {
      fireEvent.click(toggleOf('Floor 2'))
    })
    expect(dataRows(container)).toEqual(['Hall', 'Porch'])
    expect(groupRows(container)[0]?.hasAttribute('data-collapsed')).toBe(true)
    expect(toggleOf('Floor 2').getAttribute('aria-expanded')).toBe('false')
    // display.collapsed is the device lane: a collapse never writes the request, never refetches.
    expect(written.length).toBe(before)
    await act(async () => {
      fireEvent.click(toggleOf('Floor 2'))
    })
    expect(dataRows(container)).toEqual(['Kitchen', 'Bath', 'Study', 'Hall', 'Porch'])
  })

  test('the collapsed set survives a remount of the same table', async () => {
    const id = `g-keep-${Math.random()}`
    const first = render(<Subject id={id} />)
    await act(async () => {
      fireEvent.click(toggleOf('Floor 1'))
    })
    first.unmount()
    const { container } = render(<Subject id={id} />)
    expect(dataRows(container)).toEqual(['Kitchen', 'Bath', 'Study'])
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(1)
  })

  test('summary renders in a box with the group rows', () => {
    const summary = mock((rows: readonly Row[], box: Box) => (
      <span data-testid="summary">{`${rows.filter((r) => r.done >= 4).length}/${rows.length} at ${box.height}`}</span>
    ))
    render(<Subject summary={summary} />)
    expect(screen.getAllByTestId('summary').map((n) => n.textContent)).toEqual([
      '2/3 at 24',
      '0/2 at 24',
    ])
  })

  test('the row keyboard walks the visible rows in group order', async () => {
    const { container } = render(<Subject onRowActivate={() => undefined} />)
    await act(async () => {
      fireEvent.click(toggleOf('Floor 2'))
    })
    const stop = container.querySelector<HTMLElement>('tbody tr[tabindex="0"]')
    expect(stop?.textContent).toContain('Hall')
    if (stop === null) throw new Error('no stop')
    fireEvent.keyDown(stop, { key: 'ArrowDown' })
    const next = container.querySelector<HTMLElement>('tbody tr[tabindex="0"]')
    expect(next?.textContent).toContain('Porch')
  })

  test('the group row height is the table row height', () => {
    const { container } = render(<Subject />)
    const group = groupRows(container)[0]
    const row = container.querySelector('tbody tr:not([data-group])')
    expect(group?.className).toContain('h-(--table-row-h)')
    expect(row?.className).toContain('h-(--table-row-h)')
    expect(group?.querySelector('[data-slot="table-group"]')?.className).toContain(
      'whitespace-nowrap',
    )
  })

  const PAGED_ID = `g-paged-${Math.random()}`
  test('under a client pager a group counts and reduces every matching row, not the page', () => {
    const paged = { ...STATE, request: { ...STATE.request, pageSize: 2 } }
    function Paged(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: PAGED_ID,
        label: 'Rooms',
        columns: [c.entity('room'), c.text('floor'), c.number('done', { footer: 'sum' })],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        pager: 'pages',
        state: handleOf(paged),
        group: { by: 'floor' },
      })
      return <DataTable table={t} />
    }
    const { container } = render(<Paged />)
    // Page 1 holds Kitchen and Hall; Floor 2 has three rooms in all, Floor 1 two.
    expect(dataRows(container)).toEqual(['Kitchen', 'Hall'])
    const [floor2, floor1] = groupRows(container)
    expect(floor2?.textContent).toContain('3 rows')
    expect(floor2?.querySelector('[data-kind="number"]')?.textContent).toBe('11')
    expect(floor1?.textContent).toContain('2 rows')
    expect(floor1?.querySelector('[data-kind="number"]')?.textContent).toBe('4')
  })

  test('an unknown group column throws naming it', () => {
    function Bad(): ReactElement {
      const c = col<Row>()
      const t = useDataTable<Row>({
        id: 'bad',
        label: 'Bad',
        columns: [c.entity('room')],
        data: ROWS,
        getRowId: (r) => r.id,
        mode: { kind: 'client' },
        group: { by: 'floor' },
      })
      return <DataTable table={t} />
    }
    const spy = mock(() => undefined)
    const original = console.error
    console.error = spy
    try {
      expect(() => render(<Bad />)).toThrow(/group\.by "floor" is not a column/)
    } finally {
      console.error = original
    }
  })
})
