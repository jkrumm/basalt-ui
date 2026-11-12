/**
 * One contract test per seam, each named for the consumer case it exists for. Every case runs
 * through the registry it is handed, so the meta-tests can hand it a registry without the seam and
 * watch it fail: a seam dropped from `seams.ts` cannot keep a green test.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToString } from 'react-dom/server'
import type { CartesianChartProps, Series, SeriesColor } from '../contract'
import { CartesianChart } from '../parts/cartesian'
import { cssColor, toEngineSpec } from '../parts/cartesian-adapt'
import { SEAM_MODULES, applySeams } from '../seams'
import type { SeamModule, SeamProps } from '../seams'
import { pixelExtent } from './pixel-extent'
import { pxToX, pxToY } from './plot-px'
import { plotScales } from './plot-scales'
import { boundedDomain, leftExtent } from './y-domain'
import type { GutteredSpec } from './y-gutter'

type Row = { t: Date; a: number | null; b: number | null }
const day = (i: number): Date => new Date(Date.UTC(2026, 8, i + 1))
const rowsOf = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ t: day(i), a: i + 1, b: (i + 1) * 2 }))
const pair = (v: string): SeriesColor => ({ light: `var(--vx-${v})`, dark: `var(--vx-${v})` })
const x = { value: (d: Row): Date => d.t }

const a: Series<Row> = { mark: 'line', key: 'a', label: 'A', color: pair('line'), y: (d) => d.a }
const b: Series<Row> = { mark: 'line', key: 'b', label: 'B', color: pair('accent'), y: (d) => d.b }

type Registry = readonly SeamModule[]
const without = (id: string): Registry => SEAM_MODULES.filter((m) => m.id !== id)

/** The chart props of a seam case: `y` only when given (`exactOptionalPropertyTypes`). */
const chartProps = ({ y, ...rest }: SeamProps<Row>): CartesianChartProps<Row> => ({
  ariaLabel: 'T',
  ...rest,
  ...(y !== undefined && { y }),
})

/** The v3 props through the adapter and the given registry. */
const through = (mods: Registry, props: SeamProps<Row>) =>
  applySeams(
    toEngineSpec(chartProps(props)),
    props,
    mods.map((m) => m.seam),
  )
const base = (series: Series<Row>[], extra: Partial<SeamProps<Row>> = {}): SeamProps<Row> => ({
  data: rowsOf(4),
  x,
  series,
  ...extra,
})
const registered = (mods: Registry, id: string): void => {
  expect(mods.some((m) => m.id === id)).toBe(true)
}

const domainOf = (mods: Registry, props: SeamProps<Row>): readonly [number, number] | undefined =>
  through(mods, props).y?.domain

