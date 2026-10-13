/**
 * The charts page's strip, composition, panel and sparkline groups: `BandStrip`, `MirroredBars`,
 * `StackedArea`, `Donut`, `Heatmap`, `DualPanel` and `Sparkline`, each on synthetic data shaped
 * like the production chart it was extracted from (`docs/waves/v2-chart-inventory.md`: l1, l7, l8
 * for the strips). Series colors are the playground's `demoColors` and `VX.*` — no literals.
 *
 * The strips and the panel pair opt into `tooltip.onFollow`, so scrubbing one reads its siblings.
 * Each group is a `?tab=` deep link (`charts-store.ts`).
 */
import { useMemo } from 'react'
import { SimpleGrid, Stack } from '@mantine/core'
import { Section, StatCard, StatGroup } from 'basalt-ui'
import {
  BandStrip,
  ChartCard,
  Donut,
  DualPanel,
  Heatmap,
  MirroredBars,
  Sparkline,
  StackedArea,
} from 'basalt-ui/charts'
import type {
  BandSpan,
  BandStripSeries,
  ChartTooltipRow,
  DualPanelLine,
  MirroredBarsSeries,
  StackedAreaBand,
} from 'basalt-ui/charts'
import { ViewTabs } from 'basalt-ui/controls'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { alpha, CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { chartViews } from './charts-store'
import {
  ACTIVITY,
  buildAvailability,
  buildLink,
  buildThroughput,
  FORECAST,
  HOURS,
  mergeAvailability,
  mergeLink,
  mergeThroughput,
  PLAN_REVENUE,
  SERVICES,
  SPARK_ACTIVE_USERS,
  SPARK_LOSS,
  TRAFFIC,
  TRAFFIC_CHANNELS,
  WEEKDAYS,
} from './chart-kinds-data'
import type {
  ActivityCell,
  AvailabilitySlot,
  ForecastPoint,
  LinkSlot,
  ServiceRow,
  ThroughputSlot,
  TrafficChannel,
  TrafficPoint,
} from './chart-kinds-data'
import { money, integer } from './fixtures/format'
import { demoColors } from './series'

const fmtClock = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const fmtStamp = (d: Date): string =>
  d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const fmtDay = (d: Date): string =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

// ── Strips ──────────────────────────────────────────────────────────────────────

/** Loss share at which a band is painted at full strength, and the ramp's floor. */
const FULL_INTENSITY_LOSS = 5
const LOSS_FLOOR = 0.34

const AVAILABILITY_STATES: BandStripSeries<AvailabilitySlot>[] = [
  {
    key: 'clean',
    label: 'No loss',
    color: VX.neutral,
    fillOpacity: 0.14,
    formatValue: (d) => `${d.cycles} cycles`,
  },
  {
    key: 'loss',
    label: 'Packet loss',
    color: VX.badSolid,
    fillOpacity: (LOSS_FLOOR + 1) / 2,
    formatValue: (d) => `${(d.lossPct ?? 0).toFixed(2)}%`,
  },
  {
    key: 'down',
    label: 'Every cycle down',
    color: VX.badSolid,
    formatValue: (d) => `${d.cyclesDown} of ${d.cycles} cycles`,
  },
  { key: 'absent', label: 'Not measured', color: VX.neutral },
]

function availabilityBand(d: AvailabilitySlot): BandSpan {
  if (d.lossPct === null) return { state: 'absent' }
  if (d.cycles > 0 && d.cyclesDown >= d.cycles) return { state: 'down' }
  if (d.lossPct <= 0) return { state: 'clean' }
  // The ramp lives INSIDE the `loss` state — never as a state of its own.
  const intensity = Math.min(1, d.lossPct / FULL_INTENSITY_LOSS)
  return { state: 'loss', fill: alpha(VX.badSolid, LOSS_FLOOR + (1 - LOSS_FLOOR) * intensity) }
}

const LINK_STATES: BandStripSeries<LinkSlot>[] = [
  {
    key: 'speed',
    label: 'Negotiated speed',
    color: VX.line,
    fillOpacity: 0.9,
    formatValue: (d) => `${d.mbit} Mbit`,
  },
  {
    key: 'transition',
    label: 'Renegotiated',
    color: VX.warnSolid,
    formatValue: (d) => `${d.mbit} Mbit after`,
  },
  { key: 'absent', label: 'Not measured', color: VX.neutral },
]

function linkBand(d: LinkSlot): BandSpan {
  if (d.mbit === null) return { state: 'absent' }
  if (d.renegotiated) return { state: 'speed', marker: { state: 'transition' } }
  // Intensity relative to the fastest rate the window saw — a property of the hardware, so a
  // `fill` inside one state and not a second state.
  return { state: 'speed', fill: alpha(VX.line, 0.25 + 0.65 * (d.mbit / 1000)) }
}

const THROUGHPUT_SERIES: MirroredBarsSeries<ThroughputSlot>[] = [
  { key: 'down', label: 'Download', color: VX.accent, getValue: (d) => d.downBytesPerS },
  { key: 'up', label: 'Upload', color: VX.line2, getValue: (d) => d.upBytesPerS },
  // Legend-only: a hatched bar is the one mark a reader cannot decode from either axis.
  { key: 'absent', label: 'Not measured', color: VX.neutral, getValue: () => null },
]

const fmtRate = (bytesPerS: number): string =>
  bytesPerS >= 1_000_000
    ? `${(bytesPerS / 1_000_000).toFixed(1)} MB/s`
    : `${Math.round(bytesPerS / 1000)} kB/s`

/** The basis of a rate, always — 2 measured intervals is a weaker claim than 20. */
function throughputRows(d: ThroughputSlot): ChartTooltipRow[] {
  const rows: ChartTooltipRow[] = [
    { label: 'Measured', value: `${d.intervals} interval${d.intervals === 1 ? '' : 's'}` },
  ]
  if (d.skipped > 0) {
    rows.push({ label: 'Understated', value: `${d.skipped} unplaceable`, color: VX.warnSolid })
  }
  if (d.foldedFrom > 1) {
    rows.push({
      label: 'Folded from',
      value:
        d.unmeasured > 0
          ? `${d.foldedFrom} buckets, ${d.unmeasured} not measured`
          : `${d.foldedFrom} buckets`,
    })
  }
  return rows
}

const stripHeader = (_: Date, d: { start: Date }): string => fmtStamp(d.start)

const AVAILABILITY_FOLD = { merge: mergeAvailability }
const LINK_FOLD = { merge: mergeLink }
const THROUGHPUT_FOLD = { merge: mergeThroughput }
const UP_PANE = { key: 'up', format: fmtRate, ticks: 2 }
const DOWN_PANE = { key: 'down', format: fmtRate, ticks: 3 }

export function StripsTab() {
  const [size] = chartViews.field.buckets.use()
  const count = Number(size)
  const availability = useMemo(() => buildAvailability(count), [count])
  const link = useMemo(() => buildLink(count), [count])
  const throughput = useMemo(() => buildThroughput(count), [count])

  return (
    <Section
      title="Strips"
      subtitle="One slot per bucket, absence drawn distinct from zero. Scrub or tab in and use ←/→ — all three share one cursor."
      tabs={<ViewTabs field={chartViews.field.buckets} label="Window" />}
    >
      <Stack gap="sm">
        <ChartCard
          title="Availability"
          subtitle="Loss per 5-minute bucket, unmeasured buckets marked"
          info="BandStrip: a clean bucket is neutral ink, loss is a ramp inside one state, and a bucket nothing measured is its own neutral state — three facts colour alone could not keep apart. At 288 buckets the strip folds (MAX, never the mean)."
        >
          <BandStrip<AvailabilitySlot, Date>
            data={availability}
            ariaLabel="Availability in 5-minute buckets, with unmeasured buckets marked"
            x={(d) => d.start}
            formatX={fmtClock}
            states={AVAILABILITY_STATES}
            getBand={availabilityBand}
            fold={AVAILABILITY_FOLD}
            height={110}
            tooltip={{ onFollow: true, formatHeader: stripHeader }}
          />
        </ChartCard>

        <ChartCard
          title="Negotiated link speed"
          subtitle="A renegotiation is marked, never averaged into a rate the NIC never ran at"
          info="BandStrip with an intensity fill relative to the fastest rate the window saw, and an inset marker for the transition — a fact that must not be read off the fill ramp."
        >
          <BandStrip<LinkSlot, Date>
            data={link}
            ariaLabel="Negotiated link speed in 5-minute buckets, renegotiations marked"
            x={(d) => d.start}
            formatX={fmtClock}
            states={LINK_STATES}
            getBand={linkBand}
            fold={LINK_FOLD}
            height={90}
            tooltip={{ onFollow: true, formatHeader: stripHeader }}
          />
        </ChartCard>

        <ChartCard
          title="Data carried"
          subtitle="What the line did carry — download below the baseline, upload above, each in its own scale"
          info="MirroredBars: each direction is scaled to its own maximum so the ratio stays legible. A bar that measured zero draws nothing; an absent share draws neutral across both panes. Click a legend entry to drop a pane whole — bars, axis and tooltip row together."
        >
          <MirroredBars<ThroughputSlot, Date>
            data={throughput}
            ariaLabel="Data carried per bucket — download below the baseline, upload above it"
            x={(d) => d.start}
            formatX={fmtClock}
            series={THROUGHPUT_SERIES}
            up={UP_PANE}
            down={DOWN_PANE}
            getAbsentFraction={(d) => d.unmeasured / d.foldedFrom}
            getBarOpacity={(d) => (d.skipped > 0 ? 0.45 : 1)}
            fold={THROUGHPUT_FOLD}
            height={220}
            tooltip={{ onFollow: true, formatHeader: stripHeader, rows: throughputRows }}
          />
        </ChartCard>
      </Stack>
    </Section>
  )
}

// ── Composition ─────────────────────────────────────────────────────────────────

const CHANNEL_COLOR: Record<TrafficChannel, string> = {
  organic: demoColors.sessions,
  paid: demoColors.revenue,
  referral: demoColors.signups,
  direct: demoColors.churn,
}

const TRAFFIC_BANDS: StackedAreaBand<TrafficPoint>[] = TRAFFIC_CHANNELS.map((key) => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1),
  color: CHANNEL_COLOR[key],
  getValue: (d) => d[key],
}))

