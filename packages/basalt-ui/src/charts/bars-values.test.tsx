/**
 * Bar value labels, the highlighted bar, the zero bar's tick, the stack cap and the x rules as label
 * obstacles (`Series.values`, `Series.highlight`). The rendered SVG is read, as the first pass draws it.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { chartLabels } from './chart-labels'
import type { LabelBox } from './chart-labels'
import type { CartesianChartProps, ChartPlot, Series } from './contract'
import { compileCartesian } from './core/compile'
import { CV } from './core/theme'
import { hostObstacles } from './label-obstacles'
import { CartesianChart } from './parts/cartesian'
import { Bars } from './parts/bars'
import type { BarsProps } from './parts/bars'
import type { ChartSeries } from './types'

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
type Row = { k: string; a: number; b: number }
const DATA: readonly Row[] = [
  { k: 'one', a: 3, b: 2 },
  { k: 'two', a: 7, b: 1 },
  { k: 'three', a: 5, b: 4 },
]
type BarSeries = Extract<Series<Row>, { mark: 'bar' }>
const bar = (extra: Partial<BarSeries> = {}): BarSeries => ({
  mark: 'bar',
  key: 'a',
  label: 'A',
  color: COLOR,
  y: (d) => d.a,
  ...extra,
})

const render = (props: Partial<Omit<BarsProps<Row>, 'label' | 'ariaLabel'>> = {}): string =>
  renderToString(
    <Bars<Row>
      label="V"
      data={DATA}
      x={{ value: (d) => d.k }}
      layout="grouped"
      series={[bar({ values: true })]}
      {...props}
    />,
  )

/** The value labels drawn, in document order. */
const labelsOf = (html: string): string[] =>
  [...html.matchAll(/<text data-ts-key="bar-values-y[^>]*>([^<]*)<\/text>/g)].map((m) => m[1] ?? '')

describe('value labels', () => {
  test('values: true writes one label per bar', () => {
    expect(labelsOf(render()).toSorted()).toEqual(['3', '5', '7'])
  })

  test('a function writes the text from the value and the datum', () => {
    const html = render({ series: [bar({ values: (v, d) => `${d.k}:${v}` })] })
    expect(labelsOf(html).toSorted()).toEqual(['one:3', 'three:5', 'two:7'])
  })

  test('the series format wins over the axis format for true', () => {
    const html = render({ series: [bar({ values: true, format: (v) => `${v} kg` })] })
    expect(labelsOf(html)).toContain('7 kg')
  })

  test('a stack gets one total per x, from the first series that asks', () => {
    const html = render({
      layout: 'stacked',
      series: [bar({ values: true }), bar({ key: 'b', label: 'B', y: (d) => d.b })],
    })
    expect(labelsOf(html).toSorted()).toEqual(['5', '8', '9'])
  })

  test('a normalized stack draws none', () => {
    const html = render({
      layout: 'normalized',
      series: [bar({ values: true }), bar({ key: 'b', label: 'B', y: (d) => d.b })],
    })
    expect(labelsOf(html)).toEqual([])
  })

  test('a zero bar is labelled at the baseline and draws a tick', () => {
    const data = [...DATA, { k: 'none', a: 0, b: 0 }]
    const html = render({ data })
    expect(labelsOf(html)).toContain('0')
    const tick = /<rect data-ts-key="zero-ticks[^"]*"[^>]*height="([\d.]+)"/.exec(html)
    expect(tick).not.toBeNull()
    expect(Number(tick?.[1])).toBeGreaterThan(1)
    expect(Number(tick?.[1])).toBeLessThan(3)
  })

  test('a gap draws no tick and no label', () => {
    const html = renderToString(
      <Bars<Row | { k: string; a: null; b: number }>
        label="V"
        data={[...DATA, { k: 'gap', a: null, b: 0 }]}
        x={{ value: (d) => d.k }}
        series={[
          {
            mark: 'bar',
            key: 'a',
            label: 'A',
            color: COLOR,
            y: (d) => d.a,
            values: true,
          },
        ]}
      />,
    )
    expect(html).not.toContain('zero-ticks')
    expect(labelsOf(html)).toHaveLength(3)
  })

  test('under crowding the highlighted bar keeps its label and its neighbours give way', () => {
    const data = Array.from({ length: 40 }, (_, i) => ({ k: `c${i}`, a: 10, b: 0 }))
    const html = render({
      data,
      series: [
        bar({
          values: (v, d) => (d.k === 'c17' ? 'KEPT' : `long ${v} text`),
          highlight: (d) => d.k === 'c17',
        }),
      ],
    })
    const labels = labelsOf(html)
    expect(labels).toContain('KEPT')
    expect(labels.length).toBeLessThan(40)
  })
})

describe('highlight', () => {
  test('a highlighted bar draws in the accent, the others in the series color', () => {
    const html = render({ series: [bar({ highlight: (d) => d.k === 'two' })] })
    const fills = [...html.matchAll(/<rect data-ts-key="bars:[^"]*:(\w+)"[^>]*?fill="([^"]*)"/g)]
    const fillOf = (k: string) => fills.find((m) => m[1] === k)?.[2]
    expect(fillOf('two')).toContain(CV.brand)
    expect(fillOf('one')).toContain('--basalt-line')
  })

  test('the tooltip row swatch follows the datum', () => {
    const s: ChartSeries<Row> = {
      key: 'a',
      label: 'A',
      color: 'var(--basalt-line)',
      getValue: (d) => d.a,
      mark: 'bar',
      highlight: (d) => d.k === 'two',
    }
    const definition = compileCartesian<Row, string>({
      chartId: 't',
      data: DATA as Row[],
      x: (d) => d.k,
      series: [s],
      band: true,
      marks: () => [],
    })
    const content = (
      definition.tooltip as unknown as {
        content: (p: unknown[]) => { rows: { color?: string }[] }
      }
    ).content
    const colorFor = (d: Row) =>
      content([{ xValue: d.k, datum: { series: 'a', x: d.k, datum: d, y: d.a } }]).rows[0]?.color
    expect(colorFor(DATA[1] as Row)).toBe(CV.brand)
    expect(colorFor(DATA[0] as Row)).toBe('var(--basalt-line)')
  })
})

describe('stack cap', () => {
  const capped = (): string =>
    render({
      layout: 'stacked',
      y: { domain: [0, 10] },
      data: [
        { k: 'one', a: 8, b: 8 },
        { k: 'two', a: 2, b: 2 },
      ],
      series: [bar(), bar({ key: 'b', label: 'B', y: (d) => d.b })],
    })

  test('a stack past a fixed domain draws one caret and stops at the plot edge', () => {
    const html = capped()
    expect(html.match(/▲/g)).toHaveLength(1)
    const clip = /<clipPath[^>]*><rect[^>]*y="([\d.]+)"/.exec(html)
    const top = Number(clip?.[1])
    const tops = [
      ...html.matchAll(/<rect data-ts-key="bars:[^"]*:b:[^"]*"[^>]*?\sy="([\d.]+)"/g),
    ].map((m) => Number(m[1]))
    expect(Math.min(...tops)).toBeGreaterThanOrEqual(top - 0.01)
  })

  test('a stack inside the domain draws no caret', () => {
    expect(
      render({
        layout: 'stacked',
        y: { domain: [0, 100] },
        series: [bar(), bar({ key: 'b', label: 'B', y: (d) => d.b })],
      }),
    ).not.toContain('▲')
  })
})

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function obstaclesOf(
  refLines: CartesianChartProps<Row>['refLines'],
): Promise<{ plot: ChartPlot<Row>; obstacles: readonly LabelBox[]; placed: number }> {
  let seen: { plot: ChartPlot<Row>; obstacles: readonly LabelBox[]; placed: number } | undefined
  const marks = CartesianChart.custom<Row>((plot) => {
    const cx = plot.x('two') as number
    const { placed } = chartLabels.place(
      [{ key: 'tag', text: 'Tag', x: cx, y: plot.plotHeight / 2, spots: ['above'] }],
      { width: plot.plotWidth, height: plot.plotHeight },
    )
    seen = { plot, obstacles: [...hostObstacles()], placed: placed.length }
    return []
  })
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () =>
    root?.render(
      <CartesianChart<Row>
        label="V"
        data={[
          { k: 'one', a: 0, b: 0 },
          { k: 'two', a: 0, b: 0 },
          { k: 'three', a: 0, b: 0 },
        ]}
        x={{ value: (d) => d.k }}
        series={[bar()]}
        {...(refLines && { refLines })}
        marks={marks}
      />,
    ),
  )
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  if (seen === undefined) throw new Error('the builder never ran')
  return seen
}

describe('x rules as obstacles', () => {
  const rule = [{ value: 'two', axis: 'x' as const, color: COLOR }]

  test('a vertical rule is a full-height box at its x', async () => {
    const { plot, obstacles } = await obstaclesOf(rule)
    const cx = plot.x('two') as number
    const box = obstacles.find(
      (b) =>
        b.height >= plot.plotHeight - 1 && b.width < 10 && Math.abs(b.left + b.width / 2 - cx) < 2,
    )
    expect(box).toBeDefined()
  })

  test('a label placed on the rule moves off it', async () => {
    expect((await obstaclesOf(undefined)).placed).toBe(1)
    expect((await obstaclesOf(rule)).placed).toBe(0)
  })
})
