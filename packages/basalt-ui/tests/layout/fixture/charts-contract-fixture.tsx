/**
 * The `charts-contract` fixture (v3-expr-4-contract): custom marks that place labels in plot pixels
 * through `chartLabels.place`, and labelled x-range zones with a y bound. No shell. Entry of
 * `charts-contract.layout.test.ts`.
 *
 * Probes, each in a `data-testid` box: `cc-labels` (a dot cluster with three named dots, labels
 * drawn as an engine `text` mark with the placed `dx`/`dy`), `cc-zone-time` (a line over a time
 * axis with a bounded window), `cc-zone-log` (a dot scatter on a log x with a bounded region).
 */
import { text } from '@tanstack/charts/text'
import { createRoot } from 'react-dom/client'
import { chartLabels } from '../../../src/charts/chart-labels'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { BASALT } from '../../../src/tokens'

const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const red = { light: '#b42318', dark: '#f97066' }
const BOX = 'min-w-0'

type Sender = { id: string; name: string; perWeek: number; openPct: number; named: boolean }
/** A tight cluster: the three named senders sit among their neighbours, so a label has to look for room. */
const senders: Sender[] = [
  [2.1, 34],
  [2.4, 44],
  [2.6, 24],
  [3.0, 35],
  [3.2, 42],
  [3.5, 27],
  [3.9, 36],
  [4.2, 20],
  [4.6, 45],
  [5.0, 34],
  [12, 8],
  [40, 4],
].map(([perWeek, openPct], i) => ({
  id: `s${i}`,
  name: ['Weekly digest', 'Promo blast', 'Receipts'][i % 3] ?? '',
  perWeek: perWeek ?? 0,
  openPct: openPct ?? 0,
  named: i === 3 || i === 5 || i === 7,
}))
const named = senders.filter((s) => s.named)

function Labels() {
  return (
    <div data-testid="cc-labels" className={BOX}>
      <ChartCard
        title="Named senders"
        chart={(box) => (
          <CartesianChart<Sender>
            label="Open rate against mails a week"
            data={senders}
            height={box.height}
            x={{ value: (s) => s.perWeek, domain: [0, 6] }}
            y={{ domain: [0, 50] }}
            series={[{ mark: 'dot', key: 'd', label: 'Sender', color: blue, y: (s) => s.openPct }]}
            marks={CartesianChart.custom<Sender>((plot) => {
              const byKey = new Map(named.map((s) => [s.id, s]))
              const dots = plot.rows('d').flatMap((s) => {
                const px = plot.x(s.perWeek)
                if (px === null) return []
                const r = BASALT.dotR + 1
                return [{ left: px - r, top: plot.y(s.openPct) - r, width: 2 * r, height: 2 * r }]
              })
              const { placed } = chartLabels.place(
                named.map((s) => ({
                  key: s.id,
                  text: s.name,
                  x: plot.x(s.perWeek) ?? 0,
                  y: plot.y(s.openPct),
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                // The gap clears the anchor's own dot, which is one of the obstacles.
                { obstacles: dots, gap: BASALT.dotR + 3 },
              )
              return [
                text(placed, {
                  id: 'names',
                  x: (l) => byKey.get(l.key)?.perWeek ?? 0,
                  y: (l) => byKey.get(l.key)?.openPct ?? 0,
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

type Hour = { at: Date; wind: number }
const hours: Hour[] = Array.from({ length: 24 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 10, 16, i)),
  wind: 10 + 8 * Math.sin(i / 3),
}))

function TimeZone() {
  return (
    <div data-testid="cc-zone-time" className={BOX}>
      <ChartCard
        title="Ride window"
        chart={(box) => (
          <CartesianChart<Hour>
            label="Wind by hour"
            data={hours}
            height={box.height}
            x={{ value: (h) => h.at }}
            y={{ domain: [0, 25] }}
            series={[{ mark: 'line', key: 'w', label: 'Wind', color: blue, y: (h) => h.wind }]}
            zones={[
              {
                axis: 'x',
                from: new Date(Date.UTC(2026, 10, 16, 6)),
                to: new Date(Date.UTC(2026, 10, 16, 11)),
                y: { from: 0, to: 15 },
                fill: 'color-mix(in srgb, var(--basalt-brand) 15%, transparent)',
                label: 'Best window',
              },
            ]}
          />
        )}
      />
    </div>
  )
}

function LogZone() {
  return (
    <div data-testid="cc-zone-log" className={BOX}>
      <ChartCard
        title="Mute candidates"
        chart={(box) => (
          <CartesianChart<Sender>
            label="Open rate against mails a week, log"
            data={senders}
            height={box.height}
            x={{ value: (s) => s.perWeek, scale: 'log', domain: [1, 100] }}
            y={{ domain: [0, 50] }}
            series={[{ mark: 'dot', key: 'd', label: 'Sender', color: red, y: (s) => s.openPct }]}
            zones={[
              {
                axis: 'x',
                from: 5,
                to: 100,
                y: { from: 0, to: 10 },
                fill: 'color-mix(in srgb, var(--basalt-brand) 15%, transparent)',
                label: 'Mute',
              },
            ]}
          />
        )}
      />
    </div>
  )
}

function Fixture() {
  return (
    <main className="grid gap-4 p-4">
      <Labels />
      <TimeZone />
      <LogZone />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
