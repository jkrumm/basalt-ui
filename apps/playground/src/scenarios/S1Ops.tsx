/**
 * S1 — Ops monitor (stands for linewatch). docs/waves/design-parity/SPEC.md § 2.
 *
 *   Question: Is the line healthy now, and when did it last break?
 *   Decision: Call the ISP or not.
 *
 * Built with today's basalt exports only. Patterns that do not exist yet are left out, not
 * hand-rolled:
 *   - added by Wave 34: Meter — download against the contracted ceiling (a breakdown row and a
 *     reference line stand in for it).
 *   - added by Wave 37: EventList — the up/down transitions (`TRANSITIONS` is ready in ops-data.ts).
 *
 * Anchors for `basalt-ui shot`: every scored component carries `data-shot`; `StatCard`, `ChartCard`
 * and `Section` do not forward `data-*`, so the anchor is the wrapping `Box`.
 */
import { Box, SimpleGrid, Stack } from '@mantine/core'
import { EmptyState, PageBar, Section, StatCard, StatGroup } from 'basalt-ui'
import { BandStrip, Bars, ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import type { BandSpan, BandStripSeries, BarsBar, ChartSeries } from 'basalt-ui/charts'
import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
import { CONTAINER_KEYS, VX } from 'basalt-ui/tokens'
import {
  CEILING_HEADROOM_MBIT,
  CONTRACT_DOWN_MBIT,
  DEGRADED_LOSS_PCT,
  DOWN_24H_MBIT,
  DOWN_24H_SERIES,
  DOWN_PEAK_MBIT,
  HOURLY,
  LAST_OUTAGE,
  LATENCY_BIN_MS,
  LATENCY_DISTRIBUTION,
  LATENCY_MEDIAN_7D_MS,
  LATENCY_NOW_MS,
  LOSS_24H_PCT,
  LOSS_24H_SERIES,
  LOSS_7D_PCT,
  MEASURED_HOURS,
  MINUTE_LATENCY,
  NOW_DATE,
  OUTAGES,
  UPTIME_PCT,
  WINDOW_LABEL,
  fmtDuration,
  fmtFullStamp,
  fmtLoss,
  fmtMbit,
  latencyBand,
  fmtMs,
  fmtStamp,
  fmtUptime,
  lineState,
} from './ops-data'
import type { HourRow, LatencyBin, Outage } from './ops-data'
import { FixedClockTime } from './FixedClockTime'
import { chartStateFor, noop, queryFor, retryCopy } from './shot-state'
import { TableCap } from './table-cap'
import type { ScenarioProps } from './shot-state'

const LINE_STATES: BandStripSeries<HourRow>[] = [
  {
    key: 'up',
    label: 'Up',
    color: VX.neutral,
    fillOpacity: 0.14,
    formatValue: (d) => `${fmtLoss(d.lossPct)} loss`,
  },
  {
    key: 'degraded',
    label: `Loss above ${DEGRADED_LOSS_PCT}%`,
    color: VX.warnSolid,
    formatValue: (d) => `${fmtLoss(d.lossPct)} loss`,
  },
  {
    key: 'down',
    label: 'Outage',
    color: VX.badSolid,
    formatValue: (d) => `${fmtDuration(d.downMinutes)} down`,
  },
]

const bandOf = (d: HourRow): BandSpan => ({ state: lineState(d) })

const THROUGHPUT_SERIES: ChartSeries<HourRow>[] = [
  {
    key: 'down',
    label: 'Download',
    color: VX.accent,
    getValue: (d) => d.downMbit,
    formatValue: fmtMbit,
  },
  {
    key: 'up',
    label: 'Upload',
    color: VX.faint,
    getValue: (d) => d.upMbit,
    formatValue: fmtMbit,
  },
]

const CEILING_LINES = [
  {
    value: CONTRACT_DOWN_MBIT,
    color: VX.faint,
    dashed: true,
    legend: { label: 'Contracted download' },
  },
]

const LATENCY_BARS: BarsBar<LatencyBin>[] = [
  { key: 'hours', label: 'Hours', color: VX.neutral, getValue: (d) => d.hours },
]

const HOURLY_DATA = [...HOURLY]
const LATENCY_DATA = [...LATENCY_DISTRIBUTION]
const OUTAGE_ROWS = [...OUTAGES]
const NO_OUTAGES: Outage[] = []

const columns = (() => {
  const col = createColumnHelper<Outage>()
  return [
    col.accessor('start', {
      header: 'Started',
      cell: (c) => (
        <FixedClockTime date={c.getValue()} now={NOW_DATE} full={fmtFullStamp(c.getValue())} />
      ),
      meta: { kind: 'relative-time' },
    }),
    col.accessor('minutes', { header: 'Duration (min)', meta: { kind: 'number' } }),
    // Scope is a category, not a status: a status chip's hue reads as severity (wan red, dns amber)
    // while the word names only where the line broke.
    col.accessor('scope', {
      header: 'Scope',
      cell: (c) => c.getValue().toUpperCase(),
      meta: { kind: 'text' },
    }),
    // A short cause is one line: no kind, so it never wraps and can fold or pin.
    col.accessor('cause', { header: 'Cause' }),
  ]
})()

function OpsStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  // Loading keeps the rows the loaded card has (delta, breakdown), so its skeleton keeps their lines.
  const keepsRows = isAtRest || shotState === 'loading'
  // Each card names its own source: the failure and the empty cause differ per card, so no two read alike.
  const sharedFor = (source: string, empty: string) => {
    const query = queryFor(shotState, retryCopy(source))
    return { emptyText: empty, ...(query !== undefined && { query }) }
  }

  return (
    <StatGroup cols={3}>
      <Box data-shot="latency-now" h="100%">
        <StatCard
          title="Latency"
          qualifier="last minute"
          value={fmtMs(LATENCY_NOW_MS)}
          info="Round-trip time in the last minute. The sparkline shows the last 60 minutes; the rows give the 7-day median hour and the slowest minute of the last hour."
          {...(keepsRows && {
            breakdown: [
              { label: 'Median, 7 days', value: fmtMs(LATENCY_MEDIAN_7D_MS) },
              { label: 'Peak, last hour', value: fmtMs(Math.max(...MINUTE_LATENCY)) },
            ],
          })}
          {...sharedFor(
            'latency probe',
            'No ping answered in the last minute. Check that the probe is online.',
          )}
          sparkline={(size) => (
            <Sparkline
              ariaLabel="Latency per minute, last 60 minutes, ms"
              data={MINUTE_LATENCY}
              {...size}
            />
          )}
        />
      </Box>
      <Box data-shot="packet-loss" h="100%">
        <StatCard
          title="Packet loss"
          qualifier="24 hours"
          value={fmtLoss(LOSS_24H_PCT)}
          info="Share of probe packets with no reply, averaged over the hourly buckets."
          {...(keepsRows && {
            breakdown: [
              { label: 'Packet loss, 7 days', value: fmtLoss(LOSS_7D_PCT) },
              { label: 'Uptime, 7 days', value: fmtUptime(UPTIME_PCT) },
            ],
          })}
          {...sharedFor(
            'packet-loss counter',
            'The probe sent no packets in the window. Check its test schedule.',
          )}
          sparkline={(size) => (
            <Sparkline
              ariaLabel="Packet loss per hour, last 24 hours, percent"
              data={LOSS_24H_SERIES}
              {...size}
            />
          )}
        />
      </Box>
      <Box data-shot="download" h="100%">
        <StatCard
          title="Download"
          qualifier={`24 hours · contract ${fmtMbit(CONTRACT_DOWN_MBIT)}`}
          value={fmtMbit(DOWN_24H_MBIT)}
          info="Mean measured throughput over the hourly buckets, against the speed in the contract."
          // Wave 34: Meter — the measured share of the ceiling belongs in a Meter; rows are the nearest.
          {...(keepsRows && {
            breakdown: [
              { label: 'Contracted', value: fmtMbit(CONTRACT_DOWN_MBIT) },
              { label: '7-day peak', value: fmtMbit(DOWN_PEAK_MBIT) },
            ],
          })}
          {...sharedFor('speed test', 'No speed test ran in the window. Start one from the probe.')}
          sparkline={(size) => (
            <Sparkline
              ariaLabel="Download per hour, last 24 hours, Mbit/s"
              data={DOWN_24H_SERIES}
              {...size}
            />
          )}
        />
      </Box>
    </StatGroup>
  )
}

