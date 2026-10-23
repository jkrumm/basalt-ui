import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test } from 'bun:test'
import { StatusDot } from '../theme/status-dot'
import { StatusVerdict } from '../theme/status-verdict'
import { BarList } from './bar-list'
import { DeltaBadge } from './delta-badge'
import type { BarListProps } from './bar-list'

afterEach(cleanup)

function mount(props: BarListProps) {
  return render(
    <MantineProvider>
      <BarList {...props} />
    </MantineProvider>,
  )
}

const ITEMS = [
  { label: 'argo', value: 80, secondary: '40%' },
  { label: 'a-very-long-project-name-that-must-truncate-in-a-narrow-card', value: 40 },
  { label: 'rb', value: 20 },
]
const bars = (c: HTMLElement) => [
  ...c.querySelectorAll<HTMLElement>('li > [data-bar-track] > span[aria-hidden]'),
]

describe('BarList', () => {
  test('is a list with an accessible name and text values', () => {
    const { container, getByText } = mount({ label: 'Top projects', items: ITEMS })
    const ul = container.querySelector('ul') as HTMLElement
    expect(ul.getAttribute('aria-label')).toBe('Top projects')
    expect(ul.querySelectorAll('li').length).toBe(3)
    expect(getByText('80')).toBeTruthy()
    expect(getByText('40%')).toBeTruthy()
  })

  test('truncating labels carry the full text in title', () => {
    const { getByTitle } = mount({ label: 'L', items: ITEMS })
    expect(getByTitle(ITEMS[1]!.label)).toBeTruthy()
  })

  test('bars share one scale (max of values)', () => {
    const { container } = mount({ label: 'L', items: ITEMS })
    expect(bars(container).map((b) => b.style.width)).toEqual(['100%', '50%', '25%'])
  })

  test('an explicit max rescales every bar', () => {
    const { container } = mount({ label: 'L', items: ITEMS, max: 160 })
    expect(bars(container).map((b) => b.style.width)).toEqual(['50%', '25%', '12.5%'])
  })

  test('the accent leader is opt-in and only the first row', () => {
    const off = mount({ label: 'L', items: ITEMS })
    expect(off.container.querySelectorAll('[data-bar-leader]').length).toBe(0)
    cleanup()
    const on = mount({ label: 'L', items: ITEMS, accentLeader: true })
    const leaders = on.container.querySelectorAll('[data-bar-leader]')
    expect(leaders.length).toBe(1)
    expect(leaders[0]).toBe(bars(on.container)[0] as HTMLElement)
  })

  test('a fixed max=100 scales every contributor against 100 and keeps the level text', () => {
    const { container, getByText } = mount({
      label: 'Recovery contributors',
      max: 100,
      items: [
        { label: 'Sleep', value: 82, secondary: 'Good' },
        { label: 'HRV', value: 41, secondary: 'Low' },
      ],
    })
    expect(bars(container).map((b) => b.style.width)).toEqual(['82%', '41%'])
    expect(getByText('Good')).toBeTruthy()
    expect(getByText('Low')).toBeTruthy()
  })

  test('formats values', () => {
    const { getByText } = mount({ label: 'L', items: ITEMS, format: (v) => `${v} tok` })
    expect(getByText('80 tok')).toBeTruthy()
  })

  test('empty renders the empty text, no list', () => {
    const { container, getByText } = mount({ label: 'L', items: [], emptyText: 'No projects' })
    expect(getByText('No projects')).toBeTruthy()
    expect(container.querySelector('ul')).toBeNull()
  })

  test('empty renders through the EmptyState tile', () => {
    const { getByText } = mount({ label: 'L', items: [], emptyText: 'No projects' })
    expect(getByText('No projects').parentElement?.getAttribute('style') ?? '').toContain(
      'box-shadow',
    )
  })

  test('loading renders row skeletons and no list', () => {
    const { container } = mount({ label: 'L', items: ITEMS, loading: true, loadingRows: 4 })
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelectorAll('[data-bar-skeleton]').length).toBe(4)
  })

  test('loading takes its row count from the items it holds, else loadingRows, else 5', () => {
    const count = (props: Partial<Parameters<typeof mount>[0]>) =>
      mount({ label: 'L', items: ITEMS, loading: true, ...props }).container.querySelectorAll(
        '[data-bar-skeleton]',
      ).length
    expect(count({})).toBe(ITEMS.length)
    expect(count({ loadingRows: 2 })).toBe(2)
    expect(count({ items: [] })).toBe(5)
    const many = Array.from({ length: 80 }, (_, i) => ({ label: `r${i}`, value: i }))
    expect(count({ items: many })).toBe(30)
  })

  test('all-zero values draw empty bars', () => {
    const { container } = mount({
      label: 'L',
      items: [
        { label: 'a', value: 0 },
        { label: 'b', value: 0 },
      ],
    })
    expect(bars(container).map((x) => x.style.width)).toEqual(['0%', '0%'])
  })

  test('negative values clamp to 0, values above max clamp to 100', () => {
    const { container } = mount({
      label: 'L',
      max: 50,
      items: [
        { label: 'a', value: -10 },
        { label: 'b', value: 80 },
      ],
    })
    expect(bars(container).map((x) => x.style.width)).toEqual(['0%', '100%'])
  })

  test('a single item fills its own scale', () => {
    const { container } = mount({ label: 'L', items: [{ label: 'a', value: 7 }] })
    expect(bars(container).map((x) => x.style.width)).toEqual(['100%'])
  })

  test('duplicate labels render as distinct rows', () => {
    const { container } = mount({
      label: 'L',
      items: [
        { label: 'dup', value: 1 },
        { label: 'dup', value: 2 },
      ],
    })
    expect(container.querySelectorAll('li').length).toBe(2)
  })

  test('the list has role=list; the empty branch is a named status', () => {
    const full = mount({ label: 'L', items: ITEMS })
    expect(full.container.querySelector('ul')?.getAttribute('role')).toBe('list')
    cleanup()
    const empty = mount({ label: 'Top', items: [] })
    const status = empty.container.querySelector('[role="status"]')
    expect(status?.textContent).toContain('Top')
  })

  test('non-finite values render a dash and a 0% bar; they do not set the scale', () => {
    const { container, getByText } = mount({
      label: 'L',
      items: [
        { label: 'a', value: Number.NaN },
        { label: 'b', value: Number.POSITIVE_INFINITY },
        { label: 'c', value: 10 },
      ],
    })
    expect(bars(container).map((x) => x.style.width)).toEqual(['0%', '0%', '100%'])
    expect(container.querySelectorAll('li')[0]?.textContent).toContain('—')
    expect(getByText('10')).toBeTruthy()
  })

  test('a scale of 0 or NaN draws every bar at 0%', () => {
    const zero = mount({ label: 'L', max: 0, items: [{ label: 'a', value: 5 }] })
    expect(bars(zero.container).map((x) => x.style.width)).toEqual(['0%'])
    cleanup()
    const nan = mount({ label: 'L', max: Number.NaN, items: [{ label: 'a', value: 5 }] })
    expect(bars(nan.container).map((x) => x.style.width)).toEqual(['0%'])
  })
})

