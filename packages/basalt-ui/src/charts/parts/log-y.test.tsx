/**
 * `y.scale: 'log'` on `CartesianChart` and `Lines`: decade ticks, a log pane beside a linear one, zones and
 * rules at their data value's pixel, the named dev error, and the marks that stand on zero.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { logYTicks } from '../axis-gaps'
import type { Series, SeriesColor } from '../contract'
import { warpFor } from '../core/scales'
import { pixelExtent } from '../seams/pixel-extent'
import { plotScales } from '../seams/plot-scales'
import { Bars } from './bars'
import { CartesianChart } from './cartesian'
import { ChartPanes } from './chart-panes'
import { Lines } from './lines'

const pair = (v: string): SeriesColor => ({
  light: `var(--basalt-${v})`,
  dark: `var(--basalt-${v})`,
})
type Row = { t: number; price: number }
const rowsOf = (prices: readonly number[]): Row[] => prices.map((price, i) => ({ t: i, price }))
const rows = rowsOf([16, 60, 300, 1200, 9000, 30000, 64000, 120000])
const x = { value: (d: Row): number => d.t }
const price: Series<Row> = {
  mark: 'line',
  key: 'price',
  label: 'Price',
  color: pair('line'),
  y: (d) => d.price,
}

const setEnv = (value: string | undefined): void => {
  if (value === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = value
}

/** The values the y axis labels, read off the engine's tick keys. */
const yTicks = (html: string): number[] =>
  [...html.matchAll(/data-ts-key="y-tick-label:number:([^"]+)"/g)].map((m) => Number(m[1]))
/** The pixel row of the grid line at tick `value`. */
const gridY = (html: string, value: number): number => {
  const m = new RegExp(`data-ts-key="y-grid:number:${value}"[^>]* y1="([\\d.]+)"`).exec(html)
  if (m === null) throw new Error(`no grid line at ${value}`)
  return Number(m[1])
}
const attr = (html: string, key: string, name: string): number => {
  const m = new RegExp(`data-ts-key="${key}[^"]*"[^>]* ${name}="([\\d.]+)"`).exec(html)
  if (m === null) throw new Error(`no ${key} ${name}`)
  return Number(m[1])
}
const isRound = (v: number): boolean => {
  const m = v / 10 ** Math.floor(Math.log10(v))
  return [1, 2, 5].some((r) => Math.abs(m - r) < 1e-9)
}

describe('log y ticks', () => {
  test('a Lines chart from 16 to 120000 labels round values of the decades, 1, 2 and 5 times a power of ten', () => {
    const ticks = yTicks(
      renderToString(
        <Lines label="Price" data={rows} x={x} series={[price]} y={{ scale: 'log' }} />,
      ),
    )
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.every(isRound)).toBe(true)
  })

  test('ticks go through y.format as linear ones do', () => {
    const html = renderToString(
      <Lines
        label="Price"
        data={rows}
        x={x}
        series={[price]}
        y={{ scale: 'log', format: (v) => `$${v}` }}
      />,
    )
    expect(html).toContain('>$1000<')
  })

  test('the densest of 1/2/5, decades and a stride that fits', () => {
    expect(logYTicks(1, 100, 8)).toEqual([1, 2, 5, 10, 20, 50, 100])
    expect(logYTicks(1, 1e6, 5)).toEqual([1, 100, 10000, 1e6])
    expect(logYTicks(14.5, 132000, 5)).toEqual([100, 1000, 10000, 100000])
    expect(logYTicks(1, 1e9, 3)).toEqual([1, 1e4, 1e8])
    expect(logYTicks(0.03, 0.9, 6)).toEqual([0.05, 0.1, 0.2, 0.5])
  })

  test('a range inside one decade takes every digit, then the linear ticks', () => {
    expect(logYTicks(110, 380, 5)).toEqual([200, 300])
    expect(logYTicks(110, 130, 5).every((t) => t >= 110 && t <= 130)).toBe(true)
  })
})

