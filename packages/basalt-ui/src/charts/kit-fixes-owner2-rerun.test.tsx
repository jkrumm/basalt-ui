/**
 * Owner review 2 rerun (`v3-owner-2-rerun-kit-fixes`): the hover chip pins an x value only to the panel
 * that labels the axis, and a y title keeps clear of the focus ring. The zero stack's reading and the
 * rendered geometry are in `tests/layout/charts-owner2-rerun.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { crosshairGuide } from './core/compile'
import { chartCursorView } from './core/cursor'
import type { CartesianInput } from './core/compile'
import { yTitleScale } from './axis-gaps'

type Row = { x: number; y: number }
const input = (extra: Partial<CartesianInput<Row, number>> = {}): CartesianInput<Row, number> =>
  ({
    chartId: 'c',
    data: [{ x: 0, y: 1 }],
    x: (d: Row) => d.x,
    series: [],
    marks: () => [],
    ...extra,
  }) as CartesianInput<Row, number>

const guide = (extra: Partial<CartesianInput<Row, number>>) =>
  crosshairGuide({
    input: input(extra),
    pinned: true,
    formatX: String,
    formatY: (v) => String(v),
  })

describe('the x chip sits on the panel that labels the axis', () => {
  test('a chart with tick labels pins its x value', () => {
    expect(guide({})?.x).toMatchObject({ label: { fontWeight: 500 } })
    expect(guide({ xTicks: 3 })?.x).toMatchObject({ label: { fontWeight: 500 } })
  })

  test('a chart whose x ticks are none pins none (the rule stays), the y chip stays', () => {
    const g = guide({ xTicks: [] })
    expect(g?.x).toMatchObject({ label: false, strokeDasharray: '3 3' })
    expect(g?.y).toMatchObject({ label: { fontWeight: 500 } })
  })

  test('with the rule off the x guide is invisible and still pins nothing', () => {
    expect(guide({ xTicks: [], crosshair: false })?.x).toMatchObject({
      label: false,
      strokeOpacity: 0,
    })
  })
})

describe('the x chip is the hovered chart’s, not one per stacked panel', () => {
  const view = (chartId: string) =>
    chartCursorView({ group: 'stack', chartId, keys: [0, 1], mode: 'nearest' })
  const xLabel = (chartId: string, value: number): string => {
    const x = guide({ chartId, cursorGroup: 'stack' })?.x as {
      label: { format: (v: number) => string }
    }
    return x.label.format(value)
  }

  test('the chart the pointer is on prints its value, a follower prints none', () => {
    const lead = view('lead')
    const follower = view('follower')
    const release = [lead.subscribe(() => {}), follower.subscribe(() => {})]
    lead.setState({ anchor: 'value', value: { x: 1 } } as never)
    expect(xLabel('lead', 1)).toBe('1')
    expect(xLabel('follower', 1)).toBe('')
    for (const stop of release) stop()
  })

  test('a leader that draws no x chip leaves the chip to the follower that labels the axis', () => {
    const lead = chartCursorView({
      group: 'stack',
      chartId: 'upper',
      keys: [0, 1],
      mode: 'nearest',
      xChip: () => false,
    })
    const follower = view('lower')
    const release = [lead.subscribe(() => {}), follower.subscribe(() => {})]
    lead.setState({ anchor: 'value', value: { x: 1 } } as never)
    expect(xLabel('lower', 1)).toBe('1')
    for (const stop of release) stop()
  })

  test('a state no chart published (an app timeline) is printed by every chart', () => {
    const only = view('only')
    const release = only.subscribe(() => {})
    expect(xLabel('only', 1)).toBe('1')
    release()
  })
})

describe('a y title clears the focus ring', () => {
  const dx = (side: 'left' | 'right'): number =>
    (
      yTitleScale('Rain, %', side).axis as {
        tickLabels: { dx: number }
      }
    ).tickLabels.dx

  test('the left title starts 4 px in, the right one ends 4 px in', () => {
    expect(dx('left')).toBe(4)
    expect(dx('right')).toBe(-4)
  })
})
