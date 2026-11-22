import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { DragData, DragEdge, DragLike } from '../core/ports'
import { drag, SortableList } from './sortable-list'
import type { SortableMove } from './sortable-list'

type Row = { id: string; label: string }
const ROWS: Row[] = ['Home', 'Issues', 'Runs', 'Settings'].map((label) => ({
  id: label.toLowerCase(),
  label,
}))

const real = { ...drag }
type Item = Parameters<DragLike['item']>[0]
type Target = Parameters<DragLike['target']>[0]
type Watch = Parameters<DragLike['watch']>[0]
let items: Map<HTMLElement, Item>
let targets: Map<HTMLElement, Target>
let watchers: Set<Watch>
let moves: SortableMove[]

beforeEach(() => {
  items = new Map()
  targets = new Map()
  watchers = new Set()
  moves = []
  drag.item = (o) => (items.set(o.element, o), () => void items.delete(o.element))
  drag.target = (o) => (targets.set(o.element, o), () => void targets.delete(o.element))
  drag.watch = (o) => (watchers.add(o), () => void watchers.delete(o))
})
afterEach(() => {
  cleanup()
  Object.assign(drag, real)
})

function Harness(): ReactElement {
  const [rows, setRows] = useState(ROWS)
  return (
    <SortableList
      label="Sidebar"
      items={rows}
      itemLabel={(r) => r.label}
      onMove={(m) => {
        moves.push(m)
        setRows((prev) => prev.toSpliced(m.from, 1).toSpliced(m.to, 0, prev[m.from]!))
      }}
    >
      {(row) => <span>{row.label}</span>}
    </SortableList>
  )
}

const rowOf = (id: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-sortable="item"][data-id="${id}"]`)!
const handleOf = (id: string): HTMLButtonElement =>
  rowOf(id).querySelector<HTMLButtonElement>('[data-sortable="handle"]')!
const order = (): string[] =>
  [...document.querySelectorAll('[data-sortable="item"]')].map(
    (el) => el.getAttribute('data-id') ?? '',
  )

const dragRow = (id: string, over: string, edge: DragEdge | null): void => {
  const source = items.get(rowOf(id))!
  const target: DragData | null = targets.get(rowOf(over))?.data ?? null
  act(() => {
    source.onDrag?.(true)
    for (const w of watchers) w.onStart?.(source.data)
  })
  expect(rowOf(id).hasAttribute('data-dragging')).toBe(true)
  act(() => {
    targets.get(rowOf(over))?.onHover?.(edge)
  })
  if (edge !== null) expect(rowOf(over).getAttribute('data-edge')).toBe(edge)
  act(() => {
    targets.get(rowOf(over))?.onHover?.(null)
    source.onDrag?.(false)
    for (const w of watchers) w.onDrop({ source: source.data, target, edge })
  })
}

describe('SortableList', () => {
  test('names the list and each handle, and describes the keys', () => {
    render(<Harness />)
    expect(document.querySelector('[data-slot="sortable-list"]')?.getAttribute('aria-label')).toBe(
      'Sidebar',
    )
    const handle = handleOf('runs')
    expect(handle.getAttribute('aria-label')).toBe('Reorder Runs')
    const hint = document.getElementById(handle.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toBe('Drag, or press the up and down arrow keys to move')
  })

  test('the handle drags its row: the item registers with the handle', () => {
    render(<Harness />)
    expect(items.get(rowOf('home'))?.handle).toBe(handleOf('home'))
  })

  test('a drop after a lower row moves the row down to its final index', () => {
    render(<Harness />)
    dragRow('home', 'runs', 'after')
    expect(moves).toEqual([{ id: 'home', from: 0, to: 2 }])
    expect(order()).toEqual(['issues', 'runs', 'home', 'settings'])
  })

  test('a drop before an upper row moves the row up', () => {
    render(<Harness />)
    dragRow('settings', 'issues', 'before')
    expect(moves).toEqual([{ id: 'settings', from: 3, to: 1 }])
  })

  test('a drop on its own slot or on nothing is no move', () => {
    render(<Harness />)
    dragRow('issues', 'runs', 'before')
    dragRow('issues', 'issues', null)
    expect(moves).toEqual([])
  })

  test('arrow keys, Home and End on the handle reorder, announce and keep focus', async () => {
    render(<Harness />)
    const live = document.querySelector('output')!
    handleOf('issues').focus()
    fireEvent.keyDown(handleOf('issues'), { key: 'ArrowDown' })
    expect(order()).toEqual(['home', 'runs', 'issues', 'settings'])
    expect(live.textContent).toBe('Issues moved to position 3 of 4')
    await waitFor(() => expect(document.activeElement).toBe(handleOf('issues')))
    fireEvent.keyDown(handleOf('issues'), { key: 'Home' })
    expect(order()[0]).toBe('issues')
    fireEvent.keyDown(handleOf('issues'), { key: 'ArrowUp' })
    fireEvent.keyDown(handleOf('issues'), { key: 'End' })
    expect(order().at(-1)).toBe('issues')
    fireEvent.keyDown(handleOf('issues'), { key: 'ArrowDown' })
    expect(moves.map((m) => [m.from, m.to])).toEqual([
      [1, 2],
      [2, 0],
      [0, 3],
    ])
  })

  test('a modified arrow key is left to the page', () => {
    render(<Harness />)
    fireEvent.keyDown(handleOf('issues'), { key: 'ArrowDown', altKey: true })
    expect(moves).toEqual([])
  })

  test('a target takes a source from its own list only', () => {
    render(
      <>
        <Harness />
        <Harness />
      </>,
    )
    const lists = [...document.querySelectorAll('[data-slot="sortable-list"]')]
    const [a, b] = lists.map((l) => l.querySelector<HTMLElement>('[data-sortable="item"]')!)
    const source = items.get(a!)!
    act(() => {
      for (const w of watchers)
        w.onDrop({ source: source.data, target: targets.get(b!)!.data, edge: 'after' })
    })
    expect(moves).toEqual([])
  })
})
