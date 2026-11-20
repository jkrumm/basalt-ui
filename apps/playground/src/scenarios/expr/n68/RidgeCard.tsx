import { text } from '@tanstack/charts/text'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import { N68_SERIES } from '../../../demo/series'
import type { Bearing } from './fixture'

const PEAK_SPOTS = ['above', 'above-left', 'above-right', 'right', 'left'] as const

const HIGHEST = 'Highest'
const MEAN = 'Mean'

const deg = (v: number): string => `${Math.round(v)}°`

const readBearing = ({ az, highest, mean }: Bearing): string =>
  `${az}°: highest ${deg(highest)}, mean ${deg(mean)}`

export function RidgeCard({
  ridge,
  phase,
  empty,
}: {
  ridge: readonly Bearing[]
  phase: Phase
  empty: { cause: string } | null
}) {
  const ready = phase === 'ready'
  const focus = useChartFocus(ridge, {
    announce: readBearing,
  })
  const top = ridge.reduce<Bearing | undefined>(
    (best, d) => (best === undefined || d.highest > best.highest ? d : best),
    undefined,
  )
  const end = ridge.at(-1)
  const mean = ridge.reduce((sum, d) => sum + d.mean, 0) / Math.max(1, ridge.length)
  const arc = `${ridge[0]?.az ?? 0}° to ${end?.az ?? 0}°`
  return (
    <ChartCard
      title="Ridge height along the core's arc"
      subtitle="Degrees above the horizon at each azimuth"
      phase={phase}
      empty={empty}
      height="auto"
      figure={{
        value: ready && top !== undefined ? deg(top.highest) : null,
        period:
          ready && top !== undefined ? focus.readout(`highest, at ${top.az}°`, readBearing) : '',
      }}
      footer={[
        { label: 'Mean over the arc', value: ready ? deg(mean) : '' },
        { label: 'Arc', value: ready ? arc : '' },
      ]}
      chart={() => (
        <CartesianChart
          label="Altitude by azimuth along the arc"
          data={ridge}
          focus={focus}
          tooltip={false}
          cursor="ridge"
          x={{ value: (d) => d.az, format: (x) => `${x}°`, title: 'Azimuth' }}
          y={{ title: 'Altitude', domain: { floor: 0, pad: 0.2 }, format: deg }}
          series={[
            {
              mark: 'line',
              key: 'highest',
              label: HIGHEST,
              color: N68_SERIES.highest,
              weight: 'strong',
              y: (d) => d.highest,
              format: deg,
              legend: false,
            },
            {
              mark: 'line',
              key: 'mean',
              label: MEAN,
              color: N68_SERIES.mean,
              y: (d) => d.mean,
              format: deg,
              legend: false,
            },
          ]}
          marks={CartesianChart.custom<Bearing>((plot) => {
            if (top === undefined || end === undefined) return []
            const wide = plot.plotWidth > 400
            const meanTop = ridge.reduce((best, d) => (d.mean > best.mean ? d : best), top)
            const anchors = new Map([
              [
                'top',
                {
                  x: top.az,
                  y: top.highest,
                  text: wide ? `${HIGHEST} ${deg(top.highest)}` : HIGHEST,
                },
              ],
              [
                'mean',
                {
                  x: meanTop.az,
                  y: meanTop.mean,
                  text: wide ? `${MEAN} ${deg(meanTop.mean)}` : MEAN,
                },
              ],
            ])
            const { placed } = chartLabels.place(
              [...anchors].map(([key, a]) => ({
                key,
                text: a.text,
                x: plot.x(a.x) ?? 0,
                y: plot.y(a.y),
                spots: PEAK_SPOTS,
                priority: key === 'top' ? 1 : 0,
              })),
              { width: plot.plotWidth, height: plot.plotHeight },
            )
            return [
              text(placed, {
                x: (l) => anchors.get(l.key)?.x ?? 0,
                y: (l) => anchors.get(l.key)?.y ?? 0,
                text: (l) => l.text,
                fontSize: placed[0]?.size ?? 12,
                fill: BASALT.inkMuted,
                dx: (l) => l.dx,
                dy: (l) => l.dy,
                anchor: (l) => l.textAnchor,
              }),
            ]
          })}
        />
      )}
    />
  )
}
