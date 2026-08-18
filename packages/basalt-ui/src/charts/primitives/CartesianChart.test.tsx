import { fireEvent, render, screen } from '@testing-library/react'
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
