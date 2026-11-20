/**
 * Expression cycle 14 (`v3-expr-14-kit-fixes` 3b): a stack past the cap fills the cap in proportion, and
 * every segment keeps a visible height, so the upper segments of a clamped stack do not vanish.
 */
import { describe, expect, test } from 'bun:test'
import { clampStacks } from './parts/bars-marks'
import type { ChartX, PlotRow } from './types'

type Row = { x: number }

const PLOT_HEIGHT = 100
const DOMAIN: readonly [number, number] = [0, 50]
const ORDER = ['ok', 'retry', 'quota']

const seg = (series: string, y: number): PlotRow<Row, ChartX> =>
  ({ series, y, x: 0, datum: { x: 0 } }) as unknown as PlotRow<Row, ChartX>

const sum = (rows: readonly PlotRow<Row, ChartX>[]): number =>
  rows.reduce((acc, r) => acc + (r.y ?? 0), 0)

describe('a stack past the cap', () => {
  test('fills the cap and keeps every segment visible, not only the lowest', () => {
    const rows = [seg('ok', 40), seg('retry', 30), seg('quota', 20)]
    const out = clampStacks(rows, ORDER, DOMAIN, PLOT_HEIGHT)
    expect(sum(out)).toBeCloseTo(50, 6)
    for (const r of out) expect(r.y, r.series).toBeGreaterThanOrEqual(1)
  })

  test('keeps the proportion of its segments', () => {
    const rows = [seg('ok', 40), seg('retry', 30), seg('quota', 20)]
    const [ok, retry] = clampStacks(rows, ORDER, DOMAIN, PLOT_HEIGHT)
    expect((ok?.y ?? 0) / (retry?.y ?? 1)).toBeCloseTo(40 / 30, 6)
  })

  test('a tiny segment is raised to the minimum, the large one gives up the difference', () => {
    const rows = [seg('ok', 100), seg('retry', 1), seg('quota', 1)]
    const out = clampStacks(rows, ORDER, DOMAIN, PLOT_HEIGHT)
    expect(sum(out)).toBeCloseTo(50, 6)
    expect(out[1]?.y ?? 0).toBeGreaterThanOrEqual(1)
    expect(out[2]?.y ?? 0).toBeGreaterThanOrEqual(1)
  })
})

describe('a stack inside the cap', () => {
  test('is returned as it is, every row the same object', () => {
    const rows = [seg('ok', 15), seg('retry', 10), seg('quota', 5)]
    const out = clampStacks(rows, ORDER, DOMAIN, PLOT_HEIGHT)
    expect(out).toEqual(rows)
    for (const [i, r] of rows.entries()) expect(out[i]).toBe(r)
  })
})
