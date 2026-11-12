// The shipped `./table` composite on three columns: React + react-dom `createRoot` and one `DataTable`.
// Built beside `floor.tsx` and `base0`; table minus floor is the own code of `./table` (spike S5).
import { createRoot } from 'react-dom/client'
import { col } from '../../../../packages/basalt-ui/src/table/core/kinds'
import { DataTable } from '../../../../packages/basalt-ui/src/table/parts/data-table'
import { useDataTable } from '../../../../packages/basalt-ui/src/table/use-data-table'

type Row = { id: string; name: string; amount: number; state: string }

const ROWS: Row[] = [{ id: 'r1', name: 'Project 1', amount: 10, state: 'Sales' }]

function App() {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'rows',
    label: 'Rows',
    columns: [
      c.text('name', { header: 'Name' }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.status('state', { options: ['Sales', 'Design'], filter: 'multi', header: 'State' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  } as never)
  return <DataTable table={t} />
}

const root = document.getElementById('root')
if (root !== null) createRoot(root).render(<App />)
