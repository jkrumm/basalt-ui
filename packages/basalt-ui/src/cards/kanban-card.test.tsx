import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { ColumnRef, KanbanCardProps, Move } from './contract'
import { KanbanCard, menuChunk, resetKanbanWarnings } from './kanban-card'

type Col = 'todo' | 'doing' | 'done'

const COLUMNS: ColumnRef<Col>[] = [
  { id: 'todo', label: 'To do', count: 3 },
  { id: 'doing', label: 'Doing', count: 2 },
  { id: 'done', label: 'Done', count: 5 },
]
const realLoad = menuChunk.load

let moves: Move<Col>[]
const onMove = (m: Move<Col>): void => void moves.push(m)

const movable = (index: number, columns: ColumnRef<Col>[] = COLUMNS): KanbanCardProps<Col> => ({
  id: 'c1',
  title: 'Fix the cache key',
  move: { column: columns[0]!, index, columns, onMove },
})

const draw = (props: KanbanCardProps<Col>): ReturnType<typeof render> =>
  render(<KanbanCard {...props} />)

/** Polls a plain boolean: a failing `waitFor` on DOM state stalls under happy-dom. */
const until = async (done: () => boolean): Promise<void> => {
  for (let i = 0; i < 50 && !done(); i++) await new Promise((r) => setTimeout(r, 20))
  expect(done()).toBe(true)
}

const open = async (): Promise<string[]> => {
  const trigger = document.querySelector<HTMLButtonElement>('[data-slot="kanban-menu"]')!
  fireEvent.pointerEnter(trigger)
  fireEvent.click(trigger)
  await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
  return [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent ?? '')
}

beforeEach(() => {
  moves = []
  resetKanbanWarnings()
  menuChunk.load = realLoad
})
afterEach(cleanup)

describe('KanbanCard anatomy', () => {
  test('prints title, age, meta, chips, reason and the verdict', () => {
    const { container } = draw({
      ...movable(0),
      age: '2 h',
      href: '/issues/c1',
      meta: ['EP-412', 'Ada'],
      chips: [{ label: 'api' }, { label: 'p1' }],
      reason: { text: 'Waiting on CI' },
      status: { tone: 'warn', label: 'Blocked' },
    })
    const text = (slot: string): string[] =>
      [...container.querySelectorAll(`[data-slot="${slot}"]`)].map((el) => el.textContent ?? '')
    expect(text('kanban-title')).toEqual(['Fix the cache key'])
    expect(text('kanban-age')).toEqual(['2 h'])
    expect(text('kanban-meta')).toEqual(['EP-412', 'Ada'])
    expect(text('kanban-chips')).toEqual(['apip1'])
    expect(container.textContent).toContain('Waiting on CI')
    expect(text('stat-status')).toEqual(['Blocked'])
    expect(container.querySelector('[data-slot="kanban-target"]')?.getAttribute('href')).toBe(
      '/issues/c1',
    )
    expect(container.querySelector('[data-card-id="c1"]')).not.toBeNull()
  })

  test('two tab stops: the link and the menu', () => {
    const { container } = draw({ ...movable(1), href: '/issues/c1', age: '2 h' })
    const stops = container.querySelectorAll('a[href], button')
    expect([...stops].map((el) => el.getAttribute('data-slot'))).toEqual([
      'kanban-target',
      'kanban-menu',
    ])
  })

  test('without href there is no link, the menu stays', () => {
    const { container } = draw(movable(1))
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelectorAll('button')).toHaveLength(1)
  })

  test('data-dragging follows move.dragging', () => {
    const base = movable(0)
    const move = { ...(base.move as Exclude<typeof base.move, 'static'>), dragging: true }
    const { container } = draw({ ...base, move })
    expect(
      container.querySelector('[data-slot="kanban-card"]')?.hasAttribute('data-dragging'),
    ).toBe(true)
  })
})

