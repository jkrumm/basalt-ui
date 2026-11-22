/**
 * Issue 2911 (a): a line chart that names its lines at their ends keeps a gutter right of the last points
 * when the labels would otherwise sit in the plot, over the lines. The gutter is the widest label the
 * face draws, and a point scale keeps exactly that room (steps = px over the step the plot ends up with).
 */
import { describe, expect, test } from 'bun:test'
import { endLabelGutter } from './labels'
import { xScaleFor } from './core/scales'

const NAMES = ['Lint', 'Type errors', 'Flaky tests', 'Build config', 'Dependency bumps']
const lines = (fraction: number) => NAMES.map((label) => ({ label, fraction }))

describe('endLabelGutter', () => {
  test('is the widest label when the labels do not fit beside the last points', () => {
    const gutter = endLabelGutter({
      naming: 'endLabels',
      containerClass: 'narrow',
      plotWidth: 280,
      labels: lines(0.875),
    })
    expect(gutter).toBeGreaterThan(90)
    expect(gutter).toBeLessThan(140)
  })

  test('is 0 where every label already fits beside its line end', () => {
    const wide = { naming: 'endLabels', containerClass: 'wide', plotWidth: 980 } as const
    expect(endLabelGutter({ ...wide, labels: lines(0.875) })).toBe(0)
  })

  test('is 0 for a legend, for auto below the wide class and for more than three auto lines', () => {
    const narrow = { containerClass: 'narrow', plotWidth: 280, labels: lines(0.875) } as const
    expect(endLabelGutter({ ...narrow, naming: 'legend' })).toBe(0)
    expect(endLabelGutter({ ...narrow, naming: 'auto' })).toBe(0)
    expect(
      endLabelGutter({
        naming: 'auto',
        containerClass: 'wide',
        plotWidth: 300,
        labels: lines(0.9),
      }),
    ).toBe(0)
  })

  test('is 0 when it would take more than 45 % of the plot', () => {
    expect(
      endLabelGutter({
        naming: 'endLabels',
        containerClass: 'narrow',
        plotWidth: 200,
        labels: lines(0.9),
      }),
    ).toBe(0)
  })
})

describe('xScaleFor with room', () => {
  const keys = ['a', 'b', 'c', 'd']

  test('a point scale keeps the gutter right of the last point and half a step left of the first', () => {
    const model = xScaleFor(keys, false, undefined, false, { px: 110, plotWidth: 280 })
    const [first, last] = [model.fraction('a') as number, model.fraction('d') as number]
    expect((1 - last) * 280).toBeCloseTo(110, 5)
    expect(first * 280).toBeCloseTo(((last - first) / 3 / 2) * 280, 5)
    // The scale the engine draws on lays the points out where `fraction` says.
    const scale = model.scale as unknown as ((k: string) => number) & {
      range: (r: number[]) => unknown
    }
    scale.range([0, 280])
    expect(scale('d') / 280).toBeCloseTo(last, 5)
    expect(scale('a') / 280).toBeCloseTo(first, 5)
  })

  test('without room the points sit as they did: half a step at each edge', () => {
    const model = xScaleFor(keys, false)
    expect(model.fraction('a')).toBeCloseTo(0.125, 8)
    expect(model.fraction('d')).toBeCloseTo(0.875, 8)
  })

  test('a continuous axis grows its end by the gutter, a page-set domain keeps its own', () => {
    const grown = xScaleFor([0, 10], false, undefined, false, { px: 100, plotWidth: 400 })
    expect(grown.extent).toEqual([0, 10 + (10 * 100) / 300])
    const pinned = xScaleFor([0, 10], false, [0, 10], false, { px: 100, plotWidth: 400 })
    expect(pinned.extent).toEqual([0, 10])
  })
})
