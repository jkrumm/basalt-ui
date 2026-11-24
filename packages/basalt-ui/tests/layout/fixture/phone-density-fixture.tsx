/**
 * The `phone-density` fixture: a Card, a StatGroup strip and ChartCards (with and without `bleed`,
 * with and without end labels) on a page gutter of 8 px, as the compact shell draws it. Entry of
 * `phone-density.layout.test.ts`, which bundles it in memory; the harness is told to "mount" it by
 * a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box: `pd-card`, `pd-stat`, `pd-chart`, `pd-bleed` (two lines that end
 * together, so a legend), `pd-names` (two lines that end apart), `pd-near` (two lines that end together), `pd-cat` (a line over weekday names), `pd-wrap` (five lines whose legend wraps).
 */
import { createRoot } from 'react-dom/client'
import { StatCell } from '../../../src/cards/stat-cell'
import { StatGroup } from '../../../src/cards/stat-group'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'
import type { BoxSlot } from '../../../src/core/ports'
import { Card } from '../../../src/ui/card'

type Row = { day: Date; a: number; b: number; c: number }
const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 8, i + 1)),
  a: 400 + Math.round(Math.sin(i / 3) * 200) + i * 10,
  b: 120 + Math.round(Math.cos(i / 4) * 60),
  c: 410 + Math.round(Math.sin(i / 3) * 200) + i * 10,
}))
const x = { value: (d: Row): Date => d.day }
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }
const lineA = {
  mark: 'line',
  key: 'a',
  label: 'Requests',
  color: blue,
  y: (d: Row) => d.a,
} as const
const lineB = { mark: 'line', key: 'b', label: 'Errors', color: amber, y: (d: Row) => d.b } as const
const lineC = {
  mark: 'line',
  key: 'c',
  label: 'Retries',
  color: amber,
  y: (d: Row) => d.c,
} as const

const MANY = [
  { mark: 'line', key: 'm1', label: 'Claude Opus', color: blue, y: (d: Row) => d.a },
  { mark: 'line', key: 'm2', label: 'Claude Sonnet', color: amber, y: (d: Row) => d.a + 12 },
  { mark: 'line', key: 'm3', label: 'Claude Haiku', color: blue, y: (d: Row) => d.a + 24 },
  { mark: 'line', key: 'm4', label: 'GPT Large', color: amber, y: (d: Row) => d.a + 36 },
  { mark: 'line', key: 'm5', label: 'GPT Small', color: blue, y: (d: Row) => d.a + 48 },
] as const

const FRAME = {
  title: 'Requests',
  subtitle: 'last 30 days',
  figure: { value: 12840, unit: 'req', period: 'vs prior' },
} as const

const lines =
  (
    series: readonly (typeof lineA | typeof lineB | typeof lineC | (typeof MANY)[number])[],
  ): BoxSlot =>
  (box) => (
    <Lines ariaLabel="Requests per day" data={rows} x={x} series={series} height={box.height} />
  )

type Day = { day: string; v: number }
const WEEK: Day[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
].map((day, i) => ({ day, v: 20 + ((i * 7) % 5) * 4 }))

function Fixture() {
  return (
    <main className="@container flex min-w-0 flex-col gap-4 p-2 text-foreground">
      <div data-testid="pd-card">
        <Card>
          <p data-testid="pd-card-text">Card content</p>
        </Card>
      </div>
      <div data-testid="pd-stat">
        <StatGroup variant="strip" label="Link health">
          <StatCell label="Downstream" value={412} unit="Mbit/s" />
          <StatCell label="Upstream" value={38} unit="Mbit/s" />
        </StatGroup>
      </div>
      <div data-testid="pd-chart">
        <ChartCard {...FRAME} phase="ready" chart={lines([lineA, lineB])} />
      </div>
      <div data-testid="pd-bleed">
        <ChartCard {...FRAME} bleed phase="ready" chart={lines([lineA, lineC])} />
      </div>
      <div data-testid="pd-names">
        <ChartCard {...FRAME} phase="ready" chart={lines([lineA, lineB])} />
      </div>
      <div data-testid="pd-near">
        <ChartCard {...FRAME} phase="ready" chart={lines([lineA, lineC])} />
      </div>
      <div data-testid="pd-cat">
        <ChartCard
          {...FRAME}
          phase="ready"
          chart={(box) => (
            <Lines
              ariaLabel="Orders per weekday"
              data={WEEK}
              x={{ value: (d: Day) => d.day }}
              series={[
                { mark: 'line', key: 'v', label: 'Orders', color: blue, y: (d: Day) => d.v },
              ]}
              height={box.height}
            />
          )}
        />
      </div>
      <div data-testid="pd-wrap">
        <ChartCard {...FRAME} phase="ready" chart={lines(MANY)} />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
