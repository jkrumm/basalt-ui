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

describe('Bars — grouped layout on a log axis, and grouped re-tiling on a legend toggle', () => {
  type GRow = { date: string; a: number; b: number; c: number }
  const gRows: GRow[] = [
    { date: '2026-08-01', a: 5, b: 50, c: 500 },
    { date: '2026-08-02', a: 8, b: 80, c: 800 },
  ]
  const gBars: BarsBar<GRow>[] = [
    { key: 'a', label: 'A', color: '#111' },
    { key: 'b', label: 'B', color: '#222' },
    { key: 'c', label: 'C', color: '#333' },
  ]
  const gValue = (d: GRow, key: string) => (d as unknown as Record<string, number>)[key] ?? null

  /** Every bar rect, as `{ x, height }` — the two geometry numbers both defects corrupt. */
  function barRects(html: string): { x: number; height: number }[] {
    return [...html.matchAll(/<rect[^>]*\sx="([^"]*)"[^>]*\sheight="([^"]*)"/g)].map((m) => ({
      x: Number(m[1]),
      height: Number(m[2]),
    }))
  }

  function renderGrouped(scale?: 'log') {
    return render(
      <Bars<GRow>
        data={gRows}
        chartId={`bars-grouped-${scale ?? 'linear'}`}
        getX={(d) => d.date}
        getValue={gValue}
        positiveBars={gBars}
        barLayout="grouped"
        {...(scale !== undefined && { y: { scale } })}
      />,
    )
  }

  test('a log y-axis draws finite, positive bar heights — `scale(0)` would make every one NaN', () => {
    const { container } = renderGrouped('log')
    const rects = barRects(container.innerHTML)
    expect(rects.length).toBe(6)
    expect(container.innerHTML).not.toContain('NaN')
    for (const r of rects) {
      expect(Number.isFinite(r.height)).toBe(true)
      expect(r.height).toBeGreaterThan(0)
    }
  })

  test('hiding a grouped series re-tiles the survivors instead of leaving its slot empty', () => {
    const { container } = renderGrouped()
    const before = barRects(container.innerHTML)
    expect(before.length).toBe(6)
    const beforeWidth = /<rect[^>]*\swidth="([^"]*)"/.exec(container.innerHTML)?.[1]

    fireEvent.click(screen.getByRole('button', { name: 'B' }))

    const after = barRects(container.innerHTML)
    expect(after.length).toBe(4)
    // C moves left into the space B vacated (it kept B's old offset before this fix)…
    const beforeC = before[2]?.x ?? 0
    const afterC = after[1]?.x ?? 0
    expect(afterC).toBeLessThan(beforeC)
    // …and the survivors widen to fill the same slot.
    const afterWidth = /<rect[^>]*\swidth="([^"]*)"/.exec(container.innerHTML)?.[1]
    expect(Number(afterWidth)).toBeGreaterThan(Number(beforeWidth))
  })
})

/**
 * Stacking sums bar heights via a running offset in yScale units — a log axis has no additive
 * zero to sum from (`docs/CHARTS-SPEC.md`'s null-gap + log contract), so `barLayout: 'stacked'`
 * with `y.scale: 'log'` is a config error rather than data this kind can render honestly.
 */
describe('Bars — stacked layout rejects a log y-axis', () => {
  test('throws in dev, naming the offending prop and the escape hatch', () => {
    expect(() =>
      render(
        <Bars<Row>
          data={rows}
          chartId="bars-stacked-log"
          getX={(d) => d.date}
          getValue={(d, key) => (d as unknown as Record<string, number>)[key] ?? null}
          positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
          y={{ scale: 'log' }}
        />,
      ),
    ).toThrow(/Bars: stacked bars cannot use a log axis.*barLayout: 'grouped'/)
  })

  test('a linear axis (the default) never throws', () => {
    expect(() =>
      render(
        <Bars<Row>
          data={rows}
          chartId="bars-stacked-linear"
          getX={(d) => d.date}
          getValue={(d, key) => (d as unknown as Record<string, number>)[key] ?? null}
          positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
        />,
      ),
    ).not.toThrow()
  })
})

describe('Bars — baselineFor uses the y-axis domain floor, not zero, on a linear scale', () => {
  type Row2 = { date: string; v: number }
  const atFloor: Row2[] = [{ date: '2026-08-01', v: 10 }]

  /** Heights of the bar rects only — scoped by `fill-opacity`, which the hover-overlay rect (also
   * a plain `<rect>`) never carries. */
  function heights(html: string): number[] {
    return [...html.matchAll(/<rect[^>]*\sheight="([^"]*)"[^>]*\sfill-opacity="[^"]*"/g)].map((m) =>
      Number(m[1]),
    )
  }

  test('a value equal to a pinned domain floor of 10 draws a zero-height bar, not one reaching scale(0)', () => {
    const { container } = render(
      <Bars<Row2>
        data={atFloor}
        chartId="bars-baseline-floor"
        getX={(d) => d.date}
        getValue={(d) => d.v}
        positiveBars={[{ key: 'v', label: 'V', color: '#111' }]}
        barLayout="grouped"
        y={{ domain: [10, 50] }}
      />,
    )
    const hs = heights(container.innerHTML)
    expect(hs.length).toBe(1)
    expect(hs[0]).toBe(0)
  })

  test('the same value against the default zero-floor axis draws a positive-height bar', () => {
    const { container } = render(
      <Bars<Row2>
        data={atFloor}
        chartId="bars-baseline-default"
        getX={(d) => d.date}
        getValue={(d) => d.v}
        positiveBars={[{ key: 'v', label: 'V', color: '#111' }]}
        barLayout="grouped"
      />,
    )
    const hs = heights(container.innerHTML)
    expect(hs.length).toBe(1)
    expect(hs[0]).toBeGreaterThan(0)
  })
})

describe('Bars — xLabelRotate', () => {
  test('is forwarded to CartesianChart and rotates the bottom axis tick labels', () => {
    const { container } = render(
      <Bars<Row>
        data={rows}
        chartId="bars-rotate"
        getX={(d) => d.date}
        getValue={(d, key) => d[key as 'shown' | 'quiet']}
        positiveBars={[{ key: 'shown', label: 'Shown', color: '#111' }]}
        xLabelRotate={45}
      />,
    )
    expect(container.innerHTML).toContain('transform="rotate(-45')
  })
})
