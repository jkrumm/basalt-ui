/**
 * `SeriesStyle.curve` — the seam that made the already-shipped step curves reachable. Every kind
 * hard-coded `curveMonotoneX`, so a piecewise-constant quantity (a price tier, a config value)
 * could only be drawn as a smooth curve through intermediate values that never existed.
 *
 * The assertion is geometric rather than "the right factory was passed": a step path is one whose
 * every segment is axis-aligned. Note d3 emits every segment as an absolute `L`, never `H`/`V` —
 * "H/V segments" is a property of the COORDINATES, not of the command letters — so the check
 * parses the points and requires each consecutive pair to share an x or a y. A monotone path emits
 * cubic (`C`) commands, which is the cheap way to tell smoothed from not.
 */
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { curveFor } from './series'
import type { ChartSeries } from './series'
import {
  curveLinear,
  curveMonotoneX,
  curveStep,
  curveStepAfter,
  curveStepBefore,
} from '@visx/curve'
import { Bars } from './kinds/Bars'
import { DualPanel } from './kinds/DualPanel'
import { MultiLine } from './kinds/MultiLine'
import { StackedArea } from './kinds/StackedArea'
import { ZonedLine } from './kinds/ZonedLine'

type Row = { date: string; v: number }

const rows: Row[] = [
  { date: '2026-08-01', v: 10 },
  { date: '2026-08-02', v: 40 },
  { date: '2026-08-03', v: 25 },
  { date: '2026-08-04', v: 25 },
]

const seriesWith = (curve?: ChartSeries<Row>['curve']): ChartSeries<Row>[] => [
  {
    key: 'v',
    label: 'v',
    color: '#000',
    mark: 'line',
    getValue: (d) => d.v,
    ...(curve !== undefined && { curve }),
  },
]

/** Every rendered `<path d>` string. */
function pathsOf(container: HTMLElement): string[] {
  const paths = [...container.querySelectorAll('path')]
    .map((node) => node.getAttribute('d') ?? '')
    .filter((d) => d.length > 0)
  expect(paths.length).toBeGreaterThan(0)
  return paths
}

/** Every path command in a rendered `<path d>`, as its letter. */
function commandsOf(container: HTMLElement): string[] {
  return pathsOf(container).flatMap((d) => (d.match(/[A-Za-z]/g) ?? []).map((c) => c.toUpperCase()))
}

/** Whether every segment of ONE path runs purely horizontally or purely vertically. */
function segmentsAreAxisAligned(d: string): boolean {
  const points = [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }))
  expect(points.length).toBeGreaterThan(1)
  return points.every((p, i) => {
    if (i === 0) return true
    const prev = points[i - 1]
    if (prev === undefined) return false
    return Math.abs(p.x - prev.x) < 0.001 || Math.abs(p.y - prev.y) < 0.001
  })
}

/** Whether every segment of every rendered path runs purely horizontally or purely vertically. */
function everySegmentIsAxisAligned(container: HTMLElement): boolean {
  return pathsOf(container).every(segmentsAreAxisAligned)
}

describe('curveFor', () => {
  test('an omitted curve is curveMonotoneX — today’s behaviour, unchanged', () => {
    expect(curveFor()).toBe(curveMonotoneX)
    expect(curveFor(undefined)).toBe(curveMonotoneX)
    expect(curveFor('monotone')).toBe(curveMonotoneX)
  })

  test('every named curve maps to its visx factory', () => {
    expect(curveFor('linear')).toBe(curveLinear)
    expect(curveFor('step')).toBe(curveStep)
    expect(curveFor('stepAfter')).toBe(curveStepAfter)
    expect(curveFor('stepBefore')).toBe(curveStepBefore)
  })
})

