/**
 * Compile-time proof that `xLabelRotate` is a CARTESIAN prop, not a chart-wide one.
 *
 * `CartesianChart` and every kind that composes it take `xLabelRotate?: 0 | 45 | 90`, and the phone
 * tier auto-rotates an unset one (`docs/CHARTS-SPEC.md` §8). The two band kinds are the declared
 * `basalt/hand-rolled-plot` exceptions: they assemble their axis through `useBandPlot`, which owns
 * the gutters but paints no rotation, so accepting the prop would be a prop that silently does
 * nothing. That absence is now a tsc error rather than a fact a reader has to infer from the
 * type — which matters most for the kind PAIR, since `BandStrip` and `MirroredBars` otherwise take
 * the same `formatX` / `xTickValues` / `margin` seams their Cartesian siblings do.
 *
 * Same convention as `controls/actions.type-guard.test.ts`: one `@ts-expect-error` per bad line,
 * proven by `tsc --noEmit`, and a `.test.ts` name so tsup's build glob does not ship the fixture.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartSeries, SeriesStyle } from '../series'
import type { BandStripProps } from './BandStrip'
import type { MirroredBarsProps } from './MirroredBars'
import type { StackedAreaProps } from './StackedArea'

type Row = { key: string; v: number }

const BAND_SERIES: SeriesStyle[] = [{ key: 'ok', label: 'Up', color: '#0a0', mark: 'bar' }]
const SERIES: ChartSeries<Row>[] = [
  { key: 'v', label: 'v', color: '#0a0', mark: 'bar', getValue: (d) => d.v },
]

function acceptStrip(props: BandStripProps<Row>): BandStripProps<Row> {
  return props
}

function acceptMirrored(props: MirroredBarsProps<Row>): MirroredBarsProps<Row> {
  return props
}

function acceptStacked(props: StackedAreaProps<Row>): StackedAreaProps<Row> {
  return props
}

const strip = {
  data: [] as Row[],
  chartId: 'strip',
  getX: (d: Row) => d.key,
  series: BAND_SERIES,
  getBand: () => ({ state: 'ok' }),
}

const mirrored = {
  data: [] as Row[],
  chartId: 'mirror',
  getX: (d: Row) => d.key,
  series: SERIES,
  up: { key: 'v', format: (v: number) => `${v}` },
  down: { key: 'v', format: (v: number) => `${v}` },
}

// ── Valid — the seams a band kind DOES share with its Cartesian siblings ──────

acceptStrip({ ...strip, formatX: (key) => key, margin: { left: 0 } })
acceptMirrored({ ...mirrored, formatX: (key) => key, margin: { right: 0 } })
// A CartesianChart-composing kind takes it, including the `0` opt-out.
acceptStacked({ data: [], chartId: 's', getX: (d) => d.key, series: SERIES, xLabelRotate: 0 })
acceptStacked({ data: [], chartId: 's', getX: (d) => d.key, series: SERIES, xLabelRotate: 90 })

// ── Invalid — each MUST be a tsc error, one directive per bad line ────────────

// @ts-expect-error — BandStrip paints through `useBandPlot`, which never rotates a tick label.
acceptStrip({ ...strip, xLabelRotate: 45 })
// @ts-expect-error — nor does MirroredBars, for the same reason.
acceptMirrored({ ...mirrored, xLabelRotate: 45 })
// @ts-expect-error — not even the documented `0` opt-out: there is nothing to opt out of.
acceptStrip({ ...strip, xLabelRotate: 0 })
// @ts-expect-error — and 90 is no more supported than 45.
acceptMirrored({ ...mirrored, xLabelRotate: 90 })
// @ts-expect-error — the Cartesian union itself is still closed to an arbitrary angle.
acceptStacked({ data: [], chartId: 's', getX: (d) => d.key, series: SERIES, xLabelRotate: 30 })

describe('xLabelRotate is a Cartesian prop', () => {
  test('the proof is the tsc run — this only keeps the file in the suite', () => {
    expect(typeof acceptStrip).toBe('function')
  })
})
