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
import { ChartCursorScope } from '../cursor/scope'
import { CartesianChart } from '../primitives/CartesianChart'
import type { ChartSeries } from '../series'
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

describe('Bars — formatX', () => {
  test('a custom formatX renders on the bottom axis instead of the default DD.MM', () => {
    const { container } = render(
      <Bars<Row>
        data={rows}
        chartId="bars-formatx"
        getX={(d) => d.date}
        getValue={(d, key) => d[key as 'shown' | 'quiet' | 'trend']}
        positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
        formatX={(key) => `X:${key}`}
      />,
    )
    expect(container.innerHTML).toContain('X:2026-08-01')
  })
})

describe('Bars — cursorResolution threads through to sibling resolution', () => {
  // Daily calendar Aug 01–14 (a plain CartesianChart driver) alongside a Bars sibling folded into
  // 2 weekly buckets keyed by each week's leading day (Aug 01, Aug 08) — the exact shape of the
  // playground's "Weekly digest" pairing. Proves the prop reaches THIS kind, not just
  // `CartesianChart` (a kind dropping the forward would silently fall back to 'nearest').
  const dailyRows: Row[] = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    shown: i,
    quiet: i,
    trend: i,
  }))
  const foldedRows: Row[] = [
    { date: '2026-08-01', shown: 0, quiet: 0, trend: 0 },
    { date: '2026-08-08', shown: 1, quiet: 1, trend: 1 },
  ]
  const dailySeries: ChartSeries<Row>[] = [
    { key: 'shown', label: 'Shown', color: '#111', mark: 'line', getValue: (d) => d.shown },
  ]

  function renderPair(cursorResolution?: 'leading') {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={dailyRows}
          chartId="bars-daily"
          getX={(d) => d.date}
          series={dailySeries}
          ariaLabel="Daily"
        >
          {() => null}
        </CartesianChart>
        <Bars<Row>
          data={foldedRows}
          chartId="bars-folded"
          getX={(d) => d.date}
          getValue={(d, key) => d[key as 'shown']}
          positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
          ariaLabel="Folded"
          {...(cursorResolution !== undefined && { cursorResolution })}
        />
      </ChartCursorScope>,
    )
  }

  // Drives the daily chart to Aug 05 — the back half of the Aug 01–07 bucket (midpoint Aug 04) —
  // via 5 keyboard ArrowRights from an unfocused slider (1st press lands on index 0).
  function driveDailyToAug05() {
    const dailySlider = screen.getByRole('slider', { name: 'Daily' })
    for (let i = 0; i < 5; i++) fireEvent.keyDown(dailySlider, { key: 'ArrowRight' })
  }

  test("cursorResolution='leading' resolves the back-half day to the bucket it's INSIDE, not the following one", () => {
    renderPair('leading')
    driveDailyToAug05()
    const foldedSlider = screen.getByRole('slider', { name: 'Folded' })
    expect(foldedSlider.getAttribute('aria-valuetext')).toBe('01.08')
  })

  test("without the prop (default 'nearest'), the same daily hover lands on the FOLLOWING bucket instead", () => {
    renderPair()
    driveDailyToAug05()
    const foldedSlider = screen.getByRole('slider', { name: 'Folded' })
    expect(foldedSlider.getAttribute('aria-valuetext')).toBe('08.08')
  })
})

describe('BarsBar<T> — the `= unknown` default stays assignable', () => {
  test('an existing untyped BarsBar[] array is assignable to BarsBar<Row>[] contravariantly', () => {
    const bars: BarsBar[] = [{ key: 'shown', label: 'Shown', color: '#111' }]
    const typed: BarsBar<Row>[] = bars
    expect(typed).toBe(bars)
  })
})
