import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { Board } from './board'
import type { BoardProps } from './board'
import { createLocalStore, field } from '../state'
import { isSafeHref, moveOnBoard } from './board-nav'
import { SizeClassHintContext } from '../shell/use-size-class'
import type { SizeClass } from '../shell/use-size-class'

const realMatchMedia = window.matchMedia

/** A fixed viewport width: every `(min-width: Nem)` query answers against it. */
function viewport(px: number): void {
  window.matchMedia = (query: string): MediaQueryList => {
    const minEm = Number(/min-width: ([\d.]+)em/.exec(query)?.[1])
    return {
      matches: px >= minEm * 16,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList
  }
}

afterEach(() => {
  cleanup()
  window.matchMedia = realMatchMedia
})

type ColumnId = 'needs' | 'working' | 'blocked' | 'done'

const COLUMNS: BoardProps<ColumnId>['columns'] = [
  {
    id: 'needs',
    title: 'Needs you',
    total: '3 items',
    cards: [
      { id: 'a', actor: 'warden', type: 'PR review', title: 'Alpha', status: 'Waiting 2 h' },
      { id: 'b', title: 'Bravo', record: { label: '#482', href: 'https://example.com/482' } },
      { id: 'c', title: 'Charlie' },
    ],
  },
  { id: 'working', title: 'Working', cards: [{ id: 'd', title: 'Delta' }] },
  { id: 'blocked', title: 'Blocked', empty: 'Nothing is blocked', cards: [] },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'e', title: 'Echo' },
      { id: 'f', title: 'Foxtrot' },
    ],
  },
]

const mount = (props: Partial<BoardProps> = {}, size: SizeClass = 'expanded') => {
  viewport(size === 'compact' ? 390 : 1440)
  return render(
    <MantineProvider>
      <SizeClassHintContext.Provider value={size}>
        <Board label="Warden" columns={COLUMNS} {...props} />
      </SizeClassHintContext.Provider>
    </MantineProvider>,
  )
}

const button = (c: HTMLElement, title: string): HTMLButtonElement => {
  const found = [...c.querySelectorAll('button[type="button"]')].find(
    (b) => b.textContent === title,
  )
  if (!(found instanceof HTMLButtonElement)) throw new Error(`no card ${title}`)
  return found
}