describe('BarList — the track is the label column', () => {
  test('the bar lives inside the label track, not beside the value', () => {
    const { container } = mount({
      label: 'L',
      variant: 'inline',
      items: [{ label: 'a', value: 5 }],
    })
    const li = container.querySelector('li') as HTMLElement
    const track = li.querySelector('[data-bar-track]') as HTMLElement
    expect(track.contains(li.querySelector('[aria-hidden]'))).toBe(true)
    expect(track.textContent).toBe('a')
    expect(li.lastElementChild?.textContent).toBe('5')
    expect(track.contains(li.lastElementChild)).toBe(false)
  })

  test('secondary values sit outside the track, one cell per row once any row has one', () => {
    const { container } = mount({
      variant: 'inline',
      label: 'L',
      items: [
        { label: 'a', value: 5, secondary: 'x' },
        { label: 'b', value: 3 },
      ],
    })
    expect(container.querySelector('ul')?.hasAttribute('data-secondary')).toBe(true)
    for (const li of container.querySelectorAll('li')) {
      expect(li.querySelector('[data-bar-track]')?.contains(li.lastElementChild)).toBe(false)
      expect(li.children.length).toBe(3)
    }
  })

  const alignOf = (secondary: ReactNode, extra: Partial<BarListProps> = {}) => {
    const { container } = mount({
      label: 'L',
      items: [{ label: 'a', value: 5, secondary }],
      ...extra,
    })
    const align = container.querySelector('ul')?.getAttribute('data-secondary-align')
    cleanup()
    return align
  }

  test('secondary alignment is auto by content: status words and marks start, figures and the rest end', () => {
    expect(alignOf('Blocked · Failing check')).toBe('start')
    expect(alignOf(<StatusVerdict color="red" word="Blocked" />)).toBe('start')
    expect(alignOf(<StatusDot color="red" />)).toBe('start')
    for (const figure of ['▲ 9%', '+€7', '41%', '-3.2', 12, <DeltaBadge key="d" value={9} />])
      expect(alignOf(figure)).toBe('end')
  })

  test('one status word start-aligns a column that also holds figures', () => {
    const { container } = mount({
      label: 'L',
      items: [
        { label: 'a', value: 5, secondary: 'Blocked' },
        { label: 'b', value: 3, secondary: '41%' },
      ],
    })
    expect(container.querySelector('ul')?.getAttribute('data-secondary-align')).toBe('start')
  })

  test('secondaryAlign overrides the auto choice either way', () => {
    expect(alignOf('Blocked', { secondaryAlign: 'end' })).toBe('end')
    expect(alignOf('41%', { secondaryAlign: 'start' })).toBe('start')
  })

  test('a null or false secondary does not open the secondary column', () => {
    const { container } = mount({
      variant: 'inline',
      label: 'L',
      items: [
        { label: 'a', value: 5, secondary: null },
        { label: 'b', value: 3, secondary: false },
      ],
    })
    expect(container.querySelector('ul')?.hasAttribute('data-secondary')).toBe(false)
    for (const li of container.querySelectorAll('li')) expect(li.children.length).toBe(2)
  })

  test('a thin row renders label, value, secondary, then the track (the wide layout reads in that order)', () => {
    const { container } = mount({ label: 'Top projects', items: ITEMS })
    const row = container.querySelector('li') as HTMLElement
    const kids = [...row.children]
    expect(kids).toHaveLength(4)
    expect(kids[0]?.getAttribute('title')).toBe('argo')
    expect(kids[1]?.textContent).toBe('80')
    expect(kids[2]?.textContent).toBe('40%')
    expect(kids[3]?.hasAttribute('data-bar-track')).toBe(true)
  })

  test('every state wraps in one frame that carries className and style', () => {
    const props = { label: 'Top projects', className: 'mine', style: { opacity: 0.5 } }
    for (const state of [
      { items: ITEMS },
      { items: [] },
      { items: [], loading: true },
    ] satisfies Partial<BarListProps>[]) {
      const { container, unmount } = mount({ ...props, ...state })
      const frame = container.querySelector('.mine') as HTMLElement
      expect(
        frame.querySelector(':scope > ul, :scope > [role="status"], :scope > [aria-busy]'),
      ).toBeTruthy()
      expect(frame.style.opacity).toBe('0.5')
      expect(container.querySelectorAll('.mine')).toHaveLength(1)
      unmount()
    }
    const { container } = mount({ ...props, items: ITEMS })
    expect(
      (container.querySelector('.mine') as HTMLElement).querySelector(':scope > ul'),
    ).toBeTruthy()
  })
})
