/**
 * Charts page — the full kind registry + the cross-chart cursor sync. The reference
 * implementation for the `series`-based chart API: every chart passes a `ChartSeries<T>[]` (the
 * single source of truth for color/dash/label/accessor) and gets legend + tooltip + crosshair for
 * free via `ChartFrame` + `useHoverSync` — never hand-authored in parallel.
 *
 * Top block ("Linked time series") wraps four charts that share the Mar 01–14 calendar in a single
 * `ChartHoverSync` — hovering any one paints a ghost crosshair on the others (the feature is dead
 * without the provider). Bottom block shows the standalone kinds: MultiLine (multi-series + dashed
 * MA companions + PR star markers + legend-hover dimming), Heatmap (category×category intensity),
 * Donut, and a deliberately high-cardinality regression guard (stacked bars + MA overlay + 3
 * threshold refs = 8 legend entries, exercising flexWrap + role grouping + the maxRows rollup).
 *
 * Sessions-vs-revenue composes `ChartFrame` + `useHoverSync` + `Crosshair`/`SeriesDot` directly —
 * the sanctioned escape hatch for a shape no kind's config surface covers (two independent y-axes
 * on one line pane; forcing sessions' counts and revenue's $k onto one shared axis would flatten
 * the revenue line). The weekly-volume regression guard uses the same escape hatch to reach
 * `ChartFrame`'s `legend.groups`/`legend.maxRows`, which none of the shipped kinds forward.
 *
 * Exercises: ChartHoverSync · ZonedLine (zones/thresholds/refLines/areaFill/tooltipLabel) ·
 * StackedArea · DualPanel (top lines + fill-between + signed-histogram pane, shared cursor) ·
 * MultiLine (dashed MA companions folded as sub-entries under their parent lift's legend entry) ·
 * Heatmap (wrapped in ResponsiveChart) · Donut (categorical legend) · ChartCard · ZoneSpec ·
 * alpha() · ChartFrame + useHoverSync + Crosshair/SeriesDot (bespoke dual-axis + high-cardinality
 * composition — the escape hatch).
 */
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { SimpleGrid, Stack } from '@mantine/core'
import {
  alpha,
  AxisBottomDate,
  AxisLeftNumeric,
  AxisRightNumeric,
  ChartCard,
  ChartFrame,
  ChartHoverSync,
  ChartTooltip,
  Crosshair,
  deriveTooltipRows,
  Donut,
  DualPanel,
  Group as VxGroup,
  GridRows,
  Heatmap,
  HoverOverlay,
  LinePath,
  MultiLine,
  ResponsiveChart,
  scaleLinear,
  scalePoint,
  SeriesDot,
  StackedArea,
  TooltipBody,
  TooltipHeader,
  TooltipRow,
  useHoverSync,
  useTooltipStyles,
  VX,
  ZonedLine,
  smartTicks,
  curveMonotoneX,
} from 'basalt-ui/charts'
import type { ChartSeries, DonutDatum, SeriesStyle, ZoneSpec } from 'basalt-ui/charts'
import {
  ACTIVITY_HEATMAP,
  CHANNEL_MIX,
  CHANNEL_VOLUME,
  LIFT_TREND,
  LOAD_TREND,
  SERIES_DATA,
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

// Donut `centerContent` demo (docs/DESIGN-SPEC.md §3): mono KPI value + a mono micro-label below,
// replacing the plain `centerLabel`/`centerSubLabel` text-only slots with real chrome.
const donutCenterValueStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
  fontSize: 16,
  fontWeight: 600,
  color: VX.ink,
  lineHeight: 1.1,
}

