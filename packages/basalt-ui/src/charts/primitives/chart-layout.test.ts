/**
 * The decision table of `resolveChartLayout` (`docs/waves/RESPONSIVE-SPEC.md` §1, §4): container
 * class boundaries, the unmeasured default, the legend fit and its 2-entry rule, the height law.
 */
import { describe, expect, test } from 'bun:test'
import { CONTAINER_CLASSES } from '../../tokens/size-classes'
import type { ContainerClass } from '../../tokens/size-classes'
import { resolveChartLayout } from './chart-layout'
import type { ChartLayoutInput } from './chart-layout'
import type { LegendEntry } from './ChartLegend'

const entry = (key: string, label = key): LegendEntry => ({ key, label, color: '#000' })
const entries = (n: number, label = 'Series'): LegendEntry[] =>
  Array.from({ length: n }, (_, i) => entry(`k${i}`, `${label} ${i}`))

const base: ChartLayoutInput = {
  frameW: 600,
  slotW: 0,
  viewportH: 800,
  legendItems: [],
  yLabels: [],
  xLabels: [],
  categorical: false,
  sizeClass: 'expanded',
  coarse: false,
}
const layout = (over: Partial<ChartLayoutInput>) => resolveChartLayout({ ...base, ...over })

describe('container class boundaries (the measured frame width)', () => {
  const cases: [number, ContainerClass][] = [
    [1, 'micro'],
    [CONTAINER_CLASSES.compact - 1, 'micro'],
    [CONTAINER_CLASSES.compact, 'compact'],
    [CONTAINER_CLASSES.regular - 1, 'compact'],
    [CONTAINER_CLASSES.regular, 'regular'],
    [CONTAINER_CLASSES.wide - 1, 'regular'],
    [CONTAINER_CLASSES.wide, 'wide'],
  ]
  for (const [frameW, expected] of cases) {
    test(`${frameW}px → ${expected}`, () => {
      expect(layout({ frameW }).containerClass).toBe(expected)
    })
  }

  test('a measured width ignores the viewport class', () => {
    expect(layout({ frameW: 300, sizeClass: 'expanded' }).containerClass).toBe('compact')
  })
})

describe('unmeasured (frameW <= 0) follows the viewport size class', () => {
  test('compact viewport → compact container', () => {
    expect(layout({ frameW: 0, sizeClass: 'compact' }).containerClass).toBe('compact')
  })
  test('medium → regular, expanded → wide', () => {
    expect(layout({ frameW: 0, sizeClass: 'medium' }).containerClass).toBe('regular')
    expect(layout({ frameW: -1, sizeClass: 'expanded' }).containerClass).toBe('wide')
  })
})

describe('height', () => {
  test('width × class ratio, clamped to [160, 420]', () => {
    expect(layout({ frameW: 400 }).height).toBe(Math.round(400 * 0.62))
    expect(layout({ frameW: 600 }).height).toBe(300)
    expect(layout({ frameW: 900 }).height).toBe(360)
    expect(layout({ frameW: 1600 }).height).toBe(420)
    expect(layout({ frameW: 100 }).height).toBe(160)
  })

  test('unmeasured derives from a representative width of the viewport-implied class', () => {
    expect(layout({ frameW: 0, sizeClass: 'compact' }).height).toBe(223)
  })

  test('a coarse pointer is clamped to 0.45 of the viewport height', () => {
    expect(layout({ frameW: 900, coarse: true, viewportH: 600 }).height).toBe(270)
  })

  test('a fine pointer ignores the viewport height', () => {
    expect(layout({ frameW: 900, coarse: false, viewportH: 600 }).height).toBe(360)
  })

  test('an unknown viewport height is not a clamp', () => {
    expect(layout({ frameW: 900, coarse: true, viewportH: 0 }).height).toBe(360)
  })

  test('the consumer override wins over everything', () => {
    expect(
      layout({ frameW: 900, coarse: true, viewportH: 600, override: { height: 500 } }).height,
    ).toBe(500)
  })
})

describe('legend', () => {
  test('micro renders none; so does an empty item list', () => {
    expect(layout({ frameW: 200, legendItems: entries(3) }).legend).toEqual({ mode: 'none' })
    expect(layout({ legendItems: [] }).legend).toEqual({ mode: 'none' })
  })

  test('compact → dots, regular/wide → chips; a band without a header slot', () => {
    expect(layout({ frameW: 360, legendItems: entries(2) }).legend).toMatchObject({
      mode: 'dots',
      where: 'band',
    })
    expect(layout({ frameW: 600, legendItems: entries(2) }).legend).toMatchObject({ mode: 'chips' })
    expect(layout({ frameW: 900, legendItems: entries(2) }).legend).toMatchObject({ mode: 'chips' })
  })

  test('a header slot moves the legend there and measures the slot, not the frame', () => {
    const l = layout({ frameW: 900, slotW: 120, legendItems: entries(6) })
    expect(l.legend).toMatchObject({ where: 'header' })
    expect(l.legend.mode === 'chips' && l.legend.overflow).toBeGreaterThan(0)
  })

  test('everything that fits is visible with no overflow', () => {
    expect(layout({ frameW: 900, legendItems: entries(3) }).legend).toEqual({
      mode: 'chips',
      where: 'band',
      visible: 3,
      overflow: 0,
    })
  })

  test('visible + overflow always equals the entry count', () => {
    const l = layout({ frameW: 260, legendItems: entries(9, 'A longer label') }).legend
    if (l.mode === 'none' || l.mode === 'side') throw new Error('expected a rolled legend')
    expect(l.visible + l.overflow).toBe(9)
    expect(l.overflow).toBeGreaterThanOrEqual(2)
  })

  test('a legend never rolls up fewer than 2 entries', () => {
    // Find a width where exactly one entry would overflow, then assert it is not rolled up.
    for (let w = 240; w < 800; w += 4) {
      const l = layout({ frameW: w, legendItems: entries(5, 'Label') }).legend
      if (l.mode === 'none' || l.mode === 'side') continue
      expect(l.overflow).not.toBe(1)
    }
  })
})

describe('axes stay populated for the next step', () => {
  test('y mode follows the class; ticks scale with height within [2, 6]', () => {
    expect(layout({ frameW: 200 }).yAxis.mode).toBe('none')
    expect(layout({ frameW: 360 }).yAxis.mode).toBe('inside')
    expect(layout({ frameW: 600 }).yAxis.mode).toBe('outside')
    const ticks = layout({ frameW: 900 }).yAxis.ticks
    expect(ticks).toBeGreaterThanOrEqual(2)
    expect(ticks).toBeLessThanOrEqual(6)
  })

  test('long y labels ask for the compact number format', () => {
    expect(layout({ frameW: 900, yLabels: ['1,000,000'] }).yAxis.compact).toBe(true)
    expect(layout({ frameW: 900, yLabels: ['10'] }).yAxis.compact).toBe(false)
  })

  test('categorical x labels wrap before they rotate; micro keeps 2 terminals', () => {
    const many = Array.from({ length: 40 }, (_, i) => `Category ${i}`)
    expect(
      layout({ frameW: 900, categorical: true, xLabels: many.slice(0, 3) }).xAxis,
    ).toMatchObject({ wrap: true, rotate: 0 })
    expect(layout({ frameW: 400, categorical: true, xLabels: many }).xAxis.rotate).toBe(45)
    expect(layout({ frameW: 200, xLabels: many }).xAxis.thinTo).toBe(2)
  })
})
