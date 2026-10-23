/** `RefLine.label`: on-plot text at the line's plot end — flips below near the top, follows the legend toggle. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Bars } from './Bars'
import { Lines } from './Lines'
import { referenceLabelPlacement, refLabelDy, refLabelPosition } from './ref-label'
import type { ChartSeries, RefLine } from './types'

type Row = { t: Date; a: number }
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), a: d * 100 }))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}

const ssr = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

const labelOf = (el: Element, i: number): Element | null =>
  el.querySelector(`g[data-ts-key="ref-${i}-label"]`)
const ruleOf = (el: Element, i: number): Element | null =>
  el.querySelector(`g[data-ts-key="ref-${i}"]`)

/** The label's y minus its line's y: negative above, positive below. */
const offset = (el: Element, i: number): number => {
  const line = ruleOf(el, i)?.querySelector('line')
  const label = labelOf(el, i)?.querySelector('text')
  return Number(label?.getAttribute('y')) - Number(line?.getAttribute('y1'))
}

const ref = (over: Partial<RefLine> = {}): RefLine => ({
  value: 250,
  color: 'var(--vx-good-ref)',
  label: '250 target',
  ...over,
})
const lines = (refLines: RefLine[], extra: object = {}) => (
  <Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refLines} {...extra} />
)

describe('RefLine.label', () => {
  test('renders the text, in the ink token rather than the line colour', () => {
    const el = ssr(lines([ref()]))
    const group = labelOf(el, 0)
    expect(group?.textContent).toBe('250 target')
    expect(group?.innerHTML).toContain('var(--vx-ink2)')
    expect(group?.innerHTML).not.toContain('--vx-good-ref')
  })

  test('sits above the line by default', () => {
    const el = ssr(lines([ref()]))
    expect(offset(el, 0)).toBeLessThan(0)
  })

  test('flips below the line near the top of the plot', () => {
    const el = ssr(lines([ref({ value: 400 })], { y: { domain: [0, 400] } }))
    expect(offset(el, 0)).toBeGreaterThan(0)
  })

  // Domain [0, 400], band = top 12% = values above 352.
  test('just inside the top band flips below', () => {
    const el = ssr(lines([ref({ value: 360 })], { y: { domain: [0, 400] } }))
    expect(offset(el, 0)).toBeGreaterThan(0)
  })

  test('just outside the top band stays above', () => {
    const el = ssr(lines([ref({ value: 345 })], { y: { domain: [0, 400] } }))
    expect(offset(el, 0)).toBeLessThan(0)
  })

  test('works on Bars', () => {
    const el = ssr(<Bars ariaLabel="B" data={data} x={x} bars={[a]} refLines={[ref()]} />)
    expect(labelOf(el, 0)?.textContent).toBe('250 target')
  })

  test('a right-axis line labels at the left end, clear of the right tick labels', () => {
    const b: ChartSeries<Row> = { ...a, key: 'b', axis: 'right' }
    const el = ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a, b]}
        y2={{}}
        refLines={[ref({ axis: 'right' })]}
      />,
    )
    expect(labelOf(el, 0)?.innerHTML).toContain('text-anchor="start"')
  })

  test('a left-axis line labels at the right end', () => {
    const el = ssr(lines([ref()]))
    expect(labelOf(el, 0)?.innerHTML).toContain('text-anchor="end"')
  })

  test('toggling the line off in the legend hides its label too', async () => {
    const el = await mount(lines([ref({ legend: { label: 'Target' } })]))
    expect(labelOf(el, 0)).not.toBeNull()
    const toggle = el.querySelector('button[data-legend-key="__ref-0"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggle')
    await act(async () => {
      toggle.click()
    })
    expect(ruleOf(el, 0)).toBeNull()
    expect(labelOf(el, 0)).toBeNull()
  })

  test('no label: no label mark', () => {
    const el = ssr(lines([ref({ label: undefined })]))
    expect(labelOf(el, 0)).toBeNull()
    expect(el.querySelector('g[data-ts-key$="-label"]')).toBeNull()
  })
})

