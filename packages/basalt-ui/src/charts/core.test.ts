/**
 * The pure core: cursor-group teardown, the container-class ladder, the height law, the x scale
 * models and the y domain law. No React, no DOM geometry.
 */
import { describe, expect, test } from 'bun:test'
import type { StoredChartSpec } from '@tanstack/charts/types/core'
import { compileCartesian, dateTicks, utcAxisDate, utcHeaderDate } from './compile'
import { chartCursor, chartCursorView, hasCursorGroup } from './cursor'
import { chartCurve } from './curves'
import { resolveYDomain, xScaleFor, xZoneFractions } from './scales'
import { resolveChartSize } from './sizing'
import type { ChartSeries } from './types'

type Row = { t: Date; v: number | null }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const rows: Row[] = [1, 2, 3, 4, 5].map((d) => ({ t: day(d), v: d * 10 }))
const v: ChartSeries<Row> = { key: 'v', label: 'V', color: 'var(--vx-line)', getValue: (d) => d.v }
const programmatic = (x: Date) =>
  ({ anchor: 'value', value: { x }, source: 'programmatic' }) as never

describe('cursor groups', () => {
  test('a group exists while it has subscribers and is dropped after the last unsubscribe', async () => {
    const cursor = chartCursor('teardown')
    expect(hasCursorGroup('teardown')).toBe(false)
    const a = cursor.subscribe(() => {})
    const b = cursor.subscribe(() => {})
    expect(hasCursorGroup('teardown')).toBe(true)
    a()
    a() // idempotent: a second call must not steal b's registration
    expect(hasCursorGroup('teardown')).toBe(true)
    b()
    // Deferred one microtask: a host re-binding unsubscribes before it resubscribes.
    expect(hasCursorGroup('teardown')).toBe(true)
    await Promise.resolve()
    expect(hasCursorGroup('teardown')).toBe(false)
  })

  test('an unsubscribe + resubscribe in one tick keeps the group and its state', async () => {
    const cursor = chartCursor('rebind')
    const a = cursor.subscribe(() => {})
    cursor.setState(programmatic(day(3)))
    a()
    const b = cursor.subscribe(() => {})
    await Promise.resolve()
    expect(cursor.getState()).not.toBeNull()
    b()
  })

  test('a chart keeps one cursor view across recompiles (TanStack compares it by reference)', () => {
    const first = chartCursorView('stable', 'c1', [day(1)], 'nearest')
    const again = chartCursorView('stable', 'c1', [day(1), day(2)], 'exact')
    expect(again).toBe(first)
    expect(chartCursorView('stable', 'c2', [day(1)], 'nearest')).not.toBe(first)
  })

  test('getState on a missing group is null and creates nothing', () => {
    expect(chartCursor('never-seen').getState()).toBeNull()
    expect(hasCursorGroup('never-seen')).toBe(false)
  })

  test('the same controller object per group (useSyncExternalStore never resubscribes)', () => {
    expect(chartCursor('same')).toBe(chartCursor('same'))
    expect(chartCursor()).not.toBe(chartCursor('same'))
  })

  test('groups are isolated', () => {
    const off = chartCursor('iso-a').subscribe(() => {})
    chartCursor('iso-a').setState(programmatic(day(2)))
    expect(chartCursor('iso-b').getState()).toBeNull()
    off()
  })

  test('the resolving view snaps a foreign value onto its own keys, identity-preserving', () => {
    const off = chartCursor('snap').subscribe(() => {})
    const weekly = [day(7), day(14)]
    const leading = chartCursorView('snap', 'w-lead', weekly, 'leading')
    const nearest = chartCursorView('snap', 'w-near', weekly, 'nearest')
    const state = programmatic(day(12))
    chartCursor('snap').setState(state)
    const x = (s: ReturnType<typeof leading.getState>) => (s?.anchor === 'value' ? s.value.x : null)
    expect(x(leading.getState())).toEqual(day(7))
    expect(x(nearest.getState())).toEqual(day(14))
    expect(leading.getState()).toBe(leading.getState()) // one memoized copy
    chartCursor('snap').setState(programmatic(day(7)))
    expect(leading.getState()).toBe(chartCursor('snap').getState()) // exact hit: the same object
    off()
    chartCursor('snap').setState(null)
  })

  test('charts whose x value types differ never sync', () => {
    const off = chartCursor('kinds').subscribe(() => {})
    chartCursor('kinds').setState(programmatic(day(3)))
    expect(chartCursorView('kinds', 'n', [1, 2, 3], 'nearest').getState()).toBeNull()
    off()
  })
})

const yAxis = (spec: StoredChartSpec) => spec.scales['y']?.axis
const tickFont = (spec: StoredChartSpec, scale: string): unknown => {
  const axis = spec.scales[scale]?.axis
  return axis && typeof axis === 'object' && typeof axis.tickLabels === 'object'
    ? axis.tickLabels.fontSize
    : undefined
}

const count = (spec: StoredChartSpec): number => {
  const axis = spec.scales['x']?.axis
  if (!axis || typeof axis !== 'object' || !axis.ticks) return 0
  return 'values' in axis.ticks ? (axis.ticks.values?.length ?? 0) : 0
}

