/**
 * `area: 'zones'`: the gradient's stops sit at the zone boundaries of the AREA's box. Unit cases on
 * `zoneAreaGradient`, then the rendered stops through `Lines` (axis choice, y domain without 0, log).
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { zoneAreaGradient } from './compile'
import { Lines } from './Lines'
import type { ChartSeries, ZoneSpec } from './types'

const zone = (from: number, to: number, fill: string): ZoneSpec => ({ from, to, fill })
const offsets = (zones: readonly ZoneSpec[], values: readonly (number | null)[]): number[] | null =>
  zoneAreaGradient(0, zones, values)?.stops.map((s) => s.offset) ?? null

describe('zoneAreaGradient', () => {
  const zones = [zone(0, 25, 'a'), zone(25, 50, 'b'), zone(50, Infinity, 'c')]

  test('places boundaries at (ceiling - v) / span, hard between neighbours', () => {
    expect(offsets(zones, [10, 80])).toEqual([0, 0.375, 0.375, 0.6875, 0.6875, 1])
  })

  test('no usable values, or no span, is no gradient', () => {
    expect(offsets(zones, [null, null])).toBeNull()
    expect(offsets(zones, [])).toBeNull()
    expect(offsets(zones, [Number.NaN, Infinity])).toBeNull()
    expect(offsets(zones, [0, 0])).toBeNull()
  })

  test('all-negative values span down from 0', () => {
    const g = offsets([zone(-Infinity, -50, 'low'), zone(-50, 0, 'mid')], [-80, -20])
    expect(g).toEqual([0, 0.625, 0.625, 1])
  })

  test('a zone outside the range contributes nothing', () => {
    expect(offsets([zone(200, 300, 'x')], [10, 80])).toBeNull()
    expect(offsets([zone(200, 300, 'x'), zone(0, 40, 'y')], [10, 80])).toEqual([0.5, 1])
  })

  test('a boundary equal to the minimum or maximum is not a stop beyond the box', () => {
    expect(offsets([zone(0, 80, 'x')], [10, 80])).toEqual([0, 1])
    expect(offsets([zone(80, 100, 'x')], [10, 80])).toBeNull()
  })

  test('overlapping zones and repeated infinite bounds stay finite and monotonic', () => {
    const g = offsets(
      [
        zone(0, 60, 'a'),
        zone(40, Infinity, 'b'),
        zone(50, Infinity, 'c'),
        zone(Number.NaN, 5, 'd'),
      ],
      [10, 80],
    )
    expect(g).not.toBeNull()
    for (const [i, o] of (g ?? []).entries()) {
      expect(Number.isFinite(o)).toBe(true)
      expect(o).toBeGreaterThanOrEqual(0)
      expect(o).toBeLessThanOrEqual(1)
      if (i > 0) expect(o).toBeGreaterThanOrEqual((g ?? [])[i - 1] as number)
    }
  })
})

type Row = { t: Date; v: number }
const data: Row[] = [50, 60, 80].map((v, i) => ({ t: new Date(Date.UTC(2026, 8, i + 1)), v }))
const base: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'var(--vx-line)',
  getValue: (d) => d.v,
  area: 'zones',
}
const render = (props: Partial<Parameters<typeof Lines<Row, Date>>[0]>): string =>
  renderToString(<Lines ariaLabel="L" data={data} x={(d) => d.t} series={[base]} {...props} />)
const stopsOf = (html: string): { offset: number; color: string }[] => {
  const g = html.match(/<linearGradient[^>]*basalt-area-0[^>]*>(.*?)<\/linearGradient>/)
  return [...(g?.[1] ?? '').matchAll(/offset="([\d.]+)%" stop-color="([^"]+)"/g)].map((m) => ({
    offset: Number(m[1]),
    color: m[2] ?? '',
  }))
}
const left = zone(0, 100, 'var(--vx-bad)')
const right: ZoneSpec = { ...zone(0, 100, 'var(--vx-good)'), axisSide: 'right' }

describe('Lines area: zones', () => {
  test('a right-axis series takes only the right-axis zones', () => {
    const stops = stopsOf(
      render({ series: [{ ...base, axis: 'right' }], y2: {}, zones: [left, right] }),
    )
    expect(stops.length).toBe(2)
    expect(stops.every((s) => s.color.includes('var(--vx-good)'))).toBe(true)
  })

  test('a left zone does not colour a right-axis series; with none on its axis it keeps the fade', () => {
    const stops = stopsOf(render({ series: [{ ...base, axis: 'right' }], y2: {}, zones: [left] }))
    expect(stops.map((s) => s.color)[0]).toContain('var(--vx-line)')
  })

  test("axis: 'right' without y2 draws on the left axis, as the zones underlay does", () => {
    const stops = stopsOf(render({ series: [{ ...base, axis: 'right' }], zones: [left] }))
    expect(stops.every((s) => s.color.includes('var(--vx-bad)'))).toBe(true)
  })

  test('a y domain that excludes 0 keeps the box at the area baseline (value 0)', () => {
    const html = render({ y: { domain: [40, 100] }, zones: [zone(0, 60, 'a'), zone(60, 100, 'b')] })
    // The area closes to y(0), below the plot (clipped): box 0..80, so 60 sits at 25%.
    expect(stopsOf(html).map((s) => s.offset)).toEqual([0, 25, 25, 100])
  })

  test('a log axis throws in dev', () => {
    expect(() => render({ y: { scale: 'log' }, zones: [left] })).toThrow(/log axis/)
  })

  test('a log axis in production keeps the fade and logs once', () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const stops = stopsOf(render({ y: { scale: 'log' }, zones: [left] }))
      expect(stops[0]?.color).toContain('var(--vx-line)')
    } finally {
      if (env === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = env
    }
  })
})
