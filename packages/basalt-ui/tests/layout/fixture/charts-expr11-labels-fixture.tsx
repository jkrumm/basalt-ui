/**
 * The `charts-expr11-labels` fixture (v3-expr-11-kit-fixes 4 and 6a): clamped bars whose true value
 * must show beside the caret, and a dimmed bar's value label. Each probe sits in a `data-testid` box:
 * `e11-cloud` (rain per hour on a 0 to 10 mm axis, three bars past it, a labelled zone over the last
 * bars, the wettest bar highlighted) and `e11-cost` (cost per Issue on a 0 to 20 dollar axis, one bar
 * past it, highlighted). No shell. Entry of `charts-expr11-labels.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { text } from '@tanstack/charts/text'
import { chartLabels } from '../../../src/charts/chart-labels'
import { CartesianChart } from '../../../src/charts/parts/cartesian'
import { Bars } from '../../../src/charts/parts/bars'
import { ChartCard } from '../../../src/charts/parts/chart-card'

const color = (n: number) => ({
  light: `var(--basalt-chart-${n})`,
  dark: `var(--basalt-chart-${n})`,
})

const LINE = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

type Hour = { h: number; mm: number }
const CLOUD: Hour[] = [1, 2, 3, 12, 4, 25, 6, 16, 3, 2, 1, 0].map((mm, h) => ({ h, mm }))

function CloudProbe() {
  return (
    <div data-testid="e11-cloud" className="min-w-0">
      <ChartCard
        title="e11-cloud"
        chart={(box) => (
          <Bars<Hour>
            label="Rain per hour"
            data={CLOUD}
            height={box.height}
            x={{ value: (d) => d.h }}
            y={{ domain: [0, 10], format: (v) => `${Math.round(v)} mm` }}
            zones={[
              { axis: 'x', from: 8.5, to: 11.5, label: 'No tests', fill: 'var(--basalt-warn)' },
            ]}
            series={[
              {
                mark: 'bar',
                key: 'mm',
                label: 'Rain',
                color: color(1),
                y: (d) => d.mm,
                values: true,
                format: (v) => `${Math.round(v)} mm`,
                highlight: (d) => d.mm === 25,
              },
            ]}
          />
        )}
      />
    </div>
  )
}

type Project = { name: string; usd: number }
const COST: Project[] = [4.2, 6.8, 63.1, 9.9, 10.9, 3.1, 7.4].map((usd, i) => ({
  name: `P${i}`,
  usd,
}))

function CostProbe() {
  return (
    <div data-testid="e11-cost" className="min-w-0">
      <ChartCard
        title="e11-cost"
        chart={(box) => (
          <Bars<Project>
            label="Model cost per shipped Issue"
            data={COST}
            height={box.height}
            x={{ value: (p) => p.name }}
            y={{ domain: [0, 20], format: (v) => `$${v}` }}
            series={[
              {
                mark: 'bar',
                key: 'cost',
                label: 'Cost per Issue',
                color: color(2),
                y: (p) => p.usd,
                values: true,
                format: (v) => `$${v.toFixed(1)}`,
                highlight: (p) => p.usd > 60,
              },
            ]}
          />
        )}
      />
    </div>
  )
}

type Box = { name: string; peak: number; restarts: number }
const BOXES: Box[] = [
  { name: 'feed-fetcher', peak: 99, restarts: 9 },
  { name: 'redis', peak: 96, restarts: 3 },
  { name: 'nextcloud', peak: 71, restarts: 1 },
  { name: 'mosquitto', peak: 22, restarts: 7 },
  { name: 'grafana', peak: 40, restarts: 2 },
  { name: 'loki', peak: 84, restarts: 5 },
  { name: 'traefik', peak: 12, restarts: 0 },
]

/** n45: a zone, an x rule and a y rule over dots, the names of the flagged dots placed by chartLabels. */
function RulesProbe() {
  return (
    <div data-testid="e11-rules" className="min-w-0">
      <ChartCard
        title="e11-rules"
        chart={(box) => (
          <CartesianChart<Box>
            label="Restarts against memory"
            height={box.height}
            data={BOXES}
            x={{ value: (d) => d.peak, domain: [0, 105] }}
            y={{ domain: [0, 12] }}
            zones={[
              {
                axis: 'x',
                from: 90,
                to: 105,
                fill: 'color-mix(in srgb, var(--basalt-bad) 8%, transparent)',
                label: 'Near, 90%+',
              },
            ]}
            refLines={[
              { axis: 'x', value: 100, color: LINE, dashed: true, label: 'Limit' },
              { value: 4, color: LINE, dashed: true, label: 'Often, 4+ restarts' },
            ]}
            series={[
              {
                mark: 'dot',
                key: 'restarts',
                label: 'Restarts',
                color: color(1),
                legend: false,
                y: (d) => d.restarts,
              },
            ]}
            marks={CartesianChart.custom<Box>((plot) => {
              const placed = chartLabels.place(
                BOXES.filter((d) => d.peak > 80 || d.restarts > 4).map((d) => ({
                  key: d.name,
                  text: d.name,
                  x: plot.x(d.peak) ?? 0,
                  y: plot.y(d.restarts),
                  priority: d.restarts,
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                { gap: 6 },
              ).placed
              return [
                text(placed, {
                  x: (l) => BOXES.find((d) => d.name === l.key)?.peak ?? 0,
                  y: (l) => BOXES.find((d) => d.name === l.key)?.restarts ?? 0,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fill: 'var(--basalt-ink)',
                  fontSize: 11,
                }),
              ]
            })}
          />
        )}
      />
    </div>
  )
}

type Day = { d: number; mbit: number }
const DAYS: Day[] = Array.from({ length: 30 }, (_, i) => ({
  d: i + 1,
  mbit: [
    188, 205, 230, 214, 196, 232, 219, 201, 226, 238, 190, 211, 224, 233, 207, 229, 215, 198, 221,
    236, 204, 227, 212, 231, 193, 218, 235, 209, 247, 226,
  ][i] as number,
}))

/** n46: bars near a labelled rule, their values written on the bars; the rule's caption must not meet a value. */
function SpeedProbe() {
  return (
    <div data-testid="e11-speed" className="min-w-0">
      <ChartCard
        title="e11-speed"
        chart={(box) => (
          <Bars<Day>
            label="Download speed"
            data={DAYS}
            height={box.height}
            x={{ value: (d) => d.d }}
            y={{ domain: [0, 275] }}
            refLines={[
              { value: 250, color: LINE, dashed: true, label: 'Maximum 250' },
              { value: 200, color: LINE, dashed: true, label: 'Normal 200' },
              { value: 100, color: LINE, dashed: true, label: 'Minimum 100' },
            ]}
            series={[
              {
                mark: 'bar',
                key: 'mbit',
                label: 'Median',
                color: color(2),
                y: (d) => d.mbit,
                values: true,
                highlight: (d) => d.mbit === 188,
              },
            ]}
          />
        )}
      />
    </div>
  )
}

type Page = { title: string; age: number; views: number; read: boolean }
const PAGES: Page[] = [
  ...Array.from({ length: 40 }, (_, i) => ({
    title: 'p' + i,
    age: (i * 37) % 170,
    views: (i * 13) % 160,
    read: false,
  })),
  { title: 'Partner pricing sheet', age: 300, views: 92, read: true },
  { title: 'Runbook: restore', age: 210, views: 130, read: true },
  { title: 'Office wifi', age: 410, views: 105, read: true },
  { title: 'Brand guide', age: 250, views: 60, read: true },
]

/** n49: a zone, a labelled 100 rule and names placed beside the dots. */
function WikiProbe() {
  return (
    <div data-testid="e11-wiki" className="min-w-0">
      <ChartCard
        title="e11-wiki"
        chart={(box) => (
          <CartesianChart<Page>
            label="Views against age"
            height={box.height}
            data={PAGES}
            x={{ value: (p) => p.age, domain: [0, 540], ticks: [0, 180, 365, 540] }}
            y={{ domain: [0, 200] }}
            zones={[
              {
                axis: 'x',
                from: 180,
                to: 540,
                fill: 'color-mix(in srgb, var(--basalt-ink-muted) 10%, transparent)',
                label: 'Stale',
              },
            ]}
            refLines={[{ value: 100, color: LINE, dashed: true, label: '100 views' }]}
            series={[
              {
                mark: 'dot',
                key: 'dots',
                label: 'Pages',
                color: color(1),
                legend: false,
                y: (p) => p.views,
              },
            ]}
            marks={CartesianChart.custom<Page>((plot) => {
              const named = PAGES.filter((p) => p.read)
              const placed = chartLabels.place(
                named.map((p) => ({
                  key: p.title,
                  text: p.title,
                  x: plot.x(p.age) ?? 0,
                  y: plot.y(p.views),
                  priority: p.views,
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                { gap: 8 },
              ).placed
              return [
                text(placed, {
                  x: (l) => named.find((p) => p.title === l.key)?.age ?? 0,
                  y: (l) => named.find((p) => p.title === l.key)?.views ?? 0,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fill: 'var(--basalt-ink)',
                  fontSize: 11,
                }),
              ]
            })}
          />
        )}
      />
    </div>
  )
}

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <CloudProbe />
      <CostProbe />
      <RulesProbe />
      <SpeedProbe />
      <WikiProbe />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
