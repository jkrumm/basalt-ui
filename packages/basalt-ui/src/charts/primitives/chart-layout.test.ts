/**
 * The decision table of `resolveChartLayout` (`docs/waves/RESPONSIVE-SPEC.md` §1, §4): container
 * class boundaries, the unmeasured default, the legend fit and its 2-entry rule, the height law.
 */
import { describe, expect, test } from 'bun:test'
import { CONTAINER_CLASSES } from '../../tokens/size-classes'
import type { ContainerClass } from '../../tokens/size-classes'
import {
  compactNumber,
  isTightClass,
  planXLabels,
  resolveChartLayout,
  resolveYPlacement,
  shouldCompactYLabels,
  wrapLabel,
  yTickCount,
} from './chart-layout'
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

  test('dots is header-only — a band legend (no header slot) always stays chips, any container class', () => {
    expect(layout({ frameW: 360, legendItems: entries(2) }).legend).toMatchObject({
      mode: 'chips',
      where: 'band',
    })
    expect(layout({ frameW: 600, legendItems: entries(2) }).legend).toMatchObject({ mode: 'chips' })
    expect(layout({ frameW: 900, legendItems: entries(2) }).legend).toMatchObject({ mode: 'chips' })
  })

  test('a compact container DOES fold to dots once it has a header slot', () => {
    expect(layout({ frameW: 360, slotW: 100, legendItems: entries(2) }).legend).toMatchObject({
      mode: 'dots',
      where: 'header',
    })
  })

  test('a header slot moves the legend there and measures the slot, not the frame', () => {
    const l = layout({ frameW: 900, slotW: 120, legendItems: entries(6) })
    expect(l.legend).toMatchObject({ where: 'header' })
    expect(l.legend.mode === 'chips' && l.legend.overflow).toBeGreaterThan(0)
  })

  test('a short card forces the header legend to dots regardless of container class (wave 11)', () => {
    const regular = layout({
      frameW: 600,
      slotW: 120,
      legendItems: entries(2),
      cardShort: true,
    }).legend
    expect(regular).toMatchObject({ mode: 'dots', where: 'header' })

    const wide = layout({
      frameW: 900,
      slotW: 120,
      legendItems: entries(2),
      cardShort: true,
    }).legend
    expect(wide).toMatchObject({ mode: 'dots', where: 'header' })
  })

  test('a non-short card of the same container class is unchanged (still chips)', () => {
    expect(
      layout({ frameW: 600, slotW: 120, legendItems: entries(2), cardShort: false }).legend,
    ).toMatchObject({ mode: 'chips', where: 'header' })
    expect(layout({ frameW: 900, slotW: 120, legendItems: entries(2) }).legend).toMatchObject({
      mode: 'chips',
      where: 'header',
    })
  })

  test('cardShort does not affect a band legend (no header slot)', () => {
    expect(layout({ frameW: 600, legendItems: entries(2), cardShort: true }).legend).toMatchObject({
      mode: 'chips',
      where: 'band',
    })
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
    if (l.mode === 'none') throw new Error('expected a rolled legend')
    expect(l.visible + l.overflow).toBe(9)
    expect(l.overflow).toBeGreaterThanOrEqual(2)
  })

  test('a header row holds one line, a band two — the same legend overflows more in the header', () => {
    const items = entries(6, 'Series label')
    const band = layout({ frameW: 500, legendItems: items }).legend
    const header = layout({ frameW: 500, slotW: 500, legendItems: items }).legend
    if (band.mode === 'none') throw new Error('expected a legend')
    if (header.mode === 'none') throw new Error('expected a legend')
    expect(header.where).toBe('header')
    expect(header.visible).toBeLessThan(band.visible)
  })

  test('a legend never rolls up fewer than 2 entries', () => {
    // Find a width where exactly one entry would overflow, then assert it is not rolled up.
    for (let w = 240; w < 800; w += 4) {
      const l = layout({ frameW: w, legendItems: entries(5, 'Label') }).legend
      if (l.mode === 'none') continue
      expect(l.overflow).not.toBe(1)
    }
  })
})

