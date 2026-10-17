import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BarList } from './bar-list'
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
const bars = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('li > span[aria-hidden]')]

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

  test('loading renders row skeletons and no list', () => {
    const { container } = mount({ label: 'L', items: ITEMS, loading: true, loadingRows: 4 })
    expect(container.querySelector('ul')).toBeNull()
    expect(container.querySelectorAll('[data-bar-skeleton]').length).toBe(4)
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
    const status = empty.container.querySelector('output')
    expect(status?.getAttribute('aria-label')).toBe('Top')
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