describe('container-class ladder', () => {
  const def = compileCartesian({
    chartId: 'ladder',
    data: rows,
    x: (d) => d.t,
    series: [v],
    marks: () => [],
  })
  const at = (width: number): StoredChartSpec =>
    def.chart({ width, height: 240, defaultTheme: {} as never })
  test('micro (< 240): no y axis, nano labels', () => {
    expect(yAxis(at(200))).toBe(false)
    expect(tickFont(at(200), 'x')).toBe(10)
  })
  test('compact (< 480): y labels inside the plot, the left margin locked to zero', () => {
    const spec = at(360)
    const axis = yAxis(spec)
    if (!axis || typeof axis !== 'object' || typeof axis.tickLabels !== 'object')
      throw new Error('no y axis')
    expect(axis.tickLabels.anchor).toBe('start')
    expect(axis.tickLabels.dx).toBeGreaterThan(0)
    expect(spec.margin).toEqual({ left: 0 })
    expect(tickFont(spec, 'x')).toBe(10)
  })
  test('regular (< 800): labels outside, micro font', () => {
    const spec = at(640)
    expect(spec.margin).toBeUndefined()
    expect(tickFont(spec, 'y')).toBe(11)
  })
  test('wide: labels outside, more x ticks than regular', () => {
    const long = compileCartesian({
      chartId: 'wide',
      data: Array.from({ length: 60 }, (_, i) => ({ t: day(1 + i), v: i })),
      x: (d) => d.t,
      series: [v],
      marks: () => [],
    })
    const build = (width: number) => long.chart({ width, height: 240, defaultTheme: {} as never })
    expect(count(build(1000))).toBeGreaterThanOrEqual(count(build(640)))
  })
})

describe('height law', () => {
  test('width × class ratio, clamped 160–420', () => {
    expect(resolveChartSize({ width: 640, coarse: false, viewportH: 0 }).height).toBe(320)
    expect(resolveChartSize({ width: 200, coarse: false, viewportH: 0 }).height).toBe(160)
    expect(resolveChartSize({ width: 2000, coarse: false, viewportH: 0 }).height).toBe(420)
  })
  test('unmeasured (SSR) renders the regular class at 640', () => {
    const size = resolveChartSize({ width: 0, coarse: false, viewportH: 0 })
    expect(size).toEqual({ width: 640, containerClass: 'regular', height: 320 })
  })
  test('≤ 45vh on a coarse pointer, a literal height included', () => {
    expect(resolveChartSize({ width: 640, height: 400, coarse: true, viewportH: 400 }).height).toBe(
      180,
    )
    expect(
      resolveChartSize({ width: 640, height: 400, coarse: false, viewportH: 400 }).height,
    ).toBe(400)
  })
  test('a responsive height resolves per container class', () => {
    const height = { base: 150, wide: 260 }
    expect(resolveChartSize({ width: 300, height, coarse: false, viewportH: 0 }).height).toBe(150)
    expect(resolveChartSize({ width: 600, height, coarse: false, viewportH: 0 }).height).toBe(150)
    expect(resolveChartSize({ width: 900, height, coarse: false, viewportH: 0 }).height).toBe(260)
  })
})

describe('scales', () => {
  test('x by value type: Date → time, number → linear, string → point; bars → band', () => {
    expect(xScaleFor([day(1), day(2)], false).kind).toBe('date')
    expect(xScaleFor([1, 2], false).kind).toBe('number')
    expect(xScaleFor(['a', 'b'], false).band).toBe(false)
    expect(xScaleFor([day(1), day(2)], true).band).toBe(true)
  })
  test('a Date x is proportional: a gap in the data is a gap on the axis', () => {
    const model = xScaleFor([day(1), day(2), day(10)], false)
    expect(model.fraction(day(2))).toBeCloseTo(1 / 9)
  })
  test('an edge x-zone covers its terminal samples', () => {
    const model = xScaleFor(['a', 'b', 'c', 'd'], false)
    expect(xZoneFractions({ from: 'b', to: 'b', fill: 'x', align: 'edge' }, model)).toEqual([
      0.25, 0.5,
    ])
    expect(xZoneFractions({ from: 'b', to: 'b', fill: 'x' }, model)).toBeNull()
  })
  test('y domain: zero baseline, padded, floors clamp before the pad', () => {
    expect(resolveYDomain(undefined, rows, [v])).toEqual([0, 55.00000000000001])
    expect(resolveYDomain({ autoMaxFloor: 100 }, rows, [v])[1]).toBeCloseTo(110)
    expect(resolveYDomain({ domain: [0, 1] }, rows, [v])).toEqual([0, 1])
  })
  test('day-aligned date ticks never label one day twice', () => {
    const ticks = dateTicks([day(1), day(3)], 5, 86_400_000)
    expect(new Set(ticks.map(utcAxisDate)).size).toBe(ticks.length)
  })
  test('date labels read UTC, like the time scale', () => {
    expect(utcAxisDate(day(1))).toBe('01.09')
    expect(utcHeaderDate(day(1))).toBe('Tue Sep 1 2026')
  })
})

describe('curves', () => {
  test('monotone never overshoots a flat run; steps hold their value', () => {
    const flat = chartCurve('monotone').line([
      [0, 10],
      [10, 10],
      [20, 10],
    ])
    const ys = [...flat.matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]))
    expect(ys.length).toBeGreaterThan(2)
    expect(ys.every((y) => y === 10)).toBe(true)
    expect(
      chartCurve('stepAfter').line([
        [0, 0],
        [10, 5],
      ]),
    ).toBe('M0,0L10,0L10,5')
  })
})
