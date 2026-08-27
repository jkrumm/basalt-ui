/**
 * Charts page — the full kind registry plus `CartesianChart`, the primitive every kind and
 * every bespoke chart on this page composes (`docs/CHARTS-SPEC.md`). Every chart passes a
 * `ChartSeries<T>[]` (the single source of truth for color/dash/label/accessor) and gets legend +
 * tooltip + crosshair + a shared cursor for free — never hand-authored in parallel.
 *
 * Cursor sharing needs NO provider anymore — every `CartesianChart` on this page (kind or bespoke)
 * shares one cursor out of the box via a module-level store, so the "Linked time series" block
 * below wires nothing at all for it. "Weekly digest" makes the point explicit: it folds the Mar
 * 01–14 calendar into 2 weekly buckets keyed by each week's leading day and passes
 * `cursorResolution="leading"`, so a daily hover anywhere inside a week — even the back half —
 * resolves to the week that CONTAINS it, not merely the nearest one (the default `'nearest'`
 * resolution the rest of this page's charts still use). Every chart is also keyboard-operable with
 * no extra wiring: tab into its plot and scrub with ←/→, Escape clears — and clicking any legend
 * entry hides that series from the plot, tooltip, and axis domain together (try it on "Weekly
 * channel volume", 8 legend entries). "Health score", "Training load", and "Sessions vs revenue"
 * additionally opt into `tooltip.onFollow` (`DualPanel`'s own `onFollow` prop) — each renders its
 * own tooltip, anchored to the shared crosshair, when a SIBLING owns the cursor rather than only
 * when it's the one hovered, so scrubbing any one of the three reads all three at once.
 *
 * Exercises: ZonedLine (zones/x-zones/thresholds/refLines/areaFill/tooltip.label, plus
 * `tooltip.extraRows` reading `{ visible, hidden }` and an edge-aligned `XZoneSpec` widening a
 * single-key band to a full step) · StackedArea · DualPanel (top lines + fill-between +
 * signed-histogram pane, shared cursor, plus `getMarker` on a top-pane series — a color override
 * for the recovering dot, `ring: false` + `fillOpacity` for a flat overreach dot — a tooltip-only
 * `formatBar`, and `bottomMaxAbsFloor` under the default `bottomYDomain: 'auto'`) · MultiLine
 * (dashed MA companions folded as sub-entries under their parent lift's legend entry, PR star
 * markers, legend-hover dimming, a `formatX` reformatting the session-key x-axis) · Heatmap
 * (self-measuring) · Donut (categorical legend + `isPending`) · Bars (weekly digest with
 * `cursorResolution="leading"` for its bucket-keyed domain, plus a dimmed
 * `BarsLine.strokeOpacity` reference line excluded from the tooltip via `tooltip: false`, and
 * `AxisConfig.nice`) · ChartCard (title/subtitle/tooltip/extra) · ZoneSpec · XZoneSpec · alpha() ·
 * CartesianChart composed directly for the two genuinely bespoke shapes: a dual-axis line pair
 * (`y` + `y2`, a series opting in with `axis: 'right'`) and a high-cardinality role-grouped legend
 * (series / overlay / reference) with a `maxRows` rollup, neither of which any shipped kind's
 * config surface covers — the latter also dims its moving-average line via
 * `SeriesStyle.strokeOpacity`, formats each channel bar's tooltip row with
 * `ChartSeries.formatValue`'s second (datum) argument, and renames the tooltip header via
 * `tooltip.formatHeader`.
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { SimpleGrid, Stack, Switch, Text } from '@mantine/core'
import {
  alpha,
  Bars,
  CartesianChart,
  ChartCard,
  curveMonotoneX,
  Donut,
  DualPanel,
  Heatmap,
  LinePath,
  MultiLine,
  StackedArea,
  TooltipRow,
  VX,
  ZonedLine,
} from 'basalt-ui/charts'
import type {
  CartesianTooltipRowContext,
  ChartSeries,
  DonutDatum,
  ZoneSpec,
} from 'basalt-ui/charts'
import {
  ACTIVITY_HEATMAP,
  CHANNEL_MIX,
  CHANNEL_VOLUME,
  LIFT_TREND,
  LOAD_TREND,
  SERIES_DATA,
  WEEKLY_DIGEST,
} from './data'
import type { ChannelVolumePoint, DayPoint, HeatCell, LiftPoint, LoadPoint } from './data'
import { demoColor, demoColors } from './series'

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')
const fmtKg = (v: number) => `${Math.round(v)} kg`
const fmtSigned = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}`

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

// `extraRows`'s ctx carries the same `{ visible, hidden }` the plot draws from, so this row
// disappears the moment the legend hides the (sole) `health` series rather than naming a series
// the plot no longer draws.
function healthExtraRow(d: DayPoint, { hidden }: CartesianTooltipRowContext<DayPoint>) {
  if (hidden.has('health')) return null
  return (
    <TooltipRow
      color={VX.goodRef}
      label="Vs. 80 goal"
      value={fmtSigned(d.health - 80)}
      shape="dot"
    />
  )
}

// Donut `centerContent` demo (docs/DESIGN-SPEC.md §3): mono KPI value + a mono micro-label below,
// replacing the plain `centerLabel`/`centerSubLabel` text-only slots with real chrome.
const donutCenterValueStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: VX.text.lg,
  fontWeight: 600,
  color: VX.ink,
  lineHeight: 1.1,
}

const donutCenterLabelStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  // theme-allow: bespoke mono micro-label under the donut's center value, no matching token
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: VX.faint,
}

const STACK_GROUPS = ['sessions', 'signups', 'revenue'] as const

/** Three lifts, each a solid e1RM line + a dashed 4-session MA companion (visible legend entry). */
const LIFTS = [
  { key: 'bench', label: 'Bench', color: demoColors.sessions, pr: (d: LiftPoint) => d.benchPr },
  { key: 'squat', label: 'Squat', color: demoColors.signups, pr: (d: LiftPoint) => d.squatPr },
  { key: 'dead', label: 'Deadlift', color: demoColors.revenue, pr: (d: LiftPoint) => d.deadPr },
] as const

