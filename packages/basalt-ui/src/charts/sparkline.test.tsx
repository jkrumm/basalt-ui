/** `Sparkline`'s self-pooling (`poolSparkline`): the pure policy, then the rendered and hydrated result. */
import { act } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Sparkline, poolSparkline } from './Sparkline'

type Row = { i: number; v: number | null }
const rowsOf = (
  n: number,
  f: (i: number) => number | null = (i) => (i % 40 === 7 ? 90 : i % 40),
): Row[] => Array.from({ length: n }, (_, i) => ({ i, v: f(i) }))
const indices = (rows: readonly Row[]): number[] => rows.map((r) => r.i)

describe('poolSparkline', () => {
  test('a series within its cap is returned untouched (the same rows, the same drawing)', () => {
    const rows = rowsOf(100)
    expect(poolSparkline(rows, 100, 'line')).toBe(rows)
    expect(poolSparkline(rows, 200, 'bar')).toBe(rows)
    expect(poolSparkline(rows, 0, 'line')).toBe(rows)
    expect(poolSparkline(rows, -5, 'bar')).toBe(rows)
  })
  test('one and two rows are never pooled', () => {
    for (const n of [1, 2]) {
      const rows = rowsOf(n)
      expect(poolSparkline(rows, 1, 'line')).toBe(rows)
      expect(poolSparkline(rows, 200, 'bar')).toBe(rows)
    }
  })
  test('a line keeps at most one point per px, both ends, and every bucket peak and dip', () => {
    const rows = rowsOf(2000)
    const pooled = poolSparkline(rows, 100, 'line')
    expect(pooled.length).toBeLessThanOrEqual(100)
    expect(pooled[0]).toBe(rows[0])
    expect(pooled.at(-1)).toBe(rows.at(-1))
    expect(indices(pooled)).toEqual(indices(pooled).toSorted((a, b) => a - b))
    expect(Math.max(...pooled.map((r) => r.v ?? 0))).toBe(90)
    expect(Math.min(...pooled.map((r) => r.v ?? 0))).toBe(0)
  })
  test('a bar series keeps one bar per 2 px, the value furthest from zero in each bucket', () => {
    const pooled = poolSparkline(rowsOf(2000), 100, 'bar')
    expect(pooled.length).toBeLessThanOrEqual(50)
    expect(indices(pooled)).toEqual(pooled.map((_, i) => i))
    expect(Math.max(...pooled.map((r) => r.v ?? 0))).toBe(90)
  })
  test('the first and last row survive', () => {
    const rows = rowsOf(1000, (i) => (i === 0 ? 5 : i === 999 ? 7 : 50 + (i % 9)))
    const line = poolSparkline(rows, 80, 'line')
    expect([line[0]?.v, line.at(-1)?.v]).toEqual([5, 7])
    const bar = poolSparkline(rows, 80, 'bar')
    expect([bar[0]?.v, bar.at(-1)?.v]).toEqual([5, 7])
  })
  test('tiny widths hold the ceiling: a pair of points, a lone bar', () => {
    const rows = rowsOf(500)
    for (const width of [2, 3]) {
      const line = poolSparkline(rows, width, 'line')
      expect(indices(line)).toEqual([0, 499])
      expect(line.length).toBeLessThanOrEqual(width)
      expect(poolSparkline(rows, width, 'bar')).toHaveLength(1)
    }
    expect(poolSparkline(rows, 4, 'bar').length).toBeLessThanOrEqual(2)
  })
  test('a width equal to the row count is within the cap', () => {
    const rows = rowsOf(120)
    expect(poolSparkline(rows, 120, 'line')).toBe(rows)
    expect(poolSparkline(rows, 240, 'bar')).toBe(rows)
    expect(poolSparkline(rows, 119, 'line').length).toBeLessThanOrEqual(119)
  })
  test('a gap is never closed: it stays exactly at its original indices', () => {
    // 100..299 is null, with real values on both sides inside the same buckets.
    const rows = rowsOf(1000, (i) => (i >= 100 && i < 300 ? null : (i * 7) % 31))
    const pooled = poolSparkline(rows, 100, 'line')
    const nulls = pooled.filter((r) => r.v === null)
    expect(nulls).toHaveLength(1)
    expect(nulls[0]?.i).toBe(100)
    // The finite row either side of the gap is the original neighbour, so the gap spans 99→300.
    const at = pooled.findIndex((r) => r.v === null)
    expect(pooled[at - 1]?.i).toBe(99)
    expect(pooled[at + 1]?.i).toBe(300)
    expect(pooled.every((r) => r.v === null || r.i < 100 || r.i >= 300)).toBe(true)
  })
  test('several gaps, one inside a bucket, each survive; leading and trailing nulls too', () => {
    const gapAt = new Set([0, 1, 50, 51, 52, 400, 998, 999])
    const rows = rowsOf(1000, (i) => (gapAt.has(i) ? null : (i * 13) % 17))
    const pooled = poolSparkline(rows, 120, 'line')
    expect(pooled.filter((r) => r.v === null).map((r) => r.i)).toEqual([0, 50, 400, 998])
    // The trailing gap is one null row at its first index.
    expect(pooled.at(-1)?.i).toBe(998)
  })
  test('all-null input stays one gap; an all-null bar bucket is a null bar', () => {
    const line = poolSparkline(
      rowsOf(500, () => null),
      100,
      'line',
    )
    expect(line.every((r) => r.v === null)).toBe(true)
    expect(line.length).toBeLessThanOrEqual(3)
    const bars = poolSparkline(
      rowsOf(500, (i) => (i < 250 ? null : 3)),
      100,
      'bar',
    )
    expect(bars.some((r) => r.v === null)).toBe(true)
    expect(bars.at(-1)?.v).toBe(3)
  })
})