const donutCenterLabelStyle: CSSProperties = {
  fontFamily: 'var(--basalt-font-mono)',
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
// revenue line to a flat band near zero. Composes ChartFrame + useHoverSync + Crosshair/SeriesDot
// directly, driven by the SAME `series` array the legend + tooltip read from.

const SESSIONS_REVENUE_SERIES: ChartSeries<DayPoint>[] = [
  {
    key: 'sessions',
    label: 'Sessions (left axis)',
    color: demoColors.sessions,
    mark: 'line',
    getValue: (d) => d.sessions,
    formatValue: fmtInt,
  },
  {
    key: 'revenue',
    label: 'Revenue ×1k (right axis)',
    color: demoColors.revenue,
    mark: 'line',
    dash: 'dashed',
    getValue: (d) => d.revenue,
    formatValue: (v) => `$${v.toFixed(1)}k`,
  },
]

function SessionsRevenueChart({ data, chartId }: { data: DayPoint[]; chartId: string }) {
  return (
    <ChartFrame
      series={SESSIONS_REVENUE_SERIES}
      chartId={chartId}
      height={260}
      legend={{ placement: 'bottom' }}
    >
      {(plot) => <SessionsRevenuePlot data={data} chartId={chartId} plot={plot} />}
    </ChartFrame>
  )
}

function SessionsRevenuePlot({
  data,
  chartId,
  plot,
}: {
  data: DayPoint[]
  chartId: string
  plot: { width: number; height: number }
}) {
  const [sessionsSeries, revenueSeries] = SESSIONS_REVENUE_SERIES as [
    ChartSeries<DayPoint>,
    ChartSeries<DayPoint>,
  ]

  const MARGIN = useMemo(() => ({ ...VX.margin, right: Math.max(VX.margin.right, 40) }), [])
  const xMax = plot.width - MARGIN.left - MARGIN.right
  const yMax = plot.height - MARGIN.top - MARGIN.bottom

  const xScale = useMemo(
    () => scalePoint<string>({ domain: data.map((d) => d.date), range: [0, xMax], padding: 0.5 }),
    [data, xMax],
  )
  const leftScale = useMemo(() => {
    const max = Math.max(...data.map((d) => d.sessions)) * 1.1
    return scaleLinear<number>({ domain: [0, max], range: [yMax, 0] })
  }, [data, yMax])
  const rightScale = useMemo(() => {
    const max = Math.max(...data.map((d) => d.revenue)) * 1.1
    return scaleLinear<number>({ domain: [0, max], range: [yMax, 0] })
  }, [data, yMax])

  const tooltipStyles = useTooltipStyles()
  const { tip, tooltipRef, syncedPoint, isDirectHover, handleMouse, handleLeave } =
    useHoverSync<DayPoint>({
      data,
      chartId,
      getKey: (d) => d.date,
      xScale,
      marginLeft: MARGIN.left,
    })

  const tickValues = useMemo(
    () =>
      smartTicks(
        data.map((d) => d.date),
        xMax,
      ),
    [data, xMax],
  )

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <VxGroup left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={leftScale} width={xMax} stroke={VX.grid} numTicks={4} />

          <LinePath<DayPoint>
            data={data}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => leftScale(sessionsSeries.getValue(d) ?? 0)}
            stroke={sessionsSeries.color}
            strokeWidth={sessionsSeries.strokeWidth ?? VX.lineWidth}
            curve={curveMonotoneX}
          />
          <LinePath<DayPoint>
            data={data}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => rightScale(revenueSeries.getValue(d) ?? 0)}
            stroke={revenueSeries.color}
            strokeWidth={revenueSeries.strokeWidth ?? VX.lineWidth}
            strokeDasharray={VX.dashArray}
            curve={curveMonotoneX}
          />

          {syncedPoint &&
            (() => {
              const sx = xScale(syncedPoint.date) ?? 0
              return (
                <>
                  <Crosshair x={sx} top={0} bottom={yMax} />
                  <SeriesDot
                    cx={sx}
                    cy={leftScale(syncedPoint.sessions)}
                    color={sessionsSeries.color}
                  />
                  <SeriesDot
                    cx={sx}
                    cy={rightScale(syncedPoint.revenue)}
                    color={revenueSeries.color}
                  />
                </>
              )
            })()}

          <AxisLeftNumeric
            scale={leftScale}
            numTicks={4}
            tickFormat={(v) => String(Math.round(Number(v)))}
          />
          <AxisRightNumeric
            scale={rightScale}
            left={xMax}
            numTicks={4}
            tickFormat={(v) => Number(v).toFixed(1)}
          />
          <AxisBottomDate top={yMax} scale={xScale} tickValues={tickValues} />

          <HoverOverlay width={xMax} height={yMax} onMove={handleMouse} onLeave={handleLeave} />
        </VxGroup>
      </svg>
      <ChartTooltip tip={isDirectHover ? tip : null} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && isDirectHover && (
          <>
            <TooltipHeader date={tip.data.date} />
            <TooltipBody>
              {deriveTooltipRows(SESSIONS_REVENUE_SERIES, tip.data, fmtInt).map((row) => (
                <TooltipRow
                  key={row.key}
                  color={row.color}
                  label={row.label}
                  value={row.value}
                  shape={row.shape}
                  dashed={row.dashed}
                  {...(row.strokeWidth !== undefined && { strokeWidth: row.strokeWidth })}
                />
              ))}
            </TooltipBody>
          </>
        )}
      </ChartTooltip>
    </>
  )
}

