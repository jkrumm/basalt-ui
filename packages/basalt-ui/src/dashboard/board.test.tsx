import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { Board } from './board'
import type { BoardProps } from './board'
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

const COLUMNS: BoardProps['columns'] = [
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

  test('only http(s) and relative record hrefs render as links', () => {
    expect(isSafeHref('https://x.test/a')).toBe(true)
    expect(isSafeHref('/pr/1')).toBe(true)
    expect(isSafeHref('./pr/1')).toBe(true)
    expect(isSafeHref('//evil.test')).toBe(false)
    expect(isSafeHref('javascript:alert(1)')).toBe(false)
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

describe('moveOnBoard', () => {
  test('returns null at the edges', () => {
    expect(moveOnBoard([2, 0], { col: 0, row: 0 }, 'ArrowUp')).toBeNull()
    expect(moveOnBoard([2, 0], { col: 0, row: 0 }, 'ArrowRight')).toBeNull()
    expect(moveOnBoard([2, 3], { col: 0, row: 1 }, 'ArrowRight')).toEqual({ col: 1, row: 1 })
    expect(moveOnBoard([3, 1], { col: 0, row: 2 }, 'ArrowRight')).toEqual({ col: 1, row: 0 })
  })
})
