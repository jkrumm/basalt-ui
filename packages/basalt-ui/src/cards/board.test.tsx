import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { useState } from 'react'
import type { ReactElement } from 'react'
import type { DragData, DragEdge, DragLike } from '../core/ports'
import { VirtualList } from '../ui/virtual-list'
import { applyMove, Board } from './board'
import type { BoardProps } from './board'
import type { Move } from './contract'
import { KanbanCard } from './kanban-card'

type Col = 'todo' | 'doing' | 'done'
type Card = { id: string; title: string }

const COLUMNS: BoardProps<Col, Card>['columns'] = [
  { id: 'todo', label: 'To do', tone: 'neutral' },
  { id: 'doing', label: 'Doing', tone: 'info', total: '$1,200' },
  { id: 'done', label: 'Done', tone: 'good' },
]

const cards = (prefix: string, n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, title: `${prefix} card ${i}` }))

/** A `DragLike` the test drives by hand: what a native drag reports, without the browser. */
function fakeDrag() {
  type Item = Parameters<DragLike['item']>[0]
  type Target = Parameters<DragLike['target']>[0]
  type Watch = Parameters<DragLike['watch']>[0]
  const items = new Map<HTMLElement, Item>()
  const targets = new Map<HTMLElement, Target>()
  const watchers = new Set<Watch>()
  const engine: DragLike = {
    item: (o) => (items.set(o.element, o), () => void items.delete(o.element)),
    target: (o) => (targets.set(o.element, o), () => void targets.delete(o.element)),
    watch: (o) => (watchers.add(o), () => void watchers.delete(o)),
  }
  const itemOf = (id: string): HTMLElement => {
    const el = document
      .querySelector<HTMLElement>(`[data-card-id="${id}"]`)
      ?.closest<HTMLElement>('[data-slot="board-item"]')
    if (!el) throw new Error(`no item ${id}`)
    return el
  }
  const columnOf = (col: Col): HTMLElement =>
    document.querySelector<HTMLElement>(`[data-slot="board-column"][data-column="${col}"]`)!
  let source: DragData | null = null
  let sourceItem: Item | undefined
  return {
    engine,
    items,
    targets,
    start(id: string): void {
      sourceItem = items.get(itemOf(id))
      source = sourceItem!.data
      act(() => {
        sourceItem!.onDrag?.(true)
        for (const w of watchers) w.onStart?.(source!)
      })
    },
    hover(on: { card: string } | { column: Col }, edge: DragEdge | null): void {
      const el = 'card' in on ? itemOf(on.card) : columnOf(on.column)
      act(() => targets.get(el)?.onHover?.(edge))
    },
    drop(on: { card: string; edge: DragEdge } | { column: Col } | null): void {
      const el = on === null ? null : 'card' in on ? itemOf(on.card) : columnOf(on.column)
      const target = el === null ? null : (targets.get(el)?.data ?? null)
      const edge = on !== null && 'edge' in on ? on.edge : null
      act(() => {
        sourceItem?.onDrag?.(false)
        for (const w of watchers) w.onDrop({ source: source!, target, edge })
      })
    },
    itemOf,
    columnOf,
  }
}

let moves: Move<Col>[] = []

function Harness({
  drag,
  initial,
  virtual,
  active,
}: {
  drag?: DragLike
  initial: Record<Col, Card[]>
  virtual?: boolean
  active?: Col
}): ReactElement {
  const [items, setItems] = useState(initial)
  return (
    <Board
      label="Issues"
      columns={COLUMNS}
      items={items}
      drag={drag}
      active={active}
      virtual={virtual === true ? { list: VirtualList, cardHeight: 80 } : undefined}
      onMove={(m) => {
        moves.push(m)
        setItems((prev) => applyMove(prev, m))
      }}
      card={(item, move) => <KanbanCard id={item.id} title={item.title} move={move} />}
    />
  )
}

const order = (col: Col): string[] =>
  [...document.querySelectorAll(`[data-column="${col}"] [data-slot="kanban-card"]`)].map(
    (el) => el.getAttribute('data-card-id') ?? '',
  )

const base = (): Record<Col, Card[]> => ({ todo: cards('a', 3), doing: cards('b', 2), done: [] })

afterEach(() => {
  cleanup()
  moves = []
})

