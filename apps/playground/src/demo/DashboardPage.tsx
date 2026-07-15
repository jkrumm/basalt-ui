/**
 * Dashboard page — the living proof of docs/DESIGN-SPEC.md: three KPI cards (each pinned with a
 * faint sparkline, built from the shipped `StatCard`), a full-width "Acquisition" dual-axis chart
 * (grouped bars + a churn line on the right axis), and a 1.55fr/1fr row of a traffic-sources meter
 * list + a "this month" stat list.
 *
 * Exercises: StatCard (label/value/delta/sparkline/menu slots), Paper (themed panel + shadow-card
 * + radius-card), the Bars kind (grouped layout, dual axis, its own derived legend), LineSparkline,
 * useChartSize (sparkline width measurement), Progress (themed ink-8% track), Menu (ghost "more
 * actions"), Tooltip (info dot), PageActions.
 */
import type { CSSProperties } from 'react'
import {
  ActionIcon,
  Group,
  Menu,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { StatCard } from 'basalt-ui'
import { alpha, Bars, ChartCard, LineSparkline, useChartSize, VX } from 'basalt-ui/charts'
import { useMemo, useState } from 'react'
import { generateDashboardData } from './data'
import type { DateRange, DayPoint } from './data'
import { IconDots } from './icons'

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')
const fmtMoney = (v: number) => `$${v.toFixed(1)}k`

// ── Shared type styles (docs/DESIGN-SPEC.md §3 recurring type patterns) ────────────────────────
// The KPI micro-label + value styles now live inside the shipped `StatCard` — only the styles
// this page still hand-renders (card titles, subtitles, stat/meter numerals) stay local.

// Matches the shipped ChartCard title exactly (head font, 88% stretch, weight 550, VX.text.md) so
// the non-chart list cards below read as the SAME card chrome as the ChartCard-based ones.
const cardTitleStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-head)',
  fontStretch: '88%',
  fontWeight: 550,
  fontSize: VX.text.md,
  color: VX.ink,
}

const monoNumeralStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.xs,
  fontWeight: 500,
  color: VX.ink,
}

// "Progress/meter row" idiom (DESIGN-SPEC.md §5) — distinct from the "Stat list row" idiom above:
// mono 12px faint, not mono 12.5px ink. 12px has no exact VX.text.* step (xs is 12.5), so it stays
// a literal — collapsing it onto xs would erase the deliberate size distinction from monoNumeralStyle.
const meterValueStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  // theme-allow: DESIGN-SPEC.md §5 "Progress/meter row" pins this at exactly 12px, no matching token
  fontSize: 12,
  fontWeight: 500,
  color: VX.faint,
}

// Row-label idiom (DESIGN-SPEC.md §5 "Progress/meter row" + "Stat list row") — 13px, no exact
// VX.text.* step (sm is 13.5). Hoisted so the literal + its escape live in one place; the two call
// sites differ only in color (ink-2 vs muted), spread on top.
const rowLabelStyle: CSSProperties = {
  // theme-allow: DESIGN-SPEC.md §5 row labels sit at exactly 13px, no matching token
  fontSize: 13,
}

// ── Shared bits (ghost menu, delta badge) ───────────────────────────────────────────────────────

/** Ghost "more actions" affordance shared by every card header (docs/DESIGN-SPEC.md §5). */
function CardMenu({ label }: { label: string }) {
  return (
    <Menu position="bottom-end" withinPortal shadow="md">
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" radius={6} size="sm" aria-label={label}>
          <IconDots />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item>View details</Menu.Item>
        <Menu.Item>Export CSV</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

// ── KPI row ──────────────────────────────────────────────────────────────────────────────────────

type Kpi = { key: string; label: string; value: string; delta: number; spark: number[] }

/** Measures its own width to size the `LineSparkline` — lives inside `StatCard`'s `sparkline`
 * slot, which renders the node as-is (no chart import inside `src/dashboard`, see its JSDoc). */
function KpiSparkline({ data }: { data: number[] }) {
  const { ref, width } = useChartSize()
  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 && <LineSparkline data={data} width={width} height={32} color={VX.faint} />}
    </div>
  )
}

// Comparison timeframe shown after each delta — the delta is measured against the prior equivalent
// period, so a day range reads day-over-day, a week week-over-week, a month month-over-month.
const DELTA_PERIOD: Record<DateRange, string> = { '1d': 'DoD', '7d': 'WoW', '30d': 'MoM' }

function KpiCard({ kpi, period }: { kpi: Kpi; period: string }) {
  return (
    <StatCard
      label={kpi.label}
      value={kpi.value}
      delta={kpi.delta}
      deltaPeriod={period}
      menu={<CardMenu label={`${kpi.label} actions`} />}
      sparkline={<KpiSparkline data={kpi.spark} />}
    />
  )
}

// ── Acquisition (full-width dual-axis chart card) ──────────────────────────────────────────────

/** Groups daily points into 7-day buckets — sums the volume metrics, averages the rate metrics. */
function groupWeekly(daily: DayPoint[]): DayPoint[] {
  const weeks: DayPoint[] = []
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7)
    const sum = (key: 'sessions' | 'signups' | 'revenue') => chunk.reduce((s, d) => s + d[key], 0)
    const avg = (key: 'churn' | 'health') => chunk.reduce((s, d) => s + d[key], 0) / chunk.length
    weeks.push({
      date: chunk[0]!.date,
      sessions: sum('sessions'),
      signups: sum('signups'),
      revenue: Math.round(sum('revenue') * 10) / 10,
      churn: Math.round(avg('churn')),
      health: Math.round(avg('health')),
    })
  }
  return weeks
}