// ── Sessions vs revenue — dual-axis bespoke composition ────────────────────────
//
// Two series on the SAME date axis but genuinely different scales (session counts vs $k
// revenue) — a single shared y-axis (MultiLine, or DualPanel's top pane) would flatten the
// revenue line to a flat band near zero. Composed directly from `CartesianChart`: `y2` is what
// turns on the right axis (the margin widens by measurement, no `chartMargin({ rightAxis: true })`
// needed), the revenue series opts in with `axis: 'right'`, and the primitive already owns the
// scales, grid, crosshair + dots, and the derived tooltip — this draws only the two lines.

const SESSIONS_REVENUE_SERIES: ChartSeries<DayPoint>[] = [
  {
    key: 'sessions',
    label: 'Sessions (left axis)',
    color: demoColors.sessions,
    mark: 'line',
    getValue: (d) => d.sessions,
  },
  {
    key: 'revenue',
    label: 'Revenue ×1k (right axis)',
    color: demoColors.revenue,
    mark: 'line',
    dash: 'dashed',
    axis: 'right',
    getValue: (d) => d.revenue,
  },
]

function SessionsRevenueChart({ data, chartId }: { data: DayPoint[]; chartId: string }) {
  return (
    <CartesianChart<DayPoint>
      data={data}
      chartId={chartId}
      getX={(d) => d.date}
      series={SESSIONS_REVENUE_SERIES}
      y={{ format: fmtInt }}
      y2={{ format: (v) => `$${v.toFixed(1)}k` }}
      height={260}
      legend={{ placement: 'bottom' }}
      // onFollow: this chart also renders its tooltip as a cursor FOLLOWER — hover "Health score" or
      // "Training load" below and this one reads along, anchored to the shared crosshair.
      tooltip={{ onFollow: true }}
    >
      {({ visible, xScale, yScale, y2Scale }) =>
        visible.map((s) => (
          <LinePath<DayPoint>
            key={s.key}
            data={data}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => (s.axis === 'right' && y2Scale ? y2Scale : yScale)(s.getValue(d) ?? 0)}
            stroke={s.color}
            strokeWidth={s.strokeWidth ?? VX.lineWidth}
            strokeDasharray={s.dash === 'dashed' ? VX.dashArray : undefined}
            curve={curveMonotoneX}
          />
        ))
      }
    </CartesianChart>
  )
}