describe('ladder step 1: compact y number format', () => {
  const table: [number, string | null][] = [
    [999, null],
    [1000, '1k'],
    [12500, '12.5k'],
    [-12500, '-12.5k'],
    [1_200_000, '1.2M'],
    [3_000_000_000, '3B'],
    [2_500_000_000_000, '2.5T'],
    [0.5, null],
    [999_949, '999.9k'],
    [999_950, '1M'],
    [999_999, '1M'],
    [1_000_000, '1M'],
    [-999_999, '-1M'],
    [999_950_000, '1B'],
    [999_950_000_000_000, '1000T'],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
  ]
  test.each(table)('compactNumber(%p) = %p', (value, expected) => {
    expect(compactNumber(value)).toBe(expected)
  })

  test('only labels longer than 4 chars ask for it', () => {
    expect(shouldCompactYLabels(['0', '5,000'])).toBe(true)
    expect(shouldCompactYLabels(['0', '500', '1000'])).toBe(false)
  })
})

describe('ladder step 2: y tick count', () => {
  const table: [number, number][] = [
    [90, 2], // under VX.minPlotHeight: thin to 2
    [119, 2],
    [120, 3],
    [176, 4],
    [220, 5],
    [1000, 6],
  ]
  test.each(table)('plot height %p -> %p ticks', (height, ticks) => {
    expect(yTickCount(height)).toBe(ticks)
  })
})

describe('ladder step 3-4: wrap, rotate and terminals', () => {
  test('wrapLabel breaks on words by measured width and keeps an over-wide word whole', () => {
    expect(wrapLabel('Mar 08 14:00', 1000, 10)).toEqual(['Mar 08 14:00'])
    const parts = wrapLabel('Mar 08 14:00', 30, 10)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.join(' ')).toBe('Mar 08 14:00')
    expect(wrapLabel('Supercalifragilistic', 5, 10)).toEqual(['Supercalifragilistic'])
  })

  const labels = Array.from({ length: 6 }, (_, i) => `Category ${i}`)
  test('labels that fit flat neither wrap nor rotate', () => {
    expect(planXLabels({ labels, plotWidth: 2000, fontPx: 10, categorical: true })).toMatchObject({
      wrap: false,
      rotate: 0,
      lines: 1,
    })
  })

  test('multi-word labels that do not fit wrap before they rotate', () => {
    const plan = planXLabels({ labels, plotWidth: 300, fontPx: 10, categorical: true })
    expect(plan).toMatchObject({ wrap: true, rotate: 0 })
    expect(plan.lines).toBeGreaterThan(1)
    expect(plan.wrapPx).toBeGreaterThan(0)
  })

  test('rotate only when keys exceed twice what fits, even wrapped', () => {
    const many = Array.from({ length: 60 }, (_, i) => `Category ${i}`)
    expect(
      planXLabels({ labels: many, plotWidth: 300, fontPx: 10, categorical: true }).rotate,
    ).toBe(45)
  })

  test('a non-categorical axis never wraps', () => {
    expect(planXLabels({ labels, plotWidth: 300, fontPx: 10, categorical: false }).wrap).toBe(false)
  })

  test('isTightClass and the y placement it drives: micro drops the axis, compact moves it inside', () => {
    expect(isTightClass('micro')).toBe(true)
    expect(isTightClass('compact')).toBe(true)
    expect(isTightClass('regular')).toBe(false)
    expect(isTightClass('wide')).toBe(false)

    expect(resolveYPlacement('micro')).toBe('none')
    expect(resolveYPlacement('compact')).toBe('inside')
    expect(resolveYPlacement('regular')).toBe('outside')
    expect(resolveYPlacement('wide')).toBe('outside')
  })
})