function OpsCharts({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm">
      <Box data-shot="availability" h="100%">
        <ChartCard
          title={`Line state per hour, ${WINDOW_LABEL}`}
          info={`One band per hour. An outage is any hour with downtime; loss above ${DEGRADED_LOSS_PCT}% without downtime is degraded. Last outage: ${fmtStamp(LAST_OUTAGE.start)} UTC, ${fmtDuration(LAST_OUTAGE.minutes)}.`}
          state={chartStateFor(shotState, {
            empty: 'No hourly readings in the window. Check that the probe is reporting.',
            error: retryCopy('link monitor'),
          })}
          {...(shotState === 'error' && { onRetry: noop })}
        >
          <Box data-shot-hover data-shot-tooltip>
            <BandStrip<HourRow, Date>
              data={HOURLY_DATA}
              ariaLabel={`Line state per hour, ${WINDOW_LABEL}`}
              x={(d) => d.start}
              states={LINE_STATES}
              getBand={bandOf}
              height={90}
              tooltip={{ onFollow: true }}
            />
          </Box>
        </ChartCard>
      </Box>
      <SimpleGrid type="container" cols={{ base: 1, [CONTAINER_KEYS.regular]: 2 }}>
        <Box data-shot="throughput" h="100%">
          <ChartCard
            title={`Throughput per hour (Mbit/s), ${WINDOW_LABEL}`}
            info="Mean measured speed per hour. The dashed line is the contracted download speed; hours with an outage have no reading."
            state={chartStateFor(shotState, {
              empty:
                'No throughput readings in the window. Check that the speed test is scheduled.',
              error: retryCopy('throughput meter'),
            })}
            {...(shotState === 'error' && { onRetry: noop })}
          >
            <Box data-shot-hover data-shot-tooltip>
              <Lines<HourRow, Date>
                data={HOURLY_DATA}
                ariaLabel={`Download and upload throughput per hour, ${WINDOW_LABEL}, Mbit/s`}
                x={(d) => d.start}
                y={{
                  format: (v: number) => `${Math.round(v)}`,
                  domain: [0, CONTRACT_DOWN_MBIT + CEILING_HEADROOM_MBIT],
                }}
                series={THROUGHPUT_SERIES}
                refLines={CEILING_LINES}
              />
            </Box>
          </ChartCard>
        </Box>
        <Box data-shot="latency-distribution" h="100%">
          <ChartCard
            title="Hours by median latency (ms), last 7 days"
            info={`How many of the ${MEASURED_HOURS} hours with a reading landed in each ${LATENCY_BIN_MS} ms band of median round-trip time. Outage hours have no reading.`}
            state={chartStateFor(shotState, {
              empty: 'No latency readings to bin yet. The histogram needs at least one hour.',
              error: retryCopy('latency log'),
            })}
            {...(shotState === 'error' && { onRetry: noop })}
          >
            <Box data-shot-hover data-shot-tooltip>
              <Bars
                data={LATENCY_DATA}
                ariaLabel={`Hours by median latency, ${LATENCY_BIN_MS} ms bands, last 7 days`}
                x={(d) => d.label}
                bars={LATENCY_BARS}
                tooltip={{ formatHeader: (_, d) => latencyBand(d) }}
              />
            </Box>
          </ChartCard>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}

function OpsOutages({ shotState }: ScenarioProps) {
  const query = queryFor(shotState, retryCopy('outage log'))
  return (
    <Box data-shot="outages" h="100%">
      <Section title={`Outages, ${WINDOW_LABEL}`}>
        <TableCap>
          <BasaltDataTable
            // Rows only at rest: the empty branch needs `data` empty, the others have no rows yet.
            data={shotState === undefined ? OUTAGE_ROWS : NO_OUTAGES}
            columns={columns}
            enableSorting={false}
            skeletonRows={OUTAGE_ROWS.length}
            {...(query !== undefined && { query })}
            emptyState={
              <EmptyState
                tier="section"
                title={`No outage ${WINDOW_LABEL}`}
                description="The line stayed up; any outage the probe sees lists here."
              />
            }
          />
        </TableCap>
      </Section>
    </Box>
  )
}

export function OpsScenario({ shotState }: ScenarioProps) {
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <PageBar />
      <OpsStats shotState={shotState} />
      <OpsCharts shotState={shotState} />
      <OpsOutages shotState={shotState} />
    </Stack>
  )
}