// ── Channel volume — high-cardinality legend regression guard ──────────────────
//
// 4 stacked channel bars + a dashed 3-week MA overlay + 3 dashed threshold refs = 8 legend
// entries across `series` (role: 'series' | 'overlay') / 'reference' roles. Bespoke because none
// of the shipped kinds forward `ChartFrame`'s `legend.groups` / `legend.maxRows` — this is the
// only way to reach the flexWrap + role-grouping + rollup primitives directly.

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

const VOLUME_BAR_SERIES: ChartSeries<ChannelVolumePoint>[] = CHANNEL_BAR_DEFS.map((b) => ({
  key: b.key,
  label: b.label,
  color: b.color,
  mark: 'bar' as const,
  fillOpacity: 0.85,
  role: 'series' as const,
  getValue: (d: ChannelVolumePoint) => d[b.key],
}))

const VOLUME_MA_SERIES: ChartSeries<ChannelVolumePoint> = {
  key: 'volume-ma',
  label: '3-week average',
  color: VX.line,
  mark: 'line',
  dash: 'dashed',
  role: 'overlay',
  getValue: (d) => d.ma,
}

const VOLUME_TOOLTIP_SERIES: ChartSeries<ChannelVolumePoint>[] = [
  ...VOLUME_BAR_SERIES,
  VOLUME_MA_SERIES,
]

const VOLUME_THRESHOLD_STYLES: SeriesStyle[] = VOLUME_THRESHOLDS.map((t) => ({
  key: t.key,
  label: t.label,
  color: t.color,
  mark: 'line' as const,
  dash: 'dashed' as const,
  role: 'reference' as const,
}))

const VOLUME_LEGEND_SERIES: SeriesStyle[] = [...VOLUME_TOOLTIP_SERIES, ...VOLUME_THRESHOLD_STYLES]

function ChannelVolumeChart({ data, chartId }: { data: ChannelVolumePoint[]; chartId: string }) {
  return (
    <ChartFrame
      series={VOLUME_LEGEND_SERIES}
      chartId={chartId}
      height={300}
      legend={{ placement: 'bottom', groups: true, maxRows: 6 }}
    >
      {(plot) => <ChannelVolumePlot data={data} chartId={chartId} plot={plot} />}
    </ChartFrame>
  )
}

