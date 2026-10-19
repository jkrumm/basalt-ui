import { describe, expect, test } from 'bun:test'
import {
  findHoldingZone,
  layoutSegments,
  modelBar,
  normalizeSegments,
  segmentReading,
  spanOf,
  startCaptionText,
  placeRowLabels,
} from './meter-model'

const fmt = (n: number) => String(n)
const ZONES = [
  { from: 0, to: 300, label: 'Low' },
  { from: 300, to: 750, label: 'Optimal' },
  { from: 750, to: 1000, label: 'High' },
]

describe('findHoldingZone', () => {
  test('from is inclusive, to is exclusive', () => {
    expect(findHoldingZone(ZONES, 300)?.label).toBe('Optimal')
    expect(findHoldingZone(ZONES, 299)?.label).toBe('Low')
  })
  test('the last zone owns its end', () => {
    expect(findHoldingZone(ZONES, 1000)?.label).toBe('High')
  })
  test('below the first and past the last zone hold nothing', () => {
    expect(findHoldingZone([{ from: 100, to: 200, label: 'x' }], 50)).toBeUndefined()
    expect(findHoldingZone(ZONES, 1001)).toBeUndefined()
  })
})

describe('normalizeSegments', () => {
  test('negative and non-finite amounts become 0, in one place', () => {
    const out = normalizeSegments([
      { value: -5, label: 'a' },
      { value: Number.NaN, label: 'b' },
      { value: 7, label: 'c' },
    ])
    expect(out.map((s) => s.value)).toEqual([0, 0, 7])
    expect(segmentReading(out, 10)).toBe(17)
  })
})

describe('layoutSegments', () => {
  test('parts accumulate and stop at the track end', () => {
    const parts = layoutSegments(
      [
        { value: 70, label: 'a' },
        { value: 70, label: 'b' },
      ],
      100,
    )
    expect(parts.map((p) => [p.start, p.size])).toEqual([
      [0, 0.7],
      [0.7, 0.30000000000000004],
    ])
  })
  test('a forecast part ignores its colour', () => {
    const [part] = layoutSegments([{ value: 10, label: 'f', forecast: true, color: 'red' }], 100)
    expect(part?.color).toBeUndefined()
  })
})

describe('spanOf', () => {
  test('is pure: max <= min is the fallback span, flagged invalid', () => {
    expect(spanOf(5, 5)).toEqual({ span: 1, valid: false })
  })
  test('a valid track is its width', () => {
    expect(spanOf(10, 50)).toEqual({ span: 40, valid: true })
  })
})

describe('modelBar', () => {
  const base = { min: 0, max: 100, format: fmt }
  test('captions: zone + reading, overage past a target', () => {
    expect(modelBar({ ...base, reading: 612, max: 1000, zones: ZONES }).startText).toBe('612')
    expect(modelBar({ ...base, reading: 120, target: 100 }).endText).toBe('Target 100 · 20 over')
  })
  test('a forecast in first position still has a caption but no boundary tick', () => {
    const m = modelBar({
      ...base,
      reading: 50,
      segments: [{ value: 50, label: 'Plan', forecast: true }],
    })
    expect(m.forecastText).toBe('Forecast: Plan 50')
    expect(m.boundaryPct).toBeUndefined()
  })
  test('two forecasts are both named', () => {
    const m = modelBar({
      ...base,
      reading: 90,
      segments: [
        { value: 40, label: 'Done' },
        { value: 30, label: 'A', forecast: true },
        { value: 20, label: 'B', forecast: true },
      ],
    })
    expect(m.forecastText).toBe('Forecast: A 30, B 20')
    expect(m.boundaryPct).toBe(40)
  })
  test('non-zero min shifts target and marker', () => {
    const m = modelBar({ ...base, min: 100, max: 200, reading: 150, target: 125, zones: ZONES })
    expect(m.markerPct).toBe(50)
    expect(m.targetPct).toBe(25)
  })
})

