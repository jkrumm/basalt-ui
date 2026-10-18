/** Wave 38: the reading at its fill end, captions that drop before they wrap, one zone register. */
import { describe, expect, test } from 'bun:test'
import {
  modelBar,
  partColumns,
  placeCaptionRow,
  placeMarkCaptions,
  placeRowLabels,
} from './meter-model'

const fmt = (n: number) => String(n)

describe('the reading caption anchor (D38 a)', () => {
  test('a plain bar anchors at the end of its fill', () => {
    expect(modelBar({ reading: 25, min: 0, max: 100, format: fmt }).fillEndPct).toBe(25)
  })
  test('a committed/forecast bar anchors at the end of the committed part', () => {
    const segments = [
      { value: 40, label: 'Spent' },
      { value: 30, label: 'Planned', forecast: true },
    ]
    expect(modelBar({ reading: 70, min: 0, max: 100, format: fmt, segments }).fillEndPct).toBe(40)
  })
  test('a marked track has no fill end: its reading follows the marker', () => {
    const zones = [{ from: 0, to: 100, label: 'All' }]
    expect(
      modelBar({ reading: 50, min: 0, max: 100, format: fmt, zones }).fillEndPct,
    ).toBeUndefined()
  })
  test('an end-aligned caption ends at the mark and falls back to the start when the fill is short', () => {
    expect(placeMarkCaptions([{ width: 40, pct: 50, align: 'end' }], 200, 6)).toEqual([60])
    expect(placeMarkCaptions([{ width: 40, pct: 5, align: 'end' }], 200, 6)).toEqual([0])
    expect(placeMarkCaptions([{ width: 40, pct: 100, align: 'end' }], 200, 6)).toEqual([160])
  })
})

describe('captions drop before anything wraps (D38 c)', () => {
  const reading = { width: 60, pct: 20, align: 'end' as const }
  const target = { width: 100, pct: 100 }
  const pace = { width: 120, pct: 50, drop: 1 }
  const forecast = { width: 90, pct: 45, drop: 2 }

  test('everything that fits stays', () => {
    const out = placeCaptionRow([reading, pace, target], 600, 6)
    expect(out?.dropped).toEqual([false, false, false])
  })
  test('the tick caption goes first; the reading and the target stay', () => {
    const out = placeCaptionRow([reading, pace, target], 250, 6)
    expect(out?.dropped).toEqual([false, true, false])
    expect(out?.starts[1]).toBeUndefined()
    expect(out?.starts[0]).toBe(0)
    expect(out?.starts[2]).toBe(150)
  })
  test('the forecast caption goes after the tick captions', () => {
    const mid = placeCaptionRow([reading, forecast, pace, target], 330, 6)
    expect(mid?.dropped).toEqual([false, false, true, false])
    const narrow = placeCaptionRow([reading, forecast, pace, target], 170, 6)
    expect(narrow?.dropped).toEqual([false, true, true, false])
  })
  test('the reading stays at its fill end: a caption that would push it off yields', () => {
    const beside = { width: 120, pct: 50, drop: 1 }
    const out = placeCaptionRow(
      [{ width: 60, pct: 55, align: 'end' as const }, beside, target],
      400,
      6,
    )
    expect(out?.dropped).toEqual([false, true, false])
    expect(out?.starts[0]).toBe(160)
  })
  test('the reading and the target never drop: a row that cannot hold them flows', () => {
    expect(placeCaptionRow([reading, pace, target], 150, 6)).toBeNull()
  })
})

describe('one register for zone names (D38 d)', () => {
  const name = (
    left: number,
    right: number,
    spanLeft: number,
    spanRight: number,
    short?: [number, number],
  ) => ({
    box: { left, right },
    span: { left: spanLeft, right: spanRight },
    ...(short && { short: { left: short[0], right: short[1] } }),
  })
  test('a sibling that has a short follows the one that fell back', () => {
    const out = placeRowLabels(
      [
        name(0, 20, 0, 40, [5, 15]),
        name(40, 90, 40, 80, [50, 65]),
        name(120, 160, 100, 200, [130, 140]),
      ],
      200,
    )
    expect(out.shown).toEqual([true, true, true])
    expect(out.short).toEqual([true, true, true])
  })
  test('without a fallback every name keeps its full register', () => {
    const out = placeRowLabels(
      [name(0, 20, 0, 40, [5, 15]), name(120, 160, 100, 200, [130, 140])],
      200,
    )
    expect(out.short).toEqual([false, false])
  })
  test('the holding name and a sibling without a short keep their full names', () => {
    const holding = { ...name(0, 20, 0, 40, [5, 15]), holding: true }
    const out = placeRowLabels(
      [holding, name(40, 90, 40, 80, [50, 65]), name(120, 150, 100, 200)],
      200,
    )
    expect(out.short).toEqual([false, true, false])
  })
})

describe('part captions never leave one alone on a row (D38 e)', () => {
  test('one row when every entry fits', () => {
    expect(partColumns([40, 40, 40, 40], 200, 8)).toBe(4)
  })
  test('four entries that do not fit one row take two columns', () => {
    expect(partColumns([60, 60, 60, 60], 200, 8)).toBe(2)
  })
  test('five entries never end on a lone entry: 3 columns, not 4', () => {
    expect(partColumns([40, 40, 40, 40, 40], 150, 8)).toBe(3)
  })
  test('three entries that do not fit one row stack in one column, not 2 + 1', () => {
    expect(partColumns([80, 80, 80], 200, 8)).toBe(1)
  })
})