describe('Board', () => {
  test('columns are named groups with a count, total and a list of cards', () => {
    const { container } = mount()
    const groups = container.querySelectorAll('[role="group"]')
    expect(groups).toHaveLength(4)
    expect(groups[0]?.textContent).toContain('Needs you')
    expect(groups[0]?.textContent).toContain('3 items')
    expect(container.querySelectorAll('li')).toHaveLength(6)
  })

  test('the board is one tab stop: only the first card is tabbable', () => {
    const { container } = mount()
    const stops = [...container.querySelectorAll('button[type="button"]')].filter(
      (b) => b.getAttribute('tabindex') === '0',
    )
    expect(stops.map((b) => b.textContent)).toEqual(['Alpha'])
  })

  test('ArrowDown/Up and Home/End move within a column and announce', () => {
    const { container } = mount()
    button(container, 'Alpha').focus()
    fireEvent.keyDown(button(container, 'Alpha'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(button(container, 'Bravo'))
    expect(container.querySelector('output')?.textContent).toBe('Needs you, card 2 of 3: Bravo')
    fireEvent.keyDown(button(container, 'Bravo'), { key: 'End' })
    expect(document.activeElement).toBe(button(container, 'Charlie'))
    fireEvent.keyDown(button(container, 'Charlie'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(button(container, 'Charlie'))
    fireEvent.keyDown(button(container, 'Charlie'), { key: 'Home' })
    expect(document.activeElement).toBe(button(container, 'Alpha'))
  })

  test('ArrowRight/Left skip an empty column and land on the nearest index', () => {
    const { container } = mount()
    fireEvent.keyDown(button(container, 'Bravo'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(button(container, 'Delta'))
    fireEvent.keyDown(button(container, 'Delta'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(button(container, 'Echo'))
    fireEvent.keyDown(button(container, 'Echo'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(button(container, 'Delta'))
  })

  test('the roving stop follows focus', () => {
    const { container } = mount()
    fireEvent.keyDown(button(container, 'Alpha'), { key: 'ArrowRight' })
    expect(button(container, 'Delta').getAttribute('tabindex')).toBe('0')
    expect(button(container, 'Alpha').getAttribute('tabindex')).toBe('-1')
  })

  test('Enter-equivalent click and keyboard activation call onOpen with card and column', () => {
    const onOpen = mock()
    const { container } = mount({ onOpen })
    fireEvent.click(button(container, 'Echo'))
    expect(onOpen).toHaveBeenCalledWith('e', 'done')
  })

  test('Enter and Space are left to the button, so its native activation opens the card', () => {
    // happy-dom does not turn a keydown into a click; the real press is in board.layout.test.ts.
    const { container } = mount()
    for (const key of ['Enter', ' ']) {
      expect(fireEvent.keyDown(button(container, 'Alpha'), { key })).toBe(true)
    }
  })

  test.each([
    ['https://x.test/a', true],
    ['HTTPS://x.test/a', true],
    ['http://x.test', true],
    ['/pr/1', true],
    ['./pr/1', true],
    ['../pr/1', true],
    ['#top', true],
    ['?q=1', true],
    ['//evil.test', false],
    ['/\\evil.test', false],
    ['\\evil.test', false],
    ['javascript:alert(1)', false],
    [' javascript:alert(1)', false],
    [' https://x.test', false],
    ['mailto:a@b.test', false],
    ['data:text/html,x', false],
    ['', false],
  ])('isSafeHref(%j) is %p', (href, safe) => {
    expect(isSafeHref(href)).toBe(safe)
  })

  test('only http(s) and relative record hrefs render as links', () => {
    const { container } = mount({
      columns: [
        {
          id: 'x',
          title: 'X',
          cards: [
            { id: '1', title: 'One', record: { label: 'bad', href: 'javascript:alert(1)' } },
            { id: '2', title: 'Two', record: { label: 'good', href: '/pr/2' } },
          ],
        },
      ],
    })
    const links = [...container.querySelectorAll('a')]
    expect(links.map((a) => a.textContent)).toEqual(['good'])
  })

  test('an empty column shows its line', () => {
    const { container } = mount()
    expect(container.textContent).toContain('Nothing is blocked')
  })

  test('an empty column is an EmptyState tile (a ring-edged title, not a bare line)', () => {
    const { getByText } = mount()
    const tile = getByText('Nothing is blocked').parentElement
    expect(tile?.getAttribute('style') ?? '').toContain('box-shadow')
  })

  test('an empty board renders the tile; loading renders skeletons', () => {
    const empty = mount({
      columns: COLUMNS.map((c) => ({ ...c, cards: [] })),
      empty: { title: 'All clear', description: 'Nothing needs you.' },
    })
    expect(empty.container.textContent).toContain('All clear')
    expect(empty.container.querySelectorAll('li')).toHaveLength(0)
    cleanup()
    const loading = mount({ loading: true })
    expect(loading.container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(loading.container.querySelectorAll('li')).toHaveLength(0)
    expect(loading.container.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0)
  })

  test('compact loading keeps the column switcher, inert, with the column titles', () => {
    const { container, getByLabelText } = mount({ loading: true }, 'compact')
    const switcher = getByLabelText('Warden column')
    expect(switcher).toBeTruthy()
    expect(container.querySelectorAll('input[type="radio"][disabled]').length).toBeGreaterThan(0)
    expect(container.textContent).toContain('Needs you')
  })

  test('compact shows one column under a switcher and switches', () => {
    const { container, getByLabelText } = mount({}, 'compact')
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(1)
    const switcher = getByLabelText('Warden column')
    expect(switcher.textContent).toContain('Needs you 3')
    expect(switcher.textContent).toContain('Blocked 0')
    const done = [...container.querySelectorAll('input[type="radio"]')].find(
      (i) => i.getAttribute('value') === 'done',
    )
    fireEvent.click(done as Element)
    expect(container.querySelector('[role="group"]')?.textContent).toContain('Echo')
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(1)
  })

  test('compact ArrowRight switches to the adjacent non-empty column and focuses', () => {
    const { container } = mount({}, 'compact')
    fireEvent.keyDown(button(container, 'Alpha'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(button(container, 'Delta'))
  })
})

const tabStops = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('button[type="button"]')]
    .filter((b) => b.getAttribute('tabindex') === '0')
    .map((b) => b.textContent ?? '')

describe('Board field', () => {
  test('compact keeps exactly one tab stop in the rendered column, whatever the field holds', () => {
    const store = createLocalStore({
      key: 'board-test-stop',
      fields: { column: field.enum(['needs', 'working', 'blocked', 'done'] as const, 'done') },
    })
    viewport(390)
    const { container } = render(
      <MantineProvider>
        <SizeClassHintContext.Provider value="compact">
          <Board label="Warden" columns={COLUMNS} field={store.field.column} />
        </SizeClassHintContext.Provider>
      </MantineProvider>,
    )
    expect(tabStops(container)).toEqual(['Echo'])
    const radio = (value: string): Element =>
      [...container.querySelectorAll('input[type="radio"]')].find(
        (i) => i.getAttribute('value') === value,
      ) as Element
    fireEvent.click(radio('needs'))
    expect(tabStops(container)).toEqual(['Alpha'])
    // Focus a card, then switch with the control: the stop moves to the new column's first card.
    fireEvent.focus(button(container, 'Bravo'))
    expect(tabStops(container)).toEqual(['Bravo'])
    fireEvent.click(radio('working'))
    expect(tabStops(container)).toEqual(['Delta'])
  })

  test('a switcher pick writes the clicked column id to the store field', () => {
    const store = createLocalStore({
      key: 'board-test-writeback',
      fields: { column: field.enum(['needs', 'working', 'blocked', 'done'] as const, 'needs') },
    })
    viewport(390)
    const { container } = render(
      <MantineProvider>
        <SizeClassHintContext.Provider value="compact">
          <Board label="Warden" columns={COLUMNS} field={store.field.column} />
        </SizeClassHintContext.Provider>
      </MantineProvider>,
    )
    const done = [...container.querySelectorAll('input[type="radio"]')].find(
      (i) => i.getAttribute('value') === 'done',
    )
    fireEvent.click(done as Element)
    expect(store.readStored().column).toBe('done')
  })

  test('a store field owns the selected column in compact', () => {
    const store = createLocalStore({
      key: 'board-test-column',
      fields: { column: field.enum(['needs', 'working', 'blocked', 'done'] as const, 'working') },
    })
    viewport(390)
    const { container, getByLabelText } = render(
      <MantineProvider>
        <SizeClassHintContext.Provider value="compact">
          <Board label="Warden" columns={COLUMNS} field={store.field.column} />
        </SizeClassHintContext.Provider>
      </MantineProvider>,
    )
    expect(container.querySelector('[role="group"]')?.textContent).toContain('Delta')
    const done = [...container.querySelectorAll('input[type="radio"]')].find(
      (i) => i.getAttribute('value') === 'done',
    )
    fireEvent.click(done as Element)
    expect(getByLabelText('Warden column')).toBeTruthy()
    expect(container.querySelector('[role="group"]')?.textContent).toContain('Echo')
  })
})

describe('moveOnBoard', () => {
  test('returns null at the edges', () => {
    expect(moveOnBoard([2, 0], { col: 0, row: 0 }, 'ArrowUp')).toBeNull()
    expect(moveOnBoard([2, 0], { col: 0, row: 0 }, 'ArrowRight')).toBeNull()
    expect(moveOnBoard([2, 3], { col: 0, row: 1 }, 'ArrowRight')).toEqual({ col: 1, row: 1 })
    expect(moveOnBoard([3, 1], { col: 0, row: 2 }, 'ArrowRight')).toEqual({ col: 1, row: 0 })
  })
})
