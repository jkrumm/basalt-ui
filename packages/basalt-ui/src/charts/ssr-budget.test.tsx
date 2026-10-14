/**
 * The server render cost of a dense chart (`docs/V2-SPEC.md` § 9.6). Every kind renders 2.5k and 10k
 * points through `renderToString`, and two things are asserted: growth is not super-linear
 * (`t(10k) / t(2.5k) < 8`; linear is ~4, quadratic ~16, which is what a 5k-row `DualPanel` taking
 * 12 s was) and 10k stays under an absolute cap (>= 4x the local median, for runners 2-3x slower).
 * The ratio catches the bug class on any machine; the cap catches a constant-factor blow-up. Each
 * time is the median of three renders after one warm-up, so the JIT and a GC pause are not billed.
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
import { MirroredBars } from './MirroredBars'
import { Sparkline } from './Sparkline'
import { StackedArea } from './StackedArea'

const SMALL = 2_500
const LARGE = 10_000
/** Linear growth is ~4x for a 4x input, quadratic ~16x. */
const MAX_GROWTH = 8
/** Below this a timing is noise, so the ratio's denominator is floored here. */
const NOISE_FLOOR_MS = 5

type Row = { t: number; a: number; b: number; c: number }
const rowsOf = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
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
const pane = { format: String }

/**
 * `cap` in ms, >= 4x the local median at 10k, which each comment records (median of three runs,
 * 2.5k then 10k). The growth ratio is the real gate; the cap only catches a constant-factor blow-up
 * and is generous because hosted runners are 2-3x slower. `docs/waves/evidence/w10/ssr-cost.md`
 * copies these numbers.
 */
const KINDS: readonly { name: string; cap: number; node: (n: number) => ReactElement }[] = [
  // 13 ms at 2.5k, 34 ms at 10k
  {
    name: 'Lines',
    cap: 150,
    node: (n) => <Lines ariaLabel="L" data={rowsOf(n)} x={x} series={[a, b]} />,
  },
  // 26 ms at 2.5k, 111 ms at 10k
  {
    name: 'Bars',
    cap: 500,
    node: (n) => <Bars ariaLabel="B" data={rowsOf(n)} x={x} bars={[a, b]} />,
  },
  // 22 ms at 2.5k, 83 ms at 10k
  {
    name: 'StackedArea',
    cap: 350,
    node: (n) => <StackedArea ariaLabel="S" data={rowsOf(n)} x={x} series={[a, b]} />,
  },
  // 80 ms at 2.5k, 169 ms at 10k
  {
    name: 'DualPanel',
    cap: 1000,
    node: (n) => (
      <DualPanel
        ariaLabel="D"
        data={rowsOf(n)}
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
  // 54 ms at 2.5k, 205 ms at 10k
  {
    name: 'MirroredBars',
    cap: 1000,
    node: (n) => (
      <MirroredBars
        ariaLabel="M"
        data={rowsOf(n)}
        x={x}
        series={[a, b]}
        up={{ key: 'a', ...pane }}
        down={{ key: 'b', ...pane }}
      />
    ),
  },
  // 19 ms at 2.5k, 78 ms at 10k
  {
    name: 'BandStrip',
    cap: 350,
    node: (n) => (
      <BandStrip
        ariaLabel="BS"
        data={rowsOf(n)}
        x={x}
        states={[
          { key: 'up', label: 'up', color: 'var(--vx-good)' },
          { key: 'down', label: 'down', color: 'var(--vx-bad)' },
        ]}
        getBand={bandOf}
      />
    ),
  },
  // 6 ms at 2.5k, 22 ms at 10k
  {
    name: 'Heatmap',
    cap: 100,
    node: (n) => {
      const side = Math.ceil(Math.sqrt(n))
      const cells = Array.from({ length: n }, (_, i) => ({
        row: `r${i % side}`,
        col: `c${Math.floor(i / side)}`,
        v: i % 17,
      }))
      return (
        <Heatmap
          ariaLabel="H"
          data={cells}
          getRow={(d) => d.row}
          getCol={(d) => d.col}
          getValue={(d) => d.v}
        />
      )
    },
  },
  // 1 ms at 2.5k, 2 ms at 10k
  {
    name: 'Donut',
    cap: 30,
    node: (n) => (
      <Donut
        ariaLabel="DN"
        data={Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: 1 + (i % 5) }))}
        colorForKey={() => 'var(--vx-accent)'}
        formatValue={String}
      />
    ),
  },
  // 3 ms at 2.5k, 15 ms at 10k
  {
    name: 'Sparkline (line)',
    cap: 80,
    node: (n) => (
      <Sparkline ariaLabel="SP" data={rowsOf(n).map((r) => r.a)} height={40} width={640} />
    ),
  },
  // 5 ms at 2.5k, 26 ms at 10k
  {
    name: 'Sparkline (bar)',
    cap: 120,
    node: (n) => (
      <Sparkline
        ariaLabel="SP"
        mark="bar"
        data={rowsOf(n).map((r) => r.c)}
        height={40}
        width={640}
      />
    ),
  },
]

const median = (xs: number[]): number =>
  xs.length === 0 ? Number.NaN : (xs.toSorted((p, q) => p - q)[xs.length >> 1] ?? Number.NaN)

function timeRender(node: () => ReactElement): number {
  renderToString(node())
  const runs = [0, 1, 2].map(() => {
    const t0 = performance.now()
    renderToString(node())
    return performance.now() - t0
  })
  return median(runs)
}

describe(`server render at ${LARGE} points`, () => {
  for (const { name, cap, node } of KINDS) {
    test(`${name}: growth under ${MAX_GROWTH}x from ${SMALL} to ${LARGE}, and under ${cap} ms`, () => {
      const small = timeRender(() => node(SMALL))
      const large = timeRender(() => node(LARGE))
      expect(large / Math.max(small, NOISE_FLOOR_MS)).toBeLessThan(MAX_GROWTH)
      expect(large).toBeLessThan(cap)
    })
  }
})
