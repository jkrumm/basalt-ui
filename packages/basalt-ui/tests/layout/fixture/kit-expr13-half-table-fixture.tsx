/**
 * Expression cycle 13 kit fixes, the DataTable half-width group: the windows table of n62 and the charges
 * table of n51, each in a DataPanel in a 750 px cell, two cells side by side on an 1800 px page. The
 * columns, the row count and the `bodySize` are the scenarios'. Entry of `kit-expr13-half-table.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Run = {
  id: string
  label: string
  verdict: string
  avgKt: number
  gustKt: number
  ratio: number
}
const VERDICTS = ['Ride', 'Strong', 'Offshore'] as const
const RUNS: readonly Run[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  label: `Window ${i + 1} · 0${i}:00–0${i + 3}:00`,
  verdict: VERDICTS[i % 3]!,
  avgKt: 14 + i,
  gustKt: 22 + i * 2,
  ratio: 1.2 + i * 0.1,
}))
const w = col<Run>()
const WINDOW_COLUMNS = [
  w.entity('label', { header: 'Window', mono: true, sortable: false, priority: 1 }),
  w.status('verdict', {
    header: 'Verdict',
    options: VERDICTS,
    tone: (v) => (v === 'Offshore' ? 'bad' : 'neutral'),
    sortable: false,
    priority: 1,
  }),
  w.number('avgKt', { header: 'Mean', unit: 'kt', digits: 0, sortable: false, priority: 2 }),
  w.number('gustKt', { header: 'Peak', unit: 'kt', digits: 0, sortable: false, priority: 2 }),
  w.number('ratio', { header: 'Ratio', unit: '×', digits: 1, sortable: false, priority: 3 }),
]

function WindowsTable(): ReactElement {
  const table = useDataTable<Run>({
    id: 'x13-windows-table',
    label: 'Windows',
    columns: WINDOW_COLUMNS,
    data: RUNS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: RUNS.length,
  })
  return <DataTable table={table} />
}

type Charge = {
  id: string
  merchant: string
  at: string
  amount: number
  ratio: number
  check: string
  category: string
}
const CHECKS = ['Over 2×', 'Repeat', 'In range'] as const
const CHARGES: readonly Charge[] = Array.from({ length: 14 }, (_, i) => ({
  id: `c${i}`,
  merchant: `Merchant ${i + 1}`,
  at: `2026-11-${String(3 + i).padStart(2, '0')} 14:20`,
  amount: 12.5 + i * 7,
  ratio: 1 + i * 0.2,
  check: CHECKS[i % 3]!,
  category: i % 2 === 0 ? 'Groceries and household' : 'Travel',
}))
const ch = col<Charge>()
const CHARGE_COLUMNS = [
  ch.entity('merchant', { header: 'Merchant', priority: 1, sub: (d) => d.at, subMono: true }),
  ch.money('amount', { header: 'Amount', currency: 'EUR', priority: 1 }),
  ch.number('ratio', { header: 'vs usual', digits: 1, priority: 2 }),
  ch.status('check', {
    header: 'Check',
    options: CHECKS,
    tone: (v) => (v === 'Over 2×' ? 'bad' : 'neutral'),
    priority: 3,
  }),
  ch.text('category', { header: 'Category', priority: 3 }),
]

function ChargesTable(): ReactElement {
  const table = useDataTable<Charge>({
    id: 'x13-charges-table',
    label: 'Charges to check',
    columns: CHARGE_COLUMNS,
    data: CHARGES,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: CHARGES.length,
  })
  return <DataTable table={table} height="fill" />
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-row flex-wrap items-start gap-4 p-4 text-foreground">
      <div data-testid="x13-windows" className="min-w-0" style={{ width: 750 }}>
        <DataPanel
          title="Windows by state"
          subtitle="Ride needs 12–25 kt"
          phase="ready"
          bodySize={{ rows: RUNS.length + 1 }}
          body={() => <WindowsTable />}
        />
      </div>
      <div data-testid="x13-charges" className="min-w-0" style={{ width: 750 }}>
        <DataPanel
          title="Charges to check"
          subtitle="Over 2×, repeated or without a category"
          phase="ready"
          bodySize={{ height: 454 }}
          body={() => <ChargesTable />}
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