describe('KanbanCard menu', () => {
  test('Enter opens Move up, Move down and one item per other column', async () => {
    draw(movable(1))
    expect(await open()).toEqual(['Move up', 'Move down', 'Move to Doing', 'Move to Done'])
  })

  test('the first card has no Move up, the last no Move down', async () => {
    draw(movable(0))
    expect(await open()).toEqual(['Move down', 'Move to Doing', 'Move to Done'])
    cleanup()
    draw(movable(2))
    expect(await open()).toEqual(['Move up', 'Move to Doing', 'Move to Done'])
  })

  test('every item sends one Move: in-column by one, another column appended at its count', async () => {
    draw(movable(1))
    const items = await open().then(() => [...document.querySelectorAll('[role="menuitem"]')])
    for (const label of ['Move up', 'Move down', 'Move to Doing', 'Move to Done']) {
      fireEvent.click(items.find((el) => el.textContent === label)!)
    }
    expect(moves).toEqual([
      { id: 'c1', from: 'todo', to: 'todo', index: 0 },
      { id: 'c1', from: 'todo', to: 'todo', index: 2 },
      { id: 'c1', from: 'todo', to: 'doing', index: 2 },
      { id: 'c1', from: 'todo', to: 'done', index: 5 },
    ])
  })

  test('a disabled column is not offered', async () => {
    const columns = COLUMNS.map((c) => (c.id === 'done' ? { ...c, disabled: true } : c))
    draw(movable(0, columns))
    expect(await open()).toEqual(['Move down', 'Move to Doing'])
  })

  test('the consumer menu follows the moves', async () => {
    const base = movable(0)
    draw({ ...base, menu: [{ label: 'Open in new tab', href: '/issues/c1' }] })
    expect(await open()).toEqual(['Move down', 'Move to Doing', 'Move to Done', 'Open in new tab'])
  })

  test('one action is a plain button and never loads the menu chunk', () => {
    let loads = 0
    menuChunk.load = () => (loads++, realLoad())
    const columns: ColumnRef<Col>[] = [COLUMNS[0]!, COLUMNS[1]!]
    const { container } = draw(movable(0, [{ ...columns[0]!, count: 1 }, columns[1]!]))
    const button = container.querySelector<HTMLButtonElement>('[data-slot="kanban-menu"]')!
    expect(button.getAttribute('aria-haspopup')).toBeNull()
    expect(button.getAttribute('aria-label')).toBe('Move to Doing: Fix the cache key')
    fireEvent.pointerEnter(button)
    fireEvent.click(button)
    expect(moves).toEqual([{ id: 'c1', from: 'todo', to: 'doing', index: 2 }])
    expect(loads).toBe(0)
  })

  test("'static' with no menu has no menu button; one link action is a plain link", () => {
    const { container } = draw({ id: 'c1', title: 'Read only', move: 'static' })
    expect(container.querySelector('[data-slot="kanban-menu"]')).toBeNull()
    cleanup()
    const linked = draw({
      id: 'c1',
      title: 'Read only',
      move: 'static',
      menu: [{ label: 'Open', href: '/x' }],
    })
    const link = linked.container.querySelector('a[data-slot="kanban-menu"]')
    expect(link?.getAttribute('href')).toBe('/x')
  })
})

describe('S6: the menu chunk is lazy', () => {
  const DELAY_MS = 150

  const delayed = (): void => {
    menuChunk.load = () =>
      new Promise((resolveLoad) => setTimeout(() => resolveLoad(realLoad()), DELAY_MS))
  }

  test('a pointer open with the chunk late keeps focus on the button, then opens', async () => {
    delayed()
    const { container } = draw(movable(1))
    const trigger = container.querySelector<HTMLButtonElement>('[data-slot="kanban-menu"]')!
    trigger.focus()
    fireEvent.pointerEnter(trigger)
    fireEvent.pointerDown(trigger)
    fireEvent.click(trigger)
    expect(document.activeElement === trigger).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role="menu"]')).toBeNull()
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'))
  })

  test('an Enter open with the chunk late keeps the keyboard, then arrows and Escape work', async () => {
    delayed()
    const { container } = draw(movable(1))
    const trigger = container.querySelector<HTMLButtonElement>('[data-slot="kanban-menu"]')!
    trigger.focus()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger) // what the browser does for Enter on a button
    expect(document.activeElement === trigger).toBe(true)
    await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('menuitem'))
    expect(document.activeElement?.textContent).toBe('Move up')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Move down'))
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await until(() => document.querySelector('[role="menu"]') === null)
    await until(() => document.activeElement === trigger)
  })

  test('the card module reaches ui/menu through import() only', () => {
    const src = join(import.meta.dir)
    const staticImports = (file: string): string[] =>
      [...readFileSync(file, 'utf8').matchAll(/^import (?!type)[^'"]*?from '(\.[^']+)'/gm)].map(
        (m) => m[1]!,
      )
    const seen = new Set<string>()
    const walk = (file: string): void => {
      if (seen.has(file)) return
      seen.add(file)
      for (const spec of staticImports(file)) {
        const base = resolve(dirname(file), spec)
        for (const ext of ['.tsx', '.ts']) {
          try {
            readFileSync(base + ext)
            walk(base + ext)
            break
          } catch {
            // not this extension
          }
        }
      }
    }
    walk(join(src, 'kanban-card.tsx'))
    const files = [...seen].map((f) => f.slice(f.indexOf('/src/')))
    expect(files.some((f) => f.endsWith('/ui/menu.tsx') || f.endsWith('/kanban-menu.tsx'))).toBe(
      false,
    )
    expect(readFileSync(join(src, 'kanban-card.tsx'), 'utf8')).toContain("import('./kanban-menu')")
  })
})

describe('dev assertion', () => {
  let warn: ReturnType<typeof spyOn<Console, 'warn'>>
  beforeEach(() => {
    warn = spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => warn.mockRestore())

  test("move 'static' inside a draggable wrapper warns once", () => {
    const card = <KanbanCard id="c1" title="Dragged" move="static" />
    render(<div draggable="true">{card}</div>)
    render(<div draggable="true">{card}</div>)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain("move is 'static'")
  })

  test('a movable card in a draggable wrapper, and a static card elsewhere, are quiet', () => {
    render(
      <div draggable="true">
        <KanbanCard {...movable(0)} />
      </div>,
    )
    render(<KanbanCard id="c2" title="Plain" move="static" />)
    expect(warn).not.toHaveBeenCalled()
  })
})
