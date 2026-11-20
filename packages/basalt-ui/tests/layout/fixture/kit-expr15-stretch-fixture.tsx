/**
 * Expression cycle 15, a stretched card keeps its extra height below its content (`v3-expr-15-kit-fixes` 3,
 * n70 .15 and n71 .20): a DataPanel of nine ledger rows and a StatCard, each in a grid row beside a tall
 * neighbour. `data-testid="st-panel"` and `"st-stat"` frame the two cards. Entry of
 * `kit-expr15-stretch.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { StatCard } from '../../../src/cards/stat-card'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = { id: string; name: string; amount: string }
const ROWS: readonly Row[] = Array.from({ length: 9 }, (_, i) => ({
  id: `r${i}`,
  name: `Entry ${i}`,
  amount: `${i}`,
}))
const c = col<Row>()

function Ledger(): ReactElement {
  const table = useDataTable<Row>({
    id: 'st-ledger',
    label: 'Ledger',
    columns: [c.entity('name'), c.text('amount')],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <DataPanel
      title="Ledger"
      phase="ready"
      bodySize={{ rows: 10 }}
      body={() => <DataTable table={table} />}
    />
  )
}

const GRID = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
  alignItems: 'stretch',
} as const

function Fixture(): ReactElement {
  return (
    <main className="p-4">
      <div style={GRID}>
        <div data-testid="st-panel">
          <Ledger />
        </div>
        <div style={{ height: 700 }} />
      </div>
      <div style={{ ...GRID, marginTop: 16 }}>
        <div data-testid="st-stat">
          <StatCard
            title="Keeper rate"
            value={93}
            unit="%"
            phase="ready"
            footer={[{ label: 'Behind', value: 4 }]}
          />
        </div>
        <div style={{ height: 700 }} />
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
