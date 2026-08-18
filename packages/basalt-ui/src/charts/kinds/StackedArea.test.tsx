/**
 * `StackedArea` — the `formatX` seam forwarded to `CartesianChart` (parity with the other
 * `CartesianChart`-composing kinds). SSR harness, no hover needed.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartCursorScope } from '../cursor/scope'
import { CartesianChart } from '../primitives/CartesianChart'
import { StackedArea } from './StackedArea'
import type { ChartSeries } from '../series'

type Row = { date: string; a: number; b: number }

const rows: Row[] = [
  { date: '2026-08-01', a: 10, b: 4 },
  { date: '2026-08-02', a: 12, b: 6 },
]

const series: ChartSeries<Row>[] = [
  { key: 'a', label: 'A', color: '#111', mark: 'area', getValue: (d) => d.a },
  { key: 'b', label: 'B', color: '#222', mark: 'area', getValue: (d) => d.b },
]

describe('StackedArea — formatX', () => {
  test('a custom formatX renders on the bottom axis instead of the default DD.MM', () => {
    const html = renderToStaticMarkup(
      <StackedArea<Row>
        data={rows}
        chartId="sa-formatx"
        getX={(d) => d.date}
        series={series}
        formatX={(key) => `X:${key}`}
      />,
    )
    expect(html).toContain('X:2026-08-01')
    expect(html).not.toContain('>01.08<')
  })

  test('omitting formatX keeps the default DD.MM rendering', () => {
    const html = renderToStaticMarkup(
      <StackedArea<Row> data={rows} chartId="sa-default" getX={(d) => d.date} series={series} />,
    )
    expect(html).toContain('>01.08<')
  })
})

describe('StackedArea — cursorResolution threads through to sibling resolution', () => {
  // Daily calendar Aug 01–14 (a plain CartesianChart driver) alongside a StackedArea sibling
  // folded into 2 weekly buckets keyed by each week's leading day (Aug 01, Aug 08) — parity with
  // `Bars.test.tsx`'s equivalent block. Proves the prop reaches THIS kind, not just
  // `CartesianChart` (a kind dropping the forward would silently fall back to 'nearest').
  type DailyRow = { date: string; v: number }

  const dailyRows: DailyRow[] = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    v: i,
  }))
  const foldedRows: Row[] = [
    { date: '2026-08-01', a: 0, b: 0 },
    { date: '2026-08-08', a: 1, b: 1 },
  ]
  const dailySeries: ChartSeries<DailyRow>[] = [
    { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
  ]
  const foldedSeries: ChartSeries<Row>[] = [
    { key: 'a', label: 'A', color: '#111', mark: 'area', getValue: (d) => d.a },
  ]

  function renderPair(cursorResolution?: 'leading') {
    render(
      <ChartCursorScope>
        <CartesianChart<DailyRow>
          data={dailyRows}
          chartId="sa-daily"
          getX={(d) => d.date}
          series={dailySeries}
          ariaLabel="Daily"
        >
          {() => null}
        </CartesianChart>
        <StackedArea<Row>
          data={foldedRows}
          chartId="sa-folded"
          getX={(d) => d.date}
          series={foldedSeries}
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
