/**
 * The v3 tooltip as data: four swatch shapes folded into the engine row, one short date form, the
 * delays and the pin rule. Placement inside the card is `core/portal.ts`'s (`tooltip-settle`,
 * rows 204, 207 and 217) and is held in real Chrome by `charts-card.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { TOOLTIP_DELAY, engineRows, shortDate, swatchBackground, tooltipBehaviour } from './tooltip'

const pair = { light: '#0b6bcb', dark: '#5aa9f0' }

describe('swatches', () => {
  test('solid is the plain colour, the other three are a background', () => {
    expect(swatchBackground('red')).toBe('red')
    expect(swatchBackground('red', 'solid')).toBe('red')
    expect(swatchBackground('red', 'dashed')).toContain('repeating-linear-gradient(90deg, red')
    expect(swatchBackground('red', 'line')).toContain('linear-gradient(red, red)')
    expect(swatchBackground('red', 'dot')).toContain('radial-gradient(circle closest-side, red')
  })

  test('the four shapes are four different swatches', () => {
    const shapes = (['solid', 'dashed', 'dot', 'line'] as const).map((s) =>
      swatchBackground('red', s),
    )
    expect(new Set(shapes).size).toBe(4)
  })

  test('rows are data: the colour pair becomes light-dark(), no colour keeps no swatch', () => {
    const [first, second] = engineRows([
      { label: 'Requests', value: '12', color: pair, swatch: 'line' },
      { label: 'Note', value: 'x' },
    ])
    expect(first?.color).toContain('light-dark(#0b6bcb, #5aa9f0)')
    expect(first?.color).toContain('linear-gradient')
    expect(second).toEqual({ label: 'Note', value: 'x' })
  })
})

describe('date', () => {
  test('one short form, in UTC', () => {
    expect(shortDate(new Date(Date.UTC(2026, 8, 14, 23, 30)))).toBe('Sep 14, 2026')
    expect(shortDate(new Date(Date.UTC(2026, 0, 1)))).toBe('Jan 1, 2026')
  })
  test('an invalid date is a dash, never "Invalid Date"', () => {
    expect(shortDate(new Date(Number.NaN))).toBe('–')
  })
})

describe('behaviour', () => {
  test('show 150, hide 100', () => {
    expect(TOOLTIP_DELAY).toEqual({ show: 150, hide: 100 })
    const b = tooltipBehaviour()
    expect([b.showDelay, b.hideDelay]).toEqual([150, 100])
  })
  test('a click pins unless the chart has a selection', () => {
    expect(tooltipBehaviour().pinOnClick).toBe(true)
    expect(tooltipBehaviour({ selection: { selected: null, onSelect: () => {} } }).pinOnClick).toBe(
      false,
    )
  })
})
