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

describe('MultiLine — a log y-axis never emits a NaN path or marker for a non-positive value', () => {
  const crossing: Row[] = [
    { date: '2026-08-01', v: -5 },
    { date: '2026-08-02', v: 20 },
    { date: '2026-08-03', v: 5000 },
  ]

  test('the line path carries no NaN command — the point drops out as a gap, not a broken polyline', () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={crossing}
        chartId="ml-log-nan-line"
        getX={(d) => d.date}
        series={series}
        y={{ scale: 'log' }}
      />,
    )
    expect(html).not.toContain('NaN')
  })

  test('a marker at the non-positive point is skipped rather than painted at cy="NaN"', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: () => ({}),
      },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={crossing}
        chartId="ml-log-nan-marker"
        getX={(d) => d.date}
        series={series}
        y={{ scale: 'log' }}
      />,
    )
    expect(html).not.toContain('NaN')
    // The two positive points (20, 5000) still get their marker circles.
    expect((html.match(/<circle/g) ?? []).length).toBe(2)
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

describe('MultiLine — a null value is a GAP, not an interpolated straight line', () => {
  type Sparse = { date: string; v: number | null }
  const sparse: Sparse[] = [
    { date: '2026-08-01', v: 10 },
    { date: '2026-08-02', v: 12 },
    { date: '2026-08-03', v: null },
    { date: '2026-08-04', v: 14 },
    { date: '2026-08-05', v: 16 },
  ]
  const sparseSeries: ChartSeries<Sparse>[] = [
    { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
  ]

  function linePath(html: string): string {
    return /class="visx-linepath"[^>]*\sd="([^"]*)"/.exec(html)?.[1] ?? ''
  }

  test('the path breaks into two subpaths at the null — the row is kept, `defined` splits it', () => {
    const html = renderToStaticMarkup(
      <MultiLine<Sparse>
        data={sparse}
        chartId="ml-null-gap"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    const d = linePath(html)
    // Two moveto commands = two segments = a real hole. One would mean the line was drawn straight
    // across the missing day.
    expect((d.match(/M/g) ?? []).length).toBe(2)
    expect(d).not.toContain('NaN')
  })

  test('a dense series still draws ONE continuous subpath (the gap is data-driven, not always-on)', () => {
    const dense: Sparse[] = sparse.map((d) => ({ ...d, v: d.v ?? 13 }))
    const html = renderToStaticMarkup(
      <MultiLine<Sparse>
        data={dense}
        chartId="ml-dense"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    expect((linePath(html).match(/M/g) ?? []).length).toBe(1)
  })

  test('a marker on the null point is not painted, and the null contributes no crosshair dot', () => {
    const withMarkers: ChartSeries<Sparse>[] = [
      { ...(sparseSeries[0] as ChartSeries<Sparse>), getMarker: () => ({}) },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Sparse>
        data={sparse}
        chartId="ml-null-marker"
        getX={(d) => d.date}
        series={withMarkers}
      />,
    )
    expect(html).not.toContain('NaN')
    // Four measured points, four markers — the null day gets none.
    expect((html.match(/<circle/g) ?? []).length).toBe(4)
  })

  test('a series that measured nothing at all draws no path', () => {
    const allNull: ChartSeries<Sparse>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: () => null },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Sparse>
        data={sparse}
        chartId="ml-all-null"
        getX={(d) => d.date}
        series={allNull}
      />,
    )
    // `visx-linepath` is the mark; the grid rules are `visx-line` and never a path.
    expect(linePath(html)).toBe('')
  })
})

describe('MultiLine — xLabelRotate', () => {
  test('is forwarded to CartesianChart and rotates the bottom axis tick labels', () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    const html = renderToStaticMarkup(
      <MultiLine<Row>
        data={rows}
        chartId="ml-rotate"
        getX={(d) => d.date}
        series={series}
        xLabelRotate={45}
      />,
    )
    expect(html).toContain('transform="rotate(-45')
  })
})

/**
 * `BasaltProps` (`common/props.ts`): 98 of 123 exported components dropped `className`, so a
 * consumer needing one margin had to fork the component. A kind's root element is the
 * `ChartFrame` box it composes, so the assertion is that the class travels all the way down.
 */
describe('MultiLine — BasaltProps', () => {
  test('className and style land on the root element', () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    const { container } = render(
      <MultiLine<Row>
        data={rows}
        chartId="ml-classname"
        getX={(d) => d.date}
        series={series}
        className="my-chart"
        style={{ opacity: 0.5 }}
      />,
    )
    const root = container.querySelector('.my-chart')
    expect(root).not.toBeNull()
    expect((root as HTMLElement).style.opacity).toBe('0.5')
  })
})