const PLAN_COLOR: Record<string, string> = {
  team: demoColors.sessions,
  pro: demoColors.signups,
  enterprise: demoColors.revenue,
  starter: demoColors.churn,
  education: VX.accent,
  nonprofit: VX.line2,
}
const PLAN_TOTAL = PLAN_REVENUE.reduce((s, p) => s + p.value, 0)
const planLabel = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1)

const HEATMAP_TOOLTIP = {
  rows: (d: ActivityCell): ChartTooltipRow[] => [
    {
      label: `${d.day} ${d.hour}:00`,
      value: d.sessions === null ? 'Not measured' : `${integer(d.sessions)} sessions`,
    },
  ],
}

export function CompositionTab() {
  return (
    <Stack gap="sm">
      <ChartCard
        title="Traffic by channel"
        subtitle="Daily sessions, stacked bottom to top in series order"
        info="StackedArea: the y domain is the visible stack total, so a legend toggle shrinks the axis, and the tooltip lists the top band first, matching the plot."
      >
        <StackedArea<TrafficPoint, Date>
          data={TRAFFIC}
          ariaLabel="Daily sessions by acquisition channel, stacked, September 2026"
          x={(d) => d.day}
          formatX={fmtDay}
          series={TRAFFIC_BANDS}
          y={{ format: integer }}
          height={{ base: 200, regular: 260 }}
        />
      </ChartCard>

      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <ChartCard
          title="Revenue by plan"
          subtitle="Eight plans — the top six drawn, the rest folded into Other"
          info="Donut: at most six slices; the tail folds into a neutral Other. Every share is taken of ALL slices, so the legend and the tooltip never disagree. No cursor — a ring has no shared axis."
        >
          <Donut
            data={PLAN_REVENUE}
            ariaLabel="Revenue share by plan, September 2026"
            colorForKey={(key) => PLAN_COLOR[key] ?? VX.neutral}
            seriesLabel={planLabel}
            formatValue={money}
            centerLabel={money(PLAN_TOTAL)}
            centerSubLabel="Revenue"
            height={{ base: 220, regular: 240 }}
          />
        </ChartCard>

        <ChartCard
          title="Activity by weekday and hour"
          subtitle="Sessions per hour; Sunday 02–04 has no data and Wednesday 09 reported null"
          info="Heatmap: intensity is absolute (domain [0, max]), never each row's own range. A cell with no datum or a null value is absent — flat neutral, no hatch — not a zero."
        >
          <Heatmap<ActivityCell>
            data={ACTIVITY}
            ariaLabel="Sessions per hour by weekday, with unmeasured hours shown as absent"
            getRow={(d) => d.day}
            getCol={(d) => d.hour}
            getValue={(d) => d.sessions}
            rows={WEEKDAYS}
            cols={HOURS}
            color={demoColors.sessions}
            formatValue={integer}
            formatCol={(h) => (Number(h) % 3 === 0 ? h : '')}
            legend={{ label: 'Sessions / hour' }}
            tooltip={HEATMAP_TOOLTIP}
            height={{ base: 220, regular: 240 }}
          />
        </ChartCard>
      </SimpleGrid>
    </Stack>
  )
}

