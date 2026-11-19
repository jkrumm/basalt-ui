/**
 * Expression cycle 13 kit fixes, the DataPanel group: the rows body of `kit-expr13-panel.layout.test.ts`.
 * Each panel mirrors a cycle 13 scenario's columns, series and `bodySize` (n57 SitesPanel, n58 Pools, n59, n60, n62).
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { DataPanelProps } from '../../../src/cards/contract'
import { DataPanel } from '../../../src/cards/data-panel'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Site = { id: string; name: string; sky: string; drive: number; best: number }
const SITE_ROWS: readonly Site[] = [
  'Salzsee',
  'Hohe Wand',
  'Mondfeld',
  'Lange Heide',
  'Nordmoor',
  'Kalkbucht',
].map((name, i) => ({
  id: `s${i}`,
  name,
  sky: `${(20.4 + i * 0.1).toFixed(1)} mag/arcsec²`,
  drive: 40 + i * 17,
  best: 1.5 + i,
}))
const c = col<Site>()

const SITE_COLUMNS = [
  c.entity('name', { header: 'Site', priority: 1, sortable: false, sub: (row) => row.sky }),
  c.meter('drive', { header: 'Drive, min', priority: 2, max: 155, card: 'value', sortable: false }),
  c.number('best', { header: 'Best, h', priority: 2, digits: 1, sortable: false }),
]

function SitesTable({ id, count }: { id: string; count: number }): ReactElement {
  const table = useDataTable<Site>({
    id,
    label: 'Drive and sky',
    columns: SITE_COLUMNS,
    data: SITE_ROWS.slice(0, count),
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: count,
  })
  return <DataTable table={table} />
}

function Sites({
  id,
  count,
  rows,
  phase = 'ready',
}: {
  id: string
  count: number
  rows: number
  phase?: 'ready' | 'loading'
}): ReactElement {
  return (
    <div data-testid={id} data-density="normal" className="min-w-0">
      <DataPanel
        title="Sites"
        subtitle="A higher mag is a darker sky"
        phase={phase}
        empty={null}
        bodySize={{ rows }}
        body={() => <SitesTable id={id} count={count} />}
      />
    </div>
  )
}

type State = 'ready' | 'loading' | 'empty' | 'error'
const retry = (): void => undefined

function Switch(): ReactElement {
  const [state, setState] = useState<State>('ready')
  useEffect(() => {
    ;(window as unknown as { x13Set: (s: State) => void }).x13Set = setState
  }, [])
  const phase: DataPanelProps['phase'] =
    state === 'loading' ? 'loading' : state === 'error' ? { tag: 'error', retry } : 'ready'
  return (
    <div data-testid="x13-switch" data-density="normal" className="min-w-0">
      <DataPanel
        title="Sites"
        subtitle="A higher mag is a darker sky"
        phase={phase}
        empty={state === 'empty' ? { cause: 'No sites listed yet' } : null}
        bodySize={{ rows: 5 }}
        body={() => <SitesTable id="x13-switch-table" count={4} />}
      />
    </div>
  )
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <Sites id="x13-sites-n57" count={4} rows={6} />
      <Sites id="x13-sites-three" count={3} rows={4} />
      <Sites id="x13-sites-four" count={4} rows={5} />
      <Sites id="x13-sites-six" count={6} rows={7} />
      <Sites id="x13-sites-loading" count={4} rows={5} phase="loading" />
      <Switch />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
