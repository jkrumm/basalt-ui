/** One measure of the six machines over 24 hours: a line each, the named ones labelled at their own end. */
import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { CartesianChart, chartLabels } from 'basalt-ui/charts'
import type { ChartFocus, ChartRefLine, ChartZone, Series } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import { HOMELAB_SERIES } from '../../../demo/series'
import { MACHINE_IDS, NOW } from './fixture'
import type { MachineId, Reading, Sample } from './fixture'

/** Room right of the last reading for the end labels. */
const PAD_MS = 6 * 3_600_000
const SIX_HOURS_MS = 6 * 3_600_000

export type Measure = {
  /** What the chart draws for a machine, null where it has no reading. */
  read: (r: Reading, id: MachineId) => number
  /** The y axis name with its unit. */
  title: string
  format: (v: number) => string
  /** The machines past their limit on this card: they take the status red. */
  over: ReadonlySet<MachineId>
  /** The machines named at their line end, with the text each one carries. */
  named: ReadonlyMap<MachineId, string>
  domain?: [number, number]
  refLines?: readonly ChartRefLine[]
  zones?: readonly ChartZone[]
}

type End = { at: number; v: number }

export function MachineLines({
  samples,
  focus,
  measure,
  label,
  height,
}: {
  samples: readonly Sample[]
  focus: ChartFocus<Sample>
  measure: Measure
  label: string
  height: number | 'fill'
}) {
  const f = useFormat()
  const first = samples[0]?.at ?? NOW
  const clock = (x: number | Date | string): string =>
    f.time(new Date(x), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const ticks = samples.filter((s) => s.at % SIX_HOURS_MS === 0).map((s) => new Date(s.at))
  const series = MACHINE_IDS.map((id): Series<Sample> => ({
    mark: 'line',
    key: id,
    label: id,
    color: measure.over.has(id) ? HOMELAB_SERIES.over : HOMELAB_SERIES[id],
    weight: measure.over.has(id) ? 'strong' : 'quiet',
    legend: false,
    y: (s) => {
      const r = s.read[id]
      return r === null ? null : measure.read(r, id)
    },
    format: measure.format,
  }))
  return (
    <CartesianChart
      label={label}
      data={samples}
      height={height}
      focus={focus}
      x={{
        value: (s) => new Date(s.at),
        format: clock,
        domain: [new Date(first), new Date(NOW + PAD_MS)],
        ticks,
      }}
      y={{
        title: measure.title,
        format: measure.format,
        ...(measure.domain && { domain: measure.domain }),
      }}
      series={series}
      refLines={measure.refLines ?? []}
      zones={measure.zones ?? []}
      marks={CartesianChart.custom<Sample>((plot) => {
        const ends = new Map<MachineId, End>()
        for (const id of measure.named.keys()) {
          const last = plot.rows(id).findLast((s) => s.read[id] !== null)
          const r = last?.read[id]
          if (last === undefined || r === null || r === undefined) continue
          ends.set(id, { at: last.at, v: measure.read(r, id) })
        }
        const { placed } = chartLabels.place(
          [...ends].map(([id, end]) => ({
            key: id,
            text: measure.named.get(id) ?? id,
            x: plot.x(new Date(end.at)) ?? 0,
            y: plot.y(end.v),
            priority: measure.over.has(id) ? 1 : 0,
            weight: measure.over.has(id) ? (600 as const) : (400 as const),
          })),
          { width: plot.plotWidth, height: plot.plotHeight },
          { gap: BASALT.dotR + 3 },
        )
        return [
          text(placed, {
            x: (l) => new Date(ends.get(l.key)?.at ?? NOW),
            y: (l) => ends.get(l.key)?.v ?? 0,
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
