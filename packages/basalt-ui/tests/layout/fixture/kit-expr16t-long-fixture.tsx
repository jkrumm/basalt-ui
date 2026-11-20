/**
 * Expression cycle 16 (`v3-expr-16-kit-fixes` 9): a 200-row DataTable in a DataPanel (`e16-long`, n75) and a
 * grouped DataTable in a DataPanel (`e16-grouped`, n80). Entry of `kit-expr16-table.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Inquiry = { id: string; sender: string; topic: string; verdict: string; at: string }
const VERDICTS = ['kept', 'spam', 'review'] as const
const ROWS: readonly Inquiry[] = Array.from({ length: 200 }, (_, i) => ({
  id: 'Q-' + String(1000 + i),
  sender: 'sender' + i + '@example.com',
  topic: 'Message ' + i + ' about a long topic that wraps',
  verdict: VERDICTS[i % 3] ?? 'kept',
  at: new Date(Date.UTC(2026, 10, 1 + (i % 20), 8, i % 60)).toISOString(),
}))
const inquiry = col<Inquiry>()

function Long(): ReactElement {
  const table = useDataTable<Inquiry>({
    id: 'e16-long',
    label: 'Inquiry log',
    columns: [
      inquiry.entity('id', { header: 'Inquiry', mono: true, sub: (r) => r.sender, priority: 1 }),
      inquiry.text('topic', { header: 'Message', priority: 2 }),
      inquiry.status('verdict', {
        header: 'Verdict',
        options: VERDICTS,
        labels: { kept: 'Kept', spam: 'Spam', review: 'Review' },
        tone: () => 'neutral',
        priority: 1,
      }),
      inquiry.date('at', { header: 'Received', mono: true, priority: 2 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
  })
  return (
    <div data-testid="e16-long">
      <DataPanel
        title="Inquiry list"
        phase="ready"
        bodySize={{ rows: 9 }}
        body={() => <DataTable table={table} height="fill" />}
      />
    </div>
  )
}

type Run = { id: string; presetName: string; model: string; cost: number; tokens: number }
const PRESETS = ['Chat', 'Briefing', 'Podcast']
const RUNS: readonly Run[] = Array.from({ length: 15 }, (_, i) => ({
  id: 'r' + i,
  presetName: PRESETS[Math.floor(i / 5)] ?? 'Chat',
  model: 'model-' + i,
  cost: 0.01 * (i + 1),
  tokens: 1000 * (i + 1),
}))
const run = col<Run>()

function Grouped(): ReactElement {
  const table = useDataTable<Run>({
    id: 'e16-grouped',
    label: 'Runs',
    columns: [
      run.entity('model', { header: 'Model', priority: 1 }),
      run.text('presetName', { header: 'Preset', priority: 2 }),
      run.number('cost', { header: 'Cost', priority: 1 }),
      run.number('tokens', { header: 'Tokens', priority: 2 }),
    ],
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    group: { by: 'presetName' },
  })
  return (
    <div data-testid="e16-grouped">
      <DataPanel
        title="Runs"
        phase="ready"
        bodySize={{ rows: 19 }}
        body={() => <DataTable table={table} height="fill" />}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <Long />
      <Grouped />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