function AcquisitionCard({ series }: { series: DayPoint[] }) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily')
  const displaySeries = useMemo(
    () => (granularity === 'weekly' ? groupWeekly(series) : series),
    [series, granularity],
  )

  return (
    <ChartCard
      title="Acquisition"
      subtitle="Daily sessions and signups, with churn % on the right axis"
      tooltip="Grouped bars share the left axis; the churn line reads against the right axis."
      extra={
        <Group gap="xs" wrap="nowrap">
          <SegmentedControl
            size="xs"
            value={granularity}
            onChange={(v) => setGranularity(v as 'daily' | 'weekly')}
            data={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
            ]}
          />
          <CardMenu label="Acquisition chart actions" />
        </Group>
      }
    >
      <Bars<DayPoint>
        data={displaySeries}
        height={300}
        chartId="dashboard-acquisition"
        getX={(d) => d.date}
        getValue={(d, key) => (d[key as keyof DayPoint] as number) ?? null}
        barLayout="grouped"
        positiveBars={[
          { key: 'sessions', label: 'Sessions', color: VX.accent },
          { key: 'signups', label: 'Signups', color: VX.faint, weight: 0.8 },
        ]}
        lines={[
          {
            key: 'churn',
            label: 'Churn %',
            color: VX.warnSolid,
            strokeWidth: 1.9,
            axisSide: 'right',
            formatValue: (v) => `${v.toFixed(0)}%`,
          },
        ]}
        leftAxis={{ domain: 'auto', formatTick: (v) => fmtInt(v) }}
        rightAxis={{ domain: [0, 10], formatTick: (v) => `${v}%`, numTicks: 6 }}
        formatValue={(v) => fmtInt(v)}
      />
    </ChartCard>
  )
}

// ── Row 3: traffic sources meter list + this-month stat list ───────────────────────────────────

const TRAFFIC_SOURCES: { label: string; value: number }[] = [
  { label: 'Direct', value: 42 },
  { label: 'Organic search', value: 28 },
  { label: 'Referral', value: 18 },
  { label: 'Social', value: 12 },
]

// Leader bar is the accent; the rest fade at decreasing faint mixes (spec §5 "Progress/meter row").
const TRAFFIC_MIXES = [1, 0.8, 0.55, 0.4]

function TrafficSourcesCard() {
  return (
    <Paper py="xs" px="sm">
      <Text style={cardTitleStyle} mb="xs">
        Traffic sources
      </Text>
      <Stack gap={14}>
        {TRAFFIC_SOURCES.map((source, i) => (
          <div key={source.label}>
            <Group justify="space-between" mb={6}>
              {/* theme-allow: DESIGN-SPEC.md §5 "Progress/meter row" label pinned at 13px, no matching token */}
              <Text style={{ ...rowLabelStyle, color: VX.ink2 }}>{source.label}</Text>
              <Text style={meterValueStyle}>{source.value}%</Text>
            </Group>
            <Progress
              value={source.value}
              color={i === 0 ? VX.accent : alpha(VX.faint, TRAFFIC_MIXES[i]!)}
            />
          </div>
        ))}
      </Stack>
    </Paper>
  )
}

const MONTH_STATS: { label: string; value: string }[] = [
  { label: 'Conversion rate', value: '5.9%' },
  { label: 'Avg. session', value: '4m 12s' },
  { label: 'New vs returning', value: '63 / 37' },
  { label: 'Bounce rate', value: '38%' },
]

function ThisMonthCard() {
  return (
    <Paper py="xs" px="sm">
      <Text style={cardTitleStyle} mb="xs">
        This month
      </Text>
      <Stack gap={0}>
        {MONTH_STATS.map((stat) => (
          <Group key={stat.label} justify="space-between" py={9}>
            {/* theme-allow: DESIGN-SPEC.md §5 "Stat list row" label pinned at 13px, no matching token */}
            <Text style={{ ...rowLabelStyle, color: VX.muted }}>{stat.label}</Text>
            <Text style={monoNumeralStyle}>{stat.value}</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────────────────────────

export function DashboardPage({ range }: { range?: DateRange }) {
  const resolved = range ?? '30d'
  const { series, sparks } = useMemo(() => generateDashboardData(resolved), [resolved])

  const kpis: Kpi[] = useMemo(
    () => [
      {
        key: 'sessions',
        label: 'Sessions',
        value: fmtInt(series.reduce((s, d) => s + d.sessions, 0)),
        delta: 12.4,
        spark: sparks.sessions,
      },
      {
        key: 'signups',
        label: 'Signups',
        value: fmtInt(series.reduce((s, d) => s + d.signups, 0)),
        delta: 8.1,
        spark: sparks.signups,
      },
      {
        key: 'revenue',
        label: 'Revenue',
        value: fmtMoney(series.reduce((s, d) => s + d.revenue, 0)),
        delta: 18.9,
        spark: sparks.revenue,
      },
    ],
    [series, sparks],
  )

  return (
    <Stack gap={14} maw={1560} mx="auto">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} period={DELTA_PERIOD[resolved]} />
        ))}
      </div>

      <AcquisitionCard series={series} />

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 14 }}>
        <TrafficSourcesCard />
        <ThisMonthCard />
      </div>
    </Stack>
  )
}
