/**
 * The phone tier (`docs/CHARTS-SPEC.md` §8) — the resolver, the metric set, and one end-to-end
 * render proving the tier actually reaches the painted axis.
 *
 * The render half needs a MEASURED container, which the shared DOM preload cannot give: happy-dom
 * ships no `ResizeObserver` and `tests/setup/dom.ts` installs an inert no-op shim, so
 * `useParentSize` observes and is never called back — every SSR-style chart test in this repo
 * therefore runs at `containerW === 0`, i.e. permanently desktop. This file swaps in a shim that
 * reports one fixed box on `observe()`, which is exactly what a real observer does on its first
 * callback, and puts the original back afterwards so no other file inherits it.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { VX } from '../../tokens'
import type { ChartSeries } from '../series'
import { BandStrip } from '../kinds/BandStrip'
import { Heatmap } from '../kinds/Heatmap'
import { MirroredBars } from '../kinds/MirroredBars'
import { autoMargin } from '../layout/auto-margin'
import { CartesianChart } from './CartesianChart'
import { chartTierMetrics, resolveChartTier } from './chart-frame-layout'

describe('resolveChartTier — the MEASURED box, never a media query', () => {
  test('a phone-width box resolves to the phone tier', () => {
    expect(resolveChartTier(360)).toBe('phone')
  })

  test('a narrow grid cell on a wide screen resolves to phone too — that is the point', () => {
    expect(resolveChartTier(320)).toBe('phone')
  })

  test('the threshold itself is desktop — the tier is `< phoneChartWidth`', () => {
    expect(resolveChartTier(VX.phoneChartWidth)).toBe('desktop')
    expect(resolveChartTier(VX.phoneChartWidth - 1)).toBe('phone')
  })

  test('an UNMEASURED box is desktop — the first frame must not paint phone chrome it then undoes', () => {
    expect(resolveChartTier(0)).toBe('desktop')
    expect(resolveChartTier(-1)).toBe('desktop')
  })
})

describe('chartTierMetrics', () => {
  const desktop = chartTierMetrics('desktop')
  const phone = chartTierMetrics('phone')

  test('desktop is exactly today’s tokens — the tier moves nothing on a wide chart', () => {
    expect(desktop.axisFont).toBe(VX.axisFont)
    expect(desktop.legendFontSize).toBe(VX.legendFontSize)
    expect(desktop.dotR).toBe(VX.dotR)
    expect(desktop.margin).toEqual(VX.margin)
    expect(desktop.legendMaxRows).toBeUndefined()
  })

  test('the phone fonts are one step DOWN the shared ladder, not arbitrary pixels', () => {
    expect(phone.axisFont).toBe(VX.text.nano)
    expect(phone.legendFontSize).toBe(VX.text.xs)
    expect(phone.axisFont).toBeLessThan(desktop.axisFont)
    expect(phone.legendFontSize).toBeLessThan(desktop.legendFontSize)
  })

  test('every phone margin floor is tighter, and none of them collapses to zero', () => {
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      expect(phone.margin[side]).toBeLessThan(desktop.margin[side])
      expect(phone.margin[side]).toBeGreaterThan(0)
    }
  })

  test('the dot shrinks, the tooltip narrows, the legend gains a two-entry cap', () => {
    expect(phone.dotR).toBeLessThan(desktop.dotR)
    expect(phone.tooltipMinWidth).toBeLessThan(desktop.tooltipMinWidth)
    expect(phone.legendMaxRows).toBe(2)
  })

  test('it returns the SAME frozen object per tier — never a fresh one per render', () => {
    expect(chartTierMetrics('phone')).toBe(phone)
    expect(chartTierMetrics('desktop')).toBe(desktop)
  })
})

// ── the measured render ───────────────────────────────────────────────────────

const PHONE_WIDTH = 360
const CHART_HEIGHT = 240

type Row = { date: string; v: number }
const rows: Row[] = [
  { date: '2026-08-01', v: 10 },
  { date: '2026-08-02', v: 40 },
  { date: '2026-08-03', v: 25 },
]
const series: ChartSeries<Row>[] = [
  { key: 'v', label: 'v', color: '#000', mark: 'line', getValue: (d) => d.v },
]

const originalResizeObserver = window.ResizeObserver

function installFixedWidthObserver(width: number): void {
  class FixedBoxResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(): void {
      this.callback(
        [{ contentRect: { width, height: CHART_HEIGHT, top: 0, left: 0 } }] as never,
        this as never,
      )
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver = FixedBoxResizeObserver as unknown as typeof ResizeObserver
}

describe(`a chart measured at ${PHONE_WIDTH}px paints the phone tier`, () => {
  beforeAll(() => installFixedWidthObserver(PHONE_WIDTH))
  afterAll(() => {
    window.ResizeObserver = originalResizeObserver
  })

  test('every axis tick label is painted at the smaller tick font', async () => {
    const { container } = render(
      <CartesianChart
        data={rows}
        chartId="tier"
        getX={(d) => d.date}
        series={series}
        height={CHART_HEIGHT}
        ariaLabel="Tiered"
      >
        {() => null}
      </CartesianChart>,
    )

    // The unmeasured first frame paints the desktop tier by design (see resolveChartTier(0));
    // the phone frame follows once the box is measured. Wait for THAT paint, not for the first
    // `<text>` — on a slow runner the first paint is the desktop one and the assertion must not
    // race it.
    const fontSizes = () =>
      new Set([...container.querySelectorAll('text')].map((node) => node.getAttribute('font-size')))
    await waitFor(() => {
      expect(fontSizes()).toEqual(new Set([String(chartTierMetrics('phone').axisFont)]))
    })
    expect(fontSizes().has(String(VX.axisFont))).toBe(false)
  })

  test('the legend renders at the phone label size', async () => {
    render(
      <CartesianChart
        data={rows}
        chartId="tier-legend"
        getX={(d) => d.date}
        series={[
          series[0] as ChartSeries<Row>,
          { ...series[0], key: 'w', label: 'w' } as ChartSeries<Row>,
        ]}
        height={CHART_HEIGHT}
        legend={{}}
      >
        {() => null}
      </CartesianChart>,
    )

    const entry = await screen.findByRole('button', { name: 'v' })
    const legend = entry.parentElement
    expect(legend?.style.fontSize).toBe(`${chartTierMetrics('phone').legendFontSize}px`)
  })
})

/** Install the fixed-box observer for one `describe`, and put the original back after it. */
function measuredAt(width: number): void {
  beforeAll(() => installFixedWidthObserver(width))
  afterAll(() => {
    window.ResizeObserver = originalResizeObserver
  })
}

