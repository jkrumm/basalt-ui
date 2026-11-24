import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, type ChartFocus } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { HARBOUR_SERIES } from '../../../demo/series'
import { LIMIT, NEXT_HOURS, OFFSHORE_POINTS, stampOf, type Forecast, type Hour } from './fixture'

const MINUS = '\u2212'

/** The signed distance to the limit, with a true minus. */
function distance(hs: number): string {
  const gap = Math.round((hs - LIMIT) * 10) / 10
  return `${gap < 0 ? MINUS : gap > 0 ? '+' : ''}${Math.abs(gap).toFixed(1)} m`
}

const EMPTY_CAUSE =
  'No forecast has arrived. The model publishes every six hours: check again after the next run.'

export function WaveCard({
  forecast,
  phase,
  focus,
  rows,
}: {
  forecast: Forecast | null
  phase: Phase
  focus: ChartFocus<Hour>
  rows: readonly Hour[]
}) {
  const peak = forecast?.peak ?? null
  const calm = forecast?.calm ?? null
  const ceiling = Math.ceil(Math.max(...rows.map((r) => r.offshoreMax), LIMIT)) + 0.5
  const over = rows.some((r) => r.sea === 'over')
  return (
    <ChartCard
      title="Wave height by hour"
      subtitle="Hourly, UTC"
      info="Significant wave height is the mean of the highest third of waves."
      phase={phase}
      empty={rows.length === 0 ? { cause: EMPTY_CAUSE } : null}
      height="tall"
      figure={{
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n56, kept as its builder left it: its figure follows focus, built before figure-readout
        value: focus.readout(peak?.hs ?? null, (d) => d.hs),
        unit: 'm',
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n56, kept as its builder left it: its figure follows focus, built before figure-readout
        delta: {
          value: focus.readout(peak === null ? '' : distance(peak.hs), (d) => distance(d.hs)),
          polarity: 'up-bad',
          label: 'vs limit',
        },
        period: focus.readout(
          peak === null ? '' : `${peak.tp} s period at peak`,
          (d) => `${d.tp} s period, ${d.stamp}`,
        ),
        periodMono: focus.datum !== null,
      }}
      footer={[
        {
          label: 'Calmest window',
          value:
            calm === null
              ? peak === null
                ? ''
                : `None under ${LIMIT} m`
              : `${calm.from.stamp} to ${calm.to.clock}`,
          mono: calm !== null,
        },
      ]}
      chart={() => (
        <CartesianChart
          label="Hourly wave height at the harbour and at four offshore points"
          data={rows}
          focus={focus}
          tooltip={false}
          x={{ value: (d) => d.at, format: (x) => (x instanceof Date ? stampOf(x) : String(x)) }}
          y={{ title: 'Metres', domain: { floor: 0, ceil: ceiling } }}
          series={[
            ...Array.from({ length: OFFSHORE_POINTS }, (_, k) => ({
              mark: 'line' as const,
              key: `offshore${k}`,
              label: 'Offshore points',
              color: HARBOUR_SERIES.offshore,
              weight: 'quiet' as const,
              ...(k > 0 ? { legend: false as const } : {}),
              y: (d: Hour) => d.offshore[k] ?? null,
            })),
            {
              mark: 'line',
              key: 'harbour',
              label: 'Harbour',
              color: HARBOUR_SERIES.harbour,
              weight: 'strong',
              y: (d) => d.hs,
            },
            ...(over
              ? [
                  {
                    mark: 'dot' as const,
                    key: 'over',
                    label: `Above ${LIMIT} m`,
                    color: HARBOUR_SERIES.over,
                    y: (d: Hour) => (d.sea === 'over' ? d.hs : null),
                  },
                ]
              : []),
          ]}
          zones={[
            ...(rows.length >= NEXT_HOURS
              ? [
                  {
                    axis: 'x' as const,
                    from: rows[0]?.at ?? 0,
                    to: rows[NEXT_HOURS - 1]?.at ?? 0,
                    fill: alpha(BASALT.ink, 0.05),
                    label: 'Next 12 h',
                  },
                ]
              : []),
            ...(calm === null
              ? []
              : [
                  {
                    axis: 'x' as const,
                    from: calm.from.at,
                    to: calm.to.at,
                    fill: alpha(BASALT.brand, 0.14),
                    label: `Calmest, ${calm.mean.toFixed(1)} m`,
                  },
                ]),
          ]}
          refLines={[
            { value: LIMIT, color: HARBOUR_SERIES.limit, dashed: true, label: `Limit ${LIMIT} m` },
            ...(peak === null
              ? []
              : [
                  {
                    value: peak.at,
                    axis: 'x' as const,
                    color: HARBOUR_SERIES.limit,
                    label: `Peak ${peak.clock}`,
                  },
                ]),
          ]}
        />
      )}
    />
  )
}
