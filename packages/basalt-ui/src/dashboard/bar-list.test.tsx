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
const bars = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-bar-pct]')]

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
})
