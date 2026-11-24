import type { Delta, Verdict } from 'basalt-ui/cards'
import { text } from '@tanstack/charts/text'
import {
  CartesianChart,
  ChartCard,
  chartLabels,
  type ChartFocus,
  type LegendEntry,
  type ChartZone,
} from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { SPEED_SERIES } from '../../../demo/series'
import {
  CONTRACT,
  TESTS_PER_DAY,
  daysUnder,
  runs,
  type Day,
  type Direction,
  type Month,
} from './fixture'

const TITLE: Record<Direction, string> = { down: 'Download', up: 'Upload' }
const NO_TESTS_FILL = alpha(BASALT.ink, 0.04)
const SLOW_FILL = alpha(BASALT.ink, 0.1)
/** A run of days under the normal speed is named on the chart from this length. */
const SLOW_RUN = 4
/** The plot reaches this far over the contracted maximum; a day above it is the kit's off-scale caret. */
const REACH = 1.2
const ACCENT = { light: BASALT.brand, dark: BASALT.brand }

const signed = (fraction: number): string => {
  const pct = Math.round(fraction * 100)
  return `${pct < 0 ? '\u2212' : '+'}${Math.abs(pct)}%`
}

type Props = {
  direction: Direction
  month: Month
  focus: ChartFocus<Day>
  loading: boolean
}

/** One direction's card: the daily median against the contract's three rules, joined to the page's one focus. */
export function DirectionCard({ direction, month, focus, loading }: Props) {
  const f = useFormat()
  const contract = CONTRACT[direction]
  const num = (v: number): string => f.number(v, { maximumFractionDigits: 0 })
  const speed = (d: Day): number | null => d[direction]
  const isBelow = (d: Day): boolean => {
    const v = speed(d)
    return v !== null && v < contract.min
  }
  const vsNormal = (v: number | null): Delta | undefined =>
    v === null
      ? undefined
      : { value: signed(v / contract.normal - 1), polarity: 'up-good', label: 'vs normal' }

  const tested = month.days.filter((d) => speed(d) !== null)
  const slowest = Math.min(
    ...tested.map((d) => (direction === 'down' ? d.downWorst : d.upWorst) ?? Infinity),
  )
  const missing = runs(month.days, (d) => speed(d) === null)
  const slow = runs(month.days, (d) => {
    const v = speed(d)
    return v !== null && v < contract.normal
  }).filter((r) => r.length >= SLOW_RUN)

  const zones: ChartZone[] = [
    ...missing.map((r): ChartZone => ({
      axis: 'x',
      from: r.from.label,
      to: r.to.label,
      fill: NO_TESTS_FILL,
      label: 'No tests',
    })),
    ...slow.map((r): ChartZone => ({
      axis: 'x',
      from: r.from.label,
      to: r.to.label,
      fill: SLOW_FILL,
      label: `${r.length} slow days`,
    })),
  ]

  const cap = contract.max * REACH
  const legend: LegendEntry[] = [
    { key: 'median', label: 'Median test', color: SPEED_SERIES.day, swatch: 'bar' },
    { key: 'below', label: 'Below minimum', color: ACCENT, swatch: 'bar' },
    {
      key: 'minimum',
      label: `Minimum ${contract.min}`,
      color: SPEED_SERIES.minimum,
      swatch: 'dashed',
    },
    {
      key: 'normal',
      label: `Normal ${contract.normal}`,
      color: SPEED_SERIES.normal,
      swatch: 'dashed',
    },
    {
      key: 'maximum',
      label: `Maximum ${contract.max}`,
      color: SPEED_SERIES.maximum,
      swatch: 'dashed',
    },
  ]
  const rest = month.median[direction]
  const belowNow = (d: Day): Verdict | undefined =>
    isBelow(d) ? { tone: 'accent', label: 'Below minimum' } : undefined

  return (
    <ChartCard
      title={TITLE[direction]}
      subtitle={`Median of each day's ${TESTS_PER_DAY} tests`}
      info="A day counts as below the minimum when half of its tests ran under it."
      phase={loading ? 'loading' : undefined}
      legend={legend}
      figure={
        loading
          ? { value: null, unit: 'Mbit/s' }
          : {
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n46, kept as its builder left it: its figure follows focus, built before figure-readout
              value: focus.readout<number | null>(rest, speed),
              unit: 'Mbit/s',
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n46, kept as its builder left it: its figure follows focus, built before figure-readout
              delta: focus.readout<Delta | undefined>(vsNormal(rest), (d) => vsNormal(speed(d))),
              period: focus.readout('April, median of all tests', (d) =>
                d.tests === 0 ? `${d.label}, no tests` : d.label,
              ),
              status: focus.readout<Verdict | undefined>(undefined, belowNow),
            }
      }
      footer={[
        {
          label: 'Days under normal',
          value: loading ? '' : daysUnder(month.days, direction, contract.normal),
        },
        { label: 'Slowest test', value: loading ? '' : `${num(slowest)} Mbit/s` },
      ]}
      chart={() => (
        <CartesianChart
          label={`${TITLE[direction]} speed, median of each day's tests, against the contracted speeds`}
          data={month.days}
          focus={focus}
          tooltip={false}
          cursor={direction}
          x={{
            value: (d) => d.label,
            ticks: month.days.filter((_, i) => i % 7 === 0).map((d) => d.label),
          }}
          y={{
            title: 'Mbit/s',
            domain: ([, hi]) => [0, Math.min(Math.max(hi, contract.max), cap)],
          }}
          series={[
            {
              mark: 'bar',
              key: 'median',
              label: 'Median test',
              color: SPEED_SERIES.day,
              y: speed,
              values: true,
              format: num,
              highlight: isBelow,
            },
          ]}
          refLines={[
            { value: contract.max, color: SPEED_SERIES.maximum, dashed: true },
            { value: contract.normal, color: SPEED_SERIES.normal, dashed: true },
            { value: contract.min, color: SPEED_SERIES.minimum, dashed: true },
          ]}
          zones={zones}
          // cycle-expression-11: the kit drops the true value beside a clamped bar's caret when the neighbours' labels crowd it, so the value is placed here
          marks={CartesianChart.custom<Day>((plot) => {
            const over = plot.rows('median').filter((d) => (speed(d) ?? 0) > cap)
            const { placed } = chartLabels.place(
              over.map((d) => ({
                key: d.id,
                text: num(speed(d) ?? 0),
                x: plot.x(d.label) ?? 0,
                y: plot.y(cap),
              })),
              { width: plot.plotWidth, height: plot.plotHeight },
              { gap: 10 },
            )
            const byId = new Map(over.map((d) => [d.id, d]))
            return [
              text(placed, {
                x: (l) => byId.get(l.key)?.label ?? '',
                y: () => cap,
                text: (l) => l.text,
                dx: (l) => l.dx,
                dy: (l) => l.dy,
                anchor: (l) => l.textAnchor,
                fill: BASALT.ink,
                fontSize: BASALT.text.micro,
              }),
            ]
          })}
        />
      )}
    />
  )
}
