/**
 * Expression cycle 13 kit fixes, the end label group (`v3-expr-13-kit-fixes` 4): a label the spread
 * moves off its line's end is joined to that end by a leader; a label that stays by its end gets none.
 */
import { describe, expect, test } from 'bun:test'
import { estimateWidth, lineHeight, placeWith } from './label-place'
import { endLabelPlan } from './labels'
import type { ChartSeries, PlotContext } from './types'

const W = 300
const H = 160
const POINTS = 12
const NAMES = ['Ceiling', 'Alpha', 'Beta', 'Gamma', 'Delta']

/** A plot of lines on a 0 to 100 domain, as much of a `PlotContext` as the end label plan reads. */
function plot(lines: number[][]): PlotContext<number> {
  const visible = lines.map((_, i) => ({ key: String(i), label: NAMES[i], mark: 'line' }))
  return {
    rows: (key: string) => (lines[Number(key)] ?? []).map((y, i) => ({ x: i, y, datum: i })),
    visible,
    containerClass: 'regular',
    plotWidth: W,
    plotHeight: H,
    width: W + 50,
    height: H + 40,
    y2: undefined,
    xFraction: (x: number) => x / (POINTS - 1),
    yDomain: [0, 100],
    data: [],
    highlighted: null,
    focused: null,
  } as unknown as PlotContext<number>
}

describe('an end label moved off its line end is joined to it by a leader', () => {
  test('a cluster of lines ending near the baseline gets leaders, a line ending high none', () => {
    const lines = [
      Array.from({ length: POINTS }, (_, i) => 40 + i * 4),
      Array.from({ length: POINTS }, (_, i) => (i === POINTS - 1 ? 3 : 50)),
      Array.from({ length: POINTS }, (_, i) => (i === POINTS - 1 ? 2 : 40)),
      Array.from({ length: POINTS }, (_, i) => (i === POINTS - 1 ? 4 : 30)),
      Array.from({ length: POINTS }, (_, i) => (i === POINTS - 1 ? 1.5 : 20)),
    ]
    const ctx = plot(lines)
    const plan = endLabelPlan(ctx, ctx.visible as ChartSeries<number>[], 'endLabels', [])
    const byKey = new Map(plan.map((label) => [label.series.key, label]))

    expect(byKey.get('0')?.leader).toBeUndefined()
    const leaders = ['1', '2', '3', '4'].flatMap((key) => {
      const leader = byKey.get(key)?.leader
      return leader === undefined ? [] : [{ key, leader }]
    })
    expect(leaders.length).toBeGreaterThanOrEqual(2)
    for (const { key, leader } of leaders) {
      expect(leader.fraction).toBe(1)
      expect(leader.from).toBe(lines[Number(key)]?.at(-1) as number)
    }
  })
})

describe('a rule a pixel too close does not drop a label beside its anchor', () => {
  test('a label squeezed between the frame edge and a rule nudges up and keeps its anchor', () => {
    const size = 11
    const height = lineHeight(size)
    // The anchor sits near the frame's top edge; the rule's box starts a pixel inside the label's.
    const y = 12
    const rule = { left: 0, top: y + height / 2 - 0.6, width: 200, height: 4 }
    const { placed, dropped } = placeWith(
      estimateWidth,
      [{ key: 'vault', text: 'vault 94 %', x: 40, y }],
      { width: 200, height: 100 },
      { obstacles: [rule], size, gap: 7 },
    )
    expect(dropped).toEqual([])
    const [label] = placed
    expect(label?.spot).toBe('right')
    expect(label!.top + label!.height).toBeLessThanOrEqual(rule.top)
    expect(Math.abs(label!.top + label!.height / 2 - y)).toBeLessThanOrEqual(height / 2)
  })
})

describe('a label flipped for room it has asks again for the right of its end', () => {
  const W = 700
  const H = 300
  type Pt = { x: number; y: number }
  const line = (a: Pt, b: Pt): Pt[] =>
    Array.from({ length: 21 }, (_, i) => ({
      x: a.x + ((b.x - a.x) * i) / 20,
      y: a.y + ((b.y - a.y) * i) / 20,
    }))
  const lines = {
    proj: line({ x: 0.48, y: 58 }, { x: 0.757, y: 100 }),
    other: line({ x: 0.3, y: 27 }, { x: 1, y: 88 }),
  }
  const ctx = {
    rows: (key: string) =>
      (lines[key as keyof typeof lines] ?? []).map((p) => ({ x: p.x, y: p.y, datum: p })),
    visible: [
      { key: 'proj', label: 'Team pool, out 27 Nov', mark: 'line' },
      { key: 'other', label: 'Research pool, US$12 left at expiry', mark: 'line' },
    ],
    containerClass: 'wide',
    plotWidth: W,
    plotHeight: H,
    width: W + 50,
    height: H + 40,
    y2: undefined,
    xFraction: (x: number) => x,
    yDomain: [0, 104],
    data: [],
    highlighted: null,
    focused: null,
  } as unknown as PlotContext<Pt>

  test('the caption of a line ending high sits right of its end, not far below it', () => {
    const plan = endLabelPlan(ctx, ctx.visible as ChartSeries<Pt>[], 'endLabels', [100])
    const proj = plan.find((l) => l.series.key === 'proj')
    expect(proj?.anchor).toBe('start')
    expect(proj?.leader).toBeUndefined()
    expect(Math.abs(proj!.nudge)).toBeLessThan(lineHeight(11) * 2)
  })
})