describe('Board columns', () => {
  test('draws a header per column: tone dot, name, count, total, and an empty placeholder', () => {
    const { container } = render(<Harness initial={base()} />)
    const heads = [...container.querySelectorAll('[data-slot="board-column"] header')].map(
      (h) => h.textContent,
    )
    expect(heads).toEqual(['To do3', 'Doing2$1,200', 'Done0'])
    expect(container.querySelectorAll('[data-slot="board-empty"]')).toHaveLength(1)
    expect(
      container.querySelector('[data-column="done"] [data-slot="board-empty"]')?.textContent,
    ).toBe('No cards')
    expect(container.querySelector('[data-column="doing"] h3')?.className).toContain(
      'before:bg-info',
    )
  })

  test('marks only the active column shown, for the one-column tier', () => {
    const { container } = render(<Harness initial={base()} active="doing" />)
    const shown = [...container.querySelectorAll('[data-slot="board-column"][data-shown]')]
    expect(shown.map((s) => s.getAttribute('data-column'))).toEqual(['doing'])
  })

  test('below the regular tier a switch picks the shown column, and reports it', () => {
    const picked: Col[] = []
    const { container } = render(
      <Board
        label="Issues"
        columns={COLUMNS}
        items={base()}
        onActiveChange={(c) => picked.push(c)}
        onMove={() => undefined}
        card={(item, move) => <KanbanCard id={item.id} title={item.title} move={move} />}
      />,
    )
    const shown = (): (string | null)[] =>
      [...container.querySelectorAll('[data-slot="board-column"][data-shown]')].map((s) =>
        s.getAttribute('data-column'),
      )
    expect(shown()).toEqual(['todo'])
    const doing = [...container.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.textContent === 'Doing',
    )!
    fireEvent.click(doing)
    expect(shown()).toEqual(['doing'])
    expect(picked).toEqual(['doing'])
  })

  test('the board scrolls sideways through the scroll primitive, named by its label', () => {
    const { container } = render(<Harness initial={base()} />)
    const region = container.querySelector('[data-slot="scroll-area"]')
    expect(region?.getAttribute('aria-label')).toBe('Issues')
  })
})

describe('Board drag', () => {
  test('a drop within a column calls onMove with the final index', () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a0')
    d.drop({ card: 'a2', edge: 'after' })
    expect(moves).toEqual([{ id: 'a0', from: 'todo', to: 'todo', index: 2 }])
    expect(order('todo')).toEqual(['a1', 'a2', 'a0'])
  })

  test('a drop before the card below is no move', () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a0')
    d.drop({ card: 'a1', edge: 'before' })
    expect(moves).toEqual([])
  })

  test('a drop between columns lands at the slot, and on a column it appends', () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a1')
    d.drop({ card: 'b0', edge: 'after' })
    expect(moves.at(-1)).toEqual({ id: 'a1', from: 'todo', to: 'doing', index: 1 })
    expect(order('doing')).toEqual(['b0', 'a1', 'b1'])
    d.start('b1')
    d.drop({ column: 'done' })
    expect(moves.at(-1)).toEqual({ id: 'b1', from: 'doing', to: 'done', index: 0 })
    expect(order('done')).toEqual(['b1'])
  })

  test('a drop on nothing moves nothing', () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a1')
    d.drop(null)
    expect(moves).toEqual([])
  })

  test('the source card is marked dragging, the hovered column takes its drop state', () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a0')
    const card = document.querySelector('[data-card-id="a0"]')!
    expect(card.hasAttribute('data-dragging')).toBe(true)
    d.hover({ column: 'doing' }, 'before')
    d.hover({ card: 'b1' }, 'after')
    expect(d.columnOf('doing').hasAttribute('data-over')).toBe(true)
    expect(d.itemOf('b1').getAttribute('data-edge')).toBe('after')
    d.hover({ column: 'doing' }, null)
    d.hover({ card: 'b1' }, null)
    d.drop(null)
    expect(d.columnOf('doing').hasAttribute('data-over')).toBe(false)
    expect(document.querySelector('[data-card-id="a0"]')!.hasAttribute('data-dragging')).toBe(false)
  })

  test('a drag and the menu produce the same Move', async () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a0')
    d.drop({ column: 'doing' })
    const dropped = moves.pop()
    cleanup()
    render(<Harness initial={base()} />)
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-card-id="a0"] [data-slot="kanban-menu"]',
    )!
    fireEvent.pointerEnter(trigger)
    fireEvent.click(trigger)
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    const to = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (el) => el.textContent === 'Move to Doing',
    )!
    fireEvent.click(to)
    expect(moves).toEqual([dropped!])
  })

  test('a disabled column registers no target and its cards stay draggable', () => {
    const d = fakeDrag()
    render(
      <Board
        label="Issues"
        columns={[COLUMNS[0]!, { ...COLUMNS[1]!, disabled: true }]}
        items={{ todo: cards('a', 1), doing: cards('b', 1) } as Record<Col, Card[]>}
        drag={d.engine}
        onMove={(m) => moves.push(m)}
        card={(item, move) => <KanbanCard id={item.id} title={item.title} move={move} />}
      />,
    )
    expect(d.targets.has(d.columnOf('doing'))).toBe(false)
    expect(d.items.has(d.itemOf('b0'))).toBe(true)
  })
})

