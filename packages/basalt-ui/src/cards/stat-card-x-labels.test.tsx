/** `StatCard` `xLabels`: the card draws the label row, so the chart slot gets the plot alone. */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { StatCard } from './stat-card'

afterEach(cleanup)

const box = (): HTMLElement | null => document.querySelector('[data-slot="stat-chart"]')

describe('StatCard xLabels', () => {
  test('three labels sit under the plot, which gets 56 px', () => {
    const chart = mock((_box: { height: number | 'fill'; phase: string }) => <svg />)
    render(
      <StatCard title="Shipped" value={388} chart={chart} axisLabels={['Mon', 'Thu', 'Sun']} />,
    )
    expect(chart.mock.calls[0]?.[0]).toEqual({ height: 56, phase: 'ready' })
    const row = box()?.querySelector('[data-slot="stat-x-labels"]')
    expect([...(row?.children ?? [])].map((el) => el.textContent)).toEqual(['Mon', 'Thu', 'Sun'])
    expect(box()?.lastElementChild).toBe(row as Element)
  })

  test('chartHeight sizes the box, the plot under labels and the inset: a one-line chart leaves no band', () => {
    const chart = mock((_box: { height: number | 'fill'; phase: string }) => <svg />)
    const { container } = render(<StatCard title="Rate" value={38} chart={chart} height={20} />)
    expect(chart.mock.calls[0]?.[0]).toEqual({ height: 20, phase: 'ready' })
    expect(
      container
        .querySelector<HTMLElement>('[data-slot="inset"]')
        ?.style.getPropertyValue('--chart-h'),
    ).toBe('20px')
    cleanup()
    const labelled = mock((_box: { height: number | 'fill'; phase: string }) => <svg />)
    render(
      <StatCard
        title="Rate"
        value={38}
        chart={labelled}
        height={40}
        axisLabels={['a', 'b', 'c']}
      />,
    )
    expect(labelled.mock.calls[0]?.[0]).toEqual({ height: 24, phase: 'ready' })
  })

  test('without labels the slot keeps the full 72 px box and no row is drawn', () => {
    const chart = mock((_box: { height: number | 'fill'; phase: string }) => <svg />)
    render(<StatCard title="Shipped" value={388} chart={chart} />)
    expect(chart.mock.calls[0]?.[0]).toEqual({ height: 72, phase: 'ready' })
    expect(box()?.querySelector('[data-slot="stat-x-labels"]')).toBeNull()
  })
})