/** The plot `Group`'s offsets — i.e. the resolved left and top margins. */
function plotOrigin(markup: string): { left: number; top: number } {
  const m = /visx-group" transform="translate\(([\d.]+), ([\d.]+)\)/.exec(markup)
  return { left: Number(m?.[1] ?? '0'), top: Number(m?.[2] ?? '0') }
}

/** The bottom axis' own `top` inside the plot Group. */
function axisTop(markup: string): number {
  return Number(/visx-axis-bottom" transform="translate\(0, ([\d.]+)\)/.exec(markup)?.[1] ?? '0')
}

/**
 * The bottom margin a kind actually resolved: the frame's own height, less the plot origin, less
 * the height the axis was pushed down to. Derived rather than asserted from an internal, so it
 * reads the same number the reader sees.
 */
function bottomMarginOf(container: HTMLElement): number {
  const svgHeight = Number(container.querySelector('svg')?.getAttribute('height') ?? '0')
  const markup = container.innerHTML
  return svgHeight - plotOrigin(markup).top - axisTop(markup)
}

const WIDE_X = (key: string): string => `${key} 14:00 CEST`

/**
 * §8's "the tick font is threaded into the MEASUREMENT, not just the paint". `useBandPlot` owns the
 * gutters for both band kinds and read neither half of the tier, so a 360px `BandStrip` measured
 * its bottom gutter at the DESKTOP tick font while `AxisBottomDate` painted the phone one —
 * measured ≠ painted, in the one place no `CartesianChart` call site could catch it.
 */
describe(`useBandPlot measures at the tier it paints (${PHONE_WIDTH}px)`, () => {
  measuredAt(PHONE_WIDTH)

  const phone = chartTierMetrics('phone')
  const bandRows = [
    { key: '2026-08-01', up: 40, down: 800 },
    { key: '2026-08-02', up: 20, down: 400 },
    { key: '2026-08-03', up: 10, down: 200 },
  ]
  const xLabels = bandRows.map((d) => WIDE_X(d.key))

  /** What the bottom gutter must be if it was measured at the font the axis paints. */
  const expectedBottom = autoMargin({
    bottom: xLabels,
    fontPx: phone.axisFont,
    floor: phone.margin,
  }).bottom
  /** What it used to be — measured at the desktop font, against the desktop floors. */
  const desktopBottom = autoMargin({ bottom: xLabels }).bottom

  test('the two measurements genuinely differ — otherwise this whole file proves nothing', () => {
    expect(expectedBottom).not.toBe(desktopBottom)
  })

  test('BandStrip resolves the phone-font bottom gutter', async () => {
    const { container } = render(
      <BandStrip<(typeof bandRows)[number]>
        data={bandRows}
        chartId="band-tier"
        getX={(d) => d.key}
        formatX={WIDE_X}
        series={[{ key: 'ok', label: 'Up', color: '#0a0', mark: 'bar' }]}
        getBand={() => ({ state: 'ok' })}
        height={CHART_HEIGHT}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('.visx-axis-bottom')).not.toBeNull()
    })
    expect(bottomMarginOf(container)).toBe(expectedBottom)
  })

  test('MirroredBars does too — both kinds share the one hook', async () => {
    const { container } = render(
      <MirroredBars<(typeof bandRows)[number]>
        data={bandRows}
        chartId="mirror-tier"
        getX={(d) => d.key}
        formatX={WIDE_X}
        series={[
          { key: 'up', label: 'Up', color: '#0a0', mark: 'bar', getValue: (d) => d.up },
          { key: 'down', label: 'Down', color: '#00a', mark: 'bar', getValue: (d) => d.down },
        ]}
        up={{ key: 'up', format: (v) => `${v}u`, ticks: 2 }}
        down={{ key: 'down', format: (v) => `${v}d`, ticks: 2 }}
        height={CHART_HEIGHT}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('.visx-axis-bottom')).not.toBeNull()
    })
    expect(bottomMarginOf(container)).toBe(expectedBottom)
  })

  test('and both paint every tick at that same font — measured IS painted', async () => {
    const { container } = render(
      <BandStrip<(typeof bandRows)[number]>
        data={bandRows}
        chartId="band-font"
        getX={(d) => d.key}
        formatX={WIDE_X}
        series={[{ key: 'ok', label: 'Up', color: '#0a0', mark: 'bar' }]}
        getBand={() => ({ state: 'ok' })}
        height={CHART_HEIGHT}
      />,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('.visx-axis-bottom text').length).toBeGreaterThan(0)
    })
    const fonts = new Set(
      [...container.querySelectorAll('.visx-axis-bottom text')].map((n) =>
        n.getAttribute('font-size'),
      ),
    )
    expect(fonts).toEqual(new Set([String(phone.axisFont)]))
  })
})

