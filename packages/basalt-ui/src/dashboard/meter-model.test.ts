import { describe, expect, spyOn, test } from 'bun:test'
import { findHoldingZone, layoutSegments, modelBar, segmentReading, spanOf } from './meter-model'

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
  test('a negative amount draws nothing', () => {
    expect(layoutSegments([{ value: -5, label: 'a' }], 100)[0]?.size).toBe(0)
  })
})

describe('segmentReading', () => {
  test('is min plus the sum', () => {
    expect(
      segmentReading(
        [
          { value: 5, label: 'a' },
          { value: 7, label: 'b' },
        ],
        10,
      ),
    ).toBe(22)
  })
})

describe('spanOf', () => {
  test('max <= min falls back to 1 and warns outside production', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    expect(spanOf(5, 5)).toBe(1)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
  test('a valid track is its width and silent', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    expect(spanOf(10, 50)).toBe(40)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('modelBar', () => {
  const base = { min: 0, max: 100, format: fmt }
  test('captions: zone + reading, overage past a target', () => {
    expect(modelBar({ ...base, reading: 612, max: 1000, zones: ZONES }).startText).toBe(
      'Optimal · 612',
    )
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
