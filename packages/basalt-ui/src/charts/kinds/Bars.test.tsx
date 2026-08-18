/**
 * `Bars` — the `tooltip: false` seam threaded from `SeriesStyle.tooltip` through `BarsBar`/
 * `BarsLine` (replacing the removed per-kind `hideBarTooltipRows`), plus the `BarsBar<T>`
 * generic-default assignability guarantee. Real DOM harness (`tests/setup/dom.ts`): the cursor
 * only advances via `useChartCursor`'s keyboard path (`ArrowRight` on the overlay's `role="slider"`),
 * which is deterministic regardless of happy-dom's zeroed layout geometry — unlike the pointer path,
 * which needs a real `getBoundingClientRect`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { Bars } from './Bars'
import type { BarsBar } from './Bars'

type Row = { date: string; shown: number; quiet: number; trend: number }

const rows: Row[] = [{ date: '2026-08-01', shown: 10, quiet: 5, trend: 7 }]

describe('Bars — tooltip: false drops only that row', () => {
  test('a quiet bar is drawn and legended but produces no tooltip row', async () => {
    render(
      <Bars<Row>
        data={rows}
        chartId="bars-tooltip"
        getX={(d) => d.date}
        getValue={(d, key) => d[key as 'shown' | 'quiet']}
        positiveBars={[
          { key: 'shown', label: 'Shown', color: '#111' },
          { key: 'quiet', label: 'Quiet', color: '#222', tooltip: false },
        ]}
      />,
    )

    // Both series are legended regardless of the tooltip flag.
    expect(screen.getByText('Shown')).toBeTruthy()
    expect(screen.getByText('Quiet')).toBeTruthy()

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    // The tooltip row duplicates 'Shown' (legend + row); 'Quiet' stays legend-only. The tooltip
    // anchor is set through a `requestAnimationFrame` coalesce, so wait for the SECOND 'Shown' to
    // land rather than resolving on the legend's already-present first one.
    await waitFor(() => expect(screen.getAllByText('Shown')).toHaveLength(2))
    expect(screen.getAllByText('Quiet')).toHaveLength(1)
  })
})

describe('Bars — lines[].tooltip: false drops only that row', () => {
  test('a quiet line is drawn and legended but produces no tooltip row', async () => {
    render(
      <Bars<Row>
        data={rows}
        chartId="bars-line-tooltip"
        getX={(d) => d.date}
        getValue={(d, key) => d[key as 'shown' | 'quiet' | 'trend']}
        positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
        lines={[{ key: 'trend', label: 'Trend', color: '#333', tooltip: false }]}
      />,
    )

    // Both series are legended regardless of the tooltip flag.
    expect(screen.getByText('Shown')).toBeTruthy()
    expect(screen.getByText('Trend')).toBeTruthy()

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    // The tooltip row duplicates 'Shown' (legend + row); 'Trend' stays legend-only.
    await waitFor(() => expect(screen.getAllByText('Shown')).toHaveLength(2))
    expect(screen.getAllByText('Trend')).toHaveLength(1)
  })
})

describe('Bars — lines[].strokeOpacity dims the plotted stroke', () => {
  test('the line path carries the configured stroke-opacity attribute', () => {
    const { container } = render(
      <Bars<Row>
        data={rows}
        chartId="bars-line-opacity"
        getX={(d) => d.date}
        getValue={(d, key) => d[key as 'shown' | 'quiet' | 'trend']}
        positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
        lines={[{ key: 'trend', label: 'Trend', color: '#333', strokeOpacity: 0.4 }]}
      />,
    )

    const path = container.querySelector('path[stroke="#333"]')
    expect(path?.getAttribute('stroke-opacity')).toBe('0.4')
  })
})

describe('BarsBar<T> — the `= unknown` default stays assignable', () => {
  test('an existing untyped BarsBar[] array is assignable to BarsBar<Row>[] contravariantly', () => {
    const bars: BarsBar[] = [{ key: 'shown', label: 'Shown', color: '#111' }]
    const typed: BarsBar<Row>[] = bars
    expect(typed).toBe(bars)
  })
})
