/**
 * Dashboard page — KPI tiles (each with a sparkline) + a grouped Bars chart with a left/right axis,
 * a reference line, and a page-header action portalled into the shell top bar via `PageActions`.
 *
 * Exercises: ChartCard, Bars kind (grouped layout, dual axis, refLines, its own derived legend +
 * hover-dim, tooltip), LineSparkline / BarSparkline, PageActions, the app-side `demoColors` series
 * tokens, and `alpha()`.
 */
import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { alpha, BarSparkline, Bars, ChartCard, LineSparkline, VX } from 'basalt-ui/charts'
import { useMemo } from 'react'
import { generateDashboardData } from './data'
import type { DateRange, DayPoint } from './data'
import { demoColors } from './series'

const RANGE_LABEL: Record<string, string> = {
  '1d': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

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

export function DashboardPage({ range }: { range?: DateRange }) {
  const resolved = range ?? '30d'
  const { series, sparks } = useMemo(() => generateDashboardData(resolved), [resolved])

  const kpis: Kpi[] = useMemo(
    () => [
      {
        key: 'sessions',
        label: 'Sessions',
        value: fmtInt(series.reduce((s, d) => s + d.sessions, 0)),
        delta: '+12.4%',
        color: demoColors.sessions ?? VX.line,
        spark: sparks.sessions,
      },
      {
        key: 'signups',
        label: 'Signups',
        value: fmtInt(series.reduce((s, d) => s + d.signups, 0)),
        delta: '+8.1%',
        color: demoColors.signups ?? VX.line,
        spark: sparks.signups,
        bar: true,
      },
      {
        key: 'revenue',
        label: 'Revenue',
        value: fmtMoney(series.reduce((s, d) => s + d.revenue, 0)),
        delta: '+18.9%',
        color: demoColors.revenue ?? VX.line,
        spark: sparks.revenue,
      },
    ],
    [series, sparks],
  )

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        {kpis.map((kpi) => (
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
            {RANGE_LABEL[resolved] ?? 'Last 30 days'}
          </Text>
        }
      >
        <Bars<DayPoint>
          data={series}
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
        />
      </ChartCard>
    </Stack>
  )
}
