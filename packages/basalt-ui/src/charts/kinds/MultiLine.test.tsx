/**
 * `MultiLine` — the `strokeOpacity` wiring: `dimOpacity(s) * (s.strokeOpacity ?? 1)`. SSR harness
 * (no hover needed), same pattern as `CartesianChart.test.tsx`'s `nice` assertions.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartCursorScope } from '../cursor/scope'
import { CartesianChart } from '../primitives/CartesianChart'
import { MultiLine } from './MultiLine'
import type { ChartSeries } from '../series'

type Row = { date: string; v: number }

const rows: Row[] = [
  { date: '2026-08-01', v: 10 },
  { date: '2026-08-02', v: 12 },
]

describe('MultiLine — series.strokeOpacity dims the plotted stroke', () => {
  test('the line path carries the configured stroke-opacity attribute', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#123456',
        mark: 'line',
        getValue: (d) => d.v,
        strokeOpacity: 0.35,
      },
    ]

    const html = renderToStaticMarkup(
      <MultiLine<Row> data={rows} chartId="ml-opacity" getX={(d) => d.date} series={series} />,
    )

    expect(html).toContain('stroke="#123456"')
    expect(html).toContain('stroke-opacity="0.35"')
  })
})

describe('MultiLine — formatX', () => {
  test('a custom formatX renders on the bottom axis instead of the default DD.MM', () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={rows}
        chartId="ml-formatx"
        getX={(d) => d.date}
        series={series}
        formatX={(key) => `X:${key}`}
      />,
    )
    expect(html).toContain('X:2026-08-01')
    expect(html).not.toContain('>01.08<')
  })
})

describe('MultiLine — getMarker fillOpacity/ring', () => {
  test('ring: false omits the stroke; fillOpacity defaults 1 and honors an override', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) => (d.date === '2026-08-01' ? { ring: false, fillOpacity: 0.7 } : null),
      },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row> data={rows} chartId="ml-marker-ring" getX={(d) => d.date} series={series} />,
    )
    expect(html).toContain('fill-opacity="0.7"')
    expect(html).not.toContain('stroke-width="2"')
  })

  test('default marker keeps the punched-out ring and full opacity (unchanged rendering)', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) => (d.date === '2026-08-01' ? {} : null),
      },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={rows}
        chartId="ml-marker-default"
        getX={(d) => d.date}
        series={series}
      />,
    )
    expect(html).toContain('stroke-width="2"')
    expect(html).toContain('fill-opacity="1"')
  })
})

describe('MultiLine — markerShape="star" honours getMarker ring/fillOpacity', () => {
  test('ring: false omits the stroke; fillOpacity defaults 1 and honors an override', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) => (d.date === '2026-08-01' ? { ring: false, fillOpacity: 0.7 } : null),
      },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={rows}
        chartId="ml-star-ring"
        getX={(d) => d.date}
        series={series}
        markerShape="star"
      />,
    )
    expect(html).toContain('fill-opacity="0.7"')
    expect(html).not.toContain('stroke-width="1.5"')
  })

  test('default marker keeps the punched-out ring and full opacity (unchanged rendering)', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) => (d.date === '2026-08-01' ? {} : null),
      },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={rows}
        chartId="ml-star-default"
        getX={(d) => d.date}
        series={series}
        markerShape="star"
      />,
    )
    expect(html).toContain('stroke-width="1.5"')
    expect(html).toContain('fill-opacity="1"')
  })
})

describe('MultiLine — cursorResolution threads through to sibling resolution', () => {
  // Daily calendar Aug 01–14 (a plain CartesianChart driver) alongside a MultiLine sibling folded
  // into 2 weekly buckets keyed by each week's leading day (Aug 01, Aug 08) — parity with
  // `Bars.test.tsx`'s equivalent block. Proves the prop reaches THIS kind, not just
  // `CartesianChart` (a kind dropping the forward would silently fall back to 'nearest').
  const dailyRows: Row[] = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    v: i,
  }))
  const foldedRows: Row[] = [
    { date: '2026-08-01', v: 0 },
    { date: '2026-08-08', v: 1 },
  ]
  const dailySeries: ChartSeries<Row>[] = [
    { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
  ]
  const foldedSeries: ChartSeries<Row>[] = [
    { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
  ]

  function renderPair(cursorResolution?: 'leading') {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={dailyRows}
          chartId="ml-daily"
          getX={(d) => d.date}
          series={dailySeries}
          ariaLabel="Daily"
        >
          {() => null}
        </CartesianChart>
        <MultiLine<Row>
          data={foldedRows}
          chartId="ml-folded"
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
