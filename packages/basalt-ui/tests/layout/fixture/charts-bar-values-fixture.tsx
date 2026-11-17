/**
 * The `charts-bar-values` fixture: a `Bars` chart of ten long category names with `values` on and one
 * bar highlighted, full width of the page. Entry of `charts-bar-values.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { Bars } from '../../../src/charts/parts/bars'

const NAMES = [
  'support-triage-classifier',
  'doc-summarise-long-context',
  'code-review-assist-batch',
  'nightly-regression-evals',
  'search-rerank-experiment',
  'onboarding-chat-assistant',
  'invoice-extraction-pipeline',
  'release-notes-drafting',
  'incident-postmortem-writer',
  'catalog-embedding-backfill',
]
/** The highlighted bar (index 4) is a local peak: its neighbours are lower. */
const MS = [420, 640, 580, 710, 760, 690, 520, 300, 840, 600]
const ROWS = NAMES.map((name, i) => ({ name, ms: MS[i] ?? 0 }))
const color = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }

function Fixture() {
  return (
    <main className="w-full min-w-0 p-4 text-foreground" data-testid="bars">
      <Bars
        label="Latency by workflow"
        data={ROWS}
        x={{ value: (d) => d.name }}
        height={320}
        series={[
          {
            mark: 'bar',
            key: 'ms',
            label: 'Latency',
            color,
            y: (d) => d.ms,
            values: (v) => `${v} ms`,
            highlight: (d) => d.name === NAMES[4],
          },
        ]}
      />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
