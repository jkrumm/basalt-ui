/**
 * Expression cycle 18, no blank band under a stretched card's content (`v3-expr-18-kit-fixes` 5, n88 .17, n90 .26,
 * n92 .44, probe n70 and n76): each card sits in a grid row beside a 700 px neighbour, so the row stretches it.
 * `data-testid` `k18-<card>` frames one. Entry of `kit-expr18-stretch.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import { DataPanel } from '../../../src/cards/data-panel'
import { StatCard } from '../../../src/cards/stat-card'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = { id: string; name: string; amount: string }
const ROWS: readonly Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: `r${i}`,
  name: `Entry ${i}`,
  amount: `${i}`,
}))
const c = col<Row>()

function Ledger(): ReactElement {
  const table = useDataTable<Row>({
    id: 'k18-ledger',
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
      body={() => <DataTable table={table} height="fill" />}
    />
  )
}

const ITEMS = ['Tutorials', 'Courses', 'Lessons'].map((label, i) => ({
  key: label,
  label,
  value: 30 - i * 7,
}))

const GRID = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
  alignItems: 'stretch',
  marginBottom: 16,
} as const

/** One card beside a 700 px neighbour (stretched) or alone (its natural height). */
function Row({
  id,
  stretched,
  children,
}: {
  id: string
  stretched: boolean
  children: ReactElement
}): ReactElement {
  return (
    <div style={GRID}>
      <div data-testid={`k18-${id}${stretched ? '' : '-natural'}`}>{children}</div>
      {stretched && <div style={{ height: 700 }} />}
    </div>
  )
}

const CARDS = {
  panel: <Ledger />,
  list: <BarList title="Items by type" phase="ready" bodyRows={4} items={ITEMS} />,
  stat: (
    <StatCard
      title="Balanced pairs"
      value={1}
      unit="of 4"
      sub="Furthest out: Pull-up to bodyweight"
      phase="ready"
      footer={[
        { label: 'Lifts logged', value: '4 of 4' },
        { label: 'Not measured', value: 0 },
      ]}
    />
  ),
} as const

function Fixture(): ReactElement {
  return (
    <main className="p-4 text-foreground">
      {Object.entries(CARDS).flatMap(([id, card]) => [
        <Row key={id} id={id} stretched>
          {card}
        </Row>,
        <Row key={`${id}-n`} id={id} stretched={false}>
          {card}
        </Row>,
      ])}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
