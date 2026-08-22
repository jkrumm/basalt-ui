/**
 * `BandStrip` — the 1-D categorical band strip.
 *
 * The shape `CartesianChart` cannot host: one rect per slot over a time axis with no y dimension
 * at all. Everything on this page comes from `series` — the legend, each band's fill, and the one
 * tooltip row — so the strip cannot draw a state the legend does not name, or name one it does not
 * draw.
 *
 * Three things worth scrubbing for:
 * - **Absence is a distinct mark, not a faint measurement.** The hatched share of a band is what
 *   nothing measured; a clean band is neutral ink. Widen the window past ~150 buckets and the fold
 *   kicks in — a partly-measured folded slot then draws part fill, part hatch, in proportion.
 * - **The ramp lives inside one state.** "Packet loss" is a single legend entry whose bands vary in
 *   strength via `getBand().fill`; the ramp cannot leak into a state of its own.
 * - **The renegotiation marker cannot be read off the ramp.** The link strip's `marker` draws an
 *   inset bar in a colour the legend already carries.
 *
 * Both strips share a cursor with each other and with every other chart on the page — no provider,
 * `cursorResolution` defaults to `'leading'` because a band IS a span keyed by its leading edge.
 */
import { useMemo, useState } from 'react'
import { SegmentedControl, Stack, Text } from '@mantine/core'
import { alpha, BandStrip, ChartCard, VX } from 'basalt-ui/charts'
import type { BandSpan, BandStripSeries } from 'basalt-ui/charts'

const BUCKET_MINUTES = 5
const WINDOW_START = Date.UTC(2026, 7, 20, 0, 0, 0)

/** Deterministic pseudo-random so the page is stable across reloads. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

type Slot = {
  key: string
  start: number
  /** null = the collector reported nothing for this bucket. */
  lossPct: number | null
  cyclesDown: number
  cycles: number
  /** How many source buckets this drawn slot stands for, and how many of those measured nothing. */
  foldedFrom: number
  unmeasured: number
}

function buildSlots(count: number): Slot[] {
  return Array.from({ length: count }, (_, i) => {
    const start = WINDOW_START + i * BUCKET_MINUTES * 60_000
    const r = rand(i + 1)
    // Two coverage gaps and one outage, so the three non-clean states are all reachable.
    const gap = (i > 61 && i < 74) || (i > 190 && i < 197)
    const outage = i > 128 && i < 133
    const lossPct = gap ? null : outage ? 100 : r > 0.93 ? Number((r * 8).toFixed(2)) : 0
    return {
      key: new Date(start).toISOString(),
      start,
      lossPct,
      cyclesDown: outage ? 10 : 0,
      cycles: gap ? 0 : 10,
      foldedFrom: 1,
      unmeasured: lossPct === null ? 1 : 0,
    }
  })
}

const fmtClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** Loss share at which a band is painted at full strength. */
const FULL_INTENSITY_LOSS = 5
const LOSS_FLOOR = 0.34

const AVAILABILITY_SERIES: BandStripSeries<Slot>[] = [
  {
    key: 'clean',
    label: 'No loss',
    color: VX.neutral,
    mark: 'bar',
    fillOpacity: 0.14,
    formatValue: (d) => `${d.cycles} cycles`,
  },
  {
    key: 'loss',
    label: 'Packet loss',
    color: VX.badSolid,
    mark: 'bar',
    fillOpacity: (LOSS_FLOOR + 1) / 2,
    formatValue: (d) => `${(d.lossPct ?? 0).toFixed(2)}%`,
  },
  {
    key: 'down',
    label: 'Every cycle down',
    color: VX.badSolid,
    mark: 'bar',
    fillOpacity: 1,
    formatValue: (d) => `${d.cyclesDown} of ${d.cycles} cycles`,
  },
  { key: 'absent', label: 'Not measured', color: VX.neutral, mark: 'bar', fillOpacity: 0.5 },
]

function availabilityBand(d: Slot): BandSpan {
  const absentFraction = d.unmeasured / d.foldedFrom
  if (d.lossPct === null) return { state: 'absent' }
  if (d.cycles > 0 && d.cyclesDown >= d.cycles) return { state: 'down', absentFraction }
  if (d.lossPct <= 0) return { state: 'clean', absentFraction }
  // The ramp lives INSIDE the `loss` state — never as a state of its own.
  const intensity = Math.min(1, d.lossPct / FULL_INTENSITY_LOSS)
  return {
    state: 'loss',
    fill: alpha(VX.badSolid, LOSS_FLOOR + (1 - LOSS_FLOOR) * intensity),
    absentFraction,
  }
}

