/**
 * Expression cycle 14 contract (3), a phone form for a long numeric table (n65 .23, cycle 13 n62 .57): twelve
 * reasons over five columns as `phone: 'columns'` (`c14-columns`) and the same table as cards
 * (`c14-cards`). Entry of `kit-c14-columns.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Reason = { id: string; name: string; change: number; now: number; prev: number; share: number }
const NAMES = [
  'Review wait',
  'Gate flake',
  'Merge conflict on the plan file',
  'Spec verdict pending',
  'Quota exhausted',
  'Deploy lock held',
  'Flaky layout test',
  'Missing secret',
  'Rebase conflict',
  'CI runner offline',
  'Owner decision',
  'Docs drift',
]
const REASONS: readonly Reason[] = NAMES.map((name, i) => ({
  id: `r${i}`,
  name,
  change: 12 - i * 2,
  now: 40 - i * 3,
  prev: 28 - i,
  share: 0.3 - i * 0.02,
}))
const c = col<Reason>()
const COLUMNS = [
  c.entity('name', { header: 'Reason' }),
  c.number('change', { header: 'Change', card: 'value' }),
  c.number('now', { header: 'This week', card: 'meta' }),
  c.number('prev', { header: 'Last week', card: 'meta' }),
  c.number('share', { header: 'Share', card: 'meta' }),
]

function Table({ id, phone }: { id: string; phone: 'columns' | 'cards' }): ReactElement {
  const table = useDataTable<Reason>({
    id,
    label: 'Friction reasons',
    columns: COLUMNS,
    data: REASONS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone,
  })
  return (
    <div data-testid={id}>
      <DataTable table={table} />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-8 p-4 text-foreground">
      <Table id="c14-columns" phone="columns" />
      <Table id="c14-cards" phone="cards" />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
