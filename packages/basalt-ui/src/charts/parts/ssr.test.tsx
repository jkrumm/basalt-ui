/**
 * The SSR contract of the v3 kinds: `hydrateRoot` adopts the server HTML of `Lines` and `Bars` with
 * zero recoverable errors and no mismatch warning, and a 5k-point server render stays linear and
 * under a cap (the 2.x `ssr-hydration` and `ssr-budget` suites, narrowed to these two kinds).
 */
import { act } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { SeriesColor } from '../contract'
import { Bars } from './bars'
import { Lines } from './lines'

const pair = (v: string): SeriesColor => ({ light: `var(--vx-${v})`, dark: `var(--vx-${v})` })
type Row = { t: number; a: number; b: number }
const rowsOf = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    t: Date.UTC(2026, 0, 1) + i * 60_000,
    a: Math.sin(i / 50) * 40 + 50 + (i % 7),
    b: Math.cos(i / 80) * 20 + 30,
  }))
const x = { value: (d: Row): Date => new Date(d.t) }
const a = { mark: 'line', key: 'a', label: 'A', color: pair('line'), y: (d: Row) => d.a } as const
const b = { mark: 'line', key: 'b', label: 'B', color: pair('accent'), y: (d: Row) => d.b } as const
const bar = (key: 'a' | 'b') =>
  ({ mark: 'bar', key, label: key, color: pair('line'), y: (d: Row) => d[key] }) as const

const lines = (n: number): ReactElement => (
  <Lines ariaLabel="L" data={rowsOf(n)} x={x} series={[a, b]} />
)
const bars = (n: number): ReactElement => (
  <Bars ariaLabel="B" data={rowsOf(n)} x={x} series={[bar('a'), bar('b')]} />
)

afterEach(() => {
  document.body.innerHTML = ''
})

async function hydrate(node: ReactElement): Promise<string[]> {
  const container = document.createElement('div')
  container.innerHTML = renderToString(node)
  document.body.append(container)
  const warnings: string[] = []
  const spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  })
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (e) => warnings.push(String(e)) })
  })
  spy.mockRestore()
  await act(async () => root?.unmount())
  return warnings
}

describe('SSR hydrate', () => {
  test('Lines: zero recoverable errors', async () => {
    expect(await hydrate(lines(40))).toEqual([])
  })
  test('Bars: zero recoverable errors', async () => {
    expect(await hydrate(bars(40))).toEqual([])
  })
  test('a table and a summary hydrate clean too', async () => {
    const node = (
      <Lines ariaLabel="L" data={rowsOf(20)} x={x} series={[a]} table summary="Twenty points" />
    )
    expect(await hydrate(node)).toEqual([])
  })
})

const SMALL = 1_250
const LARGE = 5_000
/** Linear growth is ~4x for a 4x input, quadratic ~16x. */
const MAX_GROWTH = 8
const NOISE_FLOOR_MS = 5
/** Generous: hosted runners are 2-3x slower than the reference host. */
const CAP_MS = { Lines: 150, Bars: 500 } as const

function bestOf(runs: number, fn: () => unknown): number {
  fn()
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    fn()
    best = Math.min(best, performance.now() - t0)
  }
  return best
}
const timeRender = (node: () => ReactElement): number => bestOf(5, () => renderToString(node()))
/** The idle reference host runs this loop in ~5 ms; a slower process scales the cap up, never down. */
const loadFactor = (): number =>
  Math.max(
    1,
    bestOf(5, () => {
      let sum = 0
      for (let i = 0; i < 1_000_000; i++) sum += Math.sin(i)
      return sum
    }) / 5,
  )

describe(`server render at ${LARGE} points`, () => {
  for (const [name, node] of [
    ['Lines', lines],
    ['Bars', bars],
  ] as const) {
    test(`${name}: growth under ${MAX_GROWTH}x from ${SMALL} to ${LARGE}, and under ${CAP_MS[name]} ms`, () => {
      const factor = loadFactor()
      const large = timeRender(() => node(LARGE))
      const small = Math.max(
        timeRender(() => node(SMALL)),
        NOISE_FLOOR_MS,
      )
      expect(large / small).toBeLessThan(MAX_GROWTH)
      expect(large).toBeLessThan(CAP_MS[name] * factor)
    }, 30_000)
  }
})
