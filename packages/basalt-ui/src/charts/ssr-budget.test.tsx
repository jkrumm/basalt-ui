/**
 * The server render cost of a dense chart (`docs/V2-SPEC.md` § 9.6). Every kind renders at 10k
 * points through `renderToString` under a per-kind budget, so an N-by-N path in the engine or in a
 * kind (a 5k-row `DualPanel` once took 12 s) fails here instead of in a consumer's first request.
 * Budgets are ~3x the local median, capped at 250 ms, for a CI runner 2-3x slower; each kind is
 * warmed once so the JIT is not billed. The median of three timed renders resists one GC pause.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { BandStrip } from './BandStrip'
import { Bars } from './Bars'
import { Donut } from './Donut'
import { DualPanel } from './DualPanel'
import { Heatmap } from './Heatmap'
import { Lines } from './Lines'
import { Sparkline } from './Sparkline'
import { StackedArea } from './StackedArea'

const POINTS = 10_000

type Row = { t: number; a: number; b: number; c: number }
const rows: Row[] = Array.from({ length: POINTS }, (_, i) => ({
  t: Date.UTC(2026, 0, 1) + i * 60_000,
  a: Math.sin(i / 50) * 40 + 50 + (i % 7),
  b: Math.cos(i / 80) * 20 + 30,
  c: Math.sin(i / 13) * 10,
}))
const x = (d: Row): Date => new Date(d.t)
const series = (key: string, getValue: (d: Row) => number) => ({
  key,
  label: key,
  color: 'var(--vx-accent)',
  getValue,
})
const a = series('a', (d) => d.a)
const b = series('b', (d) => d.b)
const bandOf = (d: Row): { state: string } => ({ state: d.t % 180_000 ? 'up' : 'down' })
const side = Math.ceil(Math.sqrt(POINTS))
const cells = Array.from({ length: POINTS }, (_, i) => ({
  row: `r${i % side}`,
  col: `c${Math.floor(i / side)}`,
  v: i % 17,
}))
const slices = Array.from({ length: POINTS }, (_, i) => ({ key: `k${i}`, value: 1 + (i % 5) }))

/** `budget` in ms. Bars and DualPanel sit at the 250 cap (2.2x and 1.7x their local median). */
const KINDS: readonly { name: string; budget: number; node: () => ReactElement }[] = [
  {
    name: 'Lines',
    budget: 100,
    node: () => <Lines ariaLabel="L" data={rows} x={x} series={[a, b]} />,
  },
  { name: 'Bars', budget: 250, node: () => <Bars ariaLabel="B" data={rows} x={x} bars={[a, b]} /> },
  {
    name: 'StackedArea',
    budget: 180,
    node: () => <StackedArea ariaLabel="S" data={rows} x={x} series={[a, b]} />,
  },
  {
    name: 'DualPanel',
    budget: 250,
    node: () => (
      <DualPanel
        ariaLabel="D"
        data={rows}
        x={x}
        series={[a, b]}
        fillBetween={{ from: 'a', to: 'b', fill: 'var(--vx-bad)', aboveFill: 'var(--vx-good)' }}
        bar={{
          label: 'c',
          getValue: (d) => d.c,
          positive: 'var(--vx-good)',
          negative: 'var(--vx-bad)',
          format: String,
        }}
      />
    ),
  },
  {
    name: 'BandStrip',
    budget: 200,
    node: () => (
      <BandStrip
        ariaLabel="BS"
        data={rows}
        x={x}
        states={[
          { key: 'up', label: 'up', color: 'var(--vx-good)' },
          { key: 'down', label: 'down', color: 'var(--vx-bad)' },
        ]}
        getBand={bandOf}
      />
    ),
  },
  {
    name: 'Heatmap',
    budget: 100,
    node: () => (
      <Heatmap
        ariaLabel="H"
        data={cells}
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
      />
    ),
  },
  {
    name: 'Donut',
    budget: 30,
    node: () => (
      <Donut
        ariaLabel="DN"
        data={slices}
        colorForKey={() => 'var(--vx-accent)'}
        formatValue={String}
      />
    ),
  },
  {
    name: 'Sparkline (line)',
    budget: 40,
    node: () => <Sparkline ariaLabel="SP" data={rows.map((r) => r.a)} height={40} width={640} />,
  },
]

const median = (xs: number[]): number => xs.toSorted((p, q) => p - q)[xs.length >> 1] as number

function timeRender(node: () => ReactElement): number {
  renderToString(node())
  const runs = [0, 1, 2].map(() => {
    const t0 = performance.now()
    renderToString(node())
    return performance.now() - t0
  })
  return median(runs)
}

describe('server render budget at 10k points', () => {
  for (const { name, budget, node } of KINDS) {
    test(`${name} renders under ${budget} ms`, () => {
      const ms = timeRender(node)
      expect(ms).toBeLessThan(budget)
    })
  }
  // Both draw `barY` rows without a series key or an explicit extent, which the engine stacks as one
  // series per row (an N-by-N matrix). Enable once they pass `y1: 0` like DualPanel.
  test.todo('MirroredBars renders under 250 ms', () => {})
  test.todo('Sparkline (bar) renders under 100 ms', () => {})
})