/**
 * `Heatmap` paints its row/column labels and its gradient endpoints as plain `<text>` rather than
 * through `Axes.tsx`, so it was the one kind still hard-coding `VX.axisFont` after §8 landed.
 */
describe(`Heatmap reads the tier for its category labels (${PHONE_WIDTH}px)`, () => {
  measuredAt(PHONE_WIDTH)

  const cells = [
    { row: 'Mon', col: '08', v: 3 },
    { row: 'Tue', col: '09', v: 6 },
  ]

  test('every label — rows, columns and both legend endpoints — is at the phone tick font', async () => {
    const { container } = render(
      <Heatmap<(typeof cells)[number]>
        data={cells}
        chartId="heat-tier"
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
        legend={{ min: 'low', max: 'high' }}
        height={CHART_HEIGHT}
      />,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('text').length).toBeGreaterThan(0)
    })
    const fonts = new Set(
      [...container.querySelectorAll('text')].map((n) => n.getAttribute('font-size')),
    )
    expect(fonts).toEqual(new Set([String(chartTierMetrics('phone').axisFont)]))
    expect(fonts.has(String(VX.axisFont))).toBe(false)
  })
})

/**
 * §8's second consequence, end to end: an unset `xLabelRotate` auto-rotates at the phone tier when
 * the measured labels cannot fit three ticks side by side, and the rotated first label's leftward
 * projection widens the left gutter that used to clip it.
 */
describe(`wide labels auto-rotate at ${PHONE_WIDTH}px, and xLabelRotate: 0 opts out`, () => {
  measuredAt(PHONE_WIDTH)

  const renderRotating = async (props: Record<string, unknown> = {}): Promise<HTMLElement> => {
    const { container } = render(
      <CartesianChart
        data={rows}
        chartId={`rot-${JSON.stringify(props)}`}
        getX={(d: Row) => d.date}
        series={series}
        formatX={WIDE_X}
        legend={false}
        height={CHART_HEIGHT}
        {...props}
      >
        {() => null}
      </CartesianChart>,
    )
    await waitFor(() => {
      expect(container.querySelector('.visx-axis-bottom')).not.toBeNull()
    })
    return container
  }

  test('unset auto-rotates to 45 and widens the left margin over the opted-out chart', async () => {
    const auto = await renderRotating()
    const optedOut = await renderRotating({ xLabelRotate: 0 })

    expect(auto.innerHTML).toContain('transform="rotate(-45')
    expect(optedOut.innerHTML).not.toContain('transform="rotate(')
    expect(plotOrigin(auto.innerHTML).left).toBeGreaterThan(plotOrigin(optedOut.innerHTML).left)
  })

  test('an explicit 90 is painted as given — the caller always wins over the default', async () => {
    const container = await renderRotating({ xLabelRotate: 90 })
    expect(container.innerHTML).toContain('transform="rotate(-90')
    expect(container.innerHTML).toContain('text-anchor="end"')
  })
})

describe('the same wide labels at desktop width never auto-rotate', () => {
  measuredAt(1200)

  test('rotating spends bottom-gutter depth a wide chart never needed', async () => {
    const { container } = render(
      <CartesianChart
        data={rows}
        chartId="rot-desktop"
        getX={(d: Row) => d.date}
        series={series}
        formatX={WIDE_X}
        legend={false}
        height={CHART_HEIGHT}
      >
        {() => null}
      </CartesianChart>,
    )
    await waitFor(() => {
      expect(container.querySelector('.visx-axis-bottom')).not.toBeNull()
    })
    expect(container.innerHTML).not.toContain('transform="rotate(')
  })
})