describe('caption mode', () => {
  const base = { reading: 30, min: 0, max: 100, format: String }
  test('categorical segments caption their parts, in order, with the colour carried on the part', () => {
    const m = modelBar({
      ...base,
      segments: [
        { value: 20, label: 'A', color: 'red' },
        { value: 10, label: 'B' },
      ],
    })
    expect(m.captionMode).toBe('parts')
    expect(m.partCaptions.map((c) => [c.label, c.text, c.color])).toEqual([
      ['A', '20', 'red'],
      ['B', '10', undefined],
    ])
    expect(startCaptionText(m, undefined)).toBeNull()
    expect(startCaptionText(m, 'Total')).toBe('Total')
  })
  test('a forecast part keeps the reading + forecast form', () => {
    const m = modelBar({ ...base, segments: [{ value: 30, label: 'P', forecast: true }] })
    expect(m.captionMode).toBe('forecast')
    expect(m.partCaptions).toEqual([])
    expect(startCaptionText(m, undefined)).toBe('30')
  })
  test('zones win over segments at runtime: a zoned track is never captioned by parts', () => {
    const m = modelBar({
      ...base,
      zones: [{ from: 0, to: 100, label: 'All' }],
      segments: [{ value: 30, label: 'A' }],
    })
    expect(m.captionMode).toBe('reading')
    expect(m.partCaptions).toEqual([])
    expect(startCaptionText(m, undefined)).toBe('30')
  })
  test('no segments, and empty segments, are never categorical', () => {
    expect(modelBar(base).captionMode).toBe('reading')
    expect(modelBar({ ...base, segments: [] }).captionMode).toBe('reading')
  })
  test('keys are positional, so repeated labels stay unique', () => {
    const m = modelBar({
      ...base,
      segments: [
        { value: 1, label: 'A' },
        { value: 1, label: 'A' },
      ],
    })
    expect(m.partCaptions.map((c) => c.key)).toEqual(['0', '1'])
  })
})

describe('zoneLabels', () => {
  test('one per zone, in order, centred on its span, the holding one flagged', () => {
    const m = modelBar({ reading: 612, min: 0, max: 1000, format: fmt, zones: ZONES })
    expect(m.zoneLabels).toEqual([
      { key: '0', label: 'Low', centrePct: 15, widthPct: 30, holding: false },
      { key: '1', label: 'Optimal', centrePct: 52.5, widthPct: 45, holding: true },
      { key: '2', label: 'High', centrePct: 87.5, widthPct: 25, holding: false },
    ])
  })
  test('a reading outside every zone flags none; no zones has no labels', () => {
    const outside = modelBar({
      reading: 50,
      min: 0,
      max: 1000,
      format: fmt,
      zones: [{ from: 100, to: 200, label: 'Only' }],
    })
    expect(outside.zoneLabels.map((l) => l.holding)).toEqual([false])
    expect(modelBar({ reading: 5, min: 0, max: 10, format: fmt }).zoneLabels).toEqual([])
  })
  test('a non-zero min offsets the span centre', () => {
    const m = modelBar({
      reading: 30,
      min: 10,
      max: 50,
      format: fmt,
      zones: [{ from: 30, to: 50, label: 'Top' }],
    })
    expect(m.zoneLabels[0]?.centrePct).toBe(75)
  })
})

