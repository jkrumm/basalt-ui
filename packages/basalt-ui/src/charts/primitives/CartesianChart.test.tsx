import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartCursorScope } from '../cursor/scope'
import type { ChartSeries } from '../series'
import { CartesianChart, resolveAxisDomain } from './CartesianChart'

type Row = { date: string; a: number; b: number }

const rows: Row[] = [
  { date: '2026-08-01', a: 10, b: 4 },
  { date: '2026-08-02', a: 40, b: 6 },
  { date: '2026-08-03', a: 25, b: 5 },
]

const seriesFor = (key: 'a' | 'b'): ChartSeries<Row> => ({
  key,
  label: key,
  color: '#000',
  mark: 'line',
  getValue: (d) => d[key],
})

const both = [seriesFor('a'), seriesFor('b')]

describe('resolveAxisDomain', () => {
  test('a fixed tuple passes through untouched', () => {
    expect(resolveAxisDomain({ domain: [0, 100] }, rows, both)).toEqual([0, 100])
  })

  test('auto pads the upper bound away from zero and keeps the zero baseline', () => {
    const [min, max] = resolveAxisDomain(undefined, rows, both)
    expect(min).toBe(0)
    expect(max).toBeCloseTo(44, 5)
  })

  test('auto over an ALL-NEGATIVE series keeps the largest value inside the plot', () => {
    // `max * pad` would push the upper bound to -5.5, i.e. below the largest datum, clipping it.
    const negative: ChartSeries<Row>[] = [
      { ...seriesFor('a'), getValue: (d) => -d.a },
      { ...seriesFor('b'), getValue: (d) => -d.b },
    ]
    const [min, max] = resolveAxisDomain({ autoMinCeil: Infinity }, rows, negative)
    expect(max).toBeGreaterThanOrEqual(-4)
    expect(min).toBeLessThanOrEqual(-40)
  })

  test('autoMaxFloor raises a low upper bound, then pads it (mirrors autoMinCeil)', () => {
    // The floor clamps the RAW upper bound first (44 -> 500), padding applies after: 500 * 1.1.
    const [, max] = resolveAxisDomain({ autoMaxFloor: 500 }, rows, both)
    expect(max).toBeCloseTo(550, 5)
  })

  test('autoMaxFloor at exactly the padded case (dataMax 3.2, pad 1.1, floor 6) yields 6.6', () => {
    const single: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: () => 3.2 }]
    const [, max] = resolveAxisDomain({ autoMaxFloor: 6, autoPad: 1.1 }, rows, single)
    expect(max).toBeCloseTo(6.6, 5)
  })

  test('autoMaxFloor and autoMinCeil pad symmetrically — both clamp first, pad second', () => {
    // Upper: floor 6 clamps 3.2 -> 6, then pads to 6.6 (multiply, away from zero).
    const positive: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: () => 3.2 }]
    const [, max] = resolveAxisDomain({ autoMaxFloor: 6, autoPad: 1.1 }, rows, positive)
    expect(max).toBeCloseTo(6.6, 5)
    // Lower: ceil -6 clamps -3.2 -> -6, then pads to -6.6 (multiply, away from zero) — the mirror.
    const negative: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: () => -3.2 }]
    const [min] = resolveAxisDomain({ autoMinCeil: -6, autoPad: 1.1 }, rows, negative)
    expect(min).toBeCloseTo(-6.6, 5)
  })

  test('the domain follows the VISIBLE series — hiding the tall one shrinks the axis', () => {
    const [, withBoth] = resolveAxisDomain(undefined, rows, both)
    const [, onlyB] = resolveAxisDomain(undefined, rows, [seriesFor('b')])
    expect(onlyB).toBeLessThan(withBoth)
  })

  test('a domain function receives the data AND the visible series', () => {
    const domain = resolveAxisDomain(
      { domain: (data, visible) => [0, data.length * visible.length] },
      rows,
      both,
    )
    expect(domain).toEqual([0, 6])
  })

  test('empty data falls back to a usable unit domain', () => {
    expect(resolveAxisDomain(undefined, [], both)).toEqual([0, 1])
  })
})

