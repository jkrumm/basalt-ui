/**
 * The `charts-sparkline` fixture (docs/v3/concepts/charts-cards-kanban.md section 9, charts-3): the
 * hand-SVG `Sparkline` and `MiniBars` in a real `StatCard` chart box (plot 56, label row 16) and bare.
 * No shell. The entry the `charts-sparkline` layout test bundles; the harness is told to "mount" it
 * by a no-op `window.basaltMountFixture`.
 *
 * Probes, each in a `data-testid` box:
 * - `cs-line`, `cs-area`, `cs-bars`: a `StatCard` whose chart slot draws the kind at `box.height`
 *   with `axisLabels`;
 * - `cs-weeks`: a `StatCard` sparkline of twelve named weeks with a 38 h outlier held by `cap`;
 * - `cs-image`: a bare `Sparkline` with no `axisLabels` (an image, no tab stop);
 * - `cs-wide`: five `MiniBars` in a wide box (the 24 px bar cap and the 3 px gap).
 */
import { createRoot } from 'react-dom/client'
import { StatCard } from '../../../src/cards/stat-card'
import { MiniBars } from '../../../src/charts/parts/mini-bars'
import { Sparkline } from '../../../src/charts/parts/sparkline'

const DAYS = [12, 18, 9, 24, 31, 22, 40, 36, 28, 33, 45, 38, 52, 47]
const LABELS = ['Mon', 'Today', 'Sun'] as const
/** Twelve weeks with one 38 h outlier the `cap` holds (n27, expression-8.3). */
const WEEKS = [6.2, 7.1, 5.8, 38, 6.9, 7.4, 6.1, 8.1, 7.7, 6.6, 7.9, 7.4]
const GLYPH = (props: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={props.className} fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

function Fixture() {
  return (
    <main className="flex max-w-xl flex-col gap-6 p-4 text-foreground">
      <h1 className="text-lg font-medium">Sparkline</h1>
      <div data-testid="cs-line">
        <StatCard
          icon={GLYPH}
          title="Shipped"
          value={388}
          phase="ready"
          chart={(box) => (
            <Sparkline
              points={DAYS}
              height={box.height}
              axisLabels={LABELS}
              label="Shipped per day"
            />
          )}
        />
      </div>
      <div data-testid="cs-area">
        <StatCard
          icon={GLYPH}
          title="Merged"
          value={212}
          phase="ready"
          chart={(box) => (
            <Sparkline
              points={DAYS}
              form="area"
              reference="mean"
              height={box.height}
              axisLabels={LABELS}
              label="Merged per day"
            />
          )}
        />
      </div>
      <div data-testid="cs-bars">
        <StatCard
          icon={GLYPH}
          title="Reviews"
          value={64}
          phase="ready"
          chart={(box) => (
            <MiniBars
              points={DAYS}
              height={box.height}
              axisLabels={LABELS}
              label="Reviews per day"
            />
          )}
        />
      </div>
      <div data-testid="cs-weeks">
        <StatCard
          icon={GLYPH}
          title="Time in queue"
          value={7.4}
          unit="h"
          phase="ready"
          chart={(box) => (
            <Sparkline
              points={WEEKS.map((value, i) => ({ value, label: `W${41 + i}` }))}
              cap={12}
              format={(v) => `${v} h`}
              height={box.height}
              axisLabels={['W41', 'Weekly', 'W52']}
              label="Time in queue per week"
            />
          )}
        />
      </div>
      <div data-testid="cs-image" className="w-48">
        <Sparkline points={DAYS} height={32} label="Latency, last 14 days" />
      </div>
      <div data-testid="cs-wide" className="w-full">
        <MiniBars points={[3, 5, 2, 6, 4]} height={48} label="Builds per day" />
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
