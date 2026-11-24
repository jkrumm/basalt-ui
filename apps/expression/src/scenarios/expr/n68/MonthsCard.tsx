import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N68_SERIES } from '../../../demo/series'
import { MONTH_NAMES, type MonthHours } from './fixture'

const USABLE = { light: BASALT.brand, dark: BASALT.brand }
const MINUS = '\u2212'

/** The months as one run when they are consecutive, else a list. */
function monthsLabel(months: readonly MonthHours[]): string {
  const at = months.map((m) => MONTH_NAMES.indexOf(m.month as (typeof MONTH_NAMES)[number]))
  const run = at.every((v, i) => i === 0 || v === (at[i - 1] ?? 0) + 1)
  const first = months[0]
  const last = months.at(-1)
  if (first === undefined || last === undefined) return ''
  if (run && months.length > 2) return `${first.month} to ${last.month}`
  return months.map((m) => m.month).join(', ')
}

const COST = 'Ridge cost'

const hours = (v: number): string => `${v} h`

const readMonth = ({ month, behind, flat, cost }: MonthHours): string =>
  `${month}: ${behind} of ${flat} h, ${COST} ${cost} h`

const isRun = (months: readonly MonthHours[]): boolean => {
  const at = months.map((m) => MONTH_NAMES.indexOf(m.month as (typeof MONTH_NAMES)[number]))
  return at.every((v, i) => i === 0 || v === (at[i - 1] ?? 0) + 1)
}

export function MonthsCard({
  months,
  bortle,
  phase,
  empty,
}: {
  months: readonly MonthHours[]
  bortle: number
  phase: Phase
  empty: { cause: string } | null
}) {
  const ready = phase === 'ready'
  const focus = useChartFocus(months, {
    announce: readMonth,
  })
  const open = months.filter((m) => m.behind > 0)
  const blocked = months.filter((m) => m.flat > 0 && m.behind === 0)
  const behind = months.reduce((sum, m) => sum + m.behind, 0)
  const cost = months.reduce((sum, m) => sum + m.cost, 0)
  const first = open[0]
  const last = open.at(-1)
  const zone =
    first !== undefined && last !== undefined && isRun(open) && open.length < months.length
      ? [
          {
            axis: 'x' as const,
            from: first.month,
            to: last.month,
            fill: alpha(BASALT.ink, 0.06),
            label: `Usable ${monthsLabel(open)}`,
          },
        ]
      : []
  return (
    <ChartCard
      title="Usable core hours by month"
      subtitle="Cloud-free year; each label is out of the total"
      phase={phase}
      empty={empty}
      height="tall"
      figure={{
        value: ready ? behind : null,
        unit: 'h',
        delta: ready
          ? {
              value: `${MINUS}${cost} h`,
              polarity: 'neutral',
              label: 'vs flat horizon',
            }
          : undefined,
        period: ready ? focus.readout(`in ${open.length} of 12 months`, readMonth) : '',
      }}
      footer={[
        {
          label: 'Never clears',
          value: ready ? (blocked.length === 0 ? '0 months' : monthsLabel(blocked)) : '',
        },
        { label: 'Sky class', value: ready ? `Bortle ${bortle}` : '' },
      ]}
      chart={() => (
        <Bars
          label="Bars for each month, stacked"
          data={months}
          focus={focus}
          tooltip={false}
          cursor="months"
          x={{ value: (d) => d.month, ticks: MONTH_NAMES }}
          y={{ title: 'Hours' }}
          zones={zone}
          series={[
            {
              mark: 'bar',
              key: 'behind',
              label: 'Usable',
              color: USABLE,
              y: (d) => d.behind,
              format: hours,
              values: (_, { behind, flat }) => (flat === 0 ? '0' : `${behind}/${flat}`),
            },
            {
              mark: 'bar',
              key: 'cost',
              label: COST,
              color: N68_SERIES.cost,
              y: (d) => d.cost,
              format: hours,
            },
          ]}
        />
      )}
    />
  )
}
