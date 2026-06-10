/**
 * Charts page — the rest of the kind registry: a ZonedLine (zones + threshold fill + reference line
 * + area gradient), a StackedArea, and a Donut. Each is wrapped in a ChartCard; the multi-series
 * charts read their colors from the app-side `demoColors` series tokens.
 *
 * Exercises: ZonedLine (zones / thresholds / refLines / areaFill / tooltip label), StackedArea,
 * Donut (colorForKey + center label), ChartCard, ZoneSpec, and `alpha()` for zone fills.
 */
import { SimpleGrid, Stack } from '@mantine/core'
import {
  alpha,
  ChartCard,
  Donut,
  StackedArea,
  VX,
  ZonedLine,
  type ZoneSpec,
} from 'basalt-ui/charts'
import { CHANNEL_MIX, type DayPoint, SERIES_DATA } from './data'
import { demoColor, demoColors } from './series'
import { useMeasureWidth } from './use-measure'

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')

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

export function ChartsPage() {
  const [lineRef, lineWidth] = useMeasureWidth()
  const [areaRef, areaWidth] = useMeasureWidth()

  return (
    <Stack gap="md">
      <ChartCard
        title="Health score"
        subtitle="A composite 0–100 with zone bands and a target threshold"
        tooltip="Zones frame at-risk / watch / healthy ranges. The threshold fills the area above the target line; the dashed reference marks the 80 goal."
      >
        <div ref={lineRef}>
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
        </div>
      </ChartCard>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ChartCard
          title="Volume mix"
          subtitle="Stacked daily totals across three series"
          tooltip="A stacked-area band per series — opaque fills so lower bands never leak through."
        >
          <div ref={areaRef}>
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
          </div>
        </ChartCard>

        <ChartCard
          title="Channel mix"
          subtitle="Share of acquisition by channel"
          tooltip="A donut over four channels; hover a slice for its share of total."
        >
          <Donut
            data={CHANNEL_MIX}
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
