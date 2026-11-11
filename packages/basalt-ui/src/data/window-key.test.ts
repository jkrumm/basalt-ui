/**
 * `windowKey`: ported from linewatch's `queries.test.ts` (quantiseWindow, sameWindowedQuery), with
 * the step a parameter instead of linewatch's bucket-seconds clamp.
 */
import { describe, expect, test } from 'bun:test'
import { quantiseWindow, sameWindowedQuery, windowKey } from './window-key'

const NOW = Date.UTC(2026, 6, 30, 12, 0, 0)
const STEP = 300_000
const RANGES = [3_600_000, 86_400_000, 7 * 86_400_000, 30 * 86_400_000]

const rangeToWindow = (span: number, now = NOW) => ({ from: now - span, to: now })

/** `[..., from, to]`, the convention `sameWindowedQuery` depends on. */
const probeKey = (target: string, bucket: number, window: { from: number; to: number }) => [
  'probes',
  target,
  bucket,
  window.from,
  window.to,
]

describe('quantiseWindow', () => {
  test('preserves the span exactly', () => {
    const window = rangeToWindow(86_400_000)
    const q = quantiseWindow(window, STEP)
    expect(q.to - q.from).toBe(window.to - window.from)
  })

  test('floors `to` onto the step and shifts `from` by the identical delta', () => {
    const to = NOW + 1_234
    const from = to - 1_000_000
    const q = quantiseWindow({ from, to }, STEP)
    const expectedTo = Math.floor(to / STEP) * STEP
    expect(q.to).toBe(expectedTo)
    expect(q.from).toBe(from - (to - expectedTo))
  })

  test('a `to` already on the step boundary is returned unchanged', () => {
    const to = Math.floor(NOW / 60_000) * 60_000
    const from = to - 3_600_000
    expect(quantiseWindow({ from, to }, 60_000)).toEqual({ from, to })
  })
})

describe('sameWindowedQuery', () => {
  test('a time advance (same span, same leading params) keeps the previous data', () => {
    const outgoing = probeKey('gateway', 60, { from: 0, to: 3_600_000 })
    const incoming = probeKey('gateway', 60, { from: 300_000, to: 3_900_000 })
    expect(sameWindowedQuery(incoming, outgoing)).toBe(true)
  })

  test.each(RANGES)('a range change away from %p never keeps the previous data', (range) => {
    const incoming = probeKey('gateway', 60, rangeToWindow(range))
    for (const previous of RANGES) {
      if (previous === range) continue
      expect(sameWindowedQuery(incoming, probeKey('gateway', 60, rangeToWindow(previous)))).toBe(
        false,
      )
    }
  })

  test('a filter change never keeps the previous data, even at an identical span', () => {
    const outgoing = ['outages', 0, 0, 3_600_000]
    const incoming = ['outages', 60, 300_000, 3_900_000]
    expect(sameWindowedQuery(incoming, outgoing)).toBe(false)
  })

  test('a key of different length never matches', () => {
    expect(sameWindowedQuery(['probes', 'gateway', 0, 1], ['probes', 'gateway', 60, 0, 1])).toBe(
      false,
    )
  })

  test('a key shorter than 2 positions never matches, even against itself', () => {
    expect(sameWindowedQuery([1], [1])).toBe(false)
  })

  test('non-numeric trailing positions never match', () => {
    expect(sameWindowedQuery(['a', 'x', 'y'], ['a', 'x', 'y'])).toBe(false)
  })
})

describe('windowKey', () => {
  const at = (now: number, span = 3_600_000) =>
    windowKey(rangeToWindow(span, now), { stepMs: STEP, scope: ['uptime', 'gateway'] })

  test('a rotating [from, to] inside one step yields the same key', () => {
    const first = at(NOW)
    for (const offset of [1_000, 60_000, STEP - 1]) {
      expect(at(NOW + offset).queryKey).toEqual(first.queryKey)
    }
    expect(at(NOW + STEP).queryKey).not.toEqual(first.queryKey)
  })

  test('the key is [...scope, from, to]', () => {
    const w = at(NOW)
    expect(w.queryKey).toEqual(['uptime', 'gateway', w.from, w.to])
  })

  test('the next step keeps the previous data as placeholder', () => {
    const previous = at(NOW)
    const next = at(NOW + STEP)
    expect(next.placeholderData('old', { queryKey: previous.queryKey })).toBe('old')
  })

  test('a range change gets no placeholder', () => {
    const previous = at(NOW, 86_400_000)
    const next = at(NOW + STEP, 7 * 86_400_000)
    expect(next.placeholderData('old', { queryKey: previous.queryKey })).toBeUndefined()
  })

  test('a different scope (filter) gets no placeholder', () => {
    const previous = windowKey(rangeToWindow(3_600_000), { stepMs: STEP, scope: ['uptime', 'a'] })
    const next = windowKey(rangeToWindow(3_600_000, NOW + STEP), {
      stepMs: STEP,
      scope: ['uptime', 'b'],
    })
    expect(next.placeholderData('old', { queryKey: previous.queryKey })).toBeUndefined()
  })

  test('the first mount (no previous query) gets no placeholder', () => {
    expect(at(NOW).placeholderData('old', undefined)).toBeUndefined()
  })

  test('a non-positive step throws', () => {
    for (const stepMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => windowKey(rangeToWindow(1000), { stepMs })).toThrow(RangeError)
    }
  })
})
