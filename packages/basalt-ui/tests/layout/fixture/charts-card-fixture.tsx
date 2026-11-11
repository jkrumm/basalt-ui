/**
 * The `charts-card` fixture (docs/v3/concepts/charts-cards-kanban.md section 9, charts-4): the v3
 * `ChartCard` around `Lines`, one card per phase, a slot at twice the box height, a `fill` card in a
 * fixed parent, a card with two series one of which failed, and a card with a hoverable plot. No
 * shell. Entry of `charts-card.layout.test.ts`, which bundles it in memory; the harness is told to
 * "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box: `cc-ready`, `cc-loading`, `cc-stale`, `cc-error`, `cc-empty`
 * (same props, one phase each), `cc-slot-small` and `cc-slot-tall` (a plain div at 40 and 2x the
 * box), `cc-fill` (a 420 px parent), `cc-failed`, `cc-tip` (30 points, a legend, hover target).
 */
import { createRoot } from 'react-dom/client'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { Lines } from '../../../src/charts/parts/lines'
import type { BoxSlot } from '../../../src/core/ports'

type Row = { day: Date; a: number; b: number }
const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 8, i + 1)),
  a: 40 + Math.round(Math.sin(i / 3) * 20) + i,
  b: 25 + Math.round(Math.cos(i / 4) * 10),
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

const GLYPH = (props: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={props.className} fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const FRAME = {
  icon: GLYPH,
  title: 'Requests',
  subtitle: 'last 30 days',
  info: 'Requests served per day.',
  figure: {
    value: 12840,
    unit: 'req',
    delta: { value: '+8%', polarity: 'up-good' as const },
    period: 'vs prior',
  },
  footer: [
    { label: 'Peak', value: 1200 },
    { label: 'Mean', value: 428 },
  ] as const,
}

const chart: BoxSlot = (box) => (
  <Lines
    ariaLabel="Requests and errors per day"
    data={rows}
    x={x}
    series={[lineA, lineB]}
    height={box.height}
  />
)

const BOX = 'min-w-0'

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">ChartCard</h1>
      <div data-testid="cc-ready" className={BOX}>
        <ChartCard {...FRAME} phase="ready" chart={chart} />
      </div>
      <div data-testid="cc-loading" className={BOX}>
        <ChartCard {...FRAME} phase="loading" chart={chart} />
      </div>
      <div data-testid="cc-stale" className={BOX}>
        <ChartCard {...FRAME} phase="stale" chart={chart} />
      </div>
      <div data-testid="cc-error" className={BOX}>
        <ChartCard {...FRAME} phase={{ tag: 'error', retry: () => {} }} chart={chart} />
      </div>
      <div data-testid="cc-empty" className={BOX}>
        <ChartCard {...FRAME} empty={{ cause: 'No requests yet' }} chart={chart} />
      </div>
      <div data-testid="cc-suspense" className={BOX}>
        <ChartCard {...FRAME} phase="loading" />
      </div>
      <div data-testid="cc-slot-small" className={BOX}>
        <ChartCard
          {...FRAME}
          chart={() => (
            <div data-testid="cc-small-body" style={{ height: 40 }} className="bg-selected" />
          )}
        />
      </div>
      <div data-testid="cc-slot-tall" className={BOX}>
        <ChartCard
          {...FRAME}
          chart={() => (
            <div data-testid="cc-tall-body" style={{ height: 1200 }} className="bg-selected" />
          )}
        />
      </div>
      <div data-testid="cc-fill" className="h-[420px] min-w-0">
        <ChartCard {...FRAME} height="fill" chart={chart} />
      </div>
      <div data-testid="cc-failed" className={BOX}>
        <ChartCard
          title="Failed"
          chart={(box) => (
            <Lines
              ariaLabel="Requests, errors unavailable"
              data={rows}
              x={x}
              series={[lineA, { ...lineB, failed: true }]}
              height={box.height}
            />
          )}
        />
      </div>
      <div data-testid="cc-tip" className={BOX}>
        <ChartCard
          title="Tooltip"
          chart={(box) => (
            <Lines
              ariaLabel="Requests and errors, hover"
              data={rows}
              x={x}
              series={[lineA, lineB]}
              naming="legend"
              height={box.height}
            />
          )}
        />
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
