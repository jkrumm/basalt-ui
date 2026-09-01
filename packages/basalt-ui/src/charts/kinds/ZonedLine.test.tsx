/**
 * `ZonedLine` — the `strokeOpacity` wiring: `primary.strokeOpacity ?? 1`. SSR harness (no hover
 * needed), same pattern as `CartesianChart.test.tsx`'s `nice` assertions.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartCursorScope } from '../cursor/scope'
import { CartesianChart } from '../primitives/CartesianChart'
import { ZonedLine } from './ZonedLine'
import type { ChartSeries } from '../series'

type Row = { date: string; v: number }

const rows: Row[] = [
  { date: '2026-08-01', v: 10 },
  { date: '2026-08-02', v: 12 },
]

describe('ZonedLine — series.strokeOpacity dims the plotted stroke', () => {
  test('the line path carries the configured stroke-opacity attribute', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#654321',
        mark: 'line',
        getValue: (d) => d.v,
        strokeOpacity: 0.5,
      },
    ]

    const html = renderToStaticMarkup(
      <ZonedLine<Row> data={rows} chartId="zl-opacity" getX={(d) => d.date} series={series} />,
    )

    expect(html).toContain('stroke="#654321"')
    expect(html).toContain('stroke-opacity="0.5"')
  })
})

describe('ZonedLine — xLabelRotate', () => {
  test('is forwarded to CartesianChart and rotates the bottom axis tick labels', () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    const html = renderToStaticMarkup(
      <ZonedLine<Row>
        data={rows}
        chartId="zl-rotate"
        getX={(d) => d.date}
        series={series}
        xLabelRotate={45}
      />,
    )
    expect(html).toContain('transform="rotate(-45')
  })
})

describe('ZonedLine — formatX', () => {
  test('a custom formatX renders on the bottom axis instead of the default DD.MM', () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    const html = renderToStaticMarkup(
      <ZonedLine<Row>
        data={rows}
        chartId="zl-formatx"
        getX={(d) => d.date}
        series={series}
        formatX={(key) => `X:${key}`}
      />,
    )
    expect(html).toContain('X:2026-08-01')
    expect(html).not.toContain('>01.08<')
  })
})

describe('ZonedLine — tooltip.formatHeader', () => {
  test('overrides the tooltip header date text', async () => {
    const series: ChartSeries<Row>[] = [
      { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
    ]
    render(
      <ZonedLine<Row>
        data={rows}
        chartId="zl-formatheader"
        getX={(d) => d.date}
        series={series}
        tooltip={{ formatHeader: (key) => `hdr:${key}` }}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(await screen.findByText('hdr:2026-08-01')).toBeTruthy()
  })
})

describe('ZonedLine — cursorResolution threads through to sibling resolution', () => {
  // Daily calendar Aug 01–14 (a plain CartesianChart driver) alongside a ZonedLine sibling folded
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
          chartId="zl-daily"
          getX={(d) => d.date}
          series={dailySeries}
          ariaLabel="Daily"
        >
          {() => null}
        </CartesianChart>
        <ZonedLine<Row>
          data={foldedRows}
          chartId="zl-folded"
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

describe('ZonedLine — nulls gap and a log axis never emits NaN', () => {
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

  // `visx-linepath` is the mark; the grid rules are `visx-line` and never a path.
  function linePath(html: string): string {
    return /class="visx-linepath"[^>]*\sd="([^"]*)"/.exec(html)?.[1] ?? ''
  }

  test('the line breaks into two subpaths at the null instead of joining across the hole', () => {
    const html = renderToStaticMarkup(
      <ZonedLine<Sparse>
        data={sparse}
        chartId="zl-null-gap"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    expect((linePath(html).match(/M/g) ?? []).length).toBe(2)
  })

  test('a dense series still draws ONE continuous subpath', () => {
    const dense: Sparse[] = sparse.map((d) => ({ ...d, v: d.v ?? 13 }))
    const html = renderToStaticMarkup(
      <ZonedLine<Sparse>
        data={dense}
        chartId="zl-dense"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    expect((linePath(html).match(/M/g) ?? []).length).toBe(1)
  })

  test('the area fill and the threshold fill break at the null too, not just the line', () => {
    const html = renderToStaticMarkup(
      <ZonedLine<Sparse>
        data={sparse}
        chartId="zl-null-fills"
        getX={(d) => d.date}
        series={sparseSeries}
        areaFill="#111"
        thresholds={[{ value: 13, side: 'above', fill: '#222' }]}
      />,
    )
    // Every mark path (line, AreaClosed, and the Threshold's two Areas) carries a second moveto.
    const marks = [...html.matchAll(/<path[^>]*\sd="(M[^"]*)"/g)].map((m) => m[1] ?? '')
    expect(marks.length).toBeGreaterThan(1)
    for (const d of marks) expect((d.match(/M/g) ?? []).length).toBe(2)
  })

  test('a log axis with a zero value renders a path with no NaN — one NaN blanks the whole polyline', () => {
    const crossing: Sparse[] = [
      { date: '2026-08-01', v: 20 },
      { date: '2026-08-02', v: 0 },
      { date: '2026-08-03', v: 5000 },
    ]
    const html = renderToStaticMarkup(
      <ZonedLine<Sparse>
        data={crossing}
        chartId="zl-log-zero"
        getX={(d) => d.date}
        series={sparseSeries}
        y={{ scale: 'log' }}
        areaFill="#111"
        thresholds={[{ value: 100, side: 'above', fill: '#222' }]}
      />,
    )
    expect(html).not.toContain('NaN')
    expect(linePath(html)).not.toBe('')
  })
})
