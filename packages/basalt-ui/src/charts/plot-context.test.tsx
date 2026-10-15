/**
 * `PlotContext`'s data and plot-size contract (`plot-context.ts`): `plot.data`, the frame stand-in
 * before a measurement, how a read is detected, and the recompile loop's termination. Compile-level
 * where the definition says it, rendered where the engine lays the plot out.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { CartesianChart } from './CartesianChart'
import { compileCartesian } from './compile'
import {
  MAIN_PANE,
  PLOT_EPSILON_PX,
  plotAccess,
  readsPlot,
  samePlots,
  watchPlotReads,
} from './plot-context'
import type { PlotSizes } from './plot-context'
import { chartCursor } from './cursor'
import type { ChartSeries, PlotContext } from './types'

type Row = { t: Date; v: number }
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), v: d * 10 }))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = { key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d) => d.v }
const b: ChartSeries<Row> = { ...a, key: 'b', label: 'B' }
const FRAME = { width: 400, height: 200, defaultTheme: {} as never }

const sized = (main: { width: number; height: number }): PlotSizes => ({ [MAIN_PANE]: main })

function build(
  marks: (p: PlotContext<Row, Date>) => never[],
  extra: { hidden?: string[]; plot?: PlotSizes } = {},
) {
  const definition = compileCartesian({
    chartId: 'pc',
    data,
    x,
    series: [a, b],
    hidden: new Set(extra.hidden ?? []),
    ...(extra.plot && { plot: extra.plot }),
    marks,
  })
  definition.chart(FRAME)
  return definition
}

describe('plot.data', () => {
  test('is every row even when every series is hidden, while plot.rows(key) is empty', () => {
    const seen: { data?: readonly Row[]; rows?: number } = {}
    build(
      (p) => {
        seen.data = p.data
        seen.rows = p.rows('a').length
        return []
      },
      { hidden: ['a', 'b'] },
    )
    expect(seen.data).toBe(data)
    expect(seen.rows).toBe(0)
  })
})

describe('plot size', () => {
  const read = (plot?: PlotSizes) => {
    const seen: number[] = []
    build(
      (p) => {
        seen.push(p.plotWidth, p.plotHeight)
        return []
      },
      plot ? { plot } : {},
    )
    return seen
  }

  test('is the frame until the engine has laid out, then the laid-out plot', () => {
    expect(read()).toEqual([400, 200])
    expect(read(sized({ width: 360.5, height: 170 }))).toEqual([360.5, 170])
  })

  test('a pane the measurement does not name falls back to the frame', () => {
    expect(read({ elsewhere: { width: 1, height: 2 } })).toEqual([400, 200])
  })
})

describe('read detection', () => {
  test('a chart that never reads the plot size is not a reader', () => {
    expect(readsPlot(build(() => []))).toBe(false)
  })

  test('a plain read registers', () => {
    expect(readsPlot(build((p) => (p.plotHeight, [])))).toBe(true)
  })

  test('a destructuring read registers', () => {
    expect(
      readsPlot(
        build((p) => {
          const { plotWidth } = p
          return plotWidth > 0 ? [] : []
        }),
      ),
    ).toBe(true)
  })

  test('a branch-only read registers on the pass that takes the branch', () => {
    const marks = (p: PlotContext<Row, Date>): never[] => (p.width > 500 ? (p.plotHeight, []) : [])
    const narrow = compileCartesian({ chartId: 'br', data, x, series: [a], marks })
    narrow.chart(FRAME)
    expect(readsPlot(narrow)).toBe(false)
    // The same definition, rebuilt at a width that takes the branch (a resize): now a reader.
    narrow.chart({ ...FRAME, width: 600 })
    expect(readsPlot(narrow)).toBe(true)
  })

  test('a lazy read (an accessor the engine calls after the build) registers and tells the host once', () => {
    let lazy: () => number = () => 0
    const definition = compileCartesian({
      chartId: 'lz',
      data,
      x,
      series: [a],
      marks: (p) => {
        lazy = () => p.plotHeight
        return []
      },
    })
    let late = 0
    watchPlotReads(definition, () => (late += 1))
    definition.chart(FRAME)
    expect(readsPlot(definition)).toBe(false)
    expect(late).toBe(0)
    lazy()
    lazy()
    expect(readsPlot(definition)).toBe(true)
    expect(late).toBe(1)
  })

  test('plotAccess reads through the named pane only', () => {
    const owner = {}
    const access = plotAccess(owner, { top: { width: 10, height: 20 } }, 'top')
    expect(access.size()).toEqual({ width: 10, height: 20 })
    expect(plotAccess(owner, null, 'top').size()).toBeNull()
  })
})

describe('termination', () => {
  const size = { width: 300, height: 150 }

  test('an identical measurement is the same plot', () => {
    expect(samePlots(sized(size), sized({ ...size }))).toBe(true)
  })

  test('jitter under the epsilon is the same plot; over it is a change', () => {
    const jitter = PLOT_EPSILON_PX / 2
    expect(samePlots(sized(size), sized({ width: size.width + jitter, height: size.height }))).toBe(
      true,
    )
    expect(
      samePlots(
        sized(size),
        sized({ width: size.width, height: size.height + PLOT_EPSILON_PX * 2 }),
      ),
    ).toBe(false)
  })

  test('no previous measurement, or a different pane set, is a change', () => {
    expect(samePlots(null, sized(size))).toBe(false)
    expect(samePlots(sized(size), { ...sized(size), extra: size })).toBe(false)
  })
})

describe('rendered', () => {
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    chartCursor().setState(null)
    document.body.innerHTML = ''
  })

  const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 60))
  const chart = (onMarks: (p: PlotContext<Row, Date>) => void, height = 200) => (
    <CartesianChart
      ariaLabel="C"
      data={data}
      x={x}
      series={[a]}
      height={height}
      marks={(p) => {
        onMarks(p)
        return []
      }}
    />
  )
  async function mount(node: React.ReactNode): Promise<void> {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => {
      root?.render(node)
    })
    await act(settle)
  }

  test('the server HTML and the first client frame see the frame; the measured plot replaces it', async () => {
    const server: number[] = []
    renderToString(chart((p) => server.push(p.plotHeight)))
    const client: number[] = []
    await mount(chart((p) => client.push(p.plotHeight)))
    expect(server.length).toBeGreaterThan(0)
    // First frame: the frame height, as the server saw it.
    expect(client[0]).toBe(server[0])
    // After settle: the measured plot, smaller than the frame by the axis gutters.
    const last = client.at(-1) as number
    expect(last).toBeLessThan(client[0] as number)
  })

  test('the loop terminates: no further builds once the measured plot is in', async () => {
    const seen: number[] = []
    await mount(chart((p) => seen.push(p.plotHeight)))
    const settled = seen.length
    await act(settle)
    expect(seen.length).toBe(settled)
    // One frame-sized pass, then the measured one(s): never an unbounded chase.
    expect(settled).toBeLessThan(8)
  })

  test('a chart that never reads the plot size builds once', async () => {
    let builds = 0
    await mount(chart(() => (builds += 1)))
    const first = builds
    await act(settle)
    expect(builds).toBe(first)
  })
})