// ── Panels ──────────────────────────────────────────────────────────────────────

const FORECAST_LINES: DualPanelLine<ForecastPoint>[] = [
  {
    key: 'forecast',
    label: 'Forecast',
    color: VX.line,
    dash: 'dashed',
    getValue: (d) => d.forecast,
  },
  { key: 'actual', label: 'Actual', color: demoColors.sessions, getValue: (d) => d.actual },
]

const FORECAST_BAR = {
  label: 'Variance',
  getValue: (d: ForecastPoint) => d.actual - d.forecast,
  positive: VX.goodSolid,
  negative: VX.badSolid,
  format: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`,
  formatValue: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} k`,
}

const FORECAST_FILL = {
  from: 'forecast',
  to: 'actual',
  fill: alpha(VX.badSolid, 0.16),
  aboveFill: alpha(VX.goodSolid, 0.16),
}

export function PanelsTab() {
  return (
    <ChartCard
      title="Revenue vs forecast"
      subtitle="Line pane with the gap shaded; signed variance as bars underneath"
      info="DualPanel: one chart, one cursor, one tooltip, one legend. The top pane shades the band between two lines (green where actual runs above forecast, red below); the bottom pane draws the signed difference around zero, each pane in its own y domain."
    >
      <DualPanel<ForecastPoint, Date>
        data={FORECAST}
        ariaLabel="Daily revenue against forecast in $k, with signed variance, September 2026"
        x={(d) => d.day}
        formatX={fmtDay}
        series={FORECAST_LINES}
        top={{ format: (v) => `${v.toFixed(0)}` }}
        fillBetween={FORECAST_FILL}
        bar={FORECAST_BAR}
        height={{ base: 280, regular: 340 }}
        tooltip={{ onFollow: true }}
      />
    </ChartCard>
  )
}