describe('resolveAxisDomain — autoMaxFloor composed with an all-negative series', () => {
  // getValue -> -d.a - 20 over rows a=[10, 40, 25] yields [-30, -60, -45]: data max is -30, data
  // min is -60 — deliberately NOT a flat series, so this exercises the real clamp-then-pad path
  // rather than the degenerate flat-collapse branch covered separately below.
  const allNegative: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: (d) => -d.a - 20 }]

  test('a floor above the data max clamps to the floor, then pads TOWARD zero', () => {
    const [, max] = resolveAxisDomain({ autoMaxFloor: -10 }, rows, allNegative)
    // clamp: Math.max(-30, -10) = -10; padAutoUpper divides for a negative candidate (toward zero).
    expect(max).toBeCloseTo(-10 / 1.1, 10)
  })

  test('without a floor, the existing all-negative behavior is unchanged', () => {
    const [, max] = resolveAxisDomain(undefined, rows, allNegative)
    // no floor -> candidate stays the raw data max, -30.
    expect(max).toBeCloseTo(-30 / 1.1, 10)
  })

  test('autoMaxFloor / autoMinCeil clamp-then-pad symmetrically through resolveAxisDomain', () => {
    // Mirror series: same magnitudes, positive instead of negative (data min 30, not data max -30).
    const allPositive: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: (d) => d.a + 20 }]
    const [, maxFromFloor] = resolveAxisDomain({ autoMaxFloor: -10 }, rows, allNegative)
    const [minFromCeil] = resolveAxisDomain({ autoMinCeil: 10 }, rows, allPositive)
    expect(maxFromFloor).toBeCloseTo(-minFromCeil, 10)
  })
})

describe('resolveAxisDomain — overlay bounds', () => {
  test('a zone past the data stretches the axis instead of clipping', () => {
    const [, max] = resolveAxisDomain(undefined, rows, both, [0, 200])
    expect(max).toBeGreaterThanOrEqual(200)
  })

  test('a reference line below the data lowers the floor', () => {
    const [min] = resolveAxisDomain({ autoMinCeil: Infinity }, rows, both, [-30])
    expect(min).toBeLessThanOrEqual(-30)
  })

  test('infinite bounds ("top/bottom of axis") are ignored, not blown up', () => {
    const plain = resolveAxisDomain(undefined, rows, both)
    expect(resolveAxisDomain(undefined, rows, both, [-Infinity, Infinity])).toEqual(plain)
  })
})

describe('resolveAxisDomain — degenerate input', () => {
  test('a flat all-zero series still gets a usable axis, not a zero-extent scale', () => {
    const flat: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: () => 0 }]
    const [min, max] = resolveAxisDomain(undefined, rows, flat)
    expect(max).toBeGreaterThan(min)
  })

  test('a flat non-zero series is not collapsed onto its own value', () => {
    const flat: ChartSeries<Row>[] = [{ ...seriesFor('a'), getValue: () => 7 }]
    const [min, max] = resolveAxisDomain({ autoMinCeil: Infinity }, rows, flat)
    expect(max).toBeGreaterThan(min)
  })
})

describe('AxisConfig.nice — threaded to BOTH the probe and the real scale', () => {
  // A fixed, deliberately non-round domain: d3's `.ticks()` never produces a tick past the raw
  // domain max (95.7) without `nice`, but WITH `nice` the scale first rounds its domain outward
  // (e.g. to 100), so a tick at "100" can only appear on the `nice: true` render.
  function renderChart(nice: boolean): string {
    return renderToStaticMarkup(
      <CartesianChart<Row>
        data={rows}
        chartId="nice-test"
        getX={(d) => d.date}
        series={[seriesFor('a')]}
        y={{ domain: [0, 95.7], ticks: 5, format: (v) => String(v), nice }}
      >
        {() => null}
      </CartesianChart>,
    )
  }

  test('nice: false never paints a tick past the raw domain max', () => {
    expect(renderChart(false)).not.toContain('>100<')
  })

  test('nice: true rounds the scale outward — a tick beyond the raw domain max appears', () => {
    expect(renderChart(true)).toContain('>100<')
  })
})

