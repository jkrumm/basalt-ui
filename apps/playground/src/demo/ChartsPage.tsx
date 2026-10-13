/**
 * Charts page — the line and bar kinds plus `CartesianChart`, the rung every kind composes
 * (`docs/V2-SPEC.md` § 9). Every chart passes a `ChartSeries<T>[]` (the single source of truth for
 * color/dash/label/accessor) and gets legend + tooltip + crosshair + a shared cursor for free —
 * never hand-authored in parallel.
 *
 * Cursor sharing needs NO provider — every chart on this page shares one cursor out of the box via
 * a module-level store, so the "Linked time series" block below wires nothing at all for it. Every
 * date-keyed chart here returns a `Date` from `x`, which is what lets one hover paint them all.
 * "Weekly digest" makes the point explicit: it folds the Mar 01–14 calendar into 2 weekly buckets
 * keyed by each week's leading day and passes `cursorResolution="leading"`, so a daily hover
 * anywhere inside a week — even the back half — resolves to the week that CONTAINS it, not merely
 * the nearest one (the default `'nearest'` resolution the rest of this page's charts use). Every
 * chart is also keyboard-operable with no extra wiring: tab into its plot and scrub with ←/→,
 * Escape clears — and clicking any legend entry hides that series from the plot, tooltip, and axis
 * domain together (try it on "Weekly channel volume", 8 legend entries). "Health score", "Training
 * load" and "Sessions vs revenue" additionally opt into `tooltip.onFollow` — each renders its own
 * tooltip, anchored to the shared crosshair, when a SIBLING owns the cursor rather than only when
 * it's the one hovered, so scrubbing any one of them reads all three at once.
 *
 * Exercises: `Lines` (zones/x-zones/thresholds/refLines/`area`, plus `tooltip.rows` reading
 * `{ visible, hidden }` and an edge-aligned `XZoneSpec` widening a single-key band to a full step;
 * dashed MA companions folded under their parent lift's legend entry, PR markers via `getMarker`,
 * legend-hover dimming, a `formatX` reformatting the session-key x-axis; a dual-axis pair with
 * `y2` and `axis: 'right'`) · `Bars` (a signed pair diverging around zero, a weekly digest with
 * `cursorResolution="leading"`, and a high-cardinality role-grouped legend with dashed overlay and
 * reference lines, `ChartSeries.formatValue`'s datum argument and `tooltip.formatHeader`) ·
 * `CartesianChart` composed directly with consumer marks (an `areaY` band between two lines under
 * the `lineY` strokes) · `ChartCard` · `ZoneSpec` · `XZoneSpec` · `alpha()` · `cursorGroup`.
 */
