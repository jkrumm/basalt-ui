/**
 * The pure core: cursor-group teardown, the container-class ladder, the height law, the x scale
 * models and the y domain law. No React, no DOM geometry.
 */
import { describe, expect, test } from 'bun:test'
import type { StoredChartSpec } from '@tanstack/charts/types/core'
import { compileCartesian, dateTicks, utcAxisDate, utcHeaderDate } from './compile'
import { chartCursor, chartCursorView, hasCursorGroup, hasCursorView } from './cursor'
import { chartCurve } from './curves'
import { resolveYDomain, xScaleFor, xZoneFractions } from './scales'
import { resolveChartState } from './state'
import { Lines } from './Lines'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
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

  test('setState on a group nothing subscribes to is a no-op and creates nothing', () => {
    chartCursor('write-only').setState(programmatic(day(1)))
    expect(hasCursorGroup('write-only')).toBe(false)
    expect(chartCursor('write-only').getState()).toBeNull()
  })

  test('a view no chart ever subscribes (a placeholder render) is swept after a microtask', async () => {
    chartCursorView('sweep', 'never-mounted', [day(1)], 'nearest')
    expect(hasCursorView('sweep', 'never-mounted')).toBe(true)
    await Promise.resolve()
    expect(hasCursorView('sweep', 'never-mounted')).toBe(false)
  })

  test('a subscribed view survives the sweep and goes after its last unsubscribe', async () => {
    const view = chartCursorView('sweep', 'mounted', [day(1)], 'nearest')
    const off = view.subscribe(() => {})
    await Promise.resolve()
    expect(hasCursorView('sweep', 'mounted')).toBe(true)
    off()
    await Promise.resolve()
    expect(hasCursorView('sweep', 'mounted')).toBe(false)
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
  const at = (width: number, height = 240): StoredChartSpec =>
    def.chart({ width, height, defaultTheme: {} as never })
  const labelTick = (spec: StoredChartSpec, scale: 'x' | 'y') => {
    const axis = spec.scales[scale]?.axis
    if (!axis || typeof axis !== 'object' || typeof axis.tickLabels !== 'object')
      throw new Error(`no ${scale} axis`)
    return axis.tickLabels
  }
  test('micro (< 240): no y axis, nano labels', () => {
    expect(yAxis(at(200))).toBe(false)
    expect(tickFont(at(200), 'x')).toBe(10)
  })
  test('compact (< 480) and short: y labels inside the plot, the left margin locked to zero', () => {
    const spec = at(360, 179)
    const tick = labelTick(spec, 'y')
    expect(tick.anchor).toBe('start')
    expect(tick.dx).toBeGreaterThan(0)
    expect(labelTick(spec, 'x').anchor).toBeFunction()
    expect(spec.margin).toEqual({ left: 0 })
    expect(tickFont(spec, 'x')).toBe(10)
  })
  test('compact at SHORT_CHART_HEIGHT (180) and above: a left gutter, margin and x anchor untouched', () => {
    for (const height of [180, 280]) {
      const spec = at(360, height)
      expect(labelTick(spec, 'y').anchor).toBeUndefined()
      expect(labelTick(spec, 'x').anchor).toBeUndefined()
      expect(spec.margin).toBeUndefined()
      expect(tickFont(spec, 'y')).toBe(10)
    }
  })
  test('an unmeasured height (0) never flips a compact chart inside', () => {
    const spec = at(360, 0)
    expect(labelTick(spec, 'y').anchor).toBeUndefined()
    expect(spec.margin).toBeUndefined()
  })
  test('regular and wide never put labels inside, however short', () => {
    for (const width of [640, 1000]) {
      const spec = at(width, 100)
      expect(labelTick(spec, 'y').anchor).toBeUndefined()
      expect(spec.margin).toBeUndefined()
    }
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

describe('scales', () => {
  test('x by value type: Date → time, number → linear, string → point; bars → band', () => {
    expect(xScaleFor([day(1), day(2)], false).kind).toBe('date')
    expect(xScaleFor([1, 2], false).kind).toBe('number')
    expect(xScaleFor(['a', 'b'], false).band).toBe(false)
    expect(xScaleFor([day(1), day(2)], true).band).toBe(true)
  })
  test('xDomain replaces the data extent: the same instant is the same fraction whatever the data spans', () => {
    const domain = [day(1), day(9)] as const
    const narrow = xScaleFor([day(3), day(4)], false, domain)
    const wide = xScaleFor([day(1), day(9)], false, domain)
    expect(narrow.extent).toEqual([day(1).getTime(), day(9).getTime()])
    expect(narrow.fraction(day(5))).toBe(0.5)
    expect(narrow.fraction(day(5))).toBe(wide.fraction(day(5)))
    // Numeric x, and a domain the data does not touch at all.
    expect(xScaleFor<number>([2, 3], false, [0, 10]).fraction(5)).toBe(0.5)
    expect(xScaleFor<number>([], false, [0, 10]).fraction(5)).toBe(0.5)
  })
  test('xDomain is ignored by a band or string x, and a degenerate domain falls back to the data', () => {
    expect(xScaleFor(['a', 'b'], false, ['a', 'b']).band).toBe(false)
    expect(xScaleFor([day(1), day(2)], true, [day(1), day(9)]).band).toBe(true)
    expect(xScaleFor([1, 3], false, [5, 5]).extent).toEqual([1, 3])
  })
  test('a large series does not overflow the stack computing the domain', () => {
    // 1M distinct values exceed the call-argument limit, so a spread into Math.min/max throws.
    const big = Array.from({ length: 1_000_000 }, (_, i) => i)
    const model = xScaleFor(big, false)
    expect(model.extent).toEqual([0, 999_999])
  })
  test('a NaN x falls back to the unit extent, as the spread did', () => {
    expect(xScaleFor([1, Number.NaN, 5], false).extent).toEqual([0, 1])
    expect(xScaleFor([Number.NaN, Number.NaN], false).extent).toEqual([0, 1])
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

describe('y domain law (resolveYDomain)', () => {
  type V = { v: number | null }
  const s: ChartSeries<V> = { key: 's', label: 'S', color: 'c', getValue: (d) => d.v }
  const at = (...vs: (number | null)[]): V[] => vs.map((n) => ({ v: n }))

  test('log: non-positive values drop out; the floor is the smallest positive value, padded', () => {
    const [lo, hi] = resolveYDomain({ scale: 'log' }, at(-5, 0, 10, 100), [s])
    expect(lo).toBeCloseTo(10 / 1.1)
    expect(hi).toBeCloseTo(110)
    expect(resolveYDomain({ scale: 'log' }, at(0, -1), [s])).toEqual([1, 10])
  })
  test('a flat series still has extent; all-null falls back to [0, 1]', () => {
    const [lo, hi] = resolveYDomain(undefined, at(5, 5), [s])
    expect(lo).toBe(0)
    expect(hi).toBeGreaterThan(5)
    expect(resolveYDomain(undefined, at(null, null), [s])).toEqual([0, 1])
    expect(resolveYDomain({ autoMaxFloor: 4 }, at(null), [s])).toEqual([0, 4])
  })
  test('a domain function receives the data and the visible series', () => {
    let seen: readonly ChartSeries<V>[] = []
    const domain = resolveYDomain({ domain: (_d, visible) => ((seen = visible), [1, 2]) }, at(3), [
      s,
    ])
    expect(domain).toEqual([1, 2])
    expect(seen.map((x) => x.key)).toEqual(['s'])
  })
  test('autoMinCeil: Infinity pads down from the data minimum instead of zero', () => {
    const [lo] = resolveYDomain({ autoMinCeil: Infinity }, at(78, 90), [s])
    expect(lo).toBeCloseTo(78 / 1.1)
    expect(resolveYDomain({ autoMinCeil: -10 }, at(5, 9), [s])[0]).toBeCloseTo(-11)
  })
  test('a stack hands a domain function the real series, never the synthetic totals', () => {
    let keys: string[] = []
    const def = compileCartesian({
      chartId: 'stack-fn',
      data: rows,
      x: (d) => d.t,
      series: [{ ...v, mark: 'bar' }],
      marks: () => [],
      band: true,
      stack: 'stacked',
      y: { domain: (_d, visible) => ((keys = visible.map((x) => x.key)), [0, 1]) },
    })
    def.chart({ width: 640, height: 240, defaultTheme: {} as never })
    expect(keys).toEqual(['v'])
  })
})

describe('compile edges', () => {
  test('a single x sample still gets an axis of width, with the point centred', () => {
    const model = xScaleFor([day(1)], false)
    expect(model.fraction(day(1))).toBeCloseTo(0.5)
    expect(xScaleFor([7], false).fraction(7)).toBeCloseTo(0.5)
  })

  test('marks naming an unknown series throw a message that names it', () => {
    const def = compileCartesian({
      chartId: 'unknown',
      data: rows,
      x: (d) => d.t,
      series: [v],
      marks: (plot) => (plot.rows('nope'), []),
    })
    expect(() => def.chart({ width: 640, height: 240, defaultTheme: {} as never })).toThrow(
      '[basalt] CartesianChart: marks asked for series "nope", not in `series`',
    )
  })

  test('state precedence: pending, then error, then empty', () => {
    expect(resolveChartState({ pending: true, error: new Error('x'), empty: true })).toBe('pending')
    expect(resolveChartState({ error: new Error('x'), empty: 'Nothing' })).toBe('error')
    expect(resolveChartState({ empty: 'Nothing' })).toBe('empty')
    expect(resolveChartState({ pending: false, error: null, empty: false })).toBeNull()
    expect(resolveChartState(undefined)).toBeNull()
  })

  test('with y2, a right-side zone is drawn on the right scale', () => {
    type R = { t: Date; a: number; b: number }
    const data: R[] = [1, 2, 3].map((d) => ({ t: day(d), a: d * 10, b: d / 10 }))
    const html = renderToString(
      createElement(Lines<R, Date>, {
        ariaLabel: 'z',
        data,
        x: (d) => d.t,
        y: { domain: [0, 40] },
        y2: { domain: [0, 0.4] },
        legend: false,
        series: [
          { key: 'a', label: 'A', color: 'c1', getValue: (d) => d.a },
          { key: 'b', label: 'B', color: 'c2', getValue: (d) => d.b, axis: 'right' },
        ],
        // Half of the RIGHT domain: on the left scale it would be a hairline.
        zones: [{ from: 0, to: 0.2, fill: 'zone-fill', axisSide: 'right' }],
      }),
    )
    const zone = html.match(/<rect[^>]*fill="zone-fill"[^>]*>/)?.[0] ?? ''
    const height = Number(zone.match(/height="([\d.]+)"/)?.[1])
    const clip = Number(html.match(/<clipPath[^>]*><rect[^>]*height="([\d.]+)"/)?.[1])
    expect(height / clip).toBeCloseTo(0.5, 1)
  })
})

describe('string x follower', () => {
  test('a string-keyed view takes a foreign value verbatim, and an unsnapped one stays the same object', () => {
    const off = chartCursor('str').subscribe(() => {})
    const view = chartCursorView('str', 'cat', ['a', 'b', 'c'], 'nearest')
    const state = { anchor: 'value', value: { x: 'b' }, source: 'programmatic' } as never
    chartCursor('str').setState(state)
    expect(view.getState()).toBe(state)
    off()
    chartCursor('str').setState(null)
  })
})
