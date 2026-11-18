/**
 * The `charts-interval-track` fixture (Issue 2306): a workweek of meetings, focus time and declined
 * events drawn by `IntervalTrack` inside the v3 `ChartCard`, with each day's longest free block on
 * the back layer. Entry of `charts-interval-track.layout.test.ts`, which bundles it in memory; the
 * harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 *
 * Probes: `it-card` (the card), the engine's `svg` inside it.
 */
import { createRoot } from 'react-dom/client'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { IntervalTrack } from '../../../src/charts/parts/interval-track'
import type { IntervalSeries } from '../../../src/charts/parts/interval-track'

type Kind = 'meeting' | 'focus' | 'declined' | 'free'
type Span = { day: string; start: number; end: number; title: string; kind: Kind }

const at = (clock: string): number => {
  const [h = '0', m = '0'] = clock.split(':')
  return Number(h) * 60 + Number(m)
}
const s = (day: string, from: string, to: string, title: string, kind: Kind = 'meeting'): Span => ({
  day,
  start: at(from),
  end: at(to),
  title,
  kind,
})

const SPANS: readonly Span[] = [
  s('Mon 23', '09:00', '09:15', 'Standup'),
  s('Mon 23', '09:15', '10:30', 'Plan the release', 'focus'),
  s('Mon 23', '10:30', '11:30', 'Design review'),
  s('Mon 23', '11:30', '12:00', 'Vendor demo', 'declined'),
  s('Mon 23', '13:00', '14:00', '1:1 with Anna'),
  s('Mon 23', '14:00', '15:00', 'Customer call'),
  s('Mon 23', '15:30', '17:00', 'API cleanup', 'focus'),
  s('Tue 24', '09:00', '09:15', 'Standup'),
  s('Tue 24', '09:15', '10:00', 'Inbox and reviews', 'focus'),
  s('Tue 24', '10:00', '11:00', 'Sprint planning'),
  s('Tue 24', '11:00', '11:30', 'Hiring sync'),
  s('Tue 24', '12:30', '17:30', '5 h free', 'free'),
  s('Tue 24', '14:00', '15:00', 'All-hands', 'declined'),
  s('Wed 25', '09:00', '09:15', 'Standup'),
  s('Wed 25', '09:15', '10:30', 'Architecture review'),
  s('Wed 25', '10:00', '10:45', 'Bank appointment', 'focus'),
  s('Wed 25', '10:45', '11:30', 'Candidate interview'),
  s('Wed 25', '11:30', '12:30', 'Interview debrief'),
  s('Wed 25', '13:15', '14:30', 'Roadmap workshop'),
  s('Wed 25', '15:30', '16:30', 'Pairing session', 'focus'),
  s('Thu 26', '09:15', '11:15', 'Migration deep work', 'focus'),
  s('Thu 26', '11:15', '12:00', 'Team sync'),
  s('Thu 26', '13:30', '14:30', 'Code review', 'focus'),
  s('Thu 26', '16:00', '16:30', 'Metrics review'),
]
const SERIES: readonly IntervalSeries<Kind>[] = [
  { key: 'meeting', label: 'Meeting', color: { light: '#2871c7', dark: '#5190f7' } },
  { key: 'focus', label: 'Focus', color: { light: '#4a4a4a', dark: '#c4c4c4' } },
  {
    key: 'declined',
    label: 'Declined',
    color: { light: '#9a9a9a', dark: '#7d7d7d' },
    fill: 'outline',
  },
  {
    key: 'free',
    label: 'Longest free block',
    color: { light: '#0b6bcb', dark: '#5aa9f0' },
    fill: 'outline',
    layer: 'back',
  },
]
/** Minutes since midnight as a time on one shared UTC day, so the axis ticks whole hours. */
const day = (min: number): Date => new Date(Date.UTC(2026, 10, 23, 0, min))
const clock = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

function Fixture() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <div data-testid="it-card">
        <ChartCard
          title="Booked time by workday"
          chart={(box) => (
            <IntervalTrack
              height={box.height}
              label="Events by workday"
              data={SPANS}
              rows={['Mon 23', 'Tue 24', 'Wed 25', 'Thu 26', 'Fri 27']}
              getRow={(d) => d.day}
              getStart={(d) => day(d.start)}
              getEnd={(d) => day(d.end)}
              series={SERIES}
              getSeries={(d) => d.kind}
              getLabel={(d) => d.title}
              rowExtent={() => [day(at('09:00')), day(at('17:30'))]}
              xDomain={[day(at('09:00')), day(at('18:00'))]}
              formatX={clock}
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
