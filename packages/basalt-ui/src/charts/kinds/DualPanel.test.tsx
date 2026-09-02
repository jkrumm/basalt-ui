/**
 * `DualPanel` — the bottom-pane domain seam (`bottomYDomain`/`bottomMaxAbsFloor`) and `formatBar`
 * (tooltip-row-only override, `formatBottom` keeps owning the ticks). Same SSR harness as
 * `ChartFrame.test.tsx` for the axis-only assertions (no hover needed); the `formatBar` case needs
 * a live cursor, so it uses the real DOM harness + the overlay's keyboard path (parity with
 * `Bars.test.tsx`) — DualPanel has two `HoverOverlay`s sharing one cursor, but only the TOP one is
 * keyboard-focusable, so `getByRole('slider')` is unambiguous.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartCursorScope } from '../cursor/scope'
import { CartesianChart } from '../primitives/CartesianChart'
import { DualPanel } from './DualPanel'
import type { ChartSeries } from '../series'

type Row = { date: string; v: number; bar: number }

const rows: Row[] = [{ date: '2026-08-01', v: 10, bar: 0.02 }]

const series: ChartSeries<Row>[] = [
  { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
]

function renderStatic(bottomMaxAbsFloor?: number, bottomYDomain?: [number, number]): string {
  return renderToStaticMarkup(
    <DualPanel<Row>
      data={rows}
      chartId="dp-floor"
      getX={(d) => d.date}
      series={series}
      getBar={(d) => d.bar}
      barLabel="Bar"
      barColorPositive="#0a0"
      barColorNegative="#a00"
      formatTop={(v) => String(v)}
      formatBottom={(v) => v.toFixed(2)}
      {...(bottomMaxAbsFloor !== undefined && { bottomMaxAbsFloor })}
      {...(bottomYDomain !== undefined && { bottomYDomain })}
    />,
  )
}

describe('DualPanel — bottomMaxAbsFloor', () => {
  test('floors the symmetric max-abs so a near-zero plateau does not amplify to full height', () => {
    // The raw data's max abs is 0.02 — nowhere near the 0.5 floor, so "0.50" can only appear on
    // the bottom axis once the floor widens the domain.
    expect(renderStatic()).not.toContain('>0.50<')
    expect(renderStatic(0.5)).toContain('>0.50<')
  })
})

describe('DualPanel — per-point getMarker rendering', () => {
  test('renders exactly one circle per non-null marker, honouring color/r overrides', () => {
    const markerRows: Row[] = [
      { date: '2026-08-01', v: 10, bar: 0.02 },
      { date: '2026-08-02', v: 12, bar: 0.03 },
      { date: '2026-08-03', v: 9, bar: 0.01 },
    ]
    const markerSeries: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) =>
          d.date === '2026-08-01'
            ? { color: '#f00', r: 9 }
            : d.date === '2026-08-03'
              ? { r: 3 }
              : null,
      },
    ]

    const { container } = render(
      <DualPanel<Row>
        data={markerRows}
        chartId="dp-markers"
        getX={(d) => d.date}
        series={markerSeries}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
      />,
    )

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    expect(circles[0]?.getAttribute('fill')).toBe('#f00')
    expect(circles[0]?.getAttribute('r')).toBe('9')
    // No color override on the second marker — falls back to the series color.
    expect(circles[1]?.getAttribute('fill')).toBe('#111')
    expect(circles[1]?.getAttribute('r')).toBe('3')
  })
})

describe('DualPanel — getMarker fillOpacity/ring', () => {
  test('ring: false omits the stroke; fillOpacity defaults 1 and honors an override', () => {
    const markerRows: Row[] = [
      { date: '2026-08-01', v: 10, bar: 0.02 },
      { date: '2026-08-02', v: 12, bar: 0.03 },
    ]
    const markerSeries: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) =>
          d.date === '2026-08-01'
            ? { ring: false, fillOpacity: 0.7 }
            : d.date === '2026-08-02'
              ? {}
              : null,
      },
    ]

    const { container } = render(
      <DualPanel<Row>
        data={markerRows}
        chartId="dp-marker-ring"
        getX={(d) => d.date}
        series={markerSeries}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
      />,
    )

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    // ring: false — no stroke attribute at all.
    expect(circles[0]?.getAttribute('stroke')).toBeNull()
    expect(circles[0]?.getAttribute('fill-opacity')).toBe('0.7')
    // default marker — unchanged punched-out ring + full opacity.
    expect(circles[1]?.getAttribute('stroke')).not.toBeNull()
    expect(circles[1]?.getAttribute('fill-opacity')).toBe('1')
  })
})

describe('DualPanel — formatX', () => {
  test('a custom formatX renders on the bottom axis instead of the default DD.MM', () => {
    const { container } = render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-formatx"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        formatX={(key) => `X:${key}`}
      />,
    )
    expect(container.innerHTML).toContain('X:2026-08-01')
  })
})

describe('DualPanel — formatX reaches the margin measurement, not just the axis', () => {
  test('a formatter that widens x labels narrows the plot rect — the gutter grows to fit it', () => {
    function xLabelGutterWidth(formatX?: (key: string) => string): number {
      const { container, unmount } = render(
        <DualPanel<Row>
          data={rows}
          chartId="dp-margin"
          getX={(d) => d.date}
          series={series}
          getBar={(d) => d.bar}
          barLabel="Bar"
          barColorPositive="#0a0"
          barColorNegative="#a00"
          formatTop={(v) => String(v)}
          formatBottom={(v) => v.toFixed(2)}
          {...(formatX !== undefined && { formatX })}
        />,
      )
      // The transparent HoverOverlay rects are drawn at exactly `width={xMax}` — `plot.width` is
      // fixed under this DOM harness (no ResizeObserver, so `ChartFrame` falls back to its
      // `minWidth` floor), so a narrower `xMax` here can only mean a wider measured margin.
      const overlay = container.querySelector('rect[fill="transparent"]')
      const width = Number(overlay?.getAttribute('width'))
      unmount()
      return width
    }

    const defaultWidth = xLabelGutterWidth()
    const widenedWidth = xLabelGutterWidth(
      (key) => `Extremely Long Formatted Axis Label ${key} With Lots Of Extra Padding Text`,
    )
    expect(widenedWidth).toBeLessThan(defaultWidth)
  })
})

describe('DualPanel — tooltip.formatHeader', () => {
  test('overrides the tooltip header date text', async () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-formatheader"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        formatHeader={(key) => `hdr:${key}`}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(await screen.findByText('hdr:2026-08-01')).toBeTruthy()
  })
})

describe('DualPanel — ariaLabel reaches the slider, not only the frame', () => {
  test('both the outer group and the focusable slider carry the name', () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-arialabel"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        ariaLabel="Latency"
      />,
    )

    // The bug was precisely that the label stopped at the frame — assert both carry it.
    expect(screen.getByRole('group', { name: 'Latency' })).toBeTruthy()
    expect(screen.getByRole('slider', { name: 'Latency' })).toBeTruthy()
  })
})

describe('DualPanel — slider value attributes', () => {
  test('aria-valuemax is always present; aria-valuenow/valuetext appear only once a point is hovered', () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-slider-values"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
      />,
    )

    const slider = screen.getByRole('slider')
    expect(slider.getAttribute('aria-valuemax')).toBe('0')
    expect(slider.hasAttribute('aria-valuenow')).toBe(false)
    expect(slider.hasAttribute('aria-valuetext')).toBe(false)

    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(slider.getAttribute('aria-valuenow')).toBe('0')
    expect(slider.getAttribute('aria-valuetext')).toBe('01.08')
  })
})

describe('DualPanel — aria-valuetext reflects formatX', () => {
  test('a custom formatX also drives the hovered slider value text, not just the axis', () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-slider-formatx"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        formatX={(key) => `X:${key}`}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(slider.getAttribute('aria-valuetext')).toBe('X:2026-08-01')
  })
})

describe('DualPanel — only the top overlay is keyboard-focusable', () => {
  test('renders exactly one role="slider" element — the bottom overlay stays pointer-only', () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-one-slider"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
      />,
    )

    // Two focusable tab stops for one logical x-axis is exactly what the pointer-only bottom
    // overlay exists to prevent — this fails the moment a future edit adds onKeyDown there too.
    expect(screen.getAllByRole('slider')).toHaveLength(1)
  })
})

describe('DualPanel — fixed bottomYDomain ships verbatim (un-niced)', () => {
  test('bottom axis ticks come from the pinned domain, not the computed max-abs', () => {
    // Data's max abs is 0.02 — an auto domain would never produce a "5.00" tick. Pinning
    // bottomYDomain to [-5, 5] must still paint it.
    expect(renderStatic(undefined, [-5, 5])).toContain('>5.00<')
    expect(renderStatic()).not.toContain('>5.00<')
  })
})

describe('DualPanel — formatBar overrides only the tooltip row', () => {
  test('the bar tooltip row reads formatBar, not formatBottom', async () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-formatbar"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        formatBar={(v, d) => `${v.toFixed(3)} m/s (${d.date})`}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(await screen.findByText('0.020 m/s (2026-08-01)')).toBeTruthy()
  })
})

describe('DualPanel — cursorResolution threads through to sibling resolution', () => {
  // `DualPanel` composes `ChartFrame` + `useChartCursor` directly rather than `CartesianChart`, so
  // its forward runs through a different path than every other kind — verify it here rather than
  // assuming the `CartesianChart`-composing pattern (`Bars.test.tsx`) ports verbatim.
  //
  // `DualPanel` forwards `ariaLabel` onto its own keyboard overlay (parity with every other kind),
  // so the resolved bucket can be read straight off `aria-valuetext` — mirrors
  // `Bars.test.tsx`'s cursorResolution assertions.
  type DailyRow = { date: string; shown: number }
  type FoldedRow = { date: string; v: number; bar: number }

  const dailyRows: DailyRow[] = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    shown: i,
  }))
  const foldedRows: FoldedRow[] = [
    { date: '2026-08-01', v: 0, bar: 5 },
    { date: '2026-08-08', v: 1, bar: -5 },
  ]
  const dailySeries: ChartSeries<DailyRow>[] = [
    { key: 'shown', label: 'Shown', color: '#111', mark: 'line', getValue: (d) => d.shown },
  ]
  const foldedSeries: ChartSeries<FoldedRow>[] = [
    { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
  ]

  function renderPair(cursorResolution?: 'leading') {
    render(
      <ChartCursorScope>
        <CartesianChart<DailyRow>
          data={dailyRows}
          chartId="dp-cursor-daily"
          getX={(d) => d.date}
          series={dailySeries}
          ariaLabel="Daily"
        >
          {() => null}
        </CartesianChart>
        <DualPanel<FoldedRow>
          data={foldedRows}
          chartId="dp-cursor-folded"
          getX={(d) => d.date}
          series={foldedSeries}
          getBar={(d) => d.bar}
          barLabel="Bar"
          barColorPositive="#0a0"
          barColorNegative="#a00"
          formatTop={(v) => String(v)}
          formatBottom={(v) => v.toFixed(2)}
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

describe('DualPanel — onFollow (follower behaviour parity with CartesianChart)', () => {
  type SourceRow = { date: string; shown: number }
  const sourceRows: SourceRow[] = [{ date: '2026-08-01', shown: 10 }]
  const sourceSeries: ChartSeries<SourceRow>[] = [
    { key: 'shown', label: 'Shown', color: '#111', mark: 'line', getValue: (d) => d.shown },
  ]

  function renderPair(onFollow?: boolean, followerRows: Row[] = rows) {
    render(
      <ChartCursorScope>
        <CartesianChart<SourceRow>
          data={sourceRows}
          chartId="dp-of-source"
          getX={(d) => d.date}
          series={sourceSeries}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <DualPanel<Row>
          data={followerRows}
          chartId="dp-of-follower"
          getX={(d) => d.date}
          series={series}
          getBar={(d) => d.bar}
          barLabel="Bar"
          barColorPositive="#0a0"
          barColorNegative="#a00"
          formatTop={(v) => String(v)}
          formatBottom={(v) => v.toFixed(2)}
          ariaLabel="Follower"
          legend={false}
          {...(onFollow !== undefined && { onFollow })}
        />
      </ChartCursorScope>,
    )
  }

  test('onFollow: true renders the DualPanel tooltip while a sibling owns the cursor', async () => {
    renderPair(true)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    expect(await screen.findByText('V')).toBeTruthy()
  })

  test('without onFollow (default false), DualPanel renders no tooltip as a follower', async () => {
    renderPair()
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // The SOURCE still renders its own tooltip — only the DualPanel follower stays silent.
    expect(await screen.findByText('Shown')).toBeTruthy()
    expect(screen.queryByText('V')).toBeNull()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })

  test('the follower tooltip is not aria-live; the source is', async () => {
    renderPair(true)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // The FOLLOWER anchors synchronously off its own svg rect; the SOURCE positions against
    // `cursor.anchor`, which `useChartCursor` coalesces through `requestAnimationFrame` — one frame
    // later. So waiting on the follower's 'V' is no barrier for the source tooltip. Wait for the
    // PAIR, which is what's being asserted.
    const tooltips = await waitFor(() => {
      const found = screen.getAllByRole('tooltip')
      expect(found).toHaveLength(2)
      return found
    })
    const sourceTooltip = tooltips.find((t) => within(t).queryByText('Shown') !== null)
    const followerTooltip = tooltips.find((t) => within(t).queryByText('V') !== null)
    expect(sourceTooltip?.getAttribute('aria-live')).toBe('polite')
    expect(followerTooltip?.hasAttribute('aria-live')).toBe(false)
  })

  test('a follower whose domain never resolves the broadcast key renders no tooltip shell', async () => {
    const foreignRows: Row[] = [{ date: '2027-01-15', v: 99, bar: 0.5 }]
    renderPair(true, foreignRows)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    expect(await screen.findByText('Shown')).toBeTruthy()
    expect(screen.queryByText('V')).toBeNull()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })
})

/**
 * `BasaltProps` (`common/props.ts`): 98 of 123 exported components dropped `className`, so a
 * consumer needing one margin had to fork the component. A kind's root element is the
 * `ChartFrame` box it composes, so the assertion is that the class travels all the way down.
 */
describe('DualPanel — BasaltProps', () => {
  test('className and style land on the root element', () => {
    const { container } = render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-classname"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        className="my-chart"
        style={{ opacity: 0.5 }}
      />,
    )
    const root = container.querySelector('.my-chart')
    expect(root).not.toBeNull()
    expect((root as HTMLElement).style.opacity).toBe('0.5')
  })
})
