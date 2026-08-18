import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
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

  test('autoMaxFloor raises a low upper bound', () => {
    const [, max] = resolveAxisDomain({ autoMaxFloor: 500 }, rows, both)
    expect(max).toBe(500)
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