const cases: Record<string, (mods: Registry) => void> = {
  format: (mods) => {
    registered(mods, 'format')
    const out = through(mods, base([{ ...a, format: (v, d) => `${v}@${d.t.getUTCDate()}` }]))
    expect(out.series[0]?.formatValue?.(5, rowsOf(3)[1]!)).toBe('5@2')
  },
  weight: (mods) => {
    registered(mods, 'weight')
    const out = through(
      mods,
      base([
        { ...a, weight: 'quiet' },
        { ...b, weight: 'strong' },
      ]),
    )
    expect(out.series.map((s) => s.strokeWidth)).toEqual([1.25, 2.5])
  },
  dash: (mods) => {
    registered(mods, 'dash')
    const out = through(mods, base([{ ...a, dash: true }, b]))
    expect(out.series.map((s) => s.dash)).toEqual(['dashed', undefined])
  },
  parent: (mods) => {
    registered(mods, 'parent')
    const out = through(mods, base([a, { ...b, parent: 'a' }]))
    expect(out.series[1]?.parent).toBe('a')
  },
  'legend and tooltip false': (mods) => {
    registered(mods, 'legend and tooltip false')
    const out = through(mods, base([{ ...a, legend: false, tooltip: false }]))
    expect([out.series[0]?.legend, out.series[0]?.tooltip]).toEqual([false, false])
  },
  gaps: (mods) => {
    registered(mods, 'gaps')
    const out = through(mods, base([{ ...a, gaps: 'connect' }]))
    expect(out.series[0]?.gaps).toBe('connect')
  },
  note: (mods) => {
    registered(mods, 'note')
    const out = through(mods, base([{ ...a, note: '7-day mean' }]))
    expect(out.series[0]?.note).toBe('7-day mean')
  },
  role: (mods) => {
    registered(mods, 'role')
    const out = through(mods, base([a, { ...b, role: 'overlay' }]))
    expect(out.series.map((s) => s.role)).toEqual([undefined, 'overlay'])
  },
  axis: (mods) => {
    registered(mods, 'axis')
    const out = through(mods, base([a, { ...b, axis: 'right' }]))
    expect(out.series[1]?.axis).toBe('right')
    expect(out.y2).toEqual({})
  },
  getMarker: (mods) => {
    registered(mods, 'getMarker')
    const out = through(
      mods,
      base([{ ...a, getMarker: (d) => ((d.a ?? 0) > 1 ? { color: 'red' } : null) }]),
    )
    const [first, second] = rowsOf(2)
    expect(out.series[0]?.getMarker?.(first!)).toBeNull()
    expect(out.series[0]?.getMarker?.(second!)).toEqual({ color: 'red' })
  },
  'x.domain': (mods) => {
    registered(mods, 'x.domain')
    const domain = [day(0), day(9)] as const
    const out = through(mods, base([a], { x: { ...x, domain } }))
    expect(out.xDomain).toEqual(domain)
  },
  'y.domain': (mods) => {
    registered(mods, 'y.domain')
    // linewatch latency-band-chart.tsx:334: a function, here doubling the top of the data.
    expect(domainOf(mods, base([a], { y: { domain: (e) => [0, e[1] * 2] } }))).toEqual([0, 8])
    // argo acwr-chart.tsx:154: autoMaxFloor 1.6 / autoMinCeil 0.6 around data inside [0.6, 1.6].
    const acwr = base([{ ...a, y: (d) => 0.8 + (d.a ?? 0) / 10 }], {
      y: { domain: { floor: 0.6, ceil: 1.6 } },
    })
    expect(domainOf(mods, acwr)).toEqual([0.6, 1.6])
    // pad adds a share of the span above; the zero baseline of positive data stays put.
    const padded = domainOf(mods, base([a], { y: { domain: { pad: 0.1 } } }))
    expect(padded?.[0]).toBe(0)
    expect(padded?.[1]).toBeCloseTo(4.4)
    // a fixed tuple and an absent domain are not the seam's business.
    expect(domainOf(mods, base([a], { y: { domain: [0, 10] } }))).toEqual([0, 10])
    expect(domainOf(mods, base([a]))).toBeUndefined()
    // a reversed answer falls back to the auto domain.
    expect(domainOf(mods, base([a], { y: { domain: () => [5, 1] } }))).toBeUndefined()
  },
  'y.gutter': (mods) => {
    registered(mods, 'y.gutter')
    const out: GutteredSpec<Row> = through(mods, base([a], { y: { gutter: 48 } }))
    expect(out.yGutter).toBe(48)
    const bad: GutteredSpec<Row> = through(mods, base([a], { y: { gutter: -1 } }))
    expect(bad.yGutter).toBeUndefined()
  },
  'plot.data': (mods) => {
    registered(mods, 'plot.data')
    const data = rowsOf(6)
    let seen: readonly Row[] = []
    renderToString(
      <CartesianChart
        ariaLabel="T"
        data={data}
        x={x}
        series={[{ ...a, failed: true }]}
        marks={CartesianChart.custom<Row>((plot) => {
          seen = plot.data
          return []
        })}
      />,
    )
    // every datum, raw, though the only series draws nothing
    expect(seen).toHaveLength(6)
    expect(seen[0]).toBe(data[0])
  },
  'per-datum opacity': (mods) => {
    registered(mods, 'per-datum opacity')
    const html = renderToString(
      <CartesianChart
        ariaLabel="T"
        data={rowsOf(4)}
        x={x}
        series={[
          {
            mark: 'bar',
            key: 'a',
            label: 'A',
            color: pair('line'),
            y: (d) => d.a,
            opacity: (d) => (d.t.getTime() === day(2).getTime() ? 0.4 : 1),
          },
        ]}
      />,
    )
    expect(html).toContain(`color-mix(in srgb, ${cssColor(pair('line'))} 40%, transparent)`)
  },
  'lone point': (mods) => {
    registered(mods, 'lone point')
    const data = [null, 100, null].map((v, i) => ({ t: day(i), a: v, b: null }))
    const doc = document.implementation.createHTMLDocument('')
    doc.body.innerHTML = renderToString(
      <CartesianChart ariaLabel="T" data={data} x={x} series={[a]} />,
    )
    expect(doc.querySelectorAll('g[data-ts-key^="a-lone"] circle')).toHaveLength(1)
  },
  'plot.pxToY and pxToX': (mods) => {
    registered(mods, 'plot.pxToY and pxToX')
    // linewatch latency-band-chart.tsx:426: one pixel is (yMax - yMin) / plotHeight.
    const plot = { plotWidth: 100, plotHeight: 200, yDomain: [0, 100] as const }
    expect(pxToY(plot, 0)).toBe(100)
    expect(pxToY(plot, 2)).toBe(99)
    expect(pxToY(plot, 200)).toBe(0)
    expect(pxToX(plot, [0, 50], 50)).toBe(25)
    expect(pxToX(plot, [day(0), day(10)], 10)).toEqual(day(1))
  },
  'pixel-extent rule': (mods) => {
    registered(mods, 'pixel-extent rule')
    const plot = { plotWidth: 100, plotHeight: 200, yDomain: [0, 100] as const }
    // a 3 px rail on the bottom edge and a 5 px rail 2 px under the top edge
    expect(pixelExtent(plot, { edge: 'bottom', px: 3 })).toEqual({ y1: 0, y2: 1.5 })
    expect(pixelExtent(plot, { edge: 'top', px: 5, inset: 2 })).toEqual({ y1: 96.5, y2: 99 })
    // an unmeasured plot never divides by zero
    expect(pixelExtent({ ...plot, plotHeight: 0 }, { edge: 'bottom', px: 1 }).y2).toBe(100)
  },
  'plot.scales': (mods) => {
    registered(mods, 'plot.scales')
    // argo scatter-labels.ts:51: values to plot pixels and back, against both domains
    const s = plotScales({ plotWidth: 400, plotHeight: 200, yDomain: [0, 10] }, [100, 200])
    expect(s.x(150)).toBe(200)
    expect(s.y(10)).toBe(0)
    expect(s.y(0)).toBe(200)
    expect(s.xAt(s.x(120))).toBeCloseTo(120)
    expect(s.yAt(s.y(3))).toBeCloseTo(3)
    expect(plotScales({ plotWidth: 100, plotHeight: 50, yDomain: [5, 5] }, [1, 1]).x(1)).toBe(0)
  },
}