describe('a caption keeps clear of claimed boxes (w43 r2)', () => {
  const base = {
    pinned: undefined,
    startFirst: false,
    value: 50,
    domain: [0, 100] as const,
    plotWidth: 1000,
    plotHeight: 300,
    label: 'Goal',
    fontSize: 11,
    series: [],
  }
  test('with the plot empty the caption takes the end, above', () => {
    expect(refLabelPosition(base)).toBe('end-above')
  })
  test('an end label over that spot sends it to the next one that is free', () => {
    const claimed = [{ fx0: 0.9, fx1: 1, y0: 51, y1: 56 }]
    expect(refLabelPosition({ ...base, claimed })).toBe('end-below')
    expect(
      refLabelPosition({ ...base, claimed: [...claimed, { fx0: 0.9, fx1: 1, y0: 44, y1: 49 }] }),
    ).toBe('start-above')
  })
})

describe('a sparkline caption slides off a line that starts on its reference (w43 r2)', () => {
  const line = [0, 0.1, 0.2, 0.4, 1].map((fx, i) => ({ fx, y: [100, 98, 96, 92, 85][i] as number }))
  const place = (width: number) =>
    referenceLabelPlacement({
      value: 100,
      domain: [84, 101],
      height: 28,
      width,
      inset: 3,
      fontSize: 11,
      label: 'PR',
      line,
    })
  test('the box takes the spot below, moved past the line, never touching it', () => {
    const { side, end, dy } = place(500)
    expect([side, end]).toEqual(['below', 'start'])
    // Nominal is 2 px of gap plus half the box (7.5); the line's 2 px drop in the box's span pushes it further.
    expect(dy).toBeGreaterThan(7.5)
  })
})

describe('a caption box clears its line (W49)', () => {
  test('the centred text is a full font size off the line, above and below', () => {
    for (const fontSize of [10, 11, 13]) {
      const above = refLabelDy('end-above', fontSize)
      const below = refLabelDy('start-below', fontSize)
      expect(above).toBeLessThanOrEqual(-(fontSize / 2))
      expect(below).toBeGreaterThanOrEqual(fontSize / 2)
      expect(above).toBe(-below)
    }
  })
})

describe('a sparkline caption with no clear spot stays in the box (W49)', () => {
  // The PR strip: a 28 px box, 3 px inset, an 11 px caption; the reference is the series maximum.
  const BOX_HEIGHT = 28
  const INSET = 3
  const FONT = 11
  const PLOT_WIDTH = 120
  const PEAK = 14
  const FLOOR = 3
  const LINE_VALUES = [3, 5, 8, 6, 9, 12, 10, 11, 14, 12]
  const line = LINE_VALUES.map((y, i) => ({ fx: i / (LINE_VALUES.length - 1), y }))
  const place = (over: Partial<Parameters<typeof referenceLabelPlacement>[0]> = {}) =>
    referenceLabelPlacement({
      value: PEAK,
      domain: [FLOOR, PEAK],
      height: BOX_HEIGHT,
      width: PLOT_WIDTH,
      inset: INSET,
      fontSize: FONT,
      label: 'PR',
      line,
      ...over,
    })
  const topOf = (dy: number, height: number, value = PEAK): number =>
    INSET + (height - 2 * INSET) * (1 - (value - FLOOR) / (PEAK - FLOOR)) + dy - FONT / 2

  test('the box stays inside the plot where a spot allows', () => {
    const top = topOf(place().dy, BOX_HEIGHT)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + FONT).toBeLessThanOrEqual(BOX_HEIGHT)
  })
  test('a box taller than the plot starts at the top edge', () => {
    const height = FONT - 2
    expect(topOf(place({ height }).dy, height)).toBe(0)
  })
  test('a line along the reference leaves no clear spot, yet the box never strikes the rule', () => {
    const MID = 8.5
    const height = 22
    const flat = [0, 1].map((fx) => ({ fx, y: MID }))
    const { dy } = place({ value: MID, height, line: flat })
    const top = topOf(dy, height, MID)
    const at = INSET + (height - 2 * INSET) * (1 - (MID - FLOOR) / (PEAK - FLOOR))
    expect(top < at && top + FONT > at).toBe(false)
  })
  test('without a line only the plot bounds decide', () => {
    const { dy } = place({ line: undefined })
    const top = topOf(dy, BOX_HEIGHT)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + FONT).toBeLessThanOrEqual(BOX_HEIGHT)
  })
})
