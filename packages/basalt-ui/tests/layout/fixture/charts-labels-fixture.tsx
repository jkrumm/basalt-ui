/**
 * The `charts-labels` fixture (v3-expr-9-kit-fixes 2, 3 and 4): a `CartesianChart` with a custom
 * `text` mark placed by `chartLabels.place` (the top item of a queue, with and without a value past
 * a bounded `y.domain`) and a chart whose reference-line captions meet two line series. No shell.
 * Entry of `charts-labels.layout.test.ts`.
 *
 * Probes, each in a `data-testid` box: `kl-top` (the worst item, 9 behind), `kl-top-extreme` (the
 * same item holding 41, past the cap of 14) and `kl-refs` (two refLines over a tide and a swell).
 */
import { text } from '@tanstack/charts/text'
import { createRoot } from 'react-dom/client'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { chartLabels } from '../../../src/charts/chart-labels'
import { BASALT } from '../../../src/tokens'

const blue = { light: '#2871c7', dark: '#5190f7' }
const grey = { light: '#4a4a4a', dark: '#d4d4d4' }
const mid = { light: '#7a7a7a', dark: '#9c9c9c' }

type Item = { issue: number; age: number; behind: number }
const Y_CAP = 14
const LIMIT = 24
const ITEMS: Item[] = [
  { issue: 2018, age: 71, behind: 9 },
  { issue: 1987, age: 30, behind: 4 },
  { issue: 2031, age: 5, behind: 2 },
  { issue: 2024, age: 23, behind: 3 },
  { issue: 2027, age: 19, behind: 1 },
  { issue: 2030, age: 9, behind: 6 },
  { issue: 1994, age: 26, behind: 1 },
]
const EXTREME: Item[] = ITEMS.map((i) => (i.issue === 2018 ? { ...i, age: 190, behind: 41 } : i))

function Top({ id, items }: { id: string; items: Item[] }) {
  const top = items[0] as Item
  const shown = Math.min(top.behind, Y_CAP)
  return (
    <div data-testid={id} className="min-w-0">
      <ChartCard
        title={id}
        chart={(box) => (
          <CartesianChart<Item>
            label={id}
            data={items}
            height={box.height}
            x={{
              value: (d) => d.age,
              domain: [0, Math.round(Math.max(LIMIT * 2, ...items.map((i) => i.age)) * 1.3)],
            }}
            y={{ domain: ([, hi]) => [0, Math.min(Math.max(hi, 4), Y_CAP)] }}
            series={[
              { mark: 'dot', key: 'v', label: 'Items', color: blue, y: (d: Item) => d.behind },
            ]}
            refLines={[
              {
                axis: 'x',
                value: LIMIT,
                color: grey,
                dashed: true,
                label: `Reviews go ahead at ${LIMIT} h`,
              },
            ]}
            marks={CartesianChart.custom<Item>((plot) => {
              const r = BASALT.dotR + 1
              const dots = plot.data.flatMap((d) => {
                const px = plot.x(d.age)
                return px === null
                  ? []
                  : [
                      {
                        left: px - r,
                        top: plot.y(Math.min(d.behind, Y_CAP)) - r,
                        width: 2 * r,
                        height: 2 * r,
                      },
                    ]
              })
              const { placed } = chartLabels.place(
                [
                  {
                    key: 'top',
                    text: `Decision ${top.issue}, ${top.behind > Y_CAP ? top.behind : `${top.age} h`}`,
                    x: plot.x(top.age) ?? 0,
                    y: plot.y(shown),
                  },
                ],
                { width: plot.plotWidth, height: plot.plotHeight },
                { obstacles: dots, gap: BASALT.dotR + 3 },
              )
              return [
                text(placed, {
                  x: () => top.age,
                  y: () => shown,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fontSize: BASALT.text.micro,
                }),
              ]
            })}
          />
        )}
      />
    </div>
  )
}

type Hour = { h: number; tide: number; swell: number }
const HOURS: Hour[] = Array.from({ length: 49 }, (_, h) => ({
  h,
  tide: 2 + 1.25 * Math.cos((2 * Math.PI * (h - 4)) / 12.42),
  swell: 1.4 + 0.6 * Math.sin(h / 4),
}))

function Refs() {
  return (
    <div data-testid="kl-refs" className="min-w-0">
      <ChartCard
        title="kl-refs"
        chart={(box) => (
          <CartesianChart<Hour>
            label="Water over the bar and swell"
            data={HOURS}
            height={box.height}
            x={{ value: (d) => d.h }}
            y={{ domain: { floor: 0, ceil: 4 } }}
            series={[
              { mark: 'line', key: 'tide', label: 'Tide', color: grey, y: (d: Hour) => d.tide },
              { mark: 'line', key: 'swell', label: 'Swell', color: mid, y: (d: Hour) => d.swell },
            ]}
            refLines={[
              { value: 2.8, color: grey, dashed: true, label: 'Bar needs 2.8 m' },
              { value: 1.5, color: mid, dashed: true, label: 'Crew limit 1.5 m' },
            ]}
          />
        )}
      />
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Chart labels</h1>
      <Top id="kl-top" items={ITEMS} />
      <Top id="kl-top-extreme" items={EXTREME} />
      <Refs />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
