/** `thinFill` and `barMark`: the pure helpers behind the server render cost fix. */
import { describe, expect, test } from 'bun:test'
import { barMark, thinFill } from './marks'

type R = { x: number; from: number; to: number }
const row = (x: number, from = 10, to = 20): R => ({ x, from, to })
const at = (r: R): number => r.x
/** `n` evenly spaced rows over [0, 1). */
const even = (n: number, f: (i: number) => Partial<R> = () => ({})): R[] =>
  Array.from({ length: n }, (_, i) => ({ ...row(i / n), ...f(i) }))

describe('thinFill', () => {
  test('returns the rows unchanged at or below 4 rows per pixel', () => {
    const rows = even(400)
    expect(thinFill(rows, 100, at)).toEqual(rows)
    expect(thinFill(rows, 100, at)).not.toBe(rows)
  })

  test('thins one row past the boundary', () => {
    const rows = even(401)
    expect(thinFill(rows, 100, at).length).toBeLessThan(401)
  })

  test('an unmeasured width (0, negative, NaN) leaves the rows alone', () => {
    const rows = even(10_000)
    for (const w of [0, -5, Number.NaN, 0.4]) expect(thinFill(rows, w, at)).toEqual(rows)
  })

  test('keeps the true first and last row and the order', () => {
    const rows = even(5_000, (i) => ({ from: 10 + (i % 3) }))
    const out = thinFill(rows, 100, at)
    expect(out[0]).toBe(rows[0] as R)
    expect(out.at(-1)).toBe(rows.at(-1) as R)
    expect(out.map((r) => r.x)).toEqual(out.map((r) => r.x).toSorted((p, q) => p - q))
    expect(out.length).toBeLessThan(5_000 / 3)
  })

  test('a one-row spike survives', () => {
    const rows = even(5_000, (i) => (i === 2_501 ? { to: 999 } : {}))
    expect(thinFill(rows, 100, at).some((r) => r.to === 999)).toBe(true)
  })

  test('buckets by drawn position, not array index', () => {
    // 4,000 rows packed into the first 1% of x, then 100 sparse rows zigzagging across the sign
    // line over the rest. Index buckets (41 rows each) would swallow the sparse run, keeping only
    // extremes; by position every sparse row owns its column and every crossing survives.
    const burst = Array.from({ length: 4_000 }, (_, i) => row(i / 400_000, 10, 20))
    const sparse = Array.from({ length: 100 }, (_, i) =>
      row(0.01 + (i / 100) * 0.99, 20, i % 2 ? 25 : 15 + (i % 4)),
    )
    const out = thinFill([...burst, ...sparse], 100, at)
    for (const r of sparse) expect(out).toContain(r)
    // The burst collapses into its first column: first, last and the extremes (all equal).
    expect(out.filter((r) => r.x < 0.01).length).toBeLessThan(10)
  })

  test('a row with no position is kept', () => {
    const rows = even(5_000)
    const odd = row(Number.NaN)
    rows[2_000] = odd
    expect(thinFill(rows, 100, at)).toContain(odd)
  })
})

describe('barMark', () => {
  test('a single-series bar gets an explicit extent, and a series or layout is left alone', () => {
    const rows = [{ x: 1, y: 2 }]
    expect(() => barMark(rows, { x: 'x', y: 'y' })).not.toThrow()
    expect(() => barMark(rows, { x: 'x', y: 'y', z: 'x' })).not.toThrow()
  })
})