describe.each(SEAM_MODULES.map((m) => [m.id, m.consumer] as const))('seam %s', (id, consumer) => {
  test(`${consumer}`, () => {
    const run = cases[id]
    expect(run, `no contract case for ${id}`).toBeDefined()
    run?.(SEAM_MODULES)
  })
})

describe('y.domain helpers', () => {
  test('a stack spans from zero to its positive and negative totals', () => {
    const stack = (key: string, y: (d: Row) => number | null): Series<Row> => ({
      mark: 'bar',
      key,
      label: key,
      color: pair('line'),
      stack: 's',
      y,
    })
    const props = base([stack('p', (d) => d.a), stack('q', (d) => -(d.b ?? 0))])
    expect(leftExtent(props)).toEqual([-8, 4])
  })
  test('failed and right-axis series are not on the left axis', () => {
    const props = base([a, { ...b, failed: true }, { ...b, key: 'c', axis: 'right' }])
    expect(leftExtent(props)).toEqual([1, 4])
  })
  test('no finite value is no extent', () => {
    expect(leftExtent({ ...base([a]), data: [] })).toBeNull()
  })
  test('floor and ceil reach down and up, a pad does not lift a zero baseline', () => {
    expect(boundedDomain([2, 4], {})).toEqual([0, 4])
    expect(boundedDomain([-4, -2], {})).toEqual([-4, 0])
    expect(boundedDomain([2, 4], { floor: 1, ceil: 6 })).toEqual([1, 6])
  })
})

describe('the registry', () => {
  test('every module of seams/ is registered, once', async () => {
    const files = readdirSync(import.meta.dir).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'define.ts',
    )
    const found: SeamModule[] = []
    for (const file of files) {
      const mod: Record<string, unknown> = await import(join(import.meta.dir, file))
      for (const value of Object.values(mod)) {
        const hit = value as Partial<SeamModule> | null
        if (hit && typeof hit === 'object' && typeof hit.seam === 'function') {
          found.push(value as SeamModule)
        }
      }
    }
    expect(found.length).toBeGreaterThan(0)
    for (const m of found) expect(SEAM_MODULES, `${m.id} is not in seams.ts`).toContain(m)
    expect(new Set(SEAM_MODULES.map((m) => m.id)).size).toBe(SEAM_MODULES.length)
    expect(found).toHaveLength(SEAM_MODULES.length)
  })

  test('every seam has a case and every case a seam', () => {
    expect(Object.keys(cases).toSorted()).toEqual(SEAM_MODULES.map((m) => m.id).toSorted())
  })

  test('every seam cites a linewatch or argo case', () => {
    for (const m of SEAM_MODULES) expect(m.consumer, m.id).toMatch(/\b(linewatch|argo)\b/)
  })

  test.each(SEAM_MODULES.map((m) => m.id))('meta: the %s test fails without its module', (id) => {
    const run = cases[id]
    expect(run).toBeDefined()
    expect(() => run?.(without(id))).toThrow()
  })

  test('a chart that uses no seam gets its spec back untouched', () => {
    const props = base([a])
    const spec = toEngineSpec(chartProps(props))
    expect(applySeams(spec, props)).toBe(spec)
  })
})