describe('MultiLine honours SeriesStyle.curve', () => {
  test('the default draws a smoothed path — cubic segments', () => {
    const { container } = render(
      <MultiLine
        data={rows}
        chartId="c1"
        getX={(d) => d.date}
        series={seriesWith()}
        height={240}
      />,
    )
    expect(commandsOf(container)).toContain('C')
  })

  for (const curve of ['step', 'stepAfter', 'stepBefore'] as const) {
    test(`curve: '${curve}' draws ONLY horizontal and vertical segments`, () => {
      const { container } = render(
        <MultiLine
          data={rows}
          chartId={`c-${curve}`}
          getX={(d) => d.date}
          series={seriesWith(curve)}
          height={240}
        />,
      )
      // No smoothing, and every segment axis-aligned — the definition of a step.
      expect(new Set(commandsOf(container))).toEqual(new Set(['M', 'L']))
      expect(everySegmentIsAxisAligned(container)).toBe(true)
    })
  }

  test("curve: 'linear' draws straight segments — no cubics, but not axis-aligned either", () => {
    const { container } = render(
      <MultiLine
        data={rows}
        chartId="c-linear"
        getX={(d) => d.date}
        series={seriesWith('linear')}
        height={240}
      />,
    )
    const commands = new Set(commandsOf(container))
    expect(commands.has('C')).toBe(false)
    expect(commands.has('L')).toBe(true)
    // Same command letters as a step, and provably not one — the geometry is what differs.
    expect(everySegmentIsAxisAligned(container)).toBe(false)
  })
})

describe('DualPanel honours per-series SeriesStyle.curve, like MultiLine', () => {
  const dualProps = {
    data: rows,
    chartId: 'd1',
    getX: (d: Row) => d.date,
    getBar: (d: Row) => d.v,
    barLabel: 'Δ',
    barColorPositive: '#0a0',
    barColorNegative: '#a00',
    formatTop: (v: number) => String(v),
    formatBottom: (v: number) => String(v),
    height: 240,
  }

  test('the default draws a smoothed top-pane line — cubic segments', () => {
    const { container } = render(<DualPanel {...dualProps} series={seriesWith()} />)
    expect(commandsOf(container)).toContain('C')
  })

  for (const curve of ['step', 'stepAfter', 'stepBefore'] as const) {
    test(`curve: '${curve}' draws ONLY horizontal and vertical segments`, () => {
      const { container } = render(<DualPanel {...dualProps} series={seriesWith(curve)} />)
      expect(new Set(commandsOf(container))).toEqual(new Set(['M', 'L']))
      expect(everySegmentIsAxisAligned(container)).toBe(true)
    })
  }
})

describe('ZonedLine honours the PRIMARY series’ curve on all three of its shapes', () => {
  test('a step primary emits no cubic anywhere — line and area agree', () => {
    const { container } = render(
      <ZonedLine
        data={rows}
        chartId="z1"
        getX={(d) => d.date}
        series={seriesWith('stepAfter')}
        areaFill
        height={240}
      />,
    )
    expect(new Set(commandsOf(container)).has('C')).toBe(false)
    expect(everySegmentIsAxisAligned(container)).toBe(true)
  })
})

/**
 * `BarsLine.curve` is the same seam one layer down: a `Bars` overlay is a `LinePath` like any
 * other, and a line riding over bars is exactly where a piecewise-constant quantity (a target, a
 * tier) turns up. The assertion is that the PATH GEOMETRY moves, not that a factory was passed —
 * a step and a monotone through the same four points share no coordinates.
 */
describe('Bars honours BarsLine.curve on its line overlay', () => {
  const LINE_COLOR = '#f0f'

  const renderBars = (curve?: ChartSeries<Row>['curve']) =>
    render(
      <Bars<Row>
        data={rows}
        chartId={`bars-${curve ?? 'default'}`}
        getX={(d) => d.date}
        getValue={(d, key) => (key === 'bar' ? d.v : d.v * 2)}
        positiveBars={[{ key: 'bar', label: 'Bar', color: '#0a0' }]}
        lines={[
          {
            key: 'line',
            label: 'Line',
            color: LINE_COLOR,
            ...(curve !== undefined && { curve }),
          },
        ]}
        height={240}
      />,
    )

  /** The overlay's own path — the bars are rects, but zones/refLines can add paths of their own. */
  const overlayPath = (container: HTMLElement): string => {
    const d = container.querySelector(`path[stroke="${LINE_COLOR}"]`)?.getAttribute('d') ?? ''
    expect(d.length).toBeGreaterThan(0)
    return d
  }

  test('the default overlay is smoothed — cubic segments', () => {
    expect(overlayPath(renderBars().container)).toContain('C')
  })

  test("curve: 'stepAfter' redraws the overlay as axis-aligned segments, not a smoothed line", () => {
    const stepped = overlayPath(renderBars('stepAfter').container)
    expect(stepped).not.toContain('C')
    expect(segmentsAreAxisAligned(stepped)).toBe(true)
  })

  test('the two are provably different geometry over the same four points', () => {
    expect(overlayPath(renderBars('stepAfter').container)).not.toBe(
      overlayPath(renderBars().container),
    )
  })
})

