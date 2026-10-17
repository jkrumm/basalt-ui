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

const fills = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-bar-fill]')]
const widths = (c: HTMLElement) => fills(c).map((b) => b.style.width)

describe('BarList per-row max', () => {
  const items = [
    { label: 'Sleep', value: 32, max: 40 },
    { label: 'HRV', value: 14, max: 35 },
    { label: 'Load', value: 25, max: 25 },
  ]

  test('each bar fills value / row.max', () => {
    const { container } = mount({ label: 'Contributors', items })
    expect(widths(container)).toEqual(['80%', '40%', '100%'])
  })

  test('the value column shows the denominator through format', () => {
    const { getByText } = mount({
      label: 'C',
      items,
      format: (n, part) => (part === 'max' ? `${n} pts` : String(n)),
    })
    expect(getByText('32 / 40 pts')).toBeTruthy()
  })

  test('mixed list: the shared scale covers only rows without their own max', () => {
    const { container, getByText } = mount({
      label: 'L',
      items: [
        { label: 'a', value: 50 },
        { label: 'b', value: 25 },
        { label: 'c', value: 900, max: 1000 },
      ],
    })
    expect(widths(container)).toEqual(['100%', '50%', '90%'])
    expect(getByText('50')).toBeTruthy()
    expect(getByText('900 / 1000')).toBeTruthy()
  })

  test('the max prop sets the shared scale for rows without their own', () => {
    const { container } = mount({
      label: 'L',
      max: 100,
      items: [
        { label: 'a', value: 50 },
        { label: 'c', value: 5, max: 10 },
      ],
    })
    expect(widths(container)).toEqual(['50%', '50%'])
  })
})

describe('BarList thin variant', () => {
  const items = [{ label: 'Sleep', value: 32, max: 40, secondary: 'Good' }]

  test('default variant keeps the label inside the track', () => {
    const { container } = mount({ label: 'L', items })
    expect(container.querySelector('[data-bar-track] [title="Sleep"]')).toBeTruthy()
    expect(container.querySelector('ul')?.hasAttribute('data-variant')).toBe(false)
  })

  test('thin puts the label outside the track, before the value', () => {
    const { container } = mount({ label: 'L', items, variant: 'thin' })
    const ul = container.querySelector('ul') as HTMLElement
    expect(ul.getAttribute('data-variant')).toBe('thin')
    const li = ul.querySelector('li') as HTMLElement
    expect(li.querySelector('[data-bar-track] [title="Sleep"]')).toBeNull()
    const kids = [...li.children]
    const label = kids.findIndex((k) => k.getAttribute('title') === 'Sleep')
    const value = kids.findIndex((k) => k.textContent === '32 / 40')
    const track = kids.findIndex((k) => k.hasAttribute('data-bar-track'))
    expect(label).toBeGreaterThanOrEqual(0)
    expect(label).toBeLessThan(value)
    expect(value).toBeLessThan(track)
    expect(widths(container)).toEqual(['80%'])
  })
})

describe('BarList tick', () => {
  test('draws a hairline at tick / scale and names it for assistive tech', () => {
    const { container, getByText } = mount({
      label: 'L',
      items: [{ label: 'poller', value: 20, max: 100, tick: 60, tickLabel: 'Stale after' }],
    })
    const tick = container.querySelector<HTMLElement>('[data-bar-tick]') as HTMLElement
    expect(tick.style.insetInlineStart).toBe('60%')
    expect(tick.hasAttribute('title')).toBe(false)
    expect(getByText('Stale after 60')).toBeTruthy()
  })

  test('tick uses the shared scale for a row without max, default label', () => {
    const { container, getByText } = mount({
      label: 'L',
      items: [
        { label: 'a', value: 80, tick: 40 },
        { label: 'b', value: 20 },
      ],
    })
    expect(container.querySelectorAll('[data-bar-tick]').length).toBe(1)
    expect((container.querySelector('[data-bar-tick]') as HTMLElement).style.insetInlineStart).toBe(
      '50%',
    )
    expect(getByText('Threshold 40')).toBeTruthy()
  })

  test('the tick label goes through format as a value', () => {
    const { getByText } = mount({
      label: 'L',
      format: (n, part) => `${n}${part === 'max' ? 'M' : 's'}`,
      items: [{ label: 'a', value: 1, max: 10, tick: 5 }],
    })
    expect(getByText('Threshold 5s')).toBeTruthy()
  })

  test('the hidden tick text sits in the track, so value/secondary stay the last children', () => {
    const { container } = mount({
      label: 'L',
      items: [
        { label: 'a', value: 1, secondary: 'x', tick: 1 },
        { label: 'b', value: 2, secondary: 'y' },
      ],
    })
    const lis = [...container.querySelectorAll('li')]
    expect(lis.map((li) => li.lastElementChild?.textContent)).toEqual(['x', 'y'])
    expect(lis[0]?.querySelector('[data-bar-track]')?.textContent).toContain('Threshold 1')
  })

  test('rows without a tick render none', () => {
    const { container } = mount({ label: 'L', items: [{ label: 'a', value: 1 }] })
    expect(container.querySelector('[data-bar-tick]')).toBeNull()
  })
})
