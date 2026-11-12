/**
 * The `table-selection` fixture (docs/v3/issues/g3/v3-table-t3b-selection.json): tables with a
 * tick column, long labels and a `c.select` editor column beside it. No shell. Each probe is a
 * `data-testid` box:
 * - `sel-cards`: the default phone tier (cards below the plan's threshold), tick + `c.select` +
 *   actions, so the card tier has all three to place;
 * - `sel-scroll`: `phone: 'scroll'`, identity pinned start and actions pinned end beside the tick.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import type { UseDataTable } from '../../src/table/contract'

type Row = { id: string; payee: string; category: string; note: string; amount: number }

const CATEGORIES = ['Housing', 'Food', 'Travel'] as const

const ROWS: Row[] = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  payee: i % 2 === 0 ? 'Counterparty Holdings International Limited' : `Acme ${i}`,
  category: CATEGORIES[i % CATEGORIES.length] ?? CATEGORIES[0],
  note: `A note about booking ${i} that runs long enough to need room`,
  amount: 100 + i * 17,
}))

const c = col<Row>()

function Probe({ id, phone }: { id: string; phone?: 'scroll' }): ReactElement {
  const t = useDataTable<Row>({
    id,
    label: `${id} rows`,
    columns: [
      c.entity('payee', { header: 'Payee' }),
      c.select('category', {
        label: (r) => `Category of ${r.payee}`,
        options: [...CATEGORIES],
        commit: () => undefined,
      }),
      c.money('amount', { currency: 'EUR', header: 'Amount' }),
      c.text('note', { header: 'Note', priority: 3 }),
      c.actions([{ key: 'open', label: 'Open', onClick: () => undefined }]),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    selection: { bulk: [{ key: 'archive', label: 'Archive', onClick: () => undefined }] },
    ...(phone !== undefined && { phone }),
  } as UseDataTable<Row>)
  return <DataTable table={t} />
}

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="sel-cards" className="min-w-0">
        <Probe id="sel-cards" />
      </div>
      <div data-testid="sel-scroll" className="min-w-0">
        <Probe id="sel-scroll" phone="scroll" />
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
