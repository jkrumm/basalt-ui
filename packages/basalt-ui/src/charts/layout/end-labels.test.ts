import { describe, expect, test } from 'bun:test'
import { endLabelGutter, nudgeLabels, planEndLabels } from './end-labels'
import type { ChartSeries } from '../series'

describe('nudgeLabels', () => {
  const base = { minGap: 12, min: 6, max: 200 }

  test('well-separated labels stay where they are, in input order', () => {
    expect(nudgeLabels({ ...base, ys: [100, 20, 60] })).toEqual([100, 20, 60])
  })

  test('colliding labels are pushed apart by the min gap', () => {
    const out = nudgeLabels({ ...base, ys: [50, 52, 51] })!
    const sorted = out.toSorted((a, b) => a - b)
    expect(sorted[1]! - sorted[0]!).toBeGreaterThanOrEqual(12)
    expect(sorted[2]! - sorted[1]!).toBeGreaterThanOrEqual(12)
  })

  test('the lower label of a colliding pair keeps its order', () => {
    const [a, b] = nudgeLabels({ ...base, ys: [50, 52] })!
    expect(a!).toBeLessThan(b!)
  })

  test('a stack at the bottom edge is pulled back inside the plot', () => {
    const out = nudgeLabels({ ...base, ys: [198, 199, 200] })!
    expect(Math.max(...out)).toBeLessThanOrEqual(200)
    expect(Math.min(...out)).toBeGreaterThanOrEqual(6)
  })

  test('a label above the top edge is clamped to it', () => {
    expect(nudgeLabels({ ...base, ys: [-30] })).toEqual([6])
  })

  test('returns null when the labels cannot all fit', () => {
    expect(nudgeLabels({ minGap: 12, min: 0, max: 20, ys: [5, 6, 7] })).toBeNull()
  })

  test('returns null on a non-finite position', () => {
    expect(nudgeLabels({ ...base, ys: [10, Number.NaN] })).toBeNull()
  })

  test('no labels is an empty plan', () => {
    expect(nudgeLabels({ ...base, ys: [] })).toEqual([])
  })

  test('a single label keeps its position', () => {
    expect(nudgeLabels({ ...base, ys: [80] })).toEqual([80])
  })

  test('unsorted input comes back in input order, gaps held', () => {
    const out = nudgeLabels({ ...base, ys: [60, 50, 55] })!
    expect(out[1]!).toBeLessThan(out[2]!)
    expect(out[2]!).toBeLessThan(out[0]!)
    expect(out[2]! - out[1]!).toBeGreaterThanOrEqual(12)
    expect(out[0]! - out[2]!).toBeGreaterThanOrEqual(12)
  })

  test('labels that exactly fill the range fit, one pixel short does not', () => {
    expect(nudgeLabels({ minGap: 10, min: 0, max: 20, ys: [3, 3, 3] })).toEqual([0, 10, 20])
    expect(nudgeLabels({ minGap: 10, min: 0, max: 19, ys: [3, 3, 3] })).toBeNull()
  })
})

describe('endLabelGutter', () => {
  test('is the widest label plus the gap', () => {
    const narrow = endLabelGutter({ labels: ['A'], fontPx: 10, plotWidth: 900 })!
    const wide = endLabelGutter({
      labels: ['A', 'A much longer label'],
      fontPx: 10,
      plotWidth: 900,
    })!
    expect(wide).toBeGreaterThan(narrow)
  })

  test('is null when the gutter would take over a quarter of the plot', () => {
    expect(
      endLabelGutter({ labels: ['A much longer label'], fontPx: 10, plotWidth: 100 }),
    ).toBeNull()
  })
})

describe('planEndLabels', () => {
  type Row = { a: number | null; b: number | null }
  const line = (key: 'a' | 'b', label = key.toUpperCase()): ChartSeries<Row> => ({
    key,
    label,
    color: '#111',
    mark: 'line',
    getValue: (d) => d[key],
  })
  const base = {
    containerClass: 'wide' as const,
    hasY2: false,
    hasMarginRight: false,
    hasHeaderLegend: false,
    data: [{ a: 1, b: 5 }] as Row[],
    yScale: (v: number) => 100 - v * 10,
    yMax: 100,
    fontPx: 10,
    plotWidth: 800,
  }

  test('plans a gutter and a label per visible line', () => {
    const plan = planEndLabels({ ...base, visible: [line('a'), line('b')] })!
    expect(plan.gutter).toBeGreaterThan(0)
    expect(plan.labels.map((l) => l.series.key)).toEqual(['a', 'b'])
  })

  test('reserves no gutter when the labels cannot be placed', () => {
    const plan = planEndLabels({
      ...base,
      yMax: 5,
      visible: [line('a'), line('b')],
    })
    expect(plan).toBeNull()
  })

  test('reserves no gutter when a series has no value at all', () => {
    const plan = planEndLabels({
      ...base,
      data: [{ a: null, b: 5 }],
      visible: [line('a'), line('b')],
    })
    expect(plan).toBeNull()
  })

  test('a trailing null falls back to the last non-null value', () => {
    const plan = planEndLabels({
      ...base,
      data: [
        { a: 1, b: 5 },
        { a: null, b: null },
      ],
      visible: [line('a'), line('b')],
    })!
    expect(plan.labels[0]!.y).toBe(90)
  })

  test('a single visible series is legend-suppressed, not end-labelled (R2C-10)', () => {
    // Shrinking from 2 visible to 1 (a hidden series) used to still draw one end label — the same
    // "single series is its own legend" law that already suppresses a single-entry legend.
    expect(planEndLabels({ ...base, visible: [line('a')] })).toBeNull()
    expect(planEndLabels({ ...base, visible: [line('b')] })).toBeNull()
  })

  test('a header legend already names every series, so end labels would only repeat it (R2C-10)', () => {
    expect(
      planEndLabels({ ...base, visible: [line('a'), line('b')], hasHeaderLegend: true }),
    ).toBeNull()
  })

  test('is off outside the eligibility rules', () => {
    const visible = [line('a'), line('b')]
    expect(planEndLabels({ ...base, visible, containerClass: 'regular' })).toBeNull()
    expect(planEndLabels({ ...base, visible, hasY2: true })).toBeNull()
    expect(planEndLabels({ ...base, visible, hasMarginRight: true })).toBeNull()
    expect(planEndLabels({ ...base, visible: [] })).toBeNull()
    expect(
      planEndLabels({ ...base, visible: [line('a'), { ...line('b'), mark: 'bar' }] }),
    ).toBeNull()
    expect(
      planEndLabels({ ...base, visible: [line('a'), line('b'), line('a'), line('b')] }),
    ).toBeNull()
  })
})
