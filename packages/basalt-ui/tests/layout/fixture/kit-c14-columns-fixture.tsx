/**
 * Expression cycle 14 contract (3), a phone form for a long numeric table (n65 .23, cycle 13 n62 .57): twelve
 * reasons over five columns as `phone: 'columns'` (`c14-columns`) and the same table as fields
 * (`c14-cards`, the label-and-value grid). Entry of `kit-c14-columns.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
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

/** Seven columns whose priority 1 and 2 sum above 800 px: the plan demotes the answer, declared last, to 3. */
const WIDE_COLUMNS = [
  c.entity('name', { header: 'Reason' }),
  c.number('now', { header: 'This week', card: 'meta' }),
  c.number('prev', { header: 'Last week' }),
  c.number('share', { header: 'Share' }),
  c.number('now', { id: 'now2', header: 'Peak' }),
  c.number('prev', { id: 'prev2', header: 'Low' }),
  c.number('change', { header: 'Change', card: 'value' }),
]

function Wide(): ReactElement {
  const table = useDataTable<Reason>({
    id: 'c14-demoted',
    label: 'Friction reasons, wide',
    columns: WIDE_COLUMNS,
    data: REASONS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone: 'columns',
  })
  return (
    <div data-testid="c14-demoted">
      <DataTable table={table} />
    </div>
  )
}

/** A narrow scroll table in a six-row panel: the box keeps its declared height after loading. */
function Panel(): ReactElement {
  const table = useDataTable<Reason>({
    id: 'c14-panel',
    label: 'Friction reasons in a panel',
    columns: COLUMNS,
    data: REASONS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone: 'scroll',
  })
  return (
    <div data-testid="c14-panel">
      <DataPanel
        title="Reasons"
        phase="ready"
        bodySize={{ rows: 6 }}
        body={() => <DataTable table={table} />}
      />
    </div>
  )
}

function Table({ id, phone }: { id: string; phone: 'columns' | 'fields' }): ReactElement {
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
      <Table id="c14-cards" phone="fields" />
      <Wide />
      <Panel />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
