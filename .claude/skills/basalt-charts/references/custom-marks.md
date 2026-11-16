# Custom marks: labels in pixels, an x-range zone

A direct label on a custom mark is placed in plot pixels, never in data space with guessed `dx`/`dy`: `plot.x(value)` and `plot.y(value)` give a datum's px on the axis' own scale (time, log, a band key's centre), `chartLabels.place` puts each label on a free spot inside `{ width: plot.plotWidth, height: plot.plotHeight }` clear of the dots you pass as `obstacles`, and the engine `text` mark draws it at its datum with the placed `dx`/`dy`. Its `gap` clears the anchor's own dot, which is one of the obstacles. A label with no clear spot is dropped: the `summary` names what the chart could not.

A region the question asks about (a ride window, the senders to mute) is a zone, never a hand-drawn `rect`: `axis: 'x'` takes an x range (numbers, `Date`s or band keys), `y` bounds it, and `label` names it on the plot.

```tsx
// @check
import { CartesianChart, chartLabels } from 'basalt-ui/charts'
import { VX, alpha } from 'basalt-ui/tokens'
import { text } from '@tanstack/charts/text'

type Sender = { id: string; name: string; perWeek: number; openPct: number }

const color = { light: VX.brand, dark: VX.brand }

export function MuteCandidates({
  senders,
  worst,
}: {
  senders: readonly Sender[]
  worst: readonly Sender[]
}) {
  const byId = new Map(worst.map((s) => [s.id, s]))
  return (
    <CartesianChart
      ariaLabel="Open rate against mails a week"
      data={senders}
      x={{ value: (s) => s.perWeek, scale: 'log', title: 'Mails a week' }}
      y={{ title: 'Opened, %', domain: [0, 100] }}
      series={[{ mark: 'dot', key: 'd', label: 'Sender', color, y: (s) => s.openPct }]}
      zones={[
        {
          axis: 'x',
          from: 5,
          to: 500,
          y: { from: 0, to: 10 },
          fill: alpha(VX.brand, 0.1),
          label: 'Mute',
        },
      ]}
      marks={CartesianChart.custom<Sender>((plot) => {
        const r = VX.dotR + 1
        const dots = plot.rows('d').flatMap((s) => {
          const px = plot.x(s.perWeek)
          return px === null
            ? []
            : [{ left: px - r, top: plot.y(s.openPct) - r, width: 2 * r, height: 2 * r }]
        })
        const { placed } = chartLabels.place(
          worst.map((s) => ({
            key: s.id,
            text: s.name,
            x: plot.x(s.perWeek) ?? 0,
            y: plot.y(s.openPct),
          })),
          { width: plot.plotWidth, height: plot.plotHeight },
          { obstacles: dots, gap: VX.dotR + 3 },
        )
        return [
          text(placed, {
            x: (l) => byId.get(l.key)?.perWeek ?? 0,
            y: (l) => byId.get(l.key)?.openPct ?? 0,
            text: (l) => l.text,
            dx: (l) => l.dx,
            dy: (l) => l.dy,
            anchor: (l) => l.textAnchor,
            fill: VX.ink,
            fontSize: VX.text.micro,
          }),
        ]
      })}
    />
  )
}
```
