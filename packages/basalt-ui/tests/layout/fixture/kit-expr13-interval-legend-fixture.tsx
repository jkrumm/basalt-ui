/**
 * Expression cycle 13 kit fixes, the IntervalTrack legend (`v3-expr-13-kit-fixes` 9, finding .37): a solid
 * series' swatch shows the tint its spans are painted with, an outline series' swatch its stroke. Two
 * solid series and one outline series on two rows. Entry of `kit-expr13-interval-legend.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { IntervalTrack } from '../../../src/charts/parts/interval-track'
import type { IntervalSeries } from '../../../src/charts/parts/interval-track'

type Kind = 'work' | 'event' | 'hold'
type Span = { row: string; start: number; end: number; label: string; kind: Kind }

const SPANS: readonly Span[] = [
  { row: 'Lead', start: 10, end: 30, label: 'Lead session', kind: 'work' },
  { row: 'Lead', start: 33, end: 39, label: 'Review', kind: 'event' },
  { row: 'Swim', start: 3, end: 40, label: 'Waiting', kind: 'hold' },
]
const SERIES: readonly IntervalSeries<Kind>[] = [
  {
    key: 'work',
    label: 'Working',
    color: { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' },
  },
  {
    key: 'event',
    label: 'Event',
    color: { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' },
  },
  {
    key: 'hold',
    label: 'Held',
    color: { light: 'var(--basalt-chart-3)', dark: 'var(--basalt-chart-3)' },
    fill: 'outline',
  },
]

function Fixture(): ReactElement {
  return (
    <main lang="en" className="p-4 text-foreground">
      <div data-testid="x13-legend" className="min-w-0">
        <IntervalTrack
          label="Spans by row"
          data={SPANS}
          rows={['Lead', 'Swim']}
          getRow={(s) => s.row}
          getStart={(s) => s.start}
          getEnd={(s) => s.end}
          series={SERIES}
          getSeries={(s) => s.kind}
          getLabel={(s) => s.label}
          xDomain={[0, 60]}
          formatX={(d) => `Day ${Math.round(d)}`}
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
