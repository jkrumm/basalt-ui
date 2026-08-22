/**
 * `MirroredBars` — two bar panes over one x scale, independent domains, one shared baseline.
 *
 * The blocker was never "two scales" — `DualPanel` already gives each pane its own y domain. It is
 * that `DualPanel`'s top pane is a LINE pane and its bottom takes ONE signed `getBar`. Here both
 * panes are bars, each with its own accessor and its own axis, because a 12 MB/s download and a
 * 900 kB/s upload are two readings rather than `+12` and `−0.9` of one — and on a shared scale the
 * upload, the half that actually explains a stalled call, flattens onto the baseline.
 *
 * Worth scrubbing for:
 * - **Two axes, two unit scales.** The up axis tops out at the upload's own maximum. Toggle
 *   "Upload" in the legend and its bars, its axis and its tooltip row leave together.
 * - **Absence spans BOTH panes.** A hatch on the download half alone would read as "downloaded
 *   nothing, uploaded nothing" — the measured-and-idle state this has to stay distinct from.
 * - **A qualified measurement is dimmed, not hidden.** `getBarOpacity` marks a bucket that
 *   measured only part of its span; it is a real reading, just a short one.
 */
import { useMemo, useState } from 'react'
import { SegmentedControl, Stack, Text } from '@mantine/core'
import { ChartCard, MirroredBars, TooltipRow, VX } from 'basalt-ui/charts'
import type { ChartSeries } from 'basalt-ui/charts'

const BUCKET_MINUTES = 5
const WINDOW_START = Date.UTC(2026, 7, 20, 0, 0, 0)

function rand(seed: number): number {
  const x = Math.sin(seed * 7.3319) * 24634.6345
  return x - Math.floor(x)
}

type Point = {
  key: string
  downBytesPerS: number | null
  upBytesPerS: number | null
  intervals: number
  skipped: number
  foldedFrom: number
  unmeasured: number
}

function buildPoints(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const start = WINDOW_START + i * BUCKET_MINUTES * 60_000
    const gap = (i > 61 && i < 74) || (i > 210 && i < 216)
    const r = rand(i + 1)
    const evening = i > 200 ? 3 : 1
    return {
      key: new Date(start).toISOString(),
      downBytesPerS: gap ? null : Math.round(r * 2_400_000 * evening),
      upBytesPerS: gap ? null : Math.round(rand(i + 999) * 180_000 * evening),
      intervals: gap ? 0 : 20,
      skipped: !gap && r > 0.9 ? 4 : 0,
      foldedFrom: 1,
      unmeasured: gap ? 1 : 0,
    }
  })
}

const fmtRate = (bytesPerS: number): string =>
  bytesPerS >= 1_000_000
    ? `${(bytesPerS / 1_000_000).toFixed(1)} MB/s`
    : `${Math.round(bytesPerS / 1000)} kB/s`

const fmtClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/**
 * "Not measured" is a series in the LEGEND's sense and not in the data's — it has no values, only
 * an absence, hence `getValue: () => null`. It has to be named all the same: a hatched bar is the
 * one mark on this chart a reader cannot decode from either axis.
 */
const THROUGHPUT_SERIES: ChartSeries<Point>[] = [
  {
    key: 'down',
    label: 'Download',
    color: VX.accent,
    mark: 'bar',
    getValue: (d) => d.downBytesPerS,
  },
  { key: 'up', label: 'Upload', color: VX.line2, mark: 'bar', getValue: (d) => d.upBytesPerS },
  { key: 'absent', label: 'Not measured', color: VX.neutral, mark: 'bar', getValue: () => null },
]

/** SUM, then recompute the rate from summed bytes over summed measured time — never the mean of
 * per-slot rates, which divides by the wrong denominator. */
function mergePoints(group: Point[]): Point {
  const measured = group.filter((p) => p.downBytesPerS !== null)
  const first = group[0] as Point
  const intervals = measured.reduce((sum, p) => sum + p.intervals, 0)
  const mean = (pick: (p: Point) => number | null): number | null => {
    if (intervals === 0) return null
    const total = measured.reduce((sum, p) => sum + (pick(p) ?? 0) * p.intervals, 0)
    return total / intervals
  }
  return {
    ...first,
    downBytesPerS: mean((p) => p.downBytesPerS),
    upBytesPerS: mean((p) => p.upBytesPerS),
    intervals,
    skipped: measured.reduce((sum, p) => sum + p.skipped, 0),
    foldedFrom: group.length,
    unmeasured: group.length - measured.length,
  }
}

/**
 * The basis, always — the rate is bytes over MEASURED time, and a slot that measured 2 of 20
 * intervals is a weaker claim than one that measured all 20. Additive rows only: the two pane rows
 * above them stay derived from `series`.
 */
function throughputExtraRows(d: Point) {
  return (
    <>
      <TooltipRow
        color={VX.neutral}
        shape="bar"
        label="Measured"
        value={`${d.intervals} interval${d.intervals === 1 ? '' : 's'}`}
      />
      {d.skipped > 0 && (
        <TooltipRow
          color={VX.warnSolid}
          shape="dot"
          label="Understated"
          value={`${d.skipped} unplaceable`}
        />
      )}
      {d.foldedFrom > 1 && (
        <TooltipRow
          color={VX.neutral}
          shape="bar"
          label="Folded from"
          value={
            d.unmeasured > 0
              ? `${d.foldedFrom} buckets, ${d.unmeasured} not measured`
              : `${d.foldedFrom} buckets`
          }
        />
      )}
    </>
  )
}

export function MirroredBarsDemoPage() {
  const [size, setSize] = useState('288')
  const count = Number(size)
  const points = useMemo(() => buildPoints(count), [count])

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Download below the baseline, upload above it, each scaled to its own maximum. Click a
          legend entry to drop a pane whole — bars, axis and tooltip row together.
        </Text>
        <SegmentedControl
          value={size}
          onChange={setSize}
          data={[
            { value: '48', label: '48 buckets (unfolded)' },
            { value: '144', label: '144 buckets' },
            { value: '288', label: '288 buckets (folds)' },
          ]}
        />
      </Stack>

      <ChartCard
        title="Data carried"
        subtitle="What the line DID carry — not what it can, which is a different chart"
        tooltip="Each direction is scaled to its own maximum, so the ratio stays legible. A quiet night reads near zero here and says nothing about capacity."
      >
        <MirroredBars<Point>
          data={points}
          chartId="pg-throughput"
          getX={(d) => d.key}
          series={THROUGHPUT_SERIES}
          up={{ key: 'up', format: fmtRate, ticks: 2 }}
          down={{ key: 'down', format: fmtRate, ticks: 3 }}
          getAbsentFraction={(d) => d.unmeasured / d.foldedFrom}
          getBarOpacity={(d) => (d.skipped > 0 ? 0.45 : 1)}
          formatX={fmtClock}
          fold={{ merge: mergePoints }}
          absentState="absent"
          height={220}
          ariaLabel="Data carried per bucket — download below the baseline, upload above it"
          legend={{ toggle: true }}
          tooltip={{
            onFollow: true,
            formatHeader: (key) => new Date(key).toLocaleString(),
            extraRows: throughputExtraRows,
          }}
        />
      </ChartCard>
    </Stack>
  )
}