describe('cursorResolution — threads through to sibling resolution (CartesianChart)', () => {
  // Daily calendar Aug 01–14, plus a sibling folded into 2 weekly buckets keyed by each week's
  // leading day (Aug 01, Aug 08) — the exact shape of the playground's "Weekly digest" pairing.
  const dailyRows: Row[] = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    a: i,
    b: i,
  }))
  const foldedRows: Row[] = [
    { date: '2026-08-01', a: 0, b: 0 },
    { date: '2026-08-08', a: 1, b: 1 },
  ]

  function renderPair(cursorResolution?: 'leading') {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={dailyRows}
          chartId="daily"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Daily"
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={foldedRows}
          chartId="folded"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Folded"
          {...(cursorResolution !== undefined && { cursorResolution })}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )
  }

  // Drives the daily chart to Aug 05 — the back half of the Aug 01–07 bucket (its midpoint is
  // Aug 04) — via 5 keyboard ArrowRights from an unfocused slider (1st press lands on index 0).
  function driveDailyToAug05() {
    const dailySlider = screen.getByRole('slider', { name: 'Daily' })
    for (let i = 0; i < 5; i++) fireEvent.keyDown(dailySlider, { key: 'ArrowRight' })
  }

  test("cursorResolution='leading' resolves the back-half day to the bucket it's INSIDE, not the following one", () => {
    renderPair('leading')
    driveDailyToAug05()
    const foldedSlider = screen.getByRole('slider', { name: 'Folded' })
    // Aug 05 is inside the Aug01-07 bucket — 'leading' must resolve to its leading key, Aug 01.
    expect(foldedSlider.getAttribute('aria-valuetext')).toBe('01.08')
  })

  test("without the prop (default 'nearest'), the same daily hover lands on the FOLLOWING bucket — proves cursorResolution actually threads through, not just the resolver it wraps", () => {
    renderPair()
    driveDailyToAug05()
    const foldedSlider = screen.getByRole('slider', { name: 'Folded' })
    // Aug 05 is closer to Aug 08 (distance 3) than Aug 01 (distance 4) — 'nearest' picks Aug 08.
    expect(foldedSlider.getAttribute('aria-valuetext')).toBe('08.08')
  })
})

describe('tooltip extraRows — ctx.visible/ctx.hidden track legend toggling', () => {
  test('toggling a series off via its legend entry updates the ctx the row reads', async () => {
    render(
      <CartesianChart<Row>
        data={rows}
        chartId="extra-rows-ctx"
        getX={(d) => d.date}
        series={both}
        tooltip={{
          extraRows: (_d, ctx) => (
            <div data-testid="extra-ctx">
              visible:{ctx.visible.map((s) => s.key).join(',')}|hidden:
              {[...ctx.hidden].join(',')}
            </div>
          ),
        }}
      >
        {() => null}
      </CartesianChart>,
    )

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect((await screen.findByTestId('extra-ctx')).textContent).toContain('visible:a,b|hidden:')

    fireEvent.click(screen.getByRole('button', { name: 'b' }))

    expect((await screen.findByTestId('extra-ctx')).textContent).toContain('visible:a|hidden:b')
  })
})

describe('tooltip.onFollow — the follower renders when a SIBLING owns the cursor', () => {
  function renderPair(onFollow?: boolean) {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="of-source"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={rows}
          chartId="of-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ follow: false, ...(onFollow !== undefined && { onFollow }) }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )
  }

  test('onFollow: true renders the follower tooltip rows while the source owns the cursor', async () => {
    renderPair(true)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    expect(await screen.findByText('b')).toBeTruthy()
  })

  test('without onFollow (default false), the follower renders no tooltip at all', async () => {
    renderPair()
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // The SOURCE still renders its own tooltip ('a') — only the follower ('b') stays silent.
    expect(await screen.findByText('a')).toBeTruthy()
    expect(screen.queryByText('b')).toBeNull()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })

  // `follow` is deliberately left at its default (true, pointer-tracking) here — unlike every
  // other case in this file, which hardcodes `follow: false` on the follower. That hardcoding
  // means `useAnchoredPosition`'s FIRST clause (`tooltipCfg?.follow === false`) always already
  // satisfies the anchored branch, so those tests can't tell `|| isFollowerRender` apart from a
  // no-op. With `follow` left at its pointer-tracking default, anchoring can only come from
  // `isFollowerRender` — and a follower's own `cursor.anchor` (set only by pointer/keyboard
  // events ON THIS CHART, never by a sibling's) stays null for the whole test, since only the
  // SOURCE is ever interacted with. So: `isFollowerRender` present → anchored position resolves
  // from the crosshair and the tooltip mounts; `isFollowerRender` absent → the pointer-tracking
  // branch falls through to the follower's own (never-set) `cursor.anchor`, which is null, and
  // `ChartTooltipFloat` renders nothing at all for a null anchor. Presence/absence of the
  // follower tooltip is what's observable here — happy-dom zeroes every `getBoundingClientRect`,
  // so the anchor's actual pixel coordinates can't discriminate the two branches.
  test('onFollow: true with follow left at its pointer-tracking default still anchors to the crosshair', async () => {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="of-anchor-source"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={rows}
          chartId="of-anchor-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ onFollow: true }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    expect(await screen.findByText('b')).toBeTruthy()
  })
})