// ── Channel volume — high-cardinality legend regression guard ──────────────────
//
// 4 stacked channel bars + a dashed 3-week MA overlay + 3 dashed threshold refs = 8 legend
// entries across role: 'series' | 'overlay' | 'reference'. Bespoke because the shipped `Bars`
// kind's `refLines` are visual-only (no legend entry, no legend-toggle) — a threshold that must
// itself be a hideable, role-grouped legend row needs a `ChartSeries` entry with `getValue` always
// null (never a mark, never a tooltip row, but a real hideable legend key). Composed directly from
// `CartesianChart`; this draws only the stacked bars, the MA line, and the threshold lines.

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

const VOLUME_SERIES: ChartSeries<ChannelVolumePoint>[] = [
  ...CHANNEL_BAR_DEFS.map((b) => ({
    key: b.key,
    label: b.label,
    color: b.color,
    mark: 'bar' as const,
    fillOpacity: 0.85,
    getValue: (d: ChannelVolumePoint) => d[b.key],
    // `formatValue`'s second argument is the hovered datum — cites `d.total` (a field beyond the
    // plotted bar value) so each channel's tooltip row also reads its share of that week.
    formatValue: (v: number, d: ChannelVolumePoint) =>
      `${fmtInt(v)} (${Math.round((v / d.total) * 100)}%)`,
  })),
  {
    key: 'volume-ma',
    label: '3-week average',
    color: VX.line,
    mark: 'line',
    dash: 'dashed',
    role: 'overlay',
    // Dims the plotted stroke AND the legend swatch only — the tooltip row and crosshair dot stay
    // full-strength (SeriesStyle.strokeOpacity).
    strokeOpacity: 0.5,
    getValue: (d) => d.ma,
  },
  ...VOLUME_THRESHOLDS.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    mark: 'line' as const,
    dash: 'dashed' as const,
    role: 'reference' as const,
    getValue: () => null,
  })),
]

function ChannelVolumeChart({ data, chartId }: { data: ChannelVolumePoint[]; chartId: string }) {
  return (
    <CartesianChart<ChannelVolumePoint>
      data={data}
      chartId={chartId}
      getX={(d) => d.week}
      series={VOLUME_SERIES}
      tooltip={{ formatHeader: (key) => `Week ${key.slice(1)}` }}
      y={{
        format: fmtInt,
        domain: (rows, visible) => {
          const shown = new Set(visible.map((s) => s.key))
          let maxSum = 0
          for (const d of rows) {
            const sum = CHANNEL_BAR_DEFS.reduce((s, b) => s + (shown.has(b.key) ? d[b.key] : 0), 0)
            if (sum > maxSum) maxSum = sum
          }
          return [0, Math.max(maxSum, shown.has('stretch') ? 900 : 0) * 1.1]
        },
      }}
      height={300}
      legend={{ placement: 'bottom', groups: true, maxRows: 6 }}
    >
      {({ data: rows, hidden, xScale, yScale, xMax }) => {
        const barWidth = Math.max((xMax / Math.max(rows.length, 1)) * 0.6, 2)
        return (
          <>
            {rows.map((d) => {
              const cx = xScale(d.week) ?? 0
              let offset = 0
              return (
                <g key={d.week}>
                  {CHANNEL_BAR_DEFS.filter((b) => !hidden.has(b.key)).map((b) => {
                    const top = offset + d[b.key]
                    const yTop = yScale(top)
                    const yBottom = yScale(offset)
                    offset = top
                    return (
                      <rect
                        key={b.key}
                        x={cx - barWidth / 2}
                        y={yTop}
                        width={barWidth}
                        height={Math.max(yBottom - yTop, 0)}
                        fill={b.color}
                        fillOpacity={0.85}
                      />
                    )
                  })}
                </g>
              )
            })}
            {!hidden.has('volume-ma') && (
              <LinePath<ChannelVolumePoint>
                data={[...rows]}
                x={(d) => xScale(d.week) ?? 0}
                y={(d) => yScale(d.ma)}
                stroke={VX.line}
                strokeWidth={VX.lineWidth}
                strokeDasharray={VX.dashArray}
                curve={curveMonotoneX}
              />
            )}
            {VOLUME_THRESHOLDS.filter((t) => !hidden.has(t.key)).map((t) => (
              <line
                key={t.key}
                x1={0}
                x2={xMax}
                y1={yScale(t.value)}
                y2={yScale(t.value)}
                stroke={t.color}
                strokeDasharray={VX.dashArray}
              />
            ))}
          </>
        )
      }}
    </CartesianChart>
  )
}

