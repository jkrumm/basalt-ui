/**
 * Expression cycle 11 (`v3-expr-11-kit-fixes`, `expression-11.12`, `.42`, `.55`): the axis hover readout
 * never lands on a tick label. The engine hands a tick label's opacity callback the live focus, so the
 * tick a readout would cover is blanked while it is focused and restored when focus clears.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartSeries } from './types'
import { compileCartesian } from './core/compile'

type Row = { x: number; v: number }
const dots: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'var(--basalt-line)',
  mark: 'dot',
  getValue: (d) => d.v,
}
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({ x: i * 50, v: i * 10 }))

type Context = { value: number; position: number; focus: Focus }
type Focus = { primary: { x: number; y: number; xValue: number } } | null
type Opacity = number | ((context: Context) => number)
type Scales = {
  x: { axis: { tickLabels: { opacity: Opacity } } }
  y: { axis: { tickLabels: { opacity: Opacity } } }
}
const scalesOf = (extra: object = {}, width = 600): Scales =>
  compileCartesian<Row, number>({
    chartId: 'expr11-readout',
    locale: 'en',
    data: rows,
    x: (d) => d.x,
    series: [dots],
    marks: () => [],
    ...extra,
  }).chart({ width, height: 300, defaultTheme: {} as never }).scales as unknown as Scales

const read = (opacity: Opacity, context: Context): number =>
  typeof opacity === 'function' ? opacity(context) : opacity

const at = (x: number, y: number): Focus => ({ primary: { x, y, xValue: x } })
const tickAt = (position: number): Pick<Context, 'value' | 'position'> => ({
  value: position,
  position,
})

describe('the x readout replaces the tick it lands on', () => {
  test('a label under the readout is blanked and its neighbours stay', () => {
    const { opacity } = scalesOf().x.axis.tickLabels
    const focus = at(300, 120)
    expect(read(opacity, { ...tickAt(300), focus })).toBe(0)
    expect(read(opacity, { ...tickAt(312), focus })).toBe(0)
    expect(read(opacity, { ...tickAt(200), focus })).toBe(1)
    expect(read(opacity, { ...tickAt(400), focus })).toBe(1)
  })

  test('every label is back at rest', () => {
    const { opacity } = scalesOf().x.axis.tickLabels
    expect(read(opacity, { ...tickAt(300), focus: null })).toBe(1)
  })

  test('a readout the engine pushes in from the chart edge is measured where it is drawn', () => {
    const { opacity } = scalesOf({}, 400).x.axis.tickLabels
    // Focus at the right edge: the tag is clamped inward, over the label a few px left of it.
    expect(read(opacity, { ...tickAt(380), focus: at(399, 120) })).toBe(0)
    expect(read(opacity, { ...tickAt(300), focus: at(399, 120) })).toBe(1)
  })
})

describe('the y readout replaces the tick on its row', () => {
  test('a label on the readout row is blanked and the rest stay', () => {
    const { opacity } = scalesOf().y.axis.tickLabels
    const focus = at(100, 150)
    expect(read(opacity, { ...tickAt(150), focus })).toBe(0)
    expect(read(opacity, { ...tickAt(158), focus })).toBe(0)
    expect(read(opacity, { ...tickAt(100), focus })).toBe(1)
    expect(read(opacity, { ...tickAt(200), focus })).toBe(1)
  })

  test('every label is back at rest', () => {
    const { opacity } = scalesOf().y.axis.tickLabels
    expect(read(opacity, { ...tickAt(150), focus: null })).toBe(1)
  })

  test('a chart with a right axis draws no y readout: only the lowest label clears, for the x chip', () => {
    const { opacity } = scalesOf({
      y2: {},
      series: [dots, { ...dots, key: 'w', axis: 'right' }],
    }).y.axis.tickLabels
    expect(read(opacity, { ...tickAt(150), focus: at(100, 150) })).toBe(1)
    // The x chip at the plot's left edge hangs over the lowest label of the left axis.
    expect(read(opacity, { value: 0, position: 150, focus: at(2, 150) })).toBe(0)
    expect(read(opacity, { value: 60, position: 150, focus: at(2, 150) })).toBe(1)
  })
})
