/**
 * Expression cycle 16 kit fixes, labels (`v3-expr-16-kit-fixes` 3, 4 and 8): a bar value is kept where its bar has
 * room and the values keep apart (n70, n76), a clamped value is never dropped for a line (n67), a displaced end label
 * on the plot's edge keeps its leader (n74), a dense column of dots swells to a swarm (n72) and an x chip covers no
 * tick label, its own included (n80, n67). The browser half is `kit-expr16l-labels.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import type { LabelBox } from './chart-labels'
import { barValueLabels } from './core/bar-values'
import { offScaleMarks } from './core/axis-ext'
import { chipCoversTick, chipRepeatsTick, xTickOpacity } from './core/readout-clear'
import type { XTickLabel } from './core/readout-clear'
import { spreadPoints } from './core/spread'
import { leaderStalk } from './labels'
import type { ChartSeries } from './types'

const meets = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

type Bar = { i: number; v: number }

/** `values` of a grouped bar series on a plot `width` wide whose bars are `slot` wide, bodies as the host publishes them. */
function hourly(opts: {
  values: readonly number[]
  width: number
  height: number
  domain: readonly [number, number]
  highlight?: number
  text?: (v: number) => string
  rules?: readonly LabelBox[]
}) {
  const { values, width, height, domain, highlight } = opts
  const n = values.length
  const slot = width / n
  const [lo, hi] = domain
  const series = [
    {
      key: 'a',
      label: 'A',
      mark: 'bar',
      color: 'var(--basalt-chart-1)',
      getValue: (d: Bar) => d.v,
      values: true,
      ...(highlight !== undefined && { highlight: (d: Bar) => d.i === highlight }),
    },
  ] as unknown as ChartSeries<Bar>[]
  const data = values.map((v, i) => ({ i, v }))
  const bodies = data.map((d) => ({
    left: (d.i + 0.5) * slot - slot * 0.4,
    top: height - (Math.min(d.v, hi) / (hi - lo)) * height,
    width: slot * 0.8,
    height: (Math.min(d.v, hi) / (hi - lo)) * height,
  }))
  const rules = opts.rules ?? []
  return barValueLabels<Bar, number>({
    series,
    data,
    x: (d) => d.i,
    fraction: (x) => (x + 0.5) / n,
    barHalf: (slot * 0.4) / width,
    stack: undefined,
    sideOf: () => 'left',
    domainOf: () => domain,
    scaleOf: () => 'y',
    formatOf: () => opts.text ?? ((v) => String(v)),
    frame: { width, height },
    focused: null,
    obstacles: [...bodies, ...rules],
    clear: [...rules],
  })
}

describe('bar values at a phone width', () => {
  const PAGES = [
    336, 360, 369, 330, 371, 333, 322, 329, 275, 255, 254, 230, 196, 233, 230, 214, 244, 234, 218,
    247, 276, 287, 334, 300,
  ]

  test('twenty-four hourly bars keep a dozen values, each clear of the others (n76)', () => {
    const out = hourly({ values: PAGES, width: 302, height: 247, domain: [0, 371], highlight: 23 })
    expect(out.written.size).toBeGreaterThanOrEqual(12)
    for (const [i, a] of out.boxes.entries())
      for (const b of out.boxes.slice(i + 1)) expect(meets(a, b), 'two values overlap').toBe(false)
  })

  test('the highlighted last hour keeps its value between its neighbours (n76 moving)', () => {
    const out = hourly({ values: PAGES, width: 302, height: 247, domain: [0, 371], highlight: 23 })
    expect(out.written.has('a:' + 23.5 / 24)).toBe(true)
  })

  test('a bar filling its slot at the top of the plot keeps its value inside (n70 100 %)', () => {
    const out = hourly({
      values: [61, 71, 0, 100, 23, 45, 37],
      width: 303,
      height: 71,
      domain: [0, 110],
      text: (v) => `${v} %`,
      rules: [{ left: 0, top: 71 - (100 / 110) * 71 - 2, width: 303, height: 4 }],
    })
    expect(out.written.has('a:' + 3.5 / 7)).toBe(true)
  })
})

describe('a clamped value past the plot edge', () => {
  type Row = { d: number; v: number }
  const W = 300
  const H = 160
  const SERIES = [
    {
      key: 'v',
      label: 'V',
      mark: 'line',
      color: 'var(--basalt-chart-1)',
      getValue: (d: Row) => d.v,
    },
  ] as unknown as ChartSeries<Row>[]
  const capMarks = (obstacles: readonly LabelBox[]) =>
    offScaleMarks<Row, number>({
      series: SERIES,
      data: [
        { d: 0.2, v: 40 },
        { d: 0.5, v: 150 },
      ],
      x: (d) => d.d,
      fraction: (x) => x,
      domainOf: () => [0, 120],
      yScaleOf: () => 'y',
      formatOf: () => (v) => `+${v - 120} kg`,
      labels: { frame: () => ({ width: W, height: H }), obstacles: () => obstacles },
    })

  test("a spike's own line under its caret leaves the value beside the caret, over the line", () => {
    const spike: LabelBox = { left: 0.5 * W - 2, top: 0, width: 4, height: H }
    expect(capMarks([spike])).toHaveLength(2)
  })

  test('a plot covered by labels and captions still drops it rather than overprint a text', () => {
    const caption: LabelBox = { left: 0, top: 0, width: W, height: H }
    expect(capMarks([caption])).toHaveLength(1)
  })
})

