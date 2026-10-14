/**
 * The server render cost of a dense chart (`docs/V2-SPEC.md` § 9.6). Every kind renders 2.5k and 10k
 * points through `renderToString`, and two things are asserted: growth is not super-linear
 * (`t(10k) / t(2.5k) < 8`; linear is ~4, quadratic ~16, which is what a 5k-row `DualPanel` taking
 * 12 s was) and 10k stays under an absolute cap (>= 4x the local median, for runners 2-3x slower).
 * The ratio catches the bug class on any machine; the cap catches a constant-factor blow-up. Each
 * time is the fastest of five renders after one warm-up, so the JIT, a GC pause and a burst of
 * contention from parallel suites are not billed. The cap is also scaled by how much slower this
 * process runs a fixed CPU loop than an idle host does (`loadFactor`), so a host that is slow for
 * the whole test (3750 ms against a 1000 ms cap, seen with other suites running) does not fail it.
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
/** The cheap pre-flight sizes: a quadratic render is ~90 s at 10k but ~1 s at 1k, so it fails here. */
const PROBE_SMALL = 250
const PROBE_LARGE = 1_000
/** Linear is ~4x for 4x points, quadratic ~16x; the margin covers fixed cost and timer noise. */
const PROBE_MAX_GROWTH = 6
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
const KINDS: readonly {
  name: string
  cap: number
  /** `false`: timings near the noise floor, so only the generous cap applies. */
  growth?: false
  node: (n: number) => ReactElement
}[] = [
  // 8 ms at 2.5k, 34 ms at 10k
  {
    name: 'Lines',
    cap: 150,
    node: (n) => <Lines ariaLabel="L" data={rowsOf(n)} x={x} series={[a, b]} />,
  },
  // 26 ms at 2.5k, 101 ms at 10k
  {
    name: 'Bars',
    cap: 500,
    node: (n) => <Bars ariaLabel="B" data={rowsOf(n)} x={x} bars={[a, b]} />,
  },
  // 16 ms at 2.5k, 61 ms at 10k
  {
    name: 'StackedArea',
    cap: 350,
    node: (n) => <StackedArea ariaLabel="S" data={rowsOf(n)} x={x} series={[a, b]} />,
  },
  // 72 ms at 2.5k, 155 ms at 10k
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
  // 63 ms at 2.5k, 254 ms at 10k (with getAbsentFraction and getBarOpacity)
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
        getAbsentFraction={(d) => (d.t % 300_000 === 0 ? 0.5 : 0)}
        getBarOpacity={(d) => (d.t % 420_000 === 0 ? 0.6 : 1)}
      />
    ),
  },
  // 20 ms at 2.5k, 79 ms at 10k
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
  // 25 ms at 10k (cap only)
  {
    name: 'Heatmap',
    cap: 100,
    growth: false,
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
  // 3 ms at 10k (cap only)
  {
    name: 'Donut',
    cap: 100,
    growth: false,
    node: (n) => (
      <Donut
        ariaLabel="DN"
        data={Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: 1 + (i % 5) }))}
        colorForKey={() => 'var(--vx-accent)'}
        formatValue={String}
      />
    ),
  },
  // 3 ms at 2.5k, 14 ms at 10k
  {
    name: 'Sparkline (line)',
    cap: 80,
    node: (n) => (
      <Sparkline ariaLabel="SP" data={rowsOf(n).map((r) => r.a)} height={40} width={640} />
    ),
  },
  // 5 ms at 2.5k, 23 ms at 10k
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

/** Fastest of `runs` timed calls after one untimed warm-up. */
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

const timeRender = (node: () => ReactElement, runs = 5): number =>
  bestOf(runs, () => renderToString(node()))

/** `calibration()` on an idle dev machine, in ms (best of five, 4.6 on the reference host). */
const CALIBRATION_IDLE_MS = 5
/** A fixed CPU loop, so how slow this process is right now can be read off a known quantity. */
const calibration = (): number =>
  bestOf(5, () => {
    let sum = 0
    for (let i = 0; i < 1_000_000; i++) sum += Math.sin(i)
    return sum
  })

/** >= 1: how much slower than idle this process runs right now. Never shrinks a cap. */
const loadFactor = (): number => Math.max(1, calibration() / CALIBRATION_IDLE_MS)

describe(`server render at ${LARGE} points`, () => {
  for (const { name, cap, growth, node } of KINDS) {
    test(`${name}: ${growth === false ? '' : `growth under ${MAX_GROWTH}x from ${SMALL} to ${LARGE}, and `}under ${cap} ms`, () => {
      if (growth !== false) {
        const probe =
          timeRender(() => node(PROBE_LARGE), 3) /
          Math.max(
            timeRender(() => node(PROBE_SMALL), 3),
            NOISE_FLOOR_MS,
          )
        expect(probe).toBeLessThan(PROBE_MAX_GROWTH)
      }
      const factor = loadFactor()
      const large = timeRender(() => node(LARGE))
      if (growth !== false) {
        const small = timeRender(() => node(SMALL))
        expect(large / Math.max(small, NOISE_FLOOR_MS)).toBeLessThan(MAX_GROWTH)
      }
      expect(large).toBeLessThan(cap * factor)
    })
  }
})
