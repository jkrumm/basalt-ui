/**
 * The `panel-rows` fixture: a `DataPanel` sized by rows over a `DataTable` of thirty rows and ten
 * columns, so the body runs past its height and a phone card has more values than it keeps. Entry
 * of `panel-rows.layout.test.ts`, which bundles it in memory.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = {
  id: string
  name: string
  a: string
  b: string
  c: string
  d: string
  e: string
  f: string
  g: string
  h: string
}
const ROWS: readonly Row[] = Array.from({ length: 30 }, (_, i) => {
  const v = (k: string): string => `${k}${i}`
  return {
    id: `r${i}`,
    name: `Row ${i}`,
    a: v('a'),
    b: v('b'),
    c: v('c'),
    d: v('d'),
    e: v('e'),
    f: v('f'),
    g: v('g'),
    h: v('h'),
  }
})
const c = col<Row>()

function Fixture(): ReactElement {
  const table = useDataTable<Row>({
    id: 'panel-rows',
    label: 'Rows',
    columns: [
      c.entity('name'),
      c.text('a'),
      c.text('b'),
      c.text('c'),
      c.text('d'),
      c.text('e'),
      c.text('f'),
      c.text('g'),
      c.text('h'),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return (
    <main data-testid="pr-root" className="p-4">
      <div data-testid="pr-panel">
        <DataPanel
          title="Rows"
          phase="ready"
          bodySize={{ rows: 6 }}
          body={() => <DataTable table={table} />}
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