describe('tooltip.onFollow — aria-live stays SOURCE-only', () => {
  test('the source tooltip is aria-live; the follower tooltip is not', async () => {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="al-source"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={rows}
          chartId="al-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ follow: false, onFollow: true }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // The FOLLOWER anchors synchronously off its own svg rect, so its tooltip is in the DOM on the
    // tick the broadcast lands. The SOURCE positions against `cursor.anchor`, which
    // `useChartCursor` deliberately coalesces through `requestAnimationFrame` — one frame later.
    // So waiting on the follower's 'b' is no barrier at all for the source tooltip: that only ever
    // held because happy-dom mocks rAF with `setImmediate`, which usually — not reliably — lands
    // before Testing Library's async drain. Wait for the PAIR, which is what's being asserted.
    const tooltips = await waitFor(() => {
      const found = screen.getAllByRole('tooltip')
      expect(found).toHaveLength(2)
      return found
    })
    const sourceTooltip = tooltips.find((t) => within(t).queryByText('a') !== null)
    const followerTooltip = tooltips.find((t) => within(t).queryByText('b') !== null)
    expect(sourceTooltip?.getAttribute('aria-live')).toBe('polite')
    expect(followerTooltip?.hasAttribute('aria-live')).toBe(false)
  })
})

describe('tooltip.onFollow — a follower whose domain never resolves the broadcast key renders nothing', () => {
  test('an unrelated calendar stays silent, not an empty tooltip shell', async () => {
    const foreignRows: Row[] = [{ date: '2027-01-15', a: 99, b: 99 }]

    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="unres-source"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={foreignRows}
          chartId="unres-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ follow: false, onFollow: true }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // The SOURCE still renders its own tooltip — only the follower with no resolvable point stays
    // silent, rather than mounting an empty tooltip shell.
    expect(await screen.findByText('a')).toBeTruthy()
    expect(screen.queryByText('b')).toBeNull()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })
})