import { useState } from 'react'
import { SimpleGrid, Stack, Switch, Text } from '@mantine/core'
import { areaY } from '@tanstack/charts/area'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { PageBar } from 'basalt-ui'
import { Bars, CartesianChart, ChartCard, Lines } from 'basalt-ui/charts'
import type {
  AxisConfig,
  BarsBar,
  BarsLine,
  ChartSeries,
  ChartTooltipConfig,
  ChartTooltipRow,
  PlotContext,
  RefLine,
  Threshold,
  XZoneSpec,
  ZoneSpec,
} from 'basalt-ui/charts'
import { ViewTabs } from 'basalt-ui/controls'
import { alpha, CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import { CHANNEL_VOLUME, LIFT_TREND, LOAD_TREND, SERIES_DATA, WEEKLY_DIGEST } from './data'
import type { ChannelVolumePoint, DayPoint, LiftPoint, LoadPoint } from './data'
import { chartViews } from './charts-store'
import { CompositionTab, PanelsTab, SparklinesTab, StripsTab } from './ChartKindsTabs'
import { demoColors } from './series'
import { isoDayToDate } from './fixtures/format'

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')
const fmtKg = (v: number) => `${Math.round(v)} kg`
const fmtSigned = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`

const dayOf = (d: { date: string }): Date => isoDayToDate(d.date)

const HEALTH_ZONES: ZoneSpec[] = [
  { from: 0, to: 50, fill: alpha(VX.badSolid, 0.1) },
  { from: 50, to: 75, fill: alpha(VX.warnSolid, 0.1) },
  { from: 75, to: 100, fill: alpha(VX.goodSolid, 0.1) },
]

const zoneLabel = (v: number): { text: string; color: string } => {
  if (v >= 75) return { text: 'Healthy', color: VX.goodSolid }
  if (v >= 50) return { text: 'Watch', color: VX.warnSolid }
  return { text: 'At risk', color: VX.badSolid }
}

// `tooltip.rows`'s ctx carries the same `{ visible, hidden }` the plot draws from, so the goal row
// disappears the moment the legend hides the (sole) `health` series rather than naming a series the
// plot no longer draws.
function healthRows(
  d: DayPoint,
  { hidden }: { hidden: readonly ChartSeries<DayPoint>[] },
): ChartTooltipRow[] {
  const zone = zoneLabel(d.health)
  const rows: ChartTooltipRow[] = [{ label: 'Zone', value: zone.text, color: zone.color }]
  if (hidden.some((s) => s.key === 'health')) return rows
  rows.push({ label: 'Vs. 80 goal', value: fmtSigned(d.health - 80), color: VX.goodRef })
  return rows
}

// Hoisted so the Health score chart's props keep a stable identity across re-renders (the chart's
// definition memo keys on them).
const HEALTH_Y: AxisConfig<DayPoint> = { domain: [0, 100], format: (v) => `${Math.round(v)}` }

const HEALTH_X_ZONES: XZoneSpec<Date>[] = [
  {
    from: isoDayToDate('2026-03-08'),
    to: isoDayToDate('2026-03-14'),
    fill: alpha(VX.accent, 0.05),
  },
  {
    from: isoDayToDate('2026-03-12'),
    to: isoDayToDate('2026-03-12'),
    fill: alpha(VX.goodSolid, 0.18),
    align: 'edge',
  },
]

const HEALTH_THRESHOLDS: Threshold[] = [
  { value: 80, side: 'above', fill: alpha(VX.goodSolid, 0.14) },
]

const HEALTH_REF_LINES: RefLine[] = [{ value: 80, color: VX.goodRef, dashed: true }]

const HEALTH_TOOLTIP: ChartTooltipConfig<DayPoint, Date> = { rows: healthRows, onFollow: true }

const HEALTH_SERIES: ChartSeries<DayPoint>[] = [
  {
    key: 'health',
    label: 'Health',
    color: demoColors.sessions,
    area: true,
    getValue: (d) => d.health,
  },
]

/** Three lifts, each a solid e1RM line + a dashed 4-session MA companion (folded legend entry). */
const LIFTS = [
  { key: 'bench', label: 'Bench', color: demoColors.sessions, pr: (d: LiftPoint) => d.benchPr },
  { key: 'squat', label: 'Squat', color: demoColors.signups, pr: (d: LiftPoint) => d.squatPr },
  { key: 'dead', label: 'Deadlift', color: demoColors.revenue, pr: (d: LiftPoint) => d.deadPr },
] as const

const LIFT_SERIES: ChartSeries<LiftPoint>[] = [
  ...LIFTS.map((l) => ({
    key: l.key,
    label: l.label,
    color: l.color,
    getValue: (d: LiftPoint) => d[l.key],
    getMarker: (d: LiftPoint) => (l.pr(d) ? { color: VX.status.excellent } : null),
  })),
  ...LIFTS.map((l) => ({
    key: `${l.key}-ma`,
    label: `${l.label} MA`,
    color: l.color,
    legend: false,
    parent: l.key,
    dash: 'dashed' as const,
    strokeWidth: 1.5,
    getValue: (d: LiftPoint) => d[`${l.key}Ma`],
  })),
]

// ── Training load — CartesianChart with consumer marks ─────────────────────────
//
// Two lines (acute over chronic) with the gap between them shaded. No kind draws a band BETWEEN two
// series, so this composes `CartesianChart` directly: `plot.rows(key)` already honours the legend's
// toggles (a hidden series is `[]`), so the band appears only while both of its lines do. The band
// is `decorative` — it paints but is never a tooltip or crosshair target; the series array alone
// owns the legend and the tooltip rows.

const LOAD_SERIES: ChartSeries<LoadPoint>[] = [
  { key: 'acute', label: 'Acute (7d)', color: demoColors.sessions, getValue: (d) => d.acute },
  {
    key: 'chronic',
    label: 'Chronic (28d)',
    color: VX.line,
    dash: 'dashed',
    getValue: (d) => d.chronic,
  },
]

function loadMarks(plot: PlotContext<LoadPoint, Date>) {
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

// ── Load divergence — Bars with a signed pair ──────────────────────────────────
//
// A negative bar is a series whose `getValue` returns NEGATIVE numbers: the stack diverges around
// zero, so "building" and "recovering" are two series over the same days.

const DIVERGENCE_BARS: BarsBar<LoadPoint>[] = [
  {
    key: 'building',
    label: 'Building',
    color: VX.goodSolid,
    getValue: (d) => (d.divergence > 0 ? d.divergence : null),
    formatValue: fmtSigned,
  },
  {
    key: 'recovering',
    label: 'Recovering',
    color: VX.warnSolid,
    getValue: (d) => (d.divergence < 0 ? d.divergence : null),
    formatValue: fmtSigned,
  },
]

// ── Sessions vs revenue — dual-axis Lines ──────────────────────────────────────
//
// Two series on the SAME date axis but genuinely different scales (session counts vs $k revenue) —
// a single shared y axis would flatten the revenue line to a flat band near zero. `y2` turns on the
// right axis and the revenue series opts in with `axis: 'right'`.

const SESSIONS_REVENUE_SERIES: ChartSeries<DayPoint>[] = [
  { key: 'sessions', label: 'Sessions', color: demoColors.sessions, getValue: (d) => d.sessions },
  {
    key: 'revenue',
    label: 'Revenue ×1k',
    color: demoColors.revenue,
    dash: 'dashed',
    axis: 'right',
    getValue: (d) => d.revenue,
  },
]

// ── Weekly digest — Bars, folded domain, shared cursor ─────────────────────────
//
// 2 weekly buckets over the same Mar 01–14 calendar as "Health score" — hovering either chart moves
// both crosshairs with zero wiring. `cursorResolution="leading"` below is what makes a back-half
// daily hover (e.g. Mar 05) resolve to the week it's actually inside (Mar 01) instead of the
// nearest bucket by raw distance (Mar 08).

// Static 2-week reference — a dashed BarsLine overlay, not a fabricated third bucket.
const WEEKLY_AVG_SESSIONS = Math.round(
  (WEEKLY_DIGEST[0]!.sessions + WEEKLY_DIGEST[1]!.sessions) / 2,
)

const WEEKLY_BARS: BarsBar<(typeof WEEKLY_DIGEST)[number]>[] = [
  { key: 'sessions', label: 'Sessions', color: demoColors.sessions, getValue: (d) => d.sessions },
]
const WEEKLY_LINES: BarsLine<(typeof WEEKLY_DIGEST)[number]>[] = [
  {
    key: 'trend',
    label: '2-week average',
    color: VX.line,
    dash: 'dashed',
    // Dims the stroke + legend swatch and drops the tooltip row entirely (`tooltip: false`) — a
    // static reference, not a per-day measurement.
    strokeOpacity: 0.5,
    tooltip: false,
    getValue: () => WEEKLY_AVG_SESSIONS,
  },
]

// ── Channel volume — high-cardinality legend regression guard ──────────────────
//
// 4 stacked channel bars + a dashed 3-week MA overlay + 3 dashed threshold refs = 8 legend entries
// across role: 'series' | 'overlay' | 'reference'. A threshold that must itself be a hideable,
// role-grouped legend row is a `BarsLine` with a constant `getValue` and `tooltip: false`.

const CHANNEL_BAR_DEFS = [
  { key: 'organic', label: 'Organic', color: demoColors.sessions },
  { key: 'paid', label: 'Paid', color: demoColors.revenue },
  { key: 'referral', label: 'Referral', color: demoColors.signups },
  { key: 'direct', label: 'Direct', color: demoColors.churn },
] as const

const VOLUME_THRESHOLDS = [
  { key: 'floor', label: 'Floor target', value: 600, color: VX.badRef },
  { key: 'watch', label: 'Watch line', value: 750, color: VX.warnRef },
  { key: 'stretch', label: 'Stretch goal', value: 900, color: VX.goodRef },
] as const

const VOLUME_BARS: BarsBar<ChannelVolumePoint>[] = CHANNEL_BAR_DEFS.map((b) => ({
  key: b.key,
  label: b.label,
  color: b.color,
  getValue: (d) => d[b.key],
  // `formatValue`'s second argument is the hovered datum — cites `d.total` (a field beyond the
  // plotted bar value) so each channel's tooltip row also reads its share of that week.
  formatValue: (v, d) => `${fmtInt(v)} (${Math.round((v / d.total) * 100)}%)`,
}))

const VOLUME_LINES: BarsLine<ChannelVolumePoint>[] = [
  {
    key: 'volume-ma',
    label: '3-week average',
    color: VX.line,
    dash: 'dashed',
    role: 'overlay',
    // Dims the plotted stroke AND the legend swatch only — the tooltip row stays full-strength.
    strokeOpacity: 0.5,
    getValue: (d) => d.ma,
  },
  ...VOLUME_THRESHOLDS.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    dash: 'dashed' as const,
    role: 'reference' as const,
    tooltip: false,
    getValue: () => t.value,
  })),
]

const weekHeader = (key: string) => `Week ${key.slice(1)}`

function ChannelVolumeCard() {
  const [pending, setPending] = useState(false)
  return (
    <ChartCard
      title="Weekly channel volume"
      subtitle="4 stacked channels + a 3-week average + 3 threshold refs — 8 legend entries"
      info="Regression guard for the weekly-volume overlap class: a role-grouped legend (series / overlay / reference) derived from one series array. Click any entry — a channel, the average, or a threshold — to hide it; the stack, the lines, and the axis domain all update together. Each channel's tooltip row also cites its share of that week's total via formatValue's second (datum) argument; the average line's stroke and legend swatch are dimmed with strokeOpacity. The tooltip header is renamed from the raw 'W3' key to 'Week 3' via tooltip.formatHeader. The switch previews the pending state: a query in flight stays distinct from measured-and-empty, so a loading chart never reads as a chart with no data."
      actions={
        <Switch
          // `size` is load-bearing HERE and nowhere else in a home slot: `ChartCard` lives inside
          // the Mantine-free chart layer, so its `actions` slot carries only `data-basalt-tier` and
          // cannot mount the tier theme — a control there states its own size
          // (`packages/basalt-ui/MAINTAINING.md`, "A home sizes its own SLOT"). `control-size-literal`
          // exempts this one owner, so no waiver is needed; it used to take one.
          size="ctl"
          label="Pending"
          checked={pending}
          onChange={(e) => setPending(e.currentTarget.checked)}
        />
      }
    >
      <Bars
        data={CHANNEL_VOLUME}
        ariaLabel="Weekly acquisition volume by channel, with a three-week average and three thresholds"
        x={(d) => d.week}
        bars={VOLUME_BARS}
        lines={VOLUME_LINES}
        legend={{ groups: true }}
        tooltip={{ formatHeader: weekHeader }}
        state={{ pending }}
      />
    </ChartCard>
  )
}

// ── Cursor scoping — `cursorGroup` isolates a pair from the page's shared default cursor. ──────────

const SCOPE_A_SERIES: ChartSeries<DayPoint>[] = [
  { key: 'revenue', label: 'Revenue', color: demoColors.revenue, getValue: (d) => d.revenue },
]
const SCOPE_B_SERIES: ChartSeries<DayPoint>[] = [
  { key: 'churn', label: 'Churn', color: demoColors.churn, getValue: (d) => d.churn },
]

function CursorScopeBlock() {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Two unrelated same-domain pairs. The first pair shares the page's default cursor (hover
        either and its sibling's crosshair moves too). The second pair names a{' '}
        <code>cursorGroup</code>: hovering either of the two below moves only each other, isolated
        from every other chart on the page.
      </Text>
      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <ChartCard title="Unscoped — Revenue" subtitle="Shares the page cursor">
          <Lines<DayPoint, Date>
            data={SERIES_DATA}
            ariaLabel="Revenue, unscoped"
            x={dayOf}
            series={SCOPE_A_SERIES}
          />
        </ChartCard>
        <ChartCard title="Unscoped — Churn" subtitle="Shares the page cursor">
          <Lines<DayPoint, Date>
            data={SERIES_DATA}
            ariaLabel="Churn, unscoped"
            x={dayOf}
            series={SCOPE_B_SERIES}
          />
        </ChartCard>
      </SimpleGrid>
      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <ChartCard title="Scoped — Tenant 1" subtitle="Isolated pair, via cursorGroup">
          <Lines<DayPoint, Date>
            data={SERIES_DATA}
            ariaLabel="Revenue, tenant 1"
            x={dayOf}
            series={SCOPE_A_SERIES}
            cursorGroup="charts-tenant"
          />
        </ChartCard>
        <ChartCard title="Scoped — Tenant 2" subtitle="Isolated pair, via cursorGroup">
          <Lines<DayPoint, Date>
            data={SERIES_DATA}
            ariaLabel="Churn, tenant 2"
            x={dayOf}
            series={SCOPE_B_SERIES}
            cursorGroup="charts-tenant"
          />
        </ChartCard>
      </SimpleGrid>
    </Stack>
  )
}

export function ChartsPage() {
  const [tab] = chartViews.field.tab.use()
  return (
    <Stack gap="sm">
      <PageBar tabs={<ViewTabs field={chartViews.field.tab} label="Group" />} />
      <Text size="sm" c="dimmed">
        Every chart in the selected group shares one cursor with no provider — hover or tab into any
        chart and scrub with ←/→ (Escape clears), and click a legend entry to hide that series from
        the plot, tooltip, and axis domain together.
      </Text>

      {/* ── Linked time series: one shared cursor across every date-aligned chart, no wrapper ── */}
      {tab === 'linked' && (
        <Stack gap="sm">
          <ChartCard
            title="Health score"
            subtitle="A composite 0–100 with zone bands, an x-range band, and a target threshold"
            info="Zones frame at-risk / watch / healthy; the shaded taper-week band marks Mar 08–14; a second, edge-aligned band pins the Mar 12 peak to one full step (align: 'edge' — the same from === to band would render nothing under the default 'center' alignment); the dashed reference marks the 80 goal. The tooltip appends rows for the zone and the distance to that goal, the latter gated on the same hidden set the legend toggles. tooltip.onFollow: true also makes THIS chart render its tooltip when a sibling below owns the cursor, not only when it's the hovered one."
          >
            <Lines<DayPoint, Date>
              data={SERIES_DATA}
              ariaLabel="Health score trend, 0 to 100, March 1 to 14"
              x={dayOf}
              series={HEALTH_SERIES}
              y={HEALTH_Y}
              zones={HEALTH_ZONES}
              xZones={HEALTH_X_ZONES}
              thresholds={HEALTH_THRESHOLDS}
              refLines={HEALTH_REF_LINES}
              tooltip={HEALTH_TOOLTIP}
            />
          </ChartCard>

          <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
            <ChartCard
              title="Training load"
              subtitle="Acute vs chronic, the gap shaded"
              info="CartesianChart with consumer marks: 7-day acute load over the 28-day chronic baseline, drawn as an areaY band (y1 = chronic, y2 = acute) under two lineY strokes. The band follows the legend — hide either line and it goes with it. tooltip.onFollow renders this chart's tooltip when a SIBLING owns the cursor too, anchored to the shared crosshair, not only when this chart is the one hovered."
            >
              <CartesianChart<LoadPoint, Date>
                data={LOAD_TREND}
                ariaLabel="Acute versus chronic training load, March 1 to 14"
                x={dayOf}
                series={LOAD_SERIES}
                marks={loadMarks}
                y={{ format: fmtInt }}
                tooltip={{ onFollow: true }}
              />
            </ChartCard>

            <ChartCard
              title="Load divergence"
              subtitle="Acute − chronic, signed"
              info="Bars with a signed pair: 'building' is positive, 'recovering' negative, and the stack diverges around zero. Each is a series, so each toggles from the legend."
            >
              <Bars<LoadPoint, Date>
                data={LOAD_TREND}
                ariaLabel="Acute minus chronic training load, March 1 to 14"
                x={dayOf}
                bars={DIVERGENCE_BARS}
                y={{ format: fmtSigned }}
              />
            </ChartCard>
          </SimpleGrid>

          <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
            <ChartCard
              title="Sessions vs revenue"
              subtitle="Two series, same date axis, independent scales — left axis counts, right axis $k"
              info="Dual-axis Lines: sessions and revenue share the calendar but not a y-scale (y2 + axis: 'right'). tooltip.onFollow: true also renders this chart's tooltip as a cursor FOLLOWER, anchored to the shared crosshair, when Health score or Training load is hovered instead."
            >
              <Lines<DayPoint, Date>
                data={SERIES_DATA}
                ariaLabel="Sessions and revenue, March 1 to 14, on separate axes"
                x={dayOf}
                series={SESSIONS_REVENUE_SERIES}
                y2={{ format: (v) => `$${v.toFixed(1)}k` }}
                tooltip={{ onFollow: true }}
              />
            </ChartCard>

            <ChartCard
              title="Weekly digest"
              subtitle="2 weekly buckets over the same Mar 01–14 calendar"
              info="No provider — hover either chart above or this one and the crosshair moves on all of them. This chart folds 14 days into 2 points keyed by each week's leading day (Mar 01, Mar 08) and passes cursorResolution: leading, so a daily hover anywhere inside a week — even the back half, e.g. Mar 05 — lands on the week that actually CONTAINS it, not just the nearest one by raw distance. The dashed 2-week-average line is a BarsLine: dimmed via strokeOpacity (stroke + legend swatch only) and excluded from the tooltip via tooltip: false, since it's a static reference, not a measurement. The y axis also opts into AxisConfig.nice, rounding its tick bounds outward."
            >
              <Bars
                data={WEEKLY_DIGEST}
                ariaLabel="Weekly sessions with the two-week average"
                x={dayOf}
                cursorResolution="leading"
                bars={WEEKLY_BARS}
                lines={WEEKLY_LINES}
                y={{ format: fmtInt, nice: true }}
              />
            </ChartCard>
          </SimpleGrid>
        </Stack>
      )}

      {/* ── Standalone kinds ────────────────────────────────────────────────────────── */}
      {tab === 'kinds' && (
        <>
          <ChartCard
            title="Estimated 1RM trend"
            subtitle="Three lifts — solid e1RM, dashed 4-session average, a dot marks a new PR"
            info="Lines: N series on one axis. Hover the legend to dim the rest, click an entry to hide it; dots mark personal records (getMarker); the dashed moving-average companion folds under its lift's legend entry (parent + legend: false). formatX reformats the raw 'S1'..'S12' session keys into '#1'..'#12' on the x-axis."
          >
            <Lines<LiftPoint, string>
              data={LIFT_TREND}
              ariaLabel="Estimated one-rep max for bench, squat and deadlift over twelve sessions"
              x={(d) => d.session}
              formatX={(key) => `#${key.slice(1)}`}
              y={{ domain: 'auto', format: fmtKg }}
              series={LIFT_SERIES}
            />
          </ChartCard>

          <ChannelVolumeCard />
        </>
      )}

      {tab === 'strips' && <StripsTab />}
      {tab === 'composition' && <CompositionTab />}
      {tab === 'panels' && <PanelsTab />}
      {tab === 'sparklines' && <SparklinesTab />}
      {tab === 'cursor' && <CursorScopeBlock />}
    </Stack>
  )
}
