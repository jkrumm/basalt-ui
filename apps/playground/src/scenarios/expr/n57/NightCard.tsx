import { text } from '@tanstack/charts/text'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels } from 'basalt-ui/charts'
import type { ChartZone, Series } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { DARKSITE_SERIES } from '../../../demo/series'
import type { Slot } from './fixture'
import { cellName, clock, hoursText, percentText } from './format'
import { CLEAR, WORTH, longest } from './summary'
import type { Cell } from './summary'

const TICKS = [19, 21, 23, 25, 27, 29]

const SERIES: readonly Series<Slot>[] = [
  {
    mark: 'line',
    key: 'total',
    label: 'Total',
    color: DARKSITE_SERIES.total,
    weight: 'strong',
    legend: false,
    y: (s) => s.total,
  },
  {
    mark: 'line',
    key: 'low',
    label: 'Low',
    color: DARKSITE_SERIES.low,
    weight: 'quiet',
    legend: false,
    y: (s) => s.low,
  },
  {
    mark: 'line',
    key: 'mid',
    label: 'Mid',
    color: DARKSITE_SERIES.mid,
    weight: 'quiet',
    legend: false,
    y: (s) => s.mid,
  },
  {
    mark: 'line',
    key: 'high',
    label: 'High',
    color: DARKSITE_SERIES.high,
    weight: 'quiet',
    dash: true,
    legend: false,
    y: (s) => s.high,
  },
]

/** The hours the moon is up, over the slots the chart draws. */
function moonSpan(slots: readonly Slot[]): readonly [number, number] | null {
  const up = slots.filter((s) => s.moonUp)
  const first = up[0]
  const last = up.at(-1)
  return first === undefined || last === undefined ? null : [first.at, last.at + 0.5]
}

/** The moon-up span and each usable spell as x zones; the longest spell carries its window. */
function zonesOf(cell: Cell): ChartZone[] {
  const moon = moonSpan(cell.slots)
  const best = longest(cell.spells)
  const zones: ChartZone[] = cell.spells.map(([from, to]) => ({
    axis: 'x',
    from,
    to,
    fill: alpha(BASALT.ink, 0.22),
    ...(best !== null && from === best[0] ? { label: 'Usable' } : {}),
  }))
  if (moon !== null) {
    zones.push({
      axis: 'x',
      from: moon[0],
      to: moon[1],
      fill: alpha(BASALT.inkMuted, 0.08),
      label: 'Moon up',
    })
  }
  return zones
}

function NightChart({ cell, height }: { cell: Cell; height: number | 'fill' }) {
  const last = cell.slots.at(-1)
  return (
    <CartesianChart
      label="Low, mid and high layers through the dark"
      height={height}
      data={cell.slots}
      x={{ value: (s) => s.at, format: (x) => clock(Number(x)), ticks: TICKS }}
      y={{ title: 'Sky covered, %', domain: [0, 100] }}
      series={SERIES}
      zones={zonesOf(cell)}
      refLines={[
        {
          value: CLEAR,
          color: DARKSITE_SERIES.limit,
          dashed: true,
          label: `Clear under ${CLEAR} %`,
        },
      ]}
      tooltip={{ formatHeader: (s) => clock(s.at) }}
      marks={CartesianChart.custom<Slot>((plot) => {
        if (last === undefined) return []
        const x = plot.x(last.at)
        if (x === null) return []
        const ends = [
          ['total', 'Total', last.total],
          ['low', 'Low', last.low],
          ['mid', 'Mid', last.mid],
          ['high', 'High', last.high],
        ] as const
        const { placed } = chartLabels.place(
          ends.map(([key, name, value]) => ({ key, text: name, x, y: plot.y(value) })),
          { width: plot.plotWidth, height: plot.plotHeight },
        )
        const valueOf = new Map<string, number>(ends.map(([key, , value]) => [key, value]))
        return [
          text(placed, {
            x: () => last.at,
            y: (l) => valueOf.get(l.key) ?? 0,
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
  )
}

export function NightCard({
  cell,
  phase,
  empty,
  best,
}: {
  cell: Cell | null
  phase: Phase
  empty: string | null
  best: boolean
}) {
  const ready = phase === 'ready' && cell !== null
  const first = cell?.slots[0]
  const last = cell?.slots.at(-1)
  const over = cell !== null && cell.usable >= WORTH
  return (
    <ChartCard
      title="Cloud through the night"
      subtitle="Every half hour of darkness"
      phase={phase}
      empty={empty === null ? null : { cause: empty }}
      height="tall"
      figure={{
        value: ready ? hoursText(cell.usable) : null,
        unit: 'h usable',
        delta: {
          value: ready ? `${over ? '+' : '-'}${hoursText(Math.abs(cell.usable - WORTH))} h` : '',
          polarity: over ? 'up-good' : 'neutral',
          label: ready ? `vs ${WORTH} h bar` : '',
        },
        period: ready ? (best ? 'The best night' : cellName(cell.site.name, cell.night.id)) : '',
      }}
      footer={[
        { label: 'Moon', value: ready ? `${percentText(cell.night.illum)} lit` : '' },
        {
          label: 'Dark',
          value:
            ready && first !== undefined && last !== undefined
              ? `${clock(first.at)}-${clock(last.at)}`
              : '',
          mono: true,
        },
      ]}
      chart={(box) => (cell === null ? null : <NightChart cell={cell} height={box.height} />)}
    />
  )
}
