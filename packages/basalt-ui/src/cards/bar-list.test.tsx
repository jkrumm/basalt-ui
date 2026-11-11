import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { BarList } from './bar-list'
import type { BarListProps } from './bar-list'

afterEach(cleanup)

const ITEMS = [
  { label: 'argo', value: 1840 },
  { label: 'rb', value: 920 },
  { label: 'linewatch', value: 460 },
]

const draw = (props: Partial<BarListProps> = {}): ReturnType<typeof render> =>
  render(<BarList title="Top projects" items={ITEMS} {...props} />)

const fills = (root: ParentNode): string[] =>
  [...root.querySelectorAll<HTMLElement>('[data-slot="bar-list-fill"]')].map((el) => el.style.width)

const values = (root: ParentNode): string[] =>
  [...root.querySelectorAll('[data-slot="bar-list-value"]')].map((el) => el.textContent ?? '')

describe('BarList', () => {
  test('is a list with an accessible name and text values', () => {
    const { getByRole, container } = draw()
    expect(getByRole('list', { name: 'Top projects' })).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="bar-list-row"]')).toHaveLength(3)
    expect(values(container)).toEqual(['1,840', '920', '460'])
  })

  test('a truncating label carries its full text in title', () => {
    const { container } = draw()
    expect(container.querySelector('[data-slot="bar-list-label"]')?.getAttribute('title')).toBe(
      'argo',
    )
  })

  test('bars share one scale: the largest value fills the track', () => {
    const { container } = draw()
    expect(fills(container)).toEqual(['100%', '50%', '25%'])
  })

  test('an explicit max rescales every bar', () => {
    const { container } = draw({ max: 3680 })
    expect(fills(container)).toEqual(['50%', '25%', '12.5%'])
  })

  test('format changes the text, never the bar', () => {
    const { container } = draw({ format: (n) => `${n / 1000}k` })
    expect(values(container)).toEqual(['1.84k', '0.92k', '0.46k'])
    expect(fills(container)[0]).toBe('100%')
  })

  test('all-zero values draw empty bars', () => {
    const { container } = draw({ items: [{ label: 'a', value: 0 }] })
    expect(fills(container)).toEqual(['0%'])
  })

  test('negative values clamp to 0 and values above max clamp to 100', () => {
    const { container } = draw({
      max: 100,
      items: [
        { label: 'neg', value: -20 },
        { label: 'over', value: 250 },
      ],
    })
    expect(fills(container)).toEqual(['0%', '100%'])
  })

  test('a single item fills its own scale', () => {
    const { container } = draw({ items: [{ label: 'only', value: 7 }] })
    expect(fills(container)).toEqual(['100%'])
  })

  test('duplicate labels render as distinct rows', () => {
    const { container } = draw({
      items: [
        { label: 'same', value: 1 },
        { label: 'same', value: 2 },
      ],
    })
    expect(container.querySelectorAll('[data-slot="bar-list-row"]')).toHaveLength(2)
  })

  test('a non-finite value prints a dash, draws 0% and does not set the scale', () => {
    const { container } = draw({
      items: [
        { label: 'broken', value: Number.NaN },
        { label: 'ok', value: 10 },
      ],
    })
    expect(values(container)).toEqual(['—', '10'])
    expect(fills(container)).toEqual(['0%', '100%'])
  })

  test('a scale of 0 draws every bar at 0%', () => {
    const { container } = draw({ max: 0 })
    expect(fills(container)).toEqual(['0%', '0%', '0%'])
  })

  test('a secondary value sits in its own cell on the row that has one', () => {
    const { container } = draw({
      items: [{ label: 'argo', value: 1, secondary: '41%' }, ITEMS[1]!],
    })
    const cells = container.querySelectorAll('[data-slot="bar-list-secondary"]')
    expect(cells).toHaveLength(1)
    expect(cells[0]?.textContent).toBe('41%')
  })
})

