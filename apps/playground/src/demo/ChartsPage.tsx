/**
 * Charts page — the full kind registry + the cross-chart cursor sync.
 *
 * Top block ("Linked time series") wraps three charts that share the Mar 01–14 calendar in a single
 * `ChartHoverSync` — hovering any one paints a ghost crosshair on the others (the feature is dead
 * without the provider). Bottom block shows the standalone kinds: MultiLine (multi-series + dashed
 * MA companions + PR star markers + legend-hover dimming), Heatmap (category×category intensity),
 * and Donut.
 *
 * Exercises: ChartHoverSync · ZonedLine (zones/thresholds/refLines/areaFill/tooltipLabel) ·
 * StackedArea · DualPanel (top lines + fill-between + signed-histogram pane, shared cursor) ·
 * MultiLine · Heatmap (wrapped in ResponsiveChart) · Donut · ChartCard · ZoneSpec · alpha() ·
 * ResponsiveChart (child render-prop with width/height).
 */
import { Box, SimpleGrid, Stack } from '@mantine/core'
import {
  alpha,
  ChartCard,
  ChartHoverSync,
  Donut,
  DualPanel,
  Heatmap,
  MultiLine,
  ResponsiveChart,
  StackedArea,
  VX,
  ZonedLine,
} from 'basalt-ui/charts'
import type { DonutDatum, ZoneSpec } from 'basalt-ui/charts'
import { ACTIVITY_HEATMAP, CHANNEL_MIX, LIFT_TREND, LOAD_TREND, SERIES_DATA } from './data'
import type { DayPoint, HeatCell, LiftPoint, LoadPoint } from './data'
import { demoColor, demoColors } from './series'
import { useMeasureWidth } from './use-measure'

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

const STACK_GROUPS = ['sessions', 'signups', 'revenue'] as const

/** Three lifts, each a solid e1RM line + a dashed 4-session MA companion (no legend entry). */
const LIFTS = [
  { key: 'bench', label: 'Bench', color: demoColors.sessions, pr: (d: LiftPoint) => d.benchPr },
  { key: 'squat', label: 'Squat', color: demoColors.signups, pr: (d: LiftPoint) => d.squatPr },
  { key: 'dead', label: 'Deadlift', color: demoColors.revenue, pr: (d: LiftPoint) => d.deadPr },
] as const

export function ChartsPage() {
  const [lineRef, lineWidth] = useMeasureWidth()
  const [areaRef, areaWidth] = useMeasureWidth()
  const [loadRef, loadWidth] = useMeasureWidth()
  const [multiRef, multiWidth] = useMeasureWidth()

  return (
    <Stack gap="sm">
      {/* ── Linked time series: one cursor across every date-aligned chart ───────────── */}
      <ChartHoverSync>
        <Stack gap="sm">
          <ChartCard
            title="Health score"
            subtitle="A composite 0–100 with zone bands and a target threshold"
            tooltip="Hover any chart in this block — the crosshair tracks the same day across all three. Zones frame at-risk / watch / healthy; the dashed reference marks the 80 goal."
          >
            <Box ref={lineRef}>
              <ZonedLine<DayPoint>
                data={SERIES_DATA}
                width={lineWidth}
                height={300}
                chartId="charts-health"
                getX={(d) => d.date}
                getY={(d) => d.health}
                yDomain={[0, 100]}
                zones={HEALTH_ZONES}
                thresholds={[{ value: 80, side: 'above', fill: alpha(VX.goodSolid, 0.14) }]}
                refLines={[{ value: 80, color: VX.goodRef, dashed: true }]}
                areaFill={demoColors.sessions}
                seriesLabel="Health"
                formatValue={(v) => `${Math.round(v)}`}
                tooltipLabel={(d) => zoneLabel(d.health)}
              />
            </Box>
          </ChartCard>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <ChartCard
              title="Volume mix"
              subtitle="Stacked daily totals across three series"
              tooltip="A stacked-area band per series — opaque fills so lower bands never leak through."
            >
              <Box ref={areaRef}>
                <StackedArea<DayPoint>
                  data={SERIES_DATA}
                  width={areaWidth}
                  height={260}
                  chartId="charts-volume"
                  getX={(d) => d.date}
                  groups={[...STACK_GROUPS]}
                  getValue={(d, g) => (d[g as keyof DayPoint] as number) ?? 0}
                  colorForGroup={demoColor}
                  seriesLabel={(g) => g[0]!.toUpperCase() + g.slice(1)}
                  formatValue={(v) => fmtInt(v)}
                />
              </Box>
            </ChartCard>

            <ChartCard
              title="Training load"
              subtitle="Acute vs chronic, with the signed gap below"
              tooltip="Top: 7-day acute load over the 28-day chronic baseline, the gap shaded. Bottom: the signed acute − chronic divergence. Both panes share one cursor with the charts above."
            >
              <Box ref={loadRef}>
                <DualPanel<LoadPoint>
                  data={LOAD_TREND}
                  width={loadWidth}
                  height={300}
                  chartId="charts-load"
                  getX={(d) => d.date}
                  topLines={[
                    {
                      key: 'acute',
                      label: 'Acute (7d)',
                      color: demoColors.sessions,
                      getY: (d) => d.acute,
                    },
                    {
                      key: 'chronic',
                      label: 'Chronic (28d)',
                      color: VX.line,
                      getY: (d) => d.chronic,
                      dashed: true,
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
              </Box>
            </ChartCard>
          </SimpleGrid>
        </Stack>
      </ChartHoverSync>

      {/* ── Standalone kinds ────────────────────────────────────────────────────────── */}
      <ChartCard
        title="Estimated 1RM trend"
        subtitle="Three lifts — solid e1RM, dashed 4-session average, ★ marks a new PR"
        tooltip="MultiLine: N series on one axis. Hover the legend to dim the rest; stars mark personal records; the dashed companion is the moving average."
      >
        <Box ref={multiRef}>
          <MultiLine<LiftPoint>
            data={LIFT_TREND}
            width={multiWidth}
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
                getY: (d: LiftPoint) => d[l.key as 'bench' | 'squat' | 'dead'],
                getMarker: (d: LiftPoint) => (l.pr(d) ? { color: VX.status.excellent } : null),
              })),
              ...LIFTS.map((l) => ({
                key: `${l.key}-ma`,
                label: `${l.label} MA`,
                color: l.color,
                parent: l.key,
                dashed: true,
                strokeWidth: 1.5,
                legend: false,
                getY: (d: LiftPoint) => d[`${l.key}Ma` as 'benchMa' | 'squatMa' | 'deadMa'],
              })),
            ]}
          />
        </Box>
      </ChartCard>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <ChartCard
          title="Activity by hour"
          subtitle="Sessions across the day-of-week × hour grid — width via ResponsiveChart"
          tooltip="Heatmap wrapped in ResponsiveChart: the width tracks the container via ResizeObserver (debounced 60ms). Each cell's opacity scales with its value."
        >
          {/* ResponsiveChart replaces the useMeasureWidth pattern — proves responsive width. */}
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
            width={260}
            height={260}
            colorForKey={demoColor}
            seriesLabel={(k) => CHANNEL_MIX.find((c) => c.key === k)?.label ?? k}
            formatValue={(v) => fmtInt(v)}
            centerLabel={fmtInt(CHANNEL_MIX.reduce((s, c) => s + c.value, 0))}
            centerSubLabel="total"
          />
        </ChartCard>
      </SimpleGrid>
    </Stack>
  )
}
