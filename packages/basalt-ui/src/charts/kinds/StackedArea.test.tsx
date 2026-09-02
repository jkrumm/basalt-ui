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
import type { AxisConfig } from '../primitives/CartesianChart'
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

describe('StackedArea — a null band gaps the whole stack instead of claiming zero', () => {
  type Sparse = { date: string; a: number | null; b: number }
  const sparse: Sparse[] = [
    { date: '2026-08-01', a: 10, b: 4 },
    { date: '2026-08-02', a: 12, b: 6 },
    { date: '2026-08-03', a: null, b: 5 },
    { date: '2026-08-04', a: 14, b: 6 },
    { date: '2026-08-05', a: 16, b: 8 },
  ]
  const sparseSeries: ChartSeries<Sparse>[] = [
    { key: 'a', label: 'A', color: '#111', mark: 'area', getValue: (d) => d.a },
    { key: 'b', label: 'B', color: '#222', mark: 'area', getValue: (d) => d.b },
  ]

  /** The band paths — the `AreaStack` children, one per key. */
  function bandPaths(html: string): string[] {
    return [...html.matchAll(/<path[^>]*\sd="(M[^"]*)"[^>]*stroke="transparent"/g)].map(
      (m) => m[1] ?? '',
    )
  }

  test('both bands break at the sparse x — no band spans it claiming a measured 0', () => {
    const html = renderToStaticMarkup(
      <StackedArea<Sparse>
        data={sparse}
        chartId="sa-null-gap"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    const bands = bandPaths(html)
    expect(bands.length).toBe(2)
    // Two subpaths each = a hole at 2026-08-03. One would mean the band was drawn across it, and
    // for the null band that line would sit on the baseline — a positive claim of zero.
    for (const d of bands) expect((d.match(/M/g) ?? []).length).toBe(2)
  })

  test('a dense stack still draws ONE continuous band per series', () => {
    const dense: Sparse[] = sparse.map((d) => ({ ...d, a: d.a ?? 13 }))
    const html = renderToStaticMarkup(
      <StackedArea<Sparse>
        data={dense}
        chartId="sa-dense"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    const bands = bandPaths(html)
    expect(bands.length).toBe(2)
    for (const d of bands) expect((d.match(/M/g) ?? []).length).toBe(1)
  })

  test('hiding the sparse band via the legend closes the gap — density tracks the VISIBLE set', () => {
    const { container } = render(
      <StackedArea<Sparse>
        data={sparse}
        chartId="sa-null-toggle"
        getX={(d) => d.date}
        series={sparseSeries}
      />,
    )
    expect(bandPaths(container.innerHTML).every((d) => (d.match(/M/g) ?? []).length === 2)).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: 'A' }))

    const remaining = bandPaths(container.innerHTML)
    expect(remaining.length).toBe(1)
    expect((remaining[0]?.match(/M/g) ?? []).length).toBe(1)
  })
})

describe('StackedArea — xLabelRotate', () => {
  test('is forwarded to CartesianChart and rotates the bottom axis tick labels', () => {
    const html = renderToStaticMarkup(
      <StackedArea<Row>
        data={rows}
        chartId="sa-rotate"
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
describe('StackedArea — BasaltProps', () => {
  test('className and style land on the root element', () => {
    const { container } = render(
      <StackedArea<Row>
        data={rows}
        chartId="sa-classname"
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

/**
 * The stack sums band heights directly (a running total per x), which has no additive zero on a
 * log scale — the same contract `Bars`' stacked layout enforces (`docs/CHARTS-SPEC.md`'s null-gap
 * + log contract). `y.scale` is typed out of `StackedAreaProps`; the cast below simulates a JS
 * consumer (or a type-unsafe escape hatch) reaching past that.
 */
describe('StackedArea — rejects a log y-axis', () => {
  test('throws in dev, naming the offending config', () => {
    expect(() =>
      render(
        <StackedArea<Row>
          data={rows}
          chartId="sa-log"
          getX={(d) => d.date}
          series={series}
          y={{ scale: 'log' } as unknown as Omit<AxisConfig<Row>, 'scale'>}
        />,
      ),
    ).toThrow(/StackedArea: cannot use a log axis/)
  })
})
