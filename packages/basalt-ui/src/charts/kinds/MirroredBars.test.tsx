/**
 * `MirroredBars` — the properties `DualPanel` provably cannot supply: two BAR panes (no line pane),
 * two INDEPENDENT domains resolved from two accessors (not one signed one), and absence hatched
 * across the full band rather than sitting on one side of a baseline.
 *
 * Under this DOM harness there is no ResizeObserver, so `ChartFrame` falls back to its `minWidth`
 * floor — `plot.width` is a fixed 200.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { ChartCursorScope } from '../cursor/scope'
import type { ChartSeries } from '../series'
import { MirroredBars } from './MirroredBars'

type Point = { key: string; down: number | null; up: number | null; absent: number }

const SERIES: ChartSeries<Point>[] = [
  { key: 'down', label: 'Download', color: '#06c', mark: 'bar', getValue: (d) => d.down },
  { key: 'up', label: 'Upload', color: '#999', mark: 'bar', getValue: (d) => d.up },
  { key: 'absent', label: 'Not measured', color: '#555', mark: 'bar', getValue: () => null },
]

const DATA: Point[] = [
  { key: '2026-08-01', down: 800, up: 40, absent: 0 },
  { key: '2026-08-02', down: 400, up: 20, absent: 0 },
  { key: '2026-08-03', down: null, up: null, absent: 1 },
]

function renderChart(props: Partial<Parameters<typeof MirroredBars<Point>>[0]> = {}) {
  return render(
    <ChartCursorScope>
      <MirroredBars<Point>
        data={DATA}
        chartId="mb"
        getX={(d) => d.key}
        series={SERIES}
        up={{ key: 'up', format: (v) => `${v}u`, ticks: 2 }}
        down={{ key: 'down', format: (v) => `${v}d`, ticks: 2 }}
        getAbsentFraction={(d) => d.absent}
        height={200}
        {...props}
      />
    </ChartCursorScope>,
  )
}

/** Tick label text of one left axis, in paint order (up pane first, down pane second). */
function axisText(container: HTMLElement, index: number): string {
  return container.querySelectorAll('.visx-axis-left')[index]?.textContent ?? ''
}

describe('MirroredBars — two panes, two independent domains', () => {
  test('each pane paints its OWN axis in its OWN units — a shared scale could print only one', () => {
    const { container } = renderChart({
      up: { key: 'up', format: (v) => `${v}u`, max: 100, ticks: 2 },
      down: { key: 'down', format: (v) => `${v}d`, max: 1000, ticks: 2 },
    })
    expect(container.querySelectorAll('.visx-axis-left')).toHaveLength(2)
    // Two axes, two domains, two unit suffixes — neither axis carries the other's numbers.
    expect(axisText(container, 0)).toContain('100u')
    expect(axisText(container, 0)).not.toContain('d')
    expect(axisText(container, 1)).toContain('1000d')
    expect(axisText(container, 1)).not.toContain('u')
  })

  test('an auto pane resolves from its OWN accessor: 40 up beside 800 down', () => {
    const { container } = renderChart()
    // `40` can only come from the up accessor's own maximum; on a shared [0, 800] scale d3 would
    // never place a tick there.
    expect(axisText(container, 0)).toContain('40u')
    expect(axisText(container, 1)).not.toContain('40d')
  })

  test('a pinned `max` on one pane leaves the other pane’s auto domain alone', () => {
    const { container } = renderChart({ up: { key: 'up', format: (v) => `${v}u`, max: 200 } })
    expect(axisText(container, 0)).toContain('200u')
    // Down stayed auto — its ticks still span its own 800 maximum, not the pinned 200.
    expect(axisText(container, 1)).toContain('500d')
    expect(axisText(container, 1)).not.toContain('200d')
  })

  test('`autoMaxFloor` widens a quiet pane without touching its sibling', () => {
    const withoutFloor = renderChart()
    expect(axisText(withoutFloor.container, 0)).toContain('40u')
    withoutFloor.unmount()

    const { container } = renderChart({
      up: { key: 'up', format: (v) => `${v}u`, autoMaxFloor: 500, ticks: 2 },
    })
    // The floor lifted the up domain well past its 40 maximum...
    expect(axisText(container, 0)).toContain('400u')
    expect(axisText(container, 0)).not.toContain('40u')
    // ...and the down pane is unmoved.
    expect(axisText(container, 1)).toContain('500d')
  })
})

