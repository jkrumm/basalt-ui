/**
 * Expression cycle 10 (`v3-expr-10-kit-fixes` 1 and 2): a label that names the answer is kept, never
 * dropped for what the host drew (a bar's value label, a rule caption), and `Lines` end labels sit
 * clear of every line.
 */
import { describe, expect, test } from 'bun:test'
import { xRefLabelSpots } from './axis-gaps'
import { barValueLabels } from './core/bar-values'
import { endLabelPlan } from './labels'
import type { ChartSeries, PlotContext } from './types'

const seeded = (seed: number): (() => number) => {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296
}

describe('Lines end labels sit clear of every line', () => {
  const W = 300
  const H = 160
  const POINTS = 50
  const NAMES = ['CPU', 'Memory', 'Disk']

  /** A plot of lines on a 0 to 100 domain, as much of a `PlotContext` as the plan reads. */
  function plot(lines: number[][]): PlotContext<number> {
    const series = lines.map((_, i) => ({ key: String(i), label: NAMES[i], mark: 'line' }))
    return {
      rows: (key: string) => (lines[Number(key)] ?? []).map((y, i) => ({ x: i, y, datum: i })),
      visible: series,
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

  /** The lines of one seed: some jagged, some pegged at the plot's top edge for the last stretch. */
  function linesOf(seed: number): number[][] {
    const next = seeded(seed)
    return NAMES.map(() => {
      const base = next() * 100
      const amp = next() * 30
      const phase = next() * 6
      const pegged = next() < 0.3
      return Array.from({ length: POINTS }, (_, i) =>
        pegged && i > POINTS / 2
          ? 100
          : Math.max(0, Math.min(100, base + amp * Math.sin(i / 4 + phase) + (next() - 0.5) * 8)),
      )
    })
  }

  /** Whether any line runs through the label's drawn box (its two pixels of margin left out). */
  function struck(lines: number[][], box: { fx0: number; fx1: number; y0: number; y1: number }) {
    const top = H - (box.y1 / 100) * H + 2
    const bottom = H - (box.y0 / 100) * H - 2
    for (const line of lines) {
      for (let i = 1; i < POINTS; i++) {
        for (let t = 0; t <= 1; t += 0.1) {
          const x = ((i - 1 + t) / (POINTS - 1)) * W
          const y = H - (((line[i - 1] ?? 0) * (1 - t) + (line[i] ?? 0) * t) / 100) * H
          if (x > box.fx0 * W + 2 && x < box.fx1 * W - 2 && y > top && y < bottom) return true
        }
      }
    }
    return false
  }

  test('no label meets a line across four hundred jagged and pegged plots', () => {
    const hits: string[] = []
    for (let seed = 1; seed <= 400; seed++) {
      const lines = linesOf(seed)
      const ctx = plot(lines)
      const labels = endLabelPlan(ctx, ctx.visible as ChartSeries<number>[], 'endLabels', [])
      for (const label of labels)
        if (struck(lines, label.box)) hits.push(`${seed}:${label.series.label}`)
    }
    expect(hits).toEqual([])
  })

  test('labels that start level keep a label height between them', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const ctx = plot(linesOf(seed))
      const boxes = endLabelPlan(ctx, ctx.visible as ChartSeries<number>[], 'endLabels', []).map(
        (l) => l.box,
      )
      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) {
          const apart = a.fx1 < b.fx0 || b.fx1 < a.fx0 || a.y0 >= b.y1 || b.y0 >= a.y1
          expect(apart, `seed ${seed}`).toBe(true)
        }
    }
  })
})

describe('a rule caption keeps a spot when every spot beside it meets a mark', () => {
  const lines = [{ x: 15, color: 'var(--basalt-line)', label: 'Today' }]
  const base = { lines, fraction: () => 0.5, plotWidth: 300, fontSize: 11 }

  test('with no spot clear of the marks it takes the first spot inside the plot', () => {
    const spots = xRefLabelSpots({ ...base, blocked: () => true, plotHeight: 150 })
    expect(spots).toHaveLength(1)
    expect(spots[0]?.row).toBe(0)
    expect(spots[0]?.x0).toBeGreaterThanOrEqual(0)
    expect(spots[0]?.x1).toBeLessThanOrEqual(300)
  })

  test('a lower row clear of the marks beats a spot over them', () => {
    // Marks fill the top two rows; the third is clear.
    const spots = xRefLabelSpots({
      ...base,
      blocked: (box) => box.top < 40,
      plotHeight: 150,
    })
    expect(spots[0]?.row).toBeGreaterThanOrEqual(2)
  })

  test('a row never hangs below the plot', () => {
    const spots = xRefLabelSpots({ ...base, blocked: () => true, plotHeight: 40 })
    expect(spots[0]?.row).toBeLessThan(2)
  })

  test('a caption wider than the plot still drops', () => {
    const wide = [
      {
        x: 15,
        color: 'var(--basalt-line)',
        label: 'A caption far wider than the plot it hangs in',
      },
    ]
    expect(xRefLabelSpots({ ...base, lines: wide, plotWidth: 60, blocked: () => true })).toEqual([])
  })
})

describe("the extreme bar's value label is never dropped for what the host drew", () => {
  type Bar = { x: number; v: number }
  const data: Bar[] = [
    { x: 0, v: 20 },
    { x: 1, v: 51 },
    { x: 2, v: 30 },
  ]
  const series = [
    {
      key: 'v',
      label: 'V',
      mark: 'bar',
      getValue: (d: Bar) => d.v,
      values: (v: number) => `${v}%`,
    },
  ] as unknown as ChartSeries<Bar>[]
  const frame = { width: 270, height: 150 }
  const input = (obstacles: { left: number; top: number; width: number; height: number }[]) =>
    barValueLabels<Bar, number>({
      series,
      data,
      x: (d) => d.x,
      fraction: (x) => (x + 0.5) / 3,
      barHalf: 0.1,
      stack: undefined,
      sideOf: () => 'left',
      domainOf: () => [0, 70],
      scaleOf: () => 'y',
      formatOf: () => (v) => String(v),
      frame,
      focused: null,
      obstacles,
      clear: obstacles,
    })
  /** The bar's end: the middle bar, 51 of 70. */
  const end = { x: (1.5 / 3) * frame.width, y: (1 - 51 / 70) * frame.height }

  test('a vertical rule through the bar moves the label beside it', () => {
    const rule = { left: end.x - 2, top: 0, width: 4, height: frame.height }
    const { boxes } = input([rule])
    const peak = boxes.find((b) => b.top < end.y)
    expect(peak).toBeDefined()
    const clear = peak!.left >= rule.left + rule.width || peak!.left + peak!.width <= rule.left
    expect(clear).toBe(true)
  })

  test('with the whole plot taken the largest label is still drawn, over it', () => {
    const { boxes } = input([{ left: 0, top: 0, width: frame.width, height: frame.height }])
    expect(boxes).toHaveLength(1)
    const box = boxes[0]!
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.left + box.width).toBeLessThanOrEqual(frame.width)
    expect(box.top).toBeGreaterThanOrEqual(0)
  })
})
