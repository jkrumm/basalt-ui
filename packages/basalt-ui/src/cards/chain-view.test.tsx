/**
 * `ChainView`: one node per record placed by the layout, an edge per known blocker drawn as blocks
 * or done, the warn bar on a node waiting on an open blocker, a node's waits named for a reader,
 * the narrow nested list, and a focus shared with a list of the same records.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ReactElement } from 'react'
import { useChartFocus } from '../charts/focus'
import { ChainView } from './chain-view'
import type { ChainViewProps } from './chain-view'

type Task = { id: string; title: string; done: boolean; waitsOn: string[] }

const TASKS: Task[] = [
  { id: 'a', title: 'Provision', done: true, waitsOn: [] },
  { id: 'b', title: 'Network', done: false, waitsOn: ['a'] },
  { id: 'c', title: 'Export', done: false, waitsOn: ['a'] },
  { id: 'd', title: 'Backfill', done: false, waitsOn: ['b', 'c', 'ghost'] },
]

afterEach(cleanup)

const props = (over: Partial<ChainViewProps<Task>> = {}): ChainViewProps<Task> => ({
  label: 'Plan',
  nodes: TASKS,
  getId: (t) => t.id,
  waitsOn: (t) => t.waitsOn,
  face: (t) => ({ title: t.title, sub: t.id, done: t.done }),
  ...over,
})

const graph = (root: HTMLElement): HTMLElement =>
  root.querySelector<HTMLElement>('[data-slot="chain-graph"]')!
const node = (root: HTMLElement, id: string): HTMLElement =>
  graph(root).querySelector<HTMLElement>(`[data-slot="chain-node"][data-id="${id}"]`)!

describe('ChainView', () => {
  test('one node per record and one edge per known blocker, drawn as blocks or done', () => {
    const { container } = render(<ChainView {...props()} />)
    expect(graph(container).querySelectorAll('[data-slot="chain-node"]')).toHaveLength(4)
    const edges = [...graph(container).querySelectorAll('[data-slot="chain-edge"]')]
    // a>b, a>c (done: a is done), b>d, c>d (blocks); the unknown blocker draws nothing.
    expect(edges.map((e) => e.getAttribute('data-state')).toSorted()).toEqual([
      'blocks',
      'blocks',
      'done',
      'done',
    ])
  })

  test('a node waiting on an open blocker is marked blocked; one whose blockers are done is not', () => {
    const { container } = render(<ChainView {...props()} />)
    const blocked = (id: string) => node(container, id).querySelector('[data-blocked]') !== null
    expect(blocked('d')).toBe(true)
    expect(blocked('b')).toBe(false)
    expect(blocked('a')).toBe(false)
  })

  test('a reader hears what a node waits on', () => {
    const { container } = render(<ChainView {...props()} />)
    expect(node(container, 'd').textContent).toContain('Waits on Network, Export')
  })

  test('the narrow list nests each node under its first blocker and names the rest', () => {
    const { container } = render(<ChainView {...props()} />)
    const list = [...container.querySelectorAll<HTMLElement>('[data-slot="chain-list-node"]')]
    expect(list.map((li) => li.getAttribute('data-level'))).toEqual(['1', '2', '3', '2'])
    expect(list[2]?.textContent).toContain('Also waits on Export')
  })

  test('a node activates through onActivate', () => {
    const onActivate = mock(() => undefined)
    const { container } = render(<ChainView {...props({ onActivate })} />)
    fireEvent.click(node(container, 'c').querySelector('button')!)
    expect(onActivate).toHaveBeenCalledWith(TASKS[2])
  })

  test('with a shared focus the graph is one tab stop whose Enter activates the focused node; the narrow list stays tabbable', () => {
    const onActivate = mock(() => undefined)
    function Shared(): ReactElement {
      const focus = useChartFocus(TASKS, { announce: (t) => t.title })
      return <ChainView {...props({ focus, onActivate })} />
    }
    const { container } = render(<Shared />)
    const list = graph(container).querySelector<HTMLElement>('ul')!
    expect(list.tabIndex).toBe(0)
    expect(node(container, 'b').querySelector('button')?.tabIndex).toBe(-1)
    act(() => {
      fireEvent.pointerEnter(node(container, 'c'))
    })
    act(() => {
      fireEvent.keyDown(list, { key: 'Enter' })
    })
    expect(onActivate).toHaveBeenCalledWith(TASKS[2])
    const narrow = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-slot="chain-list"] button'),
    ]
    expect(narrow.length).toBe(4)
    for (const button of narrow) expect(button.tabIndex).toBe(0)
  })

  test('a shared focus marks the node, dims the edges that do not touch it, and a node sets it', () => {
    const seen: { index: number | null } = { index: null }
    function Shared(): ReactElement {
      // The focus items run in another order than the nodes: the chain maps them by id.
      const focus = useChartFocus(TASKS.toReversed(), { announce: (t) => t.title })
      seen.index = focus.index
      return <ChainView {...props({ focus })} />
    }
    const { container } = render(<Shared />)
    act(() => {
      fireEvent.pointerEnter(node(container, 'b'))
    })
    expect(seen.index).toBe(2)
    expect(node(container, 'b').hasAttribute('data-focused')).toBe(true)
    const lit = [...graph(container).querySelectorAll('[data-slot="chain-edge"]')].filter(
      (e) => e.getAttribute('opacity') === '1',
    )
    expect(lit).toHaveLength(2)
  })
})