describe('placeRowLabels', () => {
  const zone = (
    left: number,
    right: number,
    spanLeft: number,
    spanRight: number,
    holding = false,
  ) => ({
    box: { left, right },
    span: { left: spanLeft, right: spanRight },
    ...(holding && { holding }),
  })
  test('a label wider than its span borrows free room in the row, a fitting one is kept', () => {
    expect(placeRowLabels([zone(5, 35, 0, 40), zone(55, 105, 60, 80)], 200).shown).toEqual([
      true,
      true,
    ])
  })
  test('a label wider than its span stands on the second row when the first has no room for it (Wave 39)', () => {
    const out = placeRowLabels([zone(5, 35, 0, 40), zone(55, 105, 60, 80)], 100)
    expect([out.shown, out.row]).toEqual([
      [true, true],
      [0, 1],
    ])
    expect(out.shift[1]).toBe(-5)
  })
  test('an end tick wins over a zone name it would touch; the name moves to the second row (Wave 39)', () => {
    const tick = { box: { left: 0, right: 8 } }
    const out = placeRowLabels([zone(2, 30, 0, 32), tick], 100)
    expect([out.shown, out.row]).toEqual([
      [true, true],
      [1, 0],
    ])
  })
  test('a label leaving the row is clamped inside the second row (Wave 39)', () => {
    const out = placeRowLabels([zone(-5, 20, -10, 30)], 100)
    expect([out.shown, out.row, out.shift]).toEqual([[true], [1], [5]])
  })
  test('a label wider than the row hides: neither row can hold it', () => {
    expect(placeRowLabels([zone(0, 60, 0, 40)], 50).shown).toEqual([false])
  })
  test('the holding zone never hides for width: wider than its span it still shows, over its neighbours', () => {
    // Holding 40px name in a 20px span; the neighbour (non-holding) fits its own span but clashes.
    const out = placeRowLabels([zone(30, 50, 30, 50), zone(20, 60, 30, 50, true)], 200)
    expect(out.shown).toEqual([true, true])
    expect(out.row).toEqual([1, 0])
  })
  test('the holding name is shifted back inside the row', () => {
    const left = placeRowLabels([zone(-10, 30, 0, 20, true)], 200)
    expect([left.shown[0], left.shift[0]]).toEqual([true, 10])
    const right = placeRowLabels([zone(170, 215, 160, 200, true)], 200)
    expect([right.shown[0], right.shift[0]]).toEqual([true, -15])
  })
  test('a tick still beats a non-holding zone name but the holding name keeps its place over a tick', () => {
    const tick = { box: { left: 0, right: 8 } }
    const out = placeRowLabels([zone(2, 30, 0, 32, true), tick], 100)
    expect([out.shown, out.row]).toEqual([
      [true, true],
      [0, 1],
    ])
  })
  test('a name too wide for either row falls back to its short label, then hides', () => {
    const wide = (short?: { left: number; right: number }) => ({
      ...zone(5, 55, 0, 40),
      ...(short && { short }),
    })
    // The full name (50 wide) stands on the second row of a 50 row before its short is tried (Wave 39).
    expect(placeRowLabels([wide({ left: 10, right: 30 })], 50)).toMatchObject({
      shown: [true],
      short: [false],
      row: [1],
    })
    // A row narrower than the full name takes the short, then hides when that is wider too.
    expect(placeRowLabels([wide({ left: 10, right: 30 })], 40)).toMatchObject({
      shown: [true],
      short: [true],
    })
    expect(placeRowLabels([wide({ left: 10, right: 50 })], 30)).toMatchObject({
      shown: [false],
      short: [false],
    })
    expect(placeRowLabels([wide()], 30)).toMatchObject({ shown: [false], short: [false] })
  })
  test('the full name wins when it fits; the short label is not used', () => {
    const fits = { ...zone(5, 35, 0, 40), short: { left: 10, right: 30 } }
    expect(placeRowLabels([fits], 200)).toMatchObject({ shown: [true], short: [false] })
  })
  test('a short label still hides when it clashes with a kept label', () => {
    const tick = { box: { left: 15, right: 25 } }
    const wide = { ...zone(5, 55, 0, 40), short: { left: 10, right: 30 } }
    expect(placeRowLabels([wide, tick], 200)).toMatchObject({ shown: [true, true], row: [1, 0] })
  })
  test('the holding zone never uses its short label', () => {
    const holding = { ...zone(30, 50, 40, 44, true), short: { left: 38, right: 46 } }
    expect(placeRowLabels([holding], 200)).toMatchObject({ shown: [true], short: [false] })
  })
})

/**
 * Wave 39: no zone name and no tick label is lost for width. Numbers are measured in the layout
 * fixture (`w39-meter-fixture.tsx`): argo's ACWR Meter in a 5-column strip cell has a 163.5 px track
 * at 390 and 203.4 px at 1440; its names measure Low 21.2, Optimal 40.1 (holding), Caution 38.0
 * (`Caut.` 25.7) and Danger 36.5 px; the Agents ticks measure `warn at 24 h` 63 (NBSP-joined) and
 * `abandoned at 7 d` 87 px; the label row's gap step is 6 px.
 */
