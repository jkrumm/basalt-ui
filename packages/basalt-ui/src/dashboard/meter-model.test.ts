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
  test('a label wider than its span is hidden, a fitting one is kept', () => {
    expect(placeRowLabels([zone(5, 35, 0, 40), zone(55, 105, 60, 80)], 200).shown).toEqual([
      true,
      false,
    ])
  })
  test('an end tick wins over a zone name it would touch', () => {
    const tick = { box: { left: 0, right: 8 } }
    expect(placeRowLabels([zone(2, 30, 0, 32), tick], 100).shown).toEqual([false, true])
  })
  test('a label leaving the row is hidden', () => {
    expect(placeRowLabels([zone(-5, 20, -10, 30)], 100).shown).toEqual([false])
  })
  test('the holding zone never hides for width: wider than its span it still shows, over its neighbours', () => {
    // Holding 40px name in a 20px span; the neighbour (non-holding) fits its own span but clashes.
    const out = placeRowLabels([zone(30, 50, 30, 50), zone(20, 60, 30, 50, true)], 200)
    expect(out.shown).toEqual([false, true])
  })
  test('the holding name is shifted back inside the row', () => {
    const left = placeRowLabels([zone(-10, 30, 0, 20, true)], 200)
    expect([left.shown[0], left.shift[0]]).toEqual([true, 10])
    const right = placeRowLabels([zone(170, 215, 160, 200, true)], 200)
    expect([right.shown[0], right.shift[0]]).toEqual([true, -15])
  })
  test('a tick still beats a non-holding zone name but the holding name keeps its place over a tick', () => {
    const tick = { box: { left: 0, right: 8 } }
    expect(placeRowLabels([zone(2, 30, 0, 32, true), tick], 100).shown).toEqual([true, false])
  })
})
