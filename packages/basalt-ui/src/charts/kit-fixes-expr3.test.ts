/** Expression cycle 3 kit fixes, the pure parts: marks a caption keeps off, one locale for every chart text, room for an edge dot. */
import { afterEach, describe, expect, test } from 'bun:test'
import { resetFormatDefaults, setFormatDefaults } from '../format/shared'
import { xRefLabelSpots } from './axis-gaps'
import { compileCartesian } from './core/compile'
import type { LabelBox } from './ref-label'
import { placeRefLabel } from './ref-label'
import type { ChartSeries } from './types'

const base = {
  pinned: undefined,
  startFirst: false,
  value: 7,
  domain: [0, 10] as const,
  plotWidth: 400,
  plotHeight: 200,
  label: 'Need 7h',
  fontSize: 11,
  series: [],
}
/** A bar body from `fx0` to `fx1` of the plot width, from the floor to `top`. */
const bar = (fx0: number, fx1: number, top: number): LabelBox => ({ fx0, fx1, y0: 0, y1: top })

describe('a caption keeps off bar bodies and dots', () => {
  test('the end spot a tall bar covers gives way to a clear one', () => {
    const placed = placeRefLabel({ ...base, bars: [bar(0.9, 1, 9.5)] })
    expect(placed).not.toBeNull()
    expect(placed?.position.startsWith('end')).toBe(false)
  })

  test('it drops when a bar covers every spot, even where no line would stop it', () => {
    const wall = [bar(0, 1, 9.9)]
    expect(placeRefLabel({ ...base, bars: wall })).toBeNull()
  })

  test('bars under the line leave the spot above it', () => {
    const placed = placeRefLabel({ ...base, bars: [bar(0, 1, 5)] })
    expect(placed?.position).toBe('end-above')
  })

  test('a dot on the spot moves the caption off it', () => {
    // 7 on a 0–10 axis is 140 px up: a dot at the end of the plot, just above the line.
    const dot = { fx: 0.95, y: 7.6, r: 5 }
    const placed = placeRefLabel({ ...base, dots: [dot] })
    expect(placed).not.toBeNull()
    expect(placed?.position).not.toBe('end-above')
  })
})

describe('a rule caption keeps off a mark', () => {
  const lines = [{ x: 3, color: 'red', label: 'release' }]
  const spots = (blocked?: Parameters<typeof xRefLabelSpots>[0]['blocked']) =>
    xRefLabelSpots({
      lines,
      fraction: (x: number) => x / 12,
      plotWidth: 600,
      fontSize: 11,
      blocked,
    })

  test('a bar under the first spot sends it to the other side', () => {
    const first = spots()[0]!
    const moved = spots((box) => box.x0 === first.x0 && box.top < 10)
    expect(moved).toHaveLength(1)
    expect(moved[0]?.toRight === first.toRight && moved[0]?.row === first.row).toBe(false)
  })

  test('it stays over the marks when every spot is blocked, on the top row', () => {
    // Expression cycle 10: a rule that names the answer is not dropped for a mark.
    const stayed = spots(() => true)
    expect(stayed).toHaveLength(1)
    expect(stayed[0]?.row).toBe(0)
  })
})

describe('one locale for every chart text', () => {
  type Row = { t: Date; v: number }
  const series: ChartSeries<Row> = {
    key: 'v',
    label: 'V',
    color: 'var(--basalt-line)',
    mark: 'line',
    getValue: (d) => d.v,
  }
  const data: Row[] = Array.from({ length: 10 }, (_, i) => ({
    t: new Date(Date.UTC(2026, 9, 15 + i)),
    v: i / 10,
  }))
  type Scales = {
    x: { axis: { ticks: { values: Date[]; format: (d: Date) => string } } }
    y: { axis: { ticks: { values?: number[]; format: (v: number) => string } } }
  }
  const compiled = (locale: string) =>
    compileCartesian<Row, Date>({
      chartId: 'locale',
      locale,
      data,
      x: (d) => d.t,
      series: [series],
      marks: () => [],
    })

  afterEach(resetFormatDefaults)

  test('the provider locale wins over the browser one in axis ticks, y ticks and the tooltip', () => {
    // The browser: a German host.
    setFormatDefaults({ locale: 'de-DE' })
    const definition = compiled('en')
    const scales = definition.chart({ width: 700, height: 300, defaultTheme: {} as never })
      .scales as unknown as Scales
    const x = scales.x.axis.ticks
    expect(x.values.map((t) => x.format(t)).join(' ')).toMatch(/Oct/)
    expect(x.values.map((t) => x.format(t)).join(' ')).not.toMatch(/Okt/)
    const y = scales.y.axis.ticks
    expect(y.format(0.8)).toBe('0.8')
    const tooltip = definition.tooltip
    const title = (
      tooltip as unknown as {
        content: (p: unknown[]) => { title: string }
      }
    ).content([
      { xValue: data[4]!.t, datum: { series: 'v', x: data[4]!.t, datum: data[4], y: 0.4 } },
    ]).title
    expect(title).toMatch(/Mon/)
    expect(title).toMatch(/Oct/)
  })

  test('a German provider prints German', () => {
    const definition = compiled('de')
    const scales = definition.chart({ width: 700, height: 300, defaultTheme: {} as never })
      .scales as unknown as Scales
    expect(scales.y.axis.ticks.format(0.8)).toBe('0,8')
  })
})

describe('a dot on the plot floor keeps its room', () => {
  type Pt = { n: number; v: number }
  const dots: ChartSeries<Pt> = {
    key: 'v',
    label: 'V',
    color: 'var(--basalt-line)',
    mark: 'dot',
    getValue: (d) => d.v,
  }
  const data: Pt[] = [0, 1, 2, 3].map((n) => ({ n, v: n === 1 ? 0 : 2 }))
  const domainOf = (series: ChartSeries<Pt>[]): readonly [number, number] => {
    const definition = compileCartesian<Pt, number>({
      chartId: 'dots',
      data,
      x: (d) => d.n,
      y: { domain: [0, 4] },
      series,
      marks: () => [],
      plot: { main: { width: 500, height: 200 } },
    })
    const scale = (
      definition.chart({ width: 600, height: 240, defaultTheme: {} as never })
        .scales as unknown as {
        y: { scale: { domain: () => [number, number] } }
      }
    ).y.scale
    return scale.domain() as [number, number]
  }

  test('the floor grows by the dot radius in px of the plot', () => {
    const [lo, hi] = domainOf([dots])
    expect(hi).toBe(4)
    // 6 px (radius 5 and its ring) of a 200 px plot: a little over 3% of the span.
    expect(lo).toBeLessThan(0)
    expect(-lo).toBeGreaterThan(0.1)
    expect(-lo).toBeLessThan(0.3)
  })

  test('a chart whose bars stand on the floor keeps it', () => {
    const bars: ChartSeries<Pt> = { ...dots, key: 'b', mark: 'bar' }
    expect(domainOf([dots, bars])[0]).toBe(0)
  })
})
