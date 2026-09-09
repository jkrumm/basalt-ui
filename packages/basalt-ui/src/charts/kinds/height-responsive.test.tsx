/**
 * The `height` widening, proved at every call site a consumer actually has.
 *
 * 1.30.0 shipped `ResponsiveChartHeight` + `resolveFrameHeight` on `ChartFrame.height` ALONE while
 * `CartesianChart` and all nine kinds kept `height?: number` and spread it through — and
 * `basalt/hand-rolled-plot` forbids composing `ChartFrame` directly for a single-plot cartesian
 * chart, so there was NO compliant call site the feature could be reached from. linewatch tried it
 * on 20 charts and could not use it once. The object always resolved correctly at RUNTIME; only
 * the declarations were narrow, which is why "it compiles" proved nothing and this file renders.
 *
 * Every case renders UNMEASURED (`renderToStaticMarkup`, no `ResizeObserver`), where
 * `resolveFrameHeight` takes the LARGEST stated step — so `{ base: 180, md: 260 }` must paint the
 * same 260 a bare `height={260}` does, and `{ base: 180 }` must paint 180. The second case is what
 * separates "the object reached `ChartFrame`" from "the object was dropped and the 240 default
 * happens not to collide".
 *
 * Be clear about which half of this file is the regression guard: the runtime always worked, so
 * `tsc` over these mounts is what would have failed before the widening — `bun test` alone would
 * have passed. Both lanes run in `pre`, and the mounts have to stay typed (never `as any`) for the
 * first to mean anything.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { CartesianChart } from '../primitives/CartesianChart'
import type { ResponsiveChartHeight } from '../primitives/ChartFrame'
import { Bars } from './Bars'
import { BandStrip } from './BandStrip'
import { Donut } from './Donut'
import { DualPanel } from './DualPanel'
import { Heatmap } from './Heatmap'
import { MirroredBars } from './MirroredBars'
import { MultiLine } from './MultiLine'
import { StackedArea } from './StackedArea'
import { ZonedLine } from './ZonedLine'
import type { ChartSeries } from '../series'

type Row = { date: string; a: number; b: number }

const rows: Row[] = [
  { date: '2026-08-01', a: 10, b: 4 },
  { date: '2026-08-02', a: 12, b: 6 },
]

const getX = (d: Row): string => d.date
const lines: ChartSeries<Row>[] = [
  { key: 'a', label: 'A', color: '#111', mark: 'line', getValue: (d) => d.a },
  { key: 'b', label: 'B', color: '#222', mark: 'line', getValue: (d) => d.b },
]

/** One `height` value, mounted on every shipped surface that forwards it. */
type Mount = (height: number | ResponsiveChartHeight) => ReactElement

const MOUNTS: Record<string, Mount> = {
  CartesianChart: (height) => (
    <CartesianChart data={rows} chartId="h-cc" getX={getX} series={lines} height={height}>
      {() => null}
    </CartesianChart>
  ),
  MultiLine: (height) => (
    <MultiLine data={rows} chartId="h-ml" getX={getX} series={lines} height={height} />
  ),
  ZonedLine: (height) => (
    <ZonedLine data={rows} chartId="h-zl" getX={getX} series={lines.slice(0, 1)} height={height} />
  ),
  StackedArea: (height) => (
    <StackedArea data={rows} chartId="h-sa" getX={getX} series={lines} height={height} />
  ),
  Bars: (height) => (
    <Bars
      data={rows}
      chartId="h-bars"
      getX={getX}
      getValue={(d, key) => (key === 'a' ? d.a : d.b)}
      positiveBars={[{ key: 'a', label: 'A', color: '#111' }]}
      height={height}
    />
  ),
  BandStrip: (height) => (
    <BandStrip
      data={rows}
      chartId="h-bs"
      getX={getX}
      series={[{ key: 'a', label: 'A', color: '#111', mark: 'bar' }]}
      getBand={() => ({ state: 'a' })}
      height={height}
    />
  ),
  MirroredBars: (height) => (
    <MirroredBars
      data={rows}
      chartId="h-mb"
      getX={getX}
      series={lines}
      up={{ key: 'a', format: (v) => String(v) }}
      down={{ key: 'b', format: (v) => String(v) }}
      height={height}
    />
  ),
  DualPanel: (height) => (
    <DualPanel
      data={rows}
      chartId="h-dp"
      getX={getX}
      series={lines.slice(0, 1)}
      getBar={(d) => d.b}
      barLabel="B"
      barColorPositive="#111"
      barColorNegative="#222"
      formatTop={(v) => String(v)}
      formatBottom={(v) => String(v)}
      height={height}
    />
  ),
  Donut: (height) => (
    <Donut
      data={[
        { key: 'a', value: 3 },
        { key: 'b', value: 5 },
      ]}
      colorForKey={() => '#111'}
      formatValue={(v) => String(v)}
      height={height}
    />
  ),
  Heatmap: (height) => (
    <Heatmap
      data={[{ row: 'r', col: 'c', v: 1 }]}
      chartId="h-hm"
      getRow={(d) => d.row}
      getCol={(d) => d.col}
      getValue={(d) => d.v}
      height={height}
    />
  ),
}

describe('height accepts a number AND a ResponsiveChartHeight on every shipped surface', () => {
  for (const [name, mount] of Object.entries(MOUNTS)) {
    test(`${name}: a plain number is byte-identical to the responsive object resolving to it`, () => {
      const plain = renderToStaticMarkup(mount(260))
      const stepped = renderToStaticMarkup(mount({ base: 180, md: 260 }))
      expect(plain).toContain('height="260"')
      expect(stepped).toBe(plain)
    })

    test(`${name}: a different resolved step paints a different box — the object is READ`, () => {
      const short = renderToStaticMarkup(mount({ base: 180 }))
      expect(short).toContain('height="180"')
      expect(short).not.toContain('height="260"')
    })
  }
})