describe('Board announcement and focus', () => {
  test('a move is said politely and focus returns to the moved card', async () => {
    const d = fakeDrag()
    render(<Harness drag={d.engine} initial={base()} />)
    d.start('a2')
    d.drop({ card: 'b0', edge: 'before' })
    const live = document.querySelector('[data-slot="board"] output')!
    expect(live.textContent).toBe('a card 2 moved to Doing, position 1 of 3')
    const menu = document.querySelector(
      '[data-column="doing"] [data-card-id="a2"] [data-slot="kanban-menu"]',
    )
    await waitFor(() => expect(document.activeElement).toBe(menu))
  })
})

describe('Board focus after a late move', () => {
  test('a parent that applies the move later still gets focus on the moved card', async () => {
    function Late(): ReactElement {
      const [items, setItems] = useState(base())
      return (
        <Board
          label="Issues"
          columns={COLUMNS}
          items={items}
          onMove={(m) => void setTimeout(() => setItems((prev) => applyMove(prev, m)), 50)}
          card={(item, move) => <KanbanCard id={item.id} title={item.title} move={move} />}
        />
      )
    }
    render(<Late />)
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-card-id="a0"] [data-slot="kanban-menu"]',
    )!
    fireEvent.pointerEnter(trigger)
    fireEvent.click(trigger)
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull())
    const down = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (el) => el.textContent === 'Move down',
    )!
    fireEvent.click(down)
    await waitFor(() =>
      expect(
        document.activeElement?.closest('[data-slot="board-item"]')?.getAttribute('data-index'),
      ).toBe('1'),
    )
    expect(document.activeElement?.closest('[data-card-id]')?.getAttribute('data-card-id')).toBe(
      'a0',
    )
  })
})

describe('Board virtual', () => {
  // happy-dom measures every box as 0, which virtual-core reads as "nothing visible".
  // virtual-core reads offsetHeight up to 3.19.5 and clientHeight from 3.19.6 on.
  const sizeProps = ['offsetHeight', 'clientHeight'] as const
  const originals = sizeProps.map(
    (p) => [p, Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)] as const,
  )
  beforeEach(() => {
    for (const p of sizeProps) {
      Object.defineProperty(HTMLElement.prototype, p, {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset['slot'] === 'virtual-list' ? 640 : 0
        },
      })
    }
  })
  afterEach(() => {
    for (const [p, original] of originals) {
      if (original) Object.defineProperty(HTMLElement.prototype, p, original)
      else Reflect.deleteProperty(HTMLElement.prototype, p)
    }
  })

  test('a column of 500 cards stays windowed while a card is dragged, and keeps the source mounted', () => {
    const d = fakeDrag()
    const initial = { todo: cards('a', 500), doing: cards('b', 2), done: [] }
    render(<Harness drag={d.engine} initial={initial} virtual />)
    const mounted = (): number => order('todo').length
    expect(mounted()).toBeGreaterThan(0)
    expect(mounted()).toBeLessThan(40)
    d.start('a3')
    const scroller = d.columnOf('todo').querySelector<HTMLElement>('[data-slot="virtual-list"]')!
    act(() => {
      scroller.scrollTop = 450 * 90
      fireEvent.scroll(scroller)
    })
    expect(mounted()).toBeLessThan(40)
    expect(order('todo')).toContain('a3')
    d.drop({ column: 'doing' })
    expect(moves).toEqual([{ id: 'a3', from: 'todo', to: 'doing', index: 2 }])
  })
})

describe('applyMove', () => {
  test('moves within and between columns and leaves the input untouched', () => {
    const start = base()
    const within = applyMove(start, { id: 'a0', from: 'todo', to: 'todo', index: 2 })
    expect(within.todo.map((c) => c.id)).toEqual(['a1', 'a2', 'a0'])
    const across = applyMove(start, { id: 'a1', from: 'todo', to: 'done', index: 0 })
    expect(across.todo.map((c) => c.id)).toEqual(['a0', 'a2'])
    expect(across.done.map((c) => c.id)).toEqual(['a1'])
    expect(start.todo.map((c) => c.id)).toEqual(['a0', 'a1', 'a2'])
  })

  test('an unknown card is no change', () => {
    const next = applyMove(base(), { id: 'zz', from: 'todo', to: 'done', index: 0 })
    expect(next).toEqual(base())
  })
})

describe('the drag library', () => {
  test('only ui/sortable-list imports @atlaskit/pragmatic-drag-and-drop', () => {
    const src = join(import.meta.dirname, '..')
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const path = join(dir, f)
        return statSync(path).isDirectory() ? walk(path) : [path]
      })
    const offenders = walk(src)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) =>
        /(?:from |import\()'@atlaskit\/pragmatic-drag-and-drop/.test(readFileSync(f, 'utf8')),
      )
      .map((f) => relative(src, f))
    expect(offenders).toEqual(['ui/sortable-list.tsx'])
  })
})
