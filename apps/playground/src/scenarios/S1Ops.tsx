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
import { PageBar, Section, StatCard, StatGroup } from 'basalt-ui'
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
  OUTAGES,
  UPTIME_PCT,
  WINDOW_LABEL,
  fmtDuration,
  fmtLoss,
  fmtMbit,
  latencyBand,
  fmtMs,
  fmtStamp,
  fmtUptime,
  lineState,
} from './ops-data'
import type { HourRow, LatencyBin, Outage } from './ops-data'
import { RETRY_ACTION } from './retry-action'
import { chartStateFor, queryFor, retryCopy } from './shot-state'
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

const PROBE_ERROR = 'The probe did not answer. Retry, or check that the monitor is running.'
const PROBE_EMPTY = 'No readings in the window. Check that the probe is reporting.'

const retry = (what: string): string => retryCopy(what, 'probe')

const columns = (() => {
  const col = createColumnHelper<Outage>()
  return [
    col.accessor('start', { header: 'Start (UTC)', cell: (c) => fmtStamp(c.getValue()) }),
    col.accessor('end', { header: 'End (UTC)', cell: (c) => fmtStamp(c.getValue()) }),
    col.accessor('minutes', {
      header: 'Duration',
      cell: (c) => fmtDuration(c.getValue()),
      meta: { align: 'right', numeral: true },
    }),
    col.accessor('cause', { header: 'Cause' }),
  ]
})()

function OpsStats({ shotState }: ScenarioProps) {
  const isAtRest = shotState === undefined
  const query = queryFor(shotState, PROBE_ERROR)
  // The empty branch says why and what to do in one muted line. Computed once for all three cards.
  const shared = {
    emptyText: PROBE_EMPTY,
    ...(query !== undefined && { query }),
  }

  return (
    <StatGroup cols={3}>
      <Box data-shot="latency-now" h="100%">
        <StatCard
          title="Latency"
          qualifier="last minute"
          value={fmtMs(LATENCY_NOW_MS)}
          info="Round-trip time in the last minute. The sparkline shows the last 60 minutes; the change compares with the 7-day median hour."
          {...(isAtRest && {
            delta: (LATENCY_NOW_MS / LATENCY_MEDIAN_7D_MS - 1) * 100,
            deltaPeriod: 'vs 7-day median',
            deltaPolarity: 'up-bad' as const,
          })}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel="Latency per minute, last 60 minutes, ms"
                data={MINUTE_LATENCY}
                {...size}
              />
            </Box>
          )}
        />
      </Box>
      <Box data-shot="packet-loss" h="100%">
        <StatCard
          title="Packet loss"
          qualifier="24 hours"
          value={fmtLoss(LOSS_24H_PCT)}
          info="Share of probe packets with no reply, averaged over the hourly buckets."
          {...(isAtRest && {
            breakdown: [
              { label: 'Last 7 days', value: fmtLoss(LOSS_7D_PCT) },
              { label: 'Uptime, 7 days', value: fmtUptime(UPTIME_PCT) },
            ],
          })}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel="Packet loss per hour, last 24 hours, percent"
                data={LOSS_24H_SERIES}
                {...size}
              />
            </Box>
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
          {...(isAtRest && {
            breakdown: [
              { label: 'Contracted', value: fmtMbit(CONTRACT_DOWN_MBIT) },
              { label: '7-day peak', value: fmtMbit(DOWN_PEAK_MBIT) },
            ],
          })}
          {...shared}
          sparkline={(size) => (
            <Box data-shot-hover>
              <Sparkline
                ariaLabel="Download per hour, last 24 hours, Mbit/s"
                data={DOWN_24H_SERIES}
                {...size}
              />
            </Box>
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
            error: retry('Line state'),
          })}
          {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
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
              error: retry('Throughput'),
            })}
            {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
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
              error: retry('The latency distribution'),
            })}
            {...(shotState === 'error' && { stateAction: RETRY_ACTION })}
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
  const query = queryFor(shotState, retry('Outages'))
  return (
    <Box data-shot="outages" h="100%">
      <Section title={`Outages, ${WINDOW_LABEL}`}>
        <BasaltDataTable
          // Rows only at rest: the empty branch needs `data` empty, the others have no rows yet.
          data={shotState === undefined ? OUTAGE_ROWS : NO_OUTAGES}
          columns={columns}
          enableSorting={false}
          {...(query !== undefined && { query })}
          emptyState={<span>No outage in {WINDOW_LABEL}. The line stayed up.</span>}
        />
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
