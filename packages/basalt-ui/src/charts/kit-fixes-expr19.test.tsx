/**
 * Expression cycle 19 (`v3-expr-19-kit-fixes` 2, 5, 7): bar values stand over their bar, raised and tied by a leader
 * when a neighbour hides the spot, or beside a bar that ends at the plot's edge, never inside a bar's fill; a value past
 * the cap beside a line names its series; a zone caption stays inside its zone on a phone's plot; an ink-step bar dims
 * under a focus held outside the chart (a table row), as a hue does.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { barValueLabels } from './core/bar-values'
import type { BarValuesInput } from './core/bar-values'
import { zoneSideSpotsFit } from './core/compile'
import { useChartFocus } from './focus'
import type { ChartFocus } from './focus'
import { renderToString } from 'react-dom/server'
import { Bars } from './parts/bars'
import { CartesianChart } from './parts/cartesian'
import type { ChartSeries } from './types'

type Bar = { x: number; v: number }
const series: ChartSeries<Bar> = {
  key: 'v',
  label: 'V',
  color: 'var(--basalt-chart-1)',
  getValue: (d) => d.v,
  mark: 'bar',
  values: (v) => `+${v} pts`,
}

const FRAME = { width: 300, height: 200 }
/** The bars of a 0..100 domain over a 200 px plot: a value is two px tall. */
const input = (data: readonly Bar[], bodyPx: number): BarValuesInput<Bar, number> => {
  const body = (d: Bar) => ({
    left: d.x * FRAME.width - bodyPx / 2,
    top: FRAME.height - d.v * 2,
    width: bodyPx,
    height: d.v * 2,
  })
  return {
    series: [series],
    data,
    x: (d) => d.x,
    fraction: (x) => x,
    barHalf: bodyPx / 2 / FRAME.width,
    stack: undefined,
    sideOf: () => 'left',
    domainOf: () => [0, 100],
    scaleOf: () => 'y',
    formatOf: () => (v) => String(v),
    frame: FRAME,
    focused: null,
    obstacles: data.map(body),
    clear: [],
  }
}
const meets = (
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

describe('a value its neighbour hides', () => {
  const data: Bar[] = [
    { x: 0.15, v: 60 },
    { x: 0.23, v: 40 },
    { x: 0.31, v: 20 },
  ]

  test('is raised over its own bar clear of every body and label, and tied to it by a leader', () => {
    const given = input(data, 20)
    const out = barValueLabels(given)
    expect(out.boxes).toHaveLength(3)
    for (const box of out.boxes)
      for (const body of given.obstacles) expect(meets(box, body)).toBe(false)
    for (const [i, a] of out.boxes.entries())
      for (const b of out.boxes.slice(i + 1)) expect(meets(a, b)).toBe(false)
    // Its own bar ends at 120 px from the top; a label standing on it would be within 16 px of that.
    const lifted = out.boxes.filter((b) => b.top + b.height < 120 - 16 - 8)
    expect(lifted.length).toBeGreaterThan(0)
    expect(out.backed, 'a leader draws on the hidden x scale').toBe(true)
  })
})

describe('a bar that ends at the plot edge', () => {
  test('keeps its value beside the bar, never inside it', () => {
    const given = input(
      [
        { x: 0.2, v: 100 },
        { x: 0.6, v: 30 },
      ],
      20,
    )
    const out = barValueLabels(given)
    expect(out.boxes).toHaveLength(2)
    const body = given.obstacles[0] as (typeof given.obstacles)[number]
    const top = out.boxes.find((b) => b.top < 20) as (typeof out.boxes)[number]
    expect(top, 'the label of the bar at the edge').toBeDefined()
    expect(meets(top, body)).toBe(false)
  })
})

describe('a value past the cap beside a line', () => {
  type Pt = { k: number; bar: number; avg: number }
  const rows: Pt[] = [
    { k: 0, bar: 2, avg: 8 },
    { k: 1, bar: 3, avg: 52.3 },
    { k: 2, bar: 2, avg: 9 },
  ]
  const INK = { light: '#6b6b6b', dark: '#a8a8a8' }
  const valueText = (html: string): string =>
    /<text data-ts-key="off-scale-avg-value[^"]*"[^>]*>([^<]*)<\/text>/.exec(html)?.[1] ?? ''
  const render = (mixed: boolean): string =>
    renderToString(
      <CartesianChart<Pt>
        label="V"
        data={rows}
        x={{ value: (d) => String(d.k) }}
        y={{ domain: [0, 30] }}
        series={[
          ...(mixed
            ? [
                {
                  mark: 'bar' as const,
                  key: 'bar',
                  label: 'Worst',
                  color: INK,
                  y: (d: Pt) => d.bar,
                },
              ]
            : []),
          {
            mark: 'line' as const,
            key: 'avg',
            label: 'Average',
            color: INK,
            format: (v: number) => `${v} Issues`,
            y: (d: Pt) => d.avg,
          },
        ]}
      />,
    )

  test('names its series where a bar shares the plot', () => {
    expect(valueText(render(true))).toBe('Average 52.3 Issues')
  })

  test('stays the bare number on a plot of lines alone', () => {
    expect(valueText(render(false))).toBe('52.3 Issues')
  })
})

describe('a zone caption on a phone', () => {
  test('stands inside its zone or is dropped: a plot under 480 px has no spot beside the zone', () => {
    expect(zoneSideSpotsFit(342)).toBe(false)
    expect(zoneSideSpotsFit(1400)).toBe(true)
    expect(zoneSideSpotsFit(0)).toBe(true)
  })
})

describe('an ink-step bar under a focus held outside the chart', () => {
  let root: ReturnType<typeof createRoot> | undefined
  let handle: ChartFocus<Bar> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })
  const DAYS: readonly Bar[] = Array.from({ length: 6 }, (_, x) => ({ x, v: 3 + x }))
  const GREY = { light: '#6b6b6b', dark: '#a8a8a8' }

  function Chart() {
    const focus = useChartFocus(DAYS, { announce: (d) => `day ${d.x}` })
    useEffect(() => {
      handle = focus
    })
    return (
      <Bars<Bar>
        label="Days"
        data={DAYS}
        x={{ value: (d) => String(d.x) }}
        layout="grouped"
        focus={focus}
        series={[{ mark: 'bar', key: 'v', label: 'V', color: GREY, y: (d) => d.v }]}
      />
    )
  }

  test('the others fade by opacity and the focused one rises past its resting paint', async () => {
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => root?.render(<Chart />))
    await act(async () => new Promise((r) => setTimeout(r, 20)))
    const fills = () =>
      [...el.querySelectorAll('rect[data-ts-key^="bars:"]')].map(
        (r) => r.getAttribute('fill') ?? '',
      )
    expect(fills().every((f) => f.includes('85%'))).toBe(true)
    await act(async () => handle?.set(2))
    const held = fills()
    expect(held).toHaveLength(6)
    expect(held[2]).toContain('var(--basalt-ink)')
    for (const [i, f] of held.entries()) if (i !== 2) expect(f, `bar ${i}`).toContain('66%')
  })
})