// ── Weekly digest — Bars kind, folded domain, no ChartCursorScope ──────────────
//
// See the file-header doc: 2 weekly buckets over the same Mar 01–14 calendar as "Health score" —
// hovering either chart moves both crosshairs with zero wiring. cursorResolution="leading" below
// is what makes a back-half daily hover (e.g. Mar 05) resolve to the week it's actually inside
// (Mar 01) instead of the nearest bucket by raw distance (Mar 08).

// Static 2-week reference — a dashed BarsLine overlay, not a fabricated third bucket.
const WEEKLY_AVG_SESSIONS = Math.round(
  (WEEKLY_DIGEST[0]!.sessions + WEEKLY_DIGEST[1]!.sessions) / 2,
)

function WeeklyDigestChart({ chartId }: { chartId: string }) {
  return (
    <Bars
      data={WEEKLY_DIGEST}
      height={260}
      chartId={chartId}
      getX={(d) => d.date}
      cursorResolution="leading"
      getValue={(d, key) =>
        key === 'sessions' ? d.sessions : key === 'trend' ? WEEKLY_AVG_SESSIONS : null
      }
      positiveBars={[{ key: 'sessions', label: 'Sessions', color: demoColors.sessions }]}
      lines={[
        {
          key: 'trend',
          label: '2-week average',
          color: VX.line,
          dashed: true,
          // Dims the stroke + legend swatch (BarsLine.strokeOpacity, same field as
          // SeriesStyle.strokeOpacity) and drops the tooltip row entirely (tooltip: false) — a
          // static reference, not a per-day measurement.
          strokeOpacity: 0.5,
          tooltip: false,
        },
      ]}
      y={{ format: fmtInt, nice: true }}
      legend={{ placement: 'bottom' }}
    />
  )
}

function ChannelMixCard() {
  const [pending, setPending] = useState(false)

  return (
    <ChartCard
      title="Channel mix"
      subtitle="Share of acquisition by channel"
      info="A donut over four channels; hover a slice for its share of total. The switch previews isPending — the 'query in flight' state stays distinct from 'measured and empty', so a loading chart never reads as a chart with no data."
      actions={
        <Switch
          size="xs"
          label="Pending"
          checked={pending}
          onChange={(e) => setPending(e.currentTarget.checked)}
        />
      }
    >
      <Donut
        data={CHANNEL_MIX as DonutDatum[]}
        height={260}
        colorForKey={demoColor}
        seriesLabel={(k) => CHANNEL_MIX.find((c) => c.key === k)?.label ?? k}
        formatValue={(v) => fmtInt(v)}
        isPending={pending}
        centerContent={
          <div style={{ textAlign: 'center' }}>
            <div style={donutCenterValueStyle}>
              {fmtInt(CHANNEL_MIX.reduce((s, c) => s + c.value, 0))}
            </div>
            <div style={donutCenterLabelStyle}>Total</div>
          </div>
        }
      />
    </ChartCard>
  )
}