function ChannelVolumePlot({
  data,
  chartId,
  plot,
}: {
  data: ChannelVolumePoint[]
  chartId: string
  plot: { width: number; height: number }
}) {
  const MARGIN = VX.margin
  const xMax = plot.width - MARGIN.left - MARGIN.right
  const yMax = plot.height - MARGIN.top - MARGIN.bottom

  const xScale = useMemo(
    () => scalePoint<string>({ domain: data.map((d) => d.week), range: [0, xMax], padding: 0.3 }),
    [data, xMax],
  )
  const yScale = useMemo(() => {
    const dataMax = Math.max(...data.map((d) => d.total))
    const thresholdMax = Math.max(...VOLUME_THRESHOLDS.map((t) => t.value))
    const upper = Math.max(dataMax, thresholdMax) * 1.1
    return scaleLinear<number>({ domain: [0, upper], range: [yMax, 0], nice: true })
  }, [data, yMax])

  const tooltipStyles = useTooltipStyles()
  const { tip, tooltipRef, syncedPoint, isDirectHover, handleMouse, handleLeave } =
    useHoverSync<ChannelVolumePoint>({
      data,
      chartId,
      getKey: (d) => d.week,
      xScale,
      marginLeft: MARGIN.left,
    })

  const barWidth = data.length > 0 ? Math.max((xMax / data.length) * 0.6, 2) : 2

  return (
    <>
      <svg width={plot.width} height={plot.height}>
        <VxGroup left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={xMax} stroke={VX.grid} numTicks={5} />

          {VOLUME_THRESHOLDS.map((t) => (
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

          {data.map((d) => {
            const cx = xScale(d.week) ?? 0
            const left = cx - barWidth / 2
            let offset = 0
            return (
              <g key={d.week}>
                {VOLUME_BAR_SERIES.map((s) => {
                  const v = s.getValue(d) ?? 0
                  const top = offset + v
                  const yTop = yScale(top)
                  const yBottom = yScale(offset)
                  offset = top
                  return (
                    <rect
                      key={s.key}
                      x={left}
                      y={yTop}
                      width={barWidth}
                      height={Math.max(yBottom - yTop, 0)}
                      fill={s.color}
                      fillOpacity={s.fillOpacity}
                    />
                  )
                })}
              </g>
            )
          })}

          <LinePath<ChannelVolumePoint>
            data={data}
            x={(d) => xScale(d.week) ?? 0}
            y={(d) => yScale(d.ma)}
            stroke={VOLUME_MA_SERIES.color}
            strokeWidth={VX.lineWidth}
            strokeDasharray={VX.dashArray}
            curve={curveMonotoneX}
          />

          {syncedPoint && (
            <>
              <Crosshair x={xScale(syncedPoint.week) ?? 0} top={0} bottom={yMax} />
              <SeriesDot
                cx={xScale(syncedPoint.week) ?? 0}
                cy={yScale(syncedPoint.ma)}
                color={VOLUME_MA_SERIES.color}
              />
            </>
          )}

          <AxisLeftNumeric scale={yScale} numTicks={5} tickFormat={(v) => fmtInt(Number(v))} />
          <AxisBottomDate top={yMax} scale={xScale} tickValues={data.map((d) => d.week)} />

          <HoverOverlay width={xMax} height={yMax} onMove={handleMouse} onLeave={handleLeave} />
        </VxGroup>
      </svg>
      <ChartTooltip tip={isDirectHover ? tip : null} tooltipRef={tooltipRef} styles={tooltipStyles}>
        {tip && isDirectHover && (
          <>
            <TooltipHeader date={tip.data.week} />
            <TooltipBody>
              {deriveTooltipRows(VOLUME_TOOLTIP_SERIES, tip.data, fmtInt).map((row) => (
                <TooltipRow
                  key={row.key}
                  color={row.color}
                  label={row.label}
                  value={row.value}
                  shape={row.shape}
                  dashed={row.dashed}
                />
              ))}
            </TooltipBody>
          </>
        )}
      </ChartTooltip>
    </>
  )
}

export function ChartsPage() {
  return (
    <Stack gap="sm">
      {/* ── Linked time series: one cursor across every date-aligned chart ───────────── */}
      <ChartHoverSync>
        <Stack gap="sm">
          <ChartCard
            title="Health score"
            subtitle="A composite 0–100 with zone bands and a target threshold"
            tooltip="Hover any chart in this block — the crosshair tracks the same day across all four. Zones frame at-risk / watch / healthy; the dashed reference marks the 80 goal."
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
              yDomain={[0, 100]}
              zones={HEALTH_ZONES}
              thresholds={[{ value: 80, side: 'above', fill: alpha(VX.goodSolid, 0.14) }]}
              refLines={[{ value: 80, color: VX.goodRef, dashed: true }]}
              areaFill={demoColors.sessions}
              formatValue={(v) => `${Math.round(v)}`}
              tooltipLabel={(d) => zoneLabel(d.health)}
            />
          </ChartCard>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <ChartCard
              title="Volume mix"
              subtitle="Stacked daily totals across three series"
              tooltip="A stacked-area band per series — opaque fills so lower bands never leak through."
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
                formatValue={(v) => fmtInt(v)}
              />
            </ChartCard>

            <ChartCard
              title="Training load"
              subtitle="Acute vs chronic, with the signed gap below"
              tooltip="Top: 7-day acute load over the 28-day chronic baseline, the gap shaded. Bottom: the signed acute − chronic divergence. Both panes share one cursor with the charts above."
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
              />
            </ChartCard>
          </SimpleGrid>

          <ChartCard
            title="Sessions vs revenue"
            subtitle="Two series, same date axis, independent scales — left axis counts, right axis $k"
            tooltip="Dual-axis composition: sessions and revenue share the calendar but not a y-scale. Composed from ChartFrame + useHoverSync directly since no kind exposes independent left/right line axes."
          >
            <SessionsRevenueChart data={SERIES_DATA} chartId="charts-sessions-revenue" />
          </ChartCard>
        </Stack>
      </ChartHoverSync>

      {/* ── Standalone kinds ────────────────────────────────────────────────────────── */}
      <ChartCard
        title="Estimated 1RM trend"
        subtitle="Three lifts — solid e1RM, dashed 4-session average, ★ marks a new PR"
        tooltip="MultiLine: N series on one axis. Hover the legend to dim the rest; stars mark personal records; the dashed moving-average companion folds under its lift's legend entry as a compact sub-row."
      >
        <MultiLine<LiftPoint>
          data={LIFT_TREND}
          height={300}
          chartId="charts-1rm"
          getX={(d) => d.session}
          yDomain="auto"
          markerShape="star"
          formatValue={fmtKg}
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
          subtitle="Sessions across the day-of-week × hour grid — width via ResponsiveChart"
          tooltip="Heatmap wrapped in ResponsiveChart: the width tracks the container via ResizeObserver (debounced 60ms). Each cell's opacity scales with its value."
        >
          <ResponsiveChart height={300}>
            {({ width, height }) => (
              <Heatmap<HeatCell>
                data={ACTIVITY_HEATMAP}
                width={width}
                height={height}
                chartId="charts-heat"
                getRow={(d) => d.day}
                getCol={(d) => d.hour}
                getValue={(d) => d.sessions}
                color={demoColors.sessions}
                formatValue={(v) => `${v} sessions`}
                legend={{ min: 'quiet', max: 'busy' }}
              />
            )}
          </ResponsiveChart>
        </ChartCard>

        <ChartCard
          title="Channel mix"
          subtitle="Share of acquisition by channel"
          tooltip="A donut over four channels; hover a slice for its share of total."
        >
          <Donut
            data={CHANNEL_MIX as DonutDatum[]}
            height={260}
            colorForKey={demoColor}
            seriesLabel={(k) => CHANNEL_MIX.find((c) => c.key === k)?.label ?? k}
            formatValue={(v) => fmtInt(v)}
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
      </SimpleGrid>

      {/* ── Regression guard: deliberately high-cardinality legend ────────────────── */}
      <ChartCard
        title="Weekly channel volume"
        subtitle="4 stacked channels + a 3-week average + 3 threshold refs — 8 legend entries"
        tooltip="Regression guard for the weekly-volume overlap class: role-grouped legend (series / overlay / reference) with flexWrap and a maxRows rollup, all derived from one series array."
      >
        <ChannelVolumeChart data={CHANNEL_VOLUME} chartId="charts-channel-volume" />
      </ChartCard>
    </Stack>
  )
}