describe('Meter labels are never lost for width (Wave 39)', () => {
  const GAP = 6
  const NAMES = [
    { w: 21.2, from: 0, to: 0.8 },
    { w: 40.1, from: 0.8, to: 1.3, holding: true },
    { w: 38.0, from: 1.3, to: 1.5, short: 25.7 },
    { w: 36.5, from: 1.5, to: 2 },
  ]
  const acwr = (track: number) =>
    NAMES.map((n) => {
      const span = { left: (n.from / 2) * track, right: (n.to / 2) * track }
      const mid = (span.left + span.right) / 2
      return {
        box: { left: mid - n.w / 2, right: mid + n.w / 2 },
        span,
        ...(n.holding && { holding: true }),
        ...(n.short !== undefined && {
          short: { left: mid - n.short / 2, right: mid + n.short / 2 },
        }),
      }
    })
  /** The boxes as drawn, per row, after the placement's shift. */
  const drawn = (labels: ReturnType<typeof acwr>, track: number) => {
    const out = placeRowLabels(labels, track, GAP)
    const rows: { left: number; right: number }[][] = [[], []]
    for (const [i, l] of labels.entries()) {
      if (!out.shown[i]) continue
      const b = out.short[i] ? (l.short as { left: number; right: number }) : l.box
      const by = out.shift[i] as number
      rows[out.row[i] as number]?.push({ left: b.left + by, right: b.right + by })
    }
    return { out, rows }
  }
  const apart = (rows: { left: number; right: number }[][], track: number) => {
    for (const row of rows) {
      const sorted = row.toSorted((a, b) => a.left - b.left)
      for (const b of sorted) {
        expect(b.left).toBeGreaterThanOrEqual(-0.5)
        expect(b.right).toBeLessThanOrEqual(track + 0.5)
      }
      for (let k = 1; k < sorted.length; k++)
        expect((sorted[k] as { left: number }).left).toBeGreaterThanOrEqual(
          (sorted[k - 1] as { right: number }).right + GAP - 0.5,
        )
    }
  }

  test('1a at 390: Caution (10 % of a 163.5 px track) stands on the second row, the rest on the first', () => {
    const { out, rows } = drawn(acwr(163.5), 163.5)
    expect(out.shown).toEqual([true, true, true, true])
    expect(out.row).toEqual([0, 0, 1, 0])
    expect(out.short).toEqual([false, false, false, false])
    apart(rows, 163.5)
  })

  test('1a at 1440 (203.4 px and wider): four FULL names on one row, a gap step apart', () => {
    for (const track of [203.4, 230, 250]) {
      const { out, rows } = drawn(acwr(track), track)
      expect(out.shown).toEqual([true, true, true, true])
      expect(out.row).toEqual([0, 0, 0, 0])
      expect(out.short).toEqual([false, false, false, false])
      apart(rows, track)
    }
  })

  test('the 1440 gap: adjacent zone names keep the gap step, none flush (OptimalCaution Danger)', () => {
    for (const track of [203.4, 240, 300, 360]) {
      const { out, rows } = drawn(acwr(track), track)
      expect(out.shown).toEqual([true, true, true, true])
      apart(rows, track)
    }
  })

  test('the second row exists only when a label needs it', () => {
    for (const track of [203.4, 300, 360, 480])
      expect(placeRowLabels(acwr(track), track, GAP).row.every((r) => r === 0)).toBe(true)
    expect(placeRowLabels(acwr(163.5), 163.5, GAP).row).toContain(1)
  })

  test('a slid neighbour and a slid holding name keep their centre inside their own span', () => {
    const labels = acwr(203.4)
    const out = placeRowLabels(labels, 203.4, GAP)
    // Optimal (the holding name) slides, and every centre stays inside its own span.
    expect(out.shift[1]).not.toBe(0)
    for (const [i, l] of labels.entries()) {
      const by = out.shift[i] as number
      const centre = (l.box.left + l.box.right) / 2 + by
      expect(centre).toBeGreaterThanOrEqual(l.span.left - 0.5)
      expect(centre).toBeLessThanOrEqual(l.span.right + 0.5)
    }
    // A slid name overhangs its span edge, by at most half its width (the model's 0.5 px slack).
    const holding = labels[1]!
    const left = holding.box.left + (out.shift[1] as number)
    const half = (holding.box.right - holding.box.left) / 2
    expect(left).toBeGreaterThanOrEqual(holding.span.left - half - 0.5)
  })

  test('on an equal count the full-name layout wins: full on row two over a short on row one', () => {
    const wide = {
      box: { left: 5, right: 55 },
      span: { left: 0, right: 40 },
      short: { left: 10, right: 30 },
    }
    const out = placeRowLabels([wide], 50, GAP)
    expect([out.shown, out.short, out.row]).toEqual([[true], [false], [1]])
  })

  const WARN = 63
  const ABANDONED = 87
  /** `warn at 24 h` hugs 24 h of 7 d (1/7 of the track); `abandoned at 7 d` is a tick AT max, right-aligned to the track end. */
  const ticks = (track: number) => [
    { box: { left: (1 / 7) * track, right: (1 / 7) * track + WARN } },
    { box: { left: track - ABANDONED, right: track }, end: true },
  ]

  test('1b at 390 (163.5 px): the end tick label leaves < 6 px beside `warn at 24 h`, so it takes the second row, right-aligned', () => {
    const out = placeRowLabels(ticks(163.5), 163.5, GAP)
    expect(out.shown).toEqual([true, true])
    expect(out.row).toEqual([0, 1])
    expect(out.shift).toEqual([0, 0])
  })

  test('1b at 1440 (355 px): both tick labels share the first row', () => {
    const out = placeRowLabels(ticks(355), 355, GAP)
    expect([out.shown, out.row]).toEqual([
      [true, true],
      [0, 0],
    ])
  })

  test('1b: when the cell is too narrow for both, the end tick moves to a second row, not away', () => {
    const out = placeRowLabels(ticks(140), 140, GAP)
    expect(out.shown).toEqual([true, true])
    expect(out.row).toEqual([0, 1])
    expect(out.shift[1]).toBe(0)
  })

  test('1b sweep: both tick labels stand (row two when needed) at every cell width, whatever the reading', () => {
    // The readings (10 min .. 7 d) move the fill and the value, never the tick labels' boxes.
    for (let track = 100; track <= 400; track += 5) {
      const { rows } = (() => {
        const out = placeRowLabels(ticks(track), track, GAP)
        expect(out.shown).toEqual([true, true])
        const row: { left: number; right: number }[][] = [[], []]
        for (const [i, l] of ticks(track).entries()) {
          const by = out.shift[i] as number
          row[out.row[i] as number]?.push({ left: l.box.left + by, right: l.box.right + by })
        }
        return { rows: row }
      })()
      apart(rows, track)
    }
  })

  test('narrowest tracks for argo’s four ACWR names: 115 px shows all four, 176 px as four full names on one row', () => {
    const at = (track: number) => placeRowLabels(acwr(track), track, GAP)
    expect(at(115).shown.every(Boolean)).toBe(true)
    expect(at(110).shown.every(Boolean)).toBe(false)
    const one = at(176)
    expect([one.row.every((r) => r === 0), one.short.some(Boolean)]).toEqual([true, false])
    expect(at(175).row.every((r) => r === 0) && !at(175).short.some(Boolean)).toBe(false)
  })

  test('a tick label wider than the room beside its mark is shifted inside the row, not lost', () => {
    const out = placeRowLabels([{ box: { left: 45, right: 135 } }], 100, GAP)
    expect([out.shown[0], out.row[0], out.shift[0]]).toEqual([true, 0, -35])
  })

  test("the scale's start figure never takes the second row: it hides (D38 drops it before anything wraps)", () => {
    // S2 goal at 390: `0 sessions` (start figure) clashes with the `Pace 14 sessions by 16 Oct` tick label.
    const figure = { box: { left: 0, right: 60 }, end: true, figure: true }
    const pace = { box: { left: 57, right: 193 } }
    const out = placeRowLabels([figure, pace], 358, GAP)
    expect([out.shown, out.row]).toEqual([
      [false, true],
      [0, 0],
    ])
    // A consumer tick label in the same spot still takes the second row.
    const tick = { box: { left: 0, right: 60 }, end: true }
    expect(placeRowLabels([tick, pace], 358, GAP)).toMatchObject({
      shown: [true, true],
      row: [1, 0],
    })
    // Room for both: the figure shows on the first row.
    expect(placeRowLabels([figure, { box: { left: 200, right: 336 } }], 358, GAP)).toMatchObject({
      shown: [true, true],
      row: [0, 0],
    })
  })

  test('a label that fits neither row hides, and only then', () => {
    const wide = [{ box: { left: 0, right: 120 } }]
    expect(placeRowLabels(wide, 100, GAP).shown).toEqual([false])
  })
})