describe('log y beside a linear one', () => {
  test('a two-pane chart with a linear top pane and a log bottom pane renders both', () => {
    const html = renderToString(
      <ChartPanes
        box={{ height: 'fill', phase: 'ready' }}
        panes={[
          {
            chart: () => <Lines label="Linear" height="fill" data={rows} x={x} series={[price]} />,
          },
          {
            chart: () => (
              <Lines
                label="Log"
                height="fill"
                data={rows}
                x={x}
                series={[price]}
                y={{ scale: 'log' }}
              />
            ),
          },
        ]}
      />,
    )
    const [top, bottom] = html.split('<svg').slice(1)
    expect(html.match(/<svg/g)?.length).toBe(2)
    // Linear ticks are evenly spaced; the log pane's are decades.
    const linear = yTicks(top as string)
    expect(linear.at(0)).toBe(0)
    expect((linear.at(1) as number) - (linear.at(0) as number)).toBe(
      (linear.at(2) as number) - (linear.at(1) as number),
    )
    expect(yTicks(bottom as string)).toEqual([100, 1000, 10000, 100000])
  })
})

describe('a log y.domain that cannot be drawn', () => {
  test('a function answer with a bound at or below zero warns in a dev build and draws the data extent', () => {
    const warned: string[] = []
    const original = console.error
    console.error = (...args: unknown[]) => void warned.push(args.join(' '))
    try {
      const html = renderToString(
        <Lines
          label="Price"
          data={rows}
          x={x}
          series={[price]}
          y={{ scale: 'log', domain: () => [0, 100] }}
        />,
      )
      expect(yTicks(html).every(isRound)).toBe(true)
      expect(yTicks(html).at(-1)).toBeGreaterThan(100)
    } finally {
      console.error = original
    }
    expect(warned.join('\n')).toContain('a log y.domain needs positive bounds')
  })
})

describe('zones and reference lines on a log y', () => {
  const html = renderToString(
    <Lines
      label="Price"
      data={rows}
      x={x}
      series={[price]}
      y={{ scale: 'log' }}
      zones={[{ from: 1000, to: 10000, fill: 'red' }]}
      refLines={[{ value: 3000, color: pair('line') }]}
    />,
  )
  const [y100, y1k, y10k] = [100, 1000, 10000].map((v) => gridY(html, v))

  test('a zone spans the pixels of its data values', () => {
    const top = attr(html, 'zone-0', 'y')
    const height = attr(html, 'zone-0', 'height')
    expect(top).toBeCloseTo(y10k as number, 1)
    expect(top + height).toBeCloseTo(y1k as number, 1)
  })

  test('a reference line sits on the log of its value between the decade ticks', () => {
    const at = attr(html, 'ref-0', 'y1')
    const expected = (y1k as number) - ((y1k as number) - (y10k as number)) * Math.log10(3)
    expect(at).toBeCloseTo(expected, 1)
    expect(y1k).toBeGreaterThan(at)
    expect(y100).toBeGreaterThan(y1k as number)
  })

  test('a rule at zero or below is not drawn', () => {
    const none = renderToString(
      <Lines
        label="Price"
        data={rows}
        x={x}
        series={[price]}
        y={{ scale: 'log' }}
        refLines={[{ value: 0, color: pair('line') }]}
      />,
    )
    expect(none).not.toContain('ref-0')
  })

  test('an end label stays beside its line end', () => {
    const named = renderToString(
      <Lines
        label="Price"
        data={rows}
        x={x}
        series={[price]}
        y={{ scale: 'log' }}
        naming="endLabels"
      />,
    )
    const lineEnd = /d="[^"]*L[\d.]+,([\d.]+)"/.exec(named)
    const label = attr(named, 'price-end-label', 'y')
    expect(Math.abs(label - Number(lineEnd?.[1]))).toBeLessThan(30)
  })
})