// ── Sparklines ──────────────────────────────────────────────────────────────────

const col = createColumnHelper<ServiceRow>()

const SERVICE_COLUMNS = [
  col.accessor('name', { header: 'Service' }),
  col.accessor('region', { header: 'Region' }),
  col.display({
    id: 'rtt',
    header: 'RTT, last 10 min',
    cell: ({ row }) => (
      <Sparkline
        data={row.original.rtt}
        ariaLabel={`${row.original.name} round-trip time, last ten minutes`}
        height={22}
        width={96}
        color={demoColors.sessions}
        emphasizeLast
      />
    ),
  }),
  col.display({
    id: 'errors',
    header: 'Errors, last 10 min',
    cell: ({ row }) => (
      <Sparkline
        data={row.original.errors}
        ariaLabel={`${row.original.name} errors per minute, last ten minutes`}
        height={22}
        width={96}
        mark="bar"
        color={demoColors.churn}
      />
    ),
  }),
]

type SlotBox = { width: number; height: number }

function ActiveUsersSpark({ width, height }: SlotBox) {
  return (
    <Sparkline
      data={SPARK_ACTIVE_USERS}
      ariaLabel="Active users, last twelve weeks, rising"
      width={width}
      height={height}
      color={demoColors.sessions}
      emphasizeLast
    />
  )
}

function PacketLossSpark({ width, height }: SlotBox) {
  return (
    <Sparkline
      data={SPARK_LOSS}
      ariaLabel="Packet loss per interval, last twenty intervals"
      width={width}
      height={height}
      mark="bar"
      color={demoColors.churn}
    />
  )
}

export function SparklinesTab() {
  return (
    <Stack gap="sm">
      <Section
        title="In a StatCard slot"
        subtitle="The slot hands the render prop its measured box; a Sparkline with no width measures the container."
      >
        <StatGroup cols={2}>
          <StatCard title="Active users" value="1,483" delta={4.2} sparkline={ActiveUsersSpark} />
          <StatCard
            title="Packet loss"
            value="0.1%"
            sparklinePlacement="right"
            sparkline={PacketLossSpark}
          />
        </StatGroup>
      </Section>

      <Section
        title="In a table row"
        subtitle="A fixed-width line and a bar Sparkline per row — guide-free, so the cell stays a cell."
        count={SERVICES.length}
      >
        <BasaltDataTable data={SERVICES} columns={SERVICE_COLUMNS} striped />
      </Section>
    </Stack>
  )
}
