/**
 * The gallery's chart sections: one short, deterministic block per chart kind (`Lines`, `Bars`,
 * `CartesianChart` with consumer marks, `BandStrip`, `MirroredBars`, `StackedArea`, `Donut`,
 * `Heatmap`, `DualPanel`, `Sparkline`). Every date-keyed chart shares the default cursor with no
 * wiring. Series colors are the playground's `demoColors` and `VX.*` — no literals.
 */
import { SimpleGrid, Stack } from '@mantine/core'
import { areaY } from '@tanstack/charts/area'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { Section, StatCard } from 'basalt-ui'
import {
  Bars,
  BandStrip,
  CartesianChart,
  ChartCard,
  Donut,
  DualPanel,
  Heatmap,
  Lines,
  MirroredBars,
  Sparkline,
  StackedArea,
} from 'basalt-ui/charts'
import type {
  BandSpan,
  BandStripSeries,
  BarsBar,
  ChartSeries,
  DualPanelLine,
  MirroredBarsSeries,
  PlotContext,
} from 'basalt-ui/charts'
import { date, time } from 'basalt-ui/format'
import { alpha, CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { integer, money } from '../fixtures/format'
import { demoColors } from '../series'
import { SeamSection } from './seam'

const fmtClock = (d: Date): string => time(d, { format: 'short', timeZone: 'UTC' })
const fmtStamp = (d: Date): string => `${date(d, { timeZone: 'UTC' })}, ${fmtClock(d)}`
const fmtDay = (d: Date): string =>
  d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const fmtSigned = (v: number): string => `${v > 0 ? '+' : ''}${Math.round(v)}`
const day = (i: number, month = 2): Date => new Date(Date.UTC(2026, month, 1 + i))
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Deterministic pseudo-random in [0, 1): the page renders identically on every reload. */
function rand(seed: number, salt = 12.9898): number {
  const x = Math.sin(seed * salt) * 43758.5453
  return x - Math.floor(x)
}

const GRID_COLS = { base: 1, [CONTAINER_KEYS.regular]: 2 }

// ── Daily series: 14 days (Mar 01–14) shared by the cartesian charts ────────────────────────────

type Daily = {
  day: Date
  sessions: number
  health: number
  acute: number
  chronic: number
}

const SESSIONS = [820, 910, 870, 1040, 1180, 760, 690, 1220, 1310, 1280, 1390, 1450, 980, 1010]
const HEALTH = [62, 68, 64, 74, 81, 52, 47, 84, 88, 86, 91, 94, 71, 73]
const ACUTE = [48, 55, 60, 52, 46, 58, 66, 70, 64, 55, 50, 62, 68, 58]
const CHRONIC = [50, 51, 52, 52, 53, 54, 55, 57, 58, 58, 57, 58, 60, 60]

const DAILY: Daily[] = SESSIONS.map((sessions, i) => ({
  day: day(i),
  sessions,
  health: HEALTH[i] ?? 0,
  acute: ACUTE[i] ?? 0,
  chronic: CHRONIC[i] ?? 0,
}))

const HEALTH_SERIES: ChartSeries<Daily>[] = [
  {
    key: 'health',
    label: 'Health',
    color: demoColors.sessions,
    area: true,
    getValue: (d) => d.health,
  },
]

const HEALTH_ZONES = [
  { from: 0, to: 50, fill: alpha(VX.badSolid, 0.1) },
  { from: 50, to: 75, fill: alpha(VX.warnSolid, 0.1) },
  { from: 75, to: 100, fill: alpha(VX.goodSolid, 0.1) },
]

const LOAD_SERIES: ChartSeries<Daily>[] = [
  { key: 'acute', label: 'Acute (7d)', color: demoColors.sessions, getValue: (d) => d.acute },
  {
    key: 'chronic',
    label: 'Chronic (28d)',
    color: VX.line,
    dash: 'dashed',
    getValue: (d) => d.chronic,
  },
]

/** An `areaY` band between the two lines under their strokes; it follows the legend toggles. */
function loadMarks(plot: PlotContext<Daily, Date>) {
  const acute = plot.rows('acute')
  const band =
    acute.length > 0 && plot.rows('chronic').length > 0
      ? [
          decorative(
            areaY(acute, {
              id: 'load-gap',
              x: 'x',
              y1: (row) => row.datum.chronic,
              y2: 'y',
              fill: alpha(demoColors.sessions, 0.1),
            }),
          ),
        ]
      : []
  const lines = plot.visible.map((s) =>
    lineY(plot.rows(s.key), {
      id: s.key,
      x: 'x',
      y: 'y',
      z: 'series',
      stroke: s.color,
      strokeWidth: VX.lineWidth,
      ...(s.dash === 'dashed' && { strokeDasharray: VX.dashArray }),
    }),
  )
  return [...band, ...lines]
}

const DIVERGENCE_BARS: BarsBar<Daily>[] = [
  {
    key: 'building',
    label: 'Building',
    color: VX.goodSolid,
    getValue: (d) => (d.acute > d.chronic ? d.acute - d.chronic : null),
    formatValue: fmtSigned,
  },
  {
    key: 'recovering',
    label: 'Recovering',
    color: VX.warnSolid,
    getValue: (d) => (d.acute < d.chronic ? d.acute - d.chronic : null),
    formatValue: fmtSigned,
  },
]

export function CartesianSection() {
  return (
    <Section
      title="Lines, Bars and CartesianChart"
      subtitle="Every chart shares one cursor with no provider: scrub with the pointer or ←/→, click a legend entry to hide a series."
    >
      <Stack gap="sm">
        <ChartCard
          title="Health score"
          subtitle="Zones, a target threshold and a reference line"
          info="Lines with zones, thresholds and refLines. tooltip.onFollow renders this chart's tooltip when a sibling owns the cursor."
        >
          <Lines<Daily, Date>
            data={DAILY}
            ariaLabel="Health score trend, 0 to 100, March 1 to 14"
            x={(d) => d.day}
            formatX={fmtDay}
            series={HEALTH_SERIES}
            y={{ domain: [0, 100], format: (v) => `${Math.round(v)}` }}
            zones={HEALTH_ZONES}
            thresholds={[{ value: 80, side: 'above', fill: alpha(VX.goodSolid, 0.14) }]}
            refLines={[{ value: 80, color: VX.goodRef, dashed: true }]}
            tooltip={{ onFollow: true }}
          />
        </ChartCard>
        <SimpleGrid type="container" cols={GRID_COLS}>
          <ChartCard
            title="Training load"
            subtitle="Acute vs chronic, the gap shaded"
            info="CartesianChart with consumer marks: an areaY band under two lineY strokes."
          >
            <CartesianChart<Daily, Date>
              data={DAILY}
              ariaLabel="Acute versus chronic training load, March 1 to 14"
              x={(d) => d.day}
              formatX={fmtDay}
              series={LOAD_SERIES}
              marks={loadMarks}
              tooltip={{ onFollow: true }}
            />
          </ChartCard>
          <ChartCard
            title="Load divergence"
            subtitle="Acute − chronic, signed"
            info="Bars with a signed pair: the stack diverges around zero."
          >
            <Bars<Daily, Date>
              data={DAILY}
              ariaLabel="Acute minus chronic training load, March 1 to 14"
              x={(d) => d.day}
              formatX={fmtDay}
              bars={DIVERGENCE_BARS}
              y={{ format: fmtSigned }}
            />
          </ChartCard>
        </SimpleGrid>
      </Stack>
    </Section>
  )
}

// ── Strips: one slot per 5-minute bucket, absence drawn distinct from zero ──────────────────────

const SLOTS = 96
const PERIOD = 48
const slotStart = (i: number): Date => new Date(Date.UTC(2026, 7, 20) + i * 300_000)
const inPhase = (i: number, from: number, to: number): boolean => {
  const p = i % PERIOD
  return p >= from && p <= to
}

type AvailabilitySlot = { start: Date; lossPct: number | null; down: boolean }
type ThroughputSlot = { start: Date; down: number | null; up: number | null }

const AVAILABILITY: AvailabilitySlot[] = Array.from({ length: SLOTS }, (_, i) => {
  const r = rand(i + 1)
  return {
    start: slotStart(i),
    lossPct: inPhase(i, 10, 15) ? null : inPhase(i, 22, 24) ? 100 : r > 0.93 ? r * 8 : 0,
    down: inPhase(i, 22, 24),
  }
})

const THROUGHPUT: ThroughputSlot[] = Array.from({ length: SLOTS }, (_, i) => {
  const gap = inPhase(i, 10, 15)
  const boost = i % PERIOD >= 36 ? 3 : 1
  return {
    start: slotStart(i),
    down: gap ? null : Math.round(rand(i + 1, 7.33) * 2_400_000 * boost),
    up: gap ? null : Math.round(rand(i + 999, 7.33) * 180_000 * boost),
  }
})

const AVAILABILITY_STATES: BandStripSeries<AvailabilitySlot>[] = [
  { key: 'clean', label: 'No loss', color: VX.neutral, fillOpacity: 0.14 },
  {
    key: 'loss',
    label: 'Packet loss',
    color: VX.badSolid,
    formatValue: (d) => `${(d.lossPct ?? 0).toFixed(2)}%`,
  },
  { key: 'down', label: 'Every cycle down', color: VX.badSolid },
  { key: 'absent', label: 'Not measured', color: VX.neutral },
]

function availabilityBand(d: AvailabilitySlot): BandSpan {
  if (d.lossPct === null) return { state: 'absent' }
  if (d.down) return { state: 'down' }
  if (d.lossPct <= 0) return { state: 'clean' }
  // The ramp lives INSIDE the `loss` state, never as a state of its own.
  return { state: 'loss', fill: alpha(VX.badSolid, 0.34 + 0.66 * Math.min(1, d.lossPct / 5)) }
}

const THROUGHPUT_SERIES: MirroredBarsSeries<ThroughputSlot>[] = [
  { key: 'down', label: 'Download', color: VX.accent, getValue: (d) => d.down },
  { key: 'up', label: 'Upload', color: VX.line2, getValue: (d) => d.up },
  { key: 'absent', label: 'Not measured', color: VX.neutral, getValue: () => null },
]

const fmtRate = (bytesPerS: number): string =>
  bytesPerS >= 1_000_000
    ? `${(bytesPerS / 1_000_000).toFixed(1)} MB/s`
    : `${Math.round(bytesPerS / 1000)} kB/s`

const stripHeader = (_: Date, d: { start: Date }): string => fmtStamp(d.start)
const STRIP_TOOLTIP = { onFollow: true, formatHeader: stripHeader }

export function StripsSection() {
  return (
    <Section
      title="Strips"
      subtitle="BandStrip and MirroredBars: one slot per bucket, absence drawn distinct from zero. All three share one cursor."
    >
      <Stack gap="sm">
        <ChartCard
          title="Availability"
          subtitle="Loss per 5-minute bucket, unmeasured buckets marked"
        >
          <BandStrip<AvailabilitySlot, Date>
            data={AVAILABILITY}
            ariaLabel="Availability in 5-minute buckets, with unmeasured buckets marked"
            x={(d) => d.start}
            formatX={fmtClock}
            states={AVAILABILITY_STATES}
            getBand={availabilityBand}
            height={90}
            tooltip={STRIP_TOOLTIP}
          />
        </ChartCard>
        <ChartCard
          title="Data carried"
          subtitle="Download below the baseline, upload above, each in its own scale"
        >
          <MirroredBars<ThroughputSlot, Date>
            data={THROUGHPUT}
            ariaLabel="Data carried per bucket, download below the baseline and upload above it"
            x={(d) => d.start}
            formatX={fmtClock}
            series={THROUGHPUT_SERIES}
            up={{ key: 'up', format: fmtRate, ticks: 2 }}
            down={{ key: 'down', format: fmtRate, ticks: 3 }}
            height={200}
            tooltip={STRIP_TOOLTIP}
          />
        </ChartCard>
      </Stack>
    </Section>
  )
}

// ── Composition and panels ──────────────────────────────────────────────────────────────────────

const TRAFFIC_CHANNELS = ['organic', 'paid', 'referral', 'direct'] as const
const TRAFFIC_BASE = { organic: 620, paid: 280, referral: 150, direct: 210 }
const TRAFFIC_COLOR = {
  organic: demoColors.sessions,
  paid: demoColors.revenue,
  referral: demoColors.signups,
  direct: demoColors.churn,
}

type TrafficPoint = { day: Date } & Record<(typeof TRAFFIC_CHANNELS)[number], number>

const TRAFFIC: TrafficPoint[] = Array.from({ length: 30 }, (_, i) => {
  const point = { day: day(i, 8) } as TrafficPoint
  for (const [n, key] of TRAFFIC_CHANNELS.entries()) {
    const weekday = i % 7 < 5 ? 1 : 0.62
    point[key] = Math.round(TRAFFIC_BASE[key] * weekday * (0.9 + rand(i * 4 + n, 3.1) * 0.2))
  }
  return point
})

const PLAN_REVENUE = [
  { key: 'team', value: 48_200 },
  { key: 'pro', value: 31_900 },
  { key: 'enterprise', value: 22_400 },
  { key: 'starter', value: 9_600 },
  { key: 'education', value: 4_100 },
  { key: 'nonprofit', value: 2_300 },
  { key: 'legacy', value: 1_450 },
  { key: 'trial', value: 820 },
]
const PLAN_COLOR: Record<string, string> = {
  team: demoColors.sessions,
  pro: demoColors.signups,
  enterprise: demoColors.revenue,
  starter: demoColors.churn,
  education: VX.accent,
  nonprofit: VX.line2,
}
const PLAN_TOTAL = PLAN_REVENUE.reduce((s, p) => s + p.value, 0)

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
type ActivityCell = { day: string; hour: string; sessions: number | null }

/** Sunday 02–04 has no data and Wednesday 09 is a measured null: both read as absent, not zero. */
const ACTIVITY: ActivityCell[] = WEEKDAYS.flatMap((d, di) =>
  HOURS.flatMap((hour, h): ActivityCell[] => {
    if (d === 'Sun' && h >= 2 && h <= 4) return []
    if (d === 'Wed' && h === 9) return [{ day: d, hour, sessions: null }]
    const work =
      di < 5 ? Math.exp(-(((h - 13) / 4.5) ** 2)) : 0.25 * Math.exp(-(((h - 15) / 5) ** 2))
    const sessions = Math.round(8 + work * 140 * (0.85 + rand(di * 24 + h, 5.7) * 0.3))
    return [{ day: d, hour, sessions }]
  }),
)

type ForecastPoint = { day: Date; actual: number; forecast: number }

const FORECAST: ForecastPoint[] = Array.from({ length: 30 }, (_, i) => {
  const forecast = 118 + i * 0.9 + Math.sin(i / 3.2) * 6
  return {
    day: day(i, 8),
    forecast: Number(forecast.toFixed(1)),
    actual: Number((forecast + Math.sin(i / 1.9) * 9 + (rand(i, 8.1) - 0.5) * 6).toFixed(1)),
  }
})

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

export function CompositionSection() {
  return (
    <Section
      title="Composition and panels"
      subtitle="StackedArea, Donut, Heatmap and DualPanel on synthetic September data."
    >
      <Stack gap="sm">
        <ChartCard title="Traffic by channel" subtitle="Daily sessions, stacked in series order">
          <StackedArea<TrafficPoint, Date>
            data={TRAFFIC}
            ariaLabel="Daily sessions by acquisition channel, stacked, September 2026"
            x={(d) => d.day}
            formatX={fmtDay}
            series={TRAFFIC_CHANNELS.map((key) => ({
              key,
              label: capitalize(key),
              color: TRAFFIC_COLOR[key],
              getValue: (d: TrafficPoint) => d[key],
            }))}
            y={{ format: integer }}
            height={{ base: 200, regular: 260 }}
          />
        </ChartCard>
        <SimpleGrid type="container" cols={GRID_COLS}>
          <ChartCard
            title="Revenue by plan"
            subtitle="The top six drawn, the rest folded into Other"
          >
            <Donut
              data={PLAN_REVENUE}
              ariaLabel="Revenue share by plan, September 2026"
              colorForKey={(key) => PLAN_COLOR[key] ?? VX.neutral}
              seriesLabel={capitalize}
              formatValue={money}
              centerLabel={money(PLAN_TOTAL)}
              centerSubLabel="Revenue"
              height={{ base: 220, regular: 240 }}
            />
          </ChartCard>
          <ChartCard
            title="Activity by weekday and hour"
            subtitle="Missing hours are absent, not zero"
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
              height={{ base: 220, regular: 240 }}
            />
          </ChartCard>
        </SimpleGrid>
        <ChartCard
          title="Revenue vs forecast"
          subtitle="The gap shaded; signed variance as bars underneath"
        >
          <DualPanel<ForecastPoint, Date>
            data={FORECAST}
            ariaLabel="Daily revenue against forecast in $k, with signed variance, September 2026"
            x={(d) => d.day}
            formatX={fmtDay}
            series={FORECAST_LINES}
            top={{ format: (v) => `${v.toFixed(0)}` }}
            fillBetween={{
              from: 'forecast',
              to: 'actual',
              fill: alpha(VX.badSolid, 0.16),
              aboveFill: alpha(VX.goodSolid, 0.16),
            }}
            bar={{
              label: 'Variance',
              getValue: (d) => d.actual - d.forecast,
              positive: VX.goodSolid,
              negative: VX.badSolid,
              format: (v) => fmtSigned(v),
              formatValue: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} k`,
            }}
            height={{ base: 280, regular: 340 }}
            tooltip={{ onFollow: true }}
          />
        </ChartCard>
      </Stack>
    </Section>
  )
}

// ── Sparklines ──────────────────────────────────────────────────────────────────────────────────

const SPARK_ACTIVE_USERS = [1180, 1210, 1195, 1260, 1310, 1290, 1340, 1385, 1360, 1420, 1455, 1483]

export function SparklinesSection() {
  return (
    <Section title="Sparklines" subtitle="In a StatCard slot, which hands over its measured box.">
      <Stack gap="sm" data-compare="dashboard">
        <StatCard
          title="Active users"
          value="1,483"
          delta={4.2}
          sparkline={({ width, height }) => (
            <Sparkline
              data={SPARK_ACTIVE_USERS}
              ariaLabel="Active users, last twelve weeks, rising"
              width={width}
              height={height}
              color={demoColors.sessions}
              emphasizeLast
            />
          )}
        />
      </Stack>
    </Section>
  )
}

/** The gallery's charts block: one section per chart family. */
export function ChartsSection() {
  return (
    <Stack gap="md">
      <CartesianSection />
      <StripsSection />
      <CompositionSection />
      <SparklinesSection />
      <SeamSection />
    </Stack>
  )
}