describe('a value of zero or below on a log y', () => {
  const withZero = rowsOf([16, 0, 300])
  const chart = (data: Row[]) => (
    <CartesianChart label="Price" data={data} x={x} series={[price]} y={{ scale: 'log' }} />
  )
  const production = (run: () => void): void => {
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      run()
    } finally {
      setEnv(before)
    }
  }
  afterEach(() => {
    process.env.NODE_ENV = 'test'
  })

  test('a dev build throws an error that names the series and the value', () => {
    expect(() => renderToString(chart(withZero))).toThrow(
      /series "price" has the value 0 on a log y/,
    )
    expect(() => renderToString(chart(rowsOf([16, -3, 300])))).toThrow(/"price".*-3/)
  })

  test('a production build skips the point and draws the rest', () => {
    production(() => {
      const html = renderToString(chart(withZero))
      expect(html).toContain('<svg')
      expect(html).not.toContain('NaN')
      expect(html).not.toContain('Infinity')
    })
  })

  test('a right-axis rule at zero stays on its linear axis', () => {
    const right: Series<Row> = { ...price, key: 'cost', label: 'Cost', axis: 'right' }
    const html = renderToString(
      <CartesianChart
        label="Both"
        data={rows}
        x={x}
        series={[price, right]}
        y={{ scale: 'log' }}
        refLines={[{ value: 0, axis: 'right', color: pair('line') }]}
      />,
    )
    expect(html).toContain('ref-0')
  })

  test('a right-axis series keeps its linear scale and its zeros', () => {
    const right: Series<Row> = { ...price, key: 'cost', label: 'Cost', axis: 'right' }
    expect(() =>
      renderToString(
        <CartesianChart
          label="Both"
          data={rows}
          x={x}
          series={[price, right]}
          y={{ scale: 'log' }}
        />,
      ),
    ).not.toThrow()
  })
})

describe('marks that stand on zero', () => {
  const bar: Series<Row> = {
    mark: 'bar',
    key: 'v',
    label: 'V',
    color: pair('bar'),
    y: (d) => d.price,
  }

  test('Bars does not type a log y: tsc fails it', () => {
    const draw = () =>
      renderToString(
        <Bars
          label="V"
          data={rows}
          x={x}
          series={[bar]}
          // @ts-expect-error a bar stands on zero: Bars' y takes no scale
          y={{ scale: 'log' }}
        />,
      )
    // The same props also fail at run time, for a caller that casts the type away.
    expect(draw).toThrow(
      /y\.scale 'log' has no zero baseline, so it does not take the bar series "v"/,
    )
  })

  test('CartesianChart cannot say it in a type: a bar series raises the named dev error', () => {
    expect(() =>
      renderToString(
        <CartesianChart label="V" data={rows} x={x} series={[bar]} y={{ scale: 'log' }} />,
      ),
    ).toThrow(/does not take the bar series "v"/)
  })

  test('an area fade raises the named dev error', () => {
    expect(() =>
      renderToString(
        <Lines
          label="V"
          data={rows}
          x={x}
          series={[{ ...price, area: 'fade' }]}
          y={{ scale: 'log' }}
        />,
      ),
    ).toThrow(/does not take the area of series "price"/)
  })

  test('a production build draws a bar chart linear, on the linear domain of an object y.domain', () => {
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const html = renderToString(
        <CartesianChart
          label="V"
          data={rowsOf([100, 150, 200])}
          x={x}
          series={[bar]}
          y={{ scale: 'log', domain: { floor: 0 } }}
        />,
      )
      expect(yTicks(html).at(0)).toBe(0)
    } finally {
      setEnv(before)
    }
  })

  test('a production build draws the chart linear', () => {
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const html = renderToString(
        <CartesianChart label="V" data={rows} x={x} series={[bar]} y={{ scale: 'log' }} />,
      )
      expect(html).toContain('<svg')
    } finally {
      setEnv(before)
    }
  })
})

describe('pixel maps on a log y', () => {
  const geometry = { plotWidth: 400, plotHeight: 300, yDomain: [10, 10000] as const, yLog: true }
  test('plot.scales maps a value to the pixel of its decade and back', () => {
    const scales = plotScales(geometry, [0, 1])
    expect(scales.y(10000)).toBeCloseTo(0, 6)
    expect(scales.y(10)).toBeCloseTo(300, 6)
    expect(scales.y(316.2277660168379)).toBeCloseTo(150, 6)
    expect(scales.yAt(150)).toBeCloseTo(316.2277660168379, 6)
  })

  test('a pixel-extent rule is the declared px tall at the edge, in values', () => {
    const { y1, y2 } = pixelExtent(geometry, { edge: 'bottom', px: 3 })
    const scales = plotScales(geometry, [0, 1])
    expect(scales.y(y1) - scales.y(y2)).toBeCloseTo(3, 6)
    expect(scales.y(y1)).toBeCloseTo(300, 6)
  })

  test('the warp is the identity on a linear axis', () => {
    expect(warpFor(false).to(7)).toBe(7)
    expect(warpFor(true).from(warpFor(true).to(7))).toBeCloseTo(7, 9)
  })
})