export function ChartsPage() {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Every chart below shares one cursor with no provider — hover or tab into any chart and scrub
        with ←/→ (Escape clears), and click a legend entry to hide that series from the plot,
        tooltip, and axis domain together.
      </Text>

      {/* ── Linked time series: one shared cursor across every date-aligned chart, no wrapper ── */}
      <Stack gap="sm">
        <ChartCard
          title="Health score"
          subtitle="A composite 0–100 with zone bands, an x-range band, and a target threshold"
          info="Zones frame at-risk / watch / healthy; the shaded taper-week band marks Mar 08–14; a second, edge-aligned band pins the Mar 12 peak to one full step (align: 'edge' — the same from === to band would render nothing under the default 'center' alignment); the dashed reference marks the 80 goal. The tooltip appends an extraRow comparing today's score to that goal, gated on the same hidden set the legend toggles. tooltip.onFollow: true also makes THIS chart render its tooltip when a sibling below owns the cursor, not only when it's the hovered one."
        >
          <ZonedLine<DayPoint>
            data={SERIES_DATA}
            height={300}
            chartId="charts-health"
            getX={(d) => d.date}
            series={[
              {
                key: 'health',
                label: 'Health',
                color: demoColors.sessions,
                mark: 'line',
                getValue: (d) => d.health,
              },
            ]}
            y={{ domain: [0, 100], format: (v) => `${Math.round(v)}` }}
            zones={HEALTH_ZONES}
            xZones={[
              { from: 'Mar 08', to: 'Mar 14', fill: alpha(VX.accent, 0.05) },
              { from: 'Mar 12', to: 'Mar 12', fill: alpha(VX.goodSolid, 0.18), align: 'edge' },
            ]}
            thresholds={[{ value: 80, side: 'above', fill: alpha(VX.goodSolid, 0.14) }]}
            refLines={[{ value: 80, color: VX.goodRef, dashed: true }]}
            areaFill={demoColors.sessions}
            tooltip={{
              label: (d) => zoneLabel(d.health),
              extraRows: healthExtraRow,
              onFollow: true,
            }}
            ariaLabel="Health score trend, 0 to 100, March 1 to 14"
          />
        </ChartCard>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <ChartCard
            title="Volume mix"
            subtitle="Stacked daily totals across three series"
            info="A stacked-area band per series — opaque fills so lower bands never leak through."
          >
            <StackedArea<DayPoint>
              data={SERIES_DATA}
              height={260}
              chartId="charts-volume"
              getX={(d) => d.date}
              series={STACK_GROUPS.map((g) => ({
                key: g,
                label: g[0]!.toUpperCase() + g.slice(1),
                color: demoColor(g),
                mark: 'area' as const,
                getValue: (d: DayPoint) => (d[g as keyof DayPoint] as number) ?? 0,
              }))}
              y={{ format: fmtInt }}
            />
          </ChartCard>

          <ChartCard
            title="Training load"
            subtitle="Acute vs chronic, with the signed gap below"
            info="Top: 7-day acute load over the 28-day chronic baseline, the gap shaded; a warning dot flags overreach days (divergence ≥ 10) via getMarker, drawn flat via ring: false + fillOpacity instead of the default punched-out ring. Bottom: the signed acute − chronic divergence — its tooltip row cites building/recovering via formatBar (formatBottom keeps owning the ticks). Both panes share one cursor with every other chart on this page. bottomMaxAbsFloor is set to 8, below this data's real max-abs of 13, so it's a floor that doesn't currently amplify anything — not a clamp. onFollow renders this chart's tooltip when a SIBLING owns the cursor too, anchored to the shared crosshair, not only when this chart is the one hovered."
          >
            <DualPanel<LoadPoint>
              data={LOAD_TREND}
              height={300}
              chartId="charts-load"
              getX={(d) => d.date}
              series={[
                {
                  key: 'acute',
                  label: 'Acute (7d)',
                  color: demoColors.sessions,
                  mark: 'line',
                  getValue: (d) => d.acute,
                  getMarker: (d) =>
                    d.divergence >= 10
                      ? { color: VX.warnSolid, ring: false, fillOpacity: 0.85 }
                      : null,
                },
                {
                  key: 'chronic',
                  label: 'Chronic (28d)',
                  color: VX.line,
                  mark: 'line',
                  dash: 'dashed',
                  getValue: (d) => d.chronic,
                },
              ]}
              fillBetween={{
                from: 'acute',
                to: 'chronic',
                fill: alpha(demoColors.sessions, 0.1),
              }}
              getBar={(d) => d.divergence}
              barLabel="Divergence"
              barColorPositive={VX.goodSolid}
              barColorNegative={VX.warnSolid}
              formatTop={(v) => fmtInt(v)}
              formatBottom={(v) => fmtSigned(v)}
              formatBar={(v, d) =>
                `${fmtSigned(v)} · ${d.acute > d.chronic ? 'building' : 'recovering'}`
              }
              bottomYDomain="auto"
              bottomMaxAbsFloor={8}
              // Renders its own tooltip as a cursor FOLLOWER too, anchored to the shared crosshair —
              // hover "Health score" above and this one reads along instead of showing a bare line.
              onFollow
            />
          </ChartCard>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          <ChartCard
            title="Sessions vs revenue"
            subtitle="Two series, same date axis, independent scales — left axis counts, right axis $k"
            info="Dual-axis composition: sessions and revenue share the calendar but not a y-scale. Composed straight from CartesianChart (series + y2) since no kind exposes independent left/right line axes. tooltip.onFollow: true also renders this chart's tooltip as a cursor FOLLOWER, anchored to the shared crosshair, when Health score or Training load is hovered instead."
          >
            <SessionsRevenueChart data={SERIES_DATA} chartId="charts-sessions-revenue" />
          </ChartCard>

          <ChartCard
            title="Weekly digest"
            subtitle="2 weekly buckets over the same Mar 01–14 calendar"
            info="No ChartCursorScope, no provider — hover either chart above or this one and the crosshair moves on all of them. This chart folds 14 days into 2 points keyed by each week's leading day (Mar 01, Mar 08) and passes cursorResolution: leading, so a daily hover anywhere inside a week — even the back half, e.g. Mar 05 — lands on the week that actually CONTAINS it, not just the nearest one by raw distance. The dashed 2-week-average line is a BarsLine: dimmed via strokeOpacity (stroke + legend swatch only) and excluded from the tooltip via tooltip: false, since it's a static reference, not a measurement. The y axis also opts into AxisConfig.nice, rounding its tick bounds outward."
          >
            <WeeklyDigestChart chartId="charts-weekly-digest" />
          </ChartCard>
        </SimpleGrid>
      </Stack>

      {/* ── Standalone kinds ────────────────────────────────────────────────────────── */}
      <ChartCard
        title="Estimated 1RM trend"
        subtitle="Three lifts — solid e1RM, dashed 4-session average, ★ marks a new PR"
        info="MultiLine: N series on one axis. Hover the legend to dim the rest, click an entry to hide it; stars mark personal records; the dashed moving-average companion folds under its lift's legend entry as a compact sub-row. formatX reformats the raw 'S1'..'S12' session keys into '#1'..'#12' on the x-axis."
      >
        <MultiLine<LiftPoint>
          data={LIFT_TREND}
          height={300}
          chartId="charts-1rm"
          getX={(d) => d.session}
          formatX={(key) => `#${key.slice(1)}`}
          y={{ domain: 'auto', format: fmtKg }}
          markerShape="star"
          series={[
            ...LIFTS.map((l) => ({
              key: l.key,
              label: l.label,
              color: l.color,
              mark: 'line' as const,
              getValue: (d: LiftPoint) => d[l.key as 'bench' | 'squat' | 'dead'],
              getMarker: (d: LiftPoint) => (l.pr(d) ? { color: VX.status.excellent } : null),
            })),
            ...LIFTS.map((l) => ({
              key: `${l.key}-ma`,
              label: `${l.label} MA`,
              color: l.color,
              mark: 'line' as const,
              legend: false,
              parent: l.key,
              dash: 'dashed' as const,
              strokeWidth: 1.5,
              getValue: (d: LiftPoint) => d[`${l.key}Ma` as 'benchMa' | 'squatMa' | 'deadMa'],
            })),
          ]}
        />
      </ChartCard>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <ChartCard
          title="Activity by hour"
          subtitle="Sessions across the day-of-week × hour grid — self-measuring, like every kind"
          info="Heatmap measures its own container (fixed height here, like every other kind) — no wrapper needed. Each cell's opacity scales with its value."
        >
          <Heatmap<HeatCell>
            data={ACTIVITY_HEATMAP}
            height={300}
            chartId="charts-heat"
            getRow={(d) => d.day}
            getCol={(d) => d.hour}
            getValue={(d) => d.sessions}
            color={demoColors.sessions}
            formatValue={(v) => `${v} sessions`}
            legend={{ min: 'quiet', max: 'busy' }}
            ariaLabel="Session activity by day of week and hour"
          />
        </ChartCard>

        <ChannelMixCard />
      </SimpleGrid>

      {/* ── Regression guard: deliberately high-cardinality legend ────────────────── */}
      <ChartCard
        title="Weekly channel volume"
        subtitle="4 stacked channels + a 3-week average + 3 threshold refs — 8 legend entries"
        info="Regression guard for the weekly-volume overlap class: role-grouped legend (series / overlay / reference) with flexWrap and a maxRows rollup, all derived from one series array. Click any entry — a channel, the average, or a threshold — to hide it; the stack, the line, and the axis domain all update together. Each channel's tooltip row also cites its share of that week's total via formatValue's second (datum) argument; the average line's stroke and legend swatch are dimmed with strokeOpacity, while its tooltip row and crosshair dot stay full-strength. The tooltip header itself is renamed from the raw 'W3' key to 'Week 3' via tooltip.formatHeader."
      >
        <ChannelVolumeChart data={CHANNEL_VOLUME} chartId="charts-channel-volume" />
      </ChartCard>
    </Stack>
  )
}