describe('MirroredBars — geometry around the shared baseline', () => {
  test('up bars grow upward from the baseline, down bars downward, and both are proportional', () => {
    const { container } = renderChart()
    const rects = [...container.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('fill')?.startsWith('color-mix') === true,
    )
    // Two measured points × two panes.
    expect(rects).toHaveLength(4)
    const [up1, down1, up2, down2] = rects.map((r) => ({
      y: Number(r.getAttribute('y')),
      h: Number(r.getAttribute('height')),
    }))
    // Both panes share ONE baseline: the up bar's bottom edge equals the down bar's top edge.
    expect(up1!.y + up1!.h).toBeCloseTo(down1!.y, 5)
    expect(up2!.y + up2!.h).toBeCloseTo(down2!.y, 5)
    // Half the value, half the height — within each pane's own scale.
    expect(down2!.h / down1!.h).toBeCloseTo(0.5, 5)
    expect(up2!.h / up1!.h).toBeCloseTo(0.5, 5)
    // ...and the two panes are NOT on one scale: 40 up and 800 down draw comparable heights.
    expect(up1!.h).toBeGreaterThan(down1!.h * 0.2)
  })

  test('an unmeasured point hatches the FULL band, not one side of the baseline', () => {
    const { container } = renderChart()
    const hatched = [...container.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('fill') === 'url(#mb-mirrored-absent)',
    )
    expect(hatched).toHaveLength(1)
    expect(Number(hatched[0]?.getAttribute('y'))).toBe(0)
    const baselineLine = container.querySelector('line[stroke-width="1"]')
    const baselineY = Number(baselineLine?.getAttribute('y1'))
    expect(Number(hatched[0]?.getAttribute('height'))).toBeGreaterThan(baselineY)
  })

  test('a NaN value draws no bar at all rather than NaN geometry', () => {
    // `deriveTooltipRows` skips only null, so a NaN reaching `scaleLinear` used to emit
    // `y="NaN" height="NaN"` — a bar that silently fails to paint behind a React warning.
    const { container } = renderChart({
      data: [{ key: '2026-08-01', down: Number.NaN, up: Number.NaN, absent: 0 }],
    })
    expect(container.innerHTML).not.toContain('NaN')
    const painted = [...container.querySelectorAll('rect')].filter(
      (r) => r.getAttribute('fill')?.startsWith('color-mix') === true,
    )
    expect(painted).toHaveLength(0)
  })

  test('`getBarOpacity` dims a qualified measurement without changing its geometry', () => {
    const { container } = renderChart({ getBarOpacity: (d) => (d.key === '2026-08-02' ? 0.45 : 1) })
    const fills = [...container.querySelectorAll('rect')]
      .map((r) => r.getAttribute('fill'))
      .filter((f): f is string => f?.startsWith('color-mix') === true)
    expect(fills).toContain('color-mix(in srgb, #06c 45%, transparent)')
    expect(fills).toContain('color-mix(in srgb, #06c 100%, transparent)')
  })
})

describe('MirroredBars — legend toggle removes a pane whole', () => {
  test('hiding a pane drops its bars AND its axis together', () => {
    const { container } = renderChart()
    expect(container.querySelectorAll('.visx-axis-left')).toHaveLength(2)

    const toggle = container.querySelector('[data-legend-key="up"]')
    fireEvent.click(toggle as Element)

    expect(container.querySelectorAll('.visx-axis-left')).toHaveLength(1)
    expect(container.textContent).not.toContain('40u')
    expect(axisText(container, 0)).toContain('500d')
  })
})

describe('MirroredBars — tooltip rows are derived, each in its own pane’s units', () => {
  test('a pane row falls back to that pane’s formatter, never the other pane’s', async () => {
    renderChart({ ariaLabel: 'Carried' })
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('800d')
    expect(tip.textContent).toContain('40u')
    // The legend-only absence entry has no value, so it never becomes a row.
    expect(tip.textContent).not.toContain('Not measured')
  })

  test('an unmeasured point yields no pane rows at all rather than a fabricated zero', async () => {
    renderChart({ ariaLabel: 'Carried' })
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).not.toContain('Download')
    expect(tip.textContent).not.toContain('Upload')
  })
})
