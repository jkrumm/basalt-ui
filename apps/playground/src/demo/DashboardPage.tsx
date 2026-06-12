/**
 * Dashboard page — KPI tiles (each with a sparkline) + a grouped Bars chart with a left/right axis,
 * a reference line, an interactive legend, and a page-header action portalled into the shell top
 * bar via `PageActions`.
 *
 * Exercises: ChartCard, ChartLegend (highlight state), Bars kind (grouped layout, dual axis,
 * refLines, tooltip), LineSparkline / BarSparkline, PageActions, the app-side `demoColors` series
 * tokens, and `alpha()`.
 */
import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import {
  alpha,
  BarSparkline,
  Bars,
  ChartCard,
  ChartLegend,
  type LegendEntry,
  LineSparkline,
  VX,
} from 'basalt-ui/charts'
import { PageActions } from 'basalt-ui'
import { useState } from 'react'
import { type DayPoint, SERIES_DATA, SPARK_REVENUE, SPARK_SESSIONS, SPARK_SIGNUPS } from './data'
import { demoColors } from './series'
import { useMeasureWidth } from './use-measure'

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US')
const fmtMoney = (v: number) => `$${v.toFixed(1)}k`

type Kpi = {
  key: string
  label: string
  value: string
  delta: string
  color: string
  spark: number[]
  bar?: boolean
}

const KPIS: Kpi[] = [
  {
    key: 'sessions',
    label: 'Sessions',
    value: fmtInt(SERIES_DATA.reduce((s, d) => s + d.sessions, 0)),
    delta: '+12.4%',
    color: demoColors.sessions ?? VX.line,
    spark: SPARK_SESSIONS,
  },
  {
    key: 'signups',
    label: 'Signups',
    value: fmtInt(SERIES_DATA.reduce((s, d) => s + d.signups, 0)),
    delta: '+8.1%',
    color: demoColors.signups ?? VX.line,
    spark: SPARK_SIGNUPS,
    bar: true,
  },
  {
    key: 'revenue',
    label: 'Revenue',
    value: fmtMoney(SERIES_DATA.reduce((s, d) => s + d.revenue, 0)),
    delta: '+18.9%',
    color: demoColors.revenue ?? VX.line,
    spark: SPARK_REVENUE,
  },
]

const LEGEND: LegendEntry[] = [
  { key: 'sessions', label: 'Sessions', color: demoColors.sessions ?? VX.line, shape: 'bar' },
  { key: 'signups', label: 'Signups', color: demoColors.signups ?? VX.line2, shape: 'bar' },
  { key: 'churn', label: 'Churn %', color: demoColors.churn ?? VX.badSolid, shape: 'line' },
]

export function DashboardPage() {
  const [ref, width] = useMeasureWidth()
  const [highlighted, setHighlighted] = useState<string | null>(null)

  return (
    <Stack gap="sm">
      <PageActions>
        <Button size="xs" variant="default">
          Export
        </Button>
      </PageActions>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        {KPIS.map((kpi) => (
          <Paper key={kpi.key} p="sm" radius="md" withBorder>
            <Group justify="space-between" align="flex-start" mb={6}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                {kpi.label}
              </Text>
              <Badge size="sm" variant="light" color="green">
                {kpi.delta}
              </Badge>
            </Group>
            <Text fz={28} fw={700} lh={1}>
              {kpi.value}
            </Text>
            <Box mt="xs">
              {kpi.bar ? (
                <BarSparkline data={kpi.spark} width={220} height={36} color={kpi.color} />
              ) : (
                <LineSparkline data={kpi.spark} width={220} height={36} color={kpi.color} />
              )}
            </Box>
          </Paper>
        ))}
      </SimpleGrid>

      <ChartCard
        title="Acquisition"
        subtitle="Daily sessions and signups, with churn % on the right axis"
        tooltip="Grouped bars share the left axis; the churn line reads against the right axis. Hover a legend entry to isolate a series."
        extra={
          <Text size="xs" c="dimmed">
            Last 14 days
          </Text>
        }
      >
        <Box ref={ref}>
          <Bars<DayPoint>
            data={SERIES_DATA}
            width={width}
            height={300}
            chartId="dashboard-acquisition"
            getX={(d) => d.date}
            getValue={(d, key) => (d[key as keyof DayPoint] as number) ?? null}
            barLayout="grouped"
            positiveBars={[
              { key: 'sessions', label: 'Sessions', color: demoColors.sessions ?? VX.line },
              {
                key: 'signups',
                label: 'Signups',
                color: demoColors.signups ?? VX.line2,
                weight: 0.8,
              },
            ]}
            lines={[
              {
                key: 'churn',
                label: 'Churn %',
                color: demoColors.churn ?? VX.badSolid,
                axisSide: 'right',
                formatValue: (v) => `${v.toFixed(0)}%`,
              },
            ]}
            refLines={[
              { value: 1000, color: alpha(VX.neutral, 0.4), dashed: true, axisSide: 'left' },
            ]}
            leftAxis={{ domain: 'auto', formatTick: (v) => fmtInt(v) }}
            rightAxis={{ domain: [0, 20], formatTick: (v) => `${v}%`, numTicks: 4 }}
            formatValue={(v) => fmtInt(v)}
            highlightedKey={highlighted}
          />
        </Box>
        <ChartLegend items={LEGEND} highlighted={highlighted} onHighlight={setHighlighted} />
      </ChartCard>
    </Stack>
  )
}