describe("an end label on the plot's right edge", () => {
  test('its leader stands just inside the plot, where the plot does not clip it (n74)', () => {
    const stalk = leaderStalk({
      fraction: 1,
      from: 31,
      to: 18.75,
      dx: -6,
      thinX: 1 / 300,
      thinY: 0.375,
    })
    expect(stalk.f1).toBeLessThanOrEqual(1)
    expect(stalk.f1 - stalk.f0).toBeCloseTo(1 / 300)
    expect([stalk.y0, stalk.y1]).toEqual([18.75, 31])
  })

  test('a leader of a line ending inside the plot keeps its place', () => {
    const stalk = leaderStalk({ fraction: 0.5, from: 1, to: 2, dx: 6, thinX: 0.01, thinY: 0.1 })
    expect(stalk.f0).toBe(0.5)
  })
})

describe('a dense column of dots (n72)', () => {
  const r = 3
  const column = Array.from({ length: 70 }, (_, i) => ({
    along: 10 + ((i * 13) % 100),
    across: 280,
    r,
  }))

  test('spreads along its axis where there is room, and steps sideways where there is none', () => {
    const placed = spreadPoints(column, { along: 120, across: 300 })
    for (const [i, a] of placed.entries())
      for (const b of placed.slice(i + 1))
        expect(Math.hypot(a.along - b.along, a.across - b.across)).toBeGreaterThanOrEqual(2 * r)
    expect(placed.every((p) => p.across <= 300 - r && p.across >= r)).toBe(true)
  })

  test('a plot with no room across keeps the dots on their line', () => {
    const placed = spreadPoints(column, { along: 120, across: 0 })
    expect(placed.every((p, i) => p.across === (column[i] as { across: number }).across)).toBe(true)
  })

  test('dots that find room along the axis move exactly as before', () => {
    const placed = spreadPoints(
      [
        { along: 100, across: 50, r: 4 },
        { along: 100, across: 50, r: 4 },
      ],
      { along: 200, across: 200 },
    )
    expect(placed[1]?.across).toBe(50)
    expect(placed[1]?.along).toBeCloseTo(109)
  })
})

// A log axis: the share of the plot width of each value.
const share = (v: unknown): number =>
  (Math.log10(Number(v)) - Math.log10(0.011)) / (Math.log10(0.2) - Math.log10(0.011))
const covers = (value: number, ticks: readonly XTickLabel[]): boolean =>
  chipCoversTick({
    value,
    readoutText: `US${value.toFixed(3)}`,
    fontSize: 11,
    plotWidth: 700,
    share,
    ticks,
  })

describe('the x chip and the tick labels (n80, n67)', () => {
  const ticks: XTickLabel[] = [0.015, 0.024, 0.048, 0.09, 0.15].map((value) => ({
    value,
    text: `US$${value.toFixed(3)}`,
    anchor: undefined,
    dx: undefined,
  }))

  test('a chip with the text of a tick at its own value only repeats it', () => {
    expect(chipRepeatsTick(0.015, 'US$0.015', ticks)).toBe(true)
    expect(chipRepeatsTick(0.016, 'US$0.016', ticks)).toBe(false)
    expect(chipRepeatsTick(0.015, 'US$0.016', ticks)).toBe(false)
  })

  test('a chip of a nearby value covers the tick beside it, one far from every tick covers none', () => {
    expect(covers(0.016, ticks)).toBe(true)
    expect(covers(0.05, ticks)).toBe(true)
    expect(covers(0.032, ticks)).toBe(false)
  })

  test('a focused band whose tick names it replaces that tick and blanks none beside it (n75 at 390)', () => {
    const names = ['Site', 'Request page', 'Form started', 'Request sent']
    const band: XTickLabel[] = names.map((text) => ({
      value: text,
      text,
      anchor: undefined,
      dx: undefined,
    }))
    const opacity = xTickOpacity({
      tick: {
        text: (v) => String(v),
        anchor: () => undefined,
        dx: (v) => band.find((t) => t.value === v)?.dx,
      },
      readoutText: (v) => String(v),
      fontSize: 11,
      width: 340,
      ticks: band,
    })
    const focus = { primary: { x: 150, y: 10, xValue: 'Form started' } }
    const read = (value: string, position: number) => opacity({ value, position, focus })
    // 92 px between the centres: the over-estimated boxes (90 px each) clear each other only without air.
    expect(read('Request page', 58)).toBe(1)
    expect(read('Form started', 150)).toBe(0)
    expect(read('Request sent', 242)).toBe(1)
  })

  // Expression cycle 19 (`v3-expr-19-kit-fixes` 4): a chip bolder than its thinned tick never touches the next tick,
  // and the chip of a bar in a group (off its band's centre) prints its name once, not beside its tick.
  test('a focused band keeps air from the tick beside it, and its own tick gives way where the chip stands off it (n96, n98)', () => {
    const names = ['35', '40', '50']
    const band: XTickLabel[] = names.map((text) => ({
      value: text,
      text,
      anchor: undefined,
      dx: undefined,
    }))
    const make = (width: number) =>
      xTickOpacity({
        tick: { text: (v) => String(v), anchor: () => undefined, dx: () => undefined },
        readoutText: (v) => String(v),
        fontSize: 11,
        width,
        ticks: band,
      })
    const opacity = make(340)
    const focus = { primary: { x: 100, y: 10, xValue: '40' } }
    // The chip '40' stands 14 px from the next tick '50': their boxes touch without air, so the neighbour gives way.
    expect(opacity({ value: '50', position: 114, focus })).toBe(0)
    // A chip off its own tick's place (the bar of a group, 30 px from its band's centre) replaces that tick.
    expect(opacity({ value: '40', position: 130, focus })).toBe(0)
    // Far from the chip the neighbour stays.
    expect(opacity({ value: '35', position: 10, focus })).toBe(1)
  })
})
