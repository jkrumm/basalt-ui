/**
 * Expression cycle 19, no blank band under a stretched card's painted content (`v3-expr-19-kit-fixes` 1, n98 .38,
 * probe n88, n90, n92, n70, n76): a ranked list and a table panel each sit beside a 380 px neighbour, so the grid row
 * stretches them. `data-testid` `k19-<card>` frames one. Entry of `kit-expr19-stretch.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { BarList } from '../../../src/cards/bar-list'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = { id: string; name: string; amount: string }
const ROWS: readonly Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: `r${i}`,
  name:
    i === 0
      ? 'Quarterly ledger entry with a very long descriptive name that needs a second line, then a third clause that keeps it past one line of the whole panel'
      : `Entry ${i}`,
  amount: `${i}`,
}))
const c = col<Row>()

function Ledger(): ReactElement {
  const table = useDataTable<Row>({
    id: 'k19-ledger',
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

const ITEMS = ['Lumen', 'Quill', 'Vesper', 'Prism', 'Atlas'].map((label, i) => ({
  key: label,
  label,
  value: 40 - i * 7,
}))

const GRID = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
  alignItems: 'stretch',
  marginBottom: 16,
} as const

/** One card beside a 380 px neighbour (stretched) or alone (its natural height). */
function Pair({
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
      <div data-testid={`k19-${id}${stretched ? '' : '-natural'}`}>{children}</div>
      {stretched && <div style={{ height: 380 }} />}
    </div>
  )
}

const CARDS = {
  panel: <Ledger />,
  list: <BarList title="Unpriced spend by model" phase="ready" bodyRows={5} items={ITEMS} />,
} as const

function Fixture(): ReactElement {
  return (
    <main className="p-4 text-foreground">
      {Object.entries(CARDS).flatMap(([id, card]) => [
        <Pair key={id} id={id} stretched>
          {card}
        </Pair>,
        <Pair key={`${id}-n`} id={id} stretched={false}>
          {card}
        </Pair>,
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
