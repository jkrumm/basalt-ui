/**
 * The `charts-interval-track-expr11` fixture (expression cycle 11, IntervalTrack rows .19 .20 .23
 * .30 .32 .35 .40): a long span whose label does not fit, one-day spans, three coincident points in one
 * row, and a focused one-day mark on the first day. Entry of `charts-interval-track-expr11.layout.test.ts`,
 * which bundles it in memory; the harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes: `expr11-card` (the card), the engine's `svg` inside it.
 */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { IntervalTrack } from '../../../src/charts/parts/interval-track'
import type { IntervalSeries } from '../../../src/charts/parts/interval-track'
import { useChartFocus } from '../../../src/charts/focus'

type Kind = 'work' | 'event' | 'hold'
type Span = { row: string; start: number; end: number | null; label: string; kind: Kind }

const SPANS: readonly Span[] = [
  { row: 'Lead', start: 10, end: 30, label: 'Lead session', kind: 'work' },
  { row: 'Lead', start: 33, end: 39, label: 'Review', kind: 'work' },
  { row: 'Lead', start: 27, end: 90, label: 'Waiting on owner', kind: 'hold' },
  { row: 'Swim', start: 0, end: null, label: 'Swim', kind: 'work' },
  { row: 'Swim', start: 3, end: 4, label: 'Swim', kind: 'work' },
  { row: 'Swim', start: 4, end: 5, label: 'Swim', kind: 'work' },
  { row: 'Filed', start: 40, end: null, label: 'Filed', kind: 'event' },
  { row: 'Filed', start: 40, end: null, label: 'Queued', kind: 'event' },
  { row: 'Filed', start: 40, end: null, label: 'Admitted', kind: 'event' },
]
const SERIES: readonly IntervalSeries<Kind>[] = [
  { key: 'work', label: 'Working', color: { light: '#2871c7', dark: '#5190f7' } },
  { key: 'event', label: 'Event', color: { light: '#4a4a4a', dark: '#c4c4c4' } },
  {
    key: 'hold',
    label: 'Held',
    color: { light: '#9a9a9a', dark: '#7d7d7d' },
    fill: 'outline',
    layer: 'back',
  },
]
/** The Swim point on the axis's first day: at the plot's left edge, where a minimum width must hold it. */
const FOCUSED = 3

function Fixture() {
  const focus = useChartFocus(SPANS, { announce: (s) => `${s.row} ${s.label}` })
  // Focus the Swim point once: a fresh handle each render, so the guard on `datum` ends the loop.
  useEffect(() => {
    if (focus.datum === null) focus.set(FOCUSED)
  })
  return (
    <main className="flex flex-col gap-4 p-4">
      <div data-testid="expr11-card">
        <ChartCard
          title="Attempts by day"
          chart={(box) => (
            <IntervalTrack
              height={box.height}
              label="Attempts by day"
              data={SPANS}
              rows={['Lead', 'Swim', 'Filed']}
              getRow={(s) => s.row}
              getStart={(s) => s.start}
              getEnd={(s) => s.end}
              series={SERIES}
              getSeries={(s) => s.kind}
              getLabel={(s) => s.label}
              xDomain={[0, 90]}
              formatX={(d) => `Day ${Math.round(d)}`}
              focus={focus}
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