describe('Sparkline rendered', () => {
  const marks = (html: string, bar: boolean): number => {
    const el = document.createElement('div')
    el.innerHTML = html
    return bar
      ? el.querySelectorAll('rect[data-ts-key^="bars:"]').length
      : (el.querySelector('path[data-ts-key*=":segment:"]')?.getAttribute('d') ?? '').split('C')
          .length
  }
  const long = Array.from({ length: 3000 }, (_, i) => (i * 37) % 53)

  test('a long series draws within the server frame (640 px), a short one in full', () => {
    const bars = renderToString(<Sparkline ariaLabel="S" data={long} height={30} mark="bar" />)
    expect(marks(bars, true)).toBeLessThanOrEqual(320)
    const short = renderToString(
      <Sparkline ariaLabel="S" data={long.slice(0, 40)} height={30} mark="bar" />,
    )
    expect(marks(short, true)).toBe(40)
    const line = renderToString(<Sparkline ariaLabel="S" data={long} height={30} />)
    expect(marks(line, false)).toBeLessThanOrEqual(640)
  })
})

describe('Sparkline hydration', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })
  async function hydrate(
    node: ReactElement,
  ): Promise<{ server: string; client: string; warnings: string[] }> {
    const container = document.createElement('div')
    container.innerHTML = renderToString(node)
    document.body.append(container)
    const server = container.innerHTML
    const warnings: string[] = []
    const spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    })
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, node, { onRecoverableError: (e) => warnings.push(String(e)) })
    })
    spy.mockRestore()
    const client = container.innerHTML
    await act(async () => root?.unmount())
    return { server, client, warnings }
  }
  /** The engine writes inline styles and `direction` on mount; the marks are what must match. */
  const marksOnly = (html: string): string =>
    html.replaceAll(/ style="[^"]*"/g, '').replaceAll(' direction="ltr"', '')
  const data = Array.from({ length: 3000 }, (_, i) => (i * 37) % 53)

  test.each(['line', 'bar'] as const)(
    'a ~3,000-row %s series: the first client render is the server markup, no mismatch',
    async (mark) => {
      const { server, client, warnings } = await hydrate(
        <Sparkline ariaLabel="S" data={data} height={30} mark={mark} emphasizeLast />,
      )
      expect(warnings).toEqual([])
      expect(marksOnly(client)).toBe(marksOnly(server))
    },
  )
})