/** MAX, never the mean — averaging a fully-down bucket into its clean neighbours describes a
 * bucket that never happened. */
function mergeSlots(group: Slot[]): Slot {
  const measured = group.filter((g) => g.lossPct !== null)
  const first = group[0] as Slot
  return {
    ...first,
    lossPct: measured.length === 0 ? null : Math.max(...measured.map((g) => g.lossPct ?? 0)),
    cyclesDown: measured.reduce((sum, g) => sum + g.cyclesDown, 0),
    cycles: measured.reduce((sum, g) => sum + g.cycles, 0),
    foldedFrom: group.length,
    unmeasured: group.length - measured.length,
  }
}

type LinkSlot = { key: string; start: number; mbit: number | null; renegotiated: boolean }

const LINK_SERIES: BandStripSeries<LinkSlot>[] = [
  {
    key: 'speed',
    label: 'Negotiated speed',
    color: VX.line,
    mark: 'bar',
    fillOpacity: 0.9,
    formatValue: (d) => `${d.mbit} Mbit`,
  },
  {
    key: 'transition',
    label: 'Renegotiated',
    color: VX.warnSolid,
    mark: 'bar',
    fillOpacity: 1,
    formatValue: (d) => `${d.mbit} Mbit after`,
  },
  { key: 'absent', label: 'Not measured', color: VX.neutral, mark: 'bar', fillOpacity: 0.5 },
]

function buildLink(count: number): LinkSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const start = WINDOW_START + i * BUCKET_MINUTES * 60_000
    const gap = i > 61 && i < 74
    const renegotiated = i === 96 || i === 174
    return {
      key: new Date(start).toISOString(),
      start,
      mbit: gap ? null : i < 96 || i >= 174 ? 1000 : 100,
      renegotiated,
    }
  })
}

function linkBand(d: LinkSlot): BandSpan {
  if (d.mbit === null) return { state: 'absent' }
  if (d.renegotiated) return { state: 'transition', marker: { state: 'transition' } }
  // Intensity relative to the fastest speed the window saw — a property of the hardware, not of
  // the chart, which is why it is a `fill` and not a second state.
  return { state: 'speed', fill: alpha(VX.line, 0.25 + 0.65 * (d.mbit / 1000)) }
}

export function BandStripDemoPage() {
  const [size, setSize] = useState('288')
  const count = Number(size)
  const slots = useMemo(() => buildSlots(count), [count])
  const link = useMemo(() => buildLink(count), [count])

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          One rect per slot, no y axis at all. Scrub with the pointer or tab in and use ←/→ — both
          strips and every other chart on the page share one cursor with no provider.
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
        title="Availability"
        subtitle="Loss per 5-minute bucket, with unmeasured buckets hatched"
        tooltip="A clean bucket is neutral ink, loss is a ramp inside one state, and a bucket nothing measured is hatched — three facts colour alone could not keep apart."
      >
        <BandStrip<Slot>
          data={slots}
          chartId="pg-availability-strip"
          getX={(d) => d.key}
          series={AVAILABILITY_SERIES}
          getBand={availabilityBand}
          formatX={fmtClock}
          fold={{ merge: mergeSlots }}
          absentState="absent"
          height={110}
          ariaLabel="Availability in 5-minute buckets, with unmeasured buckets marked"
          legend={{ toggle: false }}
          tooltip={{
            onFollow: true,
            formatHeader: (key) => new Date(key).toLocaleString(),
            label: (d) => ({
              text: d.foldedFrom > 1 ? `${d.foldedFrom} buckets` : '1 bucket',
              color: VX.legendText,
            }),
          }}
        />
      </ChartCard>

      <ChartCard
        title="Negotiated link speed"
        subtitle="A renegotiation is MARKED, never averaged into a rate the NIC never ran at"
        tooltip="Speed intensity is relative to the fastest rate the window saw. A bucket holding two speeds gets an inset marker instead of their mean."
      >
        <BandStrip<LinkSlot>
          data={link}
          chartId="pg-link-strip"
          getX={(d) => d.key}
          series={LINK_SERIES}
          getBand={linkBand}
          formatX={fmtClock}
          absentState="absent"
          height={110}
          ariaLabel="Negotiated link speed per bucket"
          legend={{ toggle: false }}
          tooltip={{ onFollow: true, formatHeader: (key) => new Date(key).toLocaleString() }}
        />
      </ChartCard>
    </Stack>
  )
}
