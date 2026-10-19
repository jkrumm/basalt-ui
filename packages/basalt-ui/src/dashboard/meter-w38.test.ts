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
  test('the forecast caption anchors at the end of the forecast part, clamped to the track', () => {
    const segments = [
      { value: 40, label: 'Spent' },
      { value: 30, label: 'Forecast', forecast: true },
    ]
    expect(modelBar({ reading: 70, min: 0, max: 100, format: fmt, segments }).forecastEndPct).toBe(
      70,
    )
    const over = [
      { value: 40, label: 'Spent' },
      { value: 90, label: 'Forecast', forecast: true },
    ]
    expect(
      modelBar({ reading: 130, min: 0, max: 100, format: fmt, segments: over }).forecastEndPct,
    ).toBe(100)
    expect(modelBar({ reading: 25, min: 0, max: 100, format: fmt }).forecastEndPct).toBeUndefined()
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
  test('two undroppables that collide on their own do not cascade the drops', () => {
    const out = placeCaptionRow(
      [
        { width: 60, pct: 96, align: 'end' as const },
        { width: 130, pct: 20, drop: 1 },
        { width: 100, pct: 100 },
      ],
      560,
      6,
    )
    expect(out?.dropped).toEqual([false, false, false])
    const [reading, tick, target] = out?.starts ?? []
    expect((reading ?? 0) + 60).toBeLessThanOrEqual((target ?? 0) - 6 + 0.5)
    expect((tick ?? 0) + 130).toBeLessThanOrEqual((reading ?? 0) - 6 + 0.5)
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
    // Full names this wide hold neither row (Wave 39 tries them first): one falls back, the others follow.
    const out = placeRowLabels(
      [
        name(-10, 50, 0, 40, [5, 15]),
        name(25, 105, 40, 80, [50, 65]),
        name(70, 150, 80, 125, [100, 110]),
      ],
      125,
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
    const holding = { ...name(-10, 50, 0, 40, [5, 15]), holding: true }
    const out = placeRowLabels(
      [holding, name(25, 105, 40, 80, [50, 65]), name(70, 150, 80, 125)],
      125,
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

describe('a zone name borrows room past its span: the neighbours slide, each centre staying inside its own span (Wave 38, 39)', () => {
  // Row 203: Low 30-51, Optimal (holding) 87-127, Caution 123-161 (span 132-152), Danger 160-196.
  const row = (box: [number, number], span: [number, number], extra = {}) => ({
    box: { left: box[0], right: box[1] },
    span: { left: span[0], right: span[1] },
    ...extra,
  })
  const labels = [
    row([30, 51], [0, 81]),
    row([87, 127], [81, 132], { holding: true }),
    row([123, 161], [132, 152], { short: { left: 133, right: 159 } }),
    row([160, 196], [152, 203]),
  ]
  test('the full name wins by sliding the name beside it inside its own span', () => {
    const placed = placeRowLabels(labels, 203)
    expect(placed.shown).toEqual([true, true, true, true])
    expect(placed.short).toEqual([false, false, false, false])
    expect(placed.shift[3]).toBeGreaterThan(0)
    expect(placed.shift[0]).toBe(0)
  })
  test('a gap too small for the short name: the borrow reaches all three on one row (Wave 39)', () => {
    const tight = [
      row([66, 106], [66, 107], { holding: true }),
      row([95, 133], [107, 123], { short: { left: 102, right: 127 } }),
      row([125, 161], [123, 164]),
    ]
    const out = placeRowLabels(tight, 164)
    expect([out.shown, out.row]).toEqual([
      [true, true, true],
      [0, 0, 0],
    ])
  })
})

describe('borrowing and the one register never overlap (Wave 38)', () => {
  // Deterministic LCG so a failure reproduces.
  const rng = (seed: number) => () =>
    (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  test('20k random rows: no two shown names touch, and every shown name stays in the row', () => {
    const next = rng(7)
    for (let n = 0; n < 20000; n++) {
      const rowWidth = 80 + Math.floor(next() * 240)
      const count = 3 + Math.floor(next() * 3)
      const cuts = [
        0,
        ...Array.from({ length: count - 1 }, () => next() * rowWidth),
        rowWidth,
      ].toSorted((a, b) => a - b)
      const holdingAt = Math.floor(next() * count)
      const labels = Array.from({ length: count }, (_, i) => {
        const span = { left: cuts[i] as number, right: cuts[i + 1] as number }
        const centre = (span.left + span.right) / 2
        const w = 20 + next() * 50
        const sw = Math.max(8, w * (0.45 + next() * 0.35))
        return {
          box: { left: centre - w / 2, right: centre + w / 2 },
          span,
          ...(i === holdingAt && { holding: true }),
          ...(next() < 0.6 &&
            i !== holdingAt && {
              short: { left: centre - sw / 2, right: centre + sw / 2 },
            }),
        }
      })
      const out = placeRowLabels(labels, rowWidth)
      const rowOf: number[] = []
      const boxes = labels.flatMap((l, i) => {
        if (!out.shown[i]) return []
        rowOf.push(out.row[i] as number)
        const b = out.short[i] ? (l.short as { left: number; right: number }) : l.box
        const by = out.shift[i] as number
        return [{ left: b.left + by, right: b.right + by }]
      })
      for (const r of [0, 1]) {
        const onRow = boxes
          .filter((_, k) => k >= 0 && rowOf[k] === r)
          .toSorted((a, b) => a.left - b.left)
        for (let k = 1; k < onRow.length; k++) {
          expect((onRow[k] as { left: number }).left).toBeGreaterThanOrEqual(
            (onRow[k - 1] as { right: number }).right - 0.5,
          )
        }
      }
      for (const b of boxes) {
        expect(b.left).toBeGreaterThanOrEqual(-0.5)
        expect(b.right).toBeLessThanOrEqual(rowWidth + 0.5)
      }
    }
  })
})
