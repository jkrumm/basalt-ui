import { describe, expect, test } from 'bun:test'
import {
  findHoldingZone,
  layoutSegments,
  modelBar,
  normalizeSegments,
  segmentReading,
  spanOf,
  startCaptionText,
  zoneLabelsFit,
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
  test('one per zone, in order, at the band start, the holding one flagged', () => {
    const m = modelBar({ reading: 612, min: 0, max: 1000, format: fmt, zones: ZONES })
    expect(m.zoneLabels).toEqual([
      { key: '0', label: 'Low', startPct: 0, holding: false },
      { key: '1', label: 'Optimal', startPct: 30, holding: true },
      { key: '2', label: 'High', startPct: 75, holding: false },
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
  test('a non-zero min offsets the band start', () => {
    const m = modelBar({
      reading: 30,
      min: 10,
      max: 50,
      format: fmt,
      zones: [{ from: 30, to: 50, label: 'Top' }],
    })
    expect(m.zoneLabels[0]?.startPct).toBe(50)
  })
})

describe('zoneLabelsFit', () => {
  test('apart and inside the row fit; touching within the tolerance fits', () => {
    expect(
      zoneLabelsFit(
        [
          { left: 0, right: 40 },
          { left: 40.4, right: 80 },
        ],
        100,
      ),
    ).toBe(true)
  })
  test('overlapping neighbours do not fit, whatever their order', () => {
    expect(
      zoneLabelsFit(
        [
          { left: 30, right: 80 },
          { left: 0, right: 40 },
        ],
        100,
      ),
    ).toBe(false)
  })
  test('a label leaving either end of the row does not fit', () => {
    expect(zoneLabelsFit([{ left: 60, right: 110 }], 100)).toBe(false)
    expect(zoneLabelsFit([{ left: -4, right: 20 }], 100)).toBe(false)
  })
  test('checks every pair: a long name overlaps a distant one past a short neighbour', () => {
    const boxes = [
      { left: 0, right: 90 },
      { left: 10, right: 20 },
      { left: 50, right: 60 },
    ]
    expect(zoneLabelsFit(boxes, 100)).toBe(false)
  })
  test('no labels fit', () => {
    expect(zoneLabelsFit([], 100)).toBe(true)
  })
})