describe('cursor partitions by x-domain kind — a band chart never follows a time chart', () => {
  const categoryRows: Row[] = [
    { date: 'Visited', a: 100, b: 100 },
    { date: 'Added to cart', a: 40, b: 40 },
    { date: 'Purchased', a: 10, b: 10 },
  ]

  const numericRows: Row[] = [
    { date: '0', a: 5, b: 5 },
    { date: '1', a: 6, b: 6 },
    { date: '2', a: 7, b: 7 },
  ]

  test('a category-keyed chart renders no crosshair while a date-keyed sibling owns the cursor', async () => {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="kind-time-source"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={categoryRows}
          chartId="kind-band-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ follow: false, onFollow: true }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // The SOURCE (time) still renders its own tooltip — the follower (band) never resolves the
    // broadcast at all, because its kind differs, so it stays silent rather than mounting an empty
    // tooltip shell.
    expect(await screen.findByText('a')).toBeTruthy()
    expect(screen.queryByText('b')).toBeNull()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })

  test('a second date-keyed chart DOES render the crosshair at the same key — time charts on a page still share', async () => {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="kind-time-source-2"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={rows}
          chartId="kind-time-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ follow: false, onFollow: true }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    // Both charts are `'time'`-kinded, so the partition never fires and the pair keeps sharing.
    expect(await screen.findByText('a')).toBeTruthy()
    expect(await screen.findByText('b')).toBeTruthy()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(2)
  })

  // This is the case the OLD `parseKey`-only heuristic got wrong: a numeric domain and a date
  // domain both parse to a number, so `resolveCursorPoint` used to attempt (and by chance often
  // succeed at) resolving one against the other. Without `classifyDomain` gating the read, this
  // test fails — the follower would resolve the source's broadcast key and render 'b'.
  test('a numeric-keyed chart does not follow a date-keyed sibling either', async () => {
    render(
      <ChartCursorScope>
        <CartesianChart<Row>
          data={rows}
          chartId="kind-time-source-3"
          getX={(d) => d.date}
          series={[seriesFor('a')]}
          ariaLabel="Source"
          legend={false}
        >
          {() => null}
        </CartesianChart>
        <CartesianChart<Row>
          data={numericRows}
          chartId="kind-linear-follower"
          getX={(d) => d.date}
          series={[seriesFor('b')]}
          ariaLabel="Follower"
          legend={false}
          tooltip={{ follow: false, onFollow: true }}
        >
          {() => null}
        </CartesianChart>
      </ChartCursorScope>,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Source' }), { key: 'ArrowRight' })

    expect(await screen.findByText('a')).toBeTruthy()
    expect(screen.queryByText('b')).toBeNull()
    expect(screen.queryAllByRole('tooltip')).toHaveLength(1)
  })
})

/**
 * `xTickValues` — the seam a tick COUNT cannot express.
 *
 * `smartTicks`/`smartTicksEvery` append the final key unconditionally, so when the step misses the
 * last index that appended tick lands a partial step from its neighbour and two rich labels print
 * on top of each other at the right edge. No count fixes that; only choosing the VALUES does. It is
 * the same prop `BandStrip`/`MirroredBars` take, so the seam does not fork by kind.
 */
describe('CartesianChart — xTickValues', () => {
  const many: Row[] = Array.from({ length: 12 }, (_, i) => ({
    date: `2026-08-${String(i + 1).padStart(2, '0')}`,
    a: i,
    b: i,
  }))

  const axisText = (markup: string): string =>
    (/<g class="visx-axis-bottom[\s\S]*?<\/g><\/g>/.exec(markup)?.[0] ?? markup).replace(
      /<[^>]+>/g,
      ' ',
    )

  const renderWith = (props: Partial<Parameters<typeof CartesianChart<Row>>[0]>): string =>
    renderToStaticMarkup(
      <CartesianChart<Row>
        data={many}
        chartId="ctv"
        getX={(d) => d.date}
        series={[seriesFor('a')]}
        legend={false}
        formatX={(key) => key}
        {...props}
      >
        {() => null}
      </CartesianChart>,
    )

  test('picks exactly the keys the callback returns, and is handed the width to pick from', () => {
    const seen: { count: number; width: number }[] = []
    const markup = renderWith({
      xTickValues: (keys, xMax) => {
        seen.push({ count: keys.length, width: xMax })
        return ['2026-08-02', '2026-08-07']
      },
    })
    // Every key reaches the callback, alongside the plot width the chart already measured —
    // which is the second half of the seam: no `useChartSize` box outside the chart.
    expect(seen[0]?.count).toBe(12)
    expect(seen[0]?.width).toBeGreaterThan(0)

    const text = axisText(markup)
    expect(text).toContain('2026-08-02')
    expect(text).toContain('2026-08-07')
    // ...and nothing else. A count could never have produced this pair.
    expect(text).not.toContain('2026-08-01')
    expect(text).not.toContain('2026-08-12')
  })

  test('takes precedence over xTicks, which keeps working on its own', () => {
    const both = axisText(renderWith({ xTicks: 6, xTickValues: () => ['2026-08-05'] }))
    expect(both).toContain('2026-08-05')
    expect(both).not.toContain('2026-08-01')

    // The count form is untouched: `smartTicksEvery` still appends the final key.
    const countOnly = axisText(renderWith({ xTicks: 3 }))
    expect(countOnly).toContain('2026-08-01')
    expect(countOnly).toContain('2026-08-12')
  })

  test('returning no values draws a bare axis rather than falling back to smartTicks', () => {
    const text = axisText(renderWith({ xTickValues: () => [] }))
    expect(text).not.toContain('2026-08-')
  })
})