describe('BarList part of a whole', () => {
  test('max equal to the total marks the list and prints each share', () => {
    const { getByRole, container } = draw({ max: 3220 })
    expect(getByRole('list').hasAttribute('data-whole')).toBe(true)
    expect(
      [...container.querySelectorAll('[data-slot="bar-list-secondary"]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['57%', '29%', '14%'])
  })

  test('a row secondary wins over the share', () => {
    const { container } = draw({
      max: 3220,
      items: [{ label: 'argo', value: 1840, secondary: 'Good' }, ITEMS[1]!, ITEMS[2]!],
    })
    expect(container.querySelector('[data-slot="bar-list-secondary"]')?.textContent).toBe('Good')
  })

  test('a max that is not the total is a plain scale', () => {
    const { getByRole, container } = draw({ max: 5000 })
    expect(getByRole('list').hasAttribute('data-whole')).toBe(false)
    expect(container.querySelector('[data-slot="bar-list-secondary"]')).toBeNull()
  })

  test('no max is never a whole', () => {
    expect(draw().getByRole('list').hasAttribute('data-whole')).toBe(false)
  })
})

describe('BarList rows as targets', () => {
  test('a row with href is a link, a row with onSelect is a button, a plain row is neither', () => {
    const onSelect = mock(() => undefined)
    const { container, getAllByRole, queryAllByRole } = draw({
      items: [
        { label: 'argo', value: 3, href: '/argo' },
        { label: 'rb', value: 2, onSelect },
        { label: 'plain', value: 1 },
      ],
    })
    expect(getAllByRole('link')).toHaveLength(1)
    expect(getAllByRole('link')[0]?.getAttribute('href')).toBe('/argo')
    expect(getAllByRole('button')).toHaveLength(1)
    fireEvent.click(getAllByRole('button')[0]!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    const rows = container.querySelectorAll('[data-slot="bar-list-row"]')
    expect(rows[2]?.querySelector('a, button, [role="link"], [role="button"]')).toBeNull()
    expect(queryAllByRole('link')).toHaveLength(1)
  })

  test('no row is a target when none carries href or onSelect', () => {
    const { queryAllByRole } = draw()
    expect(queryAllByRole('link')).toHaveLength(0)
    expect(queryAllByRole('button')).toHaveLength(0)
  })
})

describe('BarList phases', () => {
  test('loading draws row skeletons and no list', () => {
    const { container, queryByRole } = draw({ phase: 'loading' })
    expect(queryByRole('list')).toBeNull()
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'loading',
    )
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('empty items say why, with no list', () => {
    const { getByText, queryByRole } = draw({ items: [] })
    expect(getByText('No items to compare yet')).toBeTruthy()
    expect(queryByRole('list')).toBeNull()
  })

  test('the caller names the cause of an empty list', () => {
    const { getByText } = draw({
      items: [],
      empty: { cause: 'No projects ran this week' },
    })
    expect(getByText('No projects ran this week')).toBeTruthy()
  })

  test('an error phase draws the error arm and no rows', () => {
    const { getByRole, container } = draw({
      phase: { tag: 'error', retry: () => undefined },
    })
    expect(getByRole('alert')).toBeTruthy()
    expect(container.querySelector('[data-slot="bar-list-row"]')).toBeNull()
  })

  test('stale keeps the rows', () => {
    const { container } = draw({ phase: 'stale' })
    expect(container.querySelectorAll('[data-slot="bar-list-row"]')).toHaveLength(3)
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'stale',
    )
  })

  test('every phase keeps the one body height', () => {
    const heights = (['ready', 'loading', 'stale'] as const).map((phase) => {
      const { container } = draw({ phase, rows: 6 })
      const cls = container.querySelector('[data-slot="inset"]')?.className ?? ''
      cleanup()
      return cls
    })
    expect(new Set(heights).size).toBe(1)
    expect(heights[0]).toContain('h-66')
  })
})

describe('BarList on the server', () => {
  test('renders with no provider and keeps its slots; the scroller is not yet a tab stop', () => {
    const html = renderToString(<BarList title="Top projects" items={ITEMS} />)
    for (const slot of ['bar-list', 'bar-list-row', 'bar-list-fill', 'list-scroll']) {
      expect(html).toContain(`data-slot="${slot}"`)
    }
    expect(html).not.toContain('tabindex')
  })
})