/**
 * `StackedArea` is the one kind that CANNOT honour a curve per series: `AreaStack` draws every band
 * from one curve, and the bands share their boundaries, so two curves would leave gaps and overlaps
 * between them. The rule it uses instead — read off the implementation, which searches `visible` in
 * `reversedSeries` order — is: **the TOPMOST visible band that declares a `curve` wins for the
 * whole stack**, i.e. the LAST such entry in the caller's own `series` array. A band declaring no
 * curve is skipped rather than resolving to the monotone default, and a HIDDEN band is not
 * consulted at all, so a legend toggle can hand the stack to the next declarer down.
 */
type Band = { date: string; a: number; b: number }

const bandRows: Band[] = [
  { date: '2026-08-01', a: 10, b: 5 },
  { date: '2026-08-02', a: 40, b: 8 },
  { date: '2026-08-03', a: 25, b: 3 },
  { date: '2026-08-04', a: 25, b: 9 },
]

/** Two bands, bottom (`a`) to top (`b`), each declaring a curve or not. */
const stack = (
  first?: ChartSeries<Band>['curve'],
  second?: ChartSeries<Band>['curve'],
): ChartSeries<Band>[] => [
  {
    key: 'a',
    label: 'A',
    color: '#0a0',
    mark: 'area',
    getValue: (d) => d.a,
    ...(first !== undefined && { curve: first }),
  },
  {
    key: 'b',
    label: 'B',
    color: '#00a',
    mark: 'area',
    getValue: (d) => d.b,
    ...(second !== undefined && { curve: second }),
  },
]

describe('StackedArea shares ONE curve across the stack', () => {
  const renderStack = (series: ChartSeries<Band>[], id: string) =>
    render(
      <StackedArea<Band>
        data={bandRows}
        chartId={id}
        getX={(d) => d.date}
        series={series}
        legend={{}}
        height={240}
      />,
    )

  test('a curve on ONE band governs every band — the stack cannot mix two', () => {
    const { container } = renderStack(stack(undefined, 'stepAfter'), 'stack-one')
    expect(new Set(commandsOf(container))).toEqual(new Set(['M', 'L', 'Z']))
    expect(everySegmentIsAxisAligned(container)).toBe(true)
  })

  test('a band declaring none is SKIPPED, not read as the monotone default', () => {
    // Only the BOTTOM band declares one; the topmost declarer is therefore still `a`.
    const { container } = renderStack(stack('stepAfter', undefined), 'stack-bottom-only')
    expect(commandsOf(container)).not.toContain('C')
    expect(everySegmentIsAxisAligned(container)).toBe(true)
  })

  test('the TOPMOST declarer wins when two bands disagree', () => {
    const { container } = renderStack(stack('linear', 'stepAfter'), 'stack-both')
    // `b` is the top band, so its stepAfter governs — `a`'s linear does not, even though it is
    // first in `series` order.
    expect(commandsOf(container)).not.toContain('C')
    expect(everySegmentIsAxisAligned(container)).toBe(true)
  })

  test('a HIDDEN band’s curve is ignored — the next VISIBLE declarer takes the stack', () => {
    const { container } = renderStack(stack('linear', 'stepAfter'), 'stack-hidden')
    expect(everySegmentIsAxisAligned(container)).toBe(true)

    fireEvent.click(container.querySelector('[data-legend-key="b"]') as Element)

    // `b` is gone, so the stack falls to `a`'s linear — straight segments, provably not stepped.
    expect(commandsOf(container)).not.toContain('C')
    expect(everySegmentIsAxisAligned(container)).toBe(false)
  })
})
